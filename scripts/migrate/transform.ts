/*
 * Turns the Supabase export into JSONL files in the Convex schema shape.
 *
 * Every row keeps its Supabase uuid as `legacy_id` and its created_at as
 * `_creationTime` (ms). Foreign keys are rewritten from uuids to Convex ids
 * using the maps the orchestrator pulls from the deployment after each table
 * lands, which is why the tables are transformed in dependency order.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { DATA_DIR } from './shared.ts'

export type IdMap = Map<string, string>

type Row = Record<string, unknown>

const ms = (value: unknown): number => {
	const parsed = Date.parse(String(value))
	if (Number.isNaN(parsed)) throw new Error(`Bad timestamp: ${String(value)}`)
	return parsed
}

const num = (value: unknown): number => {
	const parsed = Number(value)
	if (!Number.isFinite(parsed)) throw new Error(`Bad number: ${String(value)}`)
	return parsed
}

const str = (value: unknown): string => (value === null || value === undefined ? '' : String(value))

const optStr = (value: unknown): string | undefined =>
	value === null || value === undefined || value === '' ? undefined : String(value)

/** Drop undefined so the JSONL has no `null`s for optional fields */
const compact = (row: Row): Row =>
	Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined))

const base = (row: Row) => ({
	_creationTime: ms(row.created_at),
	updated_at: ms(row.updated_at ?? row.created_at),
	legacy_id: String(row.id),
})

export async function readExport(table: string): Promise<Row[]> {
	return JSON.parse(await readFile(`${DATA_DIR}/supabase/${table}.json`, 'utf8')) as Row[]
}

export async function writeJsonl(table: string, rows: Row[]): Promise<string> {
	const file = `${DATA_DIR}/convex/${table}.jsonl`
	await writeFile(file, rows.map((row) => JSON.stringify(compact(row))).join('\n') + '\n')
	return file
}

export interface Skipped {
	table: string
	legacy_id: string
	reason: string
}

const requireRef = (map: IdMap, legacyId: unknown, what: string): string => {
	const id = map.get(String(legacyId))
	if (!id) throw new Error(`${what} ${String(legacyId)} not found`)
	return id
}

export const transformInventory = (rows: Row[]): Row[] =>
	rows.map((row) => ({
		...base(row),
		item_name: str(row.item_name),
		quantity: num(row.quantity),
		reorder_level: num(row.reorder_level),
		unit: str(row.unit),
		remark: str(row.remark),
		order_date: optStr(row.order_date),
		non_order_reason: optStr(row.non_order_reason),
		back_order: Boolean(row.back_order),
		not_track: Boolean(row.not_track),
		is_pinned: Boolean(row.is_pinned),
	}))

export const transformPayroll = (rows: Row[]): Row[] =>
	rows.map((row) => ({
		...base(row),
		name: str(row.name),
		basic_salary: num(row.basic_salary),
		epf_employer: num(row.epf_employer),
		lindung_24_jam: Boolean(row.lindung_24_jam),
	}))

export const transformPayrollRuns = (rows: Row[]): Row[] =>
	rows.map((row) => ({
		...base(row),
		year: num(row.year),
		month: num(row.month),
		finalized_at: ms(row.finalized_at ?? row.created_at),
	}))

export function transformBatches(rows: Row[], items: IdMap, skipped: Skipped[]): Row[] {
	return rows.flatMap((row) => {
		const item_id = items.get(String(row.item_id))
		if (!item_id) {
			skipped.push({ table: 'stock_batches', legacy_id: String(row.id), reason: 'item missing' })
			return []
		}
		return [
			{
				...base(row),
				item_id,
				quantity: num(row.quantity),
				expiry_date: optStr(row.expiry_date),
			},
		]
	})
}

const MOVEMENT_TYPES = new Set(['stock_in', 'stock_out'])

export function transformMovements(
	rows: Row[],
	items: IdMap,
	batches: IdMap,
	skipped: Skipped[],
): Row[] {
	return rows.flatMap((row) => {
		const item_id = items.get(String(row.item_id))
		if (!item_id) {
			skipped.push({ table: 'stock_movements', legacy_id: String(row.id), reason: 'item missing' })
			return []
		}
		const movement_type = str(row.movement_type)
		if (!MOVEMENT_TYPES.has(movement_type)) {
			throw new Error(`stock_movements ${String(row.id)}: unknown movement_type ${movement_type}`)
		}
		return [
			{
				...base(row),
				item_id,
				item_name: str(row.item_name),
				quantity: num(row.quantity),
				movement_type,
				remark: str(row.remark),
				batch_id: row.batch_id ? batches.get(String(row.batch_id)) : undefined,
				expiry_date: optStr(row.expiry_date),
			},
		]
	})
}

const REQUEST_STATUSES = new Set(['Pending', 'Approved', 'Rejected'])

export function transformRequests(rows: Row[], items: IdMap, skipped: Skipped[]): Row[] {
	return rows.flatMap((row) => {
		const item_id = items.get(String(row.item_id))
		if (!item_id) {
			skipped.push({ table: 'stock_requests', legacy_id: String(row.id), reason: 'item missing' })
			return []
		}
		const status = str(row.status)
		if (!REQUEST_STATUSES.has(status)) {
			throw new Error(`stock_requests ${String(row.id)}: unknown status ${status}`)
		}
		return [
			{
				...base(row),
				item_id,
				item_name: str(row.item_name),
				quantity: num(row.quantity),
				remark: optStr(row.remark),
				status,
			},
		]
	})
}

export const transformPayrollRunItems = (rows: Row[], runs: IdMap, employees: IdMap): Row[] =>
	rows.map((row) => ({
		...base(row),
		run_id: requireRef(runs, row.run_id, 'payroll run'),
		employee_id: row.employee_id ? employees.get(String(row.employee_id)) : undefined,
		employee_name: str(row.employee_name),
		basic_salary: num(row.basic_salary),
		epf_employee: num(row.epf_employee),
		epf_employer: num(row.epf_employer),
		socso_employee: num(row.socso_employee),
		socso_employer: num(row.socso_employer),
		eis_employee: num(row.eis_employee),
		eis_employer: num(row.eis_employer),
		lindung_24_jam: num(row.lindung_24_jam),
		pcb: num(row.pcb),
		cp38: num(row.cp38),
		net_salary: num(row.net_salary),
	}))

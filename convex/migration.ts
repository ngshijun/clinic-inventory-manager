import { v } from 'convex/values'
import { internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { movementsByType } from './lib/aggregates'

/*
 * Consistency check. Internal only, nothing in the app calls it:
 *
 *   npx convex run migration:verify '{}' [--prod]
 *
 * Row counts, items whose quantity does not equal the sum of their batches,
 * and references that point at missing rows.
 */
export const verify = internalQuery({
	args: {},
	returns: v.object({
		counts: v.object({
			inventory: v.number(),
			stock_batches: v.number(),
			stock_movements: v.number(),
			stock_requests: v.number(),
			payroll: v.number(),
			payroll_runs: v.number(),
			payroll_run_items: v.number(),
		}),
		quantityMismatches: v.array(
			v.object({ item_name: v.string(), quantity: v.number(), batchTotal: v.number() }),
		),
		danglingBatches: v.number(),
		danglingRequests: v.number(),
		danglingRunItems: v.number(),
	}),
	handler: async (ctx) => {
		const inventory = await ctx.db.query('inventory').collect()
		const batches = await ctx.db.query('stock_batches').collect()
		const payroll = await ctx.db.query('payroll').collect()
		const runs = await ctx.db.query('payroll_runs').collect()
		const runItems = await ctx.db.query('payroll_run_items').collect()

		const itemIds = new Set<string>(inventory.map((i) => i._id))
		const runIds = new Set<string>(runs.map((r) => r._id))

		const batchTotals = new Map<Id<'inventory'>, number>()
		let danglingBatches = 0
		for (const batch of batches) {
			if (!itemIds.has(batch.item_id)) danglingBatches++
			batchTotals.set(batch.item_id, (batchTotals.get(batch.item_id) ?? 0) + batch.quantity)
		}

		const quantityMismatches = inventory.flatMap((item) => {
			const batchTotal = batchTotals.get(item._id) ?? 0
			return batchTotal === item.quantity
				? []
				: [{ item_name: item.item_name, quantity: item.quantity, batchTotal }]
		})

		// ~10k requests today, and a query may read up to ~16k
		// docs. If this ever throws, count per status via by_status instead.
		const requests = await ctx.db.query('stock_requests').collect()
		const requestCount = requests.length
		const danglingRequests = requests.filter((r) => !itemIds.has(r.item_id)).length

		const danglingRunItems = runItems.filter((item) => !runIds.has(item.run_id)).length

		const [stockIn, stockOut] = await Promise.all([
			movementsByType.count(ctx, { namespace: 'stock_in' }),
			movementsByType.count(ctx, { namespace: 'stock_out' }),
		])

		return {
			counts: {
				inventory: inventory.length,
				stock_batches: batches.length,
				stock_movements: stockIn + stockOut,
				stock_requests: requestCount,
				payroll: payroll.length,
				payroll_runs: runs.length,
				payroll_run_items: runItems.length,
			},
			quantityMismatches,
			danglingBatches,
			danglingRequests,
			danglingRunItems,
		}
	},
})

const period = (run: { year: number; month: number } | null): string =>
	run ? `${run.year}-${String(run.month).padStart(2, '0')}` : 'unknown'

/*
 * Names that were copied into history before a rename reached it. Read only:
 *
 *   npx convex run migration:checkNames '{}' [--prod]
 *
 * `payrollRenamed` are saved payroll rows that hold an employee's old name and
 * `payrollUnlinked` are rows tied to no employee; `matches` says how many
 * employees have exactly that name. `requestsRenamed` counts requests that
 * hold an item's old name. Movements are too many to read in one query:
 * `syncNames` reports how many it corrected.
 */
export const checkNames = internalQuery({
	args: {},
	returns: v.object({
		payrollRenamed: v.array(v.object({ period: v.string(), saved: v.string(), now: v.string() })),
		payrollUnlinked: v.array(
			v.object({ period: v.string(), saved: v.string(), matches: v.number() }),
		),
		requestsRenamed: v.number(),
	}),
	handler: async (ctx) => {
		const employees = await ctx.db.query('payroll').collect()
		const payrollRenamed = []
		const payrollUnlinked = []
		for (const row of await ctx.db.query('payroll_run_items').collect()) {
			const run = period(await ctx.db.get(row.run_id))
			const employee = row.employee_id ? await ctx.db.get(row.employee_id) : null
			if (!employee) {
				const matches = employees.filter((e) => e.name === row.employee_name).length
				payrollUnlinked.push({ period: run, saved: row.employee_name, matches })
			} else if (employee.name !== row.employee_name) {
				payrollRenamed.push({ period: run, saved: row.employee_name, now: employee.name })
			}
		}

		const names = new Map<string, string>()
		for (const item of await ctx.db.query('inventory').collect())
			names.set(item._id, item.item_name)
		let requestsRenamed = 0
		for (const request of await ctx.db.query('stock_requests').collect()) {
			const name = names.get(request.item_id)
			if (name !== undefined && name !== request.item_name) requestsRenamed++
		}
		return { payrollRenamed, payrollUnlinked, requestsRenamed }
	},
})

const SYNC_BATCH = 500

/*
 * One-off repair for the names `checkNames` reports, a page per mutation,
 * rescheduling itself until done. Each step logs what it corrected.
 *
 *   npx convex run migration:syncNames '{}' [--prod]
 *
 * A saved payroll row tied to no employee is tied to the one employee with
 * exactly its name; a row that matches none, or more than one, is left alone.
 */
export const syncNames = internalMutation({
	args: {
		table: v.optional(v.union(v.literal('stock_requests'), v.literal('stock_movements'))),
		cursor: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		if (args.table === undefined) {
			const employees = await ctx.db.query('payroll').collect()
			let renamed = 0
			let linked = 0
			for (const row of await ctx.db.query('payroll_run_items').collect()) {
				const employee = row.employee_id ? await ctx.db.get(row.employee_id) : null
				if (employee) {
					if (employee.name === row.employee_name) continue
					await ctx.db.patch(row._id, { employee_name: employee.name })
					renamed++
					continue
				}
				const matches = employees.filter((e) => e.name === row.employee_name)
				if (matches.length !== 1) continue
				await ctx.db.patch(row._id, { employee_id: matches[0]._id })
				linked++
			}
			console.log(`payroll rows: ${renamed} renamed, ${linked} tied to an employee`)
			await ctx.scheduler.runAfter(0, internal.migration.syncNames, { table: 'stock_requests' })
			return null
		}

		const page = await ctx.db
			.query(args.table)
			.paginate({ numItems: SYNC_BATCH, cursor: args.cursor ?? null })
		let renamed = 0
		for (const row of page.page) {
			const item = await ctx.db.get(row.item_id)
			if (!item || item.item_name === row.item_name) continue
			await ctx.db.patch(row._id, { item_name: item.item_name })
			renamed++
		}
		console.log(`${args.table}: ${renamed} of ${page.page.length} renamed`)
		if (!page.isDone) {
			await ctx.scheduler.runAfter(0, internal.migration.syncNames, {
				table: args.table,
				cursor: page.continueCursor,
			})
		} else if (args.table === 'stock_requests') {
			await ctx.scheduler.runAfter(0, internal.migration.syncNames, { table: 'stock_movements' })
		}
		return null
	},
})

/*
 * One-off: joins the batches of one item that share an expiry date, as stock
 * in now does. The oldest keeps the stock and the others are deleted. Item
 * totals do not change.
 *
 *   npx convex run migration:mergeBatches '{}' [--prod]
 */
export const mergeBatches = internalMutation({
	args: {},
	returns: v.object({ merged: v.number() }),
	handler: async (ctx) => {
		const kept = new Map<string, { id: Id<'stock_batches'>; quantity: number; grew: boolean }>()
		let merged = 0
		for (const batch of await ctx.db.query('stock_batches').order('asc').collect()) {
			if (batch.quantity <= 0) continue
			const key = `${batch.item_id}|${batch.expiry_date ?? ''}`
			const first = kept.get(key)
			if (!first) {
				kept.set(key, { id: batch._id, quantity: batch.quantity, grew: false })
				continue
			}
			first.quantity += batch.quantity
			first.grew = true
			await ctx.db.delete(batch._id)
			merged++
		}
		const now = Date.now()
		for (const { id, quantity, grew } of kept.values()) {
			if (grew) await ctx.db.patch(id, { quantity, updated_at: now })
		}
		return { merged }
	},
})

/*
 * Supabase → Convex data migration.
 *
 *   node scripts/migrate/run.ts export            pull every table from Supabase
 *   node scripts/migrate/run.ts import [--prod]   load it into the Convex deployment
 *   node scripts/migrate/run.ts verify [--prod]   counts and consistency checks
 *   node scripts/migrate/run.ts backfill [--prod] rebuild the movements count aggregate
 *   node scripts/migrate/run.ts all    [--prod]   export, import, verify
 *
 * Without --prod the target is the deployment in .env.local (CONVEX_DEPLOYMENT).
 * Import replaces each table wholesale, so it is safe to re-run. Tables load
 * in dependency order and foreign keys are rewritten between steps.
 */
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { DATA_DIR, REPO_ROOT, SUPABASE_TABLES, loadDotEnv } from './shared.ts'
import { exportSupabase } from './supabase-export.ts'
import {
	readExport,
	transformBatches,
	transformInventory,
	transformMovements,
	transformPayroll,
	transformPayrollRunItems,
	transformPayrollRuns,
	transformRequests,
	writeJsonl,
	type IdMap,
	type Skipped,
} from './transform.ts'

const args = process.argv.slice(2)
const command = args[0]
const prod = args.includes('--prod')
const targetFlags = prod ? ['--prod'] : []

// The CLI writes progress spinners to stderr; only show them when it fails.
function convex(...cliArgs: string[]): string {
	try {
		return execFileSync('npx', ['convex', ...cliArgs], {
			cwd: REPO_ROOT,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
			env: process.env,
		})
	} catch (error) {
		const failure = error as { stderr?: string; stdout?: string }
		console.error(failure.stderr ?? '')
		console.error(failure.stdout ?? '')
		throw new Error(`convex ${cliArgs.slice(0, 2).join(' ')} failed`)
	}
}

async function importTable(table: string, rows: Record<string, unknown>[]): Promise<void> {
	const file = await writeJsonl(table, rows)
	convex('import', '--table', table, file, '--replace', '-y', ...targetFlags)
	console.log(`imported ${table}: ${rows.length} rows`)
}

function fetchIdMap(table: string): IdMap {
	const output = convex('run', 'migration:idMap', JSON.stringify({ table }), ...targetFlags)
	const json = output.slice(output.indexOf('['))
	const pairs = JSON.parse(json) as Array<{ legacy_id: string; id: string }>
	return new Map(pairs.map((pair) => [pair.legacy_id, pair.id]))
}

async function importAll(): Promise<void> {
	await mkdir(`${DATA_DIR}/convex`, { recursive: true })
	const skipped: Skipped[] = []

	// Tables nothing depends on
	await importTable('inventory', transformInventory(await readExport('inventory')))
	await importTable('payroll', transformPayroll(await readExport('payroll')))
	await importTable('payroll_runs', transformPayrollRuns(await readExport('payroll_runs')))

	const items = fetchIdMap('inventory')
	const employees = fetchIdMap('payroll')
	const runs = fetchIdMap('payroll_runs')

	// Tables that reference the ones above
	await importTable(
		'stock_batches',
		transformBatches(await readExport('stock_batches'), items, skipped),
	)
	await importTable(
		'stock_requests',
		transformRequests(await readExport('stock_requests'), items, skipped),
	)
	await importTable(
		'payroll_run_items',
		transformPayrollRunItems(await readExport('payroll_run_items'), runs, employees),
	)

	// Movements reference batches too
	const batches = fetchIdMap('stock_batches')
	const movementRows = transformMovements(
		await readExport('stock_movements'),
		items,
		batches,
		skipped,
	)
	await importTable('stock_movements', movementRows)

	await backfill(movementRows.length)

	if (skipped.length > 0) {
		const file = `${DATA_DIR}/skipped.json`
		await writeFile(file, JSON.stringify(skipped, null, 2))
		console.warn(`skipped ${skipped.length} rows whose parent no longer exists, see ${file}`)
	}
}

/**
 * The movements count aggregate is rebuilt in the background, a few hundred
 * entries per scheduled mutation (clear, then insert). Wait until the count
 * settles at the expected number so a verify straight after sees it.
 */
async function backfill(expected: number): Promise<void> {
	convex('run', 'movements:backfillAggregate', '{}', ...targetFlags)
	console.log('rebuilding movements aggregate...')
	const count = await waitForAggregate(expected)
	console.log(`movements aggregate rebuilt: ${count}`)
}

function readMovementCount(): number {
	const output = convex('run', 'migration:movementCount', '{}', ...targetFlags)
	return Number(output.trim().split('\n').pop())
}

async function waitForAggregate(expected: number): Promise<number> {
	let stableSince = 0
	let last = -1
	for (let attempt = 0; attempt < 600; attempt++) {
		const count = readMovementCount()
		if (count === expected) return count
		if (count === last) {
			stableSince++
			if (stableSince >= 15) {
				// Settled above the export count: the deployment has rows the export
				// does not (a dev deployment with test writes). Settled below it: the
				// scheduled chain broke; the deployment's logs say why.
				if (count > expected) {
					console.warn(`movements aggregate settled above the export count of ${expected}`)
					return count
				}
				throw new Error(`movements aggregate stuck at ${count}, expected ${expected}`)
			}
		} else {
			stableSince = 0
			last = count
		}
		await sleep(2000)
	}
	throw new Error('timed out waiting for the movements aggregate backfill')
}

/** Row counts from the export files, so verify can compare against the source. */
async function exportCounts(): Promise<Record<string, number> | null> {
	try {
		const entries = await Promise.all(
			SUPABASE_TABLES.map(async (table) => [table, (await readExport(table)).length] as const),
		)
		return Object.fromEntries(entries)
	} catch {
		return null
	}
}

async function verify(): Promise<void> {
	const output = convex('run', 'migration:verify', '{}', ...targetFlags)
	const report = JSON.parse(output.slice(output.indexOf('{'))) as {
		counts: Record<string, number>
		quantityMismatches: unknown[]
		danglingBatches: number
		danglingRequests: number
		danglingRunItems: number
	}
	console.log(JSON.stringify(report, null, 2))
	let problems =
		report.quantityMismatches.length +
		report.danglingBatches +
		report.danglingRequests +
		report.danglingRunItems

	// Every table must hold exactly as many rows as the export (minus skipped)
	const expected = await exportCounts()
	if (expected) {
		for (const [table, count] of Object.entries(expected)) {
			if (report.counts[table] !== count) {
				console.error(
					`count mismatch for ${table}: convex ${report.counts[table]}, export ${count}`,
				)
				problems++
			}
		}
	} else {
		console.warn('no export files found; skipped the count comparison')
	}
	if (problems > 0) {
		console.error(`verify: ${problems} problem(s) found`)
		process.exitCode = 1
	} else {
		console.log('verify: ok')
	}
}

async function main(): Promise<void> {
	loadDotEnv()
	switch (command) {
		case 'export':
			await exportSupabase()
			break
		case 'import':
			await importAll()
			break
		case 'verify':
			await verify()
			break
		case 'backfill': {
			const expected = await exportCounts()
			if (!expected) throw new Error('run export first so the expected count is known')
			await backfill(expected.stock_movements)
			break
		}
		case 'all':
			await exportSupabase()
			await importAll()
			await verify()
			break
		default:
			console.error(
				'usage: node scripts/migrate/run.ts <export|import|verify|backfill|all> [--prod]',
			)
			process.exitCode = 1
	}
}

await main()

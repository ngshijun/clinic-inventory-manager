import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(SCRIPT_DIR, '../..')
/** Exported and transformed data live here; the folder is gitignored. */
export const DATA_DIR = resolve(SCRIPT_DIR, 'data')

export const SUPABASE_TABLES = [
	'inventory',
	'stock_batches',
	'stock_movements',
	'stock_requests',
	'payroll',
	'payroll_runs',
	'payroll_run_items',
] as const

export type SupabaseTable = (typeof SUPABASE_TABLES)[number]

/** Minimal .env.local loader so the scripts need no extra dependency. */
export function loadDotEnv(): void {
	const file = resolve(REPO_ROOT, '.env.local')
	if (!existsSync(file)) return
	for (const line of readFileSync(file, 'utf8').split('\n')) {
		const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
		if (!match) continue
		const [, name, raw] = match
		if (process.env[name] !== undefined) continue
		const quoted = raw.match(/^(['"])(.*)\1\s*$/)
		// Unquoted values may carry an inline comment (`value # note`), which the
		// Convex CLI writes after CONVEX_DEPLOYMENT.
		process.env[name] = quoted ? quoted[2] : raw.replace(/\s+#.*$/, '').trim()
	}
}

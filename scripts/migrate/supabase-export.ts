/*
 * Pulls every row of every table out of Supabase over PostgREST and writes
 * one JSON file per table under scripts/migrate/data/supabase/.
 *
 * Reads only. Needs SUPABASE_URL and a key with read access to all rows
 * (SUPABASE_SERVICE_ROLE_KEY, or the anon key since the RLS policies are
 * open) in the environment or in .env.local.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { DATA_DIR, loadDotEnv, SUPABASE_TABLES, type SupabaseTable } from './shared.ts'

const PAGE_SIZE = 1000

export async function exportSupabase(): Promise<void> {
	loadDotEnv()
	const url = process.env.SUPABASE_URL ?? 'https://knezqdjwcgauoycrmbdi.supabase.co'
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
	if (!key) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY')

	const outDir = `${DATA_DIR}/supabase`
	await mkdir(outDir, { recursive: true })

	for (const table of SUPABASE_TABLES) {
		const rows = await fetchAll(url, key, table)
		await writeFile(`${outDir}/${table}.json`, JSON.stringify(rows))
		console.log(`exported ${table}: ${rows.length} rows`)
	}
}

async function fetchAll(
	url: string,
	key: string,
	table: SupabaseTable,
): Promise<Record<string, unknown>[]> {
	const rows: Record<string, unknown>[] = []
	for (let from = 0; ; from += PAGE_SIZE) {
		const response = await fetch(`${url}/rest/v1/${table}?select=*&order=created_at.asc,id.asc`, {
			headers: {
				apikey: key,
				Authorization: `Bearer ${key}`,
				Range: `${from}-${from + PAGE_SIZE - 1}`,
				'Range-Unit': 'items',
			},
		})
		if (!response.ok && response.status !== 416) {
			throw new Error(`${table}: HTTP ${response.status} ${await response.text()}`)
		}
		const page =
			response.status === 416 ? [] : ((await response.json()) as Record<string, unknown>[])
		rows.push(...page)
		if (page.length < PAGE_SIZE) return rows
	}
}

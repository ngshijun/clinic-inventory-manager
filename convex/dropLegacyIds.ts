import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import type { TableNames } from './_generated/dataModel'

/*
 * One-off: unset `legacy_id` on every row so the field can leave the schema.
 * Chains itself through the scheduler, one page per mutation.
 *
 *   npx convex run dropLegacyIds:run '{}' [--prod]
 */
const TABLES: TableNames[] = [
	'inventory',
	'stock_batches',
	'stock_movements',
	'stock_requests',
	'payroll',
	'payroll_runs',
	'payroll_run_items',
]
const PAGE = 500

export const run = internalMutation({
	args: { table: v.optional(v.string()), cursor: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const table = (args.table ?? TABLES[0]) as TableNames
		const page = await ctx.db
			.query(table)
			.paginate({ cursor: args.cursor ?? null, numItems: PAGE })
		let patched = 0
		for (const doc of page.page) {
			if (doc.legacy_id === undefined) continue
			await ctx.db.patch(doc._id, { legacy_id: undefined })
			patched++
		}
		console.log(`${table}: cleared ${patched} of ${page.page.length}`)

		if (!page.isDone) {
			await ctx.scheduler.runAfter(0, internal.dropLegacyIds.run, {
				table,
				cursor: page.continueCursor,
			})
			return null
		}
		const next = TABLES[TABLES.indexOf(table) + 1]
		if (next) await ctx.scheduler.runAfter(0, internal.dropLegacyIds.run, { table: next })
		else console.log('legacy_id cleared on every table')
		return null
	},
})

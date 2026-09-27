import { v } from 'convex/values'
import { internalQuery } from './_generated/server'
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

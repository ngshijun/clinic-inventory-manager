import { v } from 'convex/values'
import { internalMutation, internalQuery } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { movementsByType } from './lib/aggregates'
import { LEAD_DAYS, addDays, toIsoDate } from './lib/orders'

/*
 * One-off: folds order_date / back_order / non_order_reason into order_status.
 *
 *   npx convex run migration:convertOrderStatus '{}' [--prod]
 *
 * An order date becomes an order expected LEAD_DAYS later (a back-order has no
 * expected date). "Planning to order later" and "Supplier has no stock" become
 * a two-week snooze from today; "Alternative ordered" items are already
 * untracked and just lose the reason. Idempotent: rows without the old fields
 * are left alone. Delete this and the old schema fields once it has run.
 */
export const convertOrderStatus = internalMutation({
	args: {},
	returns: v.object({ ordered: v.number(), snoozed: v.number(), cleared: v.number() }),
	handler: async (ctx) => {
		const today = new Date().toISOString().slice(0, 10)
		const until = addDays(today, 14)
		let ordered = 0
		let snoozed = 0
		let cleared = 0
		// Bounded by the clinic's product count.
		for (const item of await ctx.db.query('inventory').collect()) {
			const { order_date, back_order, non_order_reason, ...rest } = item
			if (order_date === undefined && back_order === undefined && non_order_reason === undefined)
				continue
			const orderedOn = toIsoDate(order_date)
			if (orderedOn) {
				rest.order_status = {
					kind: 'ordered',
					ordered_on: orderedOn,
					expected_by: back_order ? undefined : addDays(orderedOn, LEAD_DAYS),
				}
				ordered++
			} else if (non_order_reason === 'Planning to order later') {
				rest.order_status = { kind: 'snoozed', until, reason: 'Will order later' }
				snoozed++
			} else if (non_order_reason === 'Supplier has no stock') {
				rest.order_status = { kind: 'snoozed', until, reason: 'Supplier has no stock' }
				snoozed++
			} else {
				cleared++
			}
			await ctx.db.replace(item._id, rest)
		}
		return { ordered, snoozed, cleared }
	},
})

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

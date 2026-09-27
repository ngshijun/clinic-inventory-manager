import { v } from 'convex/values'
import { internalMutation, internalQuery } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { movementsByType } from './lib/aggregates'
import { capitalName } from './lib/names'

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

/*
 * Raises the names typed before names were kept in capitals: employees and
 * their past payslip rows, and items with the movements and requests that
 * carry the item's name. Internal only, and safe to run again:
 *
 *   npx convex run migration:capitalNames '{}' [--prod]
 */
export const capitalNames = internalMutation({
	args: {},
	returns: v.object({
		employees: v.number(),
		payslips: v.number(),
		items: v.number(),
		movements: v.number(),
		requests: v.number(),
	}),
	handler: async (ctx) => {
		let employees = 0
		for (const employee of await ctx.db.query('payroll').collect()) {
			const name = capitalName(employee.name)
			if (name === employee.name) continue
			await ctx.db.patch(employee._id, { name })
			employees++
		}

		let payslips = 0
		for (const row of await ctx.db.query('payroll_run_items').collect()) {
			const employee_name = capitalName(row.employee_name)
			if (employee_name === row.employee_name) continue
			await ctx.db.patch(row._id, { employee_name })
			payslips++
		}

		let items = 0
		let movements = 0
		let requests = 0
		// Bounded by the clinic's product count (hundreds).
		for (const item of await ctx.db.query('inventory').collect()) {
			const item_name = capitalName(item.item_name)
			if (item_name === item.item_name) continue
			// `updated_at` is left alone: Not Moving reads it as the last stock movement
			await ctx.db.patch(item._id, { item_name })
			items++
			const itemMovements = await ctx.db
				.query('stock_movements')
				.withIndex('by_item', (q) => q.eq('item_id', item._id))
				.collect()
			for (const movement of itemMovements) {
				await ctx.db.patch(movement._id, { item_name })
				movements++
			}
			const itemRequests = await ctx.db
				.query('stock_requests')
				.withIndex('by_item', (q) => q.eq('item_id', item._id))
				.collect()
			for (const request of itemRequests) {
				await ctx.db.patch(request._id, { item_name })
				requests++
			}
		}
		return { employees, payslips, items, movements, requests }
	},
})

import { v } from 'convex/values'
import { internalMutation, internalQuery } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { movementsByType } from './lib/aggregates'
import { parseUnitLabel, unitLabel } from './lib/units'

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

/** Spelling slips in item names, found when the units were reviewed. */
const NAME_FIXES: Array<[wrong: string, right: string]> = [
	['CLEASNER', 'CLEANSER'],
	['SUL[HUR', 'SULPHUR'],
	['LOTON', 'LOTION'],
	['SULUTION', 'SOLUTION'],
]

/*
 * One-off: splits each item's unit text ("BOX (30 TAB)") into its three
 * parts and fills the units list from them. Typing slips are repaired on the
 * way: a letter O among the digits, missing or doubled spaces, and a unit
 * with no outer name, which becomes a PACK. Units are otherwise kept as they
 * are. Safe to run again. Remove once production has been converted.
 *
 *   npx convex run migration:splitUnits '{}' [--prod]
 */
export const splitUnits = internalMutation({
	args: {},
	returns: v.object({
		items: v.number(),
		units: v.array(v.string()),
		unitsFixed: v.array(v.object({ item_name: v.string(), from: v.string(), to: v.string() })),
		namesFixed: v.array(v.object({ from: v.string(), to: v.string() })),
		unreadable: v.array(v.object({ item_name: v.string(), unit: v.string() })),
	}),
	handler: async (ctx) => {
		const inventory = await ctx.db.query('inventory').collect()
		const names = new Set<string>()
		const unitsFixed: Array<{ item_name: string; from: string; to: string }> = []
		const namesFixed: Array<{ from: string; to: string }> = []
		const unreadable: Array<{ item_name: string; unit: string }> = []

		for (const item of inventory) {
			// Four names carry a stray space at the end, which search and sorting trip on
			let item_name = item.item_name.trim()
			for (const [wrong, right] of NAME_FIXES) item_name = item_name.replace(wrong, right)
			if (item_name !== item.item_name) {
				await ctx.db.patch(item._id, { item_name })
				const requests = await ctx.db
					.query('stock_requests')
					.withIndex('by_item', (q) => q.eq('item_id', item._id))
					.collect()
				for (const request of requests) await ctx.db.patch(request._id, { item_name })
				namesFixed.push({ from: item.item_name, to: item_name })
			}

			if (item.pack_size !== undefined) {
				names.add(item.unit)
				if (item.pack_unit) names.add(item.pack_unit)
				continue
			}
			const text = item.unit
				.trim()
				.toUpperCase()
				.replace(/^\(/, 'PACK (')
				.replace(/\(\s*[0-9O]+/, (digits) => digits.replace(/O/g, '0'))
			const parts = parseUnitLabel(text)
			if (!parts) {
				unreadable.push({ item_name, unit: item.unit })
				continue
			}
			await ctx.db.patch(item._id, {
				unit: parts.unit,
				pack_size: parts.pack_size,
				pack_unit: parts.pack_unit,
			})
			names.add(parts.unit)
			if (parts.pack_unit) names.add(parts.pack_unit)
			const label = unitLabel(parts)
			if (label !== item.unit) unitsFixed.push({ item_name, from: item.unit, to: label })
		}

		const now = Date.now()
		for (const name of names) {
			const existing = await ctx.db
				.query('units')
				.withIndex('by_name', (q) => q.eq('name', name))
				.unique()
			if (!existing) await ctx.db.insert('units', { name, updated_at: now })
		}

		return {
			items: inventory.length,
			units: [...names].sort(),
			unitsFixed,
			namesFixed,
			unreadable,
		}
	},
})

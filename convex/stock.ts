import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requireRole } from './lib/auth'
import {
	applyStockIn,
	applyStockOut,
	assertNonNegativeQuantity,
	insertMovement,
	recomputeItemQuantity,
	requireItem,
} from './lib/stock'
import { createItem, deleteItem } from './inventory'
import { inventoryDoc, stockBatchDoc } from './schema'

function optionalText(value: string | null | undefined): string | undefined {
	if (value === undefined || value === null) return undefined
	const trimmed = value.trim()
	return trimmed.length === 0 ? undefined : trimmed
}

export const stockIn = mutation({
	args: {
		auth: v.string(),
		item_id: v.id('inventory'),
		quantity: v.number(),
		clear_order_date: v.optional(v.boolean()),
		not_track: v.optional(v.boolean()),
		expiry_date: v.optional(v.union(v.string(), v.null())),
		remark: v.optional(v.string()),
	},
	returns: inventoryDoc,
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		return await applyStockIn(ctx, {
			item_id: args.item_id,
			quantity: args.quantity,
			clear_order_date: args.clear_order_date ?? true,
			not_track: args.not_track,
			expiry_date: optionalText(args.expiry_date),
			remark: args.remark ?? 'Stock in',
		})
	},
})

export const stockOut = mutation({
	args: {
		auth: v.string(),
		item_id: v.id('inventory'),
		quantity: v.number(),
		remark: v.optional(v.string()),
	},
	returns: inventoryDoc,
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		return await applyStockOut(ctx, {
			item_id: args.item_id,
			quantity: args.quantity,
			remark: args.remark ?? 'Stock out',
		})
	},
})

export const updateBatch = mutation({
	args: {
		auth: v.string(),
		batch_id: v.id('stock_batches'),
		quantity: v.number(),
		// null/undefined clears the expiry date.
		expiry_date: v.optional(v.union(v.string(), v.null())),
		remark: v.optional(v.string()),
	},
	returns: inventoryDoc,
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		assertNonNegativeQuantity(args.quantity)
		const batch = await ctx.db.get(args.batch_id)
		if (!batch) throw new ConvexError({ code: 'NOT_FOUND', message: 'Stock batch not found' })
		const item = await requireItem(ctx, batch.item_id)

		const now = Date.now()
		const expiry_date = optionalText(args.expiry_date)
		await ctx.db.patch(batch._id, { quantity: args.quantity, expiry_date, updated_at: now })

		const delta = args.quantity - batch.quantity
		if (delta !== 0) {
			await insertMovement(ctx, {
				item_id: item._id,
				item_name: item.item_name,
				quantity: Math.abs(delta),
				movement_type: delta > 0 ? 'stock_in' : 'stock_out',
				remark: args.remark ?? 'Batch adjustment',
				batch_id: batch._id,
				expiry_date,
				updated_at: now,
			})
		}
		return await recomputeItemQuantity(ctx, item._id)
	},
})

export const listBatches = query({
	args: { auth: v.string() },
	returns: v.array(stockBatchDoc),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager', 'requester'])
		// Bounded by stock on hand (a few batches per product), so collect is fine.
		const batches = await ctx.db.query('stock_batches').order('asc').collect()
		return batches.filter((b) => b.quantity > 0)
	},
})

const importRow = v.object({
	item_name: v.string(),
	quantity: v.number(),
	reorder_level: v.number(),
	unit: v.string(),
	remark: v.optional(v.string()),
	order_date: v.optional(v.union(v.string(), v.null())),
})

/**
 * Replaces the inventory with the spreadsheet rows: upserts by
 * case-insensitive name and deletes every item not in the sheet.
 * One transaction bounded by the ~8k write limit, fine at clinic scale.
 */
export const importInventory = mutation({
	args: { auth: v.string(), rows: v.array(importRow) },
	returns: v.object({
		imported: v.number(),
		updated: v.number(),
		deleted: v.number(),
		total: v.number(),
	}),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])

		// Bounded by product count.
		const existing = await ctx.db.query('inventory').withIndex('by_item_name').collect()
		const byName = new Map<string, Doc<'inventory'>>()
		for (const item of existing) byName.set(item.item_name.trim().toLowerCase(), item)

		const seen = new Set<string>()
		let imported = 0
		let updated = 0

		for (const row of args.rows) {
			const item_name = row.item_name.trim()
			if (item_name.length === 0) continue
			const key = item_name.toLowerCase()
			seen.add(key)
			assertNonNegativeQuantity(row.quantity)
			const reorder_level = Number.isFinite(row.reorder_level) ? Math.max(0, row.reorder_level) : 0
			const remark = row.remark ?? ''
			const order_date = optionalText(row.order_date)

			const current = byName.get(key)
			if (!current) {
				const id = await createItem(ctx, {
					item_name,
					quantity: row.quantity,
					reorder_level,
					unit: row.unit,
					remark,
					order_date,
					initial_remark: 'Excel import',
				})
				const created = await requireItem(ctx, id)
				byName.set(key, created)
				imported++
				continue
			}

			let changed = false
			const patch: Partial<Doc<'inventory'>> = {}
			if (current.reorder_level !== reorder_level) patch.reorder_level = reorder_level
			if (current.unit !== row.unit) patch.unit = row.unit
			if (current.remark !== remark) patch.remark = remark
			if (current.order_date !== order_date) patch.order_date = order_date
			if (Object.keys(patch).length > 0) {
				await ctx.db.patch(current._id, { ...patch, updated_at: Date.now() })
				changed = true
			}

			const delta = row.quantity - current.quantity
			if (delta > 0) {
				await applyStockIn(ctx, {
					item_id: current._id,
					quantity: delta,
					clear_order_date: false,
					remark: 'Excel import',
				})
				changed = true
			} else if (delta < 0) {
				await applyStockOut(ctx, { item_id: current._id, quantity: -delta, remark: 'Excel import' })
				changed = true
			}
			if (changed) updated++
		}

		let deleted = 0
		for (const [key, item] of byName) {
			if (seen.has(key)) continue
			await deleteItem(ctx, item)
			byName.delete(key)
			deleted++
		}

		return { imported, updated, deleted, total: byName.size }
	},
})

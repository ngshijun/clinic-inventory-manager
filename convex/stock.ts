import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requireRole } from './lib/auth'
import { capitalName } from './lib/names'
import {
	applyStockIn,
	applyStockOut,
	assertNonNegativeQuantity,
	batchWithExpiry,
	insertMovement,
	recomputeItemQuantity,
	requireItem,
} from './lib/stock'
import { createItem, deleteItem, requirePrice, type OrderStatus } from './inventory'
import { LEAD_DAYS, addDays, suggestedOrderQuantity, toIsoDate } from './lib/orders'
import { arrivedMessage, notify, stockDropMessage } from './lib/telegram'
import { normalizeUnitName, parseUnitLabel, sameUnit } from './lib/units'
import { inventoryDoc, stockBatchDoc } from './schema'
import { supplierResolver } from './suppliers'
import { requireUnitParts } from './units'

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
		not_track: v.optional(v.boolean()),
		expiry_date: v.optional(v.union(v.string(), v.null())),
		remark: v.optional(v.string()),
	},
	returns: inventoryDoc,
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const before = await requireItem(ctx, args.item_id)
		const item = await applyStockIn(ctx, {
			item_id: args.item_id,
			quantity: args.quantity,
			not_track: args.not_track,
			expiry_date: optionalText(args.expiry_date),
			remark: args.remark ?? 'Stock in',
		})
		await notify(ctx, arrivedMessage(before, args.quantity))
		return item
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
		const before = await requireItem(ctx, args.item_id)
		const item = await applyStockOut(ctx, {
			item_id: args.item_id,
			quantity: args.quantity,
			remark: args.remark ?? 'Stock out',
		})
		await notify(ctx, stockDropMessage(before, item))
		return item
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
		// A date changed to another batch's makes the two one batch
		const twin =
			args.quantity > 0 ? await batchWithExpiry(ctx, item._id, expiry_date, batch._id) : undefined
		if (twin) {
			await ctx.db.patch(twin._id, { quantity: twin.quantity + args.quantity, updated_at: now })
			await ctx.db.delete(batch._id)
		} else {
			await ctx.db.patch(batch._id, { quantity: args.quantity, expiry_date, updated_at: now })
		}

		const delta = args.quantity - batch.quantity
		if (delta !== 0) {
			await insertMovement(ctx, {
				item_id: item._id,
				item_name: item.item_name,
				quantity: Math.abs(delta),
				movement_type: delta > 0 ? 'stock_in' : 'stock_out',
				remark: args.remark ?? 'Batch adjustment',
				batch_id: (twin ?? batch)._id,
				expiry_date,
				updated_at: now,
			})
		}
		const adjusted = await recomputeItemQuantity(ctx, item._id)
		await notify(ctx, stockDropMessage(item, adjusted))
		return adjusted
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
	/** Omitted when the sheet has no supplier column: suppliers are then left as they are */
	supplier: v.optional(v.string()),
	quantity: v.number(),
	reorder_level: v.number(),
	unit: v.string(),
	/** Omitted when the sheet has no price column: prices are then left as they are. null clears. */
	price: v.optional(v.union(v.number(), v.null())),
	/** Empty means the item's own unit */
	price_unit: v.optional(v.string()),
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
		for (const item of existing) byName.set(capitalName(item.item_name), item)

		const resolveSupplier = await supplierResolver(ctx, 'add')
		const seen = new Set<string>()
		let imported = 0
		let updated = 0

		for (const row of args.rows) {
			const item_name = capitalName(row.item_name)
			if (item_name.length === 0) continue
			seen.add(item_name)
			assertNonNegativeQuantity(row.quantity)
			const reorder_level = Number.isFinite(row.reorder_level) ? Math.max(0, row.reorder_level) : 0
			const remark = row.remark ?? ''
			const supplier = await resolveSupplier(row.supplier)
			const unit = parseUnitLabel(row.unit)
			if (!unit) {
				throw new ConvexError({
					code: 'INVALID_STATE',
					message: `${item_name}: the unit "${row.unit}" cannot be read. Write it like BOX (30 TAB).`,
				})
			}
			const price =
				row.price === undefined || row.price === null
					? undefined
					: requirePrice(unit, {
							amount: row.price,
							unit: normalizeUnitName(row.price_unit ?? '') || unit.unit,
						})
			// The sheet's order_date column: a date marks the item ordered on that day
			const order_date = toIsoDate(row.order_date)
			const order_status: OrderStatus | undefined = order_date
				? {
						kind: 'ordered',
						ordered_on: order_date,
						expected_by: addDays(order_date, LEAD_DAYS),
						quantity: suggestedOrderQuantity(row.quantity, reorder_level),
						received: 0,
					}
				: undefined

			const current = byName.get(item_name)
			if (!current) {
				const id = await createItem(ctx, {
					item_name,
					supplier,
					quantity: row.quantity,
					reorder_level,
					unit,
					price,
					remark,
					order_status,
					initial_remark: 'Excel import',
				})
				const created = await requireItem(ctx, id)
				byName.set(item_name, created)
				imported++
				continue
			}

			let changed = false
			const delta = row.quantity - current.quantity
			if (delta > 0) {
				await applyStockIn(ctx, { item_id: current._id, quantity: delta, remark: 'Excel import' })
				changed = true
			} else if (delta < 0) {
				await applyStockOut(ctx, { item_id: current._id, quantity: -delta, remark: 'Excel import' })
				changed = true
			}

			// After the stock change, so the sheet's order date is what stays
			const patch: Partial<Doc<'inventory'>> = {}
			if (current.item_name !== item_name) patch.item_name = item_name
			if (current.reorder_level !== reorder_level) patch.reorder_level = reorder_level
			if (!sameUnit(current, unit)) {
				const checked = await requireUnitParts(ctx, unit)
				patch.unit = checked.unit
				patch.pack_size = checked.pack_size
				patch.pack_unit = checked.pack_unit
			}
			if (current.remark !== remark) patch.remark = remark
			// An empty cell clears the supplier
			if (row.supplier !== undefined && current.supplier !== supplier) patch.supplier = supplier
			// An empty cell clears the price
			if (
				row.price !== undefined &&
				(current.price?.amount !== price?.amount || current.price?.unit !== price?.unit)
			) {
				patch.price = price
			}
			const currentOrderDate =
				current.order_status?.kind === 'ordered' ? current.order_status.ordered_on : null
			if (currentOrderDate !== order_date) patch.order_status = order_status
			if (Object.keys(patch).length > 0) {
				await ctx.db.patch(current._id, { ...patch, updated_at: Date.now() })
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

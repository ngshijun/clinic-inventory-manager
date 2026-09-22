import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireRole } from './lib/auth'
import { applyStockIn, assertNonNegativeQuantity } from './lib/stock'
import { inventoryDoc } from './schema'

/** Empty/null/undefined -> undefined so optional fields are cleared, not stored as "". */
function optionalText(value: string | null | undefined): string | undefined {
	if (value === undefined || value === null) return undefined
	const trimmed = value.trim()
	return trimmed.length === 0 ? undefined : trimmed
}

export async function createItem(
	ctx: MutationCtx,
	args: {
		item_name: string
		quantity: number
		reorder_level: number
		unit: string
		remark?: string
		order_date?: string | null
		non_order_reason?: string | null
		not_track?: boolean
		expiry_date?: string
		initial_remark: string
	},
): Promise<Id<'inventory'>> {
	assertNonNegativeQuantity(args.quantity)
	if (!Number.isFinite(args.reorder_level)) {
		throw new ConvexError({ code: 'INVALID_QUANTITY', message: 'Reorder level must be a number' })
	}
	const now = Date.now()
	const id = await ctx.db.insert('inventory', {
		item_name: args.item_name.trim(),
		quantity: 0,
		reorder_level: Math.max(0, args.reorder_level),
		unit: args.unit,
		remark: args.remark ?? '',
		order_date: optionalText(args.order_date),
		non_order_reason: optionalText(args.non_order_reason),
		back_order: false,
		not_track: args.not_track ?? false,
		is_pinned: false,
		updated_at: now,
	})
	if (args.quantity > 0) {
		await applyStockIn(ctx, {
			item_id: id,
			quantity: args.quantity,
			clear_order_date: false,
			expiry_date: optionalText(args.expiry_date),
			remark: args.initial_remark,
		})
	}
	return id
}

/** Deletes an item's batches and requests, then the item. Movements are kept as history. */
export async function deleteItem(ctx: MutationCtx, item: Doc<'inventory'>): Promise<void> {
	// Bounded: a handful of batches / requests per item.
	const batches = await ctx.db
		.query('stock_batches')
		.withIndex('by_item', (q) => q.eq('item_id', item._id))
		.collect()
	for (const batch of batches) await ctx.db.delete(batch._id)
	const requests = await ctx.db
		.query('stock_requests')
		.withIndex('by_item', (q) => q.eq('item_id', item._id))
		.collect()
	for (const request of requests) await ctx.db.delete(request._id)
	await ctx.db.delete(item._id)
}

export const list = query({
	args: { auth: v.string() },
	returns: v.array(inventoryDoc),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager', 'requester'])
		// Bounded by the clinic's product count (hundreds), so collect is fine.
		return await ctx.db.query('inventory').withIndex('by_item_name').order('asc').collect()
	},
})

export const add = mutation({
	args: {
		auth: v.string(),
		item_name: v.string(),
		quantity: v.number(),
		reorder_level: v.number(),
		unit: v.string(),
		remark: v.optional(v.string()),
		order_date: v.optional(v.union(v.string(), v.null())),
		non_order_reason: v.optional(v.union(v.string(), v.null())),
		not_track: v.optional(v.boolean()),
		expiry_date: v.optional(v.union(v.string(), v.null())),
	},
	returns: v.id('inventory'),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		return await createItem(ctx, {
			item_name: args.item_name,
			quantity: args.quantity,
			reorder_level: args.reorder_level,
			unit: args.unit,
			remark: args.remark,
			order_date: args.order_date,
			non_order_reason: args.non_order_reason,
			not_track: args.not_track,
			expiry_date: args.expiry_date ?? undefined,
			initial_remark: 'Initial stock',
		})
	},
})

export const update = mutation({
	args: {
		auth: v.string(),
		id: v.id('inventory'),
		item_name: v.optional(v.string()),
		unit: v.optional(v.string()),
		reorder_level: v.optional(v.number()),
		remark: v.optional(v.string()),
		not_track: v.optional(v.boolean()),
		// null clears the field.
		order_date: v.optional(v.union(v.string(), v.null())),
		non_order_reason: v.optional(v.union(v.string(), v.null())),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const item = await ctx.db.get(args.id)
		if (!item) throw new ConvexError({ code: 'NOT_FOUND', message: 'Inventory item not found' })

		const now = Date.now()
		const patch: Partial<Doc<'inventory'>> = { updated_at: now }
		if (args.item_name !== undefined) {
			const name = args.item_name.trim()
			if (name.length === 0) {
				throw new ConvexError({ code: 'INVALID_STATE', message: 'Item name cannot be empty' })
			}
			patch.item_name = name
		}
		if (args.unit !== undefined) patch.unit = args.unit
		if (args.reorder_level !== undefined) {
			if (!Number.isFinite(args.reorder_level)) {
				throw new ConvexError({
					code: 'INVALID_QUANTITY',
					message: 'Reorder level must be a number',
				})
			}
			patch.reorder_level = Math.max(0, args.reorder_level)
		}
		if (args.remark !== undefined) patch.remark = args.remark
		if (args.not_track !== undefined) patch.not_track = args.not_track
		if (args.order_date !== undefined) patch.order_date = optionalText(args.order_date)
		if (args.non_order_reason !== undefined) {
			patch.non_order_reason = optionalText(args.non_order_reason)
		}
		await ctx.db.patch(item._id, patch)

		if (patch.item_name !== undefined && patch.item_name !== item.item_name) {
			// Bounded: a handful of requests per item. Movements keep their snapshot.
			const requests = await ctx.db
				.query('stock_requests')
				.withIndex('by_item', (q) => q.eq('item_id', item._id))
				.collect()
			for (const request of requests) {
				await ctx.db.patch(request._id, { item_name: patch.item_name, updated_at: now })
			}
		}
		return null
	},
})

export const remove = mutation({
	args: { auth: v.string(), id: v.id('inventory') },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const item = await ctx.db.get(args.id)
		if (!item) throw new ConvexError({ code: 'NOT_FOUND', message: 'Inventory item not found' })
		await deleteItem(ctx, item)
		return null
	},
})

export const markOrdered = mutation({
	args: {
		auth: v.string(),
		id: v.id('inventory'),
		order_date: v.optional(v.string()),
		back_order: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const item = await ctx.db.get(args.id)
		if (!item) throw new ConvexError({ code: 'NOT_FOUND', message: 'Inventory item not found' })
		await ctx.db.patch(item._id, {
			order_date: optionalText(args.order_date) ?? new Date().toISOString(),
			non_order_reason: undefined,
			back_order: args.back_order ?? false,
			updated_at: Date.now(),
		})
		return null
	},
})

export const clearOrderDate = mutation({
	args: { auth: v.string(), id: v.id('inventory') },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const item = await ctx.db.get(args.id)
		if (!item) throw new ConvexError({ code: 'NOT_FOUND', message: 'Inventory item not found' })
		await ctx.db.patch(item._id, { order_date: undefined, updated_at: Date.now() })
		return null
	},
})

export const setNonOrderReason = mutation({
	args: {
		auth: v.string(),
		id: v.id('inventory'),
		reason: v.union(v.string(), v.null()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const item = await ctx.db.get(args.id)
		if (!item) throw new ConvexError({ code: 'NOT_FOUND', message: 'Inventory item not found' })
		const reason = optionalText(args.reason)
		const patch: Partial<Doc<'inventory'>> = {
			non_order_reason: reason,
			order_date: undefined,
			updated_at: Date.now(),
		}
		if (reason === 'Alternative ordered') patch.not_track = true
		await ctx.db.patch(item._id, patch)
		return null
	},
})

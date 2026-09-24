import { ConvexError, v, type Infer } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireRole } from './lib/auth'
import { toIsoDate } from './lib/orders'
import { applyStockIn, assertNonNegativeQuantity, requireItem } from './lib/stock'
import { inventoryDoc, orderStatus } from './schema'

export type OrderStatus = Infer<typeof orderStatus>

/** Empty/null/undefined -> undefined so optional fields are cleared, not stored as "". */
function optionalText(value: string | null | undefined): string | undefined {
	if (value === undefined || value === null) return undefined
	const trimmed = value.trim()
	return trimmed.length === 0 ? undefined : trimmed
}

function requireIsoDate(value: string, label: string): string {
	const date = toIsoDate(value)
	if (!date) throw new ConvexError({ code: 'INVALID_DATE', message: `${label} must be a date` })
	return date
}

export async function createItem(
	ctx: MutationCtx,
	args: {
		item_name: string
		quantity: number
		reorder_level: number
		unit: string
		remark?: string
		order_status?: OrderStatus
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
		not_track: args.not_track ?? false,
		is_pinned: false,
		updated_at: now,
	})
	if (args.quantity > 0) {
		await applyStockIn(ctx, {
			item_id: id,
			quantity: args.quantity,
			expiry_date: optionalText(args.expiry_date),
			remark: args.initial_remark,
		})
	}
	// After the opening stock, which is not a delivery against the order
	if (args.order_status) await ctx.db.patch(id, { order_status: args.order_status })
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
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const item = await requireItem(ctx, args.id)

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
		if (args.not_track !== undefined) {
			patch.not_track = args.not_track
			// An untracked item is nobody's to order, so it holds no order status
			if (args.not_track) patch.order_status = undefined
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
		await deleteItem(ctx, await requireItem(ctx, args.id))
		return null
	},
})

/**
 * Marks an item ordered, or changes an order. Stock already received against
 * the order carries over; lowering the quantity to what has come in closes it.
 */
export const markOrdered = mutation({
	args: {
		auth: v.string(),
		id: v.id('inventory'),
		quantity: v.number(),
		ordered_on: v.string(),
		/** Omitted for a back-order: the supplier has not given a date. */
		expected_by: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const item = await requireItem(ctx, args.id)
		if (!Number.isInteger(args.quantity) || args.quantity <= 0) {
			throw new ConvexError({
				code: 'INVALID_QUANTITY',
				message: 'Quantity must be a whole number',
			})
		}
		const received = item.order_status?.kind === 'ordered' ? item.order_status.received : 0
		await ctx.db.patch(item._id, {
			order_status:
				received >= args.quantity
					? undefined
					: {
							kind: 'ordered',
							ordered_on: requireIsoDate(args.ordered_on, 'Order date'),
							expected_by:
								args.expected_by === undefined
									? undefined
									: requireIsoDate(args.expected_by, 'Expected date'),
							quantity: args.quantity,
							received,
						},
			updated_at: Date.now(),
		})
		return null
	},
})

export const snooze = mutation({
	args: {
		auth: v.string(),
		id: v.id('inventory'),
		until: v.string(),
		reason: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const item = await requireItem(ctx, args.id)
		const reason = optionalText(args.reason)
		if (!reason) throw new ConvexError({ code: 'INVALID_STATE', message: 'A reason is needed' })
		await ctx.db.patch(item._id, {
			order_status: { kind: 'snoozed', until: requireIsoDate(args.until, 'Snooze date'), reason },
			updated_at: Date.now(),
		})
		return null
	},
})

/** Puts a status back after an undo. */
export const restoreOrderStatus = mutation({
	args: { auth: v.string(), id: v.id('inventory'), status: v.optional(orderStatus) },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const item = await requireItem(ctx, args.id)
		await ctx.db.patch(item._id, { order_status: args.status, updated_at: Date.now() })
		return null
	},
})

/** Back to undecided: an ordered item was not ordered after all, or a snooze ends early. */
export const clearOrderStatus = mutation({
	args: { auth: v.string(), id: v.id('inventory') },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const item = await requireItem(ctx, args.id)
		await ctx.db.patch(item._id, { order_status: undefined, updated_at: Date.now() })
		return null
	},
})

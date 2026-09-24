import { ConvexError } from 'convex/values'
import type { WithoutSystemFields } from 'convex/server'
import type { MutationCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { movementsByType } from './aggregates'

/** Throws INVALID_QUANTITY unless `quantity` is a finite number > 0. */
export function assertPositiveQuantity(quantity: number): void {
	if (!Number.isFinite(quantity) || quantity <= 0) {
		throw new ConvexError({
			code: 'INVALID_QUANTITY',
			message: 'Quantity must be a positive number',
		})
	}
}

/** Throws INVALID_QUANTITY unless `quantity` is a finite number >= 0. */
export function assertNonNegativeQuantity(quantity: number): void {
	if (!Number.isFinite(quantity) || quantity < 0) {
		throw new ConvexError({
			code: 'INVALID_QUANTITY',
			message: 'Quantity must be zero or a positive number',
		})
	}
}

export async function requireItem(
	ctx: MutationCtx,
	item_id: Id<'inventory'>,
): Promise<Doc<'inventory'>> {
	const item = await ctx.db.get(item_id)
	if (!item) {
		throw new ConvexError({ code: 'NOT_FOUND', message: 'Inventory item not found' })
	}
	return item
}

/**
 * The only way a stock_movements row gets inserted. Keeps the
 * movementsByType aggregate in sync with the table.
 */
export async function insertMovement(
	ctx: MutationCtx,
	fields: WithoutSystemFields<Doc<'stock_movements'>>,
): Promise<Doc<'stock_movements'>> {
	const id = await ctx.db.insert('stock_movements', fields)
	const doc = await ctx.db.get(id)
	if (!doc) {
		throw new ConvexError({ code: 'NOT_FOUND', message: 'Movement vanished after insert' })
	}
	await movementsByType.insert(ctx, doc)
	return doc
}

/** Sets item.quantity = sum of its batches and returns the updated item. */
export async function recomputeItemQuantity(
	ctx: MutationCtx,
	item_id: Id<'inventory'>,
): Promise<Doc<'inventory'>> {
	// Bounded: one item has a handful of batches.
	const batches = await ctx.db
		.query('stock_batches')
		.withIndex('by_item', (q) => q.eq('item_id', item_id))
		.collect()
	const quantity = batches.reduce((sum, b) => sum + Math.max(0, b.quantity), 0)
	await ctx.db.patch(item_id, { quantity, updated_at: Date.now() })
	return await requireItem(ctx, item_id)
}

export async function applyStockIn(
	ctx: MutationCtx,
	args: {
		item_id: Id<'inventory'>
		quantity: number
		/** A delivery closes the order; a snoozed item is back in play once it has stock. */
		clear_order_status: boolean
		not_track?: boolean
		expiry_date?: string
		remark: string
	},
): Promise<Doc<'inventory'>> {
	assertPositiveQuantity(args.quantity)
	const item = await requireItem(ctx, args.item_id)
	const now = Date.now()

	const batch_id = await ctx.db.insert('stock_batches', {
		item_id: item._id,
		quantity: args.quantity,
		expiry_date: args.expiry_date,
		updated_at: now,
	})

	const patch: Partial<WithoutSystemFields<Doc<'inventory'>>> = { updated_at: now }
	if (args.clear_order_status) patch.order_status = undefined
	if (args.not_track !== undefined) patch.not_track = args.not_track
	await ctx.db.patch(item._id, patch)

	await insertMovement(ctx, {
		item_id: item._id,
		item_name: item.item_name,
		quantity: args.quantity,
		movement_type: 'stock_in',
		remark: args.remark,
		batch_id,
		expiry_date: args.expiry_date,
		updated_at: now,
	})

	return await recomputeItemQuantity(ctx, item._id)
}

/**
 * Orders batches for stock out: first expired, first out. Batches with an
 * expiry date come first, earliest expiry first; batches without one follow,
 * oldest received first. Ties break on received time.
 */
export function fefoOrder<T extends { expiry_date?: string; _creationTime: number }>(
	batches: T[],
): T[] {
	return [...batches].sort((a, b) => {
		if (a.expiry_date && b.expiry_date && a.expiry_date !== b.expiry_date) {
			return a.expiry_date < b.expiry_date ? -1 : 1
		}
		if (a.expiry_date && !b.expiry_date) return -1
		if (!a.expiry_date && b.expiry_date) return 1
		return a._creationTime - b._creationTime
	})
}

/**
 * FEFO stock out: drains the earliest-expiring batches first, one stock_out
 * movement per batch touched. Asking for more than is on hand simply empties
 * the item.
 */
export async function applyStockOut(
	ctx: MutationCtx,
	args: { item_id: Id<'inventory'>; quantity: number; remark: string },
): Promise<Doc<'inventory'>> {
	assertPositiveQuantity(args.quantity)
	const item = await requireItem(ctx, args.item_id)
	const now = Date.now()

	// Bounded: one item has a handful of batches.
	const batches = fefoOrder(
		await ctx.db
			.query('stock_batches')
			.withIndex('by_item', (q) => q.eq('item_id', item._id))
			.collect(),
	)

	let remaining = args.quantity
	for (const batch of batches) {
		if (remaining <= 0) break
		if (batch.quantity <= 0) continue
		const taken = Math.min(batch.quantity, remaining)
		await ctx.db.patch(batch._id, { quantity: batch.quantity - taken, updated_at: now })
		await insertMovement(ctx, {
			item_id: item._id,
			item_name: item.item_name,
			quantity: taken,
			movement_type: 'stock_out',
			remark: args.remark,
			batch_id: batch._id,
			expiry_date: batch.expiry_date,
			updated_at: now,
		})
		remaining -= taken
	}

	return await recomputeItemQuantity(ctx, item._id)
}

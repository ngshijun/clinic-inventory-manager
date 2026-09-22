import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireRole } from './lib/auth'
import { applyStockOut, assertPositiveQuantity } from './lib/stock'
import { stockRequestDoc } from './schema'

const requestRow = v.object({ ...stockRequestDoc.fields, unit: v.string() })

async function requireRequest(
	ctx: { db: { get: (id: Id<'stock_requests'>) => Promise<Doc<'stock_requests'> | null> } },
	id: Id<'stock_requests'>,
): Promise<Doc<'stock_requests'>> {
	const request = await ctx.db.get(id)
	if (!request) throw new ConvexError({ code: 'NOT_FOUND', message: 'Stock request not found' })
	return request
}

function requirePendingUnlessManager(request: Doc<'stock_requests'>, role: string): void {
	if (role !== 'manager' && request.status !== 'Pending') {
		throw new ConvexError({
			code: 'INVALID_STATE',
			message: 'Only pending requests can be changed',
		})
	}
}

export const list = query({
	args: { auth: v.string() },
	returns: v.array(requestRow),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager', 'requester'])
		// Bounded: requests are cleared as they are approved/rejected, so this stays small.
		const requests = await ctx.db.query('stock_requests').order('desc').collect()
		const units = new Map<Id<'inventory'>, string>()
		const rows = []
		for (const request of requests) {
			let unit = units.get(request.item_id)
			if (unit === undefined) {
				const item = await ctx.db.get(request.item_id)
				unit = item?.unit ?? ''
				units.set(request.item_id, unit)
			}
			rows.push({ ...request, unit })
		}
		return rows
	},
})

export const add = mutation({
	args: {
		auth: v.string(),
		item_id: v.id('inventory'),
		quantity: v.number(),
		remark: v.optional(v.string()),
	},
	returns: v.id('stock_requests'),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager', 'requester'])
		assertPositiveQuantity(args.quantity)
		const item = await ctx.db.get(args.item_id)
		if (!item) throw new ConvexError({ code: 'NOT_FOUND', message: 'Inventory item not found' })
		return await ctx.db.insert('stock_requests', {
			item_id: item._id,
			item_name: item.item_name,
			quantity: args.quantity,
			remark: args.remark,
			status: 'Pending',
			updated_at: Date.now(),
		})
	},
})

export const remove = mutation({
	args: { auth: v.string(), id: v.id('stock_requests') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const role = requireRole(args.auth, ['manager', 'requester'])
		const request = await requireRequest(ctx, args.id)
		requirePendingUnlessManager(request, role)
		await ctx.db.delete(request._id)
		return null
	},
})

export const update = mutation({
	args: {
		auth: v.string(),
		id: v.id('stock_requests'),
		quantity: v.optional(v.number()),
		remark: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const role = requireRole(args.auth, ['manager', 'requester'])
		const request = await requireRequest(ctx, args.id)
		requirePendingUnlessManager(request, role)
		const patch: Partial<Doc<'stock_requests'>> = { updated_at: Date.now() }
		if (args.quantity !== undefined) {
			assertPositiveQuantity(args.quantity)
			patch.quantity = args.quantity
		}
		if (args.remark !== undefined) patch.remark = args.remark
		await ctx.db.patch(request._id, patch)
		return null
	},
})

export const approve = mutation({
	args: { auth: v.string(), id: v.id('stock_requests') },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const request = await requireRequest(ctx, args.id)
		if (request.status !== 'Pending') {
			throw new ConvexError({ code: 'INVALID_STATE', message: 'Request is not pending' })
		}
		await ctx.db.patch(request._id, { status: 'Approved', updated_at: Date.now() })
		await applyStockOut(ctx, {
			item_id: request.item_id,
			quantity: request.quantity,
			remark: 'Stock Request',
		})
		return null
	},
})

export const reject = mutation({
	args: { auth: v.string(), id: v.id('stock_requests'), remark: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const request = await requireRequest(ctx, args.id)
		if (request.status !== 'Pending') {
			throw new ConvexError({ code: 'INVALID_STATE', message: 'Request is not pending' })
		}
		const patch: Partial<Doc<'stock_requests'>> = { status: 'Rejected', updated_at: Date.now() }
		if (args.remark !== undefined) patch.remark = args.remark
		await ctx.db.patch(request._id, patch)
		return null
	},
})

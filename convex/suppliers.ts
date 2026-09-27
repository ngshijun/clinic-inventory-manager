import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requireRole } from './lib/auth'
import { supplierDoc } from './schema'

/** Bounded: a few dozen suppliers. */
const allSuppliers = (ctx: MutationCtx): Promise<Doc<'suppliers'>[]> =>
	ctx.db.query('suppliers').withIndex('by_name').collect()

const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

function requireName(value: string): string {
	const name = value.trim()
	if (name.length === 0) {
		throw new ConvexError({ code: 'INVALID_STATE', message: 'Supplier name cannot be empty' })
	}
	return name
}

/**
 * Turns the supplier chosen on an item, or written in a sheet, into a name
 * from the Suppliers list. A name that matches one on the list in any letter
 * case becomes that spelling. A new name is refused from a form, where a
 * supplier is picked, and joins the list from a sheet, so the first fill
 * from Excel needs no setting up. An empty name means no supplier. The list
 * is read once, so one import resolves every row from the same copy.
 */
export async function supplierResolver(
	ctx: MutationCtx,
	newName: 'refuse' | 'add',
): Promise<(value: string | null | undefined) => Promise<string | undefined>> {
	const known = new Map<string, string>()
	for (const supplier of await allSuppliers(ctx)) {
		known.set(supplier.name.toLowerCase(), supplier.name)
	}
	return async (value) => {
		const name = value?.trim() ?? ''
		if (name.length === 0) return undefined
		const key = name.toLowerCase()
		const spelling = known.get(key)
		if (spelling) return spelling
		if (newName === 'refuse') {
			throw new ConvexError({
				code: 'NOT_FOUND',
				message: `${name} is not on the Suppliers list`,
			})
		}
		await ctx.db.insert('suppliers', { name, updated_at: Date.now() })
		known.set(key, name)
		return name
	}
}

export const list = query({
	args: { auth: v.string() },
	returns: v.array(supplierDoc),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		// Bounded: a few dozen suppliers.
		return await ctx.db.query('suppliers').withIndex('by_name').order('asc').collect()
	},
})

export const add = mutation({
	args: { auth: v.string(), name: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const name = requireName(args.name)
		const existing = (await allSuppliers(ctx)).find((supplier) => sameName(supplier.name, name))
		if (existing) {
			throw new ConvexError({
				code: 'INVALID_STATE',
				message: `${existing.name} is already in the list`,
			})
		}
		await ctx.db.insert('suppliers', { name, updated_at: Date.now() })
		return null
	},
})

/**
 * Renames a supplier on the list and on every item that uses it. A name
 * that matches another supplier, in any letter case, combines the two: the
 * items move to that supplier and this one leaves the list.
 */
export const rename = mutation({
	args: { auth: v.string(), id: v.id('suppliers'), name: v.string() },
	returns: v.object({ name: v.string(), combined: v.boolean(), items: v.number() }),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const supplier = await ctx.db.get(args.id)
		if (!supplier) throw new ConvexError({ code: 'NOT_FOUND', message: 'Supplier not found' })
		const typed = requireName(args.name)
		if (typed === supplier.name) return { name: typed, combined: false, items: 0 }

		const target = (await allSuppliers(ctx)).find(
			(other) => other._id !== supplier._id && sameName(other.name, typed),
		)
		const name = target?.name ?? typed
		if (target) await ctx.db.delete(supplier._id)
		else await ctx.db.patch(supplier._id, { name, updated_at: Date.now() })

		// Bounded by the clinic's product count (hundreds).
		const inventory = await ctx.db.query('inventory').collect()
		let items = 0
		for (const item of inventory) {
			if (item.supplier !== supplier.name) continue
			// `updated_at` is left alone: Not Moving reads it as the last stock movement
			await ctx.db.patch(item._id, { supplier: name })
			items++
		}
		return { name, combined: target !== undefined, items }
	},
})

export const remove = mutation({
	args: { auth: v.string(), id: v.id('suppliers') },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const supplier = await ctx.db.get(args.id)
		if (!supplier) throw new ConvexError({ code: 'NOT_FOUND', message: 'Supplier not found' })
		// Bounded by the clinic's product count (hundreds).
		const inventory = await ctx.db.query('inventory').collect()
		const used = inventory.filter((item) => item.supplier === supplier.name).length
		if (used > 0) {
			throw new ConvexError({
				code: 'INVALID_STATE',
				message: `${supplier.name} is used by ${used} ${used === 1 ? 'item' : 'items'}`,
			})
		}
		await ctx.db.delete(supplier._id)
		return null
	},
})

import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requireRole } from './lib/auth'
import { UNIT_NAME_PATTERN, normalizeUnitName, type UnitParts } from './lib/units'
import { unitDoc } from './schema'

const findByName = (ctx: MutationCtx, name: string): Promise<Doc<'units'> | null> =>
	ctx.db
		.query('units')
		.withIndex('by_name', (q) => q.eq('name', name))
		.unique()

function requireName(value: string): string {
	const name = normalizeUnitName(value)
	if (!UNIT_NAME_PATTERN.test(name)) {
		throw new ConvexError({
			code: 'INVALID_STATE',
			message: 'A unit is one word of up to 12 letters, such as BOX',
		})
	}
	return name
}

/** Throws unless both names are in the list and the pack is whole or absent. */
export async function requireUnitParts(ctx: MutationCtx, parts: UnitParts): Promise<UnitParts> {
	const hasSize = parts.pack_size !== undefined
	const hasPackUnit = parts.pack_unit !== undefined && parts.pack_unit !== ''
	if (hasSize !== hasPackUnit) {
		throw new ConvexError({
			code: 'INVALID_STATE',
			message: 'Give both how many the unit contains and of what, or neither',
		})
	}
	if (hasSize && (!Number.isInteger(parts.pack_size) || (parts.pack_size ?? 0) <= 0)) {
		throw new ConvexError({
			code: 'INVALID_QUANTITY',
			message: 'How many the unit contains must be a whole number above zero',
		})
	}
	const names = hasPackUnit ? [parts.unit, parts.pack_unit as string] : [parts.unit]
	for (const name of names) {
		if (!(await findByName(ctx, name))) {
			throw new ConvexError({
				code: 'NOT_FOUND',
				message: `${name} is not in the Units list`,
			})
		}
	}
	return hasSize
		? { unit: parts.unit, pack_size: parts.pack_size, pack_unit: parts.pack_unit }
		: { unit: parts.unit }
}

export const list = query({
	args: { auth: v.string() },
	returns: v.array(unitDoc),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		// Bounded: a few dozen units.
		return await ctx.db.query('units').withIndex('by_name').order('asc').collect()
	},
})

export const add = mutation({
	args: { auth: v.string(), name: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const name = requireName(args.name)
		if (await findByName(ctx, name)) {
			throw new ConvexError({ code: 'INVALID_STATE', message: `${name} is already in the list` })
		}
		await ctx.db.insert('units', { name, updated_at: Date.now() })
		return null
	},
})

/**
 * Renames a unit on the list and on every item that uses it. A name that
 * is already on the list combines the two: the items move to that unit and
 * this one leaves the list.
 */
export const rename = mutation({
	args: { auth: v.string(), id: v.id('units'), name: v.string() },
	returns: v.object({ combined: v.boolean(), items: v.number() }),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const unit = await ctx.db.get(args.id)
		if (!unit) throw new ConvexError({ code: 'NOT_FOUND', message: 'Unit not found' })
		const name = requireName(args.name)
		if (name === unit.name) return { combined: false, items: 0 }

		const now = Date.now()
		const target = await findByName(ctx, name)
		if (target) await ctx.db.delete(unit._id)
		else await ctx.db.patch(unit._id, { name, updated_at: now })

		// Bounded by the clinic's product count (hundreds).
		const inventory = await ctx.db.query('inventory').collect()
		let items = 0
		for (const item of inventory) {
			const patch: Partial<Doc<'inventory'>> = {}
			if (item.unit === unit.name) patch.unit = name
			if (item.pack_unit === unit.name) patch.pack_unit = name
			if (Object.keys(patch).length === 0) continue
			await ctx.db.patch(item._id, patch)
			items++
		}
		return { combined: target !== null, items }
	},
})

export const remove = mutation({
	args: { auth: v.string(), id: v.id('units') },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const unit = await ctx.db.get(args.id)
		if (!unit) throw new ConvexError({ code: 'NOT_FOUND', message: 'Unit not found' })
		// Bounded by the clinic's product count (hundreds).
		const inventory = await ctx.db.query('inventory').collect()
		const used = inventory.filter(
			(item) => item.unit === unit.name || item.pack_unit === unit.name,
		).length
		if (used > 0) {
			throw new ConvexError({
				code: 'INVALID_STATE',
				message: `${unit.name} is used by ${used} ${used === 1 ? 'item' : 'items'}`,
			})
		}
		await ctx.db.delete(unit._id)
		return null
	},
})

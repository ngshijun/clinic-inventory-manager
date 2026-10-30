import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requireRole } from './lib/auth'
import { capitalName } from './lib/names'
import { clinicDoc } from './schema'

/** Bounded: a handful of nearby clinics. */
const allClinics = (ctx: MutationCtx): Promise<Doc<'clinics'>[]> =>
	ctx.db.query('clinics').withIndex('by_name').collect()

/** The entries that name a clinic. Bounded: a few a month. */
const loansOf = (ctx: MutationCtx, name: string): Promise<Doc<'loans'>[]> =>
	ctx.db
		.query('loans')
		.withIndex('by_clinic', (q) => q.eq('clinic', name))
		.collect()

function requireName(value: string): string {
	const name = capitalName(value)
	if (name.length === 0) {
		throw new ConvexError({ code: 'INVALID_STATE', message: 'Clinic name cannot be empty' })
	}
	return name
}

/** The clinic's name as the list keeps it. A clinic is picked, so a name not on the list is refused. */
export async function requireClinic(ctx: MutationCtx, value: string): Promise<string> {
	const name = capitalName(value)
	const clinic = await ctx.db
		.query('clinics')
		.withIndex('by_name', (q) => q.eq('name', name))
		.first()
	if (!clinic) {
		throw new ConvexError({
			code: 'NOT_FOUND',
			message: `${name || 'That clinic'} is not on the Clinics list`,
		})
	}
	return clinic.name
}

export const list = query({
	args: { auth: v.string() },
	returns: v.array(clinicDoc),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		// Bounded: a handful of nearby clinics.
		return await ctx.db.query('clinics').withIndex('by_name').order('asc').collect()
	},
})

export const add = mutation({
	args: { auth: v.string(), name: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const name = requireName(args.name)
		const existing = (await allClinics(ctx)).find((clinic) => clinic.name === name)
		if (existing) {
			throw new ConvexError({
				code: 'INVALID_STATE',
				message: `${existing.name} is already in the list`,
			})
		}
		await ctx.db.insert('clinics', { name, updated_at: Date.now() })
		return null
	},
})

/**
 * Renames a clinic on the list and on every entry that names it. A name
 * that matches another clinic combines the two: the entries move to that
 * clinic and this one leaves the list.
 */
export const rename = mutation({
	args: { auth: v.string(), id: v.id('clinics'), name: v.string() },
	returns: v.object({ name: v.string(), combined: v.boolean(), entries: v.number() }),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const clinic = await ctx.db.get(args.id)
		if (!clinic) throw new ConvexError({ code: 'NOT_FOUND', message: 'Clinic not found' })
		const typed = requireName(args.name)
		if (typed === clinic.name) return { name: typed, combined: false, entries: 0 }

		const target = (await allClinics(ctx)).find(
			(other) => other._id !== clinic._id && other.name === typed,
		)
		const name = target?.name ?? typed
		if (target) await ctx.db.delete(clinic._id)
		else await ctx.db.patch(clinic._id, { name, updated_at: Date.now() })

		const loans = await loansOf(ctx, clinic.name)
		for (const loan of loans) await ctx.db.patch(loan._id, { clinic: name })
		return { name, combined: target !== undefined, entries: loans.length }
	},
})

export const remove = mutation({
	args: { auth: v.string(), id: v.id('clinics') },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const clinic = await ctx.db.get(args.id)
		if (!clinic) throw new ConvexError({ code: 'NOT_FOUND', message: 'Clinic not found' })
		const used = (await loansOf(ctx, clinic.name)).length
		if (used > 0) {
			throw new ConvexError({
				code: 'INVALID_STATE',
				message: `${clinic.name} is named on ${used} ${used === 1 ? 'entry' : 'entries'}`,
			})
		}
		await ctx.db.delete(clinic._id)
		return null
	},
})

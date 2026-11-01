import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireRole } from './lib/auth'
import { capitalName } from './lib/names'
import { owedOf, returnedOf } from './lib/loans'
import { toIsoDate } from './lib/orders'
import { requireItem } from './lib/stock'
import { unitLabel } from './lib/units'
import { loanDirection, loanDoc } from './schema'

/*
 * Medicine borrowed from or lent to other clinics. A record only: nothing
 * here touches stock, batches or Stock Movements.
 */

/** A count of the item's unit: a whole number above zero */
function requireCount(quantity: number): number {
	if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1_000_000) {
		throw new ConvexError({
			code: 'INVALID_QUANTITY',
			message: 'Quantity must be a whole number above zero',
		})
	}
	return quantity
}

function requireClinic(value: string): string {
	const name = capitalName(value)
	if (name.length === 0) {
		throw new ConvexError({ code: 'INVALID_STATE', message: 'Clinic name cannot be empty' })
	}
	return name
}

function requireDate(value: string, label: string): string {
	const date = toIsoDate(value)
	if (!date || date !== value.trim()) {
		throw new ConvexError({ code: 'INVALID_STATE', message: `${label} is not a whole date` })
	}
	return date
}

async function requireLoan(ctx: MutationCtx, id: Id<'loans'>): Promise<Doc<'loans'>> {
	const loan = await ctx.db.get(id)
	if (!loan) throw new ConvexError({ code: 'NOT_FOUND', message: 'Entry not found' })
	return loan
}

function requireOpen(loan: Doc<'loans'>): void {
	if (loan.settled_on !== undefined) {
		throw new ConvexError({ code: 'INVALID_STATE', message: 'This entry is already settled' })
	}
}

const entryArgs = {
	direction: loanDirection,
	clinic: v.string(),
	item_id: v.id('inventory'),
	quantity: v.number(),
	loaned_on: v.string(),
	remark: v.optional(v.string()),
}

/** The fields an entry takes from the form, checked, with the item's name and unit */
async function entryFields(
	ctx: MutationCtx,
	args: {
		direction: Doc<'loans'>['direction']
		clinic: string
		item_id: Id<'inventory'>
		quantity: number
		loaned_on: string
		remark?: string
	},
) {
	const item = await requireItem(ctx, args.item_id)
	return {
		direction: args.direction,
		clinic: requireClinic(args.clinic),
		item_id: item._id,
		item_name: item.item_name,
		unit: item.unit,
		pack_size: item.pack_size,
		pack_unit: item.pack_unit,
		quantity: requireCount(args.quantity),
		loaned_on: requireDate(args.loaned_on, 'The date'),
		remark: args.remark?.trim() ?? '',
		updated_at: Date.now(),
	}
}

export const list = query({
	args: { auth: v.string() },
	returns: v.array(loanDoc),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		// Bounded: a few entries a month, kept as the clinic's record of who owes what.
		return await ctx.db.query('loans').withIndex('by_creation_time').order('desc').collect()
	},
})

export const add = mutation({
	args: { auth: v.string(), ...entryArgs },
	returns: v.id('loans'),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		return await ctx.db.insert('loans', { ...(await entryFields(ctx, args)), returns: [] })
	},
})

/** Corrects an open entry. The quantity cannot drop to what has already come back. */
export const update = mutation({
	args: { auth: v.string(), id: v.id('loans'), ...entryArgs },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const loan = await requireLoan(ctx, args.id)
		requireOpen(loan)
		const fields = await entryFields(ctx, args)
		const returned = returnedOf(loan)
		if (fields.quantity <= returned) {
			throw new ConvexError({
				code: 'INVALID_QUANTITY',
				message: `${returned} ${unitLabel(fields)} is already back, so the quantity must be more than ${returned}`,
			})
		}
		await ctx.db.patch(loan._id, fields)
		return null
	},
})

/** Some or all of what is owed came back. Returning the rest settles the entry. */
export const recordReturn = mutation({
	args: { auth: v.string(), id: v.id('loans'), quantity: v.number(), returned_on: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const loan = await requireLoan(ctx, args.id)
		requireOpen(loan)
		const quantity = requireCount(args.quantity)
		const returned_on = requireDate(args.returned_on, 'The return date')
		const owed = owedOf(loan)
		if (quantity > owed) {
			throw new ConvexError({
				code: 'INVALID_QUANTITY',
				message: `Only ${owed} ${unitLabel(loan)} is still owed`,
			})
		}
		if (returned_on < loan.loaned_on) {
			throw new ConvexError({
				code: 'INVALID_STATE',
				message: 'The return date is before the entry’s date',
			})
		}
		await ctx.db.patch(loan._id, {
			returns: [...loan.returns, { quantity, returned_on }],
			settled_on: quantity === owed ? returned_on : undefined,
			updated_at: Date.now(),
		})
		return null
	},
})

/** Closes an entry that was paid for or swapped rather than given back, with a note saying how */
export const settle = mutation({
	args: { auth: v.string(), id: v.id('loans'), note: v.string(), settled_on: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const loan = await requireLoan(ctx, args.id)
		requireOpen(loan)
		const note = args.note.trim()
		if (note.length === 0) {
			throw new ConvexError({ code: 'INVALID_STATE', message: 'Say how it was settled' })
		}
		const settled_on = requireDate(args.settled_on, 'The date')
		if (settled_on < loan.loaned_on) {
			throw new ConvexError({
				code: 'INVALID_STATE',
				message: 'The date is before the entry’s date',
			})
		}
		await ctx.db.patch(loan._id, { settled_on, settled_note: note, updated_at: Date.now() })
		return null
	},
})

export const remove = mutation({
	args: { auth: v.string(), id: v.id('loans') },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		await ctx.db.delete((await requireLoan(ctx, args.id))._id)
		return null
	},
})

import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { requireRole } from './lib/auth'
import { payrollDoc } from './schema'

function assertMoney(value: number, name: string): void {
	if (!Number.isFinite(value) || value < 0) {
		throw new ConvexError({
			code: 'INVALID_QUANTITY',
			message: `${name} must be a non-negative number`,
		})
	}
}

export const list = query({
	args: { auth: v.string() },
	returns: v.array(payrollDoc),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		// Bounded by headcount.
		return await ctx.db.query('payroll').withIndex('by_name').order('asc').collect()
	},
})

export const add = mutation({
	args: {
		auth: v.string(),
		name: v.string(),
		basic_salary: v.number(),
		epf_employer: v.number(),
		lindung_24_jam: v.optional(v.boolean()),
	},
	returns: v.id('payroll'),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		assertMoney(args.basic_salary, 'Basic salary')
		assertMoney(args.epf_employer, 'EPF employer')
		const name = args.name.trim()
		if (name.length === 0) {
			throw new ConvexError({ code: 'INVALID_STATE', message: 'Name cannot be empty' })
		}
		return await ctx.db.insert('payroll', {
			name,
			basic_salary: args.basic_salary,
			epf_employer: args.epf_employer,
			lindung_24_jam: args.lindung_24_jam ?? false,
			updated_at: Date.now(),
		})
	},
})

export const update = mutation({
	args: {
		auth: v.string(),
		id: v.id('payroll'),
		name: v.optional(v.string()),
		basic_salary: v.optional(v.number()),
		epf_employer: v.optional(v.number()),
		lindung_24_jam: v.optional(v.boolean()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const employee = await ctx.db.get(args.id)
		if (!employee) throw new ConvexError({ code: 'NOT_FOUND', message: 'Employee not found' })
		const patch: Partial<Doc<'payroll'>> = { updated_at: Date.now() }
		if (args.name !== undefined) {
			const name = args.name.trim()
			if (name.length === 0) {
				throw new ConvexError({ code: 'INVALID_STATE', message: 'Name cannot be empty' })
			}
			patch.name = name
		}
		if (args.basic_salary !== undefined) {
			assertMoney(args.basic_salary, 'Basic salary')
			patch.basic_salary = args.basic_salary
		}
		if (args.epf_employer !== undefined) {
			assertMoney(args.epf_employer, 'EPF employer')
			patch.epf_employer = args.epf_employer
		}
		if (args.lindung_24_jam !== undefined) patch.lindung_24_jam = args.lindung_24_jam
		await ctx.db.patch(employee._id, patch)
		return null
	},
})

export const remove = mutation({
	args: { auth: v.string(), id: v.id('payroll') },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const employee = await ctx.db.get(args.id)
		if (!employee) throw new ConvexError({ code: 'NOT_FOUND', message: 'Employee not found' })
		await ctx.db.delete(employee._id)
		return null
	},
})

import { ConvexError, v } from 'convex/values'
import { mutation, query, type QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireRole } from './lib/auth'
import { capitalName } from './lib/names'
import { payrollDoc } from './schema'

function assertMoney(value: number, name: string): void {
	if (!Number.isFinite(value) || value < 0) {
		throw new ConvexError({
			code: 'INVALID_QUANTITY',
			message: `${name} must be a non-negative number`,
		})
	}
}

/** The employee's rows in saved payrolls. Bounded: one row per monthly run. */
const historyOf = (ctx: QueryCtx, id: Id<'payroll'>) =>
	ctx.db.query('payroll_run_items').withIndex('by_employee', (q) => q.eq('employee_id', id))

export const list = query({
	args: { auth: v.string() },
	returns: v.array(payrollDoc),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		// Bounded by headcount.
		const employees = await ctx.db.query('payroll').withIndex('by_name').order('asc').collect()
		return await Promise.all(
			employees.map(async (employee) => ({
				...employee,
				in_history: (await historyOf(ctx, employee._id).first()) !== null,
			})),
		)
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
		const name = capitalName(args.name)
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
			const name = capitalName(args.name)
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
		// Saved payrolls and their payslips show the employee's current name
		if (patch.name !== undefined && patch.name !== employee.name) {
			for (const item of await historyOf(ctx, employee._id).collect()) {
				await ctx.db.patch(item._id, { employee_name: patch.name })
			}
		}
		return null
	},
})

export const setActive = mutation({
	args: { auth: v.string(), id: v.id('payroll'), active: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const employee = await ctx.db.get(args.id)
		if (!employee) throw new ConvexError({ code: 'NOT_FOUND', message: 'Employee not found' })
		const now = Date.now()
		await ctx.db.patch(employee._id, {
			deactivated_at: args.active ? undefined : now,
			updated_at: now,
		})
		return null
	},
})

/**
 * Only an employee who is in no saved payroll can be deleted, such as one
 * added by mistake. Anyone who has been paid is deactivated instead.
 */
export const remove = mutation({
	args: { auth: v.string(), id: v.id('payroll') },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const employee = await ctx.db.get(args.id)
		if (!employee) throw new ConvexError({ code: 'NOT_FOUND', message: 'Employee not found' })
		if ((await historyOf(ctx, employee._id).first()) !== null) {
			throw new ConvexError({
				code: 'INVALID_STATE',
				message: `${employee.name} is in a saved payroll, so cannot be deleted. Deactivate them instead.`,
			})
		}
		await ctx.db.delete(employee._id)
		return null
	},
})

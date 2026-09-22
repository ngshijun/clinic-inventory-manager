import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { requireRole } from './lib/auth'
import { payrollRunDoc, payrollRunItemDoc, payrollRunItemNumberFields } from './schema'

const runItemInput = v.object({
	employee_id: v.optional(v.union(v.id('payroll'), v.null())),
	employee_name: v.string(),
	...payrollRunItemNumberFields,
})

function assertPeriod(year: number, month: number): void {
	if (!Number.isInteger(year) || year < 2000 || year > 2100) {
		throw new ConvexError({
			code: 'INVALID_ARGUMENT',
			message: 'Year must be between 2000 and 2100',
		})
	}
	if (!Number.isInteger(month) || month < 1 || month > 12) {
		throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'Month must be between 1 and 12' })
	}
}

export const list = query({
	args: { auth: v.string() },
	returns: v.array(payrollRunDoc),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		// Bounded: one run per month.
		const runs = await ctx.db.query('payroll_runs').collect()
		runs.sort((a, b) => b.year - a.year || b.month - a.month)
		return runs
	},
})

export const items = query({
	args: { auth: v.string(), run_id: v.id('payroll_runs') },
	returns: v.array(payrollRunItemDoc),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		// Bounded by headcount.
		const rows = await ctx.db
			.query('payroll_run_items')
			.withIndex('by_run', (q) => q.eq('run_id', args.run_id))
			.collect()
		rows.sort((a, b) => a.employee_name.localeCompare(b.employee_name))
		return rows
	},
})

/** Upserts the run for (year, month) and replaces its items. */
export const save = mutation({
	args: {
		auth: v.string(),
		year: v.number(),
		month: v.number(),
		items: v.array(runItemInput),
	},
	returns: payrollRunDoc,
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		assertPeriod(args.year, args.month)
		for (const item of args.items) {
			for (const key of Object.keys(payrollRunItemNumberFields) as Array<
				keyof typeof payrollRunItemNumberFields
			>) {
				if (!Number.isFinite(item[key])) {
					throw new ConvexError({
						code: 'INVALID_ARGUMENT',
						message: `${key} for ${item.employee_name} must be a finite number`,
					})
				}
			}
		}

		const now = Date.now()
		const existing = await ctx.db
			.query('payroll_runs')
			.withIndex('by_period', (q) => q.eq('year', args.year).eq('month', args.month))
			.unique()

		let run_id: Id<'payroll_runs'>
		if (existing) {
			run_id = existing._id
			await ctx.db.patch(run_id, { finalized_at: now, updated_at: now })
			// Bounded by headcount.
			const oldItems = await ctx.db
				.query('payroll_run_items')
				.withIndex('by_run', (q) => q.eq('run_id', run_id))
				.collect()
			for (const item of oldItems) await ctx.db.delete(item._id)
		} else {
			run_id = await ctx.db.insert('payroll_runs', {
				year: args.year,
				month: args.month,
				finalized_at: now,
				updated_at: now,
			})
		}

		for (const item of args.items) {
			const { employee_id, ...rest } = item
			await ctx.db.insert('payroll_run_items', {
				run_id,
				employee_id: employee_id ?? undefined,
				...rest,
				updated_at: now,
			})
		}

		const run = await ctx.db.get(run_id)
		if (!run) throw new ConvexError({ code: 'NOT_FOUND', message: 'Payroll run not found' })
		return run
	},
})

export const remove = mutation({
	args: { auth: v.string(), run_id: v.id('payroll_runs') },
	returns: v.null(),
	handler: async (ctx, args) => {
		requireRole(args.auth, ['manager'])
		const run = await ctx.db.get(args.run_id)
		if (!run) throw new ConvexError({ code: 'NOT_FOUND', message: 'Payroll run not found' })
		// Bounded by headcount.
		const rows = await ctx.db
			.query('payroll_run_items')
			.withIndex('by_run', (q) => q.eq('run_id', run._id))
			.collect()
		for (const row of rows) await ctx.db.delete(row._id)
		await ctx.db.delete(run._id)
		return null
	},
})

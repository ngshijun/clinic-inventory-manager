import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/** Fields every table carries. `_creationTime` is the created-at timestamp. */
const commonFields = {
	updated_at: v.number(),
	legacy_id: v.optional(v.string()),
}

export const movementType = v.union(v.literal('stock_in'), v.literal('stock_out'))
export const requestStatus = v.union(
	v.literal('Pending'),
	v.literal('Approved'),
	v.literal('Rejected'),
)
export const role = v.union(v.literal('manager'), v.literal('requester'))

export const inventoryFields = {
	item_name: v.string(),
	quantity: v.number(),
	reorder_level: v.number(),
	unit: v.string(),
	remark: v.string(),
	order_date: v.optional(v.string()),
	non_order_reason: v.optional(v.string()),
	back_order: v.boolean(),
	not_track: v.boolean(),
	is_pinned: v.boolean(),
	...commonFields,
}

export const stockBatchFields = {
	item_id: v.id('inventory'),
	quantity: v.number(),
	expiry_date: v.optional(v.string()),
	...commonFields,
}

export const stockMovementFields = {
	// May dangle after the item is deleted: movements are history.
	item_id: v.id('inventory'),
	item_name: v.string(),
	quantity: v.number(),
	movement_type: movementType,
	remark: v.string(),
	batch_id: v.optional(v.id('stock_batches')),
	expiry_date: v.optional(v.string()),
	...commonFields,
}

export const stockRequestFields = {
	item_id: v.id('inventory'),
	item_name: v.string(),
	quantity: v.number(),
	remark: v.optional(v.string()),
	status: requestStatus,
	...commonFields,
}

export const payrollFields = {
	name: v.string(),
	basic_salary: v.number(),
	epf_employer: v.number(),
	lindung_24_jam: v.boolean(),
	...commonFields,
}

export const payrollRunFields = {
	year: v.number(),
	month: v.number(),
	finalized_at: v.number(),
	...commonFields,
}

export const payrollRunItemNumberFields = {
	basic_salary: v.number(),
	epf_employee: v.number(),
	epf_employer: v.number(),
	socso_employee: v.number(),
	socso_employer: v.number(),
	eis_employee: v.number(),
	eis_employer: v.number(),
	lindung_24_jam: v.number(),
	pcb: v.number(),
	cp38: v.number(),
	net_salary: v.number(),
}

export const payrollRunItemFields = {
	run_id: v.id('payroll_runs'),
	employee_id: v.optional(v.id('payroll')),
	employee_name: v.string(),
	...payrollRunItemNumberFields,
	...commonFields,
}

const systemFields = <T extends string>(table: T) => ({
	_id: v.id(table),
	_creationTime: v.number(),
})

/** Shared doc validators so `returns` validators match the stored docs exactly. */
export const inventoryDoc = v.object({ ...systemFields('inventory'), ...inventoryFields })
export const stockBatchDoc = v.object({ ...systemFields('stock_batches'), ...stockBatchFields })
export const stockMovementDoc = v.object({
	...systemFields('stock_movements'),
	...stockMovementFields,
})
export const stockRequestDoc = v.object({
	...systemFields('stock_requests'),
	...stockRequestFields,
})
export const payrollDoc = v.object({ ...systemFields('payroll'), ...payrollFields })
export const payrollRunDoc = v.object({ ...systemFields('payroll_runs'), ...payrollRunFields })
export const payrollRunItemDoc = v.object({
	...systemFields('payroll_run_items'),
	...payrollRunItemFields,
})

export default defineSchema({
	inventory: defineTable(inventoryFields)
		.index('by_item_name', ['item_name'])
		.index('by_legacy_id', ['legacy_id']),

	stock_batches: defineTable(stockBatchFields)
		// Stock out drains these in FEFO order (see lib/stock.ts fefoOrder).
		.index('by_item', ['item_id']),

	stock_movements: defineTable(stockMovementFields)
		.index('by_item', ['item_id'])
		.index('by_type', ['movement_type'])
		.searchIndex('search_item_name', {
			searchField: 'item_name',
			filterFields: ['movement_type'],
		}),

	stock_requests: defineTable(stockRequestFields)
		.index('by_status', ['status'])
		.index('by_item', ['item_id']),

	payroll: defineTable(payrollFields).index('by_name', ['name']),

	payroll_runs: defineTable(payrollRunFields).index('by_period', ['year', 'month']),

	payroll_run_items: defineTable(payrollRunItemFields).index('by_run', ['run_id']),
})

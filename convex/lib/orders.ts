/**
 * Calendar dates for ordering, as bare YYYY-MM-DD strings, and the
 * purchaser's queues built on them. Shared by the Convex functions and the
 * pages, so both sides agree on what "a week" and "late" are.
 */
import type { Doc } from '../_generated/dataModel'

type Item = Pick<
	Doc<'inventory'>,
	'quantity' | 'reorder_level' | 'not_track' | 'order_status' | 'updated_at'
>
type OrderedStatus = Extract<NonNullable<Item['order_status']>, { kind: 'ordered' }>

/** Days a supplier normally takes; Mark Ordered proposes this expected date. */
export const LEAD_DAYS = 7

/** Days a back-order (no expected date) waits before the Dashboard calls it late. */
export const BACK_ORDER_LATE_DAYS = 14

/** Days before expiry at which a batch counts as "expiring soon" */
export const EXPIRY_WARNING_DAYS = 30

/** Days an item with stock goes untouched before the Dashboard lists it as not moving */
export const NOT_MOVING_DAYS = 30

/** What Mark Ordered proposes: enough to reach twice the reorder level, at least one. */
export function suggestedOrderQuantity(quantity: number, reorder_level: number): number {
	return Math.max(1, reorder_level * 2 - quantity)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/

/** The YYYY-MM-DD at the start of a date or date-time string, or null. */
export function toIsoDate(value: string | null | undefined): string | null {
	if (!value) return null
	const match = ISO_DATE.exec(value.trim())
	return match ? match[0] : null
}

/** Calendar arithmetic with no time zone: "2026-09-24" + 7 → "2026-10-01". */
export function addDays(date: string, days: number): string {
	const [year, month, day] = date.split('-').map(Number)
	return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** Whole days from one YYYY-MM-DD to another; negative when `to` is earlier */
export const daysBetween = (from: string, to: string): number =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/** Today's date at the clinic, for the server. Malaysia is UTC+8 all year. */
export const clinicToday = (now: number): string =>
	new Date(now + 8 * 3_600_000).toISOString().slice(0, 10)

/*
 * The purchaser's queues. An item the clinic still orders, at or below its reorder level needs
 * stock; it needs a decision until it is ordered or snoozed. Snoozes end on
 * their own: once the date passes the item is back in To Order, still
 * carrying the snooze so the row can say it was snoozed.
 */

export const needsStock = (item: Item): boolean =>
	!item.not_track && item.quantity <= item.reorder_level

export const isOnOrder = (item: Item): boolean => item.order_status?.kind === 'ordered'

export const isSnoozing = (item: Item, today: string): boolean =>
	item.order_status?.kind === 'snoozed' && item.order_status.until > today

export const wokeFromSnooze = (item: Item, today: string): boolean =>
	item.order_status?.kind === 'snoozed' && item.order_status.until <= today

export const needsDecision = (item: Item, today: string): boolean =>
	needsStock(item) && !isOnOrder(item) && !isSnoozing(item, today)

/** Past its expected date, or a back-order with no date for BACK_ORDER_LATE_DAYS */
export const isLate = (status: OrderedStatus, today: string): boolean =>
	status.expected_by
		? status.expected_by < today
		: addDays(status.ordered_on, BACK_ORDER_LATE_DAYS) <= today

/** Whole days since the item was last stocked in or out, or edited */
export const daysIdle = (item: Item, now: number): number =>
	Math.floor((now - item.updated_at) / 86_400_000)

export const isNotMoving = (item: Item, now: number): boolean =>
	!item.not_track && item.quantity > 0 && daysIdle(item, now) > NOT_MOVING_DAYS

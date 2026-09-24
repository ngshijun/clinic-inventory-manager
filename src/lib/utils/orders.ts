import { BACK_ORDER_LATE_DAYS, addDays } from '../../../convex/lib/orders'
import type { InventoryItem, OrderedStatus } from '$lib/types/inventory'
import { todayIsoDate } from '$lib/types/stockBatches'

/*
 * The purchaser's queues. A tracked item at or below its reorder level needs
 * stock; it needs a decision until it is ordered or snoozed. Snoozes end on
 * their own: once the date passes the item is back in To Order, still
 * carrying the snooze so the row can say it was snoozed.
 */

export const needsStock = (item: InventoryItem): boolean =>
	!item.not_track && item.reorder_level >= 0 && item.quantity <= item.reorder_level

export const isOnOrder = (item: InventoryItem): boolean => item.order_status?.kind === 'ordered'

export const isSnoozing = (item: InventoryItem, today = todayIsoDate()): boolean =>
	item.order_status?.kind === 'snoozed' && item.order_status.until > today

export const wokeFromSnooze = (item: InventoryItem, today = todayIsoDate()): boolean =>
	item.order_status?.kind === 'snoozed' && item.order_status.until <= today

export const needsDecision = (item: InventoryItem, today = todayIsoDate()): boolean =>
	needsStock(item) && !isOnOrder(item) && !isSnoozing(item, today)

/** Past its expected date, or a back-order with no date for BACK_ORDER_LATE_DAYS */
export const isLate = (status: OrderedStatus, today = todayIsoDate()): boolean =>
	status.expected_by
		? status.expected_by < today
		: addDays(status.ordered_on, BACK_ORDER_LATE_DAYS) <= today

/** Whole days from one YYYY-MM-DD to another; negative when `to` is earlier */
export const daysBetween = (from: string, to: string): number =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

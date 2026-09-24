/**
 * Calendar dates for ordering, as bare YYYY-MM-DD strings. Shared by the
 * Convex functions and the pages, so both sides agree on what "a week" is.
 */

/** Days a supplier normally takes; Mark Ordered proposes this expected date. */
export const LEAD_DAYS = 7

/** Days a back-order (no expected date) waits before the Dashboard calls it late. */
export const BACK_ORDER_LATE_DAYS = 14

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

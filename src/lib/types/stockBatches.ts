import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { WithLegacy } from '$lib/types/legacy'

export type StockBatchId = Id<'stock_batches'>

export type StockBatch = WithLegacy<Doc<'stock_batches'>>

/**
 * The order stock out consumes batches: earliest expiry first, then batches
 * with no expiry date, oldest received first. Mirrors fefoOrder on the server.
 */
export const fefoOrder = <T extends { expiry_date?: string; _creationTime: number }>(
	batches: T[],
): T[] =>
	[...batches].sort((a, b) => {
		if (a.expiry_date && b.expiry_date && a.expiry_date !== b.expiry_date) {
			return a.expiry_date < b.expiry_date ? -1 : 1
		}
		if (a.expiry_date && !b.expiry_date) return -1
		if (!a.expiry_date && b.expiry_date) return 1
		return a._creationTime - b._creationTime
	})

/** Days before expiry at which a batch counts as "expiring soon" */
export const EXPIRY_WARNING_DAYS = 30

export type ExpiryStatus = 'expired' | 'expiring' | 'ok' | 'none'

/** Today's date as YYYY-MM-DD in the browser's local time zone */
export const todayIsoDate = (): string => {
	const now = new Date()
	return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/** Whole days from today until `expiryDate` (negative when already expired) */
export const daysUntilExpiry = (expiryDate: string): number => {
	const today = new Date(`${todayIsoDate()}T00:00:00`)
	const expiry = new Date(`${expiryDate}T00:00:00`)
	return Math.round((expiry.getTime() - today.getTime()) / 86400000)
}

export const getExpiryStatus = (expiryDate: string | null | undefined): ExpiryStatus => {
	if (!expiryDate) return 'none'
	const days = daysUntilExpiry(expiryDate)
	if (days < 0) return 'expired'
	if (days <= EXPIRY_WARNING_DAYS) return 'expiring'
	return 'ok'
}

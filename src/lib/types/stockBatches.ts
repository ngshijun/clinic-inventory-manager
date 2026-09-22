import type { Database } from '$lib/types/database.types'

export type StockBatch = Database['public']['Tables']['stock_batches']['Row']

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

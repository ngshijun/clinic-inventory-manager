import type { Tone } from '$lib/components/app/ToneBadge.svelte'
import type { StockRequest } from '$lib/types/stockRequests'
import { todayIsoDate } from '$lib/types/stockBatches'

/** Which requests the day control shows */
export type DayMode = 'today' | 'older' | 'date'

/** YYYY-MM-DD of an instant in the browser's local time zone */
export const localDateKey = (value: string | number | Date): string => {
	const date = new Date(value)
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Pending and requested before today */
export const isOlderPending = (request: StockRequest): boolean =>
	request.status === 'Pending' && localDateKey(request.created_at) < todayIsoDate()

export const matchesSearch = (request: StockRequest, query: string): boolean => {
	const needle = query.trim().toLowerCase()
	if (!needle) return true
	return (
		request.item_name.toLowerCase().includes(needle) ||
		(request.remark ?? '').toLowerCase().includes(needle)
	)
}

export const matchesDay = (request: StockRequest, mode: DayMode, date: string): boolean => {
	switch (mode) {
		case 'today':
			return localDateKey(request.created_at) === todayIsoDate()
		case 'older':
			return isOlderPending(request)
		case 'date':
			return date === '' || localDateKey(request.created_at) === date
	}
}

export const STATUS_TONE: Record<StockRequest['status'], Tone> = {
	Pending: 'warning',
	Approved: 'success',
	Rejected: 'danger',
}

export const STATUS_RANK: Record<StockRequest['status'], number> = {
	Pending: 0,
	Approved: 1,
	Rejected: 2,
}

/** "3 boxes", or just the number once the item (and its unit) is gone */
export const withUnit = (quantity: number, unit: string): string =>
	unit ? `${quantity} ${unit}` : String(quantity)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const toDate = (value: string | number | Date): Date | null => {
	// A bare YYYY-MM-DD is a calendar date, not an instant; read it in local time.
	const date =
		typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
			? new Date(`${value}T00:00:00`)
			: new Date(value)
	return Number.isNaN(date.getTime()) ? null : date
}

/** The one date format used across the app: "23 Sep 2026". */
export const formatDate = (value: string | number | Date | null | undefined): string => {
	if (value === null || value === undefined || value === '') return '—'
	const date = toDate(value)
	if (!date) return '—'
	const day = String(date.getDate()).padStart(2, '0')
	return `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** Date without the year for tight spots ("20 Sep") */
export const formatDayMonth = (value: string | number | Date | null | undefined): string => {
	if (value === null || value === undefined || value === '') return '—'
	const date = toDate(value)
	if (!date) return '—'
	return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]}`
}

/** Date and time: "23 Sep 2026, 14:05" */
export const formatDateTime = (value: string | number | Date | null | undefined): string => {
	if (value === null || value === undefined || value === '') return '—'
	const date = toDate(value)
	if (!date) return '—'
	const hours = String(date.getHours()).padStart(2, '0')
	const minutes = String(date.getMinutes()).padStart(2, '0')
	return `${formatDate(date)}, ${hours}:${minutes}`
}

/** Time of day only: "14:05" */
export const formatTime = (value: string | number | Date | null | undefined): string => {
	if (value === null || value === undefined || value === '') return '—'
	const date = toDate(value)
	if (!date) return '—'
	return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** Whole days as words: "3 days", "2 weeks", "4 months", "1 year" */
export const formatDuration = (days: number): string => {
	const unit = (count: number, noun: string): string =>
		`${count} ${count === 1 ? noun : `${noun}s`}`
	if (days < 14) return unit(days, 'day')
	if (days < 60) return unit(Math.floor(days / 7), 'week')
	if (days < 365) return unit(Math.floor(days / 30), 'month')
	return unit(Math.floor(days / 365), 'year')
}

/** Days between an instant and now, rounded down; 0 for today or the future */
export const daysSince = (value: string | number | Date): number => {
	const date = toDate(value)
	if (!date) return 0
	return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000))
}

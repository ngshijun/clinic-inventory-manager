import { daysUntilExpiry, getExpiryStatus } from '$lib/types/stockBatches'
import { formatDuration } from '$lib/utils/date'

export interface ExpiryBadge {
	tone: 'danger' | 'warning'
	text: string
}

/** The badge shown beside an expiry date once it is close or past; null while it is fine. */
export const expiryBadge = (expiryDate: string | null | undefined): ExpiryBadge | null => {
	if (!expiryDate) return null
	const status = getExpiryStatus(expiryDate)
	const days = daysUntilExpiry(expiryDate)
	if (status === 'expired') {
		return {
			tone: 'danger',
			text: days === -1 ? 'Expired yesterday' : `Expired ${formatDuration(-days)} ago`,
		}
	}
	if (status === 'expiring') {
		return {
			tone: 'warning',
			text:
				days === 0
					? 'Expires today'
					: days === 1
						? 'Expires tomorrow'
						: `Expires in ${formatDuration(days)}`,
		}
	}
	return null
}

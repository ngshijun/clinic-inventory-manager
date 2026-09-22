import type { Tone } from '$lib/components/app/ToneBadge.svelte'

export type NonOrderReasonKey = string

export type NonOrderReasonMeta = {
	tone: Tone
	icon: 'tick' | 'clock' | 'cross' | 'info'
	/** Title Case, for menu items and other controls */
	label: string
}

// Central mapping for reasons -> presentation. Keys are the stored values.
export const NON_ORDER_REASON_META: Record<NonOrderReasonKey, NonOrderReasonMeta> = {
	'Alternative ordered': { tone: 'success', icon: 'tick', label: 'Alternative Ordered' },
	'Planning to order later': { tone: 'warning', icon: 'clock', label: 'Planning to Order Later' },
	'Supplier has no stock': { tone: 'danger', icon: 'cross', label: 'Supplier Has No Stock' },
}

/** The reasons a person can pick, in menu order */
export const NON_ORDER_REASONS: string[] = Object.keys(NON_ORDER_REASON_META)

export function getNonOrderReasonMeta(reason: string | null | undefined): NonOrderReasonMeta {
	if (reason && NON_ORDER_REASON_META[reason]) return NON_ORDER_REASON_META[reason]
	return { tone: 'neutral', icon: 'info', label: reason ?? '' }
}

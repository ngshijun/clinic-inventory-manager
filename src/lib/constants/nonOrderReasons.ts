import type { Tone } from '$lib/components/app/ToneBadge.svelte'

export type NonOrderReasonKey = string

export type NonOrderReasonMeta = {
	tone: Tone
	icon: 'tick' | 'clock' | 'cross' | 'info'
}

// Central mapping for reasons -> presentation
export const NON_ORDER_REASON_META: Record<NonOrderReasonKey, NonOrderReasonMeta> = {
	'Alternative ordered': { tone: 'success', icon: 'tick' },
	'Planning to order later': { tone: 'warning', icon: 'clock' },
	'Supplier has no stock': { tone: 'danger', icon: 'cross' },
}

export function getNonOrderReasonMeta(reason: string | null | undefined): NonOrderReasonMeta {
	if (reason && NON_ORDER_REASON_META[reason]) return NON_ORDER_REASON_META[reason]
	return { tone: 'neutral', icon: 'info' }
}

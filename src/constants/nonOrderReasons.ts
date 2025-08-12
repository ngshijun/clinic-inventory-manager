export type NonOrderReasonKey = string

export type NonOrderReasonMeta = {
  colorClass: string // Tailwind text color class
  icon: 'tick' | 'clock' | 'cross' | 'info'
}

// Central mapping for reasons -> presentation
export const NON_ORDER_REASON_META: Record<NonOrderReasonKey, NonOrderReasonMeta> = {
  'Alternative ordered': { colorClass: 'text-green-700', icon: 'tick' },
  'Planning to order later': { colorClass: 'text-amber-700', icon: 'clock' },
  'Supplier has no stock': { colorClass: 'text-red-700', icon: 'cross' },
}

export function getNonOrderReasonMeta(reason: string | null | undefined): NonOrderReasonMeta {
  if (reason && NON_ORDER_REASON_META[reason]) return NON_ORDER_REASON_META[reason]
  return { colorClass: 'text-gray-700', icon: 'info' }
}

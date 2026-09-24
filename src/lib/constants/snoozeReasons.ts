/** Why an item is snoozed, in menu order. The stored value is the label. */
export const SNOOZE_REASONS = [
	'Will order later',
	'Supplier has no stock',
	'Enough for now',
] as const

/** The snooze lengths offered as one-click chips, in days */
export const SNOOZE_CHIPS = [
	{ days: 7, label: 'In 1 week' },
	{ days: 14, label: 'In 2 weeks' },
	{ days: 30, label: 'In 1 month' },
] as const

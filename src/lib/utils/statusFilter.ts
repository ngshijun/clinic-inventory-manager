import type { InventoryItem } from '$lib/types/inventory'

/*
 * The status segments in the toolbar of Inventory and Price List. Low Stock
 * and Out of Stock leave out the items the clinic no longer orders, which
 * have a segment of their own.
 */

export type StatusFilter = 'all' | 'low' | 'out' | 'ordered' | 'notordering'

export const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
	{ value: 'all', label: 'All' },
	{ value: 'low', label: 'Low Stock' },
	{ value: 'out', label: 'Out of Stock' },
	{ value: 'ordered', label: 'On Order' },
	{ value: 'notordering', label: 'Not Ordering' },
]

export const isStatusFilter = (value: string | null): value is StatusFilter =>
	STATUS_FILTERS.some((option) => option.value === value)

export const matchesStatus = (item: InventoryItem, filter: StatusFilter): boolean => {
	switch (filter) {
		case 'low':
			return !item.not_track && item.quantity > 0 && item.quantity <= item.reorder_level
		case 'out':
			return !item.not_track && item.quantity === 0
		case 'ordered':
			return item.order_status?.kind === 'ordered'
		case 'notordering':
			return item.not_track
		default:
			return true
	}
}

import type { InventoryItem } from '$lib/types/inventory'

/*
 * The Supplier filter's two choices that are not a supplier. A supplier name is
 * trimmed text, so it never starts with a space and cannot collide with them.
 */
export const ALL_SUPPLIERS = ' all'
export const NO_SUPPLIER = ' none'

export interface SupplierCount {
	name: string
	count: number
}

/** The suppliers among these items, in alphabetical order, with how many items each has */
export const supplierCounts = (items: InventoryItem[]): SupplierCount[] => {
	const counts = new Map<string, number>()
	for (const item of items) {
		if (item.supplier) counts.set(item.supplier, (counts.get(item.supplier) ?? 0) + 1)
	}
	return [...counts]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
}

/**
 * The filter that applies: a choice that these items no longer offer (the
 * supplier's last item was ordered, or the supplier was renamed) falls back to
 * every supplier, so a list never sits empty behind a choice that is gone.
 */
export const activeSupplier = (choice: string, items: InventoryItem[]): string => {
	if (choice === NO_SUPPLIER) return items.some((item) => !item.supplier) ? choice : ALL_SUPPLIERS
	return items.some((item) => item.supplier === choice) ? choice : ALL_SUPPLIERS
}

export const matchesSupplier = (item: InventoryItem, supplier: string): boolean => {
	if (supplier === ALL_SUPPLIERS) return true
	if (supplier === NO_SUPPLIER) return !item.supplier
	return item.supplier === supplier
}

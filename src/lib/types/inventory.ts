import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { WithLegacy } from '$lib/types/legacy'

export type InventoryId = Id<'inventory'>

export type InventoryItem = WithLegacy<Doc<'inventory'>>

/** Fields the Add New Item form and the Excel import provide */
export interface NewInventoryItem {
	item_name: string
	quantity: number
	reorder_level: number
	unit: string
	remark?: string
	order_date?: string | null
	non_order_reason?: string | null
	back_order?: boolean
	not_track?: boolean
}

/** Fields that can be edited directly; stock only moves through batches */
export interface InventoryItemUpdate {
	item_name?: string
	unit?: string
	reorder_level?: number
	remark?: string
	not_track?: boolean
	order_date?: string | null
	non_order_reason?: string | null
}

export interface StockStatus {
	text: string
	class: string
}

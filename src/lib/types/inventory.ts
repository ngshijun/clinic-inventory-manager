import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { WithLegacy } from '$lib/types/legacy'

export type InventoryId = Id<'inventory'>

export type InventoryItem = WithLegacy<Doc<'inventory'>>

/** Where an item stands with the purchaser; see convex/schema.ts orderStatus */
export type OrderStatus = NonNullable<Doc<'inventory'>['order_status']>
export type OrderedStatus = Extract<OrderStatus, { kind: 'ordered' }>
export type SnoozedStatus = Extract<OrderStatus, { kind: 'snoozed' }>

/** Fields the Add New Item form and the Excel import provide */
export interface NewInventoryItem {
	item_name: string
	quantity: number
	reorder_level: number
	unit: string
	remark?: string
	not_track?: boolean
}

/** Fields that can be edited directly; stock only moves through batches */
export interface InventoryItemUpdate {
	item_name?: string
	unit?: string
	reorder_level?: number
	remark?: string
	not_track?: boolean
}

import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { WithLegacy } from '$lib/types/legacy'

// The server joins the item's current unit onto each movement
export type StockMovement = WithLegacy<Doc<'stock_movements'> & { unit: string }>

export type MovementType = 'stock_in' | 'stock_out'

export interface MovementFilters {
	/** Free-text item name search (relevance ordered when set) */
	itemName: string
	/** Narrow to one item; the item picker on the page sets this */
	itemId: Id<'inventory'> | null
	quantityMin: number | null
	quantityMax: number | null
	movementType: MovementType | ''
	/** YYYY-MM-DD, inclusive, in local time */
	startDate: string
	/** YYYY-MM-DD, inclusive, in local time */
	endDate: string
	remark: string
}

export interface MovementsQuery {
	pageSize: number
	sortDirection: 'asc' | 'desc'
	filters: MovementFilters
}

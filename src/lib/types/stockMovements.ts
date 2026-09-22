import type { Database } from '$lib/types/database.types'

// Extend database types with additional fields used in the app
export type StockMovement = Database['public']['Tables']['stock_movements']['Row'] & {
	unit: string
}

export type MovementType = 'stock_in' | 'stock_out'

export type MovementSortKey =
	'item_name' | 'quantity' | 'movement_type' | 'expiry_date' | 'created_at'

export interface MovementFilters {
	itemName: string
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
	page: number
	pageSize: number
	sortKey: MovementSortKey
	sortDirection: 'asc' | 'desc'
	filters: MovementFilters
}

export const emptyMovementFilters = (): MovementFilters => ({
	itemName: '',
	quantityMin: null,
	quantityMax: null,
	movementType: '',
	startDate: '',
	endDate: '',
	remark: '',
})

import type { Database } from '$lib/types/database.types'

// Extend database types with additional fields used in the app
export type StockRequest = Database['public']['Tables']['stock_requests']['Row'] & {
	unit: string
}

export type NewStockRequest = Omit<
	Database['public']['Tables']['stock_requests']['Insert'],
	'unit' | 'status'
>

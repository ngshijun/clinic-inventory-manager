import type { Database } from '$lib/types/database.types'

// Extend database types with additional fields used in the app
export type StockMovement = Database['public']['Tables']['stock_movements']['Row'] & {
  unit: string
}

export type NewStockMovement = Omit<
  Database['public']['Tables']['stock_movements']['Insert'],
  'unit'
>

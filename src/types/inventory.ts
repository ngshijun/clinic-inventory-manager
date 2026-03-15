import type { Database } from '@/types/database.types'

export type InventoryItem = Database['public']['Tables']['inventory']['Row']
export type NewInventoryItem = Database['public']['Tables']['inventory']['Insert']

export interface StockStatus {
  text: string
  class: string
}

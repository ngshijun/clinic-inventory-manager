export interface InventoryItem {
  id: string
  item_name: string
  quantity: number
  reorder_level: number
  unit: string
  remark: string
  order_date: string | null // Added order_date field
  non_order_reason: string | null // Reason why item is not ordered yet
  created_at: string
  updated_at: string
}

export interface NewInventoryItem {
  item_name: string
  quantity: number
  reorder_level: number
  unit: string
  remark?: string
  order_date?: string | null // Added order_date field
  non_order_reason?: string | null // Reason why item is not ordered yet
}

export interface StockStatus {
  text: string
  class: string
}

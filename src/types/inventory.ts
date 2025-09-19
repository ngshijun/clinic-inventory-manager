export interface InventoryItem {
  id: string
  item_name: string
  quantity: number
  reorder_level: number
  unit: string
  remark: string
  order_date: string | null // Added order_date field
  non_order_reason: string | null // Reason why item is not ordered yet
  back_order: boolean // Whether this is a back order
  not_track: boolean // Whether to track this item on dashboard
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
  back_order?: boolean // Whether this is a back order
  not_track?: boolean // Whether to track this item on dashboard
}

export interface StockStatus {
  text: string
  class: string
}

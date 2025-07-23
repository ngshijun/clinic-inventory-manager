export interface InventoryItem {
  id: string
  item_name: string
  quantity: number
  low_stock_notice_quantity: number
  unit: string
  remark: string
  created_at: string
  updated_at: string
}

export interface NewInventoryItem {
  item_name: string
  quantity: number
  low_stock_notice_quantity: number
  unit: string
  remark?: string
}

export interface StockStatus {
  text: string
  class: string
}

export interface StockMovement {
  id: string
  item_id: string
  item_name: string
  quantity: number
  movement_type: 'stock_in' | 'stock_out'
  remark: string
  created_at: string
  updated_at: string
}

export interface NewStockMovement {
  item_id: string
  item_name: string
  quantity: number
  movement_type: 'stock_in' | 'stock_out'
  remark?: string
}
export interface StockRequest {
  id: string
  item_id: string
  item_name: string
  quantity: number
  remark: string
  status: 'Approved' | 'Pending' | 'Cancelled'
  unit: string
  created_at: string
  updated_at: string
}

export interface NewStockRequest {
  item_id: string
  item_name: string
  quantity: number
  remark?: string
}

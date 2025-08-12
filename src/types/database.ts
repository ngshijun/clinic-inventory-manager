// types/database.ts
export interface Database {
  public: {
    Tables: {
      inventory: {
        Row: {
          id: string // uuid
          item_name: string // text
          quantity: number // int8
          reorder_level: number // int8
          unit: string // unit
          remark: string
          order_date: string | null // timestamp - Added order_date field
          non_order_reason: string | null // text - Reason why item is not ordered yet
          created_at: string // timestamp
          updated_at: string // timestamp
        }
        Insert: {
          id?: string // uuid (auto-generated)
          item_name: string
          quantity: number
          reorder_level: number
          unit: string
          remark?: string
          order_date?: string | null // Added order_date field
          non_order_reason?: string | null // Reason why item is not ordered yet
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          item_name?: string
          quantity?: number
          reorder_level?: number
          unit?: string
          remark?: string
          order_date?: string | null // Added order_date field
          non_order_reason?: string | null // Reason why item is not ordered yet
          created_at?: string
          updated_at?: string
        }
      }
      stock_movements: {
        Row: {
          id: string // uuid
          item_id: string // uuid reference to inventory
          item_name: string // text (for easier querying)
          quantity: number // int8
          movement_type: 'stock_in' | 'stock_out' // enum
          remark: string // text
          created_at: string // timestamp
          updated_at: string // timestamp
        }
        Insert: {
          id?: string
          item_id: string
          item_name: string
          quantity: number
          movement_type: 'stock_in' | 'stock_out'
          remark?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          item_name?: string
          quantity?: number
          movement_type?: 'stock_in' | 'stock_out'
          remark?: string
          created_at?: string
          updated_at?: string
        }
      }
      stock_requests: {
        Row: {
          id: string
          item_id: string
          item_name: string
          quantity: number
          remark: string
          status: 'Approved' | 'Pending' | 'Rejected'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          item_id: string
          item_name: string
          quantity: number
          remark?: string
          status?: 'Approved' | 'Pending' | 'Rejected'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          item_name?: string
          quantity?: number
          remark?: string
          status?: 'Approved' | 'Pending' | 'Rejected'
          created_at?: string
          updated_at?: string
        }
      }
      payroll: {
        Row: {
          id: string // uuid
          name: string // text
          basic_salary: number // numeric
          epf_employer: number // numeric
        }
        Insert: {
          id?: string
          name: string
          basic_salary: number
          epf_employer: number
        }
        Update: {
          id?: string
          name?: string
          basic_salary?: number
          epf_employer?: number
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

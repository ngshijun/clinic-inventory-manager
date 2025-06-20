// types/database.ts
export interface Database {
  public: {
    Tables: {
      inventory: {
        Row: {
          id: string // uuid
          item_name: string // text
          quantity: number // int8
          low_stock_notice_quantity: number // int8
          created_at: string // timestamp
          updated_at: string // timestamp
        }
        Insert: {
          id?: string // uuid (auto-generated)
          item_name: string
          quantity: number
          low_stock_notice_quantity: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          item_name?: string
          quantity?: number
          low_stock_notice_quantity?: number
          created_at?: string
          updated_at?: string
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
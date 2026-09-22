export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
	// Allows to automatically instantiate createClient with right options
	// instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
	__InternalSupabase: {
		PostgrestVersion: '13.0.5'
	}
	public: {
		Tables: {
			inventory: {
				Row: {
					back_order: boolean
					created_at: string
					id: string
					is_pinned: boolean
					item_name: string
					non_order_reason: string | null
					not_track: boolean
					order_date: string | null
					quantity: number
					remark: string
					reorder_level: number
					unit: string
					updated_at: string
				}
				Insert: {
					back_order?: boolean
					created_at?: string
					id?: string
					is_pinned?: boolean
					item_name: string
					non_order_reason?: string | null
					not_track?: boolean
					order_date?: string | null
					quantity: number
					remark?: string
					reorder_level: number
					unit: string
					updated_at?: string
				}
				Update: {
					back_order?: boolean
					created_at?: string
					id?: string
					is_pinned?: boolean
					item_name?: string
					non_order_reason?: string | null
					not_track?: boolean
					order_date?: string | null
					quantity?: number
					remark?: string
					reorder_level?: number
					unit?: string
					updated_at?: string
				}
				Relationships: []
			}
			payroll: {
				Row: {
					basic_salary: number
					created_at: string
					epf_employer: number
					id: string
					lindung_24_jam: boolean
					name: string
					updated_at: string
				}
				Insert: {
					basic_salary: number
					created_at?: string
					epf_employer: number
					id?: string
					lindung_24_jam?: boolean
					name: string
					updated_at?: string
				}
				Update: {
					basic_salary?: number
					created_at?: string
					epf_employer?: number
					id?: string
					lindung_24_jam?: boolean
					name?: string
					updated_at?: string
				}
				Relationships: []
			}
			payroll_run_items: {
				Row: {
					basic_salary: number
					cp38: number
					created_at: string
					eis_employee: number
					eis_employer: number
					employee_id: string | null
					employee_name: string
					epf_employee: number
					epf_employer: number
					id: string
					lindung_24_jam: number
					net_salary: number
					pcb: number
					run_id: string
					socso_employee: number
					socso_employer: number
					updated_at: string
				}
				Insert: {
					basic_salary?: number
					cp38?: number
					created_at?: string
					eis_employee?: number
					eis_employer?: number
					employee_id?: string | null
					employee_name: string
					epf_employee?: number
					epf_employer?: number
					id?: string
					lindung_24_jam?: number
					net_salary?: number
					pcb?: number
					run_id: string
					socso_employee?: number
					socso_employer?: number
					updated_at?: string
				}
				Update: {
					basic_salary?: number
					cp38?: number
					created_at?: string
					eis_employee?: number
					eis_employer?: number
					employee_id?: string | null
					employee_name?: string
					epf_employee?: number
					epf_employer?: number
					id?: string
					lindung_24_jam?: number
					net_salary?: number
					pcb?: number
					run_id?: string
					socso_employee?: number
					socso_employer?: number
					updated_at?: string
				}
				Relationships: [
					{
						foreignKeyName: 'payroll_run_items_run_id_fkey'
						columns: ['run_id']
						isOneToOne: false
						referencedRelation: 'payroll_runs'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'payroll_run_items_employee_id_fkey'
						columns: ['employee_id']
						isOneToOne: false
						referencedRelation: 'payroll'
						referencedColumns: ['id']
					},
				]
			}
			payroll_runs: {
				Row: {
					created_at: string
					finalized_at: string
					id: string
					month: number
					updated_at: string
					year: number
				}
				Insert: {
					created_at?: string
					finalized_at?: string
					id?: string
					month: number
					updated_at?: string
					year: number
				}
				Update: {
					created_at?: string
					finalized_at?: string
					id?: string
					month?: number
					updated_at?: string
					year?: number
				}
				Relationships: []
			}
			stock_batches: {
				Row: {
					created_at: string
					expiry_date: string | null
					id: string
					item_id: string
					quantity: number
					updated_at: string
				}
				Insert: {
					created_at?: string
					expiry_date?: string | null
					id?: string
					item_id: string
					quantity?: number
					updated_at?: string
				}
				Update: {
					created_at?: string
					expiry_date?: string | null
					id?: string
					item_id?: string
					quantity?: number
					updated_at?: string
				}
				Relationships: [
					{
						foreignKeyName: 'stock_batches_item_id_fkey'
						columns: ['item_id']
						isOneToOne: false
						referencedRelation: 'inventory'
						referencedColumns: ['id']
					},
				]
			}
			stock_movements: {
				Row: {
					batch_id: string | null
					created_at: string
					expiry_date: string | null
					id: string
					item_id: string
					item_name: string
					movement_type: string
					quantity: number
					remark: string
					updated_at: string
				}
				Insert: {
					batch_id?: string | null
					created_at?: string
					expiry_date?: string | null
					id?: string
					item_id?: string
					item_name: string
					movement_type: string
					quantity: number
					remark?: string
					updated_at?: string
				}
				Update: {
					batch_id?: string | null
					created_at?: string
					expiry_date?: string | null
					id?: string
					item_id?: string
					item_name?: string
					movement_type?: string
					quantity?: number
					remark?: string
					updated_at?: string
				}
				Relationships: [
					{
						foreignKeyName: 'stock_movements_batch_id_fkey'
						columns: ['batch_id']
						isOneToOne: false
						referencedRelation: 'stock_batches'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'stock_movements_item_id_fkey'
						columns: ['item_id']
						isOneToOne: false
						referencedRelation: 'inventory'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'stock_movements_item_name_fkey'
						columns: ['item_name']
						isOneToOne: false
						referencedRelation: 'inventory'
						referencedColumns: ['item_name']
					},
				]
			}
			stock_requests: {
				Row: {
					created_at: string
					id: string
					item_id: string
					item_name: string
					quantity: number
					remark: string | null
					status: string
					updated_at: string
				}
				Insert: {
					created_at?: string
					id?: string
					item_id?: string
					item_name: string
					quantity: number
					remark?: string | null
					status: string
					updated_at?: string
				}
				Update: {
					created_at?: string
					id?: string
					item_id?: string
					item_name?: string
					quantity?: number
					remark?: string | null
					status?: string
					updated_at?: string
				}
				Relationships: [
					{
						foreignKeyName: 'stock_requests_item_id_fkey'
						columns: ['item_id']
						isOneToOne: false
						referencedRelation: 'inventory'
						referencedColumns: ['id']
					},
					{
						foreignKeyName: 'stock_requests_item_name_fkey'
						columns: ['item_name']
						isOneToOne: false
						referencedRelation: 'inventory'
						referencedColumns: ['item_name']
					},
				]
			}
		}
		Views: {
			[_ in never]: never
		}
		Functions: {
			save_payroll_run: {
				Args: { p_items: Json; p_month: number; p_year: number }
				Returns: {
					created_at: string
					finalized_at: string
					id: string
					month: number
					updated_at: string
					year: number
				}
			}
			stock_in: {
				Args: {
					p_clear_order_date?: boolean
					p_expiry_date?: string | null
					p_item_id: string
					p_not_track?: boolean | null
					p_quantity: number
					p_remark?: string
				}
				Returns: {
					back_order: boolean
					created_at: string
					id: string
					is_pinned: boolean
					item_name: string
					non_order_reason: string | null
					not_track: boolean
					order_date: string | null
					quantity: number
					remark: string
					reorder_level: number
					unit: string
					updated_at: string
				}[]
				SetofOptions: {
					from: '*'
					to: 'inventory'
					isOneToOne: false
					isSetofReturn: true
				}
			}
			stock_out: {
				Args: { p_item_id: string; p_quantity: number; p_remark?: string }
				Returns: {
					back_order: boolean
					created_at: string
					id: string
					is_pinned: boolean
					item_name: string
					non_order_reason: string | null
					not_track: boolean
					order_date: string | null
					quantity: number
					remark: string
					reorder_level: number
					unit: string
					updated_at: string
				}[]
				SetofOptions: {
					from: '*'
					to: 'inventory'
					isOneToOne: false
					isSetofReturn: true
				}
			}
			update_stock_batch: {
				Args: {
					p_batch_id: string
					p_expiry_date?: string | null
					p_quantity: number
					p_remark?: string
				}
				Returns: {
					back_order: boolean
					created_at: string
					id: string
					is_pinned: boolean
					item_name: string
					non_order_reason: string | null
					not_track: boolean
					order_date: string | null
					quantity: number
					remark: string
					reorder_level: number
					unit: string
					updated_at: string
				}[]
				SetofOptions: {
					from: '*'
					to: 'inventory'
					isOneToOne: false
					isSetofReturn: true
				}
			}
		}
		Enums: {
			[_ in never]: never
		}
		CompositeTypes: {
			[_ in never]: never
		}
	}
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never) = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R
			}
			? R
			: never
		: never

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I
			}
			? I
			: never
		: never

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
	TableName extends (DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never) = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U
			}
			? U
			: never
		: never

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
	EnumName extends (DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never) = never,
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never

export const Constants = {
	public: {
		Enums: {},
	},
} as const

// stores/inventory.ts
import { supabase } from '$lib/supabase'
import type { Database } from '$lib/types/database.types'
import type { InventoryItem, NewInventoryItem } from '$lib/types/inventory'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { stockMovementsStore } from './stockMovements.svelte'

class InventoryStore {
  // State
  items = $state<InventoryItem[]>([])
  #loadingCount = $state(0)
  error = $state<string | null>(null)
  #channel: RealtimeChannel | null = null
  #isInitialized = false

  get loading(): boolean {
    return this.#loadingCount > 0
  }

  // Getters (computed)
  get totalItems(): number {
    return this.items
      .filter((item) => !item.not_track)
      .reduce((sum, item) => sum + item.quantity, 0)
  }

  get totalProducts(): number {
    return this.items.filter((item) => !item.not_track).length
  }

  get lowStockItems(): InventoryItem[] {
    return this.items.filter(
      (item) => !item.not_track && item.quantity <= item.reorder_level && item.quantity !== 0,
    )
  }

  get outOfStockItems(): InventoryItem[] {
    return this.items.filter(
      (item) => !item.not_track && item.quantity === 0 && item.reorder_level !== -1,
    )
  }

  // Actions
  fetchItems = async (): Promise<void> => {
    this.#loadingCount++
    this.error = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('inventory')
        .select('*')
        .order('item_name', { ascending: true })

      if (supabaseError) throw supabaseError
      this.items = data || []
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'An error occurred while fetching items'
      console.error('Error fetching items:', err)
    } finally {
      this.#loadingCount--
    }
  }

  addItem = async (newItem: NewInventoryItem): Promise<void> => {
    this.#loadingCount++
    this.error = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('inventory')
        .insert([
          {
            item_name: newItem.item_name,
            quantity: Math.max(0, newItem.quantity),
            reorder_level: Math.max(-1, newItem.reorder_level),
            unit: newItem.unit,
            remark: newItem.remark || '',
            order_date: newItem.order_date || null,
            non_order_reason: newItem.non_order_reason || null,
            back_order: false,
            not_track: newItem.not_track || false,
          },
        ])
        .select()
        .single()

      if (supabaseError) throw supabaseError

      if (data) {
        // Optimistic local update (dedup check in realtime handler)
        const exists = this.items.some((i) => i.id === data.id)
        if (!exists) {
          this.items.push(data)
          this.items.sort((a, b) => a.item_name.localeCompare(b.item_name))
        }

        // Log initial stock if quantity is greater than 0
        if (data.quantity > 0) {
          stockMovementsStore.addMovement({
            item_id: data.id,
            item_name: data.item_name,
            quantity: data.quantity,
            movement_type: 'stock_in',
            remark: 'Initial stock',
          })
        }
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'An error occurred while adding item'
      console.error('Error adding item:', err)
    } finally {
      this.#loadingCount--
    }
  }

  // Stock In - Atomic RPC: increments quantity server-side
  stockIn = async (
    itemId: string,
    quantity: number,
    clearOrderDate: boolean = true,
    notTrackStatus?: boolean,
  ): Promise<void> => {
    this.#loadingCount++
    this.error = null
    try {
      const item = this.items.find((item) => item.id === itemId)
      if (!item) throw new Error('Item not found')

      const rpcArgs: {
        p_item_id: string
        p_quantity: number
        p_clear_order_date: boolean
        p_not_track?: boolean
      } = {
        p_item_id: itemId,
        p_quantity: Math.max(0, quantity),
        p_clear_order_date: clearOrderDate,
      }
      if (notTrackStatus !== undefined) {
        rpcArgs.p_not_track = notTrackStatus
      }

      const { data, error: rpcError } = await supabase.rpc('stock_in', rpcArgs).single()

      if (rpcError) throw rpcError

      // Optimistic local update with server-returned data
      if (data) {
        const index = this.items.findIndex((i) => i.id === itemId)
        if (index !== -1) this.items[index] = data as InventoryItem
      }

      // Log stock movement
      stockMovementsStore.addMovement({
        item_id: itemId,
        item_name: item.item_name,
        quantity: quantity,
        movement_type: 'stock_in',
      })
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'An error occurred while adding stock'
      console.error('Error adding stock:', err)
    } finally {
      this.#loadingCount--
    }
  }

  // Stock Out - Atomic RPC: decrements quantity server-side, clamped at 0
  stockOut = async (itemId: string, quantity: number, remark?: string): Promise<void> => {
    this.#loadingCount++
    this.error = null
    try {
      const item = this.items.find((item) => item.id === itemId)
      if (!item) throw new Error('Item not found')

      const { data, error: rpcError } = await supabase
        .rpc('stock_out', {
          p_item_id: itemId,
          p_quantity: Math.max(0, quantity),
        })
        .single()

      if (rpcError) throw rpcError

      // Optimistic local update with server-returned data
      if (data) {
        const index = this.items.findIndex((i) => i.id === itemId)
        if (index !== -1) this.items[index] = data as InventoryItem
      }

      // Log stock movement
      stockMovementsStore.addMovement({
        item_id: itemId,
        item_name: item.item_name,
        quantity: quantity,
        movement_type: 'stock_out',
        remark: remark || '',
      })
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'An error occurred while removing stock'
      console.error('Error removing stock:', err)
    } finally {
      this.#loadingCount--
    }
  }

  // Mark item as ordered
  markAsOrdered = async (
    itemId: string,
    orderDate?: string,
    backOrder?: boolean,
  ): Promise<void> => {
    this.#loadingCount++
    this.error = null
    try {
      const dateToUse = orderDate || new Date().toISOString()
      const { data, error: supabaseError } = await supabase
        .from('inventory')
        .update({
          order_date: dateToUse,
          non_order_reason: null,
          back_order: backOrder ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .select()
        .single()

      if (supabaseError) throw supabaseError

      // Optimistic local update
      if (data) {
        const index = this.items.findIndex((i) => i.id === itemId)
        if (index !== -1) this.items[index] = data as InventoryItem
      }
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : 'An error occurred while marking item as ordered'
      console.error('Error marking item as ordered:', err)
    } finally {
      this.#loadingCount--
    }
  }

  // Clear order date
  clearOrderDate = async (itemId: string): Promise<void> => {
    this.#loadingCount++
    this.error = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('inventory')
        .update({
          order_date: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .select()
        .single()

      if (supabaseError) throw supabaseError

      // Optimistic local update
      if (data) {
        const index = this.items.findIndex((i) => i.id === itemId)
        if (index !== -1) this.items[index] = data as InventoryItem
      }
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : 'An error occurred while clearing order date'
      console.error('Error clearing order date:', err)
    } finally {
      this.#loadingCount--
    }
  }

  // Set non-order reason (combined with not_track update when 'Alternative ordered')
  setNonOrderReason = async (itemId: string, reason: string | null): Promise<void> => {
    this.#loadingCount++
    this.error = null
    try {
      const updateData: Database['public']['Tables']['inventory']['Update'] = {
        non_order_reason: reason,
        order_date: null,
        updated_at: new Date().toISOString(),
      }

      if (reason === 'Alternative ordered') {
        updateData.not_track = true
      }

      const { data, error: supabaseError } = await supabase
        .from('inventory')
        .update(updateData)
        .eq('id', itemId)
        .select()
        .single()

      if (supabaseError) throw supabaseError

      // Optimistic local update
      if (data) {
        const index = this.items.findIndex((i) => i.id === itemId)
        if (index !== -1) this.items[index] = data as InventoryItem
      }
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : 'An error occurred while setting non-order reason'
      console.error('Error setting non-order reason:', err)
    } finally {
      this.#loadingCount--
    }
  }

  updateItem = async (itemId: string, item: Partial<InventoryItem>): Promise<void> => {
    this.#loadingCount++
    this.error = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('inventory')
        .update(item)
        .eq('id', itemId)
        .select()
        .single()

      if (supabaseError) throw supabaseError

      // Optimistic local update
      if (data) {
        const index = this.items.findIndex((i) => i.id === itemId)
        if (index !== -1) this.items[index] = data as InventoryItem
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'An error occurred while updating item'
      console.error('Error updating item:', err)
    } finally {
      this.#loadingCount--
    }
  }

  deleteItem = async (itemId: string): Promise<void> => {
    this.#loadingCount++
    this.error = null
    try {
      const { error: supabaseError } = await supabase.from('inventory').delete().eq('id', itemId)

      if (supabaseError) throw supabaseError

      // Optimistic local removal
      const index = this.items.findIndex((i) => i.id === itemId)
      if (index !== -1) this.items.splice(index, 1)
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'An error occurred while deleting item'
      console.error('Error deleting item:', err)
    } finally {
      this.#loadingCount--
    }
  }

  getItemById = (itemId: string): InventoryItem | undefined => {
    return this.items.find((item) => item.id === itemId)
  }

  searchItems = (query: string): InventoryItem[] => {
    if (!query) return this.items
    return this.items.filter((item) => item.item_name.toLowerCase().includes(query.toLowerCase()))
  }

  // Subscription lifecycle
  #startSubscription = () => {
    if (this.#channel) return // Already subscribed

    this.#channel = supabase
      .channel('update-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          // Dedup: skip if already added by optimistic update
          const exists = this.items.some((i) => i.id === payload.new.id)
          if (!exists) {
            this.items.push(payload.new as InventoryItem)
          }
        } else if (payload.eventType === 'UPDATE') {
          const index = this.items.findIndex((item) => item.id === payload.new.id)
          if (index !== -1) this.items[index] = payload.new as InventoryItem
        } else if (payload.eventType === 'DELETE') {
          const index = this.items.findIndex((item) => item.id === payload.old.id)
          if (index !== -1) this.items.splice(index, 1)
        }

        // Sort by item_name ascending
        this.items.sort((a, b) => a.item_name.localeCompare(b.item_name))
      })
      .subscribe()
  }

  // Initialize store by fetching items and starting subscription
  initializeStore = async (): Promise<void> => {
    if (this.#isInitialized) return
    this.#isInitialized = true
    await this.fetchItems()
    this.#startSubscription()
  }

  // Cleanup: unsubscribe and reset state
  cleanup = () => {
    if (this.#channel) {
      this.#channel.unsubscribe()
      this.#channel = null
    }
    this.items = []
    this.error = null
    this.#isInitialized = false
  }
}

export const inventoryStore = new InventoryStore()

// stores/inventory.ts
import { supabase } from '@/lib/supabase'
import type { InventoryItem, NewInventoryItem } from '@/types/inventory'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useStockMovementsStore } from './stockMovements'

export const useInventoryStore = defineStore('inventory', () => {
  // State
  const items = ref<InventoryItem[]>([])
  const loadingCount = ref(0)
  const loading = computed(() => loadingCount.value > 0)
  const error = ref<string | null>(null)
  let channel: RealtimeChannel | null = null
  let isInitialized = false

  // Getters (computed)
  const totalItems = computed((): number => {
    return items.value
      .filter((item) => !item.not_track)
      .reduce((sum, item) => sum + item.quantity, 0)
  })

  const totalProducts = computed((): number => {
    return items.value.filter((item) => !item.not_track).length
  })

  const lowStockItems = computed((): InventoryItem[] => {
    return items.value.filter(
      (item) => !item.not_track && item.quantity <= item.reorder_level && item.quantity !== 0,
    )
  })

  const outOfStockItems = computed((): InventoryItem[] => {
    return items.value.filter(
      (item) => !item.not_track && item.quantity === 0 && item.reorder_level !== -1,
    )
  })

  // Actions
  const fetchItems = async (): Promise<void> => {
    loadingCount.value++
    error.value = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('inventory')
        .select('*')
        .order('item_name', { ascending: true })

      if (supabaseError) throw supabaseError
      items.value = data || []
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while fetching items'
      console.error('Error fetching items:', err)
    } finally {
      loadingCount.value--
    }
  }

  const addItem = async (newItem: NewInventoryItem): Promise<void> => {
    loadingCount.value++
    error.value = null
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
        const exists = items.value.some((i) => i.id === data.id)
        if (!exists) {
          items.value.push(data)
          items.value.sort((a, b) => a.item_name.localeCompare(b.item_name))
        }

        // Log initial stock if quantity is greater than 0
        if (data.quantity > 0) {
          const stockMovementStore = useStockMovementsStore()
          stockMovementStore.addMovement({
            item_id: data.id,
            item_name: data.item_name,
            quantity: data.quantity,
            movement_type: 'stock_in',
            remark: 'Initial stock',
          })
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while adding item'
      console.error('Error adding item:', err)
    } finally {
      loadingCount.value--
    }
  }

  // Stock In - Atomic RPC: increments quantity server-side
  const stockIn = async (
    itemId: string,
    quantity: number,
    clearOrderDate: boolean = true,
    notTrackStatus?: boolean,
  ): Promise<void> => {
    loadingCount.value++
    error.value = null
    try {
      const item = items.value.find((item) => item.id === itemId)
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
        const index = items.value.findIndex((i) => i.id === itemId)
        if (index !== -1) items.value[index] = data as InventoryItem
      }

      // Log stock movement
      const stockMovementStore = useStockMovementsStore()
      stockMovementStore.addMovement({
        item_id: itemId,
        item_name: item.item_name,
        quantity: quantity,
        movement_type: 'stock_in',
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while adding stock'
      console.error('Error adding stock:', err)
    } finally {
      loadingCount.value--
    }
  }

  // Stock Out - Atomic RPC: decrements quantity server-side, clamped at 0
  const stockOut = async (itemId: string, quantity: number, remark?: string): Promise<void> => {
    loadingCount.value++
    error.value = null
    try {
      const item = items.value.find((item) => item.id === itemId)
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
        const index = items.value.findIndex((i) => i.id === itemId)
        if (index !== -1) items.value[index] = data as InventoryItem
      }

      // Log stock movement
      const stockMovementStore = useStockMovementsStore()
      stockMovementStore.addMovement({
        item_id: itemId,
        item_name: item.item_name,
        quantity: quantity,
        movement_type: 'stock_out',
        remark: remark || '',
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while removing stock'
      console.error('Error removing stock:', err)
    } finally {
      loadingCount.value--
    }
  }

  // Mark item as ordered
  const markAsOrdered = async (
    itemId: string,
    orderDate?: string,
    backOrder?: boolean,
  ): Promise<void> => {
    loadingCount.value++
    error.value = null
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
        const index = items.value.findIndex((i) => i.id === itemId)
        if (index !== -1) items.value[index] = data as InventoryItem
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'An error occurred while marking item as ordered'
      console.error('Error marking item as ordered:', err)
    } finally {
      loadingCount.value--
    }
  }

  // Clear order date
  const clearOrderDate = async (itemId: string): Promise<void> => {
    loadingCount.value++
    error.value = null
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
        const index = items.value.findIndex((i) => i.id === itemId)
        if (index !== -1) items.value[index] = data as InventoryItem
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'An error occurred while clearing order date'
      console.error('Error clearing order date:', err)
    } finally {
      loadingCount.value--
    }
  }

  // Set non-order reason (combined with not_track update when 'Alternative ordered')
  const setNonOrderReason = async (itemId: string, reason: string | null): Promise<void> => {
    loadingCount.value++
    error.value = null
    try {
      const updateData: Record<string, unknown> = {
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
        const index = items.value.findIndex((i) => i.id === itemId)
        if (index !== -1) items.value[index] = data as InventoryItem
      }
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'An error occurred while setting non-order reason'
      console.error('Error setting non-order reason:', err)
    } finally {
      loadingCount.value--
    }
  }

  const updateItem = async (itemId: string, item: Partial<InventoryItem>): Promise<void> => {
    loadingCount.value++
    error.value = null
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
        const index = items.value.findIndex((i) => i.id === itemId)
        if (index !== -1) items.value[index] = data as InventoryItem
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while updating item'
      console.error('Error updating item:', err)
    } finally {
      loadingCount.value--
    }
  }

  const deleteItem = async (itemId: string): Promise<void> => {
    loadingCount.value++
    error.value = null
    try {
      const { error: supabaseError } = await supabase.from('inventory').delete().eq('id', itemId)

      if (supabaseError) throw supabaseError

      // Optimistic local removal
      const index = items.value.findIndex((i) => i.id === itemId)
      if (index !== -1) items.value.splice(index, 1)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while deleting item'
      console.error('Error deleting item:', err)
    } finally {
      loadingCount.value--
    }
  }

  const getItemById = (itemId: string): InventoryItem | undefined => {
    return items.value.find((item) => item.id === itemId)
  }

  const searchItems = (query: string): InventoryItem[] => {
    if (!query) return items.value
    return items.value.filter((item) => item.item_name.toLowerCase().includes(query.toLowerCase()))
  }

  // Subscription lifecycle
  const startSubscription = () => {
    if (channel) return // Already subscribed

    channel = supabase
      .channel('update-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          // Dedup: skip if already added by optimistic update
          const exists = items.value.some((i) => i.id === payload.new.id)
          if (!exists) {
            items.value.push(payload.new as InventoryItem)
          }
        } else if (payload.eventType === 'UPDATE') {
          const index = items.value.findIndex((item) => item.id === payload.new.id)
          if (index !== -1) items.value[index] = payload.new as InventoryItem
        } else if (payload.eventType === 'DELETE') {
          const index = items.value.findIndex((item) => item.id === payload.old.id)
          if (index !== -1) items.value.splice(index, 1)
        }

        // Sort by item_name ascending
        items.value.sort((a, b) => a.item_name.localeCompare(b.item_name))
      })
      .subscribe()
  }

  // Initialize store by fetching items and starting subscription
  const initializeStore = async (): Promise<void> => {
    if (isInitialized) return
    isInitialized = true
    await fetchItems()
    startSubscription()
  }

  // Cleanup: unsubscribe and reset state
  const cleanup = () => {
    if (channel) {
      channel.unsubscribe()
      channel = null
    }
    items.value = []
    error.value = null
    isInitialized = false
  }

  return {
    // State
    items,
    loading,
    error,

    // Getters
    totalItems,
    totalProducts,
    lowStockItems,
    outOfStockItems,

    // Actions
    fetchItems,
    addItem,
    stockIn,
    stockOut,
    markAsOrdered,
    clearOrderDate,
    setNonOrderReason,
    updateItem,
    deleteItem,
    getItemById,
    searchItems,
    initializeStore,
    cleanup,
  }
})

// stores/inventory.ts
import { supabase } from '@/lib/supabase'
import type { InventoryItem, NewInventoryItem } from '@/types/inventory'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useStockMovementsStore } from './stockMovements'

export const useInventoryStore = defineStore('inventory', () => {
  // State
  const items = ref<InventoryItem[]>([])
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)

  // Getters (computed)
  const totalItems = computed((): number => {
    return items.value.reduce((sum, item) => sum + item.quantity, 0)
  })

  const totalProducts = computed((): number => {
    return items.value.length
  })

  const lowStockItems = computed((): InventoryItem[] => {
    return items.value.filter((item) => item.quantity <= item.low_stock_notice_quantity)
  })

  const outOfStockItems = computed((): InventoryItem[] => {
    return items.value.filter((item) => item.quantity === 0)
  })

  // Actions
  const fetchItems = async (): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('inventory')
        .select('*')
        .order('item_name', { ascending: true })

      if (supabaseError) throw supabaseError
      console.log('Data:', data)
      items.value = data || []
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while fetching items'
      console.error('Error fetching items:', err)
    } finally {
      loading.value = false
    }
  }

  const addItem = async (newItem: NewInventoryItem): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('inventory')
        .insert([
          {
            item_name: newItem.item_name,
            quantity: Math.max(0, newItem.quantity),
            low_stock_notice_quantity: Math.max(0, newItem.low_stock_notice_quantity),
          },
        ])
        .select()
        .single()

      if (supabaseError) throw supabaseError
      if (data) {
        items.value.unshift(data)

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
      loading.value = false
    }
  }

  // Stock In - Add to existing quantity
  const stockIn = async (itemId: string, quantity: number): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const item = items.value.find((item) => item.id === itemId)
      if (!item) throw new Error('Item not found')

      const newQuantity = item.quantity + Math.max(0, quantity)

      const { data, error: supabaseError } = await supabase
        .from('inventory')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .select()
        .single()

      if (supabaseError) throw supabaseError

      // Update local state
      if (data) {
        Object.assign(item, data)

        // Log stock movement
        const stockMovementStore = useStockMovementsStore()
        stockMovementStore.addMovement({
          item_id: itemId,
          item_name: item.item_name,
          quantity: quantity,
          movement_type: 'stock_in',
        })
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while adding stock'
      console.error('Error adding stock:', err)
    } finally {
      loading.value = false
    }
  }

  // Stock Out - Subtract from existing quantity
  const stockOut = async (itemId: string, quantity: number): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const item = items.value.find((item) => item.id === itemId)
      if (!item) throw new Error('Item not found')

      const quantityToRemove = Math.max(0, quantity)
      const newQuantity = Math.max(0, item.quantity - quantityToRemove)

      const { data, error: supabaseError } = await supabase
        .from('inventory')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
        .select()
        .single()

      if (supabaseError) throw supabaseError

      // Update local state
      if (data) {
        Object.assign(item, data)

        // Log stock movement
        const stockMovementStore = useStockMovementsStore()
        stockMovementStore.addMovement({
          item_id: itemId,
          item_name: item.item_name,
          quantity: quantity,
          movement_type: 'stock_out',
        })
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while removing stock'
      console.error('Error removing stock:', err)
    } finally {
      loading.value = false
    }
  }

  const deleteItem = async (itemId: string): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const { error: supabaseError } = await supabase.from('inventory').delete().eq('id', itemId)

      if (supabaseError) throw supabaseError

      // Remove from local state
      const index = items.value.findIndex((item) => item.id === itemId)
      if (index > -1) {
        items.value.splice(index, 1)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while deleting item'
      console.error('Error deleting item:', err)
    } finally {
      loading.value = false
    }
  }

  const getItemById = (itemId: string): InventoryItem | undefined => {
    return items.value.find((item) => item.id === itemId)
  }

  const searchItems = (query: string): InventoryItem[] => {
    if (!query) return items.value
    return items.value.filter((item) => item.item_name.toLowerCase().includes(query.toLowerCase()))
  }

  // Initialize store by fetching items
  const initializeStore = async (): Promise<void> => {
    await fetchItems()
  }

  // Event listener for real-time updates
  supabase
    .channel('update-inventory')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
      if (payload.eventType === 'UPDATE') {
        const index = items.value.findIndex(item => item.id === payload.new.id)
        if (index !== -1) items.value[index] = payload.new as InventoryItem
      }

      // Sort by item_name ascending
      items.value.sort((a, b) => a.item_name.localeCompare(b.item_name))
    })
    .subscribe()

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
    deleteItem,
    getItemById,
    searchItems,
    initializeStore,
  }
})

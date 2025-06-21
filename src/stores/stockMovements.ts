import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { StockMovement, NewStockMovement } from '@/types/stockMovement'

export const useStockMovementsStore = defineStore('stockMovements', () => {
  // State
  const movements = ref<StockMovement[]>([])
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)

  // Actions
  const fetchMovements = async (): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false })

      if (supabaseError) throw supabaseError
      movements.value = data || []
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while fetching movements'
      console.error('Error fetching movements:', err)
    } finally {
      loading.value = false
    }
  }

  const addMovement = async (movement: NewStockMovement): Promise<void> => {
    try {
      const { error: supabaseError } = await supabase
        .from('stock_movements')
        .insert([{
          item_id: movement.item_id,
          item_name: movement.item_name,
          quantity: movement.quantity,
          movement_type: movement.movement_type,
          remark: movement.remark || ''
        }])

      if (supabaseError) throw supabaseError
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while adding movement'
      console.error('Error adding movement:', err)
    }
  }

  const updateRemark = async (movementId: string, newRemark: string): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const { error: supabaseError } = await supabase
        .from('stock_movements')
        .update({
          remark: newRemark,
          updated_at: new Date().toISOString()
        })
        .eq('id', movementId)

      if (supabaseError) throw supabaseError
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while updating remark'
      console.error('Error updating remark:', err)
    } finally {
      loading.value = false
    }
  }



  const searchMovements = (query: string): StockMovement[] => {
    if (!query) return movements.value
    return movements.value.filter(movement =>
      movement.item_name.toLowerCase().includes(query.toLowerCase())
    )
  }

  const initializeStore = async (): Promise<void> => {
    await fetchMovements()
  }

  supabase
    .channel('update-stock-movements')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, (payload) => {
      if (payload.eventType === 'INSERT') {
        movements.value.unshift(payload.new as StockMovement)
      } else if (payload.eventType === 'UPDATE') {
        const index = movements.value.findIndex(m => m.id === payload.new.id)
        if (index !== -1) movements.value[index] = payload.new as StockMovement
      } else if (payload.eventType === 'DELETE') {
        const index = movements.value.findIndex(m => m.id === payload.old.id)
        if (index !== -1) movements.value.splice(index, 1)
      }

      // Sort by created_at descending
      movements.value.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    })
    .subscribe()

  return {
    // State
    movements,
    loading,
    error,

    // Actions
    fetchMovements,
    addMovement,
    updateRemark,
    searchMovements,
    initializeStore
  }
})

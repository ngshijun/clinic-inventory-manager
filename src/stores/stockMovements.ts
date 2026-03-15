import { supabase } from '@/lib/supabase'
import type { NewStockMovement, StockMovement } from '@/types/stockMovements'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useStockMovementsStore = defineStore('stockMovements', () => {
  // State
  const movements = ref<StockMovement[]>([])
  const loadingCount = ref(0)
  const loading = computed(() => loadingCount.value > 0)
  const error = ref<string | null>(null)
  const unitCache = ref<Record<string, string | null>>({})
  let channel: RealtimeChannel | null = null
  let isInitialized = false

  // Helper function to get unit for an item (with caching)
  const getUnitForItem = async (itemId: string): Promise<string | null> => {
    // Check cache first
    if (unitCache.value[itemId] !== undefined) {
      return unitCache.value[itemId]
    }

    const { data, error } = await supabase
      .from('inventory')
      .select('unit')
      .eq('id', itemId)
      .single()

    const unit = error ? null : data?.unit || null
    // Cache the result
    unitCache.value[itemId] = unit
    return unit
  }

  // Actions
  const fetchMovements = async (): Promise<void> => {
    loadingCount.value++
    error.value = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('stock_movements')
        .select('*, inventory!stock_movements_item_id_fkey(unit)')
        .order('created_at', { ascending: false })

      if (supabaseError) throw supabaseError

      const transformedData: StockMovement[] = data?.map((item) => ({
        ...item,
        unit: item.inventory?.unit || '',
      }))
      movements.value = transformedData || []

      // Populate unit cache from fetched data
      transformedData?.forEach((movement) => {
        if (movement.item_id) {
          unitCache.value[movement.item_id] = movement.unit
        }
      })
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'An error occurred while fetching movements'
      console.error('Error fetching movements:', err)
    } finally {
      loadingCount.value--
    }
  }

  const addMovement = async (movement: NewStockMovement): Promise<void> => {
    try {
      const { error: supabaseError } = await supabase.from('stock_movements').insert([
        {
          item_id: movement.item_id,
          item_name: movement.item_name,
          quantity: movement.quantity,
          movement_type: movement.movement_type,
          remark: movement.remark || '',
        },
      ])

      if (supabaseError) throw supabaseError
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while adding movement'
      console.error('Error adding movement:', err)
    }
  }

  const updateRemark = async (movementId: string, newRemark: string): Promise<void> => {
    loadingCount.value++
    error.value = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('stock_movements')
        .update({
          remark: newRemark,
          updated_at: new Date().toISOString(),
        })
        .eq('id', movementId)
        .select()
        .single()

      if (supabaseError) throw supabaseError

      // Optimistic local update
      if (data) {
        const index = movements.value.findIndex((m) => m.id === movementId)
        if (index !== -1) {
          movements.value[index] = { ...movements.value[index], ...data }
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while updating remark'
      console.error('Error updating remark:', err)
    } finally {
      loadingCount.value--
    }
  }

  const searchMovements = (query: string): StockMovement[] => {
    if (!query) return movements.value
    return movements.value.filter((movement) =>
      movement.item_name.toLowerCase().includes(query.toLowerCase()),
    )
  }

  // Subscription lifecycle
  const startSubscription = () => {
    if (channel) return

    channel = supabase
      .channel('update-stock-movements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_movements' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Dedup: skip if already in local state
            const exists = movements.value.some((m) => m.id === payload.new.id)
            if (!exists) {
              const unit = await getUnitForItem(payload.new.item_id)
              const newMovement: StockMovement = {
                ...payload.new,
                unit,
              } as StockMovement
              movements.value.unshift(newMovement as StockMovement)
            }
          } else if (payload.eventType === 'UPDATE') {
            const index = movements.value.findIndex((m) => m.id === payload.new.id)
            if (index !== -1) {
              const data: StockMovement = {
                id: payload.new.id,
                item_id: payload.new.item_id,
                item_name: payload.new.item_name,
                quantity: payload.new.quantity,
                movement_type: payload.new.movement_type,
                remark: payload.new.remark,
                unit: movements.value[index].unit,
                created_at: payload.new.created_at,
                updated_at: payload.new.updated_at,
              }
              movements.value[index] = data as StockMovement
            }
          } else if (payload.eventType === 'DELETE') {
            const index = movements.value.findIndex((m) => m.id === payload.old.id)
            if (index !== -1) movements.value.splice(index, 1)
          }

          // Sort by created_at descending
          movements.value.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )
        },
      )
      .subscribe()
  }

  const initializeStore = async (): Promise<void> => {
    if (isInitialized) return
    isInitialized = true
    await fetchMovements()
    startSubscription()
  }

  const cleanup = () => {
    if (channel) {
      channel.unsubscribe()
      channel = null
    }
    movements.value = []
    unitCache.value = {}
    error.value = null
    isInitialized = false
  }

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
    initializeStore,
    cleanup,
  }
})

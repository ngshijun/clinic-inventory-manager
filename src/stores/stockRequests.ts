import { supabase } from '@/lib/supabase'
import type { NewStockRequest, StockRequest } from '@/types/stockRequests'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useInventoryStore } from './inventory'

export const useStockRequestsStore = defineStore('stockRequests', () => {
  // State
  const requests = ref<StockRequest[]>([])
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
  const fetchRequests = async (): Promise<void> => {
    loadingCount.value++
    error.value = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('stock_requests')
        .select('*, inventory!stock_requests_item_id_fkey(unit)')
        .order('created_at', { ascending: false })

      if (supabaseError) throw supabaseError

      const transformedData: StockRequest[] = data?.map((item) => ({
        ...item,
        unit: item.inventory?.unit || '',
      }))
      requests.value = transformedData || []

      // Populate unit cache from fetched data
      transformedData?.forEach((request) => {
        if (request.item_id) {
          unitCache.value[request.item_id] = request.unit
        }
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while fetching requests'
      console.error('Error fetching requests:', err)
    } finally {
      loadingCount.value--
    }
  }

  const addRequest = async (request: NewStockRequest): Promise<void> => {
    loadingCount.value++
    error.value = null
    try {
      const { error: supabaseError } = await supabase.from('stock_requests').insert([
        {
          item_id: request.item_id,
          item_name: request.item_name,
          quantity: request.quantity,
          remark: request.remark || '',
          status: 'Pending',
        },
      ])

      if (supabaseError) throw supabaseError
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while adding request'
      console.error('Error adding request:', err)
    } finally {
      loadingCount.value--
    }
  }

  const removeRequest = async (requestId: string): Promise<void> => {
    loadingCount.value++
    error.value = null
    try {
      const { error: supabaseError } = await supabase
        .from('stock_requests')
        .delete()
        .eq('id', requestId)

      if (supabaseError) throw supabaseError

      // Optimistic local removal
      const index = requests.value.findIndex((r) => r.id === requestId)
      if (index !== -1) requests.value.splice(index, 1)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while removing request'
      console.error('Error removing request:', err)
    } finally {
      loadingCount.value--
    }
  }

  const approveRequest = async (requestId: string): Promise<void> => {
    loadingCount.value++
    error.value = null

    try {
      const item = requests.value.find((request) => request.id === requestId)
      if (!item) throw new Error('Item not found')

      const { data, error: supabaseError } = await supabase
        .from('stock_requests')
        .update({
          status: 'Approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single()

      if (supabaseError) throw supabaseError

      // Optimistic local update
      if (data) {
        const index = requests.value.findIndex((r) => r.id === requestId)
        if (index !== -1) {
          requests.value[index] = { ...requests.value[index], ...data }
        }
      }

      // Await stockOut to ensure inventory is deducted before continuing
      const inventoryStore = useInventoryStore()
      await inventoryStore.stockOut(item.item_id, item.quantity, 'Stock Request')
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while approving request'
      console.error('Error approving request', err)
    } finally {
      loadingCount.value--
    }
  }

  const rejectRequest = async (requestId: string, remark?: string): Promise<void> => {
    loadingCount.value++
    error.value = null

    try {
      const { data, error: supabaseError } = await supabase
        .from('stock_requests')
        .update({
          status: 'Rejected',
          updated_at: new Date().toISOString(),
          remark: remark || '',
        })
        .eq('id', requestId)
        .select()
        .single()

      if (supabaseError) throw supabaseError

      // Optimistic local update
      if (data) {
        const index = requests.value.findIndex((r) => r.id === requestId)
        if (index !== -1) {
          requests.value[index] = { ...requests.value[index], ...data }
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while rejecting request'
      console.error('Error rejecting request', err)
    } finally {
      loadingCount.value--
    }
  }

  const updateRequest = async (
    requestId: string,
    newQuantity?: number,
    newRemark?: string,
  ): Promise<void> => {
    loadingCount.value++
    error.value = null

    try {
      const updateData: { [key: string]: string | number } = {
        updated_at: new Date().toISOString(),
      }

      if (newQuantity !== undefined) updateData.quantity = newQuantity
      if (newRemark !== undefined) updateData.remark = newRemark

      const { data, error: supabaseError } = await supabase
        .from('stock_requests')
        .update(updateData)
        .eq('id', requestId)
        .select()
        .single()

      if (supabaseError) throw supabaseError

      // Optimistic local update
      if (data) {
        const index = requests.value.findIndex((r) => r.id === requestId)
        if (index !== -1) {
          requests.value[index] = { ...requests.value[index], ...data }
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while updating request'
      console.error('Error updating request:', err)
    } finally {
      loadingCount.value--
    }
  }

  const searchRequests = (query: string): StockRequest[] => {
    if (!query) return requests.value
    return requests.value.filter(
      (request) =>
        request.item_name.toLowerCase().includes(query.toLowerCase()) ||
        request.item_id.toLowerCase().includes(query.toLowerCase()) ||
        request.remark?.toLowerCase().includes(query.toLowerCase()),
    )
  }

  const filterRequestsByStatus = (status: string): StockRequest[] => {
    if (!status) return requests.value
    return requests.value.filter((request) => request.status === status)
  }

  const filterRequestsByDate = (date: string): StockRequest[] => {
    if (!date) return requests.value
    const filterDate = new Date(date)
    return requests.value.filter((request) => {
      const requestDate = new Date(request.created_at)
      return requestDate.toDateString() === filterDate.toDateString()
    })
  }

  const getPendingRequests = (): StockRequest[] => {
    return requests.value.filter((request) => request.status === 'Pending')
  }

  // Subscription lifecycle
  const startSubscription = () => {
    if (channel) return

    channel = supabase
      .channel('update-stock-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_requests' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Dedup: skip if already in local state
            const exists = requests.value.some((r) => r.id === payload.new.id)
            if (!exists) {
              const unit = await getUnitForItem(payload.new.item_id)
              const newRequest: StockRequest = {
                ...payload.new,
                unit: unit || '',
              } as StockRequest
              requests.value.unshift(newRequest)
            }
          } else if (payload.eventType === 'UPDATE') {
            const index = requests.value.findIndex((r) => r.id === payload.new.id)
            if (index !== -1) {
              const data: StockRequest = {
                id: payload.new.id,
                item_id: payload.new.item_id,
                item_name: payload.new.item_name,
                quantity: payload.new.quantity,
                remark: payload.new.remark,
                status: payload.new.status,
                unit: requests.value[index]?.unit || '',
                created_at: payload.new.created_at,
                updated_at: payload.new.updated_at,
              }
              requests.value[index] = data
            }
          } else if (payload.eventType === 'DELETE') {
            const index = requests.value.findIndex((r) => r.id === payload.old.id)
            if (index !== -1) requests.value.splice(index, 1)
          }

          // Sort by created_at descending
          requests.value.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )
        },
      )
      .subscribe()
  }

  const initializeStore = async (): Promise<void> => {
    if (isInitialized) return
    isInitialized = true
    await fetchRequests()
    startSubscription()
  }

  const cleanup = () => {
    if (channel) {
      channel.unsubscribe()
      channel = null
    }
    requests.value = []
    unitCache.value = {}
    error.value = null
    isInitialized = false
  }

  return {
    // State
    requests,
    loading,
    error,

    // Actions
    fetchRequests,
    addRequest,
    removeRequest,
    approveRequest,
    rejectRequest,
    updateRequest,
    searchRequests,
    filterRequestsByStatus,
    filterRequestsByDate,
    getPendingRequests,
    initializeStore,
    cleanup,
  }
})

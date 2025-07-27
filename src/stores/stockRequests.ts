import { supabase } from '@/lib/supabase'
import type { NewStockRequest, StockRequest } from '@/types/stockRequests'
import { defineStore } from 'pinia'
import { onUnmounted, ref } from 'vue'
import { useInventoryStore } from './inventory'

export const useStockRequestsStore = defineStore('stockRequests', () => {
  // State
  const requests = ref<StockRequest[]>([])
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const unitCache = ref<Record<string, string | null>>({})

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
    loading.value = true
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
      loading.value = false
    }
  }

  const addRequest = async (request: NewStockRequest): Promise<void> => {
    loading.value = true
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
      loading.value = false
    }
  }

  const removeRequest = async (requestId: string): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const { error: supabaseError } = await supabase
        .from('stock_requests')
        .delete()
        .eq('id', requestId)

      if (supabaseError) throw supabaseError
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while removing request'
      console.error('Error removing request:', err)
    } finally {
      loading.value = false
    }
  }

  const approveRequest = async (requestId: string): Promise<void> => {
    loading.value = true
    error.value = null

    const item = requests.value.find((request) => request.id === requestId)
    if (!item) throw new Error('Item not found')

    try {
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

      if (data) {
        const inventoryStore = useInventoryStore()
        inventoryStore.stockOut(item.item_id, item.quantity)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while approving request'
      console.error('Error approving request', err)
    } finally {
      loading.value = false
    }
  }

  const cancelRequest = async (requestId: string, remark?: string): Promise<void> => {
    loading.value = true
    error.value = null

    try {
      const { error: supabaseError } = await supabase
        .from('stock_requests')
        .update({
          status: 'Cancelled',
          updated_at: new Date().toISOString(),
          remark: remark || '',
        })
        .eq('id', requestId)

      if (supabaseError) throw supabaseError
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'An error occurred while cancelling request'
      console.error('Error cancelling request', err)
    } finally {
      loading.value = false
    }
  }

  const updateRequest = async (
    requestId: string,
    newQuantity?: number,
    newRemark?: string,
  ): Promise<void> => {
    loading.value = true
    error.value = null

    try {
      const updateData: { [key: string]: string | number } = {
        updated_at: new Date().toISOString(),
      }

      if (newQuantity !== undefined) updateData.quantity = newQuantity
      if (newRemark !== undefined) updateData.remark = newRemark

      const { error: supabaseError } = await supabase
        .from('stock_requests')
        .update(updateData)
        .eq('id', requestId)

      if (supabaseError) throw supabaseError
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An error occurred while updating request'
      console.error('Error updating request:', err)
    } finally {
      loading.value = false
    }
  }

  const searchRequests = (query: string): StockRequest[] => {
    if (!query) return requests.value
    return requests.value.filter(
      (request) =>
        request.item_name.toLowerCase().includes(query.toLowerCase()) ||
        request.item_id.toLowerCase().includes(query.toLowerCase()) ||
        request.remark.toLowerCase().includes(query.toLowerCase()),
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

  const initializeStore = async (): Promise<void> => {
    await fetchRequests()
  }

  // Real-time subscription
  const channel = supabase
    .channel('update-stock-requests')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'stock_requests' },
      async (payload) => {
        if (payload.eventType === 'INSERT') {
          // Get unit data for the new request (uses cache with fallback)
          const unit = await getUnitForItem(payload.new.item_id)
          const newRequest: StockRequest = {
            ...payload.new,
            unit: unit || '',
          } as StockRequest
          requests.value.unshift(newRequest)
        } else if (payload.eventType === 'UPDATE') {
          const index = requests.value.findIndex((r) => r.id === payload.new.id)
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
          if (index !== -1) requests.value[index] = data
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

  onUnmounted(() => {
    channel.unsubscribe()
  })

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
    cancelRequest,
    updateRequest,
    searchRequests,
    filterRequestsByStatus,
    filterRequestsByDate,
    getPendingRequests,
    initializeStore,
  }
})

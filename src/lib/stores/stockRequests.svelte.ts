import { supabase } from '$lib/supabase'
import type { NewStockRequest, StockRequest } from '$lib/types/stockRequests'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { inventoryStore } from './inventory.svelte'

class StockRequestsStore {
	// State
	requests = $state<StockRequest[]>([])
	#loadingCount = $state(0)
	error = $state<string | null>(null)
	#unitCache = $state<Record<string, string | null>>({})
	#channel: RealtimeChannel | null = null
	#isInitialized = false

	get loading(): boolean {
		return this.#loadingCount > 0
	}

	// Helper function to get unit for an item (with caching)
	#getUnitForItem = async (itemId: string): Promise<string | null> => {
		// Check cache first
		if (this.#unitCache[itemId] !== undefined) {
			return this.#unitCache[itemId]
		}

		const { data, error } = await supabase
			.from('inventory')
			.select('unit')
			.eq('id', itemId)
			.single()

		const unit = error ? null : data?.unit || null
		// Cache the result
		this.#unitCache[itemId] = unit
		return unit
	}

	// Actions
	fetchRequests = async (): Promise<void> => {
		this.#loadingCount++
		this.error = null
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
			this.requests = transformedData || []

			// Populate unit cache from fetched data
			transformedData?.forEach((request) => {
				if (request.item_id) {
					this.#unitCache[request.item_id] = request.unit
				}
			})
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'An error occurred while fetching requests'
			console.error('Error fetching requests:', err)
		} finally {
			this.#loadingCount--
		}
	}

	addRequest = async (request: NewStockRequest): Promise<void> => {
		this.#loadingCount++
		this.error = null
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
			this.error = err instanceof Error ? err.message : 'An error occurred while adding request'
			console.error('Error adding request:', err)
		} finally {
			this.#loadingCount--
		}
	}

	removeRequest = async (requestId: string): Promise<void> => {
		this.#loadingCount++
		this.error = null
		try {
			const { error: supabaseError } = await supabase
				.from('stock_requests')
				.delete()
				.eq('id', requestId)

			if (supabaseError) throw supabaseError

			// Optimistic local removal
			const index = this.requests.findIndex((r) => r.id === requestId)
			if (index !== -1) this.requests.splice(index, 1)
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'An error occurred while removing request'
			console.error('Error removing request:', err)
		} finally {
			this.#loadingCount--
		}
	}

	approveRequest = async (requestId: string): Promise<void> => {
		this.#loadingCount++
		this.error = null

		try {
			const item = this.requests.find((request) => request.id === requestId)
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
				const index = this.requests.findIndex((r) => r.id === requestId)
				if (index !== -1) {
					this.requests[index] = { ...this.requests[index], ...data }
				}
			}

			// Await stockOut to ensure inventory is deducted before continuing
			await inventoryStore.stockOut(item.item_id, item.quantity, 'Stock Request')
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'An error occurred while approving request'
			console.error('Error approving request', err)
		} finally {
			this.#loadingCount--
		}
	}

	rejectRequest = async (requestId: string, remark?: string): Promise<void> => {
		this.#loadingCount++
		this.error = null

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
				const index = this.requests.findIndex((r) => r.id === requestId)
				if (index !== -1) {
					this.requests[index] = { ...this.requests[index], ...data }
				}
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'An error occurred while rejecting request'
			console.error('Error rejecting request', err)
		} finally {
			this.#loadingCount--
		}
	}

	updateRequest = async (
		requestId: string,
		newQuantity?: number,
		newRemark?: string,
	): Promise<void> => {
		this.#loadingCount++
		this.error = null

		try {
			const updateData: { updated_at: string; quantity?: number; remark?: string } = {
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
				const index = this.requests.findIndex((r) => r.id === requestId)
				if (index !== -1) {
					this.requests[index] = { ...this.requests[index], ...data }
				}
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'An error occurred while updating request'
			console.error('Error updating request:', err)
		} finally {
			this.#loadingCount--
		}
	}

	searchRequests = (query: string): StockRequest[] => {
		if (!query) return this.requests
		return this.requests.filter(
			(request) =>
				request.item_name.toLowerCase().includes(query.toLowerCase()) ||
				request.item_id.toLowerCase().includes(query.toLowerCase()) ||
				request.remark?.toLowerCase().includes(query.toLowerCase()),
		)
	}

	filterRequestsByStatus = (status: string): StockRequest[] => {
		if (!status) return this.requests
		return this.requests.filter((request) => request.status === status)
	}

	filterRequestsByDate = (date: string): StockRequest[] => {
		if (!date) return this.requests
		const filterDate = new Date(date)
		return this.requests.filter((request) => {
			const requestDate = new Date(request.created_at)
			return requestDate.toDateString() === filterDate.toDateString()
		})
	}

	getPendingRequests = (): StockRequest[] => {
		return this.requests.filter((request) => request.status === 'Pending')
	}

	// Subscription lifecycle
	#startSubscription = () => {
		if (this.#channel) return

		this.#channel = supabase
			.channel('update-stock-requests')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'stock_requests' },
				async (payload) => {
					if (payload.eventType === 'INSERT') {
						// Dedup: skip if already in local state
						const exists = this.requests.some((r) => r.id === payload.new.id)
						if (!exists) {
							const unit = await this.#getUnitForItem(payload.new.item_id)
							const newRequest: StockRequest = {
								...payload.new,
								unit: unit || '',
							} as StockRequest
							this.requests.unshift(newRequest)
						}
					} else if (payload.eventType === 'UPDATE') {
						const index = this.requests.findIndex((r) => r.id === payload.new.id)
						if (index !== -1) {
							const data: StockRequest = {
								id: payload.new.id,
								item_id: payload.new.item_id,
								item_name: payload.new.item_name,
								quantity: payload.new.quantity,
								remark: payload.new.remark,
								status: payload.new.status,
								unit: this.requests[index]?.unit || '',
								created_at: payload.new.created_at,
								updated_at: payload.new.updated_at,
							}
							this.requests[index] = data
						}
					} else if (payload.eventType === 'DELETE') {
						const index = this.requests.findIndex((r) => r.id === payload.old.id)
						if (index !== -1) this.requests.splice(index, 1)
					}

					// Sort by created_at descending
					this.requests.sort(
						(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
					)
				},
			)
			.subscribe()
	}

	initializeStore = async (): Promise<void> => {
		if (this.#isInitialized) return
		this.#isInitialized = true
		await this.fetchRequests()
		this.#startSubscription()
	}

	cleanup = () => {
		if (this.#channel) {
			this.#channel.unsubscribe()
			this.#channel = null
		}
		this.requests = []
		this.#unitCache = {}
		this.error = null
		this.#isInitialized = false
	}
}

export const stockRequestsStore = new StockRequestsStore()

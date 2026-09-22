import { api } from '../../../convex/_generated/api'
import { convex } from '$lib/convex'
import type { NewStockRequest, StockRequest, StockRequestId } from '$lib/types/stockRequests'
import { errorMessage, withLegacy } from '$lib/types/legacy'
import { authStore } from './auth.svelte'

/*
 * Live subscription to every pending request plus the newest few hundred
 * decided ones (the server caps the history). Approving a request deducts
 * the stock in the same server transaction, so there is no separate stock
 * out call here any more.
 */
class StockRequestsStore {
	// State
	requests = $state<StockRequest[]>([])
	#loadingCount = $state(0)
	error = $state<string | null>(null)
	#unsubscribe: (() => void) | null = null
	#settle: (() => void) | null = null
	#isInitialized = false

	get loading(): boolean {
		return this.#loadingCount > 0
	}

	#run = async (fallback: string, work: () => Promise<unknown>): Promise<void> => {
		this.#loadingCount++
		this.error = null
		try {
			await work()
		} catch (err) {
			this.error = errorMessage(err, fallback)
			console.error(fallback, err)
		} finally {
			this.#loadingCount--
		}
	}

	// Actions
	addRequest = async (request: NewStockRequest): Promise<void> => {
		await this.#run('An error occurred while adding request', () =>
			convex.mutation(api.requests.add, {
				auth: authStore.token,
				item_id: request.item_id,
				quantity: request.quantity,
				remark: request.remark || '',
			}),
		)
	}

	removeRequest = async (requestId: StockRequestId): Promise<void> => {
		await this.#run('An error occurred while removing request', () =>
			convex.mutation(api.requests.remove, { auth: authStore.token, id: requestId }),
		)
	}

	approveRequest = async (requestId: StockRequestId): Promise<void> => {
		await this.#run('An error occurred while approving request', () =>
			convex.mutation(api.requests.approve, { auth: authStore.token, id: requestId }),
		)
	}

	rejectRequest = async (requestId: StockRequestId, remark?: string): Promise<void> => {
		await this.#run('An error occurred while rejecting request', () =>
			convex.mutation(api.requests.reject, {
				auth: authStore.token,
				id: requestId,
				remark: remark || '',
			}),
		)
	}

	updateRequest = async (
		requestId: StockRequestId,
		newQuantity?: number,
		newRemark?: string,
	): Promise<void> => {
		await this.#run('An error occurred while updating request', () =>
			convex.mutation(api.requests.update, {
				auth: authStore.token,
				id: requestId,
				quantity: newQuantity,
				remark: newRemark,
			}),
		)
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
		if (this.#unsubscribe) return

		let settled = false
		const settle = () => {
			if (settled) return
			settled = true
			this.#loadingCount--
		}
		this.#settle = settle
		this.#loadingCount++

		this.#unsubscribe = convex.onUpdate(
			api.requests.list,
			{ auth: authStore.token },
			(docs) => {
				this.requests = docs.map(withLegacy)
				this.error = null
				settle()
			},
			(err) => {
				this.error = errorMessage(err, 'An error occurred while fetching requests')
				console.error('Requests subscription error:', err)
				settle()
			},
		)
	}

	initializeStore = async (): Promise<void> => {
		if (this.#isInitialized) return
		this.#isInitialized = true
		this.#startSubscription()
	}

	cleanup = () => {
		this.#settle?.()
		this.#settle = null
		this.#unsubscribe?.()
		this.#unsubscribe = null
		this.requests = []
		this.error = null
		this.#isInitialized = false
	}
}

export const stockRequestsStore = new StockRequestsStore()

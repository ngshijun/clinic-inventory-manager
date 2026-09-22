import { api } from '../../../convex/_generated/api'
import { convex } from '$lib/convex'
import { fefoOrder, type StockBatch, type StockBatchId } from '$lib/types/stockBatches'
import { errorMessage, withLegacy } from '$lib/types/legacy'
import { authStore } from './auth.svelte'

/**
 * Batches with stock remaining, for every item, as a live subscription.
 * Emptied batches are not returned by the server (their history lives in
 * stock_movements). Per item they are kept in FEFO order, which is the order
 * stock out consumes them.
 */
class StockBatchesStore {
	batches = $state<StockBatch[]>([])
	#loadingCount = $state(0)
	error = $state<string | null>(null)
	#unsubscribe: (() => void) | null = null
	#settle: (() => void) | null = null
	#isInitialized = false

	get loading(): boolean {
		return this.#loadingCount > 0
	}

	/** Item id -> its batches with stock remaining, in stock-out (FEFO) order */
	get batchesByItem(): Map<string, StockBatch[]> {
		const map = new Map<string, StockBatch[]>()
		for (const batch of this.batches) {
			const list = map.get(batch.item_id)
			if (list) list.push(batch)
			else map.set(batch.item_id, [batch])
		}
		for (const [itemId, list] of map) map.set(itemId, fefoOrder(list))
		return map
	}

	/** Item id -> earliest expiry date among its batches with stock remaining */
	get nearestExpiryByItem(): Map<string, string> {
		const map = new Map<string, string>()
		for (const batch of this.batches) {
			if (!batch.expiry_date) continue
			const current = map.get(batch.item_id)
			if (!current || batch.expiry_date < current) map.set(batch.item_id, batch.expiry_date)
		}
		return map
	}

	getBatchesForItem = (itemId: string): StockBatch[] => {
		return this.batchesByItem.get(itemId) ?? []
	}

	/**
	 * Edit a batch's remaining quantity and expiry date. The server logs any
	 * quantity change as a stock movement and recomputes the item total; the
	 * subscription delivers the new state.
	 */
	updateBatch = async (
		batchId: StockBatchId,
		quantity: number,
		expiryDate: string | null,
	): Promise<void> => {
		this.#loadingCount++
		this.error = null
		try {
			await convex.mutation(api.stock.updateBatch, {
				auth: authStore.token,
				batch_id: batchId,
				quantity: Math.max(0, Math.floor(quantity)),
				expiry_date: expiryDate || undefined,
			})
		} catch (err) {
			this.error = errorMessage(err, 'An error occurred while updating batch')
			console.error('Error updating batch:', err)
		} finally {
			this.#loadingCount--
		}
	}

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
			api.stock.listBatches,
			{ auth: authStore.token },
			(docs) => {
				this.batches = docs.map(withLegacy)
				this.error = null
				settle()
			},
			(err) => {
				this.error = errorMessage(err, 'An error occurred while fetching batches')
				console.error('Batches subscription error:', err)
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
		this.batches = []
		this.error = null
		this.#isInitialized = false
	}
}

export const stockBatchesStore = new StockBatchesStore()

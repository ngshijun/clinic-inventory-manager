import { supabase } from '$lib/supabase'
import type { InventoryItem } from '$lib/types/inventory'
import type { StockBatch } from '$lib/types/stockBatches'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { inventoryStore } from './inventory.svelte'

/**
 * Batches with stock remaining, for every item. Emptied batches are dropped
 * from this list (their history lives in stock_movements). Ordered in FIFO
 * order, which is the order stock_out consumes them.
 */
class StockBatchesStore {
	batches = $state<StockBatch[]>([])
	#loadingCount = $state(0)
	error = $state<string | null>(null)
	#channel: RealtimeChannel | null = null
	#isInitialized = false

	get loading(): boolean {
		return this.#loadingCount > 0
	}

	/** Item id -> its batches with stock remaining, oldest received first */
	get batchesByItem(): Map<string, StockBatch[]> {
		const map = new Map<string, StockBatch[]>()
		for (const batch of this.batches) {
			const list = map.get(batch.item_id)
			if (list) list.push(batch)
			else map.set(batch.item_id, [batch])
		}
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

	#sort = () => {
		this.batches.sort(
			(a, b) =>
				new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
				a.id.localeCompare(b.id),
		)
	}

	#upsert = (batch: StockBatch) => {
		const index = this.batches.findIndex((b) => b.id === batch.id)
		if (batch.quantity <= 0) {
			if (index !== -1) this.batches.splice(index, 1)
			return
		}
		if (index === -1) this.batches.push(batch)
		else this.batches[index] = batch
		this.#sort()
	}

	fetchBatches = async (): Promise<void> => {
		this.#loadingCount++
		this.error = null
		try {
			const { data, error: supabaseError } = await supabase
				.from('stock_batches')
				.select('*')
				.gt('quantity', 0)
				.order('created_at', { ascending: true })
				.order('id', { ascending: true })

			if (supabaseError) throw supabaseError
			this.batches = data || []
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'An error occurred while fetching batches'
			console.error('Error fetching batches:', err)
		} finally {
			this.#loadingCount--
		}
	}

	/**
	 * Edit a batch's remaining quantity and expiry date. The server logs any
	 * quantity change as a stock movement and returns the recomputed item.
	 */
	updateBatch = async (
		batchId: string,
		quantity: number,
		expiryDate: string | null,
	): Promise<void> => {
		this.#loadingCount++
		this.error = null
		try {
			const { data, error: rpcError } = await supabase
				.rpc('update_stock_batch', {
					p_batch_id: batchId,
					p_quantity: Math.max(0, Math.floor(quantity)),
					p_expiry_date: expiryDate || null,
				})
				.single()

			if (rpcError) throw rpcError

			if (data) inventoryStore.applyServerItem(data as InventoryItem)

			// Optimistic local update; realtime will confirm it
			const index = this.batches.findIndex((b) => b.id === batchId)
			if (index !== -1) {
				this.#upsert({
					...this.batches[index],
					quantity: Math.max(0, Math.floor(quantity)),
					expiry_date: expiryDate || null,
					updated_at: new Date().toISOString(),
				})
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'An error occurred while updating batch'
			console.error('Error updating batch:', err)
		} finally {
			this.#loadingCount--
		}
	}

	#startSubscription = () => {
		if (this.#channel) return

		this.#channel = supabase
			.channel('update-stock-batches')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'stock_batches' },
				(payload) => {
					if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
						this.#upsert(payload.new as StockBatch)
					} else if (payload.eventType === 'DELETE') {
						const index = this.batches.findIndex((b) => b.id === payload.old.id)
						if (index !== -1) this.batches.splice(index, 1)
					}
				},
			)
			.subscribe()
	}

	initializeStore = async (): Promise<void> => {
		if (this.#isInitialized) return
		this.#isInitialized = true
		await this.fetchBatches()
		this.#startSubscription()
	}

	cleanup = () => {
		if (this.#channel) {
			this.#channel.unsubscribe()
			this.#channel = null
		}
		this.batches = []
		this.error = null
		this.#isInitialized = false
	}
}

export const stockBatchesStore = new StockBatchesStore()

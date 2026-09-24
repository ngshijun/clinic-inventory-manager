// stores/inventory.svelte.ts
import { api } from '../../../convex/_generated/api'
import { convex } from '$lib/convex'
import type {
	InventoryId,
	InventoryItem,
	InventoryItemUpdate,
	NewInventoryItem,
	OrderStatus,
} from '$lib/types/inventory'
import { errorMessage, withLegacy } from '$lib/types/legacy'
import { authStore } from './auth.svelte'

/** One row of an Excel import, as the sheet provides it */
export interface InventoryImportRow {
	item_name: string
	quantity: number
	reorder_level: number
	unit: string
	remark: string
	order_date: string
}

export interface InventoryImportResult {
	imported: number
	updated: number
	deleted: number
	total: number
}

/*
 * `items` is a live subscription to the inventory list: every mutation, from
 * this tab or another, arrives through the same callback, so there is no
 * optimistic patching or dedup here any more.
 */
class InventoryStore {
	// State
	items = $state<InventoryItem[]>([])
	#loadingCount = $state(0)
	error = $state<string | null>(null)
	#unsubscribe: (() => void) | null = null
	#settle: (() => void) | null = null
	#isInitialized = false

	get loading(): boolean {
		return this.#loadingCount > 0
	}

	// Getters (computed)
	get totalItems(): number {
		return this.items
			.filter((item) => !item.not_track)
			.reduce((sum, item) => sum + item.quantity, 0)
	}

	get totalProducts(): number {
		return this.items.filter((item) => !item.not_track).length
	}

	get lowStockItems(): InventoryItem[] {
		return this.items.filter(
			(item) => !item.not_track && item.quantity <= item.reorder_level && item.quantity !== 0,
		)
	}

	get outOfStockItems(): InventoryItem[] {
		return this.items.filter(
			(item) => !item.not_track && item.quantity === 0 && item.reorder_level !== -1,
		)
	}

	// Runs a mutation with the shared loading/error bookkeeping
	#run = async <T>(fallback: string, work: () => Promise<T>): Promise<T | undefined> => {
		this.#loadingCount++
		this.error = null
		try {
			return await work()
		} catch (err) {
			this.error = errorMessage(err, fallback)
			console.error(fallback, err)
			return undefined
		} finally {
			this.#loadingCount--
		}
	}

	// Actions
	fetchItems = async (): Promise<void> => {
		await this.#run('An error occurred while fetching items', async () => {
			const docs = await convex.query(api.inventory.list, { auth: authStore.token })
			this.items = docs.map(withLegacy)
		})
	}

	addItem = async (newItem: NewInventoryItem, expiryDate?: string | null): Promise<void> => {
		await this.#run('An error occurred while adding item', () =>
			convex.mutation(api.inventory.add, {
				auth: authStore.token,
				item_name: newItem.item_name,
				quantity: Math.max(0, Math.floor(newItem.quantity)),
				reorder_level: Math.max(-1, newItem.reorder_level),
				unit: newItem.unit,
				remark: newItem.remark || '',
				not_track: newItem.not_track || false,
				expiry_date: expiryDate || undefined,
			}),
		)
	}

	// Stock In: creates a batch (with optional expiry date), increments the
	// quantity and logs the movement, all in one server transaction.
	stockIn = async (
		itemId: InventoryId,
		quantity: number,
		notTrackStatus?: boolean,
		expiryDate?: string | null,
		remark?: string,
	): Promise<void> => {
		await this.#run('An error occurred while adding stock', () =>
			convex.mutation(api.stock.stockIn, {
				auth: authStore.token,
				item_id: itemId,
				quantity: Math.max(0, Math.floor(quantity)),
				not_track: notTrackStatus,
				expiry_date: expiryDate || undefined,
				remark: remark || '',
			}),
		)
	}

	// Stock Out: consumes the earliest-expiring batches first and logs one movement
	// per batch touched.
	stockOut = async (itemId: InventoryId, quantity: number, remark?: string): Promise<void> => {
		await this.#run('An error occurred while removing stock', () =>
			convex.mutation(api.stock.stockOut, {
				auth: authStore.token,
				item_id: itemId,
				quantity: Math.max(0, Math.floor(quantity)),
				remark: remark || '',
			}),
		)
	}

	// Mark ordered, or change the order; no expected date means a back-order
	markOrdered = async (
		itemId: InventoryId,
		quantity: number,
		orderedOn: string,
		expectedBy: string | null,
	): Promise<void> => {
		await this.#run('An error occurred while marking item as ordered', () =>
			convex.mutation(api.inventory.markOrdered, {
				auth: authStore.token,
				id: itemId,
				quantity,
				ordered_on: orderedOn,
				expected_by: expectedBy ?? undefined,
			}),
		)
	}

	// Keep the item out of To Order until a date
	snooze = async (itemId: InventoryId, until: string, reason: string): Promise<void> => {
		await this.#run('An error occurred while snoozing item', () =>
			convex.mutation(api.inventory.snooze, { auth: authStore.token, id: itemId, until, reason }),
		)
	}

	// Back to undecided
	clearOrderStatus = async (itemId: InventoryId): Promise<void> => {
		await this.#run('An error occurred while clearing order status', () =>
			convex.mutation(api.inventory.clearOrderStatus, { auth: authStore.token, id: itemId }),
		)
	}

	/** Puts a status back after an undo */
	restoreOrderStatus = async (itemId: InventoryId, status: OrderStatus | undefined) => {
		await this.#run('An error occurred while restoring order status', () =>
			convex.mutation(api.inventory.restoreOrderStatus, {
				auth: authStore.token,
				id: itemId,
				status,
			}),
		)
	}

	// Quantity is deliberately not accepted here: stock lives in batches, so
	// it only changes through stockIn / stockOut / the batch editor.
	updateItem = async (itemId: InventoryId, item: InventoryItemUpdate): Promise<void> => {
		await this.#run('An error occurred while updating item', () =>
			convex.mutation(api.inventory.update, {
				auth: authStore.token,
				id: itemId,
				item_name: item.item_name,
				unit: item.unit,
				reorder_level: item.reorder_level,
				remark: item.remark,
				not_track: item.not_track,
			}),
		)
	}

	deleteItem = async (itemId: InventoryId): Promise<void> => {
		await this.#run('An error occurred while deleting item', () =>
			convex.mutation(api.inventory.remove, { auth: authStore.token, id: itemId }),
		)
	}

	/**
	 * Sync the inventory with an Excel sheet in one transaction: details are
	 * updated, quantity differences move through batches, new items are
	 * created, and items missing from the sheet are deleted.
	 */
	importFromRows = async (
		rows: InventoryImportRow[],
	): Promise<InventoryImportResult | undefined> => {
		return await this.#run('An error occurred while importing inventory', () =>
			convex.mutation(api.stock.importInventory, { auth: authStore.token, rows }),
		)
	}

	getItemById = (itemId: string): InventoryItem | undefined => {
		return this.items.find((item) => item.id === itemId)
	}

	searchItems = (query: string): InventoryItem[] => {
		if (!query) return this.items
		return this.items.filter((item) => item.item_name.toLowerCase().includes(query.toLowerCase()))
	}

	// Subscription lifecycle
	#startSubscription = () => {
		if (this.#unsubscribe) return

		// Counts as loading until the first result lands
		let settled = false
		const settle = () => {
			if (settled) return
			settled = true
			this.#loadingCount--
		}
		this.#settle = settle
		this.#loadingCount++

		this.#unsubscribe = convex.onUpdate(
			api.inventory.list,
			{ auth: authStore.token },
			(docs) => {
				this.items = docs.map(withLegacy)
				this.error = null
				settle()
			},
			(err) => {
				this.error = errorMessage(err, 'An error occurred while fetching items')
				console.error('Inventory subscription error:', err)
				settle()
			},
		)
	}

	// Initialize store by subscribing to the inventory list
	initializeStore = async (): Promise<void> => {
		if (this.#isInitialized) return
		this.#isInitialized = true
		this.#startSubscription()
	}

	// Cleanup: unsubscribe and reset state
	cleanup = () => {
		this.#settle?.()
		this.#settle = null
		this.#unsubscribe?.()
		this.#unsubscribe = null
		this.items = []
		this.error = null
		this.#isInitialized = false
	}
}

export const inventoryStore = new InventoryStore()

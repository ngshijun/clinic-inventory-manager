import { api } from '../../../convex/_generated/api'
import { convex } from '$lib/convex'
import { errorMessage, withLegacy } from '$lib/types/legacy'
import type { Supplier, SupplierId } from '$lib/types/suppliers'
import { authStore } from './auth.svelte'

/** The Suppliers list, in name order, as a live subscription. Managers only. */
class SuppliersStore {
	suppliers = $state<Supplier[]>([])
	#loadingCount = $state(0)
	error = $state<string | null>(null)
	#unsubscribe: (() => void) | null = null
	#settle: (() => void) | null = null
	#isInitialized = false

	get loading(): boolean {
		return this.#loadingCount > 0
	}

	get names(): string[] {
		return this.suppliers.map((supplier) => supplier.name)
	}

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

	addSupplier = async (name: string): Promise<void> => {
		await this.#run('An error occurred while adding the supplier', () =>
			convex.mutation(api.suppliers.add, { auth: authStore.token, name }),
		)
	}

	/** Renames the supplier everywhere; a name already on the list combines the two */
	renameSupplier = async (
		id: SupplierId,
		name: string,
	): Promise<{ name: string; combined: boolean; items: number } | undefined> => {
		return await this.#run('An error occurred while renaming the supplier', () =>
			convex.mutation(api.suppliers.rename, { auth: authStore.token, id, name }),
		)
	}

	deleteSupplier = async (id: SupplierId): Promise<void> => {
		await this.#run('An error occurred while deleting the supplier', () =>
			convex.mutation(api.suppliers.remove, { auth: authStore.token, id }),
		)
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
			api.suppliers.list,
			{ auth: authStore.token },
			(docs) => {
				this.suppliers = docs.map(withLegacy)
				this.error = null
				settle()
			},
			(err) => {
				this.error = errorMessage(err, 'An error occurred while fetching suppliers')
				console.error('Suppliers subscription error:', err)
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
		this.suppliers = []
		this.error = null
		this.#isInitialized = false
	}
}

export const suppliersStore = new SuppliersStore()

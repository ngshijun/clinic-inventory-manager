import { api } from '../../../convex/_generated/api'
import { convex } from '$lib/convex'
import { errorMessage, withLegacy } from '$lib/types/legacy'
import type { Unit, UnitId } from '$lib/types/units'
import { authStore } from './auth.svelte'

/** The preset units, in name order, as a live subscription. Managers only. */
class UnitsStore {
	units = $state<Unit[]>([])
	#loadingCount = $state(0)
	error = $state<string | null>(null)
	/** A failed load, which the user can do nothing about; `error` is a failed action */
	loadError = $state<string | null>(null)
	#unsubscribe: (() => void) | null = null
	#settle: (() => void) | null = null
	#isInitialized = false

	get loading(): boolean {
		return this.#loadingCount > 0
	}

	get names(): string[] {
		return this.units.map((unit) => unit.name)
	}

	/** The units that are amounts inside a pack, which a price is never quoted for */
	measures = $derived<ReadonlySet<string>>(
		new Set(this.units.filter((unit) => unit.measure).map((unit) => unit.name)),
	)

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

	addUnit = async (name: string, measure: boolean): Promise<void> => {
		await this.#run('An error occurred while adding the unit', () =>
			convex.mutation(api.units.add, { auth: authStore.token, name, measure }),
		)
	}

	setMeasure = async (id: UnitId, measure: boolean): Promise<void> => {
		await this.#run('An error occurred while changing the unit', () =>
			convex.mutation(api.units.setMeasure, { auth: authStore.token, id, measure }),
		)
	}

	/** Renames the unit everywhere; a name already on the list combines the two */
	renameUnit = async (
		id: UnitId,
		name: string,
	): Promise<{ combined: boolean; items: number } | undefined> => {
		return await this.#run('An error occurred while renaming the unit', () =>
			convex.mutation(api.units.rename, { auth: authStore.token, id, name }),
		)
	}

	deleteUnit = async (id: UnitId): Promise<void> => {
		await this.#run('An error occurred while deleting the unit', () =>
			convex.mutation(api.units.remove, { auth: authStore.token, id }),
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
			api.units.list,
			{ auth: authStore.token },
			(docs) => {
				this.units = docs.map(withLegacy)
				this.loadError = null
				settle()
			},
			(err) => {
				this.loadError = errorMessage(err, 'An error occurred while fetching units')
				console.error('Units subscription error:', err)
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
		this.units = []
		this.error = null
		this.loadError = null
		this.#isInitialized = false
	}
}

export const unitsStore = new UnitsStore()

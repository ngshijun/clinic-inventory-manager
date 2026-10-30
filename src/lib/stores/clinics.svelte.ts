import { api } from '$convex/_generated/api'
import { convex } from '$lib/convex'
import { errorMessage, withLegacy } from '$lib/types/legacy'
import type { Clinic, ClinicId } from '$lib/types/loans'
import { authStore } from './auth.svelte'

/** The Clinics list, in name order, as a live subscription. Managers only. */
class ClinicsStore {
	clinics = $state<Clinic[]>([])
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
		return this.clinics.map((clinic) => clinic.name)
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

	addClinic = async (name: string): Promise<void> => {
		await this.#run('An error occurred while adding the clinic', () =>
			convex.mutation(api.clinics.add, { auth: authStore.token, name }),
		)
	}

	/** Renames the clinic everywhere; a name already on the list combines the two */
	renameClinic = async (
		id: ClinicId,
		name: string,
	): Promise<{ name: string; combined: boolean; entries: number } | undefined> => {
		return await this.#run('An error occurred while renaming the clinic', () =>
			convex.mutation(api.clinics.rename, { auth: authStore.token, id, name }),
		)
	}

	deleteClinic = async (id: ClinicId): Promise<void> => {
		await this.#run('An error occurred while deleting the clinic', () =>
			convex.mutation(api.clinics.remove, { auth: authStore.token, id }),
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
			api.clinics.list,
			{ auth: authStore.token },
			(docs) => {
				this.clinics = docs.map(withLegacy)
				this.loadError = null
				settle()
			},
			(err) => {
				this.loadError = errorMessage(err, 'An error occurred while fetching clinics')
				console.error('Clinics subscription error:', err)
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
		this.clinics = []
		this.error = null
		this.loadError = null
		this.#isInitialized = false
	}
}

export const clinicsStore = new ClinicsStore()

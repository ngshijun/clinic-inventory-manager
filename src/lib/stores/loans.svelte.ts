import { api } from '#convex/_generated/api.js'
import { owedOf, returnedOf } from '#convex/lib/loans.js'
import { unitLabel } from '#convex/lib/units.js'
import { convex } from '#lib/convex.js'
import { errorMessage, withLegacy } from '#lib/types/legacy.js'
import type { Loan, LoanEntry, LoanId } from '#lib/types/loans.js'
import { authStore } from './auth.svelte'

/** Medicine borrowed from and lent to other clinics, newest first, as a live subscription. Managers only. */
class LoansStore {
	loans = $state<Loan[]>([])
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

	addLoan = async (entry: LoanEntry): Promise<void> => {
		await this.#run('An error occurred while adding the entry', () =>
			convex.mutation(api.loans.add, { auth: authStore.token, ...entry }),
		)
	}

	updateLoan = async (id: LoanId, entry: LoanEntry): Promise<void> => {
		await this.#run('An error occurred while saving the entry', () =>
			convex.mutation(api.loans.update, { auth: authStore.token, id, ...entry }),
		)
	}

	recordReturn = async (id: LoanId, quantity: number, returned_on: string): Promise<void> => {
		await this.#run('An error occurred while saving the return', () =>
			convex.mutation(api.loans.recordReturn, {
				auth: authStore.token,
				id,
				quantity,
				returned_on,
			}),
		)
	}

	settleLoan = async (id: LoanId, note: string, settled_on: string): Promise<void> => {
		await this.#run('An error occurred while settling the entry', () =>
			convex.mutation(api.loans.settle, { auth: authStore.token, id, note, settled_on }),
		)
	}

	deleteLoan = async (id: LoanId): Promise<void> => {
		await this.#run('An error occurred while deleting the entry', () =>
			convex.mutation(api.loans.remove, { auth: authStore.token, id }),
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
			api.loans.list,
			{ auth: authStore.token },
			(docs) => {
				this.loans = docs.map((doc) => ({
					...withLegacy(doc),
					unit_label: unitLabel(doc),
					returned: returnedOf(doc),
					owed: owedOf(doc),
				}))
				this.loadError = null
				settle()
			},
			(err) => {
				this.loadError = errorMessage(err, 'An error occurred while fetching borrowed and lent')
				console.error('Loans subscription error:', err)
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
		this.loans = []
		this.error = null
		this.loadError = null
		this.#isInitialized = false
	}
}

export const loansStore = new LoansStore()

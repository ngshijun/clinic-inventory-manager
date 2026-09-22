// stores/payrollRecords.svelte.ts
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { convex } from '$lib/convex'
import type { PayrollData } from '$lib/types/payroll'
import { errorMessage, withLegacy, type WithLegacy } from '$lib/types/legacy'
import { authStore } from './auth.svelte'

type PayrollRun = WithLegacy<Doc<'payroll_runs'>>
type PayrollRunItem = WithLegacy<Doc<'payroll_run_items'>>
type PayrollRunId = Id<'payroll_runs'>

/*
 * Saved monthly payroll records. The list of runs is a live subscription;
 * the items of a run are subscribed to on demand the first time a period is
 * opened and stay live after that.
 */
class PayrollRecordsStore {
	// State
	runs = $state<PayrollRun[]>([])
	// Items are loaded on demand, keyed by run id
	itemsByRun = $state<Record<string, PayrollRunItem[]>>({})
	#loadingCount = $state(0)
	error = $state<string | null>(null)
	#unsubscribeRuns: (() => void) | null = null
	#settle: (() => void) | null = null
	#itemSubscriptions = new Map<string, () => void>()
	#isInitialized = false

	get loading(): boolean {
		return this.#loadingCount > 0
	}

	// Getters (computed)
	get totalRuns(): number {
		return this.runs.length
	}

	getRunByPeriod = (year: number, month: number): PayrollRun | undefined => {
		return this.runs.find((run) => run.year === year && run.month === month)
	}

	getItems = (runId: string): PayrollRunItem[] => this.itemsByRun[runId] || []

	// Actions
	fetchRuns = async (): Promise<void> => {
		this.#loadingCount++
		this.error = null
		try {
			const docs = await convex.query(api.payrollRuns.list, { auth: authStore.token })
			this.runs = docs.map(withLegacy)
		} catch (err) {
			this.error = errorMessage(err, 'An error occurred while fetching payroll records')
			console.error('Error fetching payroll runs:', err)
		} finally {
			this.#loadingCount--
		}
	}

	/** Load a run's items and keep them live. Resolves with the first result. */
	fetchRunItems = async (runId: PayrollRunId): Promise<PayrollRunItem[]> => {
		if (this.#itemSubscriptions.has(runId)) return this.getItems(runId)

		this.#loadingCount++
		this.error = null
		return await new Promise<PayrollRunItem[]>((resolve) => {
			let settled = false
			const settle = (items: PayrollRunItem[]) => {
				if (settled) return
				settled = true
				this.#loadingCount--
				resolve(items)
			}

			const unsubscribe = convex.onUpdate(
				api.payrollRuns.items,
				{ auth: authStore.token, run_id: runId },
				(docs) => {
					const items = docs.map(withLegacy)
					this.itemsByRun = { ...this.itemsByRun, [runId]: items }
					settle(items)
				},
				(err) => {
					this.error = errorMessage(err, 'An error occurred while fetching payroll record items')
					console.error('Error fetching payroll run items:', err)
					settle([])
				},
			)
			this.#itemSubscriptions.set(runId, unsubscribe)
		})
	}

	/**
	 * Freeze a month's payroll. Re-saving an already saved period replaces its
	 * items in one server transaction, so a correction can be made without
	 * leaving a duplicate behind.
	 */
	savePayrollRun = async (
		year: number,
		month: number,
		payrollData: PayrollData[],
		netSalaryOf: (item: PayrollData) => number,
	): Promise<PayrollRun | null> => {
		this.#loadingCount++
		this.error = null
		try {
			const items = payrollData.map((item) => ({
				employee_id: item.employeeId as Id<'payroll'>,
				employee_name: item.employeeName,
				basic_salary: item.basicSalary,
				epf_employee: item.epfEmployee,
				epf_employer: item.epfEmployer,
				socso_employee: item.socsoEmployee,
				socso_employer: item.socsoEmployer,
				eis_employee: item.eisEmployee,
				eis_employer: item.eisEmployer,
				lindung_24_jam: item.lindung24,
				pcb: item.pcb || 0,
				cp38: item.cp38 || 0,
				net_salary: netSalaryOf(item),
			}))

			const run = await convex.mutation(api.payrollRuns.save, {
				auth: authStore.token,
				year,
				month,
				items,
			})

			await this.fetchRunItems(run._id)
			return withLegacy(run)
		} catch (err) {
			this.error = errorMessage(err, 'An error occurred while saving the payroll record')
			console.error('Error saving payroll run:', err)
			return null
		} finally {
			this.#loadingCount--
		}
	}

	deletePayrollRun = async (runId: PayrollRunId): Promise<boolean> => {
		this.#loadingCount++
		this.error = null
		try {
			await convex.mutation(api.payrollRuns.remove, { auth: authStore.token, run_id: runId })
			this.#dropItems(runId)
			return true
		} catch (err) {
			this.error = errorMessage(err, 'An error occurred while deleting the payroll record')
			console.error('Error deleting payroll run:', err)
			return false
		} finally {
			this.#loadingCount--
		}
	}

	// Subscription lifecycle
	#dropItems = (runId: string) => {
		this.#itemSubscriptions.get(runId)?.()
		this.#itemSubscriptions.delete(runId)
		if (runId in this.itemsByRun) {
			const { [runId]: _removed, ...rest } = this.itemsByRun
			this.itemsByRun = rest
		}
	}

	#startSubscription = () => {
		if (this.#unsubscribeRuns) return

		let settled = false
		const settle = () => {
			if (settled) return
			settled = true
			this.#loadingCount--
		}
		this.#settle = settle
		this.#loadingCount++

		this.#unsubscribeRuns = convex.onUpdate(
			api.payrollRuns.list,
			{ auth: authStore.token },
			(docs) => {
				this.runs = docs.map(withLegacy)
				// Forget items of runs that no longer exist
				const live = new Set<string>(docs.map((run) => run._id))
				for (const runId of [...this.#itemSubscriptions.keys()]) {
					if (!live.has(runId)) this.#dropItems(runId)
				}
				this.error = null
				settle()
			},
			(err) => {
				this.error = errorMessage(err, 'An error occurred while fetching payroll records')
				console.error('Payroll runs subscription error:', err)
				settle()
			},
		)
	}

	// Initialize store by subscribing to the runs list
	initializeStore = async (): Promise<void> => {
		if (this.#isInitialized) return
		this.#isInitialized = true
		this.#startSubscription()
	}

	// Cleanup: unsubscribe and reset state
	cleanup = () => {
		this.#settle?.()
		this.#settle = null
		this.#unsubscribeRuns?.()
		this.#unsubscribeRuns = null
		this.#itemSubscriptions.forEach((unsubscribe) => unsubscribe())
		this.#itemSubscriptions.clear()
		this.runs = []
		this.itemsByRun = {}
		this.error = null
		this.#isInitialized = false
	}
}

export const payrollRecordsStore = new PayrollRecordsStore()

export type { PayrollRun, PayrollRunItem }

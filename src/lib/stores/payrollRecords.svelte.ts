// stores/payrollRecords.ts
import { supabase } from '$lib/supabase'
import type { Database } from '$lib/types/database.types'
import type { PayrollData } from '$lib/types/payroll'
import type { RealtimeChannel } from '@supabase/supabase-js'

type PayrollRun = Database['public']['Tables']['payroll_runs']['Row']
type PayrollRunItem = Database['public']['Tables']['payroll_run_items']['Row']

class PayrollRecordsStore {
	// State
	runs = $state<PayrollRun[]>([])
	// Items are loaded on demand, keyed by run id
	itemsByRun = $state<Record<string, PayrollRunItem[]>>({})
	#loadingCount = $state(0)
	error = $state<string | null>(null)
	#channel: RealtimeChannel | null = null
	#isInitialized = false
	// A save rewrites every item row at once, so refetches are debounced per run
	#pendingItemRefetch = new Map<string, ReturnType<typeof setTimeout>>()

	get loading(): boolean {
		return this.#loadingCount > 0
	}

	// Newest period first
	#sortRuns = () => {
		this.runs.sort((a, b) => b.year - a.year || b.month - a.month)
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
			const { data, error: supabaseError } = await supabase
				.from('payroll_runs')
				.select('*')
				.order('year', { ascending: false })
				.order('month', { ascending: false })

			if (supabaseError) throw supabaseError
			this.runs = data || []
		} catch (err) {
			this.error =
				err instanceof Error ? err.message : 'An error occurred while fetching payroll records'
			console.error('Error fetching payroll runs:', err)
		} finally {
			this.#loadingCount--
		}
	}

	fetchRunItems = async (runId: string): Promise<PayrollRunItem[]> => {
		this.#loadingCount++
		this.error = null
		try {
			const { data, error: supabaseError } = await supabase
				.from('payroll_run_items')
				.select('*')
				.eq('run_id', runId)
				.order('employee_name', { ascending: true })

			if (supabaseError) throw supabaseError
			this.itemsByRun = { ...this.itemsByRun, [runId]: data || [] }
			return data || []
		} catch (err) {
			this.error =
				err instanceof Error ? err.message : 'An error occurred while fetching payroll record items'
			console.error('Error fetching payroll run items:', err)
			return []
		} finally {
			this.#loadingCount--
		}
	}

	/**
	 * Freeze a month's payroll. Re-saving an already saved period replaces its
	 * items, so a correction can be made without leaving a duplicate behind.
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
				employee_id: item.employeeId,
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

			// Replacing an existing period's items has to be atomic, otherwise a
			// failed re-insert would leave the previously saved record destroyed
			const { data: run, error: supabaseError } = await supabase.rpc('save_payroll_run', {
				p_year: year,
				p_month: month,
				p_items: items,
			})

			if (supabaseError) throw supabaseError
			if (!run) throw new Error('Payroll record could not be saved')

			// Optimistic local update
			const index = this.runs.findIndex((r) => r.id === run.id)
			if (index === -1) {
				this.runs.push(run)
			} else {
				this.runs[index] = run
			}
			this.#sortRuns()

			await this.fetchRunItems(run.id)

			return run
		} catch (err) {
			this.error =
				err instanceof Error ? err.message : 'An error occurred while saving the payroll record'
			console.error('Error saving payroll run:', err)
			return null
		} finally {
			this.#loadingCount--
		}
	}

	deletePayrollRun = async (runId: string): Promise<boolean> => {
		this.#loadingCount++
		this.error = null
		try {
			// Items are removed by the cascade on payroll_run_items.run_id
			const { error: supabaseError } = await supabase.from('payroll_runs').delete().eq('id', runId)

			if (supabaseError) throw supabaseError

			// Optimistic local removal
			const index = this.runs.findIndex((run) => run.id === runId)
			if (index !== -1) this.runs.splice(index, 1)

			this.#dropItems(runId)

			return true
		} catch (err) {
			this.error =
				err instanceof Error ? err.message : 'An error occurred while deleting the payroll record'
			console.error('Error deleting payroll run:', err)
			return false
		} finally {
			this.#loadingCount--
		}
	}

	// Subscription lifecycle
	#dropItems = (runId: string) => {
		const timer = this.#pendingItemRefetch.get(runId)
		if (timer) {
			clearTimeout(timer)
			this.#pendingItemRefetch.delete(runId)
		}
		if (runId in this.itemsByRun) {
			const { [runId]: _removed, ...rest } = this.itemsByRun
			this.itemsByRun = rest
		}
	}

	#scheduleItemsRefetch = (runId: string) => {
		const timer = this.#pendingItemRefetch.get(runId)
		if (timer) clearTimeout(timer)
		this.#pendingItemRefetch.set(
			runId,
			setTimeout(() => {
				this.#pendingItemRefetch.delete(runId)
				// Only periods the user has actually opened are worth keeping current
				if (runId in this.itemsByRun) this.fetchRunItems(runId)
			}, 300),
		)
	}

	#startSubscription = () => {
		if (this.#channel) return

		this.#channel = supabase
			.channel('update-payroll-runs')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'payroll_runs' },
				(payload) => {
					if (payload.eventType === 'INSERT') {
						// Dedup: skip if already in local state
						const exists = this.runs.some((run) => run.id === payload.new.id)
						if (!exists) this.runs.push(payload.new as PayrollRun)
					} else if (payload.eventType === 'UPDATE') {
						const index = this.runs.findIndex((run) => run.id === payload.new.id)
						if (index !== -1) this.runs[index] = payload.new as PayrollRun
					} else if (payload.eventType === 'DELETE') {
						const index = this.runs.findIndex((run) => run.id === payload.old.id)
						if (index !== -1) this.runs.splice(index, 1)

						this.#dropItems(payload.old.id as string)
					}

					this.#sortRuns()
				},
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'payroll_run_items' },
				(payload) => {
					const runId = (
						payload.eventType === 'DELETE' ? payload.old.run_id : payload.new.run_id
					) as string | undefined
					if (runId) this.#scheduleItemsRefetch(runId)
				},
			)
			.subscribe()
	}

	// Initialize store by fetching runs and starting subscription
	initializeStore = async (): Promise<void> => {
		if (this.#isInitialized) return
		this.#isInitialized = true
		await this.fetchRuns()
		this.#startSubscription()
	}

	// Cleanup: unsubscribe and reset state
	cleanup = () => {
		if (this.#channel) {
			this.#channel.unsubscribe()
			this.#channel = null
		}
		this.#pendingItemRefetch.forEach((timer) => clearTimeout(timer))
		this.#pendingItemRefetch.clear()
		this.runs = []
		this.itemsByRun = {}
		this.error = null
		this.#isInitialized = false
	}
}

export const payrollRecordsStore = new PayrollRecordsStore()

export type { PayrollRun, PayrollRunItem }

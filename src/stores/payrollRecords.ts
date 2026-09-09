// stores/payrollRecords.ts
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'
import type { PayrollData } from '@/types/payroll'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

type PayrollRun = Database['public']['Tables']['payroll_runs']['Row']
type PayrollRunItem = Database['public']['Tables']['payroll_run_items']['Row']

export const usePayrollRecordsStore = defineStore('payrollRecords', () => {
  // State
  const runs = ref<PayrollRun[]>([])
  // Items are loaded on demand, keyed by run id
  const itemsByRun = ref<Record<string, PayrollRunItem[]>>({})
  const loadingCount = ref(0)
  const loading = computed(() => loadingCount.value > 0)
  const error = ref<string | null>(null)
  let channel: RealtimeChannel | null = null
  let isInitialized = false
  // A save rewrites every item row at once, so refetches are debounced per run
  const pendingItemRefetch = new Map<string, ReturnType<typeof setTimeout>>()

  // Newest period first
  const sortRuns = () => {
    runs.value.sort((a, b) => b.year - a.year || b.month - a.month)
  }

  // Getters (computed)
  const totalRuns = computed((): number => runs.value.length)

  const getRunByPeriod = (year: number, month: number): PayrollRun | undefined => {
    return runs.value.find((run) => run.year === year && run.month === month)
  }

  const getItems = (runId: string): PayrollRunItem[] => itemsByRun.value[runId] || []

  // Actions
  const fetchRuns = async (): Promise<void> => {
    loadingCount.value++
    error.value = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('payroll_runs')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false })

      if (supabaseError) throw supabaseError
      runs.value = data || []
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'An error occurred while fetching payroll records'
      console.error('Error fetching payroll runs:', err)
    } finally {
      loadingCount.value--
    }
  }

  const fetchRunItems = async (runId: string): Promise<PayrollRunItem[]> => {
    loadingCount.value++
    error.value = null
    try {
      const { data, error: supabaseError } = await supabase
        .from('payroll_run_items')
        .select('*')
        .eq('run_id', runId)
        .order('employee_name', { ascending: true })

      if (supabaseError) throw supabaseError
      itemsByRun.value = { ...itemsByRun.value, [runId]: data || [] }
      return data || []
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'An error occurred while fetching payroll record items'
      console.error('Error fetching payroll run items:', err)
      return []
    } finally {
      loadingCount.value--
    }
  }

  /**
   * Freeze a month's payroll. Re-saving an already saved period replaces its
   * items, so a correction can be made without leaving a duplicate behind.
   */
  const savePayrollRun = async (
    year: number,
    month: number,
    payrollData: PayrollData[],
    netSalaryOf: (item: PayrollData) => number,
  ): Promise<PayrollRun | null> => {
    loadingCount.value++
    error.value = null
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
      const index = runs.value.findIndex((r) => r.id === run.id)
      if (index === -1) {
        runs.value.push(run)
      } else {
        runs.value[index] = run
      }
      sortRuns()

      await fetchRunItems(run.id)

      return run
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'An error occurred while saving the payroll record'
      console.error('Error saving payroll run:', err)
      return null
    } finally {
      loadingCount.value--
    }
  }

  const deletePayrollRun = async (runId: string): Promise<boolean> => {
    loadingCount.value++
    error.value = null
    try {
      // Items are removed by the cascade on payroll_run_items.run_id
      const { error: supabaseError } = await supabase.from('payroll_runs').delete().eq('id', runId)

      if (supabaseError) throw supabaseError

      // Optimistic local removal
      const index = runs.value.findIndex((run) => run.id === runId)
      if (index !== -1) runs.value.splice(index, 1)

      dropItems(runId)

      return true
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'An error occurred while deleting the payroll record'
      console.error('Error deleting payroll run:', err)
      return false
    } finally {
      loadingCount.value--
    }
  }

  // Subscription lifecycle
  const dropItems = (runId: string) => {
    const timer = pendingItemRefetch.get(runId)
    if (timer) {
      clearTimeout(timer)
      pendingItemRefetch.delete(runId)
    }
    if (runId in itemsByRun.value) {
      const { [runId]: _removed, ...rest } = itemsByRun.value
      itemsByRun.value = rest
    }
  }

  const scheduleItemsRefetch = (runId: string) => {
    const timer = pendingItemRefetch.get(runId)
    if (timer) clearTimeout(timer)
    pendingItemRefetch.set(
      runId,
      setTimeout(() => {
        pendingItemRefetch.delete(runId)
        // Only periods the user has actually opened are worth keeping current
        if (runId in itemsByRun.value) fetchRunItems(runId)
      }, 300),
    )
  }

  const startSubscription = () => {
    if (channel) return

    channel = supabase
      .channel('update-payroll-runs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payroll_runs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Dedup: skip if already in local state
            const exists = runs.value.some((run) => run.id === payload.new.id)
            if (!exists) runs.value.push(payload.new as PayrollRun)
          } else if (payload.eventType === 'UPDATE') {
            const index = runs.value.findIndex((run) => run.id === payload.new.id)
            if (index !== -1) runs.value[index] = payload.new as PayrollRun
          } else if (payload.eventType === 'DELETE') {
            const index = runs.value.findIndex((run) => run.id === payload.old.id)
            if (index !== -1) runs.value.splice(index, 1)

            dropItems(payload.old.id as string)
          }

          sortRuns()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payroll_run_items' },
        (payload) => {
          const runId = (
            payload.eventType === 'DELETE' ? payload.old.run_id : payload.new.run_id
          ) as string | undefined
          if (runId) scheduleItemsRefetch(runId)
        },
      )
      .subscribe()
  }

  // Initialize store by fetching runs and starting subscription
  const initializeStore = async (): Promise<void> => {
    if (isInitialized) return
    isInitialized = true
    await fetchRuns()
    startSubscription()
  }

  // Cleanup: unsubscribe and reset state
  const cleanup = () => {
    if (channel) {
      channel.unsubscribe()
      channel = null
    }
    pendingItemRefetch.forEach((timer) => clearTimeout(timer))
    pendingItemRefetch.clear()
    runs.value = []
    itemsByRun.value = {}
    error.value = null
    isInitialized = false
  }

  return {
    // State
    runs,
    itemsByRun,
    loading,
    error,

    // Getters
    totalRuns,
    getRunByPeriod,
    getItems,

    // Actions
    fetchRuns,
    fetchRunItems,
    savePayrollRun,
    deletePayrollRun,
    initializeStore,
    cleanup,
  }
})

export type { PayrollRun, PayrollRunItem }

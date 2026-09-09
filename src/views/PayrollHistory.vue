<template>
  <div class="px-2 py-3 sm:px-0 sm:py-6">
    <div class="border-4 border-dashed border-gray-200 rounded-lg p-3 sm:p-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">
          {{
            selectedRun ? `Payroll Record: ${formatPeriodLabel(selectedRun)}` : 'Payroll History'
          }}
        </h2>
        <div v-if="selectedRun" class="flex flex-col sm:flex-row gap-2">
          <button
            @click="backToList"
            class="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Back to History
          </button>
          <button
            @click="downloadAllPayslips"
            :disabled="!selectedItems.length"
            class="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Download All Payslips
          </button>
        </div>
      </div>

      <!-- Error Alert -->
      <ErrorAlert
        v-if="payrollRecordsStore.error"
        :title="'Error'"
        :message="payrollRecordsStore.error"
        class="mb-4 sm:mb-6"
      />

      <!-- Show Salaries Toggle -->
      <div v-if="payrollRecordsStore.runs.length > 0" class="mb-4 sm:mb-6 flex items-center gap-2">
        <input
          id="show-salaries-history"
          v-model="showSalaries"
          type="checkbox"
          class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label for="show-salaries-history" class="text-sm font-medium text-gray-700">
          Show Salaries
        </label>
      </div>

      <!-- Loading Spinner -->
      <LoadingSpinner v-if="payrollRecordsStore.loading" />

      <!-- Saved Periods List -->
      <div v-else-if="!selectedRun" class="space-y-4">
        <!-- Desktop Table -->
        <div class="bg-white shadow overflow-hidden sm:rounded-md hidden lg:block">
          <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 class="text-lg leading-6 font-medium text-gray-900">
              Saved Periods ({{ payrollRecordsStore.runs.length }})
            </h3>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Period
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Saved On
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="run in payrollRecordsStore.runs" :key="run.id" class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ formatPeriodLabel(run) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {{ formatTimestamp(run.finalized_at) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <ActionButtonGroup
                      :actions="getRunActions()"
                      size="sm"
                      :loading="payrollRecordsStore.loading"
                      @action-click="(actionKey) => handleActionClick(actionKey, run)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Mobile Cards -->
        <div class="lg:hidden space-y-3">
          <div
            v-for="run in payrollRecordsStore.runs"
            :key="run.id"
            class="bg-white p-4 rounded-lg shadow"
          >
            <h3 class="text-sm font-medium text-gray-900 mb-1">{{ formatPeriodLabel(run) }}</h3>
            <div class="text-sm text-gray-600 mb-3">
              <span class="font-medium">Saved On:</span>
              <span class="ml-1">{{ formatTimestamp(run.finalized_at) }}</span>
            </div>
            <div class="pt-2 border-t border-gray-100">
              <ActionButtonGroup
                :actions="getRunActions()"
                size="sm"
                :loading="payrollRecordsStore.loading"
                @action-click="(actionKey) => handleActionClick(actionKey, run)"
                class="w-full"
              />
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <EmptyState
          v-if="payrollRecordsStore.runs.length === 0"
          title="No payroll records yet"
          description="Process a payroll on the Payroll page and save it to keep a permanent record of that month."
        />
      </div>

      <!-- Selected Record Detail -->
      <div v-else class="space-y-4">
        <div class="bg-white rounded-lg shadow p-4 sm:p-6">
          <div class="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <div class="flex items-center gap-2">
              <CalendarIcon class="w-4 h-4 text-blue-500" />
              <span class="text-sm font-medium text-blue-800">
                Saved on {{ formatTimestamp(selectedRun.finalized_at) }} — these figures are frozen
                and are not affected by later employee changes.
              </span>
            </div>
          </div>

          <!-- Desktop Table -->
          <div class="hidden md:block overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Employee
                  </th>
                  <th
                    v-for="column in amountColumns"
                    :key="column.key"
                    class="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {{ column.label }}
                  </th>
                  <th
                    class="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Payslip
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="item in selectedItems" :key="item.id">
                  <td class="px-2 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ item.employee_name }}
                  </td>
                  <td
                    v-for="column in amountColumns"
                    :key="column.key"
                    class="px-2 py-4 whitespace-nowrap text-sm text-right"
                    :class="
                      column.key === 'net_salary' ? 'font-medium text-gray-900' : 'text-gray-600'
                    "
                  >
                    <span v-if="showSalaries">RM {{ formatCurrency(item[column.key]) }}</span>
                    <span v-else class="text-gray-400">••••••</span>
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap text-center">
                    <button
                      @click="downloadPayslip(item)"
                      class="text-indigo-600 hover:text-indigo-900 text-sm font-medium underline"
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              </tbody>
              <tfoot class="bg-gray-100">
                <tr class="border-t-2 border-gray-300">
                  <td class="px-2 py-4 whitespace-nowrap text-sm font-bold text-gray-700">TOTAL</td>
                  <td
                    v-for="column in amountColumns"
                    :key="column.key"
                    class="px-2 py-4 whitespace-nowrap text-sm font-bold text-gray-700 text-right"
                  >
                    <span v-if="showSalaries">RM {{ formatCurrency(totals[column.key]) }}</span>
                    <span v-else class="text-gray-400">••••••</span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Mobile Cards -->
          <div class="md:hidden space-y-4">
            <div
              v-for="item in selectedItems"
              :key="item.id"
              class="border border-gray-200 rounded-lg p-4"
            >
              <h4 class="font-medium text-gray-900 mb-3">{{ item.employee_name }}</h4>
              <div class="space-y-2 text-sm">
                <div v-for="column in amountColumns" :key="column.key" class="flex justify-between">
                  <span class="text-gray-600">{{ column.label }}:</span>
                  <span v-if="showSalaries" class="font-medium">
                    RM {{ formatCurrency(item[column.key]) }}
                  </span>
                  <span v-else class="text-gray-400">••••••</span>
                </div>
              </div>
              <button
                @click="downloadPayslip(item)"
                class="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Download Payslip (PDF)
              </button>
            </div>

            <EmptyState
              v-if="selectedItems.length === 0"
              title="No employees in this record"
              description="This saved period does not contain any employee rows."
            />
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <ActionModal
        :is-open="showDeleteModal"
        :title="`Delete Payroll Record: ${deleteRun ? formatPeriodLabel(deleteRun) : ''}`"
        variant="red"
        confirm-text="Delete Record"
        :loading="deleteLoading"
        :disabled="!deleteConfirmation"
        @confirm="confirmDeleteRun"
        @cancel="cancelDeleteRun"
        @close="cancelDeleteRun"
      >
        <div class="space-y-4">
          <div class="bg-red-50 border border-red-200 rounded-md p-3">
            <div class="flex items-center gap-2 mb-2">
              <WarningTriangleIcon class="w-4 h-4 text-red-500" />
              <span class="text-sm font-medium text-red-800">
                Warning: This action cannot be undone
              </span>
            </div>
            <p class="text-sm text-red-700">
              You are about to permanently delete the saved payroll record for
              {{ deleteRun ? formatPeriodLabel(deleteRun) : '' }}, including every employee's frozen
              figures for that month.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <input
              id="delete-record-confirmation"
              v-model="deleteConfirmation"
              type="checkbox"
              class="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <label for="delete-record-confirmation" class="text-sm text-gray-700">
              I understand that this action is permanent and cannot be undone
            </label>
          </div>
        </div>
      </ActionModal>
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionButtonGroup, {
  type ActionButtonGroupAction,
} from '@/components/ui/ActionButtonGroup.vue'
import ActionModal from '@/components/ui/ActionModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorAlert from '@/components/ui/ErrorAlert.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import CalendarIcon from '@/components/icons/CalendarIcon.vue'
import WarningTriangleIcon from '@/components/icons/WarningTriangleIcon.vue'
import {
  allPayslipsFilename,
  generatePayslipPdf,
  payslipFilename,
  type PayslipEmployee,
} from '@/lib/payslip'
import { usePayrollStore } from '@/stores/payroll'
import {
  usePayrollRecordsStore,
  type PayrollRun,
  type PayrollRunItem,
} from '@/stores/payrollRecords'
import { computed, ref } from 'vue'

const payrollRecordsStore = usePayrollRecordsStore()
const payrollStore = usePayrollStore()

const showSalaries = ref(false)
const selectedRunId = ref<string | null>(null)

// Delete modal variables
const showDeleteModal = ref(false)
const deleteRun = ref<PayrollRun | null>(null)
const deleteLoading = ref(false)
const deleteConfirmation = ref(false)

// Numeric columns rendered in the detail table, in display order
type AmountKey = Extract<
  keyof PayrollRunItem,
  | 'basic_salary'
  | 'epf_employer'
  | 'epf_employee'
  | 'socso_employer'
  | 'socso_employee'
  | 'eis_employer'
  | 'eis_employee'
  | 'lindung_24_jam'
  | 'pcb'
  | 'cp38'
  | 'net_salary'
>

const allAmountColumns: Array<{ key: AmountKey; label: string }> = [
  { key: 'basic_salary', label: 'Basic Salary' },
  { key: 'epf_employer', label: 'EPF Employer' },
  { key: 'epf_employee', label: 'EPF Employee' },
  { key: 'socso_employer', label: 'SOCSO Employer' },
  { key: 'socso_employee', label: 'SOCSO Employee' },
  { key: 'eis_employer', label: 'EIS Employer' },
  { key: 'eis_employee', label: 'EIS Employee' },
  { key: 'lindung_24_jam', label: 'Lindung 24 Jam' },
  { key: 'pcb', label: 'PCB' },
  { key: 'cp38', label: 'CP38' },
  { key: 'net_salary', label: 'Net Salary' },
]

const selectedRun = computed(
  () => payrollRecordsStore.runs.find((run) => run.id === selectedRunId.value) || null,
)

// Periods before July 2026 predate Lindung 24 Jam, so the column is meaningless there
const amountColumns = computed(() => {
  const run = selectedRun.value
  if (run && !payrollStore.isLindung24Applicable(run.year, run.month)) {
    return allAmountColumns.filter((column) => column.key !== 'lindung_24_jam')
  }
  return allAmountColumns
})

const selectedItems = computed(() =>
  selectedRunId.value ? payrollRecordsStore.getItems(selectedRunId.value) : [],
)

const totals = computed(() => {
  const result = Object.fromEntries(amountColumns.value.map((column) => [column.key, 0])) as Record<
    AmountKey,
    number
  >

  selectedItems.value.forEach((item) => {
    amountColumns.value.forEach((column) => {
      result[column.key] += item[column.key]
    })
  })

  return result
})

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const formatPeriodLabel = (run: Pick<PayrollRun, 'month' | 'year'>): string =>
  `${monthNames[run.month - 1]} ${run.year}`

const formatTimestamp = (timestamp: string): string =>
  new Date(timestamp).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const formatCurrency = (amount: number): string =>
  amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const toPayslipEmployee = (item: PayrollRunItem): PayslipEmployee => ({
  name: item.employee_name,
  basicSalary: item.basic_salary,
  epfEmployee: item.epf_employee,
  epfEmployer: item.epf_employer,
  socsoEmployee: item.socso_employee,
  socsoEmployer: item.socso_employer,
  eisEmployee: item.eis_employee,
  eisEmployer: item.eis_employer,
  lindung24: item.lindung_24_jam,
  pcb: item.pcb,
  cp38: item.cp38,
  netSalary: item.net_salary,
})

const openRun = async (run: PayrollRun) => {
  selectedRunId.value = run.id
  // Items are loaded on demand, and dropped from the cache when they change
  if (!payrollRecordsStore.getItems(run.id).length) {
    await payrollRecordsStore.fetchRunItems(run.id)
  }
}

const backToList = () => {
  selectedRunId.value = null
}

const downloadPayslip = (item: PayrollRunItem) => {
  if (!selectedRun.value) return
  const period = { month: selectedRun.value.month, year: selectedRun.value.year }
  generatePayslipPdf([toPayslipEmployee(item)], period, payslipFilename(item.employee_name, period))
}

const downloadAllPayslips = () => {
  if (!selectedRun.value || !selectedItems.value.length) return
  const period = { month: selectedRun.value.month, year: selectedRun.value.year }
  generatePayslipPdf(
    selectedItems.value.map(toPayslipEmployee),
    period,
    allPayslipsFilename(period),
  )
}

// Action button configurations
const getRunActions = (): Array<ActionButtonGroupAction> => [
  {
    key: 'view',
    label: 'View Record',
    variant: 'blue',
  },
  {
    key: 'delete',
    label: 'Delete',
    variant: 'red',
  },
]

const handleActionClick = (actionKey: string, run: PayrollRun) => {
  switch (actionKey) {
    case 'view':
      openRun(run)
      break
    case 'delete':
      openDeleteModal(run)
      break
  }
}

const openDeleteModal = (run: PayrollRun) => {
  deleteRun.value = { ...run }
  showDeleteModal.value = true
  deleteConfirmation.value = false
}

const confirmDeleteRun = async () => {
  if (!deleteRun.value) return

  deleteLoading.value = true
  try {
    const deletedId = deleteRun.value.id
    const success = await payrollRecordsStore.deletePayrollRun(deletedId)
    if (success && selectedRunId.value === deletedId) selectedRunId.value = null
    cancelDeleteRun()
  } finally {
    deleteLoading.value = false
  }
}

const cancelDeleteRun = () => {
  showDeleteModal.value = false
  deleteRun.value = null
  deleteConfirmation.value = false
  deleteLoading.value = false
}
</script>

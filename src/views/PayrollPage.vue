<template>
  <div class="px-2 py-3 sm:px-0 sm:py-6">
    <div class="border-4 border-dashed border-gray-200 rounded-lg p-3 sm:p-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Payroll Management</h2>
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            v-if="
              !showAddForm &&
              !showPayrollTable &&
              !showMonthSelection &&
              payrollStore.employees.length > 0
            "
            @click="showMonthSelection = true"
            class="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Process Payroll
          </button>
          <button
            v-if="!showAddForm && !showPayrollTable && !showMonthSelection"
            @click="showAddForm = true"
            class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Add Employee
          </button>
        </div>
      </div>

      <!-- Add Employee Form -->
      <div v-if="showAddForm" class="bg-white p-4 sm:p-6 rounded-lg shadow mb-4 sm:mb-6">
        <h3 class="text-base sm:text-lg font-medium text-gray-900 mb-4">Add New Employee</h3>
        <form @submit.prevent="addEmployee">
          <div class="space-y-4 sm:grid sm:grid-cols-3 sm:gap-6 sm:space-y-0">
            <FormField
              v-model="newEmployee.name"
              type="text"
              label="Employee Name"
              placeholder="Enter employee name"
              :required="true"
            />

            <FormField
              v-model="newEmployee.basic_salary"
              type="number"
              label="Basic Salary (RM)"
              placeholder="0.00"
              :required="true"
              :min="0"
              step="0.01"
            />

            <div>
              <FormField
                v-model="newEmployee.epf_employer"
                type="number"
                label="EPF Employer Contribution (RM)"
                placeholder="0.00"
                :required="true"
                :min="0"
                step="0.01"
                :disabled="useDefaultEpf"
              />
              <div class="flex items-center gap-2 mt-2">
                <input
                  id="use-default-epf"
                  v-model="useDefaultEpf"
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label for="use-default-epf" class="text-sm text-gray-600">
                  Use Default EPF Employer Contribution
                </label>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-6">
            <button
              type="button"
              @click="cancelAddForm"
              class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="
                payrollStore.loading ||
                !newEmployee.name.trim() ||
                !newEmployee.basic_salary ||
                newEmployee.basic_salary <= 0 ||
                !newEmployee.epf_employer ||
                newEmployee.epf_employer < 0
              "
              class="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {{ payrollStore.loading ? 'Adding...' : 'Add Employee' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Error Alert -->
      <ErrorAlert
        v-if="payrollStore.error"
        :title="'Error'"
        :message="payrollStore.error"
        class="mb-4 sm:mb-6"
      />

      <!-- Month Selection (shown when Process Payroll is clicked) -->
      <div
        v-if="showMonthSelection && !showPayrollTable"
        class="bg-white p-4 sm:p-6 rounded-lg shadow mb-4 sm:mb-6"
      >
        <h3 class="text-base sm:text-lg font-medium text-gray-900 mb-4">Select Payroll Period</h3>
        <div class="flex flex-col gap-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              v-model="selectedMonth"
              type="select"
              label="Month"
              placeholder="Select Month"
              :required="true"
              :options="monthOptions"
            />

            <FormField
              v-model="selectedYear"
              type="select"
              label="Year"
              :required="true"
              :options="yearOptions"
            />
          </div>

          <!-- Selected Period Display -->
          <div
            v-if="selectedMonth && selectedYear"
            class="bg-blue-50 border border-blue-200 rounded-md p-3"
          >
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                  clip-rule="evenodd"
                />
              </svg>
              <span class="text-sm font-medium text-blue-800">
                Selected Period: {{ formatSelectedPeriod }}
              </span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-end gap-2">
            <button
              @click="cancelMonthSelection"
              class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              :disabled="!selectedMonth || !selectedYear"
              @click="processPayroll"
              class="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Generate Payroll
            </button>
          </div>
        </div>
      </div>

      <!-- Search Bar and Controls -->
      <div
        v-if="
          !showAddForm &&
          !showPayrollTable &&
          !showMonthSelection &&
          payrollStore.employees.length > 0
        "
        class="mb-4 sm:mb-6 space-y-4"
      >
        <SearchInput v-model="searchQuery" placeholder="Search employees..." />

        <!-- Show Salaries Toggle -->
        <div class="flex items-center gap-2">
          <input
            id="show-salaries"
            v-model="showSalaries"
            type="checkbox"
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="show-salaries" class="text-sm font-medium text-gray-700">
            Show Salaries
          </label>
        </div>
      </div>

      <!-- Loading Spinner -->
      <LoadingSpinner v-if="payrollStore.loading && !showAddForm" />

      <!-- Employee List -->
      <div v-else-if="!showPayrollTable" class="space-y-4">
        <!-- Desktop Table -->
        <div class="bg-white shadow overflow-hidden sm:rounded-md">
          <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 class="text-lg leading-6 font-medium text-gray-900">
              Employees ({{ filteredEmployees.length }})
            </h3>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Employee Name
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Basic Salary
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    EPF Employer
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr
                  v-for="employee in filteredEmployees"
                  :key="employee.id"
                  class="hover:bg-gray-50"
                >
                  <td class="px-6 py-4 text-sm font-medium text-gray-900 min-w-0 max-w-xs">
                    <div class="break-words">{{ employee.name }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span v-if="showSalaries">RM {{ formatCurrency(employee.basic_salary) }}</span>
                    <span v-else class="text-gray-400">••••••</span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span v-if="showSalaries">RM {{ formatCurrency(employee.epf_employer) }}</span>
                    <span v-else class="text-gray-400">••••••</span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <ActionButtonGroup
                      :actions="getEmployeeActions()"
                      size="sm"
                      :loading="payrollStore.loading"
                      @action-click="(actionKey) => handleActionClick(actionKey, employee)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Mobile Cards -->
        <div class="md:hidden space-y-3">
          <div
            v-for="employee in filteredEmployees"
            :key="employee.id"
            class="bg-white p-4 rounded-lg shadow"
          >
            <div class="flex justify-between items-start mb-2">
              <h3 class="text-sm font-medium text-gray-900">{{ employee.name }}</h3>
            </div>
            <div class="text-sm text-gray-600 mb-3 space-y-1">
              <div>
                <span class="font-medium">Salary:</span>
                <span v-if="showSalaries" class="ml-1"
                  >RM {{ formatCurrency(employee.basic_salary) }}</span
                >
                <span v-else class="ml-1 text-gray-400">••••••</span>
              </div>
              <div>
                <span class="font-medium">EPF Employer:</span>
                <span v-if="showSalaries" class="ml-1"
                  >RM {{ formatCurrency(employee.epf_employer) }}</span
                >
                <span v-else class="ml-1 text-gray-400">••••••</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="pt-2 border-t border-gray-100">
              <ActionButtonGroup
                :actions="getEmployeeActions()"
                size="sm"
                :loading="payrollStore.loading"
                @action-click="(actionKey) => handleActionClick(actionKey, employee)"
                class="w-full"
              />
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <EmptyState
          v-if="filteredEmployees.length === 0 && payrollStore.employees.length === 0"
          title="No employees found"
          description="Add your first employee to get started with payroll management."
        />

        <!-- No Search Results -->
        <EmptyState
          v-else-if="filteredEmployees.length === 0 && searchQuery"
          title="No employees found"
          description="Try adjusting your search terms."
        />
      </div>

      <!-- Payroll Processing Table -->
      <div v-else-if="showPayrollTable" class="space-y-4">
        <div class="bg-white rounded-lg shadow p-4 sm:p-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-900">
              Payroll for {{ formatMonth(combinedMonthYear) }}
            </h3>
            <div class="flex gap-2">
              <button
                @click="backToEmployeeList"
                class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Back to Employee List
              </button>
              <button
                @click="generateExcel"
                :disabled="!canGenerateExcel"
                class="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Generate Excel
              </button>
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
                    class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Basic Salary
                  </th>
                  <th
                    class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    EPF Employer
                  </th>
                  <th
                    class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    EPF Employee
                  </th>
                  <th
                    class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    SOCSO Employer
                  </th>
                  <th
                    class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    SOCSO Employee
                  </th>
                  <th
                    class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    EIS Employer
                  </th>
                  <th
                    class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    EIS Employee
                  </th>
                  <th
                    class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    PCB (RM)
                  </th>
                  <th
                    class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    CP38 (RM)
                  </th>
                  <th
                    class="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Net Salary
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="payroll in payrollData" :key="payroll.employeeId">
                  <td class="px-2 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ payroll.employeeName }}
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                    RM {{ formatCurrency(payroll.basicSalary) }}
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap text-sm text-gray-600">
                    RM {{ formatCurrency(payroll.epfEmployer) }}
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap text-sm text-gray-600">
                    RM {{ formatCurrency(payroll.epfEmployee) }}
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap text-sm text-gray-600">
                    RM {{ formatCurrency(payroll.socsoEmployer) }}
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap text-sm text-gray-600">
                    RM {{ formatCurrency(payroll.socsoEmployee) }}
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap text-sm text-gray-600">
                    RM {{ formatCurrency(payroll.eisEmployer) }}
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap text-sm text-gray-600">
                    RM {{ formatCurrency(payroll.eisEmployee) }}
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap">
                    <input
                      v-model.number="payroll.pcb"
                      type="number"
                      min="0"
                      step="0.01"
                      class="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap">
                    <input
                      v-model.number="payroll.cp38"
                      type="number"
                      min="0"
                      step="0.01"
                      class="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </td>
                  <td class="px-2 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    RM {{ formatCurrency(payrollStore.calculateNetSalary(payroll)) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Cards for Payroll -->
          <div class="md:hidden space-y-4">
            <div
              v-for="payroll in payrollData"
              :key="payroll.employeeId"
              class="border border-gray-200 rounded-lg p-4"
            >
              <h4 class="font-medium text-gray-900 mb-3">{{ payroll.employeeName }}</h4>
              <div class="space-y-3">
                <div>
                  <span class="text-sm text-gray-600">Basic Salary:</span>
                  <span class="font-medium ml-2">RM {{ formatCurrency(payroll.basicSalary) }}</span>
                </div>

                <!-- Contributions Grid -->
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <div class="bg-gray-50 p-2 rounded">
                    <div class="font-medium text-gray-700 mb-1">EPF</div>
                    <div>Employer: RM {{ formatCurrency(payroll.epfEmployer) }}</div>
                    <div>Employee: RM {{ formatCurrency(payroll.epfEmployee) }}</div>
                  </div>
                  <div class="bg-gray-50 p-2 rounded">
                    <div class="font-medium text-gray-700 mb-1">SOCSO</div>
                    <div>Employer: RM {{ formatCurrency(payroll.socsoEmployer) }}</div>
                    <div>Employee: RM {{ formatCurrency(payroll.socsoEmployee) }}</div>
                  </div>
                  <div class="bg-gray-50 p-2 rounded">
                    <div class="font-medium text-gray-700 mb-1">EIS</div>
                    <div>Employer: RM {{ formatCurrency(payroll.eisEmployer) }}</div>
                    <div>Employee: RM {{ formatCurrency(payroll.eisEmployee) }}</div>
                  </div>
                </div>

                <!-- Manual Inputs -->
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">PCB (RM)</label>
                    <input
                      v-model.number="payroll.pcb"
                      type="number"
                      min="0"
                      step="0.01"
                      class="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">CP38 (RM)</label>
                    <input
                      v-model.number="payroll.cp38"
                      type="number"
                      min="0"
                      step="0.01"
                      class="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div class="pt-2 border-t border-gray-200">
                  <span class="text-sm text-gray-600">Net Salary:</span>
                  <span class="font-medium text-lg ml-2"
                    >RM {{ formatCurrency(payrollStore.calculateNetSalary(payroll)) }}</span
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit Employee Modal -->
      <ActionModal
        :is-open="showEditModal"
        :title="`Edit Employee: ${editEmployee?.name || ''}`"
        variant="green"
        confirm-text="Update Employee"
        :loading="payrollStore.loading"
        :disabled="
          !editEmployee?.name?.trim() ||
          !editEmployee?.basic_salary ||
          editEmployee?.basic_salary <= 0 ||
          !editEmployee?.epf_employer ||
          editEmployee?.epf_employer < 0
        "
        @confirm="confirmEditEmployee"
        @cancel="cancelEditEmployee"
        @close="cancelEditEmployee"
      >
        <div class="space-y-4">
          <!-- Information Box -->
          <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clip-rule="evenodd"
                />
              </svg>
              <span class="text-sm font-medium text-blue-800">Update Employee Information</span>
            </div>
            <p class="text-sm text-blue-700">
              Modify the employee's basic information and EPF employer contribution. Changes will be
              applied immediately and reflected in all payroll calculations.
            </p>
          </div>

          <!-- Edit Form Fields -->
          <div v-if="editEmployee" class="space-y-4">
            <FormField
              v-model="editEmployee.name"
              type="text"
              label="Employee Name"
              placeholder="Enter employee name"
              :required="true"
            />

            <FormField
              v-model="editEmployee.basic_salary"
              type="number"
              label="Basic Salary (RM)"
              placeholder="0.00"
              :required="true"
              :min="0"
              step="0.01"
            />

            <div>
              <FormField
                v-model="editEmployee.epf_employer"
                type="number"
                label="EPF Employer Contribution (RM)"
                placeholder="0.00"
                :required="true"
                :min="0"
                step="0.01"
                :disabled="useDefaultEpfEdit"
              />
              <div class="flex items-center gap-2 mt-2">
                <input
                  id="use-default-epf-edit"
                  v-model="useDefaultEpfEdit"
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label for="use-default-epf-edit" class="text-sm text-gray-600">
                  Use Default EPF Employer Contribution
                </label>
              </div>
            </div>
          </div>
        </div>
      </ActionModal>

      <!-- Delete Confirmation Modal -->
      <ActionModal
        :is-open="showDeleteModal"
        :title="`Delete Employee: ${deleteEmployee?.name || ''}`"
        variant="red"
        confirm-text="Delete Employee"
        :loading="deleteLoading"
        :disabled="!deleteConfirmation"
        @confirm="confirmDeleteEmployee"
        @cancel="cancelDeleteEmployee"
        @close="cancelDeleteEmployee"
      >
        <div class="space-y-4">
          <!-- Confirmation Message -->
          <div class="bg-red-50 border border-red-200 rounded-md p-3">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clip-rule="evenodd"
                />
              </svg>
              <span class="text-sm font-medium text-red-800"
                >Warning: This action cannot be undone</span
              >
            </div>
            <p class="text-sm text-red-700">
              You are about to permanently delete this employee record. This will remove all
              associated payroll data.
            </p>
          </div>

          <!-- Employee Details -->
          <div class="bg-gray-50 border border-gray-200 rounded-md p-3">
            <h4 class="text-sm font-medium text-gray-900 mb-2">Employee Details:</h4>
            <div class="space-y-1 text-sm text-gray-600">
              <div><span class="font-medium">Name:</span> {{ deleteEmployee?.name }}</div>
              <div>
                <span class="font-medium">Basic Salary:</span> RM
                {{ formatCurrency(deleteEmployee?.basic_salary || 0) }}
              </div>
              <div>
                <span class="font-medium">EPF Employer:</span> RM
                {{ formatCurrency(deleteEmployee?.epf_employer || 0) }}
              </div>
            </div>
          </div>

          <!-- Confirmation Checkbox -->
          <div class="flex items-center gap-2">
            <input
              id="delete-confirmation"
              v-model="deleteConfirmation"
              type="checkbox"
              class="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <label for="delete-confirmation" class="text-sm text-gray-700">
              I understand that this action is permanent and cannot be undone
            </label>
          </div>
        </div>
      </ActionModal>
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionButtonGroup from '@/components/ui/ActionButtonGroup.vue'
import ActionModal from '@/components/ui/ActionModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorAlert from '@/components/ui/ErrorAlert.vue'
import FormField from '@/components/ui/FormField.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import { usePayrollStore, type Employee, type EmployeeInsert } from '@/stores/payroll'
import type { PayrollData } from '@/types/payroll'
import { computed, onMounted, ref, watch } from 'vue'
import * as XLSX from 'xlsx'

const payrollStore = usePayrollStore()
const showAddForm = ref(false)
const showSalaries = ref(false)
const showPayrollTable = ref(false)
const showMonthSelection = ref(false)
const selectedMonth = ref('')
const selectedYear = ref(new Date().getFullYear())
const payrollData = ref<PayrollData[]>([])
const searchQuery = ref('')

// Edit modal variables
const showEditModal = ref(false)
const editEmployee = ref<Employee | null>(null)
const useDefaultEpfEdit = ref(true)

// Delete modal variables
const showDeleteModal = ref(false)
const deleteEmployee = ref<Employee | null>(null)
const deleteLoading = ref(false)
const deleteConfirmation = ref(false)

// Set default month and year to current
const now = new Date()
selectedMonth.value = String(now.getMonth() + 1).padStart(2, '0')
selectedYear.value = now.getFullYear()

const useDefaultEpf = ref(true)

const newEmployee = ref<EmployeeInsert>({
  name: '',
  basic_salary: 0,
  epf_employer: 0,
})

const canGenerateExcel = computed(() => {
  return payrollData.value.length > 0 && payrollData.value.some((p) => p.pcb > 0 || p.cp38 > 0)
})

// Filtered employees based on search query
const filteredEmployees = computed(() => {
  if (!searchQuery.value) {
    return payrollStore.employees
  }
  return payrollStore.employees.filter((employee) =>
    employee.name.toLowerCase().includes(searchQuery.value.toLowerCase()),
  )
})

// Available months for selection
const monthOptions = computed(() => [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
])

// Available years for selection (current year + previous 2 years + next year)
const availableYears = computed(() => {
  const currentYear = new Date().getFullYear()
  return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1]
})

// Year options for FormField
const yearOptions = computed(() =>
  availableYears.value.map((year) => ({ value: year, label: year.toString() })),
)

// Format selected period for display
const formatSelectedPeriod = computed(() => {
  if (!selectedMonth.value || !selectedYear.value) return ''
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
  const monthIndex = parseInt(selectedMonth.value) - 1
  return `${monthNames[monthIndex]} ${selectedYear.value}`
})

// Combined month-year string for internal use
const combinedMonthYear = computed(() => {
  if (!selectedMonth.value || !selectedYear.value) return ''
  return `${selectedYear.value}-${selectedMonth.value}`
})

// Helper function to get account code and description based on employee name
const getEmployeeAccountInfo = (employeeName: string) => {
  const nameLower = employeeName.toLowerCase()

  if (nameLower.includes('ng sing beng')) {
    return {
      salaryCode: ['927-000', 'DR. NG SING BENG'],
      epfCode: ['908-001', 'EPF CONTRIBUTION - PARTNERS'],
      socsoCode: ['909-001', 'SOCSO CONTRIBUTION - PARTNERS'],
      eisCode: ['909-003', 'SOCSO(EIS) CONTRIBUTION - PARTNERS'],
      description: 'DR. NG SING BENG',
    }
  } else if (nameLower.includes('tan choon ling')) {
    return {
      salaryCode: ['928-000', 'TAN CHOON LING'],
      epfCode: ['908-001', 'EPF CONTRIBUTION - PARTNERS'],
      socsoCode: ['909-001', 'SOCSO CONTRIBUTION - PARTNERS'],
      eisCode: ['909-003', 'SOCSO(EIS) CONTRIBUTION - PARTNERS'],
      description: 'TAN CHOON LING',
    }
  } else {
    return {
      salaryCode: ['940-000', 'SALARIES'],
      epfCode: ['908-000', 'EPF CONTRIBUTION - STAFF'],
      socsoCode: ['909-000', 'SOCSO CONTRIBUTION - STAFF'],
      eisCode: ['909-002', 'SOCSO(EIS) CONTRIBUTION - STAFF'],
      description: 'SALARIES',
    }
  }
}

// Calculate default EPF employer contribution
const calculateDefaultEpfEmployer = (salary: number): number => {
  const employerRate = salary > 5000 ? 0.12 : 0.13
  return Math.round(salary * employerRate * 100) / 100
}

// Watch for changes in salary or default EPF checkbox (add employee)
watch(
  [() => newEmployee.value.basic_salary, useDefaultEpf],
  ([salary, useDefault]) => {
    if (useDefault && salary > 0) {
      newEmployee.value.epf_employer = calculateDefaultEpfEmployer(salary)
    }
  },
  { immediate: true },
)

// Watch for changes in salary or default EPF checkbox (edit employee)
watch(
  [() => editEmployee.value?.basic_salary, useDefaultEpfEdit],
  ([salary, useDefault]) => {
    if (useDefault && salary && salary > 0 && editEmployee.value) {
      editEmployee.value.epf_employer = calculateDefaultEpfEmployer(salary)
    }
  },
  { immediate: true },
)

const formatCurrency = (amount: number): string => {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const formatMonth = (monthString: string): string => {
  if (!monthString) return formatSelectedPeriod.value || ''
  const date = new Date(monthString + '-01')
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

const addEmployee = async () => {
  const result = await payrollStore.addEmployee(newEmployee.value)
  if (result) {
    cancelAddForm()
  }
}

// Action button configurations
const getEmployeeActions = (): Array<{
  key: string
  label: string
  variant: 'blue' | 'gray' | 'red' | 'green' | 'yellow' | 'cyan'
}> => {
  return [
    {
      key: 'edit',
      label: 'Edit Employee',
      variant: 'blue',
    },
    {
      key: 'delete',
      label: 'Delete',
      variant: 'red',
    },
  ]
}

// Handle action button clicks
const handleActionClick = (actionKey: string, employee: Employee) => {
  switch (actionKey) {
    case 'edit':
      openEditModal(employee)
      break
    case 'delete':
      openDeleteModal(employee)
      break
  }
}

const openEditModal = (employee: Employee) => {
  editEmployee.value = { ...employee }

  // Check if current EPF value matches the calculated default value
  const calculatedEpf = calculateDefaultEpfEmployer(employee.basic_salary)
  const currentEpf = employee.epf_employer

  // If the current EPF matches the calculated value (within a small tolerance for rounding)
  // then check the "use default" checkbox, otherwise uncheck it
  const epfMatches = Math.abs(currentEpf - calculatedEpf) < 0.01
  useDefaultEpfEdit.value = epfMatches

  showEditModal.value = true
}

const confirmEditEmployee = async () => {
  if (!editEmployee.value) return

  const result = await payrollStore.updateEmployee(editEmployee.value.id, {
    name: editEmployee.value.name,
    basic_salary: editEmployee.value.basic_salary,
    epf_employer: editEmployee.value.epf_employer,
  })

  if (result) {
    cancelEditEmployee()
  }
}

const cancelEditEmployee = () => {
  showEditModal.value = false
  editEmployee.value = null
  useDefaultEpfEdit.value = true
}

const openDeleteModal = (employee: Employee) => {
  deleteEmployee.value = { ...employee }
  showDeleteModal.value = true
  deleteConfirmation.value = false
}

const confirmDeleteEmployee = async () => {
  if (!deleteEmployee.value) return

  deleteLoading.value = true
  try {
    await payrollStore.deleteEmployee(deleteEmployee.value.id)
    cancelDeleteEmployee()
  } finally {
    deleteLoading.value = false
  }
}

const cancelDeleteEmployee = () => {
  showDeleteModal.value = false
  deleteEmployee.value = null
  deleteConfirmation.value = false
  deleteLoading.value = false
}

const cancelAddForm = () => {
  showAddForm.value = false
  useDefaultEpf.value = true
  newEmployee.value = {
    name: '',
    basic_salary: 0,
    epf_employer: 0,
  }
}

const cancelMonthSelection = () => {
  showMonthSelection.value = false
  // Don't reset the selected month and year - preserve user's choice
}

const processPayroll = () => {
  showMonthSelection.value = false
  showPayrollTable.value = true
  payrollData.value = payrollStore.generatePayrollData()
}

const backToEmployeeList = () => {
  showPayrollTable.value = false
  showMonthSelection.value = false
}

const generateExcel = () => {
  if (!payrollData.value.length) {
    alert('No payroll data to export')
    return
  }

  const wb = XLSX.utils.book_new()
  const monthNames = [
    'JANUARY',
    'FEBRUARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVEMBER',
    'DECEMBER',
  ]
  const monthName = monthNames[parseInt(selectedMonth.value) - 1]
  const year = selectedYear.value
  const excelData: (string | number)[][] = []

  // Helper to add section
  const addSection = (
    title: string,
    rows: (string | number)[][],
    accrualEntry: (string | number)[] | null = null,
  ) => {
    excelData.push([title, '', '', '', ''])
    rows.forEach((row: (string | number)[]) => excelData.push(row))
    if (accrualEntry) excelData.push(accrualEntry)
    excelData.push(['', '', '', '', ''])
  }

  // Helper to create employee rows
  const createEmployeeRows = (
    type: string,
    field: keyof PayrollData,
    codeType: 'salaryCode' | 'epfCode' | 'socsoCode' | 'eisCode',
  ) => {
    return payrollData.value.map((emp) => {
      const info = getEmployeeAccountInfo(emp.employeeName)
      const value = emp[field] as number
      const code = info[codeType] as string[]
      return [
        code[0],
        code[1],
        `${type} - ${monthName} ${year} (${emp.employeeName})`,
        value.toFixed(2),
        '0.00',
      ]
    })
  }

  // Salary section
  const salaryRows = payrollData.value.map((emp) => {
    const info = getEmployeeAccountInfo(emp.employeeName)
    const netSalary = payrollStore.calculateNetSalary(emp)
    return [
      info.salaryCode[0],
      info.salaryCode[1],
      `SALARIES - ${monthName} ${year} (${emp.employeeName})`,
      netSalary.toFixed(2),
      '0.00',
    ]
  })
  const totalSalary = payrollData.value.reduce(
    (sum, emp) => sum + payrollStore.calculateNetSalary(emp),
    0,
  )
  addSection(`BEING ACCRUAL SALARY FOR ${monthName} ${year}`, salaryRows, [
    '410-010',
    'ACCRUALS - SALARY',
    `SALARIES - ${monthName} ${year}`,
    '0.00',
    totalSalary.toFixed(2),
  ])

  // EPF section
  const epfEmployerRows = createEmployeeRows('EPF EMPLOYER', 'epfEmployer', 'epfCode')
  const epfEmployeeRows = createEmployeeRows('EPF EMPLOYEE', 'epfEmployee', 'salaryCode')
  const totalEpf = payrollData.value.reduce(
    (sum, emp) => sum + emp.epfEmployer + emp.epfEmployee,
    0,
  )
  addSection(
    `BEING ACCRUAL KWSP FOR ${monthName} ${year}`,
    [...epfEmployerRows, ...epfEmployeeRows],
    [
      '410-080',
      'ACCRUALS - KWSP & SOCSO',
      `EPF CONTRIBUTION - ${monthName} ${year} KWSP`,
      '0.00',
      totalEpf.toFixed(2),
    ],
  )

  // SOCSO section
  const socsoEmployerRows = createEmployeeRows('SOCSO EMPLOYER', 'socsoEmployer', 'socsoCode')
  const socsoEmployeeRows = createEmployeeRows('SOCSO EMPLOYEE', 'socsoEmployee', 'salaryCode')
  const totalSocso = payrollData.value.reduce(
    (sum, emp) => sum + emp.socsoEmployer + emp.socsoEmployee,
    0,
  )

  // EIS rows
  const eisEmployerRows = createEmployeeRows('EIS EMPLOYER', 'eisEmployer', 'eisCode')
  const eisEmployeeRows = createEmployeeRows('EIS EMPLOYEE', 'eisEmployee', 'salaryCode')
  const totalEis = payrollData.value.reduce(
    (sum, emp) => sum + emp.eisEmployer + emp.eisEmployee,
    0,
  )

  // Add SOCSO & EIS section manually to avoid extra spacing
  excelData.push([`BEING ACCRUAL SOCSO & EIS FOR ${monthName} ${year}`, '', '', '', ''])
  excelData.push(...socsoEmployerRows, ...socsoEmployeeRows)
  excelData.push([
    '410-080',
    'ACCRUALS - KWSP & SOCSO',
    `SOCSO CONTRIBUTION - ${monthName} ${year} PERKESO`,
    '0.00',
    totalSocso.toFixed(2),
  ])
  excelData.push(...eisEmployerRows, ...eisEmployeeRows)
  excelData.push([
    '410-080',
    'ACCRUALS - KWSP & SOCSO',
    `EIS CONTRIBUTION - ${monthName} ${year} PERKESO`,
    '0.00',
    totalEis.toFixed(2),
  ])
  excelData.push(['', '', '', '', ''])

  // PCB section
  const pcbRows = payrollData.value
    .filter((emp) => emp.pcb > 0)
    .map((emp) => {
      const info = getEmployeeAccountInfo(emp.employeeName)
      return [
        info.salaryCode[0],
        info.salaryCode[1],
        `PCB - ${monthName} ${year} (${emp.employeeName})`,
        emp.pcb.toFixed(2),
        '0.00',
      ]
    })
  const cp38Rows = payrollData.value
    .filter((emp) => emp.cp38 > 0)
    .map((emp) => {
      const info = getEmployeeAccountInfo(emp.employeeName)
      return [
        info.salaryCode[0],
        info.salaryCode[1],
        `PCB - ${monthName} ${year} (${emp.employeeName}) - CP38`,
        emp.cp38.toFixed(2),
        '0.00',
      ]
    })
  const totalPcb = payrollData.value.reduce((sum, emp) => sum + (emp.pcb || 0), 0)
  const totalCp38 = payrollData.value.reduce((sum, emp) => sum + (emp.cp38 || 0), 0)

  // Add PCB section manually to control spacing
  excelData.push([`BEING ACCRUAL PCB FOR ${monthName} ${year}`, '', '', '', ''])
  excelData.push(...pcbRows, ...cp38Rows)
  excelData.push([
    '410-010',
    'ACCRUALS - SALARY',
    `CP38 - ${monthName} ${year}`,
    '0.00',
    totalCp38.toFixed(2),
  ])
  excelData.push([
    '410-010',
    'ACCRUALS - SALARY',
    `PCB CONTRIBUTION - ${monthName} ${year}`,
    '0.00',
    totalPcb.toFixed(2),
  ])

  // Create and style worksheet
  const ws = XLSX.utils.aoa_to_sheet(excelData)
  ws['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 50 }, { wch: 15 }, { wch: 10 }]

  // Find title rows and merge cells
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []
  excelData.forEach((row, index) => {
    if (row[0] && typeof row[0] === 'string' && row[0].includes('BEING ACCRUAL')) {
      // Merge cells A to E for title rows
      merges.push({
        s: { r: index, c: 0 }, // start: row index, column 0 (A)
        e: { r: index, c: 4 }, // end: row index, column 4 (E)
      })
    }
  })

  // Apply merges to worksheet
  ws['!merges'] = merges

  XLSX.utils.book_append_sheet(wb, ws, 'Payroll')
  XLSX.writeFile(wb, `Payroll_${monthName}_${year}.xlsx`)
}

onMounted(() => {})
</script>

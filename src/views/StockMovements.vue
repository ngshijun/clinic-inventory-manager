<template>
  <div class="px-2 py-3 sm:px-0 sm:py-6">
    <div class="border-4 border-dashed border-gray-200 rounded-lg p-3 sm:p-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Stock Movements</h2>
      </div>

      <!-- Search Bar -->
      <div class="mb-4 sm:mb-6">
        <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <!-- Quick Search -->
          <div class="flex-1 w-full sm:max-w-md">
            <SearchInput v-model="searchQuery" placeholder="Search items..." />
          </div>

          <!-- Advanced Search Toggle -->
          <div class="flex flex-row gap-2">
            <button
              @click="showAdvancedSearch = !showAdvancedSearch"
              class="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <FilterIcon class="h-4 w-4" />
              {{ showAdvancedSearch ? 'Hide Filters' : 'Advanced Search' }}
            </button>

            <!-- Clear Filters (visible when filters are active) -->
            <button
              v-if="hasActiveFilters"
              @click="clearAllFilters"
              class="flex items-center gap-2 px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <CloseIcon class="h-4 w-4" />
              Clear Filters
            </button>
          </div>
        </div>

        <!-- Advanced Search Panel -->
        <div
          v-if="showAdvancedSearch"
          class="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50"
        >
          <h4 class="text-sm font-medium text-gray-900 mb-4">Advanced Search Filters</h4>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <!-- Item Name Filter -->
            <FormField
              v-model="advancedFilters.itemName"
              type="text"
              label="Item Name"
              placeholder="Filter by item name..."
            />

            <!-- Quantity Range -->
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Quantity Range</label>
              <div class="flex gap-2">
                <input
                  v-model.number="advancedFilters.quantityMin"
                  type="number"
                  min="0"
                  :placeholder="`Min (${quantityDefaults.min})`"
                  class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  v-model.number="advancedFilters.quantityMax"
                  type="number"
                  min="0"
                  :placeholder="`Max (${quantityDefaults.max})`"
                  class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div class="mt-1 text-xs text-gray-500">
                Range: {{ quantityDefaults.min }} - {{ quantityDefaults.max }} units
              </div>
            </div>

            <!-- Movement Type -->
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Movement Type</label>
              <select
                v-model="advancedFilters.movementType"
                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Movements</option>
                <option value="stock_in">Stock In Only</option>
                <option value="stock_out">Stock Out Only</option>
              </select>
            </div>

            <!-- Start Date -->
            <FormField v-model="advancedFilters.startDate" type="date" label="Start Date" />

            <!-- End Date -->
            <FormField v-model="advancedFilters.endDate" type="date" label="End Date" />

            <!-- Remark Filter -->
            <FormField
              v-model="advancedFilters.remark"
              type="text"
              label="Remark"
              placeholder="Filter by remark..."
            />
          </div>

          <!-- Filter Actions -->
          <div class="mt-4 flex justify-between items-center">
            <div class="text-xs text-gray-600">
              Showing {{ stockMovementsStore.movements.length }} movements
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile Card View -->
      <div class="block lg:hidden">
        <div class="bg-white shadow overflow-hidden sm:rounded-md">
          <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 class="text-lg leading-6 font-medium text-gray-900">
              Movements ({{ sortedAndFilteredMovements.length }})
            </h3>
          </div>

          <LoadingSpinner
            v-if="stockMovementsStore.loading && sortedAndFilteredMovements.length === 0"
            message="Loading movements..."
          />

          <EmptyState
            v-else-if="sortedAndFilteredMovements.length === 0"
            icon="chart"
            title="No movements found"
            :description="
              searchQuery
                ? 'Try adjusting your search terms.'
                : 'Stock movements will appear here when you manage inventory.'
            "
          />

          <div v-else class="divide-y divide-gray-200">
            <div
              v-for="movement in pagination.paginatedItems.value"
              :key="movement.id"
              class="px-4 py-4"
            >
              <div class="space-y-3">
                <!-- Movement Header -->
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-medium text-gray-900 truncate flex-1 mr-2">
                    {{ movement.item_name }}
                  </h4>
                  <StatusBadge
                    :variant="movement.movement_type === 'stock_in' ? 'green' : 'red'"
                    :text="movement.movement_type === 'stock_in' ? 'Stock In (+)' : 'Stock Out (-)'"
                  />
                </div>

                <!-- Movement Details -->
                <div class="text-sm space-y-1">
                  <div class="flex items-baseline gap-2">
                    <span class="text-gray-500 flex-shrink-0">Quantity:</span>
                    <span class="font-medium text-gray-900">
                      {{ movement.quantity }} {{ movement.unit }}
                    </span>
                  </div>
                  <div class="flex items-baseline gap-2">
                    <span class="text-gray-500 flex-shrink-0">Date/Time:</span>
                    <span class="font-medium text-gray-900">
                      {{ formatDateTime(movement.created_at) }}
                    </span>
                  </div>
                  <div class="flex items-start gap-2">
                    <span class="text-gray-500 flex-shrink-0">Remark:</span>
                    <span class="font-medium text-gray-900 whitespace-pre-wrap">
                      {{ movement.remark || 'No remark' }}
                    </span>
                  </div>
                </div>

                <!-- Actions -->
                <div class="pt-2 border-t border-gray-100">
                  <ActionButtonGroup
                    :actions="getMovementActions()"
                    size="sm"
                    :loading="stockMovementsStore.loading"
                    @action-click="(actionKey) => handleActionClick(actionKey, movement)"
                    class="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Mobile Pagination -->
          <TablePagination
            v-if="pagination.totalPages.value > 1"
            :current-page="pagination.currentPage.value"
            :total-pages="pagination.totalPages.value"
            :items-per-page="pagination.itemsPerPage.value"
            :total-items="sortedAndFilteredMovements.length"
            :start-index="pagination.startIndex.value"
            :end-index="pagination.endIndex.value"
            :show-items-per-page-selector="false"
            @page-change="pagination.goToPage"
            @items-per-page-change="pagination.updateItemsPerPage"
          />
        </div>
      </div>

      <!-- Desktop Table View -->
      <div class="hidden lg:block">
        <div class="bg-white shadow overflow-hidden sm:rounded-md">
          <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 class="text-lg leading-6 font-medium text-gray-900">
              Movements ({{ sortedAndFilteredMovements.length }})
            </h3>
          </div>

          <LoadingSpinner
            v-if="stockMovementsStore.loading && sortedAndFilteredMovements.length === 0"
            message="Loading movements..."
          />

          <EmptyState
            v-else-if="sortedAndFilteredMovements.length === 0"
            icon="chart"
            title="No movements found"
            :description="
              searchQuery
                ? 'Try adjusting your search terms.'
                : 'Stock movements will appear here when you manage inventory.'
            "
          />

          <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <SortableTableHeader
                :columns="tableColumns"
                :sort-config="sortConfig"
                @sort-change="toggleSort"
              />
              <tbody class="bg-white divide-y divide-gray-200">
                <tr
                  v-for="movement in pagination.paginatedItems.value"
                  :key="movement.id"
                  class="hover:bg-gray-50"
                >
                  <td class="px-6 py-4 text-sm font-medium text-gray-900 min-w-0 max-w-xs">
                    <div class="break-words">{{ movement.item_name }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ movement.quantity }} {{ movement.unit }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <StatusBadge
                      :variant="movement.movement_type === 'stock_in' ? 'green' : 'red'"
                      :text="
                        movement.movement_type === 'stock_in' ? 'Stock In (+)' : 'Stock Out (-)'
                      "
                    />
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900" style="white-space: pre-line">
                    {{ formatDateTime(movement.created_at) }}
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900">
                    <div class="max-w-xs whitespace-pre-wrap">
                      <p>{{ movement.remark || 'No remark' }}</p>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <ActionButtonGroup
                      :actions="getMovementActions()"
                      size="sm"
                      :loading="stockMovementsStore.loading"
                      @action-click="(actionKey) => handleActionClick(actionKey, movement)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Desktop Pagination -->
          <TablePagination
            :current-page="pagination.currentPage.value"
            :total-pages="pagination.totalPages.value"
            :items-per-page="pagination.itemsPerPage.value"
            :total-items="sortedAndFilteredMovements.length"
            :start-index="pagination.startIndex.value"
            :end-index="pagination.endIndex.value"
            :show-items-per-page-selector="true"
            :items-per-page-options="[10, 25, 50, 100]"
            @page-change="pagination.goToPage"
            @items-per-page-change="pagination.updateItemsPerPage"
          />
        </div>
      </div>
    </div>

    <!-- Edit Remark Modal -->
    <ActionModal
      :is-open="showEditRemarkModal"
      :title="`Edit Remark: ${editingMovement?.item_name}`"
      variant="green"
      :loading="stockMovementsStore.loading"
      confirm-text="Save Remark"
      :disabled="!isRemarkChanged"
      @close="closeEditRemarkModal"
      @cancel="closeEditRemarkModal"
      @confirm="confirmSaveRemark"
    >
      <div class="space-y-4">
        <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div class="flex items-center gap-2 mb-2">
            <CogIcon class="w-4 h-4 text-blue-500" />
            <span class="text-sm font-medium text-blue-800"> Update Movement Information </span>
          </div>
          <p class="text-sm text-blue-700">
            Add notes or comments about this stock movement for future reference.
          </p>
        </div>

        <FormField
          v-model="newRemark"
          type="textarea"
          label="Remark"
          :rows="3"
          placeholder="Enter remark..."
        />
      </div>
    </ActionModal>
  </div>
</template>

<script setup lang="ts">
import ActionButtonGroup, {
  type ActionButtonGroupAction,
} from '@/components/ui/ActionButtonGroup.vue'
import ActionModal from '@/components/ui/ActionModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormField from '@/components/ui/FormField.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TablePagination from '@/components/ui/TablePagination.vue'
import CloseIcon from '@/components/icons/CloseIcon.vue'
import CogIcon from '@/components/icons/CogIcon.vue'
import FilterIcon from '@/components/icons/FilterIcon.vue'
import { usePagination } from '@/composables/usePagination'
import { useStockMovementsStore } from '@/stores/stockMovements'
import type { StockMovement } from '@/types/stockMovements'
import { computed, onMounted, ref, watch } from 'vue'

const stockMovementsStore = useStockMovementsStore()

const searchQuery = ref<string>('')
const newRemark = ref<string>('')
const showAdvancedSearch = ref<boolean>(false)

// Edit remark modal variables
const showEditRemarkModal = ref<boolean>(false)
const editingMovement = ref<StockMovement | null>(null)

// Computed property for remark validation
const isRemarkChanged = computed(() => {
  if (!editingMovement.value) return false
  return newRemark.value.trim() !== (editingMovement.value.remark || '').trim()
})

// Advanced search filters
const advancedFilters = ref({
  itemName: '',
  quantityMin: null as number | null,
  quantityMax: null as number | null,
  movementType: '',
  startDate: '',
  endDate: '',
  remark: '',
})

// Computed values for quantity defaults
const quantityDefaults = computed(() => {
  const movements = stockMovementsStore.movements
  if (movements.length === 0) {
    return { min: 0, max: 1000 }
  }

  const quantities = movements.map((m) => m.quantity)
  return {
    min: Math.min(...quantities),
    max: Math.max(...quantities),
  }
})

// Sorting configuration
const sortConfig = ref<{
  key: keyof StockMovement | null
  direction: 'asc' | 'desc'
}>({
  key: null,
  direction: 'asc',
})

// Check if any advanced filters are active
const hasActiveFilters = computed((): boolean => {
  return !!(
    advancedFilters.value.itemName ||
    advancedFilters.value.quantityMin !== null ||
    advancedFilters.value.quantityMax !== null ||
    advancedFilters.value.movementType ||
    advancedFilters.value.startDate ||
    advancedFilters.value.endDate ||
    advancedFilters.value.remark
  )
})

// Advanced filtering function
const applyAdvancedFilters = (movements: StockMovement[]): StockMovement[] => {
  return movements.filter((movement) => {
    // Quick search by item name (legacy compatibility)
    if (
      searchQuery.value &&
      !movement.item_name.toLowerCase().includes(searchQuery.value.toLowerCase())
    ) {
      return false
    }

    // Advanced item name filter
    if (
      advancedFilters.value.itemName &&
      !movement.item_name.toLowerCase().includes(advancedFilters.value.itemName.toLowerCase())
    ) {
      return false
    }

    // Quantity range filter
    if (
      advancedFilters.value.quantityMin !== null &&
      movement.quantity < advancedFilters.value.quantityMin
    ) {
      return false
    }
    if (
      advancedFilters.value.quantityMax !== null &&
      movement.quantity > advancedFilters.value.quantityMax
    ) {
      return false
    }

    // Movement type filter
    if (
      advancedFilters.value.movementType &&
      movement.movement_type !== advancedFilters.value.movementType
    ) {
      return false
    }

    // Date range filters
    if (advancedFilters.value.startDate) {
      const movementDate = new Date(movement.created_at).toISOString().split('T')[0]
      if (movementDate < advancedFilters.value.startDate) {
        return false
      }
    }
    if (advancedFilters.value.endDate) {
      const movementDate = new Date(movement.created_at).toISOString().split('T')[0]
      if (movementDate > advancedFilters.value.endDate) {
        return false
      }
    }

    // Remark filter
    if (
      advancedFilters.value.remark &&
      !movement.remark.toLowerCase().includes(advancedFilters.value.remark.toLowerCase())
    ) {
      return false
    }

    return true
  })
}

// Sorting and filtering logic
const sortedAndFilteredMovements = computed((): StockMovement[] => {
  // Start with all movements
  let movements = [...stockMovementsStore.movements]

  // Apply advanced filters
  movements = applyAdvancedFilters(movements)

  // Apply sorting
  if (sortConfig.value.key) {
    movements = movements.sort((a, b) => {
      const aValue = a[sortConfig.value.key as keyof StockMovement]
      const bValue = b[sortConfig.value.key as keyof StockMovement]

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase())
        return sortConfig.value.direction === 'asc' ? comparison : -comparison
      }

      // Handle number comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.value.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      // Handle date comparison
      if (sortConfig.value.key === 'created_at') {
        const aDate = new Date(aValue as string).getTime()
        const bDate = new Date(bValue as string).getTime()
        return sortConfig.value.direction === 'asc' ? aDate - bDate : bDate - aDate
      }

      return 0
    })
  }

  return movements
})

// Pagination
const pagination = usePagination(sortedAndFilteredMovements)

// Reset to first page when filters change
watch(
  [searchQuery, advancedFilters],
  () => {
    pagination.resetToFirstPage()
  },
  { deep: true },
)

// Clear functions
const clearAdvancedFilters = (): void => {
  advancedFilters.value = {
    itemName: '',
    quantityMin: null,
    quantityMax: null,
    movementType: '',
    startDate: '',
    endDate: '',
    remark: '',
  }
}

const clearAllFilters = (): void => {
  clearAdvancedFilters()
  pagination.resetToFirstPage()
}

// Table column configuration
const tableColumns = [
  { key: 'item_name', label: 'Item Name', sortable: true },
  { key: 'quantity', label: 'Quantity', sortable: true },
  { key: 'movement_type', label: 'Movement', sortable: true },
  { key: 'created_at', label: 'Date/Time', sortable: true },
  { key: 'remark', label: 'Remark', sortable: false },
  { key: 'actions', label: 'Actions', sortable: false },
]

// Sorting function
const toggleSort = (key: string): void => {
  if (sortConfig.value.key === key) {
    // Same column clicked - toggle direction
    sortConfig.value.direction = sortConfig.value.direction === 'asc' ? 'desc' : 'asc'
  } else {
    // New column clicked - set ascending
    sortConfig.value.key = key as keyof StockMovement
    sortConfig.value.direction = 'asc'
  }
  pagination.resetToFirstPage()
}

// Action button configurations
const getMovementActions = (): Array<ActionButtonGroupAction> => {
  return [
    {
      key: 'edit-remark',
      label: 'Edit Remark',
      variant: 'blue',
    },
  ]
}

// Handle action button clicks
const handleActionClick = (actionKey: string, movement: StockMovement) => {
  switch (actionKey) {
    case 'edit-remark':
      startEditRemark(movement)
      break
  }
}

const startEditRemark = (movement: StockMovement): void => {
  openEditRemarkModal(movement)
}

// Edit remark modal functions
const openEditRemarkModal = (movement: StockMovement): void => {
  editingMovement.value = movement
  newRemark.value = movement.remark || ''
  showEditRemarkModal.value = true
}

const closeEditRemarkModal = (): void => {
  showEditRemarkModal.value = false
  editingMovement.value = null
  newRemark.value = ''
}

const confirmSaveRemark = async (): Promise<void> => {
  if (!editingMovement.value || !isRemarkChanged.value) return

  await saveRemark(editingMovement.value.id)
  if (!stockMovementsStore.error) {
    closeEditRemarkModal()
  }
}

const saveRemark = async (movementId: string): Promise<void> => {
  await stockMovementsStore.updateRemark(movementId, newRemark.value)
}

const formatDateTime = (datetime: string): string => {
  const date = new Date(datetime)
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  return `${dateStr}\n${timeStr}`
}

onMounted(() => {})
</script>

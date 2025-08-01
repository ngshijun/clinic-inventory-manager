<template>
  <div class="px-2 py-3 sm:px-0 sm:py-6">
    <div class="border-4 border-dashed border-gray-200 rounded-lg p-3 sm:p-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Stock Requests</h2>
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            v-if="!showCreateForm"
            @click="openCreateForm"
            class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Create New Request
          </button>
        </div>
      </div>

      <!-- Create New Request Form -->
      <div v-if="showCreateForm" class="bg-white p-4 sm:p-6 rounded-lg shadow mb-4 sm:mb-6">
        <h3 class="text-base sm:text-lg font-medium text-gray-900 mb-4">Create New Request</h3>
        <form @submit.prevent="createNewRequest">
          <div class="space-y-4 sm:grid sm:grid-cols-4 sm:gap-6 sm:space-y-0">
            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Item</label>
              <div class="relative">
                <input
                  ref="itemInputRef"
                  v-model="itemSearchQuery"
                  @focus="showItemDropdown = true"
                  @input="onItemSearch"
                  @keydown="handleKeyDown"
                  type="text"
                  required
                  class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search for an item..."
                  autocomplete="off"
                />
                <!-- Dropdown -->
                <div
                  v-if="showItemDropdown && filteredItems.length > 0"
                  ref="dropdownRef"
                  class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                >
                  <div
                    v-for="(item, index) in filteredItems"
                    :key="item.id"
                    :data-index="index"
                    @click="selectItem(item)"
                    :class="[
                      'px-3 py-2 cursor-pointer text-sm border-b border-gray-100 last:border-b-0',
                      index === selectedItemIndex ? 'bg-blue-100' : 'hover:bg-blue-50',
                    ]"
                  >
                    <div class="font-medium text-gray-900">{{ item.item_name }}</div>
                    <div class="text-xs text-gray-500">
                      Available: {{ item.quantity }} {{ item.unit }}
                    </div>
                  </div>
                </div>
                <!-- No results -->
                <div
                  v-if="showItemDropdown && itemSearchQuery && filteredItems.length === 0"
                  class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3"
                >
                  <div class="text-sm text-gray-500">No items found</div>
                </div>
              </div>
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                v-model.number="newRequest.quantity"
                type="number"
                min="1"
                :max="selectedItemMaxQuantity"
                :disabled="!newRequest.item_id"
                required
                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                :placeholder="
                  selectedItemMaxQuantity ? `Max: ${selectedItemMaxQuantity}` : 'Select item first'
                "
              />
              <p v-if="selectedItemMaxQuantity" class="mt-1 text-xs text-gray-500">
                Maximum available: {{ selectedItemMaxQuantity }} {{ selectedItemUnit }}
              </p>
            </div>
          </div>
          <div class="mt-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Remark (Optional)</label>
            <textarea
              v-model="newRequest.remark"
              rows="3"
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter reason for request..."
            ></textarea>
          </div>
          <div class="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              @click="cancelCreateForm"
              class="w-full sm:w-auto px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="stockRequestsStore.loading || !isFormValid"
              class="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {{ stockRequestsStore.loading ? 'Creating...' : 'Create Request' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Search and Filter Bar -->
      <div class="mb-4 sm:mb-6 space-y-4">
        <!-- Search and Date Filter -->
        <div class="flex flex-col sm:flex-row gap-4">
          <!-- Search -->
          <div class="flex-1 sm:max-w-md">
            <SearchInput v-model="searchQuery" placeholder="Search requests..." />
          </div>

          <!-- Filter Controls -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <!-- Date Filter -->
            <div class="w-full sm:w-40">
              <input
                v-model="filterDate"
                type="date"
                class="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                :disabled="showOlderPending"
                placeholder="Filter by date"
              />
            </div>

            <!-- Clear Filters -->
            <button
              v-if="showResetButton"
              @click="resetToToday"
              class="flex items-center justify-center gap-2 px-4 py-2 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors w-full sm:w-auto disabled:opacity-50"
              :disabled="showOlderPending"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                ></path>
              </svg>
              Show Today
            </button>
          </div>
        </div>

        <!-- Show Older Pending Checkbox -->
        <div v-if="nonTodayPendingCount > 0" class="flex items-center gap-2">
          <input
            id="show-older-pending"
            v-model="showOlderPending"
            type="checkbox"
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="show-older-pending" class="text-sm font-medium text-gray-700">
            Show {{ nonTodayPendingCount }} older pending only
          </label>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="stockRequestsStore.error" class="mb-4">
        <ErrorAlert :message="stockRequestsStore.error" />
      </div>

      <!-- Mobile Card View -->
      <div class="block lg:hidden">
        <div class="bg-white shadow overflow-hidden sm:rounded-md">
          <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 class="text-lg leading-6 font-medium text-gray-900">
              Requests ({{ sortedAndFilteredRequests.length }})
            </h3>
          </div>
          <LoadingSpinner
            v-if="stockRequestsStore.loading && sortedAndFilteredRequests.length === 0"
            message="Loading requests..."
          />
          <EmptyState
            v-else-if="sortedAndFilteredRequests.length === 0"
            icon="document"
            title="No requests found"
            :description="
              showResetButton
                ? 'Try adjusting your search terms or filters.'
                : 'No requests have been submitted yet.'
            "
          />
          <div v-else class="divide-y divide-gray-200">
            <div
              v-for="request in pagination.paginatedItems.value"
              :key="request.id"
              class="px-4 py-4"
            >
              <!-- View Mode -->
              <div class="space-y-3">
                <!-- Request Header -->
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-medium text-gray-900 truncate flex-1 mr-2">
                    {{ request.item_name }}
                  </h4>
                  <StatusBadge :variant="getStatusVariant(request.status)" :text="request.status" />
                </div>
                <!-- Request Details -->
                <div class="text-sm space-y-1">
                  <div class="flex items-baseline gap-2">
                    <span class="text-gray-500 flex-shrink-0">Quantity:</span>
                    <span class="font-medium text-gray-900">
                      {{ request.quantity }} {{ request.unit }}
                    </span>
                  </div>
                  <div class="flex items-start gap-2">
                    <span class="text-gray-500 flex-shrink-0">Remark:</span>
                    <span class="font-medium text-gray-900 whitespace-pre-wrap">
                      {{ request.remark || 'No Remark' }}
                    </span>
                  </div>
                </div>
                <!-- Actions -->
                <div v-if="request.status === 'Pending'" class="pt-2 border-t border-gray-100">
                  <ActionButtonGroup
                    :actions="getRequestActions(request)"
                    size="sm"
                    :loading="stockRequestsStore.loading"
                    @action-click="(actionKey) => handleActionClick(actionKey, request)"
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
            :total-items="sortedAndFilteredRequests.length"
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
              Requests ({{ sortedAndFilteredRequests.length }})
            </h3>
          </div>
          <LoadingSpinner
            v-if="stockRequestsStore.loading && sortedAndFilteredRequests.length === 0"
            message="Loading requests..."
          />
          <EmptyState
            v-else-if="sortedAndFilteredRequests.length === 0"
            icon="document"
            title="No requests found"
            :description="
              showResetButton
                ? 'Try adjusting your search terms or filters.'
                : 'No requests have been submitted yet.'
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
                  v-for="request in pagination.paginatedItems.value"
                  :key="request.id"
                  class="hover:bg-gray-50"
                >
                  <td class="px-6 py-4 text-sm font-medium text-gray-900 min-w-0 max-w-xs">
                    <div class="break-words">{{ request.item_name }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ request.quantity }} {{ request.unit }}
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    <div
                      class="break-words whitespace-pre-wrap"
                      :title="request.remark || 'No Remark'"
                    >
                      {{ request.remark || 'No Remark' }}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <StatusBadge
                      :variant="getStatusVariant(request.status)"
                      :text="request.status"
                    />
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <ActionButtonGroup
                      v-if="request.status === 'Pending'"
                      :actions="getRequestActions(request)"
                      size="sm"
                      :loading="stockRequestsStore.loading"
                      @action-click="(actionKey) => handleActionClick(actionKey, request)"
                    />
                    <span v-else class="text-gray-400 text-xs">
                      {{ request.status === 'Approved' ? 'Completed' : 'Rejected' }}
                    </span>
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
            :total-items="sortedAndFilteredRequests.length"
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

    <!-- Remove Request Confirmation Modal -->
    <ActionModal
      :is-open="showRemoveModal"
      title="Remove Request"
      variant="red"
      confirm-text="Remove"
      :loading="removeLoading"
      @confirm="confirmRemove"
      @cancel="cancelRemove"
      @close="cancelRemove"
    >
      <div class="bg-red-50 border border-red-200 rounded-md p-3">
        <div class="flex items-center gap-2 mb-2">
          <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clip-rule="evenodd"
            />
          </svg>
          <span class="text-sm font-medium text-red-800">
            Warning: This action cannot be undone
          </span>
        </div>
        <p class="text-sm text-red-700">
          Are you sure you want to remove this request? This action cannot be undone.
        </p>
      </div>
    </ActionModal>

    <!-- Edit Request Modal -->
    <ActionModal
      :is-open="showEditModal"
      :title="`Edit Request: ${editingRequest?.item_name}`"
      variant="green"
      :loading="stockRequestsStore.loading"
      confirm-text="Save Changes"
      :disabled="!isEditFormValid"
      @close="closeEditModal"
      @cancel="closeEditModal"
      @confirm="confirmEdit"
    >
      <div class="space-y-4">
        <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clip-rule="evenodd"
              />
            </svg>
            <span class="text-sm font-medium text-blue-800"> Modify Request Details </span>
          </div>
          <p class="text-sm text-blue-700">
            Update the quantity and add remarks for this stock request.
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input
            v-model.number="editForm.quantity"
            type="number"
            min="1"
            :max="editingRequest ? getItemMaxQuantity(editingRequest.item_id) : undefined"
            class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter quantity"
          />
          <p v-if="editingRequest" class="mt-1 text-xs text-gray-500">
            Max available: {{ getItemMaxQuantity(editingRequest.item_id) }}
            {{ editingRequest.unit }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Remark (Optional)</label>
          <textarea
            v-model="editForm.remark"
            rows="3"
            class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Add any notes or comments..."
          />
        </div>
      </div>
    </ActionModal>
  </div>
</template>

<script setup lang="ts">
import { useInventoryStore } from '@/stores/inventory'
import { useStockRequestsStore } from '@/stores/stockRequests'
import type { InventoryItem } from '@/types/inventory'
import type { NewStockRequest, StockRequest } from '@/types/stockRequests'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import ErrorAlert from '@/components/ui/ErrorAlert.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import ActionModal from '@/components/ui/ActionModal.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import ActionButtonGroup from '@/components/ui/ActionButtonGroup.vue'

// Component imports
import TablePagination from '@/components/TablePagination.vue'
import { usePagination } from '@/composables/usePagination'

// Helper function to map status to StatusBadge variant
const getStatusVariant = (status: string): 'pending' | 'approved' | 'cancelled' => {
  return status.toLowerCase() as 'pending' | 'approved' | 'cancelled'
}

// Store
const stockRequestsStore = useStockRequestsStore()
const inventoryStore = useInventoryStore()

// State
const searchQuery = ref<string>('')
const today = new Date()
const filterDate = ref<string>(
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
)
const showCreateForm = ref<boolean>(false)
const showOlderPending = ref<boolean>(false)
const itemSearchQuery = ref<string>('')
const showItemDropdown = ref<boolean>(false)
const selectedItemIndex = ref<number>(-1)

// Edit state
const editForm = ref<{
  quantity: number
  remark: string
}>({
  quantity: 1,
  remark: '',
})

// Template refs
const itemInputRef = ref<HTMLInputElement | null>(null)
const dropdownRef = ref<HTMLDivElement | null>(null)

// Remove confirmation modal
const showRemoveModal = ref<boolean>(false)
const removeRequestId = ref<string | null>(null)
const removeLoading = ref<boolean>(false)

// Edit modal
const showEditModal = ref<boolean>(false)
const editingRequest = ref<StockRequest | null>(null)

// New request form
const newRequest = ref<NewStockRequest & { quantity: number }>({
  item_id: '',
  item_name: '',
  quantity: 1,
  remark: '',
})

// Sorting configuration
const sortConfig = ref<{
  key: keyof StockRequest | null
  direction: 'asc' | 'desc'
}>({
  key: null,
  direction: 'asc',
})

// Computed properties for new request form
const selectedItem = computed(() => {
  return inventoryStore.items.find((item) => item.id === newRequest.value.item_id)
})

const selectedItemMaxQuantity = computed(() => {
  return selectedItem.value?.quantity || 0
})

const selectedItemUnit = computed(() => {
  return selectedItem.value?.unit || ''
})

const filteredItems = computed((): InventoryItem[] => {
  if (!itemSearchQuery.value) return inventoryStore.items
  return inventoryStore.items.filter(
    (item) =>
      item.item_name.toLowerCase().includes(itemSearchQuery.value.toLowerCase()) ||
      item.id.toLowerCase().includes(itemSearchQuery.value.toLowerCase()),
  )
})

const isFormValid = computed(() => {
  return !!(
    newRequest.value.item_id &&
    newRequest.value.quantity > 0 &&
    newRequest.value.quantity <= selectedItemMaxQuantity.value
  )
})

// Edit form validation
const isEditFormValid = computed(() => {
  if (!editingRequest.value) return false

  const maxQuantity = getItemMaxQuantity(editingRequest.value.item_id)
  return (
    editForm.value.quantity > 0 &&
    editForm.value.quantity <= maxQuantity &&
    (editForm.value.quantity !== editingRequest.value.quantity ||
      editForm.value.remark !== (editingRequest.value.remark || ''))
  )
})

// Helper function to get item max quantity
const getItemMaxQuantity = (itemId: string): number => {
  const item = inventoryStore.items.find((item) => item.id === itemId)
  return item?.quantity || 0
}

// Computed properties for filtering and sorting
const sortedAndFilteredRequests = computed((): StockRequest[] => {
  let requests = [...stockRequestsStore.requests]

  // Search filter
  if (searchQuery.value) {
    requests = stockRequestsStore.searchRequests(searchQuery.value)
  }

  // Date filter (only apply if not showing older pending)
  if (filterDate.value && !showOlderPending.value) {
    const filterDateObj = new Date(filterDate.value)
    requests = requests.filter((request) => {
      const requestDate = new Date(request.created_at)
      return requestDate.toDateString() === filterDateObj.toDateString()
    })
  }

  // Show older pending filter
  if (showOlderPending.value) {
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    requests = requests.filter((request) => {
      if (request.status !== 'Pending') return false
      const requestDate = new Date(request.created_at)
      const requestDateString = `${requestDate.getFullYear()}-${String(requestDate.getMonth() + 1).padStart(2, '0')}-${String(requestDate.getDate()).padStart(2, '0')}`
      return requestDateString !== todayString
    })
  }

  // Sorting
  if (sortConfig.value.key) {
    requests.sort((a, b) => {
      const aValue = a[sortConfig.value.key as keyof StockRequest]
      const bValue = b[sortConfig.value.key as keyof StockRequest]

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase())
        return sortConfig.value.direction === 'asc' ? comparison : -comparison
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.value.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      return 0
    })
  }

  return requests
})

// Pagination
const pagination = usePagination(sortedAndFilteredRequests)

const nonTodayPendingCount = computed(() => {
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return stockRequestsStore.requests.filter((request) => {
    if (request.status !== 'Pending') return false
    const requestDate = new Date(request.created_at)
    const requestDateString = `${requestDate.getFullYear()}-${String(requestDate.getMonth() + 1).padStart(2, '0')}-${String(requestDate.getDate()).padStart(2, '0')}`
    return requestDateString !== todayString
  }).length
})

// Check if reset to today button should be shown
const showResetButton = computed((): boolean => {
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const isDateToday = filterDate.value === todayString
  return !!(filterDate.value && !isDateToday)
})

// Reset to first page when filters change
watch([searchQuery, filterDate], () => {
  pagination.resetToFirstPage()
})

// Table column configuration
const tableColumns = [
  { key: 'item_name', label: 'Item Name', sortable: true },
  { key: 'quantity', label: 'Quantity', sortable: true },
  { key: 'remark', label: 'Remark', sortable: false },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'actions', label: 'Actions', sortable: false },
]

// Sorting functions
const toggleSort = (key: string): void => {
  if (sortConfig.value.key === key) {
    // Same column clicked - toggle direction
    sortConfig.value.direction = sortConfig.value.direction === 'asc' ? 'desc' : 'asc'
  } else {
    // New column clicked - set ascending
    sortConfig.value.key = key as keyof StockRequest
    sortConfig.value.direction = 'asc'
  }
  pagination.resetToFirstPage()
}

// Action button configurations
const getRequestActions = (
  request: StockRequest,
): Array<{
  key: string
  label: string
  variant: 'blue' | 'gray' | 'red' | 'green' | 'yellow' | 'cyan'
}> => {
  if (request.status !== 'Pending') return []

  return [
    {
      key: 'edit',
      label: 'Edit',
      variant: 'blue',
    },
    {
      key: 'delete',
      label: 'Remove',
      variant: 'red',
    },
  ]
}

// Handle action button clicks
const handleActionClick = (actionKey: string, request: StockRequest) => {
  switch (actionKey) {
    case 'edit':
      startEdit(request)
      break
    case 'delete':
      removeRequest(request.id)
      break
  }
}

// Reset date filter to today
const resetToToday = (): void => {
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  filterDate.value = todayString
  pagination.resetToFirstPage()
}

// Edit functions
const startEdit = (request: StockRequest): void => {
  editingRequest.value = request
  editForm.value = {
    quantity: request.quantity,
    remark: request.remark || '',
  }
  showEditModal.value = true
}

const closeEditModal = (): void => {
  showEditModal.value = false
  editingRequest.value = null
  editForm.value = {
    quantity: 1,
    remark: '',
  }
}

const confirmEdit = async (): Promise<void> => {
  if (!editingRequest.value || !isEditFormValid.value) return

  await saveEdit(editingRequest.value.id)
  if (!stockRequestsStore.error) {
    closeEditModal()
  }
}

const saveEdit = async (requestId: string): Promise<void> => {
  if (!isEditFormValid.value) return

  await stockRequestsStore.updateRequest(requestId, editForm.value.quantity, editForm.value.remark)

  // Modal cleanup is handled by confirmEdit function
}

// New request form functions
const onItemSearch = (): void => {
  showItemDropdown.value = true
  selectedItemIndex.value = -1 // Reset selection when searching
}

const scrollToSelectedItem = (): void => {
  nextTick(() => {
    if (dropdownRef.value && selectedItemIndex.value >= 0) {
      const dropdown = dropdownRef.value
      const selectedItem = dropdown.querySelector(
        `[data-index="${selectedItemIndex.value}"]`,
      ) as HTMLElement

      if (selectedItem) {
        const dropdownRect = dropdown.getBoundingClientRect()
        const itemRect = selectedItem.getBoundingClientRect()

        // Check if item is above visible area
        if (itemRect.top < dropdownRect.top) {
          dropdown.scrollTop -= dropdownRect.top - itemRect.top
        }
        // Check if item is below visible area
        else if (itemRect.bottom > dropdownRect.bottom) {
          dropdown.scrollTop += itemRect.bottom - dropdownRect.bottom
        }
      }
    }
  })
}

const handleKeyDown = (event: KeyboardEvent): void => {
  if (!showItemDropdown.value || filteredItems.value.length === 0) return

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedItemIndex.value = Math.min(
        selectedItemIndex.value + 1,
        filteredItems.value.length - 1,
      )
      scrollToSelectedItem()
      break
    case 'ArrowUp':
      event.preventDefault()
      selectedItemIndex.value = Math.max(selectedItemIndex.value - 1, 0)
      scrollToSelectedItem()
      break
    case 'Enter':
      event.preventDefault()
      if (selectedItemIndex.value >= 0 && selectedItemIndex.value < filteredItems.value.length) {
        selectItem(filteredItems.value[selectedItemIndex.value])
      }
      break
    case 'Escape':
      event.preventDefault()
      showItemDropdown.value = false
      selectedItemIndex.value = -1
      break
  }
}

const selectItem = (item: InventoryItem): void => {
  newRequest.value.item_id = item.id
  newRequest.value.item_name = item.item_name
  itemSearchQuery.value = item.item_name
  showItemDropdown.value = false
  selectedItemIndex.value = -1
  newRequest.value.quantity = 1 // Reset quantity when item changes
}

const createNewRequest = async (): Promise<void> => {
  if (!isFormValid.value) return

  await stockRequestsStore.addRequest({
    item_id: newRequest.value.item_id,
    item_name: newRequest.value.item_name,
    quantity: newRequest.value.quantity,
    remark: newRequest.value.remark || '',
  })

  if (!stockRequestsStore.error) {
    cancelCreateForm()
  }
}

const openCreateForm = async (): Promise<void> => {
  showCreateForm.value = true
  await nextTick() // Wait for DOM to update
  itemInputRef.value?.focus() // Focus the item input
}

const cancelCreateForm = (): void => {
  showCreateForm.value = false
  showItemDropdown.value = false
  itemSearchQuery.value = ''
  selectedItemIndex.value = -1
  newRequest.value = {
    item_id: '',
    item_name: '',
    quantity: 1,
    remark: '',
  }
}

// Action functions
const removeRequest = (requestId: string): void => {
  removeRequestId.value = requestId
  showRemoveModal.value = true
}

const confirmRemove = async (): Promise<void> => {
  if (!removeRequestId.value) return

  removeLoading.value = true
  try {
    await stockRequestsStore.removeRequest(removeRequestId.value)
    showRemoveModal.value = false
    removeRequestId.value = null
  } finally {
    removeLoading.value = false
  }
}

const cancelRemove = (): void => {
  showRemoveModal.value = false
  removeRequestId.value = null
  removeLoading.value = false
}

onMounted(() => {
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.relative')) {
      showItemDropdown.value = false
    }
  })
})
</script>

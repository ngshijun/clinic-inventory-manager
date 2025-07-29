<template>
  <div class="px-2 py-3 sm:px-0 sm:py-6">
    <div class="border-4 border-dashed border-gray-200 rounded-lg p-3 sm:p-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Inventory Management</h2>
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            v-if="!showAddForm"
            @click="triggerFileUpload"
            class="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Import from Excel (xlsx)
          </button>
          <button
            v-if="!showAddForm && sortedAndFilteredItems.length > 0"
            @click="exportToExcel"
            class="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Export to Excel (xlsx)
          </button>
          <button
            v-if="!showAddForm"
            @click="openAddForm"
            class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Add New Item
          </button>
        </div>
      </div>

      <!-- Hidden File Input -->
      <input ref="fileInput" type="file" accept=".xlsx" @change="handleFileUpload" class="hidden" />

      <!-- Import Progress/Error Display -->
      <div v-if="importStatus.show" class="mb-4 sm:mb-6">
        <div v-if="importStatus.loading" class="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-blue-800">Importing data...</h3>
              <p class="mt-1 text-sm text-blue-700">Processing {{ importStatus.fileName }}</p>
            </div>
          </div>
        </div>

        <div v-else-if="importStatus.error">
          <ErrorAlert title="Import failed" :message="importStatus.error" />
        </div>

        <div
          v-else-if="importStatus.success"
          class="bg-green-50 border border-green-200 rounded-md p-4"
        >
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                ></path>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-green-800">Import successful!</h3>
              <div class="mt-1 text-sm text-green-700">
                <p>Successfully synced inventory with {{ importStatus.fileName }}:</p>
                <ul class="mt-1 space-y-1">
                  <li v-if="importStatus.importedCount > 0">
                    • Added {{ importStatus.importedCount }} new items
                  </li>
                  <li v-if="importStatus.updatedCount > 0">
                    • Updated {{ importStatus.updatedCount }} existing items
                  </li>
                  <li v-if="importStatus.deletedCount > 0">
                    • Removed {{ importStatus.deletedCount }} items not in Excel
                  </li>
                </ul>
                <p class="mt-2 font-medium">
                  Total processed: {{ importStatus.totalProcessed }} items
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stock In Modal -->
      <ActionModal
        :is-open="showStockInModal"
        :title="`Stock In: ${stockInItem?.item_name}`"
        variant="approve"
        :loading="inventoryStore.loading"
        confirm-text="Add Stock"
        @close="closeStockInModal"
        @cancel="closeStockInModal"
        @confirm="confirmStockIn"
      >
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"> Quantity to Add </label>
            <div
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-900 font-medium"
            >
              {{ stockQuantity }}
            </div>
            <p class="mt-1 text-xs text-gray-500">Unit: {{ stockInItem?.unit }}</p>
          </div>

          <!-- Clear Order Date Option -->
          <div v-if="stockInItem?.order_date" class="space-y-2">
            <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span class="text-sm font-medium text-blue-800">
                  This item was ordered on {{ formatDate(stockInItem.order_date) }}
                </span>
              </div>
              <div class="flex items-center">
                <input
                  id="clearOrderDate"
                  v-model="clearOrderDate"
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label for="clearOrderDate" class="ml-2 text-sm text-gray-700">
                  Clear order date (mark as received)
                </label>
              </div>
              <p class="mt-1 text-xs text-gray-500">
                If unchecked, the order date will remain to track pending orders.
              </p>
            </div>
          </div>
        </div>
      </ActionModal>

      <!-- Add New Item Form -->
      <div v-if="showAddForm" class="bg-white p-4 sm:p-6 rounded-lg shadow mb-4 sm:mb-6">
        <h3 class="text-base sm:text-lg font-medium text-gray-900 mb-4">Add New Item</h3>
        <form @submit.prevent="addNewItem">
          <div class="space-y-4 sm:grid sm:grid-cols-6 sm:gap-6 sm:space-y-0">
            <div class="col-span-3">
              <label class="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
              <input
                ref="itemNameInputRef"
                v-model="newItem.item_name"
                type="text"
                required
                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter item name"
              />
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">Initial Quantity</label>
              <input
                v-model.number="newItem.quantity"
                type="number"
                min="0"
                required
                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
              <input
                v-model.number="newItem.reorder_level"
                type="number"
                min="0"
                required
                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <input
                v-model="newItem.unit"
                type="text"
                required
                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter unit"
              />
            </div>
          </div>
          <div class="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              @click="showAddForm = false"
              class="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="inventoryStore.loading"
              class="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {{ inventoryStore.loading ? 'Adding...' : 'Add Item' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Search Bar -->
      <div class="mb-4 sm:mb-6">
        <SearchInput v-model="searchQuery" placeholder="Search items..." />
      </div>

      <!-- Mobile Card View -->
      <div class="block lg:hidden">
        <div class="bg-white shadow overflow-hidden sm:rounded-md">
          <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 class="text-lg leading-6 font-medium text-gray-900">
              Items ({{ sortedAndFilteredItems.length }})
            </h3>
          </div>

          <LoadingSpinner
            v-if="inventoryStore.loading && sortedAndFilteredItems.length === 0"
            message="Loading items..."
          />

          <EmptyState
            v-else-if="sortedAndFilteredItems.length === 0"
            icon="box"
            title="No items found"
            :description="
              searchQuery
                ? 'Try adjusting your search terms.'
                : 'Get started by adding your first item.'
            "
          />

          <div v-else class="divide-y divide-gray-200">
            <div v-for="item in pagination.paginatedItems.value" :key="item.id" class="px-4 py-4">
              <div class="space-y-3">
                <!-- Item Header -->
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-medium text-gray-900 truncate flex-1 mr-2">
                    {{ item.item_name }}
                  </h4>
                  <StatusBadge
                    :variant="getStockStatusVariant(item)"
                    :text="getStockStatus(item).text"
                  />
                </div>

                <!-- Item Details -->
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span class="text-gray-500">Current Stock:</span>
                    <div class="font-medium text-gray-900 mt-1">
                      {{ item.quantity }} {{ item.unit }}
                    </div>
                  </div>
                  <div>
                    <span class="text-gray-500">Reorder Level:</span>
                    <div class="font-medium text-gray-900 mt-1">
                      {{ item.reorder_level }} {{ item.unit }}
                    </div>
                  </div>
                </div>

                <!-- Order Status -->
                <div v-if="item.order_date" class="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  <span class="inline-flex items-center gap-1">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fill-rule="evenodd"
                        d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    Ordered: {{ formatDate(item.order_date) }}
                  </span>
                </div>

                <!-- Stock In/Out Form -->
                <div v-if="editingItem === item.id" class="space-y-3 p-3 bg-gray-50 rounded-md">
                  <div class="flex items-center gap-2">
                    <input
                      v-model.number="stockQuantity"
                      type="number"
                      min="1"
                      :max="getItemMaxQuantity(item.id)"
                      class="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p class="text-xs text-gray-500">
                    Max: {{ getItemMaxQuantity(item.id) }}
                    {{ item.unit }}
                  </p>
                  <div class="flex gap-2">
                    <button
                      @click="handleStockIn(item.id)"
                      :disabled="inventoryStore.loading || !stockQuantity || stockQuantity <= 0"
                      class="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                    >
                      Stock In (+)
                    </button>
                    <button
                      @click="handleStockOut(item.id)"
                      :disabled="inventoryStore.loading || !stockQuantity || stockQuantity <= 0"
                      class="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                    >
                      Stock Out (-)
                    </button>
                  </div>
                  <button
                    @click="cancelEdit"
                    class="w-full bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                <!-- Actions -->
                <ActionButtonGroup
                  v-else
                  :actions="getItemActions()"
                  size="sm"
                  :loading="inventoryStore.loading"
                  @action-click="(actionKey) => handleActionClick(actionKey, item)"
                />
              </div>
            </div>
          </div>

          <!-- Mobile Pagination -->
          <TablePagination
            v-if="pagination.totalPages.value > 1"
            :current-page="pagination.currentPage.value"
            :total-pages="pagination.totalPages.value"
            :items-per-page="pagination.itemsPerPage.value"
            :total-items="sortedAndFilteredItems.length"
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
              Items ({{ sortedAndFilteredItems.length }})
            </h3>
          </div>

          <LoadingSpinner
            v-if="inventoryStore.loading && sortedAndFilteredItems.length === 0"
            message="Loading items..."
          />

          <EmptyState
            v-else-if="sortedAndFilteredItems.length === 0"
            icon="box"
            title="No items found"
            :description="
              searchQuery
                ? 'Try adjusting your search terms.'
                : 'Get started by adding your first item.'
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
                  v-for="item in pagination.paginatedItems.value"
                  :key="item.id"
                  class="hover:bg-gray-50"
                >
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ item.item_name }}
                    <!-- Show order status if item has order date -->
                    <div v-if="item.order_date" class="text-xs text-blue-600 mt-1">
                      <span class="inline-flex items-center gap-1">
                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fill-rule="evenodd"
                            d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                            clip-rule="evenodd"
                          />
                        </svg>
                        Ordered: {{ formatDate(item.order_date) }}
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div v-if="editingItem === item.id" class="space-y-2">
                      <div class="flex items-center space-x-2">
                        <input
                          v-model.number="stockQuantity"
                          type="number"
                          min="1"
                          :max="getItemMaxQuantity(item.id)"
                          class="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <p class="text-xs text-gray-500">
                        Max: {{ getItemMaxQuantity(item.id) }} {{ item.unit }}
                      </p>
                    </div>
                    <div v-else>{{ item.quantity }} {{ item.unit }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ item.reorder_level }} {{ item.unit }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <StatusBadge
                      :variant="getStockStatusVariant(item)"
                      :text="getStockStatus(item).text"
                    />
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div v-if="editingItem === item.id" class="flex gap-2">
                      <button
                        @click="handleStockIn(item.id)"
                        :disabled="inventoryStore.loading || !stockQuantity || stockQuantity <= 0"
                        class="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                      >
                        Stock In (+)
                      </button>
                      <button
                        @click="handleStockOut(item.id)"
                        :disabled="inventoryStore.loading || !stockQuantity || stockQuantity <= 0"
                        class="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                      >
                        Stock Out (-)
                      </button>
                      <button
                        @click="cancelEdit"
                        class="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    <ActionButtonGroup
                      v-else
                      :actions="getItemActions()"
                      size="sm"
                      :loading="inventoryStore.loading"
                      @action-click="(actionKey) => handleActionClick(actionKey, item)"
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
            :total-items="sortedAndFilteredItems.length"
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
  </div>
</template>

<script setup lang="ts">
import TablePagination from '@/components/TablePagination.vue'
import { usePagination } from '@/composables/usePagination'
import { useInventoryStore } from '@/stores/inventory'
import type { InventoryItem, NewInventoryItem, StockStatus } from '@/types/inventory'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import ErrorAlert from '@/components/ui/ErrorAlert.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import ActionModal from '@/components/ui/ActionModal.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import ActionButtonGroup from '@/components/ui/ActionButtonGroup.vue'
import * as XLSX from 'xlsx'

const inventoryStore = useInventoryStore()

const searchQuery = ref<string>('')
const showAddForm = ref<boolean>(false)
const editingItem = ref<string | null>(null)
const stockQuantity = ref<number>(1)
const fileInput = ref<HTMLInputElement | null>(null)
const itemNameInputRef = ref<HTMLInputElement | null>(null)

// New stock in modal variables
const showStockInModal = ref<boolean>(false)
const stockInItem = ref<InventoryItem | null>(null)
const clearOrderDate = ref<boolean>(true) // Default to clearing order date

// Sorting configuration
const sortConfig = ref<{
  key: keyof InventoryItem | 'status' | null
  direction: 'asc' | 'desc'
}>({
  key: null,
  direction: 'asc',
})

// Import status tracking
const importStatus = ref({
  show: false,
  loading: false,
  error: null as string | null,
  success: false,
  fileName: '',
  importedCount: 0,
  updatedCount: 0,
  deletedCount: 0,
  totalProcessed: 0,
})

// New item form
const newItem = ref<NewInventoryItem>({
  item_name: '',
  quantity: 0,
  reorder_level: 0,
  unit: '',
})

// Helper function to get stock status for sorting
const getStockStatusValue = (item: InventoryItem): number => {
  if (item.quantity === 0) return 0 // Out of Stock
  if (item.quantity <= item.reorder_level) return 1 // Reorder Level Reached
  return 2 // In Stock
}

// Sorting and filtering logic
const sortedAndFilteredItems = computed((): InventoryItem[] => {
  let items = inventoryStore.searchItems(searchQuery.value)

  if (sortConfig.value.key) {
    items = [...items].sort((a, b) => {
      let aValue: string | number | null
      let bValue: string | number | null

      if (sortConfig.value.key === 'status') {
        aValue = getStockStatusValue(a)
        bValue = getStockStatusValue(b)
      } else {
        aValue = a[sortConfig.value.key as keyof InventoryItem]
        bValue = b[sortConfig.value.key as keyof InventoryItem]
      }

      // Handle null values (put them at the end)
      if (aValue === null && bValue === null) return 0
      if (aValue === null) return sortConfig.value.direction === 'asc' ? 1 : -1
      if (bValue === null) return sortConfig.value.direction === 'asc' ? -1 : 1

      // Handle string comparison for item_name
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase())
        return sortConfig.value.direction === 'asc' ? comparison : -comparison
      }

      // Handle number comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.value.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      return 0
    })
  }

  return items
})

// Pagination
const pagination = usePagination(sortedAndFilteredItems)

// Format date for display
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Open stock in modal
const openStockInModal = (item: InventoryItem): void => {
  stockInItem.value = item
  clearOrderDate.value = true // Default to clearing order date
  showStockInModal.value = true
}

// Close stock in modal
const closeStockInModal = (): void => {
  showStockInModal.value = false
  stockInItem.value = null
  clearOrderDate.value = true
}

// Helper function to get item max quantity
const getItemMaxQuantity = (itemId: string): number => {
  const item = inventoryStore.items.find((item) => item.id === itemId)
  return item?.quantity || 0
}

// Confirm stock in with optional order date clearing
const confirmStockIn = async (): Promise<void> => {
  if (!stockInItem.value || stockQuantity.value <= 0) return

  await inventoryStore.stockIn(stockInItem.value.id, stockQuantity.value, clearOrderDate.value)

  if (!inventoryStore.error) {
    closeStockInModal()
    cancelEdit()
  }
}

// Reset to first page when filters change
watch([searchQuery], () => {
  pagination.resetToFirstPage()
})

// Table column configuration
const tableColumns = [
  { key: 'item_name', label: 'Item Name', sortable: true },
  { key: 'quantity', label: 'Current Stock', sortable: true },
  { key: 'reorder_level', label: 'Reorder Level', sortable: true },
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
    sortConfig.value.key = key as keyof InventoryItem | 'status'
    sortConfig.value.direction = 'asc'
  }
  pagination.resetToFirstPage() // Reset to first page when sorting changes
}

// Action button configurations
const getItemActions = (): Array<{
  key: string
  label: string
  variant: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'info'
}> => {
  return [
    {
      key: 'manage-stock',
      label: 'Manage Stock',
      variant: 'primary',
    },
    {
      key: 'delete',
      label: 'Delete',
      variant: 'danger',
    },
  ]
}

// Handle action button clicks
const handleActionClick = (actionKey: string, item: InventoryItem) => {
  switch (actionKey) {
    case 'manage-stock':
      startEdit(item)
      break
    case 'delete':
      deleteItem(item.id)
      break
  }
}

const startEdit = (item: InventoryItem): void => {
  editingItem.value = item.id
  stockQuantity.value = 1 // Default to 1
}

const cancelEdit = (): void => {
  editingItem.value = null
  stockQuantity.value = 1
}

// Modified handleStockIn method
const handleStockIn = async (itemId: string): Promise<void> => {
  const item = inventoryStore.items.find((item) => item.id === itemId)
  if (!item) return

  // If item has an order date, show modal for confirmation
  if (item.order_date) {
    openStockInModal(item)
  } else {
    // If no order date, proceed with simple stock in
    if (stockQuantity.value > 0) {
      await inventoryStore.stockIn(itemId, stockQuantity.value, true)
      if (!inventoryStore.error) {
        editingItem.value = null
        stockQuantity.value = 1
      }
    }
  }
}

const handleStockOut = async (itemId: string): Promise<void> => {
  if (stockQuantity.value > 0) {
    await inventoryStore.stockOut(itemId, stockQuantity.value)
    if (!inventoryStore.error) {
      editingItem.value = null
      stockQuantity.value = 1
    }
  }
}

const openAddForm = async (): Promise<void> => {
  showAddForm.value = true
  await nextTick() // Wait for DOM to update
  itemNameInputRef.value?.focus() // Focus the item name input
}

const addNewItem = async (): Promise<void> => {
  if (newItem.value.item_name.trim()) {
    await inventoryStore.addItem({ ...newItem.value })
    if (!inventoryStore.error) {
      newItem.value = {
        item_name: '',
        quantity: 0,
        reorder_level: 0,
        unit: '',
      }
      showAddForm.value = false
    }
  }
}

const deleteItem = async (itemId: string): Promise<void> => {
  if (confirm('Are you sure you want to delete this item?')) {
    await inventoryStore.deleteItem(itemId)
  }
}

const getStockStatus = (item: InventoryItem): StockStatus => {
  if (item.quantity === 0) return { text: 'Out of Stock', class: 'bg-red-100 text-red-800' }
  if (item.quantity <= item.reorder_level)
    return { text: 'Low Stock', class: 'bg-yellow-100 text-yellow-800' }
  return { text: 'In Stock', class: 'bg-green-100 text-green-800' }
}

const getStockStatusVariant = (item: InventoryItem): 'out-of-stock' | 'low-stock' | 'in-stock' => {
  if (item.quantity === 0) return 'out-of-stock'
  if (item.quantity <= item.reorder_level) return 'low-stock'
  return 'in-stock'
}

// Excel Import Functions
const triggerFileUpload = (): void => {
  fileInput.value?.click()
}

const handleFileUpload = async (event: Event): Promise<void> => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  // Reset import status
  importStatus.value = {
    show: true,
    loading: true,
    error: null,
    success: false,
    fileName: file.name,
    importedCount: 0,
    updatedCount: 0,
    deletedCount: 0,
    totalProcessed: 0,
  }

  try {
    const data = await parseExcelFile(file)
    await importInventoryData(data)

    importStatus.value.loading = false
    importStatus.value.success = true

    // Hide success message after 10 seconds
    setTimeout(() => {
      importStatus.value.show = false
    }, 10000)
  } catch (error) {
    importStatus.value.loading = false
    importStatus.value.error = error instanceof Error ? error.message : 'Unknown error occurred'

    // Hide error message after 10 seconds
    setTimeout(() => {
      importStatus.value.show = false
    }, 10000)
  }

  // Clear the file input
  target.value = ''
}

interface ExcelData {
  item_name: string
  quantity: number
  reorder_level: number
  unit: string
  remark: string
  order_date: string
}

const parseExcelFile = async (file: File): Promise<ExcelData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)

        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        resolve(jsonData as ExcelData[])
      } catch {
        reject(new Error('Failed to parse Excel file. Please ensure it has the correct format.'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsArrayBuffer(file)
  })
}

const importInventoryData = async (data: ExcelData[]): Promise<void> => {
  let importedCount = 0
  let updatedCount = 0
  let deletedCount = 0

  try {
    // Validate all rows first
    for (const row of data) {
      if (
        !row.item_name ||
        typeof row.quantity !== 'number' ||
        typeof row.reorder_level !== 'number' ||
        !row.unit ||
        !row.remark ||
        !row.order_date
      ) {
        throw new Error(
          'Invalid data format. Please ensure all rows have: item_name, quantity, reorder_level, unit, remark, order_date',
        )
      }
    }

    // Get current items from the store
    const currentItems = [...inventoryStore.items]

    // Create a map of Excel items (lowercase for case-insensitive comparison)
    const excelItemsMap = new Map()
    data.forEach((row) => {
      excelItemsMap.set(row.item_name.toLowerCase(), row)
    })

    // Step 1: Update existing items and add new items from Excel
    for (const row of data) {
      const itemNameLower = row.item_name.toLowerCase()

      // Check if item already exists
      const existingItem = currentItems.find(
        (item) => item.item_name.toLowerCase() === itemNameLower,
      )

      if (existingItem) {
        // Update existing item
        if (
          existingItem.item_name !== row.item_name ||
          existingItem.quantity !== row.quantity ||
          existingItem.reorder_level !== row.reorder_level ||
          existingItem.unit !== row.unit ||
          existingItem.remark !== row.remark ||
          existingItem.order_date !== row.order_date
        ) {
          await inventoryStore.updateItem(existingItem.id, {
            ...existingItem,
            quantity: Math.max(0, row.quantity),
            reorder_level: Math.max(0, row.reorder_level),
            unit: row.unit,
            remark: row.remark,
            order_date: row.order_date,
          })

          if (!inventoryStore.error) {
            updatedCount++
          }
        }
      } else {
        // Add new item
        await inventoryStore.addItem({
          item_name: row.item_name,
          quantity: Math.max(0, row.quantity),
          reorder_level: Math.max(0, row.reorder_level),
          unit: row.unit,
          remark: row.remark,
          order_date: row.order_date,
        })

        if (!inventoryStore.error) {
          importedCount++
        }
      }
    }

    // Step 2: Delete items that are not in the Excel file
    for (const currentItem of currentItems) {
      const itemNameLower = currentItem.item_name.toLowerCase()

      // If item is not in Excel file, delete it
      if (!excelItemsMap.has(itemNameLower)) {
        await inventoryStore.deleteItem(currentItem.id)

        if (!inventoryStore.error) {
          deletedCount++
        }
      }
    }

    // Update import status with detailed counts
    importStatus.value.importedCount = importedCount
    importStatus.value.updatedCount = updatedCount
    importStatus.value.deletedCount = deletedCount
    importStatus.value.totalProcessed = data.length
  } catch (error) {
    throw error
  }
}

const exportToExcel = (): void => {
  try {
    // Prepare data for export
    const exportData = sortedAndFilteredItems.value.map((item) => ({
      item_name: item.item_name,
      quantity: item.quantity,
      reorder_level: item.reorder_level,
      unit: item.unit,
      remark: item.remark,
      order_date: item.order_date,
    }))

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(exportData)

    // Set column widths for better formatting
    const columnWidths = [
      { wch: 50 }, // item_name
      { wch: 12 }, // quantity
      { wch: 22 }, // reorder_level
      { wch: 25 }, // unit
      { wch: 50 }, // remark
      { wch: 25 }, // order_date
    ]
    worksheet['!cols'] = columnWidths

    // Add the worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory')

    // Generate filename with current date
    const currentDate = new Date().toISOString().split('T')[0]
    const filename = `inventory_export_${currentDate}.xlsx`

    // Write and download the file
    XLSX.writeFile(workbook, filename)
  } catch (error) {
    console.error('Export failed:', error)
    alert('Failed to export data. Please try again.')
  }
}

onMounted(() => {})
</script>

<template>
  <div class="px-2 py-3 sm:px-0 sm:py-6">
    <div class="border-4 border-dashed border-gray-200 rounded-lg p-3 sm:p-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Price List</h2>
      </div>

      <!-- Mark Ordered Modal -->
      <ActionModal
        :is-open="showOrderModal"
        :title="`Mark Ordered: ${orderItem?.item_name}`"
        variant="edit"
        :loading="inventoryStore.loading"
        confirm-text="Mark Ordered"
        @close="closeOrderModal"
        @cancel="closeOrderModal"
        @confirm="confirmMarkAsOrdered"
      >
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
            <input
              v-model="orderDate"
              type="date"
              required
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </ActionModal>

      <!-- Search Bar -->
      <div class="mb-4 sm:mb-6">
        <SearchInput
          v-model="searchQuery"
          placeholder="Search items..."
        />
      </div>

      <!-- Error Display -->
      <div v-if="inventoryStore.error" class="mb-4">
        <ErrorAlert :message="inventoryStore.error" />
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
            :description="searchQuery ? 'Try adjusting your search terms.' : 'No items available.'"
          />

          <div v-else class="divide-y divide-gray-200">
            <div v-for="item in pagination.paginatedItems.value" :key="item.id" class="px-4 py-4">
              <div class="space-y-3">
                <!-- Item Header -->
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-medium text-gray-900 truncate flex-1 mr-2">
                    {{ item.item_name }}
                  </h4>
                </div>

                <!-- Item Details -->
                <div class="text-sm">
                  <span class="text-gray-500">Current Stock:</span>
                  <div class="font-medium text-gray-900 mt-1">
                    {{ item.quantity }} {{ item.unit }}
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

                <!-- Remark Form -->
                <div v-if="editingRemark === item.id" class="space-y-3 p-3 bg-gray-50 rounded-md">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Remark</label>
                    <textarea
                      v-model="newRemark"
                      rows="3"
                      class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter remark (e.g., last purchase price, supplier info)..."
                    ></textarea>
                  </div>
                  <div class="flex gap-2">
                    <button
                      @click="saveRemark(item.id)"
                      :disabled="inventoryStore.loading"
                      class="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                    >
                      {{ inventoryStore.loading ? 'Saving...' : 'Save' }}
                    </button>
                    <button
                      @click="cancelEditRemark"
                      class="flex-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <!-- Remark Display and Actions -->
                <div v-else>
                  <div class="text-sm">
                    <span class="text-gray-500">Remark:</span>
                    <div class="font-medium text-gray-900 mt-1 whitespace-pre-wrap">
                      {{ item.remark || 'No remark' }}
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="flex flex-row gap-2 mt-3 flex-wrap">
                    <button
                      @click="startEditRemark(item)"
                      class="flex-1 text-blue-600 hover:text-blue-900 text-sm font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded"
                    >
                      Edit Remark
                    </button>
                    <button
                      v-if="!item.order_date"
                      @click="openOrderModal(item)"
                      class="flex-1 text-orange-600 hover:text-orange-900 text-sm font-medium bg-orange-50 hover:bg-orange-100 px-3 py-1 rounded"
                    >
                      Mark Ordered
                    </button>
                    <button
                      v-else
                      @click="clearOrderDate(item.id)"
                      class="flex-1 text-green-600 hover:text-green-900 text-sm font-medium bg-green-50 hover:bg-green-100 px-3 py-1 rounded"
                    >
                      Clear Date
                    </button>
                  </div>
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
            :description="searchQuery ? 'Try adjusting your search terms.' : 'No items available.'"
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
                    {{ item.quantity }} {{ item.unit }}
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900 max-w-md">
                    <div v-if="editingRemark === item.id" class="space-y-2">
                      <textarea
                        v-model="newRemark"
                        rows="3"
                        class="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter remark (e.g., last purchase price, supplier info)..."
                      ></textarea>
                    </div>
                    <div
                      v-else
                      class="break-words whitespace-pre-wrap"
                      :title="item.remark || 'No remark'"
                    >
                      {{ item.remark || 'No remark' }}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div v-if="editingRemark === item.id" class="flex flex-row gap-x-2">
                      <button
                        @click="saveRemark(item.id)"
                        :disabled="inventoryStore.loading"
                        class="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                      >
                        {{ inventoryStore.loading ? 'Saving...' : 'Save' }}
                      </button>
                      <button
                        @click="cancelEditRemark"
                        :disabled="inventoryStore.loading"
                        class="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    <div v-else class="flex flex-row gap-x-2">
                      <button
                        @click="startEditRemark(item)"
                        class="text-blue-600 hover:text-blue-900"
                      >
                        Edit Remark
                      </button>
                      <button
                        v-if="!item.order_date"
                        @click="openOrderModal(item)"
                        class="text-orange-600 hover:text-orange-900"
                      >
                        Mark Ordered
                      </button>
                      <button
                        v-else
                        @click="clearOrderDate(item.id)"
                        class="text-green-600 hover:text-green-900"
                      >
                        Clear Date
                      </button>
                    </div>
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
import type { InventoryItem } from '@/types/inventory'
import { computed, onMounted, ref, watch } from 'vue'
import ErrorAlert from '@/components/ui/ErrorAlert.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import ActionModal from '@/components/ui/ActionModal.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'

const inventoryStore = useInventoryStore()

const searchQuery = ref<string>('')
const editingRemark = ref<string | null>(null)
const newRemark = ref<string>('')

// Order modal variables
const showOrderModal = ref<boolean>(false)
const orderItem = ref<InventoryItem | null>(null)
const orderDate = ref<string>('')

// Sorting configuration
const sortConfig = ref<{
  key: keyof InventoryItem | null
  direction: 'asc' | 'desc'
}>({
  key: null,
  direction: 'asc',
})

// Format date for display
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Order modal functions
const openOrderModal = (item: InventoryItem): void => {
  orderItem.value = item
  orderDate.value = new Date().toISOString().split('T')[0] // Today's date
  showOrderModal.value = true
}

const closeOrderModal = (): void => {
  showOrderModal.value = false
  orderItem.value = null
  orderDate.value = ''
}

const confirmMarkAsOrdered = async (): Promise<void> => {
  if (!orderItem.value || !orderDate.value) return

  // Mark ordered using the store function with selected date
  await inventoryStore.markAsOrdered(orderItem.value.id, orderDate.value)

  if (!inventoryStore.error) {
    closeOrderModal()
  }
}

const clearOrderDate = async (itemId: string): Promise<void> => {
  await inventoryStore.clearOrderDate(itemId)
}

// Sorting and filtering logic
const sortedAndFilteredItems = computed((): InventoryItem[] => {
  let items = inventoryStore.searchItems(searchQuery.value)

  if (sortConfig.value.key) {
    items = [...items].sort((a, b) => {
      const aValue = a[sortConfig.value.key as keyof InventoryItem]
      const bValue = b[sortConfig.value.key as keyof InventoryItem]

      // Handle null values (put them at the end)
      if (aValue === null && bValue === null) return 0
      if (aValue === null) return sortConfig.value.direction === 'asc' ? 1 : -1
      if (bValue === null) return sortConfig.value.direction === 'asc' ? -1 : 1

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase())
        return sortConfig.value.direction === 'asc' ? comparison : -comparison
      }

      // Handle number comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.value.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      // Handle date comparison for order_date
      if (sortConfig.value.key === 'order_date') {
        const aDate = aValue ? new Date(aValue as string).getTime() : 0
        const bDate = bValue ? new Date(bValue as string).getTime() : 0
        return sortConfig.value.direction === 'asc' ? aDate - bDate : bDate - aDate
      }

      return 0
    })
  }

  return items
})

const pagination = usePagination(sortedAndFilteredItems)

// Reset to first page when filters change
watch([searchQuery], () => {
  pagination.resetToFirstPage()
})

// Table column configuration
const tableColumns = [
  { key: 'item_name', label: 'Item Name', sortable: true },
  { key: 'quantity', label: 'Current Stock', sortable: true },
  { key: 'remark', label: 'Remark', sortable: true },
  { key: 'actions', label: 'Actions', sortable: false },
]

// Sorting functions
const toggleSort = (key: string): void => {
  if (sortConfig.value.key === key) {
    // Same column clicked - toggle direction
    sortConfig.value.direction = sortConfig.value.direction === 'asc' ? 'desc' : 'asc'
  } else {
    // New column clicked - set ascending
    sortConfig.value.key = key as keyof InventoryItem
    sortConfig.value.direction = 'asc'
  }
  pagination.resetToFirstPage()
}

// Remark editing functions
const startEditRemark = (item: InventoryItem): void => {
  editingRemark.value = item.id
  newRemark.value = item.remark || ''
}

const cancelEditRemark = (): void => {
  editingRemark.value = null
  newRemark.value = ''
}

const saveRemark = async (itemId: string): Promise<void> => {
  const item = inventoryStore.items.find((item) => item.id === itemId)
  if (!item) return

  const updatedItem: InventoryItem = {
    ...item,
    remark: newRemark.value.trim(),
    updated_at: new Date().toISOString(),
  }

  await inventoryStore.updateItem(itemId, updatedItem)

  if (!inventoryStore.error) {
    editingRemark.value = null
    newRemark.value = ''
  }
}

onMounted(() => {})
</script>

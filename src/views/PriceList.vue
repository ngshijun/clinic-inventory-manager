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
        variant="green"
        :loading="inventoryStore.loading"
        confirm-text="Mark Ordered"
        @close="closeOrderModal"
        @cancel="closeOrderModal"
        @confirm="confirmMarkAsOrdered"
      >
        <div class="space-y-4">
          <div class="bg-green-50 border border-green-200 rounded-md p-3">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                  clip-rule="evenodd"
                />
              </svg>
              <span class="text-sm font-medium text-green-800"> Set Order Date </span>
            </div>
            <p class="text-sm text-green-700">
              This will mark the item as ordered and track its pending status.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
            <input
              v-model="orderDate"
              type="date"
              required
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        </div>
      </ActionModal>

      <!-- Edit Remark Modal -->
      <ActionModal
        :is-open="showEditRemarkModal"
        :title="`Edit Remark: ${editingItem?.item_name}`"
        variant="green"
        :loading="inventoryStore.loading"
        confirm-text="Save Remark"
        :disabled="!isRemarkChanged"
        @close="closeEditRemarkModal"
        @cancel="closeEditRemarkModal"
        @confirm="confirmSaveRemark"
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
              <span class="text-sm font-medium text-blue-800"> Update Item Information </span>
            </div>
            <p class="text-sm text-blue-700">
              Add notes such as last purchase price, supplier information, or other relevant
              details.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Remark</label>
            <textarea
              v-model="newRemark"
              rows="3"
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter remark (e.g., last purchase price, supplier info)..."
            />
          </div>
        </div>
      </ActionModal>

      <!-- Search Bar and Filters -->
      <div class="mb-4 sm:mb-6 space-y-4">
        <SearchInput v-model="searchQuery" placeholder="Search items..." />
        
        <!-- Filter Controls -->
        <div class="flex flex-wrap gap-3">
          <div class="flex items-center gap-2">
            <input
              id="filter-ordered"
              v-model="showOrderedOnly"
              type="checkbox"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label for="filter-ordered" class="text-sm font-medium text-gray-700">
              Show only items with order date
            </label>
          </div>
        </div>
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
                <div class="text-sm space-y-1">
                  <div class="flex items-baseline gap-2">
                    <span class="text-gray-500 flex-shrink-0">Current Stock:</span>
                    <span class="font-medium text-gray-900">
                      {{ item.quantity }} {{ item.unit }}
                    </span>
                  </div>
                  <div v-if="item.order_date" class="flex items-baseline gap-2">
                    <span class="text-gray-500 flex-shrink-0">Ordered:</span>
                    <span class="font-medium text-blue-600">
                      {{ formatDate(item.order_date) }}
                    </span>
                  </div>
                  <div class="flex items-start gap-2">
                    <span class="text-gray-500 flex-shrink-0">Remark:</span>
                    <span class="font-medium text-gray-900 whitespace-pre-wrap">
                      {{ item.remark || 'No remark' }}
                    </span>
                  </div>
                </div>

                <!-- Actions -->
                <div class="pt-2 border-t border-gray-100">
                  <ActionButtonGroup
                    :actions="getItemActions(item)"
                    size="sm"
                    :loading="inventoryStore.loading"
                    @action-click="(actionKey) => handleActionClick(actionKey, item)"
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
                    <div
                      class="break-words whitespace-pre-wrap"
                      :title="item.remark || 'No remark'"
                    >
                      {{ item.remark || 'No remark' }}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <ActionButtonGroup
                      :actions="getItemActions(item)"
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
import type { InventoryItem } from '@/types/inventory'
import { computed, onMounted, ref, watch } from 'vue'
import ErrorAlert from '@/components/ui/ErrorAlert.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import ActionModal from '@/components/ui/ActionModal.vue'
import SortableTableHeader from '@/components/ui/SortableTableHeader.vue'
import ActionButtonGroup from '@/components/ui/ActionButtonGroup.vue'

const inventoryStore = useInventoryStore()

const searchQuery = ref<string>('')
const newRemark = ref<string>('')
const showOrderedOnly = ref<boolean>(false)

// Order modal variables
const showOrderModal = ref<boolean>(false)
const orderItem = ref<InventoryItem | null>(null)
const orderDate = ref<string>('')

// Edit remark modal variables
const showEditRemarkModal = ref<boolean>(false)
const editingItem = ref<InventoryItem | null>(null)

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

// Computed property for remark validation
const isRemarkChanged = computed(() => {
  if (!editingItem.value) return false
  return newRemark.value.trim() !== (editingItem.value.remark || '').trim()
})

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

// Edit remark modal functions
const openEditRemarkModal = (item: InventoryItem): void => {
  editingItem.value = item
  newRemark.value = item.remark || ''
  showEditRemarkModal.value = true
}

const closeEditRemarkModal = (): void => {
  showEditRemarkModal.value = false
  editingItem.value = null
  newRemark.value = ''
}

const confirmSaveRemark = async (): Promise<void> => {
  if (!editingItem.value || !isRemarkChanged.value) return

  await saveRemark(editingItem.value.id)
  if (!inventoryStore.error) {
    closeEditRemarkModal()
  }
}

// Sorting and filtering logic
const sortedAndFilteredItems = computed((): InventoryItem[] => {
  let items = inventoryStore.searchItems(searchQuery.value)

  // Apply order date filter
  if (showOrderedOnly.value) {
    items = items.filter(item => item.order_date)
  }

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
watch([searchQuery, showOrderedOnly], () => {
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

// Action button configurations
const getItemActions = (
  item: InventoryItem,
): Array<{
  key: string
  label: string
  variant: 'blue' | 'gray' | 'red' | 'green' | 'yellow' | 'cyan'
}> => {
  const actions: Array<{
    key: string
    label: string
    variant: 'blue' | 'gray' | 'red' | 'green' | 'yellow' | 'cyan'
  }> = [
    {
      key: 'edit-remark',
      label: 'Edit Remark',
      variant: 'blue',
    },
  ]

  if (!item.order_date) {
    actions.push({
      key: 'mark-ordered',
      label: 'Mark Ordered',
      variant: 'green',
    })
  } else {
    actions.push({
      key: 'clear-date',
      label: 'Clear Date',
      variant: 'yellow',
    })
  }

  return actions
}

// Handle action button clicks
const handleActionClick = (actionKey: string, item: InventoryItem) => {
  switch (actionKey) {
    case 'edit-remark':
      openEditRemarkModal(item)
      break
    case 'mark-ordered':
      openOrderModal(item)
      break
    case 'clear-date':
      clearOrderDate(item.id)
      break
  }
}

// Remark editing functions
const saveRemark = async (itemId: string): Promise<void> => {
  const item = inventoryStore.items.find((item) => item.id === itemId)
  if (!item) return

  const updatedItem: InventoryItem = {
    ...item,
    remark: newRemark.value.trim(),
    updated_at: new Date().toISOString(),
  }

  await inventoryStore.updateItem(itemId, updatedItem)
}

onMounted(() => {})
</script>

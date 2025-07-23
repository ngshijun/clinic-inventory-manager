<template>
  <div class="px-2 py-3 sm:px-0 sm:py-6">
    <div class="border-4 border-dashed border-gray-200 rounded-lg p-3 sm:p-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Price List</h2>
      </div>

      <!-- Search Bar -->
      <div class="mb-4 sm:mb-6">
        <div class="w-full sm:max-w-md">
          <label for="search" class="sr-only">Search items</label>
          <div class="relative">
            <input
              id="search"
              v-model="searchQuery"
              type="text"
              class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Search items..."
            />
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                class="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="inventoryStore.error" class="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              ></path>
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Error</h3>
            <p class="mt-1 text-sm text-red-700">{{ inventoryStore.error }}</p>
          </div>
        </div>
      </div>

      <!-- Mobile Card View -->
      <div class="block lg:hidden">
        <div class="bg-white shadow overflow-hidden sm:rounded-md">
          <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 class="text-lg leading-6 font-medium text-gray-900">
              Items ({{ sortedAndFilteredItems.length }})
            </h3>
          </div>

          <div
            v-if="inventoryStore.loading && sortedAndFilteredItems.length === 0"
            class="text-center py-8"
          >
            <div
              class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"
            ></div>
            <p class="mt-2 text-gray-600 text-sm">Loading items...</p>
          </div>

          <div v-else-if="sortedAndFilteredItems.length === 0" class="text-center py-12">
            <svg
              class="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              ></path>
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No items found</h3>
            <p class="mt-1 text-sm text-gray-500">
              {{ searchQuery ? 'Try adjusting your search terms.' : 'No items available.' }}
            </p>
          </div>

          <div v-else class="divide-y divide-gray-200">
            <div v-for="item in paginatedItems" :key="item.id" class="px-4 py-4">
              <div class="space-y-3">
                <!-- Item Header -->
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-medium text-gray-900 truncate flex-1 mr-2">
                    {{ item.item_name }}
                  </h4>
                </div>

                <!-- Remark Section -->
                <div>
                  <span class="text-gray-500 text-sm">Remark:</span>
                  <div v-if="editingRemark === item.id" class="mt-1 space-y-2">
                    <textarea
                      v-model="newRemark"
                      rows="3"
                      class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter remark (e.g., last purchase price, supplier info)..."
                    ></textarea>
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
                  <div v-else class="mt-1 flex items-center justify-between">
                    <span class="text-gray-900 text-sm flex-1 break-words">{{
                      item.remark || 'No remark'
                    }}</span>
                    <button
                      @click="startEditRemark(item)"
                      class="ml-2 text-blue-600 hover:text-blue-900 text-sm font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded flex-shrink-0"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Mobile Pagination -->
          <TablePagination
            v-if="totalPages > 1"
            :current-page="currentPage"
            :total-pages="totalPages"
            :items-per-page="itemsPerPage"
            :total-items="sortedAndFilteredItems.length"
            :start-index="startIndex"
            :end-index="endIndex"
            :show-items-per-page-selector="false"
            @page-change="goToPage"
            @items-per-page-change="updateItemsPerPage"
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

          <div
            v-if="inventoryStore.loading && sortedAndFilteredItems.length === 0"
            class="text-center py-8"
          >
            <div
              class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"
            ></div>
            <p class="mt-2 text-gray-600 text-sm">Loading items...</p>
          </div>

          <div v-else-if="sortedAndFilteredItems.length === 0" class="text-center py-12">
            <svg
              class="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              ></path>
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No items found</h3>
            <p class="mt-1 text-sm text-gray-500">
              {{ searchQuery ? 'Try adjusting your search terms.' : 'No items available.' }}
            </p>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    @click="toggleSort('item_name')"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div class="flex items-center justify-between">
                      <span>Item Name</span>
                      <div class="flex flex-col ml-2">
                        <svg
                          :class="[
                            'w-3 h-3 transition-colors',
                            sortConfig.key === 'item_name' && sortConfig.direction === 'asc'
                              ? 'text-blue-600'
                              : 'text-gray-400',
                          ]"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                            clip-rule="evenodd"
                          />
                        </svg>
                        <svg
                          :class="[
                            'w-3 h-3 transition-colors -mt-1',
                            sortConfig.key === 'item_name' && sortConfig.direction === 'desc'
                              ? 'text-blue-600'
                              : 'text-gray-400',
                          ]"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clip-rule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </th>
                  <th
                    @click="toggleSort('remark')"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div class="flex items-center justify-between">
                      <span>Remark</span>
                      <div class="flex flex-col ml-2">
                        <svg
                          :class="[
                            'w-3 h-3 transition-colors',
                            sortConfig.key === 'remark' && sortConfig.direction === 'asc'
                              ? 'text-blue-600'
                              : 'text-gray-400',
                          ]"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                            clip-rule="evenodd"
                          />
                        </svg>
                        <svg
                          :class="[
                            'w-3 h-3 transition-colors -mt-1',
                            sortConfig.key === 'remark' && sortConfig.direction === 'desc'
                              ? 'text-blue-600'
                              : 'text-gray-400',
                          ]"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clip-rule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="item in paginatedItems" :key="item.id" class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ item.item_name }}
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
                    <div v-else class="break-words" :title="item.remark || 'No remark'">
                      {{ item.remark || 'No remark' }}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div v-if="editingRemark === item.id" class="flex flex-col gap-2">
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
                    <button
                      v-else
                      @click="startEditRemark(item)"
                      class="text-blue-600 hover:text-blue-900"
                    >
                      Edit Remark
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Desktop Pagination -->
          <TablePagination
            :current-page="currentPage"
            :total-pages="totalPages"
            :items-per-page="itemsPerPage"
            :total-items="sortedAndFilteredItems.length"
            :start-index="startIndex"
            :end-index="endIndex"
            :show-items-per-page-selector="true"
            :items-per-page-options="[10, 25, 50, 100]"
            @page-change="goToPage"
            @items-per-page-change="updateItemsPerPage"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import TablePagination from '@/components/TablePagination.vue'
import { useInventoryStore } from '@/stores/inventory'
import type { InventoryItem } from '@/types/inventory'
import { computed, onMounted, ref, watch } from 'vue'

const inventoryStore = useInventoryStore()

const searchQuery = ref<string>('')
const editingRemark = ref<string | null>(null)
const newRemark = ref<string>('')

// Pagination
const currentPage = ref<number>(1)
const itemsPerPage = ref<number>(10)

// Sorting configuration
const sortConfig = ref<{
  key: keyof InventoryItem | null
  direction: 'asc' | 'desc'
}>({
  key: null,
  direction: 'asc',
})

// Sorting and filtering logic
const sortedAndFilteredItems = computed((): InventoryItem[] => {
  let items = inventoryStore.searchItems(searchQuery.value)

  if (sortConfig.value.key) {
    items = [...items].sort((a, b) => {
      const aValue = a[sortConfig.value.key as keyof InventoryItem]
      const bValue = b[sortConfig.value.key as keyof InventoryItem]

      // Handle string comparison
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

// Pagination computed properties
const totalPages = computed((): number => {
  return Math.ceil(sortedAndFilteredItems.value.length / itemsPerPage.value)
})

const startIndex = computed((): number => {
  return (currentPage.value - 1) * itemsPerPage.value
})

const endIndex = computed((): number => {
  return startIndex.value + itemsPerPage.value
})

const paginatedItems = computed((): InventoryItem[] => {
  return sortedAndFilteredItems.value.slice(startIndex.value, endIndex.value)
})

// Pagination functions
const goToPage = (page: number): void => {
  currentPage.value = page
}

const updateItemsPerPage = (newItemsPerPage: number): void => {
  itemsPerPage.value = newItemsPerPage
  currentPage.value = 1 // Reset to first page
}

// Reset to first page when filters change
watch([searchQuery, itemsPerPage], () => {
  currentPage.value = 1
})

// Sorting functions
const toggleSort = (key: keyof InventoryItem): void => {
  if (sortConfig.value.key === key) {
    // Same column clicked - toggle direction
    sortConfig.value.direction = sortConfig.value.direction === 'asc' ? 'desc' : 'asc'
  } else {
    // New column clicked - set ascending
    sortConfig.value.key = key
    sortConfig.value.direction = 'asc'
  }
  currentPage.value = 1 // Reset to first page when sorting changes
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

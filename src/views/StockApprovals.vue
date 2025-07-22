<template>
  <div class="px-2 py-3 sm:px-0 sm:py-6">
    <div class="border-4 border-dashed border-gray-200 rounded-lg p-3 sm:p-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Stock Approvals</h2>
        <div class="flex items-center gap-4 text-sm text-gray-600">
          <span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
            {{ pendingRequests.length }} Pending
          </span>
          <span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
            {{ approvedToday }} Approved Today
          </span>
        </div>
      </div>

      <!-- Search and Filter Bar -->
      <div class="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-4">
        <!-- Search -->
        <div class="flex-1 sm:max-w-md">
          <label for="search" class="sr-only">Search requests</label>
          <div class="relative">
            <input
              id="search"
              v-model="searchQuery"
              type="text"
              class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Search requests..."
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

        <!-- Date Filter -->
        <div class="w-full sm:w-40">
          <input
            v-model="filterDate"
            type="date"
            class="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Filter by date"
          />
        </div>

        <!-- Clear Filters -->
        <button
          v-if="hasActiveFilters"
          @click="clearFilters"
          class="w-full sm:w-auto px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          Clear Filters
        </button>
      </div>

      <!-- Bulk Actions -->
      <div
        v-if="selectedRequests.length > 0"
        class="mb-4 bg-blue-50 border border-blue-200 rounded-md p-4"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm text-blue-800">
            {{ selectedRequests.length }} request(s) selected
          </span>
          <div class="flex gap-2">
            <button
              @click="bulkApprove"
              :disabled="stockRequestsStore.loading"
              class="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
            >
              Approve Selected
            </button>
            <button
              @click="clearSelection"
              class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <div
        v-if="stockRequestsStore.error"
        class="mb-4 bg-red-50 border border-red-200 rounded-md p-4"
      >
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
            <p class="mt-1 text-sm text-red-700">{{ stockRequestsStore.error }}</p>
          </div>
        </div>
      </div>

      <!-- Mobile Card View -->
      <div class="block lg:hidden">
        <div class="bg-white shadow overflow-hidden sm:rounded-md">
          <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 class="text-lg leading-6 font-medium text-gray-900">
              Requests ({{ sortedAndFilteredRequests.length }})
            </h3>
          </div>

          <div
            v-if="stockRequestsStore.loading && sortedAndFilteredRequests.length === 0"
            class="text-center py-8"
          >
            <div
              class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"
            ></div>
            <p class="mt-2 text-gray-600 text-sm">Loading requests...</p>
          </div>

          <div v-else-if="sortedAndFilteredRequests.length === 0" class="text-center py-12">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No requests found</h3>
            <p class="mt-1 text-sm text-gray-500">
              {{
                hasActiveFilters
                  ? 'Try adjusting your search terms or filters.'
                  : 'No requests need approval at the moment.'
              }}
            </p>
          </div>

          <div v-else class="divide-y divide-gray-200">
            <div v-for="request in paginatedRequests" :key="request.id" class="px-4 py-4">
              <div class="space-y-3">
                <!-- Request Header -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <input
                      v-if="request.status === 'Pending'"
                      type="checkbox"
                      :checked="selectedRequests.includes(request.id)"
                      @change="toggleSelection(request.id)"
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <h4 class="text-sm font-medium text-gray-900 truncate flex-1">
                      {{ request.item_name }}
                    </h4>
                  </div>
                  <span
                    :class="[
                      'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                      request.status === 'Pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : request.status === 'Approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800',
                    ]"
                  >
                    {{ request.status }}
                  </span>
                </div>

                <!-- Request Details -->
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span class="text-gray-500">Quantity:</span>
                    <div class="font-medium text-gray-900 mt-1">
                      {{ request.quantity }} {{ request.unit }}
                    </div>
                  </div>
                </div>

                <div class="text-sm">
                  <span class="text-gray-500">Remark:</span>
                  <div class="font-medium text-gray-900 mt-1">
                    {{ request.remark || 'No Remark' }}
                  </div>
                </div>

                <!-- Stock Availability Warning -->
                <div
                  v-if="request.status === 'Pending' && !hasEnoughStock(request)"
                  class="bg-red-50 border border-red-200 rounded p-2"
                >
                  <div class="flex items-center gap-2">
                    <svg class="h-4 w-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fill-rule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clip-rule="evenodd"
                      ></path>
                    </svg>
                    <span class="text-xs text-red-800">Insufficient stock available</span>
                  </div>
                </div>

                <!-- Actions -->
                <div v-if="request.status === 'Pending'" class="flex gap-2">
                  <button
                    @click="approveRequest(request.id)"
                    :disabled="stockRequestsStore.loading || !hasEnoughStock(request)"
                    class="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    Approve
                  </button>
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
            :total-items="sortedAndFilteredRequests.length"
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
            <div class="flex items-center justify-between">
              <h3 class="text-lg leading-6 font-medium text-gray-900">
                Requests ({{ sortedAndFilteredRequests.length }})
              </h3>
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  :checked="allPendingSelected"
                  @change="toggleAllSelection"
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span class="text-sm text-gray-500">Select All Pending</span>
              </div>
            </div>
          </div>

          <div
            v-if="stockRequestsStore.loading && sortedAndFilteredRequests.length === 0"
            class="text-center py-8"
          >
            <div
              class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"
            ></div>
            <p class="mt-2 text-gray-600 text-sm">Loading requests...</p>
          </div>

          <div v-else-if="sortedAndFilteredRequests.length === 0" class="text-center py-12">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No requests found</h3>
            <p class="mt-1 text-sm text-gray-500">
              {{
                hasActiveFilters
                  ? 'Try adjusting your search terms or filters.'
                  : 'No requests need approval at the moment.'
              }}
            </p>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    class="ps-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    <input
                      type="checkbox"
                      :checked="allPendingSelected"
                      @change="toggleAllSelection"
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </th>
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
                    @click="toggleSort('quantity')"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div class="flex items-center justify-between">
                      <span>Requested</span>
                      <div class="flex flex-col ml-2">
                        <svg
                          :class="[
                            'w-3 h-3 transition-colors',
                            sortConfig.key === 'quantity' && sortConfig.direction === 'asc'
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
                            sortConfig.key === 'quantity' && sortConfig.direction === 'desc'
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
                    Remark
                  </th>
                  <th
                    @click="toggleSort('status')"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div class="flex items-center justify-between">
                      <span>Status</span>
                      <div class="flex flex-col ml-2">
                        <svg
                          :class="[
                            'w-3 h-3 transition-colors',
                            sortConfig.key === 'status' && sortConfig.direction === 'asc'
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
                            sortConfig.key === 'status' && sortConfig.direction === 'desc'
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
                <tr
                  v-for="request in paginatedRequests"
                  :key="request.id"
                  class="hover:bg-gray-50"
                  :class="{ 'bg-red-50': request.status === 'Pending' && !hasEnoughStock(request) }"
                >
                  <td class="ps-6 py-4 whitespace-nowrap">
                    <input
                      v-if="request.status === 'Pending'"
                      type="checkbox"
                      :checked="selectedRequests.includes(request.id)"
                      @change="toggleSelection(request.id)"
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div class="flex items-center gap-2">
                      {{ request.item_name }}
                      <svg
                        v-if="request.status === 'Pending' && !hasEnoughStock(request)"
                        class="h-4 w-4 text-red-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clip-rule="evenodd"
                        ></path>
                      </svg>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ request.quantity }} {{ request.unit }}
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    <div class="truncate" :title="request.remark || 'No Remark'">
                      {{ request.remark || 'No Remark' }}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      :class="[
                        'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                        request.status === 'Pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : request.status === 'Approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800',
                      ]"
                    >
                      {{ request.status }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div v-if="request.status === 'Pending'">
                      <button
                        @click="approveRequest(request.id)"
                        :disabled="stockRequestsStore.loading || !hasEnoughStock(request)"
                        class="text-green-600 hover:text-green-900 disabled:opacity-50"
                      >
                        Approve
                      </button>
                    </div>
                    <span v-else class="text-gray-400 text-xs">
                      {{ request.status === 'Approved' ? 'Approved' : 'Completed' }}
                    </span>
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
            :total-items="sortedAndFilteredRequests.length"
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
import { ref, computed, watch, onMounted } from 'vue'
import { useStockRequestsStore } from '@/stores/stockRequests'
import { useInventoryStore } from '@/stores/inventory'
import type { StockRequest } from '@/types/stockRequests'

// Component imports
import TablePagination from '@/components/TablePagination.vue'

// Store
const stockRequestsStore = useStockRequestsStore()
const inventoryStore = useInventoryStore()

// State
const searchQuery = ref<string>('')
const today = new Date()
const filterDate = ref<string>(
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
)
const selectedRequests = ref<string[]>([])

// Pagination
const currentPage = ref<number>(1)
const itemsPerPage = ref<number>(10)

// Sorting configuration
const sortConfig = ref<{
  key: keyof StockRequest | null
  direction: 'asc' | 'desc'
}>({
  key: null,
  direction: 'asc',
})

// Computed properties
const pendingRequests = computed(() => {
  return stockRequestsStore.requests.filter((request) => request.status === 'Pending')
})

const approvedToday = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Set to start of day

  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1) // Next day start

  return stockRequestsStore.requests.filter((request) => {
    if (request.status !== 'Approved') return false

    const updatedDate = new Date(request.updated_at)

    return updatedDate >= today && updatedDate < tomorrow
  }).length
})

const allPendingSelected = computed(() => {
  const pendingIds = paginatedRequests.value
    .filter((request) => request.status === 'Pending')
    .map((request) => request.id)
  return pendingIds.length > 0 && pendingIds.every((id) => selectedRequests.value.includes(id))
})

// Computed properties for filtering and sorting
const sortedAndFilteredRequests = computed((): StockRequest[] => {
  let requests = [...stockRequestsStore.requests]

  // Search filter
  if (searchQuery.value) {
    requests = stockRequestsStore.searchRequests(searchQuery.value)
  }

  // Date filter (applied to whatever results we have from search)
  if (filterDate.value) {
    const filterDateObj = new Date(filterDate.value)
    requests = requests.filter((request) => {
      const requestDate = new Date(request.created_at)
      return requestDate.toDateString() === filterDateObj.toDateString()
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

// Pagination computed properties
const totalPages = computed((): number => {
  return Math.ceil(sortedAndFilteredRequests.value.length / itemsPerPage.value)
})

const startIndex = computed((): number => {
  return (currentPage.value - 1) * itemsPerPage.value
})

const endIndex = computed((): number => {
  return startIndex.value + itemsPerPage.value
})

const paginatedRequests = computed((): StockRequest[] => {
  return sortedAndFilteredRequests.value.slice(startIndex.value, endIndex.value)
})

// Check if there are active filters
const hasActiveFilters = computed((): boolean => {
  return !!(searchQuery.value || filterDate.value)
})

// Helper functions
const getAvailableStock = (itemId: string): number => {
  const item = inventoryStore.items.find((item) => item.id === itemId)
  return item?.quantity || 0
}

const hasEnoughStock = (request: StockRequest): boolean => {
  return getAvailableStock(request.item_id) >= request.quantity
}

// Pagination functions
const goToPage = (page: number): void => {
  currentPage.value = page
}

const updateItemsPerPage = (newItemsPerPage: number): void => {
  itemsPerPage.value = newItemsPerPage
  currentPage.value = 1 // Reset to first page
}

// Reset to first page when filters change
watch([searchQuery, filterDate, itemsPerPage], () => {
  currentPage.value = 1
})

// Sorting functions
const toggleSort = (key: keyof StockRequest): void => {
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

// Clear all filters
const clearFilters = (): void => {
  searchQuery.value = ''
  filterDate.value = ''
  currentPage.value = 1
}

// Selection functions
const toggleSelection = (requestId: string): void => {
  const index = selectedRequests.value.indexOf(requestId)
  if (index > -1) {
    selectedRequests.value.splice(index, 1)
  } else {
    selectedRequests.value.push(requestId)
  }
}

const toggleAllSelection = (): void => {
  const pendingIds = paginatedRequests.value
    .filter((request) => request.status === 'Pending')
    .map((request) => request.id)

  if (allPendingSelected.value) {
    // Deselect all
    selectedRequests.value = selectedRequests.value.filter((id) => !pendingIds.includes(id))
  } else {
    // Select all pending
    pendingIds.forEach((id) => {
      if (!selectedRequests.value.includes(id)) {
        selectedRequests.value.push(id)
      }
    })
  }
}

const clearSelection = (): void => {
  selectedRequests.value = []
}

// Action functions
const approveRequest = async (requestId: string): Promise<void> => {
  await stockRequestsStore.approveRequest(requestId)
  // Remove from selection after approval
  const index = selectedRequests.value.indexOf(requestId)
  if (index > -1) {
    selectedRequests.value.splice(index, 1)
  }
}

const bulkApprove = async (): Promise<void> => {
  if (!confirm(`Are you sure you want to approve ${selectedRequests.value.length} request(s)?`))
    return

  for (const requestId of selectedRequests.value) {
    const request = stockRequestsStore.requests.find((r) => r.id === requestId)
    if (request && request.status === 'Pending' && hasEnoughStock(request)) {
      await stockRequestsStore.approveRequest(requestId)
    }
  }

  clearSelection()
}

// Initialize store on component mount
onMounted(() => {})
</script>

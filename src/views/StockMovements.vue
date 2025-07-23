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
            <label for="search" class="sr-only">Search by item name</label>
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

          <!-- Advanced Search Toggle -->
          <div class="flex flex-row gap-2">
            <button
              @click="showAdvancedSearch = !showAdvancedSearch"
              class="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                ></path>
              </svg>
              {{ showAdvancedSearch ? 'Hide Filters' : 'Advanced Search' }}
            </button>

            <!-- Clear Filters (visible when filters are active) -->
            <button
              v-if="hasActiveFilters"
              @click="clearAllFilters"
              class="flex items-center gap-2 px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
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
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Item Name</label>
              <input
                v-model="advancedFilters.itemName"
                type="text"
                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Filter by item name..."
              />
            </div>

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
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
              <input
                v-model="advancedFilters.startDate"
                type="date"
                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- End Date -->
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">End Date</label>
              <input
                v-model="advancedFilters.endDate"
                type="date"
                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- Remark Filter -->
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Remark</label>
              <input
                v-model="advancedFilters.remark"
                type="text"
                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Filter by remark..."
              />
            </div>
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

          <div
            v-if="stockMovementsStore.loading && sortedAndFilteredMovements.length === 0"
            class="text-center py-8"
          >
            <div
              class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"
            ></div>
            <p class="mt-2 text-gray-600 text-sm">Loading movements...</p>
          </div>

          <div v-else-if="sortedAndFilteredMovements.length === 0" class="text-center py-12">
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
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              ></path>
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No movements found</h3>
            <p class="mt-1 text-sm text-gray-500">
              {{
                searchQuery
                  ? 'Try adjusting your search terms.'
                  : 'Stock movements will appear here when you manage inventory.'
              }}
            </p>
          </div>

          <div v-else class="divide-y divide-gray-200">
            <div v-for="movement in paginatedMovements" :key="movement.id" class="px-4 py-4">
              <div class="space-y-3">
                <!-- Movement Header -->
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-medium text-gray-900 truncate flex-1 mr-2">
                    {{ movement.item_name }}
                  </h4>
                  <span
                    :class="[
                      'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                      movement.movement_type === 'stock_in'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800',
                    ]"
                  >
                    {{ movement.movement_type === 'stock_in' ? 'Stock In (+)' : 'Stock Out (-)' }}
                  </span>
                </div>

                <!-- Movement Details -->
                <div class="flex flex-row text-sm items-center justify-between">
                  <div>
                    <span class="text-gray-500">Quantity:</span>
                    <div class="font-medium text-gray-900 mt-1">
                      {{ movement.quantity }} {{ movement.unit }}
                    </div>
                  </div>
                  <div>
                    <span class="text-gray-500">Date/Time:</span>
                    <div class="font-medium text-gray-900 mt-1">
                      {{ formatDateTime(movement.created_at) }}
                    </div>
                  </div>
                </div>

                <!-- Remark Section -->
                <div>
                  <span class="text-gray-500 text-sm">Remark:</span>
                  <div v-if="editingRemark === movement.id" class="mt-1 space-y-2">
                    <textarea
                      v-model="newRemark"
                      rows="2"
                      class="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter remark..."
                    ></textarea>
                    <div class="flex gap-2">
                      <button
                        @click="saveRemark(movement.id)"
                        :disabled="stockMovementsStore.loading"
                        class="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                      >
                        {{ stockMovementsStore.loading ? 'Saving...' : 'Save' }}
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
                    <span class="text-gray-900 text-sm flex-1 whitespace-pre-wrap">{{
                      movement.remark || 'No remark'
                    }}</span>
                    <button
                      @click="startEditRemark(movement)"
                      class="flex-1 text-blue-600 hover:text-blue-900 text-sm font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded"
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
            :total-items="sortedAndFilteredMovements.length"
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
              Movements ({{ sortedAndFilteredMovements.length }})
            </h3>
          </div>

          <div
            v-if="stockMovementsStore.loading && sortedAndFilteredMovements.length === 0"
            class="text-center py-8"
          >
            <div
              class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"
            ></div>
            <p class="mt-2 text-gray-600 text-sm">Loading movements...</p>
          </div>

          <div v-else-if="sortedAndFilteredMovements.length === 0" class="text-center py-12">
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
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              ></path>
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No movements found</h3>
            <p class="mt-1 text-sm text-gray-500">
              {{
                searchQuery
                  ? 'Try adjusting your search terms.'
                  : 'Stock movements will appear here when you manage inventory.'
              }}
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
                    @click="toggleSort('quantity')"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div class="flex items-center justify-between">
                      <span>Quantity</span>
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
                    @click="toggleSort('movement_type')"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div class="flex items-center justify-between">
                      <span>Movement</span>
                      <div class="flex flex-col ml-2">
                        <svg
                          :class="[
                            'w-3 h-3 transition-colors',
                            sortConfig.key === 'movement_type' && sortConfig.direction === 'asc'
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
                            sortConfig.key === 'movement_type' && sortConfig.direction === 'desc'
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
                    @click="toggleSort('created_at')"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div class="flex items-center justify-between">
                      <span>Date/Time</span>
                      <div class="flex flex-col ml-2">
                        <svg
                          :class="[
                            'w-3 h-3 transition-colors',
                            sortConfig.key === 'created_at' && sortConfig.direction === 'asc'
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
                            sortConfig.key === 'created_at' && sortConfig.direction === 'desc'
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
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr
                  v-for="movement in paginatedMovements"
                  :key="movement.id"
                  class="hover:bg-gray-50"
                >
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ movement.item_name }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ movement.quantity }} {{ movement.unit }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      :class="[
                        'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                        movement.movement_type === 'stock_in'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800',
                      ]"
                    >
                      {{ movement.movement_type === 'stock_in' ? 'Stock In (+)' : 'Stock Out (-)' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900" style="white-space: pre-line">
                    {{ formatDateTime(movement.created_at) }}
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900">
                    <div v-if="editingRemark === movement.id" class="space-y-2">
                      <textarea
                        v-model="newRemark"
                        rows="2"
                        class="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter remark..."
                      ></textarea>
                    </div>
                    <div v-else class="max-w-xs whitespace-pre-wrap">
                      <p>{{ movement.remark || 'No remark' }}</p>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div v-if="editingRemark === movement.id" class="flex flex-col gap-2">
                      <button
                        @click="saveRemark(movement.id)"
                        :disabled="stockMovementsStore.loading"
                        class="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                      >
                        {{ stockMovementsStore.loading ? 'Saving...' : 'Save' }}
                      </button>
                      <button
                        @click="cancelEditRemark"
                        :disabled="stockMovementsStore.loading"
                        class="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    <button
                      v-else
                      @click="startEditRemark(movement)"
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
            :total-items="sortedAndFilteredMovements.length"
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
import { useStockMovementsStore } from '@/stores/stockMovements'
import type { StockMovement } from '@/types/stockMovements'
import { computed, onMounted, ref, watch } from 'vue'

const stockMovementsStore = useStockMovementsStore()

const searchQuery = ref<string>('')
const editingRemark = ref<string | null>(null)
const newRemark = ref<string>('')
const showAdvancedSearch = ref<boolean>(false)

// Pagination
const currentPage = ref<number>(1)
const itemsPerPage = ref<number>(10)

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

// Pagination computed properties
const totalPages = computed((): number => {
  return Math.ceil(sortedAndFilteredMovements.value.length / itemsPerPage.value)
})

const startIndex = computed((): number => {
  return (currentPage.value - 1) * itemsPerPage.value
})

const endIndex = computed((): number => {
  return startIndex.value + itemsPerPage.value
})

const paginatedMovements = computed((): StockMovement[] => {
  return sortedAndFilteredMovements.value.slice(startIndex.value, endIndex.value)
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
watch(
  [searchQuery, advancedFilters, itemsPerPage],
  () => {
    currentPage.value = 1
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
  currentPage.value = 1
}

// Sorting function
const toggleSort = (key: keyof StockMovement): void => {
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

const startEditRemark = (movement: StockMovement): void => {
  editingRemark.value = movement.id
  newRemark.value = movement.remark
}

const cancelEditRemark = (): void => {
  editingRemark.value = null
  newRemark.value = ''
}

const saveRemark = async (movementId: string): Promise<void> => {
  await stockMovementsStore.updateRemark(movementId, newRemark.value)
  if (!stockMovementsStore.error) {
    editingRemark.value = null
    newRemark.value = ''
  }
}

const formatDateTime = (datetime: string): string => {
  const date = new Date(datetime)
  const dateStr = date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
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

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
              class="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="stockRequestsStore.loading || !isFormValid"
              class="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {{ stockRequestsStore.loading ? 'Creating...' : 'Create Request' }}
            </button>
          </div>
        </form>
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
                  : 'No requests have been submitted yet.'
              }}
            </p>
          </div>
          <div v-else class="divide-y divide-gray-200">
            <div
              v-for="request in pagination.paginatedItems.value"
              :key="request.id"
              class="px-4 py-4"
            >
              <!-- Edit Mode -->
              <div v-if="editingRequestId === request.id" class="space-y-4">
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-medium text-gray-900">
                    {{ request.item_name }}
                  </h4>
                  <span
                    class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800"
                  >
                    {{ request.status }}
                  </span>
                </div>
                <div class="space-y-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      v-model.number="editForm.quantity"
                      type="number"
                      min="1"
                      :max="getItemMaxQuantity(request.item_id)"
                      class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p class="mt-1 text-xs text-gray-500">
                      Maximum available: {{ getItemMaxQuantity(request.item_id) }}
                      {{ request.unit }}
                    </p>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Remark</label>
                    <textarea
                      v-model="editForm.remark"
                      rows="3"
                      class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter reason for request..."
                    ></textarea>
                  </div>
                </div>
                <div class="flex gap-2">
                  <button
                    @click="saveEdit(request.id)"
                    :disabled="stockRequestsStore.loading || !isEditFormValid"
                    class="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    {{ stockRequestsStore.loading ? 'Saving...' : 'Save' }}
                  </button>
                  <button
                    @click="cancelEdit"
                    :disabled="stockRequestsStore.loading"
                    class="flex-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <!-- View Mode -->
              <div v-else class="space-y-3">
                <!-- Request Header -->
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-medium text-gray-900 truncate flex-1 mr-2">
                    {{ request.item_name }}
                  </h4>
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
                  <div class="font-medium text-gray-900 mt-1 whitespace-pre-wrap">
                    {{ request.remark || 'No Remark' }}
                  </div>
                </div>
                <!-- Actions -->
                <div v-if="request.status === 'Pending'" class="flex gap-2">
                  <button
                    @click="startEdit(request)"
                    :disabled="stockRequestsStore.loading"
                    class="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    @click="removeRequest(request.id)"
                    :disabled="stockRequestsStore.loading"
                    class="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    Remove
                  </button>
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
                  : 'No requests have been submitted yet.'
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
                  v-for="request in pagination.paginatedItems.value"
                  :key="request.id"
                  class="hover:bg-gray-50"
                >
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ request.item_name }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div v-if="editingRequestId === request.id" class="space-y-2">
                      <input
                        v-model.number="editForm.quantity"
                        type="number"
                        min="1"
                        :max="getItemMaxQuantity(request.item_id)"
                        class="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p class="text-xs text-gray-500">
                        Max: {{ getItemMaxQuantity(request.item_id) }} {{ request.unit }}
                      </p>
                    </div>
                    <div v-else>{{ request.quantity }} {{ request.unit }}</div>
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    <div v-if="editingRequestId === request.id">
                      <textarea
                        v-model="editForm.remark"
                        rows="2"
                        class="w-full max-w-xs border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter reason for request..."
                      ></textarea>
                    </div>
                    <div
                      v-else
                      class="break-words whitespace-pre-wrap"
                      :title="request.remark || 'No Remark'"
                    >
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
                    <div v-if="editingRequestId === request.id" class="flex flex-col gap-2">
                      <button
                        @click="saveEdit(request.id)"
                        :disabled="stockRequestsStore.loading || !isEditFormValid"
                        class="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                      >
                        {{ stockRequestsStore.loading ? 'Saving...' : 'Save' }}
                      </button>
                      <button
                        @click="cancelEdit"
                        :disabled="stockRequestsStore.loading"
                        class="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    <div v-else-if="request.status === 'Pending'" class="flex gap-2">
                      <button
                        @click="startEdit(request)"
                        :disabled="stockRequestsStore.loading"
                        class="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        @click="removeRequest(request.id)"
                        :disabled="stockRequestsStore.loading"
                        class="text-red-600 hover:text-red-900 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                    <span v-else class="text-gray-400 text-xs">
                      {{ request.status === 'Approved' ? 'Completed' : 'Cancelled' }}
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
  </div>
</template>

<script setup lang="ts">
import { useInventoryStore } from '@/stores/inventory'
import { useStockRequestsStore } from '@/stores/stockRequests'
import type { InventoryItem } from '@/types/inventory'
import type { NewStockRequest, StockRequest } from '@/types/stockRequests'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

// Component imports
import TablePagination from '@/components/TablePagination.vue'
import { usePagination } from '@/composables/usePagination'

// Store
const stockRequestsStore = useStockRequestsStore()
const inventoryStore = useInventoryStore()

// State
const searchQuery = ref<string>('')
const today = new Date()
const filterDate = ref<string>(today.toISOString().split('T')[0])
const showCreateForm = ref<boolean>(false)
const itemSearchQuery = ref<string>('')
const showItemDropdown = ref<boolean>(false)
const selectedItemIndex = ref<number>(-1)

// Edit state
const editingRequestId = ref<string>('')
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
  if (!editingRequestId.value) return false
  const request = stockRequestsStore.requests.find((r) => r.id === editingRequestId.value)
  if (!request) return false

  const maxQuantity = getItemMaxQuantity(request.item_id)
  return !!(editForm.value.quantity > 0 && editForm.value.quantity <= maxQuantity)
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

  // Date filter
  if (filterDate.value) {
    const filterDateObj = new Date(filterDate.value)
    requests = requests.filter((request) => {
      const requestDate = new Date(request.created_at)
      return requestDate.toDateString() === filterDateObj.toDateString()
    })
  }

  // Apply date filter on top of search filter
  if (filterDate.value && searchQuery.value) {
    const searchResults = stockRequestsStore.searchRequests(searchQuery.value)
    const filterDateObj = new Date(filterDate.value)
    requests = searchResults.filter((request) => {
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

// Pagination
const pagination = usePagination(sortedAndFilteredRequests, {
  initialItemsPerPage: 10,
  itemsPerPageOptions: [10, 25, 50, 100],
})

// Check if there are active filters
const hasActiveFilters = computed((): boolean => {
  return !!(searchQuery.value || filterDate.value)
})

// Reset to first page when filters change
watch([searchQuery, filterDate], () => {
  pagination.resetToFirstPage()
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
  pagination.resetToFirstPage()
}

// Clear all filters
const clearFilters = (): void => {
  searchQuery.value = ''
  filterDate.value = ''
  pagination.resetToFirstPage()
}

// Edit functions
const startEdit = (request: StockRequest): void => {
  editingRequestId.value = request.id
  editForm.value = {
    quantity: request.quantity,
    remark: request.remark || '',
  }
}

const cancelEdit = (): void => {
  editingRequestId.value = ''
  editForm.value = {
    quantity: 1,
    remark: '',
  }
}

const saveEdit = async (requestId: string): Promise<void> => {
  if (!isEditFormValid.value) return

  await stockRequestsStore.updateRequest(requestId, editForm.value.quantity, editForm.value.remark)

  if (!stockRequestsStore.error) {
    cancelEdit()
  }
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
const removeRequest = async (requestId: string): Promise<void> => {
  if (!confirm('Are you sure you want to remove this request?')) return
  await stockRequestsStore.removeRequest(requestId)
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

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
          <SearchInput
            v-model="searchQuery"
            placeholder="Search requests..."
          />
        </div>

        <!-- Date Filter -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
            class="flex items-center justify-center gap-2 px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors w-full sm:w-auto"
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
              @click="bulkCancel"
              :disabled="stockRequestsStore.loading"
              class="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
            >
              Cancel Selected
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

      <!-- Cancel Modal -->
      <ActionModal
        :is-open="showCancelModal"
        :title="`Cancel Request${cancelRequestIds.length > 1 ? 's' : ''}`"
        variant="reject"
        :loading="stockRequestsStore.loading"
        :confirm-text="`Cancel Request${cancelRequestIds.length > 1 ? 's' : ''}`"
        :cancel-text="`Keep Request${cancelRequestIds.length > 1 ? 's' : ''}`"
        @close="closeCancelModal"
        @cancel="closeCancelModal"
        @confirm="confirmCancel"
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
              <span class="text-sm font-medium text-red-800">
                Warning: This action cannot be undone
              </span>
            </div>
            <p class="text-sm text-red-700">
              Are you sure you want to cancel
              {{
                cancelRequestIds.length > 1
                  ? `${cancelRequestIds.length} requests`
                  : 'this request'
              }}?
            </p>
          </div>

          <!-- Cancellation Reason -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Cancellation Reason (Optional)
            </label>
            <textarea
              v-model="cancelRemark"
              rows="3"
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Enter reason for cancellation..."
            ></textarea>
          </div>
        </div>
      </ActionModal>

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
              hasActiveFilters
                ? 'Try adjusting your search terms or filters.'
                : 'No requests need approval at the moment.'
            "
          />

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
                      :placeholder="`Max: ${getItemMaxQuantity(request.item_id)}`"
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
                          : request.status === 'Cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800',
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
                    @click="startEdit(request)"
                    :disabled="stockRequestsStore.loading"
                    class="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    @click="approveRequest(request.id)"
                    :disabled="stockRequestsStore.loading || !hasEnoughStock(request)"
                    class="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    @click="showCancelDialog(request.id)"
                    :disabled="stockRequestsStore.loading"
                    class="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                  >
                    Cancel
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

          <LoadingSpinner
            v-if="stockRequestsStore.loading && sortedAndFilteredRequests.length === 0"
            message="Loading requests..."
          />

          <EmptyState
            v-else-if="sortedAndFilteredRequests.length === 0"
            icon="document"
            title="No requests found"
            :description="
              hasActiveFilters
                ? 'Try adjusting your search terms or filters.'
                : 'No requests need approval at the moment.'
            "
          />

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
                  v-for="request in pagination.paginatedItems.value"
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
                    <div v-if="editingRequestId === request.id" class="space-y-2">
                      <input
                        v-model.number="editForm.quantity"
                        type="number"
                        min="1"
                        :max="getItemMaxQuantity(request.item_id)"
                        class="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        :placeholder="`Max: ${getItemMaxQuantity(request.item_id)}`"
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
                            : request.status === 'Cancelled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800',
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
                        @click="approveRequest(request.id)"
                        :disabled="stockRequestsStore.loading || !hasEnoughStock(request)"
                        class="text-green-600 hover:text-green-900 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        @click="showCancelDialog(request.id)"
                        :disabled="stockRequestsStore.loading"
                        class="text-red-600 hover:text-red-900 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                    <span v-else class="text-gray-400 text-xs">
                      {{
                        request.status === 'Approved'
                          ? 'Approved'
                          : request.status === 'Cancelled'
                            ? 'Cancelled'
                            : 'Completed'
                      }}
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
            @page-change="goToPage"
            @items-per-page-change="updateItemsPerPage"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useInventoryStore } from '@/stores/inventory'
import { useStockRequestsStore } from '@/stores/stockRequests'
import type { StockRequest } from '@/types/stockRequests'
import { computed, onMounted, ref, watch } from 'vue'

// Component imports
import TablePagination from '@/components/TablePagination.vue'
import { usePagination } from '@/composables/usePagination'
// import ErrorAlert from '@/components/ui/ErrorAlert.vue' // Available for error displays
// import StatusBadge from '@/components/ui/StatusBadge.vue' // Available for status badges
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import ActionModal from '@/components/ui/ActionModal.vue'

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

// Edit state
const editingRequestId = ref<string>('')
const editForm = ref<{
  quantity: number
  remark: string
}>({
  quantity: 1,
  remark: '',
})

// Cancel modal state
const showCancelModal = ref<boolean>(false)
const cancelRequestIds = ref<string[]>([])
const cancelRemark = ref<string>('')

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
  const pendingIds = pagination.paginatedItems.value
    .filter((request) => request.status === 'Pending')
    .map((request) => request.id)
  return pendingIds.length > 0 && pendingIds.every((id) => selectedRequests.value.includes(id))
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

const pagination = usePagination(sortedAndFilteredRequests)

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

// Cancel functions
const showCancelDialog = (requestId: string): void => {
  cancelRequestIds.value = [requestId]
  cancelRemark.value = ''
  showCancelModal.value = true
}

const bulkCancel = (): void => {
  if (selectedRequests.value.length === 0) return
  cancelRequestIds.value = [...selectedRequests.value]
  cancelRemark.value = ''
  showCancelModal.value = true
}

const closeCancelModal = (): void => {
  showCancelModal.value = false
  cancelRequestIds.value = []
  cancelRemark.value = ''
}

const confirmCancel = async (): Promise<void> => {
  if (cancelRequestIds.value.length === 0) return

  for (const requestId of cancelRequestIds.value) {
    await stockRequestsStore.cancelRequest(requestId, cancelRemark.value)
  }

  // Remove cancelled requests from selection
  selectedRequests.value = selectedRequests.value.filter(
    (id) => !cancelRequestIds.value.includes(id),
  )

  closeCancelModal()
}

// Pagination functions
const goToPage = (page: number): void => {
  pagination.currentPage.value = page
}

const updateItemsPerPage = (newItemsPerPage: number): void => {
  pagination.itemsPerPage.value = newItemsPerPage
  pagination.currentPage.value = 1 // Reset to first page
}

// Reset to first page when filters change
watch([searchQuery, filterDate, pagination.itemsPerPage.value], () => {
  pagination.currentPage.value = 1
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
  pagination.resetToFirstPage() // Reset to first page when sorting changes
}

// Clear all filters
const clearFilters = (): void => {
  searchQuery.value = ''
  filterDate.value = ''
  pagination.resetToFirstPage()
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
  const pendingIds = pagination.paginatedItems.value
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

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

        <div v-else-if="importStatus.error" class="bg-red-50 border border-red-200 rounded-md p-4">
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
              <h3 class="text-sm font-medium text-red-800">Import failed</h3>
              <p class="mt-1 text-sm text-red-700">{{ importStatus.error }}</p>
            </div>
          </div>
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
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >Low Stock Threshold</label
              >
              <input
                v-model.number="newItem.low_stock_notice_quantity"
                type="number"
                min="0"
                required
                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <input
                v-model.number="newItem.unit"
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
        <div class="w-full sm:max-w-md">
          <label for="search" class="sr-only">Search inventory</label>
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
              {{
                searchQuery
                  ? 'Try adjusting your search terms.'
                  : 'Get started by adding your first item.'
              }}
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
                  <span
                    :class="[
                      'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                      getStockStatus(item).class,
                    ]"
                  >
                    {{ getStockStatus(item).text }}
                  </span>
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
                    <span class="text-gray-500">Low Stock Alert:</span>
                    <div class="font-medium text-gray-900 mt-1">
                      {{ item.low_stock_notice_quantity }} {{ item.unit }}
                    </div>
                  </div>
                </div>

                <!-- Stock In/Out Form -->
                <div v-if="editingItem === item.id" class="space-y-3 p-3 bg-gray-50 rounded-md">
                  <div class="flex items-center gap-2">
                    <input
                      v-model.number="stockQuantity"
                      type="number"
                      min="1"
                      placeholder="Quantity"
                      class="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
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
                    class="w-full text-gray-600 hover:text-gray-900 text-sm font-medium bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                <!-- Actions -->
                <div v-else class="flex gap-2">
                  <button
                    @click="startEdit(item)"
                    class="flex-1 text-blue-600 hover:text-blue-900 text-sm font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded"
                  >
                    Manage Stock
                  </button>
                  <button
                    @click="deleteItem(item.id)"
                    class="flex-1 text-red-600 hover:text-red-900 text-sm font-medium bg-red-50 hover:bg-red-100 px-3 py-1 rounded"
                  >
                    Delete
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
              {{
                searchQuery
                  ? 'Try adjusting your search terms.'
                  : 'Get started by adding your first item.'
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
                      <span>Current Stock</span>
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
                    @click="toggleSort('low_stock_notice_quantity')"
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div class="flex items-center justify-between">
                      <span>Low Stock Threshold</span>
                      <div class="flex flex-col ml-2">
                        <svg
                          :class="[
                            'w-3 h-3 transition-colors',
                            sortConfig.key === 'low_stock_notice_quantity' &&
                            sortConfig.direction === 'asc'
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
                            sortConfig.key === 'low_stock_notice_quantity' &&
                            sortConfig.direction === 'desc'
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
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  ></th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="item in paginatedItems" :key="item.id" class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ item.item_name }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div v-if="editingItem === item.id" class="space-y-2">
                      <div class="flex items-center space-x-2">
                        <input
                          v-model.number="stockQuantity"
                          type="number"
                          min="1"
                          placeholder="Quantity"
                          class="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div class="flex space-x-2">
                        <button
                          @click="handleStockIn(item.id)"
                          :disabled="inventoryStore.loading || !stockQuantity || stockQuantity <= 0"
                          class="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2 py-1 rounded text-xs font-medium"
                        >
                          Stock In (+)
                        </button>
                        <button
                          @click="handleStockOut(item.id)"
                          :disabled="inventoryStore.loading || !stockQuantity || stockQuantity <= 0"
                          class="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-2 py-1 rounded text-xs font-medium"
                        >
                          Stock Out (-)
                        </button>
                        <button
                          @click="cancelEdit"
                          class="text-gray-600 hover:text-gray-900 px-2 py-1 rounded text-xs font-medium border border-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                    <div v-else>{{ item.quantity }} {{ item.unit }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ item.low_stock_notice_quantity }} {{ item.unit }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      :class="[
                        'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                        getStockStatus(item).class,
                      ]"
                    >
                      {{ getStockStatus(item).text }}
                    </span>
                  </td>
                  <td class="ps-6 py-4 pe-2 whitespace-nowrap text-sm font-medium">
                    <button
                      v-if="editingItem !== item.id"
                      @click="startEdit(item)"
                      class="text-blue-600 hover:text-blue-900"
                    >
                      Manage Stock
                    </button>
                  </td>
                  <td class="pe-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button @click="deleteItem(item.id)" class="text-red-600 hover:text-red-900">
                      Delete
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
import type { InventoryItem, NewInventoryItem, StockStatus } from '@/types/inventory'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import * as XLSX from 'xlsx'

const inventoryStore = useInventoryStore()

const searchQuery = ref<string>('')
const showAddForm = ref<boolean>(false)
const editingItem = ref<string | null>(null)
const stockQuantity = ref<number>(1)
const fileInput = ref<HTMLInputElement | null>(null)
const itemNameInputRef = ref<HTMLInputElement | null>(null)

// Pagination
const currentPage = ref<number>(1)
const itemsPerPage = ref<number>(10)

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
  low_stock_notice_quantity: 0,
  unit: '',
})

// Helper function to get stock status for sorting
const getStockStatusValue = (item: InventoryItem): number => {
  if (item.quantity === 0) return 0 // Out of Stock
  if (item.quantity <= item.low_stock_notice_quantity) return 1 // Low Stock
  return 2 // In Stock
}

// Sorting and filtering logic
const sortedAndFilteredItems = computed((): InventoryItem[] => {
  let items = inventoryStore.searchItems(searchQuery.value)

  if (sortConfig.value.key) {
    items = [...items].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      if (sortConfig.value.key === 'status') {
        aValue = getStockStatusValue(a)
        bValue = getStockStatusValue(b)
      } else {
        aValue = a[sortConfig.value.key as keyof InventoryItem]
        bValue = b[sortConfig.value.key as keyof InventoryItem]
      }

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
const toggleSort = (key: keyof InventoryItem | 'status'): void => {
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

const startEdit = (item: InventoryItem): void => {
  editingItem.value = item.id
  stockQuantity.value = 1 // Default to 1
}

const cancelEdit = (): void => {
  editingItem.value = null
  stockQuantity.value = 1
}

const handleStockIn = async (itemId: string): Promise<void> => {
  if (stockQuantity.value > 0) {
    await inventoryStore.stockIn(itemId, stockQuantity.value)
    if (!inventoryStore.error) {
      editingItem.value = null
      stockQuantity.value = 1
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
        low_stock_notice_quantity: 0,
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
  if (item.quantity <= item.low_stock_notice_quantity)
    return { text: 'Low Stock', class: 'bg-yellow-100 text-yellow-800' }
  return { text: 'In Stock', class: 'bg-green-100 text-green-800' }
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
  low_stock_notice_quantity: number
  unit: string
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
        typeof row.low_stock_notice_quantity !== 'number' ||
        !row.unit
      ) {
        throw new Error(
          'Invalid data format. Please ensure all rows have: item_name, quantity, low_stock_notice_quantity, unit',
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
          existingItem.low_stock_notice_quantity !== row.low_stock_notice_quantity ||
          existingItem.unit !== row.unit
        ) {
          await inventoryStore.updateItem(existingItem.id, {
            ...existingItem,
            quantity: Math.max(0, row.quantity),
            low_stock_notice_quantity: Math.max(0, row.low_stock_notice_quantity),
            unit: row.unit,
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
          low_stock_notice_quantity: Math.max(0, row.low_stock_notice_quantity),
          unit: row.unit,
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
      low_stock_notice_quantity: item.low_stock_notice_quantity,
      unit: item.unit,
    }))

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(exportData)

    // Set column widths for better formatting
    const columnWidths = [
      { wch: 25 }, // item_name
      { wch: 12 }, // quantity
      { wch: 20 }, // low_stock_notice_quantity
      { wch: 12 }, // unit
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

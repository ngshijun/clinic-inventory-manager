<template>
  <div class="px-2 py-3 sm:px-0 sm:py-6">
    <div class="border-4 border-dashed border-gray-200 rounded-lg p-3 sm:p-6">
      <h2 class="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Inventory Dashboard</h2>

      <!-- Mark as Ordered Modal -->
      <div
        v-if="showOrderModal"
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      >
        <div class="p-5 border w-96 shadow-lg rounded-md bg-white" @click.stop>
          <div class="mt-3">
            <h3 class="text-lg font-medium text-gray-900 mb-4">
              Mark Ordered: {{ orderItem?.item_name }}
            </h3>
            <form @submit.prevent="confirmMarkAsOrdered">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1"> Order Date </label>
                  <input
                    v-model="orderDate"
                    type="date"
                    required
                    class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div class="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  @click="closeOrderModal"
                  class="px-4 py-2 bg-gray-600 rounded-md text-sm font-medium text-white hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  :disabled="inventoryStore.loading"
                  class="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {{ inventoryStore.loading ? 'Marking as Ordered...' : 'Mark Ordered' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <LoadingSpinner v-if="inventoryStore.loading" message="Loading inventory data..." size="lg" />

      <!-- Error State -->
      <div v-else-if="inventoryStore.error" class="mb-4 sm:mb-6">
        <ErrorAlert title="Error loading data" :message="inventoryStore.error" size="lg">
          <button
            @click="inventoryStore.fetchItems()"
            class="mt-2 text-xs sm:text-sm bg-red-100 hover:bg-red-200 text-red-800 px-2 sm:px-3 py-1 rounded"
          >
            Retry
          </button>
        </ErrorAlert>
      </div>

      <!-- Dashboard Content -->
      <div v-else>
        <!-- Stats Cards - Responsive Grid -->
        <!-- Simplified Enhanced Hover Effects -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5 mb-6 sm:mb-8">
          <!-- Total Products -->
          <div
            class="bg-white overflow-hidden shadow rounded-lg cursor-pointer transition-all duration-200 ease-out hover:shadow-lg hover:-translate-y-1 hover:ring-2 hover:ring-green-500 hover:ring-opacity-50"
            @click="navigateToInventory()"
            title="Click to view full inventory"
          >
            <div class="p-3 sm:p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div
                    class="w-6 h-6 sm:w-8 sm:h-8 bg-green-500 rounded-md flex items-center justify-center transition-colors duration-200 hover:bg-green-600"
                  >
                    <svg
                      class="w-3 h-3 sm:w-5 sm:h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2v2M7 7h10"
                      ></path>
                    </svg>
                  </div>
                </div>
                <div class="ml-3 sm:ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-xs sm:text-sm font-medium text-gray-500 truncate">
                      Total Products
                    </dt>
                    <dd class="text-base sm:text-lg font-medium text-gray-900">
                      {{ inventoryStore.totalProducts }}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Out of Stock Items -->
          <div
            class="bg-white overflow-hidden shadow rounded-lg cursor-pointer transition-all duration-200 ease-out hover:shadow-lg hover:-translate-y-1 hover:ring-2 hover:ring-red-500 hover:ring-opacity-50"
            @click="scrollToSection('out-of-stock')"
            :title="
              inventoryStore.outOfStockItems.length > 0 ? 'Click to view out of stock items' : ''
            "
          >
            <div class="p-3 sm:p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div
                    class="w-6 h-6 sm:w-8 sm:h-8 bg-red-500 rounded-md flex items-center justify-center transition-colors duration-200 hover:bg-red-600"
                  >
                    <svg
                      class="w-3 h-3 sm:w-5 sm:h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </div>
                </div>
                <div class="ml-3 sm:ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-xs sm:text-sm font-medium text-gray-500 truncate">
                      Out of Stock
                    </dt>
                    <dd class="text-base sm:text-lg font-medium text-gray-900">
                      {{ inventoryStore.outOfStockItems.length }}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Low Stock Items -->
          <div
            class="bg-white overflow-hidden shadow rounded-lg cursor-pointer transition-all duration-200 ease-out hover:shadow-lg hover:-translate-y-1 hover:ring-2 hover:ring-yellow-500 hover:ring-opacity-50"
            @click="scrollToSection('low-stock')"
            title="Click to view low stock items"
          >
            <div class="p-3 sm:p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div
                    class="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-500 rounded-md flex items-center justify-center transition-colors duration-200 hover:bg-yellow-600"
                  >
                    <svg
                      class="w-3 h-3 sm:w-5 sm:h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      ></path>
                    </svg>
                  </div>
                </div>
                <div class="ml-3 sm:ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-xs sm:text-sm font-medium text-gray-500 truncate">Low Stock</dt>
                    <dd class="text-base sm:text-lg font-medium text-gray-900">
                      {{ inventoryStore.lowStockItems.length }}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Stale Inventory -->
          <div
            class="bg-white overflow-hidden shadow rounded-lg cursor-pointer transition-all duration-200 ease-out hover:shadow-lg hover:-translate-y-1 hover:ring-2 hover:ring-purple-500 hover:ring-opacity-50"
            @click="scrollToSection('stale-inventory')"
            title="Click to view stale inventory items"
          >
            <div class="p-3 sm:p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div
                    class="w-6 h-6 sm:w-8 sm:h-8 bg-purple-500 rounded-md flex items-center justify-center transition-colors duration-200 hover:bg-purple-600"
                  >
                    <svg
                      class="w-3 h-3 sm:w-5 sm:h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  </div>
                </div>
                <div class="ml-3 sm:ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-xs sm:text-sm font-medium text-gray-500 truncate">
                      Stale Items
                    </dt>
                    <dd class="text-base sm:text-lg font-medium text-gray-900">
                      {{ staleItems.length }}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Out of Stock Alert (with ID for scrolling) -->
        <div
          v-if="inventoryStore.outOfStockItems.length > 0"
          id="out-of-stock"
          class="bg-red-50 border border-red-200 rounded-md p-3 sm:p-4 mb-4 sm:mb-6 scroll-mt-4"
        >
          <div class="flex">
            <div class="flex-shrink-0">
              <svg
                class="h-4 w-4 sm:h-5 sm:w-5 text-red-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clip-rule="evenodd"
                ></path>
              </svg>
            </div>
            <div class="ml-3 w-full">
              <h3 class="text-sm font-medium text-red-800">Out of Stock Alert</h3>
              <div class="mt-2 text-sm text-red-700">
                <p>The following items are completely out of stock:</p>
                <div class="mt-1 space-y-1">
                  <div
                    v-for="item in inventoryStore.outOfStockItems"
                    :key="item.id"
                    class="flex items-start py-2 border-b border-red-200 last:border-b-0"
                  >
                    <div
                      class="flex-shrink-0 w-1.5 h-1.5 bg-red-400 rounded-full mr-3 mt-1.5"
                    ></div>
                    <div class="flex-1">
                      <!-- Mobile: Stack vertically, Desktop: Grid layout -->
                      <div class="block sm:hidden">
                        <div class="font-medium break-words">{{ item.item_name }}</div>
                        <div class="text-xs text-red-600 mt-0.5">(0 {{ item.unit }} remaining)</div>
                        <div v-if="item.order_date" class="text-sm text-blue-600 mt-1">
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
                        <div v-else class="mt-1">
                          <button
                            @click="openOrderModal(item)"
                            :disabled="inventoryStore.loading"
                            class="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded disabled:opacity-50 transition-colors"
                          >
                            {{ inventoryStore.loading ? 'Marking...' : 'Mark Ordered' }}
                          </button>
                        </div>
                      </div>
                      <div class="hidden sm:flex sm:items-center sm:justify-between">
                        <div class="flex-1 min-w-0">
                          <div class="font-medium break-words">{{ item.item_name }}</div>
                          <div class="text-xs text-red-600 mt-0.5">
                            (0 {{ item.unit }} remaining)
                          </div>
                        </div>
                        <div class="ml-4 flex-shrink-0">
                          <div v-if="item.order_date" class="text-sm text-blue-600">
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
                          <button
                            v-else
                            @click="openOrderModal(item)"
                            :disabled="inventoryStore.loading"
                            class="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded disabled:opacity-50 transition-colors"
                          >
                            {{ inventoryStore.loading ? 'Marking...' : 'Mark Ordered' }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Low Stock Alert (with ID for scrolling) -->
        <div
          v-if="inventoryStore.lowStockItems.length > 0"
          id="low-stock"
          class="bg-yellow-50 border border-yellow-200 rounded-md p-3 sm:p-4 mb-4 sm:mb-6 scroll-mt-4"
        >
          <div class="flex">
            <div class="flex-shrink-0">
              <svg
                class="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400"
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
            <div class="ml-3 w-full">
              <h3 class="text-sm font-medium text-yellow-800">Low Stock Alert</h3>
              <div class="mt-2 text-sm text-yellow-700">
                <p>The following items are running low on stock:</p>
                <div class="mt-1 space-y-1">
                  <div
                    v-for="item in inventoryStore.lowStockItems"
                    :key="item.id"
                    class="flex items-start py-2 border-b border-yellow-200 last:border-b-0"
                  >
                    <div
                      class="flex-shrink-0 w-1.5 h-1.5 bg-yellow-400 rounded-full mr-3 mt-1.5"
                    ></div>
                    <div class="flex-1">
                      <!-- Mobile: Stack vertically, Desktop: Grid layout -->
                      <div class="block sm:hidden">
                        <div class="font-medium break-words">{{ item.item_name }}</div>
                        <div class="text-xs text-yellow-600 mt-0.5">
                          ({{ item.quantity }} {{ item.unit }} remaining)
                        </div>
                        <div v-if="item.order_date" class="text-sm text-blue-600 mt-1">
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
                        <div v-else class="mt-1">
                          <button
                            @click="openOrderModal(item)"
                            :disabled="inventoryStore.loading"
                            class="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded disabled:opacity-50 transition-colors"
                          >
                            {{ inventoryStore.loading ? 'Marking...' : 'Mark Ordered' }}
                          </button>
                        </div>
                      </div>
                      <div class="hidden sm:flex sm:items-center sm:justify-between">
                        <div class="flex-1 min-w-0">
                          <div class="font-medium break-words">{{ item.item_name }}</div>
                          <div class="text-xs text-yellow-600 mt-0.5">
                            ({{ item.quantity }} {{ item.unit }} remaining)
                          </div>
                        </div>
                        <div class="ml-4 flex-shrink-0">
                          <div v-if="item.order_date" class="text-sm text-blue-600">
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
                          <button
                            v-else
                            @click="openOrderModal(item)"
                            :disabled="inventoryStore.loading"
                            class="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded disabled:opacity-50 transition-colors"
                          >
                            {{ inventoryStore.loading ? 'Marking...' : 'Mark Ordered' }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Stale Inventory Alert (with ID for scrolling) -->
        <div
          v-if="staleItems.length > 0"
          id="stale-inventory"
          class="bg-purple-50 border border-purple-200 rounded-md p-3 sm:p-4 mb-4 sm:mb-6 scroll-mt-4"
        >
          <div class="flex">
            <div class="flex-shrink-0">
              <svg
                class="h-4 w-4 sm:h-5 sm:w-5 text-purple-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clip-rule="evenodd"
                ></path>
              </svg>
            </div>
            <div class="ml-3 w-full">
              <h3 class="text-sm font-medium text-purple-800">Stale Inventory Alert</h3>
              <div class="mt-2 text-sm text-purple-700">
                <p>The following items have not been updated for more than a month:</p>
                <div class="mt-1 space-y-1">
                  <div
                    v-for="item in staleItems"
                    :key="item.id"
                    class="flex items-start py-2 border-b border-purple-200 last:border-b-0"
                  >
                    <div
                      class="flex-shrink-0 w-1.5 h-1.5 bg-purple-400 rounded-full mr-3 mt-1.5"
                    ></div>
                    <div class="flex-1">
                      <!-- Mobile: Stack vertically, Desktop: Grid layout -->
                      <div class="block sm:hidden">
                        <div class="font-medium break-words">{{ item.item_name }}</div>
                        <div class="text-xs text-purple-600 mt-0.5">
                          ({{ formatDuration(item.daysSinceUpdate) }} ago)
                        </div>
                      </div>
                      <div class="hidden sm:flex sm:items-center sm:justify-between">
                        <div class="flex-1 min-w-0">
                          <div class="font-medium break-words">{{ item.item_name }}</div>
                          <div class="text-xs text-purple-600 mt-0.5">
                            ({{ formatDuration(item.daysSinceUpdate) }} ago)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import router from '@/router'
import { useInventoryStore } from '@/stores/inventory'
import { computed, onMounted, ref } from 'vue'
import type { InventoryItem } from '@/types/inventory'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import ErrorAlert from '@/components/ui/ErrorAlert.vue'

const inventoryStore = useInventoryStore()

// Order modal variables
const showOrderModal = ref<boolean>(false)
const orderItem = ref<InventoryItem | null>(null)
const orderDate = ref<string>('')

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

// Calculate stale items (not updated for more than 30 days)
const staleItems = computed(() => {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  return inventoryStore.items
    .map((item) => {
      const updatedAt = new Date(item.updated_at)

      const daysSinceUpdate = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24))

      return {
        ...item,
        daysSinceUpdate,
        isStale: updatedAt < thirtyDaysAgo,
      }
    })
    .filter((item) => item.isStale && item.quantity !== 0)
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate) // Sort by oldest first
})

// Navigate to inventory page
const navigateToInventory = () => {
  router.push('/inventory')
}

// Scroll to section function
const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId)
  if (element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }
}

// Format duration for display
const formatDuration = (days: number): string => {
  if (days < 7) {
    return `${days} day${days !== 1 ? 's' : ''}`
  } else if (days < 30) {
    const weeks = Math.floor(days / 7)
    return `${weeks} week${weeks !== 1 ? 's' : ''}`
  } else if (days < 365) {
    const months = Math.floor(days / 30)
    return `${months} month${months !== 1 ? 's' : ''}`
  } else {
    const years = Math.floor(days / 365)
    return `${years} year${years !== 1 ? 's' : ''}`
  }
}

// Format date for display
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const confirmMarkAsOrdered = async (): Promise<void> => {
  if (!orderItem.value || !orderDate.value) return

  // Mark ordered using the store function with selected date
  await inventoryStore.markAsOrdered(orderItem.value.id, orderDate.value)

  if (!inventoryStore.error) {
    closeOrderModal()
  }
}

onMounted(() => {})
</script>

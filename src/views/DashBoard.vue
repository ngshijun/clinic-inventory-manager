<template>
  <div class="px-2 py-3 sm:px-0 sm:py-6">
    <div class="border-4 border-dashed border-gray-200 rounded-lg p-3 sm:p-6">
      <h2 class="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Inventory Dashboard</h2>

      <!-- Loading State -->
      <div v-if="inventoryStore.loading" class="text-center py-6 sm:py-8">
        <div
          class="inline-block animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600"
        ></div>
        <p class="mt-2 text-gray-600 text-sm sm:text-base">Loading inventory data...</p>
      </div>

      <!-- Error State -->
      <div
        v-else-if="inventoryStore.error"
        class="bg-red-50 border border-red-200 rounded-md p-3 sm:p-4 mb-4 sm:mb-6"
      >
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-4 w-4 sm:h-5 sm:w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              ></path>
            </svg>
          </div>
          <div class="ml-3 flex-1">
            <h3 class="text-sm font-medium text-red-800">Error loading data</h3>
            <p class="mt-1 text-sm text-red-700">{{ inventoryStore.error }}</p>
            <button
              @click="inventoryStore.fetchItems()"
              class="mt-2 text-xs sm:text-sm bg-red-100 hover:bg-red-200 text-red-800 px-2 sm:px-3 py-1 rounded"
            >
              Retry
            </button>
          </div>
        </div>
      </div>

      <!-- Dashboard Content -->
      <div v-else>
        <!-- Stats Cards - Responsive Grid -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5 mb-6 sm:mb-8">
          <!-- Total Products -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-3 sm:p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div
                    class="w-6 h-6 sm:w-8 sm:h-8 bg-green-500 rounded-md flex items-center justify-center"
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
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012 2v2M7 7h10"
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
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-3 sm:p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div
                    class="w-6 h-6 sm:w-8 sm:h-8 bg-red-500 rounded-md flex items-center justify-center"
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
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-3 sm:p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div
                    class="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-500 rounded-md flex items-center justify-center"
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
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-3 sm:p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div
                    class="w-6 h-6 sm:w-8 sm:h-8 bg-purple-500 rounded-md flex items-center justify-center"
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

        <!-- Out of Stock Alert (NEW) -->
        <div
          v-if="inventoryStore.outOfStockItems.length > 0"
          class="bg-red-50 border border-red-200 rounded-md p-3 sm:p-4 mb-4 sm:mb-6"
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
                    class="flex items-center py-2 border-b border-red-200 last:border-b-0"
                  >
                    <div class="flex-shrink-0 w-1.5 h-1.5 bg-red-400 rounded-full mr-3"></div>
                    <div class="flex-1 grid grid-cols-3 sm:grid-cols-7 items-center">
                      <span class="font-medium col-span-2 sm:col-span-5 break-words">{{
                        item.item_name
                      }}</span>
                      <span class="col-span-1 sm:col-span-2 text-right sm:text-left"
                        >(0 {{ item.unit }} remaining)</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Low Stock Alert -->
        <div
          v-if="inventoryStore.lowStockItems.length > 0"
          class="bg-yellow-50 border border-yellow-200 rounded-md p-3 sm:p-4 mb-4 sm:mb-6"
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
                    class="flex items-center py-2 border-b border-yellow-200 last:border-b-0"
                  >
                    <div class="flex-shrink-0 w-1.5 h-1.5 bg-yellow-400 rounded-full mr-3"></div>
                    <div class="flex-1 grid grid-cols-3 sm:grid-cols-7 items-center">
                      <span class="font-medium col-span-2 sm:col-span-5 break-words">{{
                        item.item_name
                      }}</span>
                      <span class="col-span-1 sm:col-span-2 text-right sm:text-left">
                        ({{ item.quantity }} {{ item.unit }} remaining)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Stale Inventory Alert -->
        <div
          v-if="staleItems.length > 0"
          class="bg-purple-50 border border-purple-200 rounded-md p-3 sm:p-4 mb-4 sm:mb-6"
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
                    class="flex items-center py-2 border-b border-purple-200 last:border-b-0"
                  >
                    <div class="flex-shrink-0 w-1.5 h-1.5 bg-purple-400 rounded-full mr-3"></div>
                    <div class="flex-1 grid grid-cols-3 sm:grid-cols-7 items-center">
                      <span class="font-medium col-span-2 sm:col-span-5 break-words">{{
                        item.item_name
                      }}</span>
                      <span class="col-span-1 sm:col-span-2 text-right sm:text-left">
                        ({{ formatDuration(item.daysSinceUpdate) }} ago)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="mt-3">
                <p class="text-xs text-purple-700">
                  💡 Consider reviewing these items for potential clearance, promotion, or removal
                  from inventory.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Inventory Table -->
        <div class="bg-white shadow overflow-hidden sm:rounded-md">
          <div class="px-3 py-4 sm:px-6 sm:py-5">
            <h3 class="text-base sm:text-lg leading-6 font-medium text-gray-900">
              Recent Activity
            </h3>
            <p class="mt-1 max-w-2xl text-xs sm:text-sm text-gray-500">
              Recently updated inventory items
            </p>
          </div>

          <!-- Recent Items List -->
          <ul class="divide-y divide-gray-200">
            <li v-for="item in recentItems" :key="item.id" class="px-4 py-4 sm:px-6">
              <div class="grid grid-cols-4 items-center">
                <div class="flex items-center col-span-3">
                  <div class="flex-shrink-0">
                    <div
                      :class="[
                        'w-3 h-3 rounded-full',
                        item.quantity === 0
                          ? 'bg-red-400'
                          : item.quantity <= item.low_stock_notice_quantity
                            ? 'bg-yellow-400'
                            : 'bg-green-400',
                      ]"
                    ></div>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">{{ item.item_name }}</div>
                    <div class="text-sm text-gray-500">
                      Last updated: {{ formatLastUpdated(item.updated_at) }}
                    </div>
                  </div>
                </div>
                <div class="text-sm text-gray-900 col-span-1 pl-4">
                  <span class="font-medium">{{ item.quantity }} {{ item.unit }}</span>
                </div>
              </div>
            </li>
          </ul>

          <div v-if="recentItems.length === 0" class="text-center py-8">
            <p class="text-sm text-gray-500">No recent activity</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useInventoryStore } from '@/stores/inventory'
import { computed, onMounted } from 'vue'

const inventoryStore = useInventoryStore()

// Calculate stale items (not updated for more than 30 days)
const staleItems = computed(() => {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  return inventoryStore.items
    .map((item) => {
      const updatedAt = new Date(item.updated_at)
      // Use getTimezoneOffset to adjust for local timezone
      updatedAt.setMinutes(updatedAt.getMinutes() - updatedAt.getTimezoneOffset())

      const daysSinceUpdate = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24))

      return {
        ...item,
        daysSinceUpdate,
        isStale: updatedAt < thirtyDaysAgo,
      }
    })
    .filter((item) => item.isStale)
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate) // Sort by oldest first
})

// Get recent items (updated within last 7 days)
const recentItems = computed(() => {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  return inventoryStore.items
    .filter((item) => {
      const updatedAt = new Date(item.updated_at)
      // Use getTimezoneOffset to adjust for local timezone
      updatedAt.setMinutes(updatedAt.getMinutes() - updatedAt.getTimezoneOffset())
      return updatedAt >= sevenDaysAgo
    })
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10) // Show only the 10 most recent
})

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

// Format last updated timestamp
const formatLastUpdated = (timestamp: string): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

  if (diffInHours < 1) {
    return 'Just now'
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`
  } else if (diffInHours < 168) {
    // 7 days
    const days = Math.floor(diffInHours / 24)
    return `${days} day${days !== 1 ? 's' : ''} ago`
  } else {
    return date.toLocaleDateString()
  }
}

onMounted(() => {})
</script>

<template>
  <div class="px-2 py-3 sm:px-0 sm:py-6">
    <div class="border-4 border-dashed border-gray-200 rounded-lg p-3 sm:p-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Stock Movements</h2>
        <button
          @click="stockMovementsStore.fetchMovements()"
          :disabled="stockMovementsStore.loading"
          class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          {{ stockMovementsStore.loading ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>

      <!-- Search Bar -->
      <div class="mb-4 sm:mb-6">
        <div class="w-full sm:max-w-md">
          <label for="search" class="sr-only">Search by item name</label>
          <div class="relative">
            <input
              id="search"
              v-model="searchQuery"
              type="text"
              class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Search by item name..."
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
              Movements ({{ filteredMovements.length }})
            </h3>
          </div>

          <div
            v-if="stockMovementsStore.loading && filteredMovements.length === 0"
            class="text-center py-8"
          >
            <div
              class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"
            ></div>
            <p class="mt-2 text-gray-600 text-sm">Loading movements...</p>
          </div>

          <div v-else-if="filteredMovements.length === 0" class="text-center py-12">
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
            <div v-for="movement in filteredMovements" :key="movement.id" class="px-4 py-4">
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
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span class="text-gray-500">Quantity:</span>
                    <div class="font-medium text-gray-900 mt-1">{{ movement.quantity }} units</div>
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
                        class="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium"
                      >
                        Save
                      </button>
                      <button
                        @click="cancelEditRemark"
                        class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  <div v-else class="mt-1 flex items-center justify-between">
                    <span class="text-gray-900 text-sm">{{ movement.remark || 'No remark' }}</span>
                    <button
                      @click="startEditRemark(movement)"
                      class="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Desktop Table View -->
      <div class="hidden lg:block">
        <div class="bg-white shadow overflow-hidden sm:rounded-md">
          <div class="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 class="text-lg leading-6 font-medium text-gray-900">
              Movements ({{ filteredMovements.length }})
            </h3>
          </div>

          <div
            v-if="stockMovementsStore.loading && filteredMovements.length === 0"
            class="text-center py-8"
          >
            <div
              class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"
            ></div>
            <p class="mt-2 text-gray-600 text-sm">Loading movements...</p>
          </div>

          <div v-else-if="filteredMovements.length === 0" class="text-center py-12">
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
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Item Name
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Quantity
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Movement
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Date/Time
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
                  v-for="movement in filteredMovements"
                  :key="movement.id"
                  class="hover:bg-gray-50"
                >
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ movement.item_name }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ movement.quantity }} units
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
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                      <div class="flex space-x-2">
                        <button
                          @click="saveRemark(movement.id)"
                          :disabled="stockMovementsStore.loading"
                          class="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2 py-1 rounded text-xs font-medium"
                        >
                          Save
                        </button>
                        <button
                          @click="cancelEditRemark"
                          class="bg-gray-300 hover:bg-gray-400 text-gray-700 px-2 py-1 rounded text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                    <div v-else class="max-w-xs">
                      <p class="truncate">{{ movement.remark || 'No remark' }}</p>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      v-if="editingRemark !== movement.id"
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useStockMovementsStore } from '@/stores/stockMovements'
import type { StockMovement } from '@/types/stockMovement'
import { computed, onMounted, ref } from 'vue'

const stockMovementsStore = useStockMovementsStore()

const searchQuery = ref<string>('')
const editingRemark = ref<string | null>(null)
const newRemark = ref<string>('')

const filteredMovements = computed(() => {
  return stockMovementsStore.searchMovements(searchQuery.value)
})

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
  date.setTime(date.getTime() + 8 * 60 * 60 * 1000)
  return date.toLocaleString()
}

onMounted(() => {
  stockMovementsStore.initializeStore()
})
</script>

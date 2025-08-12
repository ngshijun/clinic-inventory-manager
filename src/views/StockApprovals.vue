<template>
  <div class="px-2 py-3 sm:px-0 sm:py-6">
    <div class="border-4 border-dashed border-gray-200 rounded-lg p-3 sm:p-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">Stock Approvals</h2>
        <div class="flex items-center gap-4 text-sm text-gray-600">
          <span
            v-if="nonTodayPendingCount > 0"
            class="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium"
          >
            {{ nonTodayPendingCount }} Older Pending
          </span>
          <span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
            {{ pendingRequests.length }} Pending
          </span>
          <span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
            {{ approvedToday }} Approved
          </span>
        </div>
      </div>

      <!-- Search and Filter Bar -->
      <div class="mb-4 sm:mb-6 space-y-4">
        <!-- Search and Date Filter -->
        <div class="flex flex-col sm:flex-row gap-4">
          <!-- Search -->
          <div class="flex-1 sm:max-w-md">
            <SearchInput v-model="searchQuery" placeholder="Search requests..." />
          </div>

          <!-- Date Filter and Clear Filters -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div class="w-full sm:w-40">
              <input
                v-model="filterDate"
                type="date"
                class="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 max-w-full box-border disabled:opacity-50"
                :disabled="showOlderPending"
                placeholder="Filter by date"
              />
            </div>

            <!-- Clear Filters -->
            <button
              v-if="showResetButton"
              @click="resetToToday"
              class="flex items-center justify-center gap-2 px-4 py-2 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors w-full sm:w-auto disabled:opacity-50"
              :disabled="showOlderPending"
            >
              <CalendarIcon class="h-4 w-4" />
              Show Today
            </button>
          </div>
        </div>

        <!-- Show Older Pending Checkbox -->
        <div v-if="nonTodayPendingCount > 0" class="flex items-center gap-2">
          <input
            id="show-older-pending"
            v-model="showOlderPending"
            type="checkbox"
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="show-older-pending" class="text-sm font-medium text-gray-700">
            Show only {{ nonTodayPendingCount }} older pending
          </label>
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
              @click="bulkReject"
              :disabled="stockRequestsStore.loading"
              class="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
            >
              Reject Selected
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
      <ErrorAlert v-if="stockRequestsStore.error" :message="stockRequestsStore.error" />

      <!-- Reject Modal -->
      <ActionModal
        :is-open="showRejectModal"
        :title="`Reject Request${rejectRequestIds.length > 1 ? 's' : ''}: ${rejectRequestItemNames.join(', ')}`"
        variant="red"
        :loading="stockRequestsStore.loading"
        :confirm-text="`Reject Request${rejectRequestIds.length > 1 ? 's' : ''}`"
        :cancel-text="`Keep Request${rejectRequestIds.length > 1 ? 's' : ''}`"
        @close="closeRejectModal"
        @cancel="closeRejectModal"
        @confirm="confirmReject"
      >
        <div class="space-y-4">
          <!-- Confirmation Message -->
          <div class="bg-red-50 border border-red-200 rounded-md p-3">
            <div class="flex items-center gap-2 mb-2">
              <WarningTriangleIcon class="w-4 h-4 text-red-500" />
              <span class="text-sm font-medium text-red-800">
                Warning: This action cannot be undone
              </span>
            </div>
            <p class="text-sm text-red-700">
              Are you sure you want to reject
              {{
                rejectRequestIds.length > 1
                  ? `${rejectRequestIds.length} requests`
                  : 'this request'
              }}?
            </p>
          </div>

          <!-- Rejection Reason -->
          <FormField
            v-model="rejectRemark"
            type="textarea"
            label="Rejection Reason (Optional)"
            :rows="3"
            placeholder="Enter reason for rejection..."
          />
        </div>
      </ActionModal>

      <!-- Bulk Approval Modal -->
      <ActionModal
        :is-open="showBulkApprovalModal"
        title="Approve Requests"
        variant="green"
        :loading="stockRequestsStore.loading"
        confirm-text="Approve Requests"
        cancel-text="Cancel"
        @close="closeBulkApprovalModal"
        @cancel="closeBulkApprovalModal"
        @confirm="confirmBulkApprove"
      >
        <div class="space-y-4">
          <div class="bg-green-50 border border-green-200 rounded-md p-3">
            <div class="flex items-center gap-2 mb-2">
              <CheckCircleIcon class="w-4 h-4 text-green-500" />
              <span class="text-sm font-medium text-green-800"> Approve Selected Requests </span>
            </div>
            <p class="text-sm text-green-700">
              Are you sure you want to approve {{ selectedRequests.length }} request(s)?
            </p>
          </div>
        </div>
      </ActionModal>

      <!-- Edit Request Modal -->
      <ActionModal
        :is-open="showEditModal"
        :title="`Edit Request: ${editingRequest?.item_name}`"
        variant="green"
        :loading="stockRequestsStore.loading"
        confirm-text="Save Changes"
        :disabled="!isEditFormValid"
        @close="closeEditModal"
        @cancel="closeEditModal"
        @confirm="confirmEdit"
      >
        <div class="space-y-4">
          <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div class="flex items-center gap-2 mb-2">
              <CogIcon class="w-4 h-4 text-blue-500" />
              <span class="text-sm font-medium text-blue-800"> Modify Request Details </span>
            </div>
            <p class="text-sm text-blue-700">
              Update the quantity and add remarks for this stock request.
            </p>
          </div>

          <div>
            <FormField
              v-model="editForm.quantity"
              type="number"
              label="Quantity"
              :min="1"
              :max="editingRequest ? getItemMaxQuantity(editingRequest.item_id) : undefined"
              placeholder="Enter quantity"
              :required="true"
            />
            <p v-if="editingRequest" class="mt-1 text-xs text-gray-500">
              Max available: {{ getItemMaxQuantity(editingRequest.item_id) }}
              {{ editingRequest.unit }}
            </p>
          </div>

          <FormField
            v-model="editForm.remark"
            type="textarea"
            label="Remark (Optional)"
            :rows="3"
            placeholder="Add any notes or comments..."
          />
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
              showResetButton
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
              <!-- View Mode -->
              <div class="space-y-3">
                <!-- Request Header -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <input
                      v-if="request.status === 'Pending'"
                      type="checkbox"
                      :checked="selectedRequests.includes(request.id)"
                      @change="toggleSelection(request.id)"
                      class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded flex-shrink-0"
                    />
                    <h4 class="text-sm font-medium text-gray-900 truncate flex-1 mr-2">
                      {{ request.item_name }}
                    </h4>
                  </div>
                  <StatusBadge :variant="getStatusVariant(request.status)" :text="request.status" />
                </div>

                <!-- Request Details -->
                <div class="text-sm space-y-1">
                  <div class="flex items-baseline gap-2">
                    <span class="text-gray-500 flex-shrink-0">Quantity:</span>
                    <span class="font-medium text-gray-900">
                      {{ request.quantity }} {{ request.unit }}
                    </span>
                  </div>
                  <div class="flex items-start gap-2">
                    <span class="text-gray-500 flex-shrink-0">Remark:</span>
                    <span class="font-medium text-gray-900 whitespace-pre-wrap">
                      {{ request.remark || 'No Remark' }}
                    </span>
                  </div>
                </div>

                <!-- Stock Availability Warning -->
                <div
                  v-if="request.status === 'Pending' && !hasEnoughStock(request)"
                  class="bg-red-50 border border-red-200 rounded p-2"
                >
                  <div class="flex items-center gap-2">
                    <WarningTriangleIcon class="h-4 w-4 text-red-400" />
                    <span class="text-xs text-red-800">Insufficient stock available</span>
                  </div>
                </div>

                <!-- Actions -->
                <div v-if="request.status === 'Pending'" class="pt-2 border-t border-gray-100">
                  <ActionButtonGroup
                    :actions="getRequestActions(request)"
                    size="sm"
                    :loading="stockRequestsStore.loading"
                    @action-click="(actionKey) => handleActionClick(actionKey, request)"
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
              showResetButton
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
                  <td class="px-6 py-4 text-sm font-medium text-gray-900 min-w-0 max-w-xs">
                    <div class="flex items-center gap-2">
                      <div class="break-words">{{ request.item_name }}</div>
                      <WarningTriangleIcon
                        v-if="request.status === 'Pending' && !hasEnoughStock(request)"
                        class="h-4 w-4 text-red-400"
                      />
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ request.quantity }} {{ request.unit }}
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    <div
                      class="break-words whitespace-pre-wrap"
                      :title="request.remark || 'No Remark'"
                    >
                      {{ request.remark || 'No Remark' }}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <StatusBadge
                      :variant="getStatusVariant(request.status)"
                      :text="request.status"
                    />
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <ActionButtonGroup
                      v-if="request.status === 'Pending'"
                      :actions="getRequestActions(request)"
                      size="sm"
                      :loading="stockRequestsStore.loading"
                      @action-click="(actionKey) => handleActionClick(actionKey, request)"
                    />
                    <span v-else class="text-gray-400 text-xs">
                      {{
                        request.status === 'Approved'
                          ? 'Approved'
                          : request.status === 'Rejected'
                            ? 'Rejected'
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
import ActionButtonGroup from '@/components/ui/ActionButtonGroup.vue'
import ActionModal from '@/components/ui/ActionModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorAlert from '@/components/ui/ErrorAlert.vue'
import FormField from '@/components/ui/FormField.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TablePagination from '@/components/ui/TablePagination.vue'
import CalendarIcon from '@/components/icons/CalendarIcon.vue'
import CheckCircleIcon from '@/components/icons/CheckCircleIcon.vue'
import CogIcon from '@/components/icons/CogIcon.vue'
import WarningTriangleIcon from '@/components/icons/WarningTriangleIcon.vue'
import { usePagination } from '@/composables/usePagination'

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
const showOlderPending = ref<boolean>(false)

// Edit state
const editForm = ref<{
  quantity: number
  remark: string
}>({
  quantity: 1,
  remark: '',
})

// Reject modal state
const showRejectModal = ref<boolean>(false)
const rejectRequestIds = ref<string[]>([])
const rejectRemark = ref<string>('')

// Bulk approval modal
const showBulkApprovalModal = ref<boolean>(false)

// Edit modal
const showEditModal = ref<boolean>(false)
const editingRequest = ref<StockRequest | null>(null)

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
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return stockRequestsStore.requests.filter((request) => {
    if (request.status !== 'Pending') return false
    const requestDate = new Date(request.created_at)
    const requestDateString = `${requestDate.getFullYear()}-${String(requestDate.getMonth() + 1).padStart(2, '0')}-${String(requestDate.getDate()).padStart(2, '0')}`
    return requestDateString === todayString
  })
})

const nonTodayPendingCount = computed(() => {
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return stockRequestsStore.requests.filter((request) => {
    if (request.status !== 'Pending') return false
    const requestDate = new Date(request.created_at)
    const requestDateString = `${requestDate.getFullYear()}-${String(requestDate.getMonth() + 1).padStart(2, '0')}-${String(requestDate.getDate()).padStart(2, '0')}`
    return requestDateString !== todayString
  }).length
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

// Get item names for rejected requests
const rejectRequestItemNames = computed(() => {
  return rejectRequestIds.value
    .map((id) => {
      const request = stockRequestsStore.requests.find((r) => r.id === id)
      return request?.item_name || ''
    })
    .filter(Boolean)
})

// Edit form validation
const isEditFormValid = computed(() => {
  if (!editingRequest.value) return false

  const maxQuantity = getItemMaxQuantity(editingRequest.value.item_id)
  return (
    editForm.value.quantity > 0 &&
    editForm.value.quantity <= maxQuantity &&
    (editForm.value.quantity !== editingRequest.value.quantity ||
      editForm.value.remark !== (editingRequest.value.remark || ''))
  )
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
  if (filterDate.value && !showOlderPending.value) {
    const filterDateObj = new Date(filterDate.value)
    requests = requests.filter((request) => {
      const requestDate = new Date(request.created_at)
      return requestDate.toDateString() === filterDateObj.toDateString()
    })
  }

  // Show older pending filter
  if (showOlderPending.value) {
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    requests = requests.filter((request) => {
      if (request.status !== 'Pending') return false
      const requestDate = new Date(request.created_at)
      const requestDateString = `${requestDate.getFullYear()}-${String(requestDate.getMonth() + 1).padStart(2, '0')}-${String(requestDate.getDate()).padStart(2, '0')}`
      return requestDateString !== todayString
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

// Check if reset to today button should be shown
const showResetButton = computed((): boolean => {
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const isDateToday = filterDate.value === todayString
  return !!(filterDate.value && !isDateToday)
})

// Helper functions
const getAvailableStock = (itemId: string): number => {
  const item = inventoryStore.items.find((item) => item.id === itemId)
  return item?.quantity || 0
}

const hasEnoughStock = (request: StockRequest): boolean => {
  return getAvailableStock(request.item_id) >= request.quantity
}

// Helper function to get status badge variant
const getStatusVariant = (status: string): 'pending' | 'approved' | 'cancelled' => {
  switch (status) {
    case 'Pending':
      return 'pending'
    case 'Approved':
      return 'approved'
    case 'Rejected':
      return 'cancelled'
    default:
      return 'pending'
  }
}

// Action button configurations
const getRequestActions = (
  request: StockRequest,
): Array<{
  key: string
  label: string
  variant: 'blue' | 'gray' | 'red' | 'green' | 'yellow' | 'cyan'
  disabled?: boolean
}> => {
  if (request.status !== 'Pending') return []

  return [
    {
      key: 'edit',
      label: 'Edit',
      variant: 'blue',
    },
    {
      key: 'approve',
      label: 'Approve',
      variant: 'green',
      disabled: !hasEnoughStock(request),
    },
    {
      key: 'reject',
      label: 'Reject',
      variant: 'red',
    },
  ]
}

// Handle action button clicks
const handleActionClick = (actionKey: string, request: StockRequest) => {
  switch (actionKey) {
    case 'edit':
      startEdit(request)
      break
    case 'approve':
      approveRequest(request.id)
      break
    case 'reject':
      showRejectDialog(request.id)
      break
  }
}

// Edit functions
const startEdit = (request: StockRequest): void => {
  editingRequest.value = request
  editForm.value = {
    quantity: request.quantity,
    remark: request.remark || '',
  }
  showEditModal.value = true
}

const closeEditModal = (): void => {
  showEditModal.value = false
  editingRequest.value = null
  editForm.value = {
    quantity: 1,
    remark: '',
  }
}

const confirmEdit = async (): Promise<void> => {
  if (!editingRequest.value || !isEditFormValid.value) return

  await saveEdit(editingRequest.value.id)
  if (!stockRequestsStore.error) {
    closeEditModal()
  }
}

const saveEdit = async (requestId: string): Promise<void> => {
  if (!isEditFormValid.value) return

  await stockRequestsStore.updateRequest(requestId, editForm.value.quantity, editForm.value.remark)

  // Modal cleanup is handled by confirmEdit function
}

// Reject functions
const showRejectDialog = (requestId: string): void => {
  rejectRequestIds.value = [requestId]
  rejectRemark.value = ''
  showRejectModal.value = true
}

const bulkReject = (): void => {
  if (selectedRequests.value.length === 0) return
  rejectRequestIds.value = [...selectedRequests.value]
  rejectRemark.value = ''
  showRejectModal.value = true
}

const closeRejectModal = (): void => {
  showRejectModal.value = false
  rejectRequestIds.value = []
  rejectRemark.value = ''
}

const confirmReject = async (): Promise<void> => {
  if (rejectRequestIds.value.length === 0) return

  for (const requestId of rejectRequestIds.value) {
    await stockRequestsStore.rejectRequest(requestId, rejectRemark.value)
  }

  // Remove rejected requests from selection
  selectedRequests.value = selectedRequests.value.filter(
    (id) => !rejectRequestIds.value.includes(id),
  )

  closeRejectModal()
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

// Reset date filter to today
const resetToToday = (): void => {
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  filterDate.value = todayString
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

const bulkApprove = (): void => {
  if (selectedRequests.value.length === 0) return
  showBulkApprovalModal.value = true
}

const confirmBulkApprove = async (): Promise<void> => {
  for (const requestId of selectedRequests.value) {
    const request = stockRequestsStore.requests.find((r) => r.id === requestId)
    if (request && request.status === 'Pending' && hasEnoughStock(request)) {
      await stockRequestsStore.approveRequest(requestId)
    }
  }
  showBulkApprovalModal.value = false
  clearSelection()
}

const closeBulkApprovalModal = (): void => {
  showBulkApprovalModal.value = false
}

// Initialize store on component mount
onMounted(() => {})
</script>

<template>
  <div>
    <!-- Mobile Pagination -->
    <div class="block lg:hidden px-4 py-3 bg-gray-50 border-t border-gray-200">
      <div class="flex justify-between items-center">
        <div class="text-sm text-gray-700">
          Showing {{ startIndex + 1 }} to {{ Math.min(endIndex, totalItems) }} of
          {{ totalItems }} results
        </div>
        <div class="flex gap-2">
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage <= 1"
            class="px-3 py-1 text-sm border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage >= totalPages"
            class="px-3 py-1 text-sm border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Desktop Pagination -->
    <div class="hidden lg:block px-6 py-3 bg-gray-50 border-t border-gray-200">
      <div class="flex items-center justify-between">
        <div class="flex items-center text-sm text-gray-700">
          <span
            >Showing {{ startIndex + 1 }} to {{ Math.min(endIndex, totalItems) }} of
            {{ totalItems }} results</span
          >
        </div>

        <div class="flex items-center space-x-2">
          <!-- Items per page selector -->
          <div v-if="showItemsPerPageSelector" class="flex items-center space-x-2">
            <label class="text-sm text-gray-700">Items per page:</label>
            <select
              :value="itemsPerPage"
              @change="handleItemsPerPageChange"
              class="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option v-for="option in itemsPerPageOptions" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
          </div>

          <!-- Page navigation -->
          <div class="flex items-center space-x-1">
            <button
              @click="goToPage(1)"
              :disabled="currentPage <= 1"
              class="px-3 py-1 text-sm border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              First
            </button>
            <button
              @click="goToPage(currentPage - 1)"
              :disabled="currentPage <= 1"
              class="px-3 py-1 text-sm border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            <!-- Page numbers -->
            <div class="flex items-center space-x-1">
              <template v-for="page in visiblePages" :key="page">
                <button
                  v-if="page !== '...'"
                  @click="goToPage(Number(page))"
                  :class="[
                    'px-3 py-1 text-sm border rounded transition-colors',
                    page === currentPage
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
                  ]"
                >
                  {{ page }}
                </button>
                <span v-else class="px-2 text-gray-500">...</span>
              </template>
            </div>

            <button
              @click="goToPage(currentPage + 1)"
              :disabled="currentPage >= totalPages"
              class="px-3 py-1 text-sm border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
            <button
              @click="goToPage(totalPages)"
              :disabled="currentPage >= totalPages"
              class="px-3 py-1 text-sm border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Last
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Props interface
interface TablePaginationProps {
  currentPage: number
  totalPages: number
  itemsPerPage: number
  totalItems: number
  startIndex: number
  endIndex: number
  showItemsPerPageSelector?: boolean
  itemsPerPageOptions?: number[]
}

// Define props with defaults
const props = withDefaults(defineProps<TablePaginationProps>(), {
  showItemsPerPageSelector: true,
  itemsPerPageOptions: () => [25, 50, 100, 500],
})

// Define emits
interface TablePaginationEmits {
  (e: 'page-change', page: number): void
  (e: 'items-per-page-change', itemsPerPage: number): void
}

const emit = defineEmits<TablePaginationEmits>()

// Computed property for visible page numbers
const visiblePages = computed((): (number | string)[] => {
  const pages: (number | string)[] = []
  const total = props.totalPages
  const current = props.currentPage

  if (total <= 7) {
    // Show all pages if 7 or fewer
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    // Always show first page
    pages.push(1)

    if (current <= 4) {
      // Near the beginning
      for (let i = 2; i <= 5; i++) {
        pages.push(i)
      }
      pages.push('...')
      pages.push(total)
    } else if (current >= total - 3) {
      // Near the end
      pages.push('...')
      for (let i = total - 4; i <= total; i++) {
        pages.push(i)
      }
    } else {
      // In the middle
      pages.push('...')
      for (let i = current - 1; i <= current + 1; i++) {
        pages.push(i)
      }
      pages.push('...')
      pages.push(total)
    }
  }

  return pages
})

// Event handlers
const goToPage = (page: number): void => {
  if (page >= 1 && page <= props.totalPages && page !== props.currentPage) {
    emit('page-change', page)
  }
}

const handleItemsPerPageChange = (event: Event): void => {
  const target = event.target as HTMLSelectElement
  const newItemsPerPage = Number(target.value)
  emit('items-per-page-change', newItemsPerPage)
}
</script>

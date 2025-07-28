// composables/usePagination.ts
import { computed, ref, watch, type Ref } from 'vue'

export interface PaginationOptions {
  initialPage?: number
  initialItemsPerPage?: number
  itemsPerPageOptions?: number[]
}

export interface PaginationState<T> {
  currentPage: Ref<number>
  itemsPerPage: Ref<number>
  totalPages: Ref<number>
  startIndex: Ref<number>
  endIndex: Ref<number>
  paginatedItems: Ref<T[]>
  goToPage: (page: number) => void
  updateItemsPerPage: (newItemsPerPage: number) => void
  resetToFirstPage: () => void
}

export function usePagination<T>(
  items: Ref<T[]>,
  options: PaginationOptions = {},
): PaginationState<T> {
  const {
    initialPage = 1,
    initialItemsPerPage = 10,
    itemsPerPageOptions = [10, 25, 50, 100],
  } = options

  // Reactive state
  const currentPage = ref<number>(initialPage)
  const itemsPerPage = ref<number>(initialItemsPerPage)

  // Computed properties
  const totalPages = computed((): number => {
    return Math.ceil(items.value.length / itemsPerPage.value)
  })

  const startIndex = computed((): number => {
    return (currentPage.value - 1) * itemsPerPage.value
  })

  const endIndex = computed((): number => {
    return startIndex.value + itemsPerPage.value
  })

  const paginatedItems = computed((): T[] => {
    return items.value.slice(startIndex.value, endIndex.value)
  })

  // Methods
  const goToPage = (page: number): void => {
    if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
      currentPage.value = page
    }
  }

  const updateItemsPerPage = (newItemsPerPage: number): void => {
    if (itemsPerPageOptions.includes(newItemsPerPage)) {
      itemsPerPage.value = newItemsPerPage
      currentPage.value = 1 // Reset to first page
    }
  }

  const resetToFirstPage = (): void => {
    currentPage.value = 1
  }

  // Auto-reset to first page if current page becomes invalid
  watch([totalPages], () => {
    if (currentPage.value > totalPages.value && totalPages.value > 0) {
      currentPage.value = totalPages.value
    }
  })

  return {
    currentPage,
    itemsPerPage,
    totalPages,
    startIndex,
    endIndex,
    paginatedItems,
    goToPage,
    updateItemsPerPage,
    resetToFirstPage,
  }
}

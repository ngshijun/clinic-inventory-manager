// composables/pagination.svelte.ts
import { untrack } from 'svelte'

export interface PaginationOptions {
  initialPage?: number
  initialItemsPerPage?: number
  itemsPerPageOptions?: number[]
}

export interface PaginationState<T> {
  currentPage: number
  itemsPerPage: number
  readonly totalPages: number
  readonly startIndex: number
  readonly endIndex: number
  readonly paginatedItems: T[]
  goToPage: (page: number) => void
  updateItemsPerPage: (newItemsPerPage: number) => void
  resetToFirstPage: () => void
}

/**
 * Reactive pagination state.
 *
 * `getItems` is a getter (e.g. `() => filteredItems`) so the source list stays reactive.
 *
 * NOTE: this must be called during component initialisation — it creates an
 * `$effect.pre`, which can only be created inside a component or an effect root.
 */
export function createPagination<T>(
  getItems: () => T[],
  options: PaginationOptions = {},
): PaginationState<T> {
  const {
    initialPage = 1,
    initialItemsPerPage = 25,
    itemsPerPageOptions = [25, 50, 100, 500],
  } = options

  // Reactive state
  let currentPage = $state<number>(initialPage)
  let itemsPerPage = $state<number>(initialItemsPerPage)

  // Computed properties
  const totalPages = $derived(Math.ceil(getItems().length / itemsPerPage))

  const startIndex = $derived((currentPage - 1) * itemsPerPage)

  const endIndex = $derived(startIndex + itemsPerPage)

  const paginatedItems = $derived(getItems().slice(startIndex, endIndex))

  // Methods
  const goToPage = (page: number): void => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      currentPage = page
    }
  }

  const updateItemsPerPage = (newItemsPerPage: number): void => {
    if (itemsPerPageOptions.includes(newItemsPerPage)) {
      itemsPerPage = newItemsPerPage
      currentPage = 1 // Reset to first page
    }
  }

  const resetToFirstPage = (): void => {
    currentPage = 1
  }

  // Auto-reset to first page if current page becomes invalid
  $effect.pre(() => {
    const tp = totalPages
    untrack(() => {
      if (currentPage > tp && tp > 0) {
        currentPage = tp
      }
    })
  })

  return {
    get currentPage() {
      return currentPage
    },
    set currentPage(value: number) {
      currentPage = value
    },
    get itemsPerPage() {
      return itemsPerPage
    },
    set itemsPerPage(value: number) {
      itemsPerPage = value
    },
    get totalPages() {
      return totalPages
    },
    get startIndex() {
      return startIndex
    },
    get endIndex() {
      return endIndex
    },
    get paginatedItems() {
      return paginatedItems
    },
    goToPage,
    updateItemsPerPage,
    resetToFirstPage,
  }
}

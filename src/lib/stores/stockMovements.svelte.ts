import { api } from '../../../convex/_generated/api'
import { convex } from '$lib/convex'
import type { MovementsQuery, StockMovement } from '$lib/types/stockMovements'
import { errorMessage, withLegacy } from '$lib/types/legacy'
import { authStore } from './auth.svelte'

/** Start of a local calendar day in ms */
const startOfLocalDay = (date: string): number => new Date(`${date}T00:00:00`).getTime()

/** End of a local calendar day in ms */
const endOfLocalDay = (date: string): number => new Date(`${date}T23:59:59.999`).getTime()

/**
 * Stock movements are paginated on the server with cursors: this store holds
 * the page on screen and the cursor of every page visited, so Previous and
 * Next work but jumping to an arbitrary page does not. Both the page and the
 * count are live subscriptions, so a stock out elsewhere shows up here at
 * once.
 *
 * The count comes from an aggregate that only knows movement type and date,
 * so it is exact for those filters and unavailable for the others.
 */
class StockMovementsStore {
	// State
	movements = $state<StockMovement[]>([])
	totalCount = $state(0)
	countIsExact = $state(true)
	currentPage = $state(1)
	isDone = $state(true)
	#loadingCount = $state(0)
	error = $state<string | null>(null)

	#query: MovementsQuery | null = null
	/** Cursor that fetches page n is `#cursors[n - 1]`; page 1 starts at null */
	#cursors: (string | null)[] = [null]
	#continueCursor: string | null = null
	#unsubscribePage: (() => void) | null = null
	#unsubscribeCount: (() => void) | null = null
	/** Ends the loading state of the current page subscription, if it has not yet */
	#settlePage: (() => void) | null = null

	get loading(): boolean {
		return this.#loadingCount > 0
	}

	get pageSize(): number {
		return this.#query?.pageSize ?? 25
	}

	/** Index of the first row on screen, zero based */
	get startIndex(): number {
		return (this.currentPage - 1) * this.pageSize
	}

	get endIndex(): number {
		return this.startIndex + this.movements.length
	}

	/** Number of pages, only meaningful when the count is exact */
	get totalPages(): number {
		return Math.max(1, Math.ceil(this.totalCount / this.pageSize))
	}

	#serverFilters = () => {
		const { filters } = this.#query!
		const search = filters.itemName.trim()
		const remark = filters.remark.trim()
		return {
			movement_type: filters.movementType || undefined,
			item_id: filters.itemId ?? undefined,
			start_ms: filters.startDate ? startOfLocalDay(filters.startDate) : undefined,
			end_ms: filters.endDate ? endOfLocalDay(filters.endDate) : undefined,
			search: search || undefined,
			remark: remark || undefined,
			quantity_min: filters.quantityMin ?? undefined,
			quantity_max: filters.quantityMax ?? undefined,
		}
	}

	#subscribePage = () => {
		// A replaced subscription may never deliver its first result, so settle
		// it here rather than leaving the loading counter raised forever.
		this.#settlePage?.()
		this.#settlePage = null
		// Convex throws if an unsubscribe handle is called twice, so drop it
		this.#unsubscribePage?.()
		this.#unsubscribePage = null
		if (!this.#query) return

		let settled = false
		const settle = () => {
			if (settled) return
			settled = true
			this.#loadingCount--
		}
		this.#settlePage = settle
		this.#loadingCount++

		this.#unsubscribePage = convex.onUpdate(
			api.movements.page,
			{
				auth: authStore.token,
				paginationOpts: {
					cursor: this.#cursors[this.currentPage - 1] ?? null,
					numItems: this.#query.pageSize,
				},
				sort_direction: this.#query.sortDirection,
				...this.#serverFilters(),
			},
			(result) => {
				this.movements = result.page.map(withLegacy)
				this.isDone = result.isDone
				this.#continueCursor = result.continueCursor
				this.error = null
				settle()
			},
			(err) => {
				this.error = errorMessage(err, 'An error occurred while fetching movements')
				console.error('Movements subscription error:', err)
				settle()
			},
		)
	}

	#subscribeCount = () => {
		this.#unsubscribeCount?.()
		this.#unsubscribeCount = null
		if (!this.#query) return

		const filters = this.#serverFilters()
		this.countIsExact =
			filters.search === undefined &&
			filters.remark === undefined &&
			filters.item_id === undefined &&
			filters.quantity_min === undefined &&
			filters.quantity_max === undefined
		if (!this.countIsExact) {
			this.totalCount = 0
			return
		}

		this.#unsubscribeCount = convex.onUpdate(
			api.movements.count,
			{
				auth: authStore.token,
				movement_type: filters.movement_type,
				start_ms: filters.start_ms,
				end_ms: filters.end_ms,
			},
			(count) => {
				this.totalCount = count
			},
			(err) => console.error('Movements count error:', err),
		)
	}

	// Actions

	/** Apply new filters, sort or page size and go back to the first page */
	setQuery = (query: MovementsQuery): void => {
		this.#query = query
		this.#cursors = [null]
		this.#continueCursor = null
		this.currentPage = 1
		this.#subscribePage()
		this.#subscribeCount()
	}

	nextPage = (): void => {
		if (this.isDone || this.#continueCursor === null) return
		this.#cursors[this.currentPage] = this.#continueCursor
		this.currentPage++
		this.#subscribePage()
	}

	previousPage = (): void => {
		if (this.currentPage <= 1) return
		this.currentPage--
		this.#subscribePage()
	}

	firstPage = (): void => {
		if (this.currentPage === 1) return
		this.currentPage = 1
		this.#subscribePage()
	}

	updateRemark = async (movementId: StockMovement['id'], newRemark: string): Promise<void> => {
		this.#loadingCount++
		this.error = null
		try {
			await convex.mutation(api.movements.updateRemark, {
				auth: authStore.token,
				id: movementId,
				remark: newRemark,
			})
		} catch (err) {
			this.error = errorMessage(err, 'An error occurred while updating remark')
			console.error('Error updating remark:', err)
		} finally {
			this.#loadingCount--
		}
	}

	// The page issues the first query once it knows its filters.
	initializeStore = async (): Promise<void> => {}

	cleanup = () => {
		this.#settlePage?.()
		this.#settlePage = null
		this.#unsubscribePage?.()
		this.#unsubscribeCount?.()
		this.#unsubscribePage = null
		this.#unsubscribeCount = null
		this.#query = null
		this.#cursors = [null]
		this.#continueCursor = null
		this.movements = []
		this.totalCount = 0
		this.countIsExact = true
		this.currentPage = 1
		this.isDone = true
		this.error = null
	}
}

export const stockMovementsStore = new StockMovementsStore()

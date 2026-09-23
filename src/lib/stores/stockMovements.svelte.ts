import { api } from '../../../convex/_generated/api'
import { convex } from '$lib/convex'
import type { MovementsQuery, StockMovement } from '$lib/types/stockMovements'
import { errorMessage, withLegacy } from '$lib/types/legacy'
import { authStore } from './auth.svelte'

/** Start of a local calendar day in ms */
const startOfLocalDay = (date: string): number => new Date(`${date}T00:00:00`).getTime()

/** End of a local calendar day in ms */
const endOfLocalDay = (date: string): number => new Date(`${date}T23:59:59.999`).getTime()

/** One server page: the cursor it was fetched with and its live rows */
interface Page {
	cursor: string | null
	rows: StockMovement[]
	continueCursor: string | null
	isDone: boolean
	unsubscribe: () => void
	/** Ends this page's loading state, if it has not yet */
	settle: () => void
}

/**
 * Stock movements are paginated on the server with cursors. The store keeps
 * every page loaded so far as its own live subscription and shows them as one
 * list, so "load more" appends the next page and a stock out elsewhere shows
 * up here at once.
 *
 * The count comes from an aggregate that only knows movement type and date,
 * so it is exact for those filters and unavailable for the others.
 */
class StockMovementsStore {
	// Raw: pages are replaced, never mutated, so no deep proxy is needed
	#pages = $state.raw<Page[]>([])
	totalCount = $state(0)
	countIsExact = $state(true)
	#loadingCount = $state(0)
	error = $state<string | null>(null)

	#query: MovementsQuery | null = null
	#unsubscribeCount: (() => void) | null = null

	/** Every loaded row in order. A row that moved between live pages appears once. */
	movements = $derived.by((): StockMovement[] => {
		const seen = new Set<string>()
		const rows: StockMovement[] = []
		for (const page of this.#pages) {
			for (const row of page.rows) {
				if (seen.has(row.id)) continue
				seen.add(row.id)
				rows.push(row)
			}
		}
		return rows
	})

	/** Whether the server has more rows past the last loaded page */
	hasMore = $derived.by((): boolean => {
		const last = this.#pages.at(-1)
		return last !== undefined && !last.isDone && last.continueCursor !== null
	})

	get loading(): boolean {
		return this.#loadingCount > 0
	}

	get pageSize(): number {
		return this.#query?.pageSize ?? 25
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

	#dropPages = () => {
		for (const page of this.#pages) {
			// A replaced subscription may never deliver its first result, so
			// settle it here rather than leaving the loading counter raised.
			page.settle()
			// Convex throws if an unsubscribe handle is called twice
			page.unsubscribe()
		}
		this.#pages = []
	}

	#subscribePage = (cursor: string | null) => {
		if (!this.#query) return

		let settled = false
		const settle = () => {
			if (settled) return
			settled = true
			this.#loadingCount--
		}
		this.#loadingCount++

		// The entry exists before subscribing, in case the first result is delivered synchronously
		const index = this.#pages.length
		this.#pages = [
			...this.#pages,
			{ cursor, rows: [], continueCursor: null, isDone: true, unsubscribe: () => {}, settle },
		]
		const unsubscribe = convex.onUpdate(
			api.movements.page,
			{
				auth: authStore.token,
				paginationOpts: { cursor, numItems: this.#query.pageSize },
				sort_direction: this.#query.sortDirection,
				...this.#serverFilters(),
			},
			(result) => {
				const live = this.#pages[index]
				// Ignore a late result from a page that has since been dropped
				if (!live || live.cursor !== cursor) return
				this.#pages = this.#pages.with(index, {
					...live,
					rows: result.page.map(withLegacy),
					isDone: result.isDone,
					continueCursor: result.continueCursor,
				})
				this.error = null
				settle()
			},
			(err) => {
				this.error = errorMessage(err, 'An error occurred while fetching movements')
				console.error('Movements subscription error:', err)
				settle()
			},
		)
		const entry = this.#pages[index]
		if (entry && entry.cursor === cursor) {
			this.#pages = this.#pages.with(index, { ...entry, unsubscribe })
		} else {
			// Dropped while subscribing
			unsubscribe()
		}
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

	/** Apply new filters or sort and start again from the first page */
	setQuery = (query: MovementsQuery): void => {
		this.#query = query
		this.#dropPages()
		this.#subscribePage(null)
		this.#subscribeCount()
	}

	/** Append the next server page */
	loadMore = (): void => {
		const last = this.#pages.at(-1)
		if (!last || last.isDone || last.continueCursor === null) return
		this.#subscribePage(last.continueCursor)
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
		this.#dropPages()
		this.#unsubscribeCount?.()
		this.#unsubscribeCount = null
		this.#query = null
		this.totalCount = 0
		this.countIsExact = true
		this.error = null
	}
}

export const stockMovementsStore = new StockMovementsStore()

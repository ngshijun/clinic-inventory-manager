import { supabase } from '$lib/supabase'
import type { MovementsQuery, StockMovement } from '$lib/types/stockMovements'
import type { RealtimeChannel } from '@supabase/supabase-js'

/** Escape the LIKE wildcards in user input so they match literally */
const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (match) => `\\${match}`)

/** Start of a local calendar day as an ISO timestamp */
const startOfLocalDay = (date: string): string => new Date(`${date}T00:00:00`).toISOString()

/** End of a local calendar day as an ISO timestamp */
const endOfLocalDay = (date: string): string => new Date(`${date}T23:59:59.999`).toISOString()

/**
 * Stock movements are paginated on the server: this store only ever holds
 * the page that is currently on screen, plus the total row count for the
 * active filters. Realtime changes re-run the last query rather than
 * patching rows, because an insert can push a row off (or onto) the page.
 */
class StockMovementsStore {
	// State
	movements = $state<StockMovement[]>([])
	totalCount = $state(0)
	#loadingCount = $state(0)
	error = $state<string | null>(null)
	#channel: RealtimeChannel | null = null
	#isInitialized = false
	#lastQuery: MovementsQuery | null = null
	#requestSequence = 0
	#refreshTimer: ReturnType<typeof setTimeout> | null = null

	get loading(): boolean {
		return this.#loadingCount > 0
	}

	// Actions
	fetchMovements = async (query: MovementsQuery): Promise<void> => {
		this.#lastQuery = query
		const sequence = ++this.#requestSequence

		this.#loadingCount++
		this.error = null
		try {
			const { filters } = query
			let request = supabase
				.from('stock_movements')
				.select('*, inventory!stock_movements_item_id_fkey(unit)', { count: 'exact' })

			const itemName = filters.itemName.trim()
			if (itemName) request = request.ilike('item_name', `%${escapeLike(itemName)}%`)
			if (filters.quantityMin !== null) request = request.gte('quantity', filters.quantityMin)
			if (filters.quantityMax !== null) request = request.lte('quantity', filters.quantityMax)
			if (filters.movementType) request = request.eq('movement_type', filters.movementType)
			if (filters.startDate) request = request.gte('created_at', startOfLocalDay(filters.startDate))
			if (filters.endDate) request = request.lte('created_at', endOfLocalDay(filters.endDate))
			const remark = filters.remark.trim()
			if (remark) request = request.ilike('remark', `%${escapeLike(remark)}%`)

			const ascending = query.sortDirection === 'asc'
			request = request.order(query.sortKey, { ascending, nullsFirst: false })
			// Stable secondary order so paging never repeats or skips a row
			if (query.sortKey !== 'created_at') {
				request = request.order('created_at', { ascending: false })
			}
			request = request.order('id', { ascending: false })

			const from = (query.page - 1) * query.pageSize
			const {
				data,
				error: supabaseError,
				count,
			} = await request.range(from, from + query.pageSize - 1)

			// A newer request has been issued since; let it win.
			if (sequence !== this.#requestSequence) return

			if (supabaseError) throw supabaseError

			this.movements =
				data?.map((row) => ({
					...row,
					unit: row.inventory?.unit || '',
				})) ?? []
			this.totalCount = count ?? 0
		} catch (err) {
			if (sequence !== this.#requestSequence) return
			this.error = err instanceof Error ? err.message : 'An error occurred while fetching movements'
			console.error('Error fetching movements:', err)
		} finally {
			this.#loadingCount--
		}
	}

	/** Re-run the last query (after a realtime change or an edit) */
	refresh = async (): Promise<void> => {
		if (this.#lastQuery) await this.fetchMovements(this.#lastQuery)
	}

	// Several realtime events arrive in a burst for one stock out (one row per
	// batch consumed), so collapse them into a single refetch.
	#scheduleRefresh = () => {
		if (this.#refreshTimer) clearTimeout(this.#refreshTimer)
		this.#refreshTimer = setTimeout(() => {
			this.#refreshTimer = null
			this.refresh()
		}, 250)
	}

	updateRemark = async (movementId: string, newRemark: string): Promise<void> => {
		this.#loadingCount++
		this.error = null
		try {
			const { data, error: supabaseError } = await supabase
				.from('stock_movements')
				.update({
					remark: newRemark,
					updated_at: new Date().toISOString(),
				})
				.eq('id', movementId)
				.select()
				.single()

			if (supabaseError) throw supabaseError

			// Optimistic local update
			if (data) {
				const index = this.movements.findIndex((m) => m.id === movementId)
				if (index !== -1) {
					this.movements[index] = { ...this.movements[index], ...data }
				}
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'An error occurred while updating remark'
			console.error('Error updating remark:', err)
		} finally {
			this.#loadingCount--
		}
	}

	// Subscription lifecycle
	#startSubscription = () => {
		if (this.#channel) return

		this.#channel = supabase
			.channel('update-stock-movements')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, () => {
				this.#scheduleRefresh()
			})
			.subscribe()
	}

	// The subscription is started at login; the page issues the first query
	// once it knows its filters.
	initializeStore = async (): Promise<void> => {
		if (this.#isInitialized) return
		this.#isInitialized = true
		this.#startSubscription()
	}

	cleanup = () => {
		if (this.#channel) {
			this.#channel.unsubscribe()
			this.#channel = null
		}
		if (this.#refreshTimer) {
			clearTimeout(this.#refreshTimer)
			this.#refreshTimer = null
		}
		this.#requestSequence++
		this.#lastQuery = null
		this.movements = []
		this.totalCount = 0
		this.error = null
		this.#isInitialized = false
	}
}

export const stockMovementsStore = new StockMovementsStore()

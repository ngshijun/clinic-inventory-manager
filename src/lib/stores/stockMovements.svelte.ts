import { supabase } from '$lib/supabase'
import type { NewStockMovement, StockMovement } from '$lib/types/stockMovements'
import type { RealtimeChannel } from '@supabase/supabase-js'

class StockMovementsStore {
	// State
	movements = $state<StockMovement[]>([])
	#loadingCount = $state(0)
	error = $state<string | null>(null)
	#unitCache = $state<Record<string, string | null>>({})
	#channel: RealtimeChannel | null = null
	#isInitialized = false

	get loading(): boolean {
		return this.#loadingCount > 0
	}

	// Helper function to get unit for an item (with caching)
	#getUnitForItem = async (itemId: string): Promise<string | null> => {
		// Check cache first
		if (this.#unitCache[itemId] !== undefined) {
			return this.#unitCache[itemId]
		}

		const { data, error } = await supabase
			.from('inventory')
			.select('unit')
			.eq('id', itemId)
			.single()

		const unit = error ? null : data?.unit || null
		// Cache the result
		this.#unitCache[itemId] = unit
		return unit
	}

	// Actions
	fetchMovements = async (): Promise<void> => {
		this.#loadingCount++
		this.error = null
		try {
			const { data, error: supabaseError } = await supabase
				.from('stock_movements')
				.select('*, inventory!stock_movements_item_id_fkey(unit)')
				.order('created_at', { ascending: false })

			if (supabaseError) throw supabaseError

			const transformedData: StockMovement[] | undefined = data?.map((item) => ({
				...item,
				unit: item.inventory?.unit || '',
			}))
			this.movements = transformedData || []

			// Populate unit cache from fetched data
			transformedData?.forEach((movement) => {
				if (movement.item_id) {
					this.#unitCache[movement.item_id] = movement.unit
				}
			})
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'An error occurred while fetching movements'
			console.error('Error fetching movements:', err)
		} finally {
			this.#loadingCount--
		}
	}

	addMovement = async (movement: NewStockMovement): Promise<void> => {
		try {
			const { error: supabaseError } = await supabase.from('stock_movements').insert([
				{
					item_id: movement.item_id,
					item_name: movement.item_name,
					quantity: movement.quantity,
					movement_type: movement.movement_type,
					remark: movement.remark || '',
				},
			])

			if (supabaseError) throw supabaseError
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'An error occurred while adding movement'
			console.error('Error adding movement:', err)
		}
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

	searchMovements = (query: string): StockMovement[] => {
		if (!query) return this.movements
		return this.movements.filter((movement) =>
			movement.item_name.toLowerCase().includes(query.toLowerCase()),
		)
	}

	// Subscription lifecycle
	#startSubscription = () => {
		if (this.#channel) return

		this.#channel = supabase
			.channel('update-stock-movements')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'stock_movements' },
				async (payload) => {
					if (payload.eventType === 'INSERT') {
						// Dedup: skip if already in local state
						const exists = this.movements.some((m) => m.id === payload.new.id)
						if (!exists) {
							const unit = await this.#getUnitForItem(payload.new.item_id)
							const newMovement: StockMovement = {
								...payload.new,
								unit,
							} as StockMovement
							this.movements.unshift(newMovement as StockMovement)
						}
					} else if (payload.eventType === 'UPDATE') {
						const index = this.movements.findIndex((m) => m.id === payload.new.id)
						if (index !== -1) {
							const data: StockMovement = {
								id: payload.new.id,
								item_id: payload.new.item_id,
								item_name: payload.new.item_name,
								quantity: payload.new.quantity,
								movement_type: payload.new.movement_type,
								remark: payload.new.remark,
								unit: this.movements[index].unit,
								created_at: payload.new.created_at,
								updated_at: payload.new.updated_at,
							}
							this.movements[index] = data as StockMovement
						}
					} else if (payload.eventType === 'DELETE') {
						const index = this.movements.findIndex((m) => m.id === payload.old.id)
						if (index !== -1) this.movements.splice(index, 1)
					}

					// Sort by created_at descending
					this.movements.sort(
						(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
					)
				},
			)
			.subscribe()
	}

	initializeStore = async (): Promise<void> => {
		if (this.#isInitialized) return
		this.#isInitialized = true
		await this.fetchMovements()
		this.#startSubscription()
	}

	cleanup = () => {
		if (this.#channel) {
			this.#channel.unsubscribe()
			this.#channel = null
		}
		this.movements = []
		this.#unitCache = {}
		this.error = null
		this.#isInitialized = false
	}
}

export const stockMovementsStore = new StockMovementsStore()

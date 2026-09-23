import { api } from '../../../convex/_generated/api'
import { convex } from '$lib/convex'
import { authStore } from '$lib/stores/auth.svelte'

export interface DayMovements {
	/** YYYY-MM-DD */
	date: string
	/** "Mon" */
	label: string
	stockIn: number
	stockOut: number
}

const DAY_MS = 86_400_000
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const isoDate = (date: Date): string =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/**
 * Live counts of stock in and stock out for each of the last seven days,
 * today last. Each day and type is one subscription to the movements count
 * aggregate, which is cheap, exact and updates as movements are recorded.
 */
export function useWeeklyMovements(): { readonly days: DayMovements[]; readonly loaded: boolean } {
	const start = new Date()
	start.setHours(0, 0, 0, 0)
	start.setDate(start.getDate() - 6)

	const initial: DayMovements[] = Array.from({ length: 7 }, (_, i) => {
		const date = new Date(start.getTime() + i * DAY_MS)
		return { date: isoDate(date), label: WEEKDAYS[date.getDay()], stockIn: 0, stockOut: 0 }
	})
	// Raw: days are replaced, never mutated, so no deep proxy is needed
	let days = $state.raw(initial)
	let pending = $state(initial.length * 2)

	$effect(() => {
		const unsubscribes: Array<() => void> = []
		const settled = new Set<string>()
		days.forEach((day, index) => {
			const dayStart = new Date(`${day.date}T00:00:00`).getTime()
			const dayEnd = dayStart + DAY_MS - 1
			for (const type of ['stock_in', 'stock_out'] as const) {
				const key = `${day.date}:${type}`
				unsubscribes.push(
					convex.onUpdate(
						api.movements.count,
						{ auth: authStore.token, movement_type: type, start_ms: dayStart, end_ms: dayEnd },
						(count) => {
							const field = type === 'stock_in' ? 'stockIn' : 'stockOut'
							days = days.with(index, { ...days[index], [field]: count })
							if (!settled.has(key)) {
								settled.add(key)
								pending--
							}
						},
						(err) => {
							console.error('Weekly movements count error:', err)
							if (!settled.has(key)) {
								settled.add(key)
								pending--
							}
						},
					),
				)
			}
		})
		return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
	})

	return {
		get days() {
			return days
		},
		get loaded() {
			return pending === 0
		},
	}
}

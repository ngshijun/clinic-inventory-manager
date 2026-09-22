/**
 * "Showing N of M" list windowing: the list starts at `pageSize` rows and
 * each `loadMore()` reveals another page. `reset()` returns to the first
 * page, which callers do when the filter or sort changes.
 *
 * `getItems` is a getter so the source list stays reactive.
 */
export interface LoadMoreState<T> {
	readonly visible: T[]
	readonly total: number
	readonly shown: number
	readonly hasMore: boolean
	loadMore: () => void
	reset: () => void
}

export function createLoadMore<T>(getItems: () => T[], pageSize = 25): LoadMoreState<T> {
	let limit = $state(pageSize)

	const total = $derived(getItems().length)
	const visible = $derived(getItems().slice(0, limit))

	return {
		get visible() {
			return visible
		},
		get total() {
			return total
		},
		get shown() {
			return Math.min(limit, total)
		},
		get hasMore() {
			return limit < total
		},
		loadMore: () => {
			limit += pageSize
		},
		reset: () => {
			limit = pageSize
		},
	}
}

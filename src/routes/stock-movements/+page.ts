import { FIRST_VIEW, stockMovementsStore } from '$lib/stores/stockMovements.svelte'
import type { PageLoad } from './$types'

// SvelteKit runs this when the link is hovered, so the first page of movements
// is live before the page opens. The layout's guard decides first, since only
// a manager may read movements.
export const load: PageLoad = async ({ parent }) => {
	await parent()
	stockMovementsStore.setQuery(FIRST_VIEW)
}

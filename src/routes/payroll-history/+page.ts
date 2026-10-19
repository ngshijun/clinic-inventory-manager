import { payrollRecordsStore } from '$lib/stores/payrollRecords.svelte'
import type { PageLoad } from './$types'

// SvelteKit runs this when the link is hovered. The layout's guard decides
// first, since only a manager may read payroll.
export const load: PageLoad = async ({ parent, url }) => {
	await parent()
	payrollRecordsStore.prefetchHistory(url.searchParams.get('run'))
}

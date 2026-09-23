export type Crumb = { label: string; href?: string }

let current = $state<Crumb[]>([])

/** The breadcrumb trail shown in the shell's top bar. */
export const breadcrumbs = {
	get current() {
		return current
	},
}

/** Register the current page's breadcrumb trail. Call once during component init. */
export function useBreadcrumbs(get: () => Crumb[]) {
	$effect(() => {
		const value = get()
		current = value
		return () => {
			// Only clear if a newer page has not already replaced the trail.
			if (current === value) current = []
		}
	})
}

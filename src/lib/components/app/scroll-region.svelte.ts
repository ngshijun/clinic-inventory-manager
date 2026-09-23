let scrolled = $state(false)
let pinned = $state(false)
let headerHeight = $state(0)

/**
 * State of the shell's content scroll region. The layout reports whether it
 * has scrolled; a page header that pins itself claims the scroll edge effect
 * (the hairline), so the top bar shows it only when no page header is pinned
 * (HIG: one scroll edge effect per view).
 */
export const scrollRegion = {
	get scrolled() {
		return scrolled
	},
	set scrolled(value: boolean) {
		scrolled = value
	},
	get pinned() {
		return pinned
	},
	/** Height of the pinned page header in px (0 when none), so a page can pin content just below it. */
	get headerHeight() {
		return headerHeight
	},
}

/** Marks a pinned page header as present, and its height, while `has()` is true. Call once during component init. */
export function usePinnedHeader(has: () => boolean, height: () => number) {
	$effect(() => {
		if (!has()) return
		pinned = true
		headerHeight = height()
		return () => {
			pinned = false
			headerHeight = 0
		}
	})
}

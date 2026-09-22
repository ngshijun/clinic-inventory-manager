<script lang="ts">
	import type { Snippet } from 'svelte'
	import { useBreadcrumbs, type Crumb } from './breadcrumbs.svelte'
	import { scrollRegion, usePinnedHeader } from './scroll-region.svelte'

	/**
	 * Registers the page title in the top bar's breadcrumb and renders the
	 * page's toolbar (search, filters, primary action), if any. The toolbar
	 * pins to the top of the scroll region so its controls stay reachable as
	 * the content scrolls under them, and it carries the scroll edge hairline.
	 */
	let {
		title,
		crumbs = [],
		children,
	}: { title: string; crumbs?: Crumb[]; children?: Snippet } = $props()

	let height = $state(0)
	useBreadcrumbs(() => [...crumbs, { label: title }])
	usePinnedHeader(
		() => children !== undefined,
		() => height,
	)
</script>

<svelte:head>
	<title>{title} · Clinic Inventory</title>
</svelte:head>

{#if children}
	<div
		bind:offsetHeight={height}
		class="bg-background sticky top-0 z-10 -mx-4 -mt-4 -mb-4 border-b p-4 transition-colors sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6 {scrollRegion.scrolled
			? 'border-border'
			: 'border-transparent'}"
	>
		<div class="flex flex-wrap items-center justify-end gap-2">
			{@render children()}
		</div>
	</div>
{/if}

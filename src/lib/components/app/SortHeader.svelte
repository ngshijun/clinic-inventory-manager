<script lang="ts" generics="K extends string">
	import type { Snippet } from 'svelte'
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down'
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up'
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down'
	import * as Table from '$lib/components/ui/table'
	import { cn } from '$lib/utils'
	import type { SortState } from './sort'

	/**
	 * A table header cell that sorts its column. The whole cell is the
	 * control; the arrow shows the active direction.
	 */
	let {
		key,
		sort,
		onsort,
		align = 'start',
		class: className,
		children,
	}: {
		key: K
		sort: SortState<K>
		onsort: (key: K) => void
		align?: 'start' | 'end'
		class?: string
		children: Snippet
	} = $props()

	const active = $derived(sort.key === key)
	const ariaSort = $derived(
		active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none',
	)
</script>

<Table.Head aria-sort={ariaSort} class={cn('p-0', className)}>
	<button
		type="button"
		class={cn(
			'text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex h-10 w-full items-center gap-1 px-2 text-xs font-semibold tracking-wide uppercase outline-none focus-visible:ring-3 focus-visible:ring-inset',
			align === 'end' && 'justify-end',
			active && 'text-foreground',
		)}
		onclick={() => onsort(key)}
	>
		{@render children()}
		{#if !active}
			<ChevronsUpDownIcon class="size-3.5 opacity-60" />
		{:else if sort.direction === 'asc'}
			<ArrowUpIcon class="size-3.5" />
		{:else}
			<ArrowDownIcon class="size-3.5" />
		{/if}
	</button>
</Table.Head>

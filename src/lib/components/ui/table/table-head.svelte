<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js'
	import type { HTMLThAttributes } from 'svelte/elements'

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLThAttributes> = $props()
</script>

<th
	bind:this={ref}
	data-slot="table-head"
	class={cn(
		'bg-background text-foreground sticky top-0 z-1 h-12 px-3 text-left align-middle font-medium whitespace-nowrap shadow-[inset_0_-1px_0_var(--border)] [&:has([role=checkbox])]:pr-0',
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</th>

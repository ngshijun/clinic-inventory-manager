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
		'px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-gray-500 uppercase',
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</th>

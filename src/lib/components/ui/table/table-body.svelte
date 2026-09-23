<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLTableSectionElement>> = $props()
</script>

<!-- Every body row is one 48px line: nothing a cell holds is taller than 32px. -->
<tbody
	bind:this={ref}
	data-slot="table-body"
	class={cn('[&_tr:last-child]:border-0 [&>tr]:h-12', className)}
	{...restProps}
>
	{@render children?.()}
</tbody>

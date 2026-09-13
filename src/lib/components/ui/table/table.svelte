<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js'
	import type { HTMLTableAttributes } from 'svelte/elements'

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLTableAttributes> = $props()
</script>

<div data-slot="table-container" class="relative w-full overflow-x-auto">
	<table
		bind:this={ref}
		data-slot="table"
		class={cn('min-w-full caption-bottom divide-y divide-gray-200 text-sm', className)}
		{...restProps}
	>
		{@render children?.()}
	</table>
</div>

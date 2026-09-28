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

<!--
	The table is its own scroll area, no taller than the visible region under
	the pinned page toolbar, so the sideways bar stays on screen and the column
	heads stay put. A short table is only as tall as its rows.
-->
<div
	data-slot="table-container"
	class="relative max-h-[max(16rem,calc(100cqh-var(--page-header,0px)-5rem))] w-full overflow-auto"
>
	<table
		bind:this={ref}
		data-slot="table"
		class={cn('w-full caption-bottom text-sm', className)}
		{...restProps}
	>
		{@render children?.()}
	</table>
</div>

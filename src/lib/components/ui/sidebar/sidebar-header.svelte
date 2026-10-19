<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> = $props()
</script>

<div
	bind:this={ref}
	data-slot="sidebar-header"
	data-sidebar="header"
	class={cn('flex flex-col gap-2 px-3 pt-2.5 pb-2 [--radius:var(--radius-xl)]', className)}
	{...restProps}
>
	{@render children?.()}
</div>

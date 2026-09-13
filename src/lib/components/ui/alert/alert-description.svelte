<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js'
	import type { HTMLAttributes } from 'svelte/elements'

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props()
</script>

<div
	bind:this={ref}
	data-slot="alert-description"
	class={cn(
		'mt-1 text-sm [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4',
		className,
	)}
	{...restProps}
>
	{@render children?.()}
</div>

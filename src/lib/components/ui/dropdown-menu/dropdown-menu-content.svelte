<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui'
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js'
	import DropdownMenuPortal from './dropdown-menu-portal.svelte'
	import type { ComponentProps } from 'svelte'

	let {
		ref = $bindable(null),
		sideOffset = 4,
		align = 'start',
		portalProps,
		class: className,
		...restProps
	}: DropdownMenuPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DropdownMenuPortal>>
	} = $props()
</script>

<DropdownMenuPortal {...portalProps}>
	<DropdownMenuPrimitive.Content
		bind:ref
		data-slot="dropdown-menu-content"
		{sideOffset}
		{align}
		class={cn(
			'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 z-50 max-h-(--bits-dropdown-menu-content-available-height) min-w-32 origin-(--bits-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-gray-900 shadow-lg duration-100 data-closed:overflow-hidden',
			className,
		)}
		{...restProps}
	/>
</DropdownMenuPortal>

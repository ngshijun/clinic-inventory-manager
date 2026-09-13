<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui'
	import { cn, type WithoutChild } from '$lib/utils.js'
	import type { WithoutChildrenOrChild } from '$lib/utils.js'
	import SelectPortal from './select-portal.svelte'
	import SelectScrollDownButton from './select-scroll-down-button.svelte'
	import SelectScrollUpButton from './select-scroll-up-button.svelte'
	import type { ComponentProps } from 'svelte'

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 4,
		portalProps,
		children,
		preventScroll = true,
		...restProps
	}: WithoutChild<SelectPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof SelectPortal>>
	} = $props()
</script>

<SelectPortal {...portalProps}>
	<SelectPrimitive.Content
		bind:ref
		{sideOffset}
		{preventScroll}
		data-slot="select-content"
		class={cn(
			'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 relative z-50 max-h-(--bits-select-content-available-height) min-w-36 origin-(--bits-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border border-gray-200 bg-white text-gray-900 shadow-lg duration-100',
			className,
		)}
		{...restProps}
	>
		<SelectScrollUpButton />
		<SelectPrimitive.Viewport
			class={cn(
				'h-(--bits-select-anchor-height) w-full min-w-(--bits-select-anchor-width) scroll-my-1',
			)}
		>
			{@render children?.()}
		</SelectPrimitive.Viewport>
		<SelectScrollDownButton />
	</SelectPrimitive.Content>
</SelectPortal>

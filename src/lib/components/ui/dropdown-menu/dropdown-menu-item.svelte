<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui'
	import { cn } from '$lib/utils.js'

	let {
		ref = $bindable(null),
		class: className,
		inset,
		variant = 'default',
		...restProps
	}: DropdownMenuPrimitive.ItemProps & {
		inset?: boolean
		variant?: 'default' | 'destructive'
	} = $props()
</script>

<DropdownMenuPrimitive.Item
	bind:ref
	data-slot="dropdown-menu-item"
	data-inset={inset}
	data-variant={variant}
	class={cn(
		"group/dropdown-menu-item relative flex w-full cursor-default items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 outline-hidden select-none focus:bg-gray-100 data-disabled:pointer-events-none data-disabled:opacity-50 data-inset:pl-7 data-[variant=destructive]:text-red-700 data-[variant=destructive]:focus:bg-red-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		className,
	)}
	{...restProps}
/>

<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants'

	/* Restyled to the app's original StatusBadge: a pill of {colour}-100 fill
	 * with {colour}-800 text, px-2 py-1, semibold. */
	export const badgeVariants = tv({
		base: 'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3',
		variants: {
			variant: {
				default: 'bg-blue-100 text-blue-800',
				blue: 'bg-blue-100 text-blue-800',
				green: 'bg-green-100 text-green-800',
				yellow: 'bg-yellow-100 text-yellow-800',
				red: 'bg-red-100 text-red-800',
				gray: 'bg-gray-100 text-gray-800',
				secondary: 'bg-gray-100 text-gray-800',
				destructive: 'bg-red-100 text-red-800',
				outline: 'border border-gray-300 text-gray-700',
				/* The nav's pending-count bubble. */
				count: 'bg-red-600 px-2 py-1 font-bold text-white',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	})

	export type BadgeVariant = VariantProps<typeof badgeVariants>['variant']
</script>

<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js'
	import type { HTMLAnchorAttributes } from 'svelte/elements'

	let {
		ref = $bindable(null),
		href,
		class: className,
		variant = 'default',
		children,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes> & {
		variant?: BadgeVariant
	} = $props()
</script>

<svelte:element
	this={href ? 'a' : 'span'}
	bind:this={ref}
	data-slot="badge"
	{href}
	class={cn(badgeVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>

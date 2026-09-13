<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants'
	import { cn, type WithElementRef } from '$lib/utils.js'
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements'

	/*
	 * Restyled to the palette the app already used.
	 *
	 * Two families of variant, matching the two button families in the original:
	 *   solid  (`blue` | `green` | `red` | `yellow` | `cyan` | `gray`)
	 *          — bg-{c}-600 / hover bg-{c}-700 / white text. Modal confirm
	 *            buttons and page-level CTAs. `default` is green, `destructive`
	 *            is red, `gray` is the modal cancel button.
	 *   soft   (`soft-blue`, `soft-gray`, …) — bg-{c}-50 / hover bg-{c}-100 /
	 *            text-{c}-700 / border-{c}-200. The in-row action buttons.
	 *
	 * Sizes: `default` is px-4 py-2 rounded-md; `row` / `row-sm` reproduce the
	 * in-row action sizing, which goes full-width on mobile and compact on sm+.
	 */
	export const buttonVariants = tv({
		base: "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium outline-none transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
		variants: {
			variant: {
				default: 'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500',
				green: 'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500',
				blue: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
				red: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
				yellow: 'bg-yellow-600 text-white hover:bg-yellow-700 focus-visible:ring-yellow-500',
				cyan: 'bg-cyan-600 text-white hover:bg-cyan-700 focus-visible:ring-cyan-500',
				gray: 'bg-gray-600 text-white hover:bg-gray-700 focus-visible:ring-gray-500',
				destructive: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',

				'soft-blue': 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
				'soft-gray': 'border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100',
				'soft-green': 'border border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
				'soft-yellow': 'border border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
				'soft-red': 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
				'soft-cyan': 'border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
				'soft-orange': 'border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100',

				outline:
					'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-blue-500',
				secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500',
				ghost: 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-blue-500',
				link: 'text-blue-600 underline-offset-4 hover:text-blue-800 hover:underline',
			},
			size: {
				default: 'gap-2 rounded-md px-4 py-2 text-sm',
				lg: 'gap-2 rounded-md px-4 py-2 text-base',
				sm: 'gap-1.5 rounded px-3 py-1 text-sm',
				xs: 'gap-1 rounded px-2 py-1 text-xs',
				row: 'flex-1 gap-1 rounded px-3 py-2 text-sm sm:flex-none sm:py-1',
				'row-sm': 'flex-1 gap-1 rounded px-3 py-2 text-xs sm:flex-none sm:px-2 sm:py-1',
				icon: 'rounded-md p-2',
				'icon-sm': 'rounded-md p-1.5',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	})

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant']
	export type ButtonSize = VariantProps<typeof buttonVariants>['size']

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant
			size?: ButtonSize
		}
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		children,
		...restProps
	}: ButtonProps = $props()
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}

<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";

	export const alertVariants = tv({
		base: "group/alert relative grid w-full gap-0.5 rounded-md border p-4 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg:not([class*='size-'])]:size-5",
		variants: {
			variant: {
				default: "border-gray-200 bg-white text-gray-900 *:[svg]:text-gray-400",
				error: "border-red-200 bg-red-50 text-red-800 *:data-[slot=alert-description]:text-red-700 *:[svg]:text-red-400",
				destructive: "border-red-200 bg-red-50 text-red-800 *:data-[slot=alert-description]:text-red-700 *:[svg]:text-red-400",
				warning: "border-yellow-200 bg-yellow-50 text-yellow-800 *:data-[slot=alert-description]:text-yellow-700 *:[svg]:text-yellow-400",
				info: "border-blue-200 bg-blue-50 text-blue-800 *:data-[slot=alert-description]:text-blue-700 *:[svg]:text-blue-400",
				success: "border-green-200 bg-green-50 text-green-800 *:data-[slot=alert-description]:text-green-700 *:[svg]:text-green-400",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	export type AlertVariant = VariantProps<typeof alertVariants>["variant"];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		variant = "default",
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		variant?: AlertVariant;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="alert"
	role="alert"
	class={cn(alertVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</div>

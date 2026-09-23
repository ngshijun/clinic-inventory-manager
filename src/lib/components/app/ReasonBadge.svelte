<script lang="ts">
	import type { Snippet } from 'svelte'
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
	import CircleXIcon from '@lucide/svelte/icons/circle-x'
	import ClockIcon from '@lucide/svelte/icons/clock'
	import InfoIcon from '@lucide/svelte/icons/info'
	import { getNonOrderReasonMeta } from '$lib/constants/nonOrderReasons'
	import { cn } from '$lib/utils'

	/** The reason an item was not ordered, as a tinted inline label. */
	let {
		reason,
		size = 'sm',
		class: className,
		children,
	}: { reason: string; size?: 'sm' | 'md'; class?: string; children?: Snippet } = $props()

	const meta = $derived(getNonOrderReasonMeta(reason))
	const Icon = $derived(
		meta.icon === 'tick'
			? CircleCheckIcon
			: meta.icon === 'clock'
				? ClockIcon
				: meta.icon === 'cross'
					? CircleXIcon
					: InfoIcon,
	)
	const tone = $derived(
		{
			neutral: 'text-muted-foreground',
			success: 'text-success',
			warning: 'text-warning',
			info: 'text-info',
			violet: 'text-violet',
			danger: 'text-destructive',
		}[meta.tone],
	)
</script>

<span
	class={cn(
		'inline-flex items-center gap-1 font-medium',
		size === 'md' ? 'text-sm' : 'text-xs',
		tone,
		className,
	)}
>
	<Icon class={cn('shrink-0', size === 'md' ? 'size-4' : 'size-3.5')} />
	{#if children}{@render children()}{:else}{reason}{/if}
</span>

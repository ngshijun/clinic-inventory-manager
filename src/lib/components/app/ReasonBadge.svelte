<script lang="ts">
	import type { Snippet } from 'svelte'
	import { getNonOrderReasonMeta } from '$lib/constants/nonOrderReasons'
	import CheckCircleIcon from '$lib/components/icons/CheckCircleIcon.svelte'
	import ClockFilledIcon from '$lib/components/icons/ClockFilledIcon.svelte'
	import CrossCircleIcon from '$lib/components/icons/CrossCircleIcon.svelte'
	import InfoCircleIcon from '$lib/components/icons/InfoCircleIcon.svelte'

	interface Props {
		reason: string
		size?: 'sm' | 'md'
		children?: Snippet
	}

	let { reason, size = 'sm', children }: Props = $props()

	const meta = $derived(getNonOrderReasonMeta(reason))
	const iconSizeClass = $derived(size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5')
	const Icon = $derived(
		meta.icon === 'tick'
			? CheckCircleIcon
			: meta.icon === 'clock'
				? ClockFilledIcon
				: meta.icon === 'cross'
					? CrossCircleIcon
					: InfoCircleIcon
	)
</script>

<span class="inline-flex items-center gap-1.5 {meta.colorClass}">
	<Icon class="flex-shrink-0 {iconSizeClass} {meta.colorClass}" />
	{#if children}{@render children()}{:else}{reason}{/if}
</span>

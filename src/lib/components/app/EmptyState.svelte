<script lang="ts">
	import type { Snippet } from 'svelte'
	import { Button } from '$lib/components/ui/button/index.js'
	import BoxIcon from '$lib/components/icons/BoxIcon.svelte'
	import ChartIcon from '$lib/components/icons/ChartIcon.svelte'
	import DocumentIcon from '$lib/components/icons/DocumentIcon.svelte'
	import SearchIcon from '$lib/components/icons/SearchIcon.svelte'

	interface Props {
		icon?: 'box' | 'document' | 'chart' | 'search'
		title: string
		description: string
		actionText?: string
		size?: 'sm' | 'md' | 'lg'
		onaction?: () => void
		action?: Snippet
	}

	let {
		icon = 'box',
		title,
		description,
		actionText,
		size = 'md',
		onaction,
		action,
	}: Props = $props()

	const paddings = { sm: 'py-8', md: 'py-12', lg: 'py-16' }
	const titleSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' }
	const descriptionSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' }
	const iconSizes = { sm: 'h-8 w-8', md: 'h-12 w-12', lg: 'h-16 w-16' }

	const Icon = $derived(
		icon === 'document'
			? DocumentIcon
			: icon === 'chart'
				? ChartIcon
				: icon === 'search'
					? SearchIcon
					: BoxIcon,
	)
</script>

<div class="text-center {paddings[size]}">
	<Icon class="mx-auto {iconSizes[size]} text-gray-400" />
	<h3 class="mt-2 font-medium text-gray-900 {titleSizes[size]}">{title}</h3>
	<p class="mt-1 text-gray-500 {descriptionSizes[size]}">{description}</p>
	{#if actionText || action}
		<div class="mt-4">
			{#if action}
				{@render action()}
			{:else if actionText}
				<Button variant="blue" class="shadow-sm" onclick={onaction}>{actionText}</Button>
			{/if}
		</div>
	{/if}
</div>

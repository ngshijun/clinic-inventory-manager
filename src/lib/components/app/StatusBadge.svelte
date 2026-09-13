<script lang="ts">
	import type { Snippet } from 'svelte'
	import { Badge } from '$lib/components/ui/badge/index.js'

	interface Props {
		variant?: 'green' | 'yellow' | 'red' | 'blue' | 'gray'
		text?: string
		class?: string
		children?: Snippet
	}

	let { variant = 'blue', text, class: className, children }: Props = $props()
</script>

<Badge {variant} class={className}>
	{#if children}{@render children()}{:else}{text}{/if}
</Badge>

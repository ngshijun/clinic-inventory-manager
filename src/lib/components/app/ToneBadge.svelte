<script lang="ts" module>
	/** Semantic colour for a badge. Tints come from the theme's status tokens. */
	export type Tone = 'neutral' | 'success' | 'warning' | 'info' | 'violet' | 'danger'
</script>

<script lang="ts">
	import type { Snippet } from 'svelte'
	import { Badge, type BadgeVariant } from '$lib/components/ui/badge'

	let {
		tone = 'neutral',
		class: className,
		children,
	}: { tone?: Tone; class?: string; children: Snippet } = $props()

	const VARIANT: Record<Tone, BadgeVariant> = {
		neutral: 'secondary',
		danger: 'destructive',
		success: 'success',
		warning: 'warning',
		info: 'info',
		violet: 'violet',
	}
</script>

<Badge variant={VARIANT[tone]} class={className}>
	{@render children()}
</Badge>

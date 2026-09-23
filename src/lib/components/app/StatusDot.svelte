<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { Tone } from './ToneBadge.svelte'
	import { cn } from '$lib/utils'

	/*
	 * A status word with a small coloured dot before it, for tables where a
	 * filled badge on every row would be noise. The word carries the meaning;
	 * the dot only reinforces it, so the text stays in the normal ink.
	 *
	 * Rule: a row's own state (in stock, low, out) is a dot in any table that
	 * already carries other colour. Everything else stays a ToneBadge, as in
	 * HealthOS: decision outcomes (Pending, Approved), warnings (expiry,
	 * "Only N on hand") and facts about an item (Ordered, Back-ordered).
	 */
	let {
		tone = 'neutral',
		class: className,
		children,
	}: { tone?: Tone; class?: string; children: Snippet } = $props()

	const DOT: Record<Tone, string> = {
		neutral: 'bg-border-strong',
		success: 'bg-success',
		warning: 'bg-warning',
		info: 'bg-info',
		violet: 'bg-violet',
		danger: 'bg-destructive',
	}
</script>

<span class={cn('text-foreground/85 inline-flex items-center gap-1.5 text-sm', className)}>
	<span class={cn('size-2 shrink-0 rounded-full', DOT[tone])} aria-hidden="true"></span>
	{@render children()}
</span>

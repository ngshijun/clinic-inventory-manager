<script lang="ts">
	import { cn } from '$lib/utils'
	import { capsClass } from '$lib/utils/text'

	/*
	 * A stock figure a person reads at a glance: the number in the normal ink,
	 * the unit code muted beside it, and the pack size ("(100 TAB)") smaller
	 * still, since it describes the item rather than the count. A column that
	 * sits beside another figure of the same item passes `pack={false}` so
	 * the pack size appears once per row.
	 */
	let {
		value,
		unit,
		pack = true,
		valueClass,
		class: className,
	}: {
		value: number | string
		unit: string
		pack?: boolean
		valueClass?: string
		class?: string
	} = $props()

	const parts = $derived.by(() => {
		const match = unit.trim().match(/^(.*?)\s*(\(.*\))?$/)
		return { code: match?.[1] ?? unit, pack: match?.[2] ?? '' }
	})
</script>

<span class={cn('inline-flex items-baseline gap-1 whitespace-nowrap tabular-nums', className)}>
	<span class={cn('font-medium', valueClass)}>{value}</span>
	{#if parts.code}
		<span class={cn('text-muted-foreground', capsClass(parts.code))}>{parts.code}</span>
	{/if}
	{#if pack && parts.pack}
		<span class={cn('text-muted-foreground text-xs', capsClass(parts.pack))}>{parts.pack}</span>
	{/if}
</span>

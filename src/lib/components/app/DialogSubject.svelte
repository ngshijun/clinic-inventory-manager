<script lang="ts">
	import { Separator } from '$lib/components/ui/separator'
	import { cn } from '$lib/utils'
	import { capsClass } from '$lib/utils/text'

	/*
	 * The subject of a form dialog, so the title can name only the task
	 * ("Stock In"). The name sits on its own line in the normal ink and a strip
	 * of label/figure facts under it says what the person needs to know before
	 * they type; a hairline then hands over to the form. Facts replace prose:
	 * a dialog that shows "On hand 12 BTL" needs no sentence saying so.
	 */
	let { name, facts = [] }: { name: string; facts?: Array<{ label: string; value: string }> } =
		$props()
</script>

<div class="flex flex-col gap-1.5">
	<p class={cn('leading-snug font-semibold', capsClass(name))}>{name}</p>
	{#if facts.length > 0}
		<dl class="text-muted-foreground flex flex-wrap items-baseline gap-x-2 text-sm">
			{#each facts as fact, index (fact.label)}
				{#if index > 0}
					<span class="text-muted-foreground/60" aria-hidden="true">·</span>
				{/if}
				<div class="flex gap-1">
					<dt>{fact.label}</dt>
					<dd class="text-foreground font-medium tabular-nums">{fact.value}</dd>
				</div>
			{/each}
		</dl>
	{/if}
</div>
<Separator />

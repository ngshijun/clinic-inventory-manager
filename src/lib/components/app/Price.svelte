<script lang="ts">
	import type { Price } from '../../../../convex/lib/price'
	import { formatRM } from '$lib/utils/money'

	/*
	 * A price as the purchaser typed it, "RM 12.00 / BTL": the amount in the
	 * normal ink and the unit muted beside it, as `Quantity` sets a stock
	 * figure. A dash when the price is not known.
	 */
	let { price }: { price?: Price } = $props()
</script>

{#if price}
	<span class="inline-flex items-baseline gap-1 whitespace-nowrap tabular-nums">
		<span class="font-medium">{formatRM(price.amount)}</span>
		<span class="text-muted-foreground">/ {price.unit}</span>
	</span>
{:else}
	<span class="text-muted-foreground">—</span>
{/if}

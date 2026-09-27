<script lang="ts">
	import * as Select from '$lib/components/ui/select'
	import type { InventoryItem } from '$lib/types/inventory'
	import { cn } from '$lib/utils'
	import { ALL_SUPPLIERS, NO_SUPPLIER, activeSupplier, supplierCounts } from '$lib/utils/supplier'
	import { capsClass } from '$lib/utils/text'

	/*
	 * One dropdown that narrows a list to a single supplier, so the purchaser
	 * can order everything from that supplier at once. It offers only the
	 * suppliers among `items`, each with its count, and No Supplier for the
	 * items still to be filled in. Shared by the Dashboard, Inventory and
	 * Price List.
	 */
	let {
		value = $bindable(ALL_SUPPLIERS),
		items,
	}: {
		value?: string
		/** The list being filtered, before the supplier filter */
		items: InventoryItem[]
	} = $props()

	const suppliers = $derived(supplierCounts(items))
	const without = $derived(items.filter((item) => !item.supplier).length)
	const shown = $derived(activeSupplier(value, items))
</script>

<Select.Root
	type="single"
	bind:value={() => shown, (choice) => (value = choice || ALL_SUPPLIERS)}
	disabled={suppliers.length === 0}
>
	<Select.Trigger class={cn('w-56', capsClass(shown))} aria-label="Filter by supplier">
		<span class="truncate">
			{#if shown === ALL_SUPPLIERS}
				All Suppliers
			{:else if shown === NO_SUPPLIER}
				No Supplier
			{:else}
				{shown}
			{/if}
		</span>
	</Select.Trigger>
	<Select.Content>
		<Select.Group>
			<Select.Item value={ALL_SUPPLIERS} label="All Suppliers">All Suppliers</Select.Item>
		</Select.Group>
		<Select.Separator />
		<Select.Group>
			{#each suppliers as supplier (supplier.name)}
				<Select.Item value={supplier.name} label={supplier.name} class={capsClass(supplier.name)}>
					{supplier.name}
					<span class="text-muted-foreground ms-auto ps-4 text-xs tabular-nums">
						{supplier.count}
					</span>
				</Select.Item>
			{/each}
		</Select.Group>
		{#if without > 0}
			<Select.Separator />
			<Select.Group>
				<Select.Item value={NO_SUPPLIER} label="No Supplier">
					No Supplier
					<span class="text-muted-foreground ms-auto ps-4 text-xs tabular-nums">{without}</span>
				</Select.Item>
			</Select.Group>
		{/if}
	</Select.Content>
</Select.Root>

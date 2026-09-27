<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
	import * as Command from '$lib/components/ui/command'
	import * as Popover from '$lib/components/ui/popover'
	import type { InventoryItem } from '$lib/types/inventory'
	import { cn } from '$lib/utils'
	import { ALL_SUPPLIERS, NO_SUPPLIER, activeSupplier, supplierCounts } from '$lib/utils/supplier'
	import { capsClass } from '$lib/utils/text'

	/*
	 * One dropdown that narrows a list to a single supplier, so the purchaser
	 * can order everything from that supplier at once. It offers only the
	 * suppliers among `items`, each with its count, and No Supplier for the
	 * items still to be filled in. A few dozen names is a long list to scroll,
	 * so it opens with a search field on top: typing a few letters narrows it
	 * and Return takes the first match. Shared by the Dashboard, Inventory
	 * and Price List.
	 */
	let {
		value = $bindable(ALL_SUPPLIERS),
		items,
	}: {
		value?: string
		/** The list being filtered, before the supplier filter */
		items: InventoryItem[]
	} = $props()

	let open = $state(false)

	const suppliers = $derived(supplierCounts(items))
	const without = $derived(items.filter((item) => !item.supplier).length)
	const shown = $derived(activeSupplier(value, items))
	const label = $derived(
		shown === ALL_SUPPLIERS ? 'All Suppliers' : shown === NO_SUPPLIER ? 'No Supplier' : shown,
	)

	const choose = (choice: string): void => {
		value = choice
		open = false
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				type="button"
				role="combobox"
				aria-expanded={open}
				aria-label="Filter by supplier"
				disabled={suppliers.length === 0}
				class={cn(
					'bg-input/50 focus-visible:border-ring focus-visible:ring-ring/30 flex h-9 w-56 items-center justify-between gap-1.5 rounded-3xl border border-transparent px-3 py-2 text-sm whitespace-nowrap outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50',
					capsClass(label),
				)}
			>
				<span class="truncate">{label}</span>
				<ChevronDownIcon class="text-muted-foreground size-4 shrink-0" />
			</button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content align="start" class="w-72 p-0">
		<Command.Root>
			<Command.Input placeholder="Type to find a supplier" />
			<Command.List>
				<Command.Empty>No supplier matches</Command.Empty>
				<Command.Group>
					<Command.Item
						value="All Suppliers"
						data-checked={shown === ALL_SUPPLIERS}
						onSelect={() => choose(ALL_SUPPLIERS)}
					>
						All Suppliers
					</Command.Item>
				</Command.Group>
				<Command.Separator />
				<Command.Group>
					{#each suppliers as supplier (supplier.name)}
						<Command.Item
							value={supplier.name}
							data-checked={shown === supplier.name}
							class={capsClass(supplier.name)}
							onSelect={() => choose(supplier.name)}
						>
							<span class="truncate">{supplier.name}</span>
							<span class="text-muted-foreground text-xs tabular-nums">{supplier.count}</span>
						</Command.Item>
					{/each}
				</Command.Group>
				{#if without > 0}
					<Command.Separator />
					<Command.Group>
						<Command.Item
							value="No Supplier"
							data-checked={shown === NO_SUPPLIER}
							onSelect={() => choose(NO_SUPPLIER)}
						>
							No Supplier
							<span class="text-muted-foreground text-xs tabular-nums">{without}</span>
						</Command.Item>
					</Command.Group>
				{/if}
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>

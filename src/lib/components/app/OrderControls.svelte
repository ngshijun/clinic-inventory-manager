<script lang="ts">
	import { toast } from 'svelte-sonner'
	import AlarmClockIcon from '@lucide/svelte/icons/alarm-clock'
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
	import EyeOffIcon from '@lucide/svelte/icons/eye-off'
	import { Button } from '$lib/components/ui/button'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import type { InventoryItem } from '$lib/types/inventory'
	import { isSnoozing } from '$lib/utils/orders'

	/**
	 * The purchaser's controls on a row. On order: Update Order… and Not
	 * Ordered. Otherwise Mark Ordered… and a Not now menu holding the ways to
	 * put the item aside. The dialogs belong to the page.
	 */
	let {
		item,
		size = 'sm',
		onMarkOrdered,
		onSnooze,
		onStopTracking,
	}: {
		item: InventoryItem
		size?: 'sm' | 'default'
		onMarkOrdered: (item: InventoryItem) => void
		onSnooze: (item: InventoryItem) => void
		onStopTracking: (item: InventoryItem) => void
	} = $props()

	const undoable = async (message: string, undone: string): Promise<void> => {
		const { id, order_status: previous } = item
		await inventoryStore.clearOrderStatus(id)
		if (inventoryStore.error) return
		toast.success(message, {
			duration: 8000,
			action: {
				label: 'Undo',
				onClick: async () => {
					await inventoryStore.restoreOrderStatus(id, previous)
					if (!inventoryStore.error) toast.success(undone)
				},
			},
		})
	}
</script>

{#if item.order_status?.kind === 'ordered'}
	<Button
		variant="outline"
		{size}
		disabled={inventoryStore.loading}
		onclick={() => onMarkOrdered(item)}
	>
		Update Order…
	</Button>
	<Button
		variant="outline"
		{size}
		disabled={inventoryStore.loading}
		onclick={() =>
			undoable(`${item.item_name} is no longer on order`, `${item.item_name} is on order again`)}
	>
		Not Ordered
	</Button>
{:else}
	<Button
		variant="outline"
		{size}
		disabled={inventoryStore.loading}
		onclick={() => onMarkOrdered(item)}
	>
		Mark Ordered…
	</Button>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="outline" {size} disabled={inventoryStore.loading}>
					Not now
					<ChevronDownIcon data-icon="inline-end" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="min-w-56">
			<DropdownMenu.Group>
				<DropdownMenu.Item onclick={() => onSnooze(item)}>
					<AlarmClockIcon />
					{isSnoozing(item) ? 'Change Snooze…' : 'Snooze Until a Date…'}
				</DropdownMenu.Item>
				{#if item.order_status?.kind === 'snoozed'}
					<DropdownMenu.Item
						onclick={() =>
							undoable(`${item.item_name} is back in To Order`, `Snoozed ${item.item_name} again`)}
					>
						Show in To Order Now
					</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Group>
			<DropdownMenu.Separator />
			<DropdownMenu.Group>
				<DropdownMenu.Item variant="destructive" onclick={() => onStopTracking(item)}>
					<EyeOffIcon />
					Stop Tracking This Item…
				</DropdownMenu.Item>
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}

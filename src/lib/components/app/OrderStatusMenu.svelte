<script lang="ts">
	import { toast } from 'svelte-sonner'
	import CheckIcon from '@lucide/svelte/icons/check'
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
	import CircleXIcon from '@lucide/svelte/icons/circle-x'
	import ClockIcon from '@lucide/svelte/icons/clock'
	import { Button } from '$lib/components/ui/button'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import { NON_ORDER_REASONS, getNonOrderReasonMeta } from '$lib/constants/nonOrderReasons'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import type { InventoryItem } from '$lib/types/inventory'

	/**
	 * The one stateful order control on a row, always a verb: Clear Date when
	 * the item is on order, otherwise Set Status or Change Status opening a
	 * menu of Mark Ordered… and the non-order reasons, with a check on the
	 * current one.
	 */
	let {
		item,
		onMarkOrdered,
		size = 'sm',
	}: {
		item: InventoryItem
		onMarkOrdered: (item: InventoryItem) => void
		size?: 'sm' | 'default'
	} = $props()

	const ICONS = { tick: CircleCheckIcon, clock: ClockIcon, cross: CircleXIcon, info: null }
	const TEXT = {
		neutral: 'text-muted-foreground',
		success: 'text-success',
		warning: 'text-warning',
		info: 'text-info',
		violet: 'text-violet',
		danger: 'text-destructive',
	}

	// Clearing is reversible: undo marks the item ordered again on the same date.
	const clearDate = async (): Promise<void> => {
		const { id, item_name: name, order_date: date, back_order: backOrder } = item
		await inventoryStore.clearOrderDate(id)
		if (inventoryStore.error || !date) return
		toast.success(`Cleared the order date of ${name}`, {
			duration: 8000,
			action: {
				label: 'Undo',
				onClick: async () => {
					await inventoryStore.markAsOrdered(id, date, backOrder ?? false)
					if (!inventoryStore.error) toast.success(`Marked ${name} as ordered again`)
				},
			},
		})
	}

	const setReason = async (reason: string | null): Promise<void> => {
		if (reason === (item.non_order_reason ?? null)) return
		await inventoryStore.setNonOrderReason(item.id, reason)
		if (!inventoryStore.error) {
			toast.success(
				reason
					? `Marked ${item.item_name} as ${reason}`
					: `Cleared the reason of ${item.item_name}`,
			)
		}
	}
</script>

{#if item.order_date}
	<Button variant="outline" {size} disabled={inventoryStore.loading} onclick={clearDate}>
		Clear Date
	</Button>
{:else}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="outline" {size} disabled={inventoryStore.loading}>
					{item.non_order_reason ? 'Change Status' : 'Set Status'}
					<ChevronDownIcon data-icon="inline-end" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="min-w-56">
			<DropdownMenu.Group>
				<DropdownMenu.Item class="font-medium" onclick={() => onMarkOrdered(item)}>
					Mark Ordered…
				</DropdownMenu.Item>
			</DropdownMenu.Group>
			<DropdownMenu.Separator />
			<DropdownMenu.Group>
				{#each NON_ORDER_REASONS as reason (reason)}
					{@const meta = getNonOrderReasonMeta(reason)}
					{@const Icon = ICONS[meta.icon]}
					<DropdownMenu.Item onclick={() => setReason(reason)}>
						{#if Icon}
							<Icon class={TEXT[meta.tone]} />
						{/if}
						{meta.label}
						{#if item.non_order_reason === reason}
							<CheckIcon class="ms-auto" />
						{/if}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Group>
			{#if item.non_order_reason}
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Item class="text-muted-foreground" onclick={() => setReason(null)}>
						Clear Reason
					</DropdownMenu.Item>
				</DropdownMenu.Group>
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/if}

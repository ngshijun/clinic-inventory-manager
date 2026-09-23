<script lang="ts">
	import { toast } from 'svelte-sonner'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import { Checkbox } from '$lib/components/ui/checkbox'
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import type { InventoryItem } from '$lib/types/inventory'
	import { todayIsoDate } from '$lib/types/stockBatches'

	/**
	 * Marks an item as ordered on a chosen date. Shared by Price List and the
	 * Dashboard: hold a reference with `bind:this` and call `open(item)`.
	 */
	let item = $state<InventoryItem | null>(null)
	let isOpen = $state(false)
	let orderDate = $state('')
	let backOrder = $state(false)
	let openedWith = $state('')
	const dirty = $derived(orderDate !== openedWith || backOrder)

	export function open(target: InventoryItem): void {
		item = target
		orderDate = todayIsoDate()
		openedWith = orderDate
		backOrder = false
		isOpen = true
	}

	const close = (): void => {
		isOpen = false
		item = null
	}

	const confirm = async (): Promise<void> => {
		if (!item || !orderDate) return
		const name = item.item_name
		await inventoryStore.markAsOrdered(item.id, orderDate, backOrder)
		if (!inventoryStore.error) {
			toast.success(`Marked ${name} as ${backOrder ? 'back-ordered' : 'ordered'}`)
			close()
		}
	}
</script>

<ActionModal
	bind:open={isOpen}
	title={`Mark “${item?.item_name ?? ''}” as Ordered`}
	loading={inventoryStore.loading}
	{dirty}
	disabled={!orderDate}
	confirmText="Mark Ordered"
	onconfirm={confirm}
	oncancel={close}
>
	<form
		onsubmit={(e) => {
			e.preventDefault()
			confirm()
		}}
	>
		<Field.Group>
			<Field.Field>
				<Field.Label for="order-date">Order date</Field.Label>
				<Input id="order-date" bind:value={orderDate} type="date" required />
			</Field.Field>
			<Field.Field orientation="horizontal">
				<Checkbox id="order-back-order" bind:checked={backOrder} />
				<Field.Content>
					<Field.Label for="order-back-order">Back order</Field.Label>
					<Field.Description>
						Tick when the supplier has accepted the order but cannot deliver yet.
					</Field.Description>
				</Field.Content>
			</Field.Field>
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

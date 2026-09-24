<script lang="ts">
	import { toast } from 'svelte-sonner'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import DialogSubject from '$lib/components/app/DialogSubject.svelte'
	import { Checkbox } from '$lib/components/ui/checkbox'
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import type { InventoryItem } from '$lib/types/inventory'
	import { todayIsoDate } from '$lib/types/stockBatches'
	import { formatDate } from '$lib/utils/date'

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
	const facts = $derived.by((): Array<{ label: string; value: string }> => {
		if (!item) return []
		const rows = [
			{ label: 'In stock', value: `${item.quantity} ${item.unit}` },
			{ label: 'Reorder at', value: item.reorder_level < 0 ? '—' : String(item.reorder_level) },
		]
		if (item.order_date) rows.push({ label: 'Ordered', value: formatDate(item.order_date) })
		return rows
	})

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
	title="Mark as Ordered"
	loading={inventoryStore.loading}
	{dirty}
	disabled={!orderDate}
	confirmText="Mark Ordered"
	onconfirm={confirm}
	oncancel={close}
>
	{#if item}
		<DialogSubject name={item.item_name} {facts} />
	{/if}
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
				<Field.Label for="order-back-order">Back-ordered</Field.Label>
			</Field.Field>
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

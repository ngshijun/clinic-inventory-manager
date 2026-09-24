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
	import { LEAD_DAYS, addDays } from '../../../../convex/lib/orders'

	/**
	 * Marks an item as ordered. The expected date is proposed LEAD_DAYS after
	 * the order date, so the usual case is one click; a back-order has no date
	 * and the Dashboard chases it after two weeks instead. Shared by Price
	 * List and the Dashboard: hold a reference with `bind:this` and call
	 * `open(item)`.
	 */
	let item = $state<InventoryItem | null>(null)
	let isOpen = $state(false)
	let orderedOn = $state('')
	let expectedBy = $state('')
	let backOrder = $state(false)
	let openedWith = $state('')
	const dirty = $derived(orderedOn !== openedWith || backOrder)
	const facts = $derived.by((): Array<{ label: string; value: string }> =>
		item
			? [
					{ label: 'In stock', value: `${item.quantity} ${item.unit}` },
					{ label: 'Reorder at', value: item.reorder_level < 0 ? '—' : String(item.reorder_level) },
				]
			: [],
	)

	export function open(target: InventoryItem): void {
		item = target
		orderedOn = todayIsoDate()
		openedWith = orderedOn
		expectedBy = addDays(orderedOn, LEAD_DAYS)
		backOrder = false
		isOpen = true
	}

	const close = (): void => {
		isOpen = false
		item = null
	}

	// A new order date moves the proposed expected date with it
	const onOrderedOnChange = (): void => {
		if (orderedOn) expectedBy = addDays(orderedOn, LEAD_DAYS)
	}

	const isValid = $derived(!!orderedOn && (backOrder || !!expectedBy))

	const confirm = async (): Promise<void> => {
		if (!item || !isValid) return
		const name = item.item_name
		await inventoryStore.markOrdered(item.id, orderedOn, backOrder ? null : expectedBy)
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
	disabled={!isValid}
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
			<div class="grid grid-cols-2 gap-4">
				<Field.Field>
					<Field.Label for="order-date">Order date</Field.Label>
					<Input
						id="order-date"
						bind:value={orderedOn}
						type="date"
						required
						onchange={onOrderedOnChange}
					/>
				</Field.Field>
				<Field.Field>
					<Field.Label for="order-expected">Expected by</Field.Label>
					<Input
						id="order-expected"
						bind:value={expectedBy}
						type="date"
						min={orderedOn}
						disabled={backOrder}
						required={!backOrder}
					/>
					<Field.Description>
						{backOrder ? 'Shown as late after 14 days.' : 'Shown as late after this date.'}
					</Field.Description>
				</Field.Field>
			</div>
			<Field.Field orientation="horizontal">
				<Checkbox id="order-back-order" bind:checked={backOrder} />
				<Field.Label for="order-back-order"
					>Back-ordered, the supplier has not given a date</Field.Label
				>
			</Field.Field>
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

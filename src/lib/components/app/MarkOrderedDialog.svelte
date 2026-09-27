<script lang="ts">
	import { toast } from 'svelte-sonner'
	import { selectOnFocus } from '$lib/attachments/focus'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import DialogSubject from '$lib/components/app/DialogSubject.svelte'
	import PriceField from '$lib/components/app/PriceField.svelte'
	import { Checkbox } from '$lib/components/ui/checkbox'
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import * as InputGroup from '$lib/components/ui/input-group'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import type { InventoryItem, OrderedStatus } from '$lib/types/inventory'
	import { todayIsoDate } from '$lib/types/stockBatches'
	import {
		priceFormFrom,
		priceFormIsValid,
		priceFormValue,
		samePrice,
		type PriceForm,
	} from '$lib/utils/price'
	import { LEAD_DAYS, addDays } from '../../../../convex/lib/orders'

	/**
	 * Marks an item as ordered, or changes an order already placed. The
	 * quantity is in the item's unit, shown beside the field because the
	 * supplier's unit is not always the shelf's. The price opens with the last
	 * one and is saved on the item; left empty, the last price stays. Shared by Price List and
	 * the Dashboard: hold a reference with `bind:this` and call `open(item)`.
	 */
	let item = $state<InventoryItem | null>(null)
	let existing = $state<OrderedStatus | null>(null)
	let isOpen = $state(false)
	let quantity = $state<number | ''>('')
	let orderedOn = $state('')
	let expectedBy = $state('')
	let backOrder = $state(false)
	let price = $state<PriceForm>({ amount: '', unit: '' })
	let openedPrice = $state<PriceForm>({ amount: '', unit: '' })
	let openedWith = $state({
		quantity: '' as number | '',
		orderedOn: '',
		expectedBy: '',
		backOrder: false,
	})

	const dirty = $derived(
		quantity !== openedWith.quantity ||
			orderedOn !== openedWith.orderedOn ||
			expectedBy !== openedWith.expectedBy ||
			backOrder !== openedWith.backOrder ||
			!samePrice(priceFormValue(price), priceFormValue(openedPrice)),
	)
	const facts = $derived.by((): Array<{ label: string; value: string }> =>
		item
			? [
					{ label: 'In stock', value: `${item.quantity} ${item.unit_label}` },
					{ label: 'Reorder at', value: String(item.reorder_level) },
					...(item.supplier ? [{ label: 'Supplier', value: item.supplier }] : []),
				]
			: [],
	)
	const received = $derived(existing?.received ?? 0)
	const closes = $derived(received > 0 && Number(quantity) <= received)

	export function open(target: InventoryItem): void {
		item = target
		existing = target.order_status?.kind === 'ordered' ? target.order_status : null
		quantity = existing?.quantity ?? ''
		orderedOn = existing?.ordered_on ?? todayIsoDate()
		backOrder = existing !== null && !existing.expected_by
		expectedBy = existing?.expected_by ?? addDays(orderedOn, LEAD_DAYS)
		price = priceFormFrom(target)
		openedPrice = { ...price }
		openedWith = { quantity, orderedOn, expectedBy, backOrder }
		isOpen = true
	}

	const close = (): void => {
		isOpen = false
		item = null
		existing = null
	}

	// A new order date moves the proposed expected date with it
	const onOrderedOnChange = (): void => {
		if (orderedOn) expectedBy = addDays(orderedOn, LEAD_DAYS)
	}

	const isValid = $derived(
		Number.isInteger(Number(quantity)) &&
			Number(quantity) > 0 &&
			!!orderedOn &&
			(backOrder || !!expectedBy) &&
			priceFormIsValid(price),
	)

	const confirm = async (): Promise<void> => {
		if (!item || !isValid) return
		const name = item.item_name
		await inventoryStore.markOrdered(
			item.id,
			Number(quantity),
			orderedOn,
			backOrder ? null : expectedBy,
			priceFormValue(price),
		)
		if (!inventoryStore.error) {
			toast.success(
				closes
					? `Order closed for ${name}`
					: existing
						? `Changed the order for ${name}`
						: `Marked ${name} as ${backOrder ? 'back-ordered' : 'ordered'}`,
			)
			close()
		}
	}
</script>

<ActionModal
	bind:open={isOpen}
	title={existing ? 'Update Order' : 'Mark as Ordered'}
	loading={inventoryStore.loading}
	{dirty}
	disabled={!isValid}
	confirmText={closes ? 'Close Order' : existing ? 'Save' : 'Mark Ordered'}
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
				<Field.Label for="order-quantity">How many</Field.Label>
				<InputGroup.Root>
					<InputGroup.Input
						id="order-quantity"
						bind:value={quantity}
						type="number"
						inputmode="numeric"
						min={1}
						step={1}
						required
						{@attach selectOnFocus()}
					/>
					<InputGroup.Addon align="inline-end">
						<InputGroup.Text class="tracking-wide">{item?.unit_label ?? ''}</InputGroup.Text>
					</InputGroup.Addon>
				</InputGroup.Root>
				{#if received > 0}
					<Field.Description>
						{received}
						{item?.unit_label} received so far. Set it to {received} if nothing more is coming.
					</Field.Description>
				{/if}
			</Field.Field>
			{#if item}
				<PriceField
					id="order-price"
					bind:value={price}
					parts={item}
					quantity={Number(quantity) || 0}
				/>
			{/if}
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

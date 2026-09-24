<script lang="ts">
	import { toast } from 'svelte-sonner'
	import { selectOnFocus } from '$lib/attachments/focus'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import DialogSubject from '$lib/components/app/DialogSubject.svelte'
	import Quantity from '$lib/components/app/Quantity.svelte'
	import { Checkbox } from '$lib/components/ui/checkbox'
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockBatchesStore } from '$lib/stores/stockBatches.svelte'
	import type { InventoryItem } from '$lib/types/inventory'
	import { todayIsoDate } from '$lib/types/stockBatches'
	import { formatDate } from '$lib/utils/date'

	/*
	 * Stock In, shared by Inventory and the Dashboard. Opened with
	 * `dialog.open(item)`. A delivery normally closes the item's order or
	 * snooze; the checkbox keeps it when only part of the order arrived.
	 */
	let item = $state<InventoryItem | null>(null)
	let isOpen = $state(false)
	let quantity = $state(1)
	let expiryDate = $state('')
	let clearOrderStatus = $state(true)
	let keepUntracked = $state(true)

	const status = $derived(item?.order_status)

	// What the person needs to know before typing a quantity; prose says none of it
	const facts = $derived.by((): Array<{ label: string; value: string }> => {
		if (!item) return []
		const rows = [
			{ label: 'In stock', value: `${item.quantity} ${item.unit}` },
			{ label: 'Reorder at', value: item.reorder_level < 0 ? '—' : String(item.reorder_level) },
			{
				label: 'Batches',
				value: String(stockBatchesStore.batchesByItem.get(item.id)?.length ?? 0),
			},
		]
		if (status?.kind === 'ordered')
			rows.push({ label: 'Ordered', value: formatDate(status.ordered_on) })
		return rows
	})
	const after = $derived((item?.quantity ?? 0) + Math.max(0, Math.floor(Number(quantity) || 0)))

	const dirty = $derived(
		item !== null &&
			(Number(quantity) !== 1 ||
				expiryDate !== '' ||
				clearOrderStatus !== !!item.order_status ||
				keepUntracked !== item.not_track),
	)

	export function open(target: InventoryItem): void {
		item = target
		quantity = 1
		expiryDate = ''
		clearOrderStatus = !!target.order_status
		keepUntracked = target.not_track
		isOpen = true
	}

	const close = (): void => {
		isOpen = false
		item = null
	}

	const confirm = async (): Promise<void> => {
		if (!item || Number(quantity) <= 0) return
		const target = item
		await inventoryStore.stockIn(
			target.id,
			Number(quantity),
			clearOrderStatus,
			keepUntracked,
			expiryDate || null,
		)
		if (!inventoryStore.error) {
			toast.success(`Stocked in ${quantity} ${target.unit} of ${target.item_name}`)
			close()
		}
	}
</script>

<ActionModal
	bind:open={isOpen}
	title="Stock In"
	loading={inventoryStore.loading}
	disabled={Number(quantity) <= 0}
	{dirty}
	confirmText="Stock In"
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
					<Field.Label for="stock-in-quantity">Quantity to add</Field.Label>
					<Input
						id="stock-in-quantity"
						bind:value={quantity}
						type="number"
						min={1}
						step={1}
						required
						{@attach selectOnFocus()}
					/>
					{#if Number(quantity) > 0}
						<Field.Description
							><Quantity value={after} unit={item?.unit ?? ''} /> after this stock in.</Field.Description
						>
					{/if}
				</Field.Field>
				<Field.Field>
					<Field.Label for="stock-in-expiry">
						Expiry date <span class="text-muted-foreground font-normal">optional</span>
					</Field.Label>
					<Input id="stock-in-expiry" bind:value={expiryDate} type="date" min={todayIsoDate()} />
				</Field.Field>
			</div>
			{#if status}
				<Field.Field orientation="horizontal">
					<Checkbox id="stock-in-clear-order" bind:checked={clearOrderStatus} />
					<Field.Label for="stock-in-clear-order">
						{status.kind === 'ordered' ? 'This delivery completes the order' : 'End the snooze'}
					</Field.Label>
				</Field.Field>
			{/if}
			{#if item?.not_track}
				<Field.Field orientation="horizontal">
					<Checkbox id="stock-in-untracked" bind:checked={keepUntracked} />
					<Field.Label for="stock-in-untracked">Keep untracked</Field.Label>
				</Field.Field>
			{/if}
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

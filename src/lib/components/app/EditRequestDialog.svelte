<script lang="ts">
	import { toast } from 'svelte-sonner'
	import { selectOnFocus } from '$lib/attachments/focus'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import { Textarea } from '$lib/components/ui/textarea'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockRequestsStore } from '$lib/stores/stockRequests.svelte'
	import type { StockRequest } from '$lib/types/stockRequests'
	import { withUnit } from '$lib/utils/requests'

	/*
	 * Edit Request, shared by Stock Approvals and Stock Requests. Opened with
	 * `dialog.open(request)`; the quantity is capped at what is on hand.
	 */
	let request = $state<StockRequest | null>(null)
	let isOpen = $state(false)
	let quantity = $state('')
	let remark = $state('')

	const onHand = $derived(
		request ? (inventoryStore.getItemById(request.item_id)?.quantity ?? 0) : 0,
	)
	const unit = $derived(request?.unit ?? '')
	const parsedQuantity = $derived(Number(quantity))
	const overStock = $derived(quantity !== '' && parsedQuantity > onHand)
	const isValid = $derived(
		request !== null && Number.isInteger(parsedQuantity) && parsedQuantity > 0 && !overStock,
	)
	const isChanged = $derived(
		request !== null &&
			(parsedQuantity !== request.quantity || remark.trim() !== (request.remark ?? '').trim()),
	)

	export function open(target: StockRequest): void {
		request = target
		quantity = String(target.quantity)
		remark = target.remark ?? ''
		isOpen = true
	}

	const close = (): void => {
		isOpen = false
		request = null
	}

	const confirm = async (): Promise<void> => {
		if (!request || !isValid || !isChanged) return
		const target = request
		await stockRequestsStore.updateRequest(target.id, parsedQuantity, remark.trim())
		if (!stockRequestsStore.error) {
			toast.success(`Saved the request for ${target.item_name}`)
			close()
		}
	}
</script>

<ActionModal
	bind:open={isOpen}
	title={`Edit Request · ${request?.item_name ?? ''}`}
	loading={stockRequestsStore.loading}
	dirty={isChanged}
	disabled={!isValid || !isChanged}
	confirmText="Save"
	onconfirm={confirm}
	oncancel={close}
>
	<form
		onsubmit={(event) => {
			event.preventDefault()
			confirm()
		}}
	>
		<Field.Group>
			<Field.Field data-invalid={overStock || undefined}>
				<Field.Label for="edit-request-quantity">Quantity</Field.Label>
				<Input
					id="edit-request-quantity"
					bind:value={quantity}
					type="number"
					min="1"
					max={onHand}
					step="1"
					aria-invalid={overStock || undefined}
					{@attach selectOnFocus()}
				/>
				{#if overStock}
					<Field.Error>Only {withUnit(onHand, unit)} on hand.</Field.Error>
				{:else}
					<Field.Description>Up to {withUnit(onHand, unit)} on hand.</Field.Description>
				{/if}
			</Field.Field>
			<Field.Field>
				<Field.Label for="edit-request-remark">Remark</Field.Label>
				<Textarea id="edit-request-remark" bind:value={remark} rows={3} />
				<Field.Description>Optional.</Field.Description>
			</Field.Field>
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

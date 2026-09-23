<script lang="ts">
	import { toast } from 'svelte-sonner'
	import { selectOnFocus } from '$lib/attachments/focus'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import ToneBadge from '$lib/components/app/ToneBadge.svelte'
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockBatchesStore } from '$lib/stores/stockBatches.svelte'
	import type { InventoryItem } from '$lib/types/inventory'
	import { getExpiryStatus, type StockBatch } from '$lib/types/stockBatches'
	import { formatDate } from '$lib/utils/date'
	import { expiryBadge } from '$lib/utils/expiry'

	/*
	 * Stock Out, shared by Inventory and the Dashboard. Opened with
	 * `dialog.open(item)`; shows which batches the removal draws from, earliest
	 * expiry first, and warns when some of them are already expired.
	 */
	let item = $state<InventoryItem | null>(null)
	let isOpen = $state(false)
	let quantity = $state(1)

	// The dialog keeps a snapshot; read the live row so the maximum tracks the store
	const live = $derived(item ? (inventoryStore.getItemById(item.id) ?? item) : null)
	const max = $derived(live?.quantity ?? 0)
	const unit = $derived(live?.unit ?? '')
	const batchCount = $derived(item ? stockBatchesStore.getBatchesForItem(item.id).length : 0)

	const plural = (count: number, noun: string, many = `${noun}s`): string =>
		`${count} ${count === 1 ? noun : many}`

	export function open(target: InventoryItem): void {
		item = target
		quantity = 1
		isOpen = true
	}

	const close = (): void => {
		isOpen = false
		item = null
	}

	// Which batches a stock out would draw from, earliest expiry first
	const plan = $derived.by((): Array<{ batch: StockBatch; take: number }> => {
		if (!item) return []
		let remaining = Math.max(0, Math.floor(Number(quantity) || 0))
		const rows: Array<{ batch: StockBatch; take: number }> = []
		for (const batch of stockBatchesStore.getBatchesForItem(item.id)) {
			if (remaining <= 0) break
			const take = Math.min(batch.quantity, remaining)
			rows.push({ batch, take })
			remaining -= take
		}
		return rows
	})

	const expiredInPlan = $derived(
		plan
			.filter(({ batch }) => getExpiryStatus(batch.expiry_date) === 'expired')
			.reduce((sum, { take }) => sum + take, 0),
	)

	const overMax = $derived(Number(quantity) > max)
	const isValid = $derived(Number(quantity) > 0 && !overMax)

	const confirm = async (): Promise<void> => {
		if (!item || !isValid) return
		const target = item
		const amount = Number(quantity)
		await inventoryStore.stockOut(target.id, amount)
		if (!inventoryStore.error) {
			toast.success(`Stocked out ${plural(amount, target.unit)} of ${target.item_name}`)
			close()
		}
	}
</script>

<ActionModal
	bind:open={isOpen}
	title={`Stock Out · ${item?.item_name ?? ''}`}
	description={`On hand ${max} ${unit} across ${plural(batchCount, 'batch', 'batches')}.`}
	loading={inventoryStore.loading}
	dirty={Number(quantity) !== 1}
	disabled={!isValid}
	confirmText="Stock Out"
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
			<Field.Field data-invalid={overMax || undefined}>
				<Field.Label for="stock-out-quantity">Quantity to remove</Field.Label>
				<Input
					id="stock-out-quantity"
					bind:value={quantity}
					type="number"
					min={1}
					{max}
					step={1}
					required
					aria-invalid={overMax || undefined}
					{@attach selectOnFocus()}
				/>
				{#if overMax}
					<Field.Error>Only {max} {unit} on hand.</Field.Error>
				{:else}
					<Field.Description>Up to {max} {unit}.</Field.Description>
				{/if}
			</Field.Field>
			{#if plan.length > 0}
				<Field.Field>
					<Field.Label>Taken from</Field.Label>
					<ul class="divide-border bg-muted/40 divide-y rounded-2xl border text-sm">
						{#each plan as { batch, take } (batch.id)}
							{@const badge = expiryBadge(batch.expiry_date)}
							<li class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
								<span class="tabular-nums">
									{take} of {batch.quantity}
									{unit} · received {formatDate(batch._creationTime)}
								</span>
								{#if badge}
									<ToneBadge tone={badge.tone}>{badge.text}</ToneBadge>
								{:else if batch.expiry_date}
									<span class="text-muted-foreground text-xs">
										Expires {formatDate(batch.expiry_date)}
									</span>
								{:else}
									<span class="text-muted-foreground text-xs">No expiry</span>
								{/if}
							</li>
						{/each}
					</ul>
					{#if expiredInPlan > 0}
						<p class="text-warning text-sm">
							{expiredInPlan}
							{unit} in this stock-out are already expired.
						</p>
					{/if}
				</Field.Field>
			{/if}
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

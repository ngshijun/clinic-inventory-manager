<script lang="ts">
	import { toast } from 'svelte-sonner'
	import { selectOnFocus } from '#lib/attachments/focus.js'
	import ActionModal from '#lib/components/app/ActionModal.svelte'
	import DateInput from '#lib/components/app/DateInput.svelte'
	import ItemPicker from '#lib/components/app/ItemPicker.svelte'
	import * as Field from '#lib/components/ui/field/index.js'
	import { Input } from '#lib/components/ui/input/index.js'
	import * as InputGroup from '#lib/components/ui/input-group/index.js'
	import { Textarea } from '#lib/components/ui/textarea/index.js'
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js'
	import { inventoryStore } from '#lib/stores/inventory.svelte.js'
	import { loansStore } from '#lib/stores/loans.svelte.js'
	import type { InventoryId } from '#lib/types/inventory.js'
	import type { Loan, LoanDirection } from '#lib/types/loans.js'
	import { todayIsoDate } from '#lib/types/stockBatches.js'

	/**
	 * Add Entry and Edit Entry for medicine borrowed from or lent to another
	 * clinic. A record only: saving never changes stock. Hold a reference with
	 * `bind:this` and call `open(direction)` or `edit(loan)`.
	 */
	let editing = $state<Loan | null>(null)
	let isOpen = $state(false)
	let direction = $state<LoanDirection>('borrowed')
	let clinic = $state('')
	let itemId = $state<InventoryId | null>(null)
	let quantity = $state<number | ''>('')
	let loanedOn = $state('')
	let dateInvalid = $state(false)
	let remark = $state('')
	let openedWith = $state('')

	const snapshot = (): string =>
		JSON.stringify([direction, clinic, itemId, quantity, loanedOn, remark.trim()])
	const dirty = $derived(snapshot() !== openedWith)

	const item = $derived(itemId === null ? null : (inventoryStore.getItemById(itemId) ?? null))
	// An entry keeps the unit it was made in until its item is changed
	const unit = $derived(
		editing && itemId === editing.item_id ? editing.unit_label : (item?.unit_label ?? ''),
	)
	const returned = $derived(editing?.returned ?? 0)
	const belowReturned = $derived(quantity !== '' && Number(quantity) <= returned && returned > 0)

	const fill = (values: {
		direction: LoanDirection
		clinic: string
		itemId: InventoryId | null
		quantity: number | ''
		loanedOn: string
		remark: string
	}): void => {
		direction = values.direction
		clinic = values.clinic
		itemId = values.itemId
		quantity = values.quantity
		loanedOn = values.loanedOn
		remark = values.remark
		openedWith = snapshot()
		isOpen = true
	}

	export function open(start: LoanDirection): void {
		editing = null
		fill({
			direction: start,
			clinic: '',
			itemId: null,
			quantity: '',
			loanedOn: todayIsoDate(),
			remark: '',
		})
	}

	export function edit(loan: Loan): void {
		editing = loan
		fill({
			direction: loan.direction,
			clinic: loan.clinic,
			itemId: loan.item_id,
			quantity: loan.quantity,
			loanedOn: loan.loaned_on,
			remark: loan.remark,
		})
	}

	const close = (): void => {
		isOpen = false
		editing = null
	}

	const isValid = $derived(
		clinic.trim() !== '' &&
			item !== null &&
			Number.isInteger(Number(quantity)) &&
			Number(quantity) > 0 &&
			!belowReturned &&
			loanedOn !== '' &&
			!dateInvalid,
	)

	const confirm = async (): Promise<void> => {
		if (!isValid || !item) return
		const entry = {
			direction,
			clinic: clinic.trim(),
			item_id: item.id,
			quantity: Number(quantity),
			loaned_on: loanedOn,
			remark: remark.trim(),
		}
		if (editing) await loansStore.updateLoan(editing.id, entry)
		else await loansStore.addLoan(entry)
		if (!loansStore.error) {
			toast.success(
				editing
					? `Saved ${item.item_name}`
					: direction === 'borrowed'
						? `Borrowed ${entry.quantity} ${unit} of ${item.item_name} from ${entry.clinic}`
						: `Lent ${entry.quantity} ${unit} of ${item.item_name} to ${entry.clinic}`,
			)
			close()
		}
	}
</script>

<ActionModal
	bind:open={isOpen}
	title={editing ? 'Edit Entry' : 'Add Entry'}
	loading={loansStore.loading}
	{dirty}
	disabled={!isValid || (editing !== null && !dirty)}
	confirmText={editing ? 'Save' : 'Add'}
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
			<ToggleGroup.Root
				class="grid w-full auto-cols-fr grid-flow-col"
				type="single"
				variant="outline"
				bind:value={
					() => direction,
					(value) => {
						if (value === 'borrowed' || value === 'lent') direction = value
					}
				}
				aria-label="Which way the medicine went"
			>
				<!-- Filled when chosen: which way it went must never be in doubt -->
				<ToggleGroup.Item
					value="borrowed"
					class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:text-primary-foreground"
					>We borrowed</ToggleGroup.Item
				>
				<ToggleGroup.Item
					value="lent"
					class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:text-primary-foreground"
					>We lent</ToggleGroup.Item
				>
			</ToggleGroup.Root>
			<Field.Field>
				<Field.Label for="loan-clinic">Clinic</Field.Label>
				<Input
					id="loan-clinic"
					bind:value={() => clinic, (text) => (clinic = text.toUpperCase())}
					placeholder="e.g. KLINIK SETIA"
					autocomplete="off"
					required
				/>
			</Field.Field>
			<Field.Field>
				<Field.Label for="loan-item">Item</Field.Label>
				<ItemPicker id="loan-item" bind:value={itemId} items={inventoryStore.items} />
			</Field.Field>
			<div class="grid grid-cols-2 gap-4">
				<Field.Field data-invalid={belowReturned || undefined} data-disabled={!item || undefined}>
					<Field.Label for="loan-quantity">Quantity</Field.Label>
					<InputGroup.Root>
						<InputGroup.Input
							id="loan-quantity"
							bind:value={quantity}
							type="number"
							inputmode="numeric"
							min={Math.max(1, returned + 1)}
							step={1}
							disabled={!item}
							required
							aria-invalid={belowReturned || undefined}
							{@attach selectOnFocus()}
						/>
						<InputGroup.Addon align="inline-end">
							<InputGroup.Text class="tracking-wide">{unit}</InputGroup.Text>
						</InputGroup.Addon>
					</InputGroup.Root>
				</Field.Field>
				<Field.Field>
					<Field.Label for="loan-date"
						>{direction === 'borrowed' ? 'Borrowed on' : 'Lent on'}</Field.Label
					>
					<DateInput
						id="loan-date"
						label={direction === 'borrowed' ? 'Borrowed on' : 'Lent on'}
						bind:value={loanedOn}
						bind:invalid={dateInvalid}
					/>
				</Field.Field>
			</div>
			{#if belowReturned}
				<Field.Error>
					{returned}
					{unit} is already back, so the quantity must be more than {returned}.
				</Field.Error>
			{/if}
			<Field.Field>
				<Field.Label for="loan-remark">Remark</Field.Label>
				<Textarea
					id="loan-remark"
					bind:value={remark}
					rows={2}
					placeholder="e.g. supplier late, Dr Lim called them"
				/>
			</Field.Field>
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

<script lang="ts">
	import { toast } from 'svelte-sonner'
	import { selectOnFocus } from '#lib/attachments/focus.js'
	import ActionModal from '#lib/components/app/ActionModal.svelte'
	import DateInput from '#lib/components/app/DateInput.svelte'
	import DialogSubject from '#lib/components/app/DialogSubject.svelte'
	import Quantity from '#lib/components/app/Quantity.svelte'
	import * as Field from '#lib/components/ui/field/index.js'
	import * as InputGroup from '#lib/components/ui/input-group/index.js'
	import { loansStore } from '#lib/stores/loans.svelte.js'
	import type { Loan } from '#lib/types/loans.js'
	import { todayIsoDate } from '#lib/types/stockBatches.js'
	import { formatDate } from '#lib/utils/date.js'

	/**
	 * Some or all of a borrowed or lent entry came back. The quantity starts
	 * empty, as Mark Ordered does, so the number is typed rather than
	 * confirmed unread. Returning the rest settles the entry. Hold a reference
	 * with `bind:this` and call `open(loan)`.
	 */
	let loan = $state<Loan | null>(null)
	let isOpen = $state(false)
	let quantity = $state<number | ''>('')
	let returnedOn = $state('')
	let dateInvalid = $state(false)

	// The dialog keeps a snapshot; read the live entry so what is owed tracks the store
	const live = $derived(loan ? (loansStore.loans.find((l) => l.id === loan?.id) ?? loan) : null)
	const owed = $derived(live?.owed ?? 0)
	const unit = $derived(live?.unit_label ?? '')
	const facts = $derived.by((): Array<{ label: string; value: string }> =>
		live
			? [
					{ label: 'Clinic', value: live.clinic },
					{
						label: live.direction === 'borrowed' ? 'Borrowed on' : 'Lent on',
						value: formatDate(live.loaned_on),
					},
					{ label: 'Still owed', value: `${owed} ${unit}` },
				]
			: [],
	)

	export function open(target: Loan): void {
		loan = target
		quantity = ''
		returnedOn = todayIsoDate()
		isOpen = true
	}

	const close = (): void => {
		isOpen = false
		loan = null
	}

	const amount = $derived(Number(quantity) || 0)
	const overOwed = $derived(amount > owed)
	const isValid = $derived(
		Number.isInteger(amount) && amount > 0 && !overOwed && returnedOn !== '' && !dateInvalid,
	)
	const settles = $derived(isValid && amount === owed)

	const confirm = async (): Promise<void> => {
		if (!live || !isValid) return
		const target = live
		await loansStore.recordReturn(target.id, amount, returnedOn)
		if (!loansStore.error) {
			toast.success(
				settles
					? `Settled ${target.item_name} with ${target.clinic}`
					: `Saved ${amount} ${unit} of ${target.item_name} returned`,
			)
			close()
		}
	}
</script>

<ActionModal
	bind:open={isOpen}
	title="Returned"
	loading={loansStore.loading}
	dirty={quantity !== ''}
	disabled={!isValid}
	confirmText={settles ? 'Settle' : 'Save'}
	onconfirm={confirm}
	oncancel={close}
>
	{#if live}
		<DialogSubject name={live.item_name} {facts} />
	{/if}
	<form
		onsubmit={(e) => {
			e.preventDefault()
			confirm()
		}}
	>
		<Field.Group>
			<div class="grid grid-cols-2 gap-4">
				<Field.Field data-invalid={overOwed || undefined}>
					<Field.Label for="return-quantity">How many came back</Field.Label>
					<InputGroup.Root>
						<InputGroup.Input
							id="return-quantity"
							bind:value={quantity}
							type="number"
							inputmode="numeric"
							min={1}
							max={owed}
							step={1}
							required
							aria-invalid={overOwed || undefined}
							{@attach selectOnFocus()}
						/>
						<InputGroup.Addon align="inline-end">
							<InputGroup.Text class="tracking-wide">{unit}</InputGroup.Text>
						</InputGroup.Addon>
					</InputGroup.Root>
				</Field.Field>
				<Field.Field>
					<Field.Label for="return-date">Date</Field.Label>
					<DateInput
						id="return-date"
						label="Date returned"
						bind:value={returnedOn}
						bind:invalid={dateInvalid}
						min={live?.loaned_on}
					/>
				</Field.Field>
			</div>
			{#if overOwed}
				<Field.Error>Only {owed} {unit} is still owed.</Field.Error>
			{:else if settles}
				<Field.Description>That is all of it, so this settles the entry.</Field.Description>
			{:else if isValid}
				<Field.Description
					><Quantity value={owed - amount} {unit} /> still owed after this.</Field.Description
				>
			{/if}
			{#if live && live.returns.length > 0}
				<Field.Field>
					<Field.Label>Earlier returns</Field.Label>
					<ul class="divide-border bg-muted/40 divide-y rounded-2xl border text-sm">
						{#each live.returns as entry, index (index)}
							<li class="px-3 py-2 tabular-nums">
								{entry.quantity}
								{unit} on {formatDate(entry.returned_on)}
							</li>
						{/each}
					</ul>
				</Field.Field>
			{/if}
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

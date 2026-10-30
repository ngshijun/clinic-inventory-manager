<script lang="ts">
	import { toast } from 'svelte-sonner'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import DateInput from '$lib/components/app/DateInput.svelte'
	import DialogSubject from '$lib/components/app/DialogSubject.svelte'
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import { loansStore } from '$lib/stores/loans.svelte'
	import type { Loan } from '$lib/types/loans'
	import { todayIsoDate } from '$lib/types/stockBatches'

	/**
	 * Closes a borrowed or lent entry that was paid for or swapped rather than
	 * given back, with a short note saying how. Hold a reference with
	 * `bind:this` and call `open(loan)`.
	 */
	let loan = $state<Loan | null>(null)
	let isOpen = $state(false)
	let note = $state('')
	let settledOn = $state('')
	let dateInvalid = $state(false)

	const facts = $derived.by((): Array<{ label: string; value: string }> =>
		loan
			? [
					{ label: 'Clinic', value: loan.clinic },
					{ label: 'Still owed', value: `${loan.owed} ${loan.unit_label}` },
				]
			: [],
	)

	export function open(target: Loan): void {
		loan = target
		note = ''
		settledOn = todayIsoDate()
		isOpen = true
	}

	const close = (): void => {
		isOpen = false
		loan = null
	}

	const isValid = $derived(note.trim() !== '' && settledOn !== '' && !dateInvalid)

	const confirm = async (): Promise<void> => {
		if (!loan || !isValid) return
		const target = loan
		await loansStore.settleLoan(target.id, note.trim(), settledOn)
		if (!loansStore.error) {
			toast.success(`Settled ${target.item_name} with ${target.clinic}`)
			close()
		}
	}
</script>

<ActionModal
	bind:open={isOpen}
	title="Settle Another Way"
	loading={loansStore.loading}
	dirty={note.trim() !== ''}
	disabled={!isValid}
	confirmText="Settle"
	onconfirm={confirm}
	oncancel={close}
>
	{#if loan}
		<DialogSubject name={loan.item_name} {facts} />
	{/if}
	<form
		onsubmit={(e) => {
			e.preventDefault()
			confirm()
		}}
	>
		<Field.Group>
			<Field.Field>
				<Field.Label for="settle-note">How was it settled?</Field.Label>
				<Input
					id="settle-note"
					bind:value={note}
					autocomplete="off"
					placeholder="e.g. paid RM 24.00 cash"
					required
				/>
				<Field.Description>The entry moves to Settled with this note.</Field.Description>
			</Field.Field>
			<Field.Field>
				<Field.Label for="settle-date">Date</Field.Label>
				<DateInput
					id="settle-date"
					label="Date settled"
					bind:value={settledOn}
					bind:invalid={dateInvalid}
					min={loan?.loaned_on}
				/>
			</Field.Field>
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

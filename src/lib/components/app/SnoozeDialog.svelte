<script lang="ts">
	import { toast } from 'svelte-sonner'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import DialogSubject from '$lib/components/app/DialogSubject.svelte'
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import * as Select from '$lib/components/ui/select'
	import * as ToggleGroup from '$lib/components/ui/toggle-group'
	import { SNOOZE_CHIPS, SNOOZE_REASONS } from '$lib/constants/snoozeReasons'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import type { InventoryItem } from '$lib/types/inventory'
	import { todayIsoDate } from '$lib/types/stockBatches'
	import { formatDate } from '$lib/utils/date'
	import { addDays } from '../../../../convex/lib/orders'

	/**
	 * Puts an item aside until a date. The chips set the date in one click;
	 * the date field is there for a supplier's own promise. Shared by Price
	 * List and the Dashboard: `bind:this` and `open(item)`.
	 */
	const DEFAULT_DAYS = 14

	let item = $state<InventoryItem | null>(null)
	let isOpen = $state(false)
	let until = $state('')
	let reason = $state<string>(SNOOZE_REASONS[0])
	let openedWith = $state({ until: '', reason: '' })

	const today = $derived(todayIsoDate())
	const chip = $derived(
		String(SNOOZE_CHIPS.find((option) => addDays(today, option.days) === until)?.days ?? ''),
	)
	const dirty = $derived(until !== openedWith.until || reason !== openedWith.reason)
	const isValid = $derived(until > today && reason.length > 0)

	export function open(target: InventoryItem): void {
		item = target
		const current = target.order_status?.kind === 'snoozed' ? target.order_status : null
		until =
			current && current.until > todayIsoDate()
				? current.until
				: addDays(todayIsoDate(), DEFAULT_DAYS)
		reason = current?.reason ?? SNOOZE_REASONS[0]
		openedWith = { until, reason }
		isOpen = true
	}

	const close = (): void => {
		isOpen = false
		item = null
	}

	const confirm = async (): Promise<void> => {
		if (!item || !isValid) return
		const name = item.item_name
		await inventoryStore.snooze(item.id, until, reason)
		if (!inventoryStore.error) {
			toast.success(`Snoozed ${name} until ${formatDate(until)}`)
			close()
		}
	}
</script>

<ActionModal
	bind:open={isOpen}
	title="Snooze"
	loading={inventoryStore.loading}
	{dirty}
	disabled={!isValid}
	confirmText="Snooze"
	onconfirm={confirm}
	oncancel={close}
>
	{#if item}
		<DialogSubject
			name={item.item_name}
			facts={[
				{ label: 'In stock', value: `${item.quantity} ${item.unit}` },
				{ label: 'Reorder at', value: item.reorder_level < 0 ? '—' : String(item.reorder_level) },
			]}
		/>
	{/if}
	<form
		onsubmit={(e) => {
			e.preventDefault()
			confirm()
		}}
	>
		<Field.Group>
			<Field.Field>
				<Field.Label for="snooze-until">Show again on</Field.Label>
				<ToggleGroup.Root
					type="single"
					variant="outline"
					size="sm"
					value={chip}
					onValueChange={(value) => {
						if (value) until = addDays(today, Number(value))
					}}
					aria-label="How long to snooze"
				>
					{#each SNOOZE_CHIPS as option (option.days)}
						<ToggleGroup.Item value={String(option.days)}>{option.label}</ToggleGroup.Item>
					{/each}
				</ToggleGroup.Root>
				<Input id="snooze-until" bind:value={until} type="date" min={addDays(today, 1)} required />
				<Field.Description
					>Hidden from To Order until then. It comes back by itself.</Field.Description
				>
			</Field.Field>
			<Field.Field>
				<Field.Label for="snooze-reason">Reason</Field.Label>
				<Select.Root type="single" bind:value={reason}>
					<Select.Trigger id="snooze-reason" class="w-full">{reason}</Select.Trigger>
					<Select.Content>
						<Select.Group>
							{#each SNOOZE_REASONS as option (option)}
								<Select.Item value={option} label={option} />
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
			</Field.Field>
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

<script lang="ts">
	import { pricePerUnit } from '../../../../convex/lib/price'
	import type { UnitParts } from '../../../../convex/lib/units'
	import { selectOnFocus } from '$lib/attachments/focus'
	import * as Field from '$lib/components/ui/field'
	import * as InputGroup from '$lib/components/ui/input-group'
	import * as ToggleGroup from '$lib/components/ui/toggle-group'
	import { formatRM } from '$lib/utils/money'
	import { priceFormUnits, priceFormValue, type PriceForm } from '$lib/utils/price'

	/*
	 * What the item costs. She types a number for the unit she orders in,
	 * "Price per BOX". Where the contents are packs a supplier prices, such as
	 * the bottles in a bundle, two buttons above the field say which one the
	 * number is for. With `quantity`, one line underneath gives the order
	 * total: a total six times off tells her the wrong button is chosen.
	 * Empty means the price is not known. Shared by Mark as Ordered and the
	 * Price List pencil.
	 */
	let {
		value = $bindable(),
		parts,
		quantity,
		id,
	}: {
		value: PriceForm
		parts: UnitParts
		/** How many are being ordered, in the item's unit */
		quantity?: number
		id: string
	} = $props()

	const units = $derived(priceFormUnits(parts, value))
	const total = $derived.by((): number | null => {
		const price = priceFormValue(value)
		if (!price || !quantity || quantity <= 0) return null
		const each = pricePerUnit(parts, price)
		return each === null ? null : each * quantity
	})
</script>

<Field.Field>
	<Field.Label for={id}>{units.length > 1 ? 'Price' : `Price per ${parts.unit}`}</Field.Label>
	{#if units.length > 1}
		<ToggleGroup.Root
			class="grid w-full auto-cols-fr grid-flow-col"
			type="single"
			variant="outline"
			size="sm"
			value={value.unit}
			onValueChange={(unit) => {
				if (unit) value.unit = unit
			}}
			aria-label="What the price is for"
		>
			{#each units as unit (unit)}
				<!-- Filled when chosen: which unit the number is for must never be in doubt -->
				<ToggleGroup.Item
					value={unit}
					class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:text-primary-foreground"
					>Per {unit}</ToggleGroup.Item
				>
			{/each}
		</ToggleGroup.Root>
	{/if}
	<InputGroup.Root>
		<InputGroup.Addon>
			<InputGroup.Text>RM</InputGroup.Text>
		</InputGroup.Addon>
		<InputGroup.Input
			{id}
			bind:value={value.amount}
			type="number"
			inputmode="decimal"
			min={0.01}
			step={0.01}
			placeholder="0.00"
			{@attach selectOnFocus()}
		/>
	</InputGroup.Root>
	{#if total !== null}
		<Field.Description>
			{quantity}
			{parts.unit} comes to <span class="text-foreground font-medium">{formatRM(total)}</span>.
		</Field.Description>
	{:else if quantity !== undefined && priceFormValue(value) === null}
		<Field.Description>Leave empty if the price is not known yet.</Field.Description>
	{/if}
</Field.Field>

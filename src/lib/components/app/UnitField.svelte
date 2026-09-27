<script lang="ts">
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import * as Select from '$lib/components/ui/select'
	import { selectOnFocus } from '$lib/attachments/focus'
	import { unitsStore } from '$lib/stores/units.svelte'
	import type { UnitForm } from '$lib/utils/units'

	/*
	 * An item's unit, read left to right as a sentence: "BOX contains 30 TAB".
	 * Both units are picked from the Units list rather than typed, so one unit
	 * has one spelling and the number is always a number. Leaving the number
	 * empty means the unit holds nothing countable; the second unit is then
	 * switched off. Shared by Add Item and Edit Item.
	 */
	let { value = $bindable(), id }: { value: UnitForm; id: string } = $props()

	const hasContents = $derived(value.pack_size !== '' && value.pack_size !== null)
</script>

<Field.Field>
	<Field.Label for="{id}-unit">Unit</Field.Label>
	<div class="grid grid-cols-[minmax(0,1fr)_auto_5rem_minmax(0,1fr)] items-center gap-2">
		<Select.Root type="single" bind:value={value.unit}>
			<Select.Trigger id="{id}-unit" class="w-full tracking-wide">
				{#if value.unit}
					{value.unit}
				{:else}
					<span class="text-muted-foreground">Choose</span>
				{/if}
			</Select.Trigger>
			<Select.Content>
				<Select.Group>
					{#each unitsStore.names as name (name)}
						<Select.Item value={name} label={name} class="tracking-wide" />
					{/each}
				</Select.Group>
			</Select.Content>
		</Select.Root>
		<span class="text-muted-foreground text-sm">contains</span>
		<Input
			id="{id}-pack-size"
			bind:value={value.pack_size}
			type="number"
			inputmode="numeric"
			min={1}
			step={1}
			aria-label="How many the unit contains"
			{@attach selectOnFocus()}
		/>
		<Select.Root type="single" bind:value={value.pack_unit} disabled={!hasContents}>
			<Select.Trigger
				id="{id}-pack-unit"
				class="w-full tracking-wide"
				aria-label="What the unit contains"
			>
				{#if hasContents && value.pack_unit}
					{value.pack_unit}
				{:else}
					<span class="text-muted-foreground">Choose</span>
				{/if}
			</Select.Trigger>
			<Select.Content>
				<Select.Group>
					{#each unitsStore.names as name (name)}
						<Select.Item value={name} label={name} class="tracking-wide" />
					{/each}
				</Select.Group>
			</Select.Content>
		</Select.Root>
	</div>
</Field.Field>

<script lang="ts">
	import { tick } from 'svelte'
	import SearchIcon from '@lucide/svelte/icons/search'
	import XIcon from '@lucide/svelte/icons/x'
	import Quantity from '$lib/components/app/Quantity.svelte'
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import type { InventoryItem } from '$lib/types/inventory'
	import { cn } from '$lib/utils'
	import { capsClass } from '$lib/utils/text'

	/*
	 * One text field that finds and holds an item, after HealthOS's patient
	 * picker: type a few letters, matches appear beneath, a click or Return
	 * chooses one and the field then shows its name. Clearing the field clears
	 * the choice. Staff know this from every search box, which a list inside a
	 * dropdown is not.
	 */
	let {
		value = $bindable(null),
		items,
		id = 'item-picker',
		placeholder = 'Type to find an item',
		showOnHand = false,
		autofocus = false,
		onSelect,
	}: {
		value?: InventoryItem['id'] | null
		/** Already in the order the matches should keep */
		items: InventoryItem[]
		/** Id for the input so a label can target it */
		id?: string
		placeholder?: string
		/** Trail each match with its on-hand figure */
		showOnHand?: boolean
		autofocus?: boolean
		onSelect?: (item: InventoryItem) => void
	} = $props()

	const MAX_RESULTS = 8

	let text = $state('')
	let open = $state(false)
	let highlighted = $state(0)
	let inputRef = $state<HTMLInputElement | null>(null)

	const selected = $derived(
		value === null ? null : (items.find((item) => item.id === value) ?? null),
	)
	const query = $derived(text.trim().toLowerCase())
	const results = $derived(
		query.length === 0
			? []
			: items.filter((item) => item.item_name.toLowerCase().includes(query)).slice(0, MAX_RESULTS),
	)
	const showDropdown = $derived(open && selected === null && query.length > 0)
	const listId = $derived(`${id}-list`)

	function handleInput(event: Event) {
		text = (event.currentTarget as HTMLInputElement).value
		value = null
		open = true
		highlighted = 0
	}

	function choose(item: InventoryItem) {
		value = item.id
		text = ''
		open = false
		onSelect?.(item)
	}

	async function clear() {
		value = null
		text = ''
		open = false
		await tick()
		inputRef?.focus()
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!showDropdown || results.length === 0) {
			if (event.key === 'Escape' && open) {
				event.stopPropagation()
				open = false
			}
			return
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault()
			highlighted = (highlighted + 1) % results.length
		} else if (event.key === 'ArrowUp') {
			event.preventDefault()
			highlighted = (highlighted - 1 + results.length) % results.length
		} else if (event.key === 'Enter') {
			event.preventDefault()
			const hit = results[highlighted]
			if (hit) choose(hit)
		} else if (event.key === 'Escape') {
			// First Esc closes the list only; a second one reaches the dialog.
			event.preventDefault()
			event.stopPropagation()
			open = false
		}
	}

	function onBlur(event: FocusEvent) {
		// Keep the list open while focus moves onto one of its rows.
		const next = event.relatedTarget as HTMLElement | null
		if (next?.closest(`[data-picker="${id}"]`)) return
		open = false
	}
</script>

<div class="relative" data-picker={id}>
	{#if selected}
		<!-- The pick shows whole, wrapping if it must; a click anywhere on it starts a new search. -->
		<button
			type="button"
			{id}
			class="bg-input/50 focus-visible:border-ring focus-visible:ring-ring/30 flex min-h-9 w-full items-start gap-2 rounded-3xl border border-transparent px-3 py-2 text-start text-sm outline-none focus-visible:ring-3"
			aria-label={`${selected.item_name}. Change item`}
			onclick={clear}
		>
			<SearchIcon class="text-muted-foreground mt-0.5 size-4 shrink-0" />
			<span class={cn('min-w-0 flex-1 font-medium', capsClass(selected.item_name))}>
				{selected.item_name}
			</span>
			<XIcon class="text-muted-foreground mt-0.5 size-4 shrink-0" />
		</button>
	{:else}
		<div class="relative">
			<SearchIcon
				class="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
			/>
			<Input
				{id}
				bind:ref={inputRef}
				type="text"
				role="combobox"
				aria-expanded={showDropdown}
				aria-controls={listId}
				aria-autocomplete="list"
				autocomplete="off"
				{placeholder}
				{autofocus}
				value={text}
				class={cn('ps-9', text.length > 0 && 'pe-9')}
				oninput={handleInput}
				onfocus={() => (open = true)}
				onblur={onBlur}
				onkeydown={handleKeydown}
			/>
			{#if text.length > 0}
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					class="absolute end-0.5 top-1/2 -translate-y-1/2"
					aria-label="Clear search"
					onmousedown={(event) => event.preventDefault()}
					onclick={clear}
				>
					<XIcon />
				</Button>
			{/if}
		</div>
	{/if}

	{#if showDropdown}
		<div
			id={listId}
			role="listbox"
			class="bg-popover text-popover-foreground absolute inset-x-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl border p-1 shadow-lg"
		>
			{#if results.length === 0}
				<p class="text-muted-foreground px-3 py-2 text-sm">No item matches “{text.trim()}”.</p>
			{:else}
				{#each results as item, index (item.id)}
					{@const active = index === highlighted}
					<button
						type="button"
						tabindex="-1"
						role="option"
						aria-selected={active}
						class={cn(
							'flex w-full items-start gap-3 rounded-xl px-3 py-2 text-start text-sm font-medium',
							active && 'bg-muted',
						)}
						onmousedown={(event) => event.preventDefault()}
						onmouseenter={() => (highlighted = index)}
						onclick={() => choose(item)}
					>
						<span class={cn('min-w-0 flex-1', capsClass(item.item_name))}>{item.item_name}</span>
						{#if showOnHand}
							<Quantity
								value={item.quantity}
								unit={item.unit}
								pack={false}
								class="shrink-0 text-xs"
								valueClass={cn(item.quantity === 0 && 'text-destructive')}
							/>
						{/if}
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>

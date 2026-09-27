<script lang="ts">
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import { suppliersStore } from '$lib/stores/suppliers.svelte'
	import { cn } from '$lib/utils'
	import { capsClass } from '$lib/utils/text'

	/*
	 * Who the item is bought from. A text field that suggests the Suppliers
	 * list as the name is typed, the way the item search does. Only a supplier
	 * on the list can be saved, so half a name never becomes a supplier: the
	 * form reads the choice with `suppliersStore.nameOf` and holds Save while
	 * it is null. New suppliers are added on the Suppliers page. Empty means
	 * no supplier. Shared by Add Item, Edit Item and Edit Price Details.
	 */
	let { value = $bindable(''), id }: { value?: string; id: string } = $props()

	const MAX_RESULTS = 8

	let open = $state(false)
	let highlighted = $state(-1)

	const query = $derived(value.trim().toLowerCase())
	const results = $derived(
		suppliersStore.names
			.filter((name) => name.toLowerCase().includes(query) && name !== value.trim())
			.slice(0, MAX_RESULTS),
	)
	const showList = $derived(open && results.length > 0)
	const notOnList = $derived(suppliersStore.nameOf(value) === null)
	const listId = $derived(`${id}-list`)

	function choose(name: string) {
		value = name
		open = false
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!showList) return
		if (event.key === 'ArrowDown') {
			event.preventDefault()
			highlighted = (highlighted + 1) % results.length
		} else if (event.key === 'ArrowUp') {
			event.preventDefault()
			highlighted = (highlighted - 1 + results.length) % results.length
		} else if (event.key === 'Enter') {
			// Return with nothing highlighted keeps the typed name and saves the form
			const hit = results[highlighted]
			if (!hit) return
			event.preventDefault()
			choose(hit)
		} else if (event.key === 'Escape') {
			// First Esc closes the list only; a second one reaches the dialog
			event.preventDefault()
			event.stopPropagation()
			open = false
		}
	}

	function onBlur(event: FocusEvent) {
		// Keep the list open while focus moves onto one of its rows
		const next = event.relatedTarget as HTMLElement | null
		if (next?.closest(`[data-picker="${id}"]`)) return
		open = false
	}
</script>

<Field.Field data-invalid={(notOnList && !open) || undefined}>
	<Field.Label for={id}>Supplier</Field.Label>
	<div class="relative" data-picker={id}>
		<Input
			{id}
			bind:value
			type="text"
			role="combobox"
			aria-expanded={showList}
			aria-controls={listId}
			aria-autocomplete="list"
			aria-invalid={(notOnList && !open) || undefined}
			autocomplete="off"
			placeholder="Who it is bought from"
			class={capsClass(value)}
			oninput={() => {
				open = true
				highlighted = -1
			}}
			onfocus={() => (open = true)}
			onblur={onBlur}
			onkeydown={handleKeydown}
		/>
		{#if showList}
			<div
				id={listId}
				role="listbox"
				class="bg-popover text-popover-foreground absolute inset-x-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl border p-1 shadow-lg"
			>
				{#each results as name, index (name)}
					{@const active = index === highlighted}
					<button
						type="button"
						tabindex="-1"
						role="option"
						aria-selected={active}
						class={cn(
							'flex w-full rounded-xl px-3 py-2 text-start text-sm font-medium',
							active && 'bg-muted',
							capsClass(name),
						)}
						onmousedown={(event) => event.preventDefault()}
						onmouseenter={() => (highlighted = index)}
						onclick={() => choose(name)}
					>
						{name}
					</button>
				{/each}
			</div>
		{/if}
	</div>
	{#if notOnList && !showList}
		<Field.Error>
			{value.trim()} is not on the Suppliers list. Choose a supplier from the list, or add it on the Suppliers
			page first.
		</Field.Error>
	{/if}
</Field.Field>

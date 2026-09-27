<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
	import * as Command from '$lib/components/ui/command'
	import * as Field from '$lib/components/ui/field'
	import * as Popover from '$lib/components/ui/popover'
	import { suppliersStore } from '$lib/stores/suppliers.svelte'

	/*
	 * Who the item is bought from, picked from the Suppliers list. The same
	 * dropdown as the Supplier filter: it opens with a search field on top,
	 * typing a few letters narrows the list and Return takes the first match.
	 * It holds a supplier on the list or nothing, so half a name can never be
	 * saved. New suppliers are added on the Suppliers page. Empty means no
	 * supplier. Shared by Add Item, Edit Item and Edit Price Details.
	 */
	let { value = $bindable(''), id }: { value?: string; id: string } = $props()

	let open = $state(false)

	const choose = (name: string): void => {
		value = name
		open = false
	}
</script>

<Field.Field>
	<Field.Label for={id}>Supplier</Field.Label>
	<Popover.Root bind:open>
		<Popover.Trigger>
			{#snippet child({ props })}
				<button
					{...props}
					{id}
					type="button"
					role="combobox"
					aria-expanded={open}
					class="bg-input/50 focus-visible:border-ring focus-visible:ring-ring/30 flex h-9 w-full items-center justify-between gap-1.5 rounded-3xl border border-transparent px-3 py-2 text-sm whitespace-nowrap outline-none focus-visible:ring-3"
				>
					{#if value}
						<span class="truncate tracking-wide">{value}</span>
					{:else}
						<span class="text-muted-foreground">No Supplier</span>
					{/if}
					<ChevronDownIcon class="text-muted-foreground size-4 shrink-0" />
				</button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content align="start" class="w-(--bits-popover-anchor-width) p-0">
			<Command.Root>
				<Command.Input placeholder="Type to find a supplier" />
				<Command.List>
					<Command.Empty>
						No supplier matches. New suppliers are added on the Suppliers page.
					</Command.Empty>
					<Command.Group>
						<Command.Item
							value="No Supplier"
							data-checked={value === ''}
							onSelect={() => choose('')}
						>
							No Supplier
						</Command.Item>
					</Command.Group>
					{#if suppliersStore.names.length > 0}
						<Command.Separator />
						<Command.Group>
							{#each suppliersStore.names as name (name)}
								<Command.Item
									value={name}
									data-checked={value === name}
									class="tracking-wide"
									onSelect={() => choose(name)}
								>
									<span class="truncate">{name}</span>
								</Command.Item>
							{/each}
						</Command.Group>
					{/if}
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
</Field.Field>

<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
	import * as Command from '#lib/components/ui/command/index.js'
	import * as Field from '#lib/components/ui/field/index.js'
	import * as Popover from '#lib/components/ui/popover/index.js'
	import { clinicsStore } from '#lib/stores/clinics.svelte.js'

	/*
	 * Which clinic the medicine was borrowed from or lent to, picked from the
	 * Clinics list. The Supplier field's dropdown: a search field on top,
	 * typing narrows the list and Return takes the first match. Every entry
	 * names a clinic, so there is no empty choice. New clinics are added on
	 * the Clinics page.
	 */
	let { value = $bindable(''), id }: { value?: string; id: string } = $props()

	let open = $state(false)

	const choose = (name: string): void => {
		value = name
		open = false
	}
</script>

<Field.Field>
	<Field.Label for={id}>Clinic</Field.Label>
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
						<span class="text-muted-foreground">Choose a clinic</span>
					{/if}
					<ChevronDownIcon class="text-muted-foreground size-4 shrink-0" />
				</button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content align="start" class="w-(--bits-popover-anchor-width) p-0">
			<Command.Root>
				<Command.Input placeholder="Type to find a clinic" />
				<Command.List>
					<Command.Empty
						>No clinic matches. New clinics are added on the Clinics page.</Command.Empty
					>
					<Command.Group>
						{#each clinicsStore.names as name (name)}
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
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
	{#if !clinicsStore.loading && clinicsStore.names.length === 0}
		<Field.Description>
			No clinics yet. Add them on the <a href="/borrow-lend/clinics" class="underline">Clinics</a> page.
		</Field.Description>
	{/if}
</Field.Field>

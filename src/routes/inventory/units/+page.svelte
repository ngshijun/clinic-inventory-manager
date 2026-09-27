<script lang="ts">
	import { tick } from 'svelte'
	import { toast } from 'svelte-sonner'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import RulerIcon from '@lucide/svelte/icons/ruler'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import DialogSubject from '$lib/components/app/DialogSubject.svelte'
	import PageHeader from '$lib/components/app/PageHeader.svelte'
	import { Button } from '$lib/components/ui/button'
	import * as Empty from '$lib/components/ui/empty'
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import { Switch } from '$lib/components/ui/switch'
	import * as Table from '$lib/components/ui/table'
	import { useErrorToast } from '$lib/composables/errorToast.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { unitsStore } from '$lib/stores/units.svelte'
	import type { Unit } from '$lib/types/units'
	import { UNIT_NAME_PATTERN } from '../../../../convex/lib/units'

	/*
	 * The list the Unit field in Add Item and Edit Item picks from, opened from
	 * Inventory's More menu. A rename
	 * reaches every item that uses the unit; renaming to a name already on the
	 * list combines the two, which is how BOTTLE and BTL become one.
	 *
	 * The switch says whether suppliers quote a price for the unit. BTL is on:
	 * a box of bottles may be priced per BOX or per BTL, so the Price field
	 * offers both. TAB is off: it is an amount inside a pack, and the Price
	 * field never offers "Per TAB".
	 */
	useErrorToast(() => unitsStore.error)

	const plural = (count: number, noun: string): string =>
		`${count} ${count === 1 ? noun : `${noun}s`}`

	/** Unit name -> how many items use it, as the unit or as its contents */
	const usage = $derived.by((): Map<string, number> => {
		const counts = new Map<string, number>()
		for (const item of inventoryStore.items) {
			const names = new Set([item.unit, item.pack_unit])
			for (const name of names) {
				if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
			}
		}
		return counts
	})
	const usedBy = (name: string): number => usage.get(name) ?? 0

	// A unit is one word in capitals, so the field keeps only letters
	const clean = (text: string): string => text.toUpperCase().replace(/[^A-Z]/g, '')

	// ---------- Add unit ----------
	let showAdd = $state(false)
	let addName = $state('')
	let addPriced = $state(true)
	let addInput = $state<HTMLInputElement | null>(null)
	const addExists = $derived(unitsStore.names.includes(addName))
	const isAddValid = $derived(UNIT_NAME_PATTERN.test(addName) && !addExists)

	const openAdd = async (): Promise<void> => {
		addName = ''
		addPriced = true
		showAdd = true
		await tick()
		addInput?.focus()
	}

	const confirmAdd = async (): Promise<void> => {
		if (!isAddValid) return
		const name = addName
		await unitsStore.addUnit(name, !addPriced)
		if (!unitsStore.error) {
			toast.success(`Added ${name}`)
			showAdd = false
		}
	}

	// ---------- Rename or combine ----------
	let showRename = $state(false)
	let renaming = $state<Unit | null>(null)
	let newName = $state('')
	let renameInput = $state<HTMLInputElement | null>(null)
	const isRenamed = $derived(renaming !== null && newName !== renaming.name)
	const combines = $derived(isRenamed && unitsStore.names.includes(newName))
	const isRenameValid = $derived(isRenamed && UNIT_NAME_PATTERN.test(newName))

	const openRename = async (unit: Unit): Promise<void> => {
		renaming = unit
		newName = unit.name
		showRename = true
		await tick()
		renameInput?.select()
	}

	const closeRename = (): void => {
		showRename = false
		renaming = null
	}

	const confirmRename = async (): Promise<void> => {
		if (!renaming || !isRenameValid) return
		const from = renaming.name
		const to = newName
		const result = await unitsStore.renameUnit(renaming.id, to)
		if (!result) return
		const changed = result.items > 0 ? `${plural(result.items, 'item')} updated` : undefined
		toast.success(result.combined ? `Combined ${from} into ${to}` : `Renamed ${from} to ${to}`, {
			description: changed,
		})
		closeRename()
	}

	// ---------- Delete ----------
	let showDelete = $state(false)
	let deleting = $state<Unit | null>(null)

	const openDelete = (unit: Unit): void => {
		deleting = unit
		showDelete = true
	}

	const closeDelete = (): void => {
		showDelete = false
		deleting = null
	}

	const confirmDelete = async (): Promise<void> => {
		if (!deleting) return
		const name = deleting.name
		await unitsStore.deleteUnit(deleting.id)
		if (!unitsStore.error) {
			toast.success(`Deleted ${name}`)
			closeDelete()
		}
	}

	const initialLoading = $derived(unitsStore.loading && unitsStore.units.length === 0)
</script>

<PageHeader title="Units" crumbs={[{ label: 'Inventory', href: '/inventory' }]}>
	<Button onclick={openAdd}>
		<PlusIcon data-icon="inline-start" />
		Add Unit…
	</Button>
</PageHeader>

{#if initialLoading}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Unit</Table.Head>
				<Table.Head>Used by</Table.Head>
				<Table.Head>Suppliers price by this unit</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each { length: 8 } as _, i (i)}
				<Table.Row>
					<Table.Cell><Skeleton class="h-4 w-20" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
					<Table.Cell><Skeleton class="h-5 w-11 rounded-full" /></Table.Cell>
					<Table.Cell><Skeleton class="ms-auto h-7 w-24" /></Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{:else if unitsStore.units.length === 0}
	<Empty.Root class="my-auto">
		<Empty.Header>
			<Empty.Media variant="icon">
				<RulerIcon />
			</Empty.Media>
			<Empty.Title>No units yet</Empty.Title>
			<Empty.Description>Add the units items are counted in, such as BOX and TAB.</Empty.Description
			>
		</Empty.Header>
		<Empty.Content>
			<Button onclick={openAdd}>
				<PlusIcon data-icon="inline-start" />
				Add Unit…
			</Button>
		</Empty.Content>
	</Empty.Root>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Unit</Table.Head>
				<Table.Head>Used by</Table.Head>
				<Table.Head>Suppliers price by this unit</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each unitsStore.units as unit (unit.id)}
				{@const count = usedBy(unit.name)}
				<Table.Row>
					<Table.Cell class="font-medium tracking-wide">{unit.name}</Table.Cell>
					<Table.Cell class="tabular-nums">
						{#if count > 0}
							<!-- Opens Inventory held to the items that use this unit -->
							<Button
								variant="link"
								size="sm"
								class="h-auto p-0 text-sm"
								href={`/inventory?unit=${encodeURIComponent(unit.name)}`}
							>
								{plural(count, 'item')}
							</Button>
						{:else}
							<span class="text-muted-foreground">No items</span>
						{/if}
					</Table.Cell>
					<Table.Cell>
						<Switch
							checked={!unit.measure}
							disabled={unitsStore.loading}
							onCheckedChange={(priced) => unitsStore.setMeasure(unit.id, !priced)}
							aria-label="Suppliers price by {unit.name}"
						/>
					</Table.Cell>
					<Table.Cell>
						<div class="flex justify-end gap-1">
							<Button
								variant="outline"
								size="sm"
								disabled={unitsStore.loading}
								onclick={() => openRename(unit)}
							>
								Rename…
							</Button>
							<!-- Only a unit nothing uses can go; one in use is combined into another instead -->
							{#if count === 0}
								<Button
									variant="destructive"
									size="sm"
									disabled={unitsStore.loading}
									onclick={() => openDelete(unit)}
								>
									Delete…
								</Button>
							{/if}
						</div>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
	<div class="text-muted-foreground text-sm">{plural(unitsStore.units.length, 'unit')}</div>
{/if}

<!-- Add Unit -->
<ActionModal
	bind:open={showAdd}
	title="Add Unit"
	loading={unitsStore.loading}
	disabled={!isAddValid}
	dirty={addName !== ''}
	confirmText="Add Unit"
	onconfirm={confirmAdd}
	oncancel={() => (showAdd = false)}
>
	<form
		onsubmit={(e) => {
			e.preventDefault()
			confirmAdd()
		}}
	>
		<Field.Group>
			<Field.Field data-invalid={addExists || undefined}>
				<Field.Label for="unit-add-name">Name</Field.Label>
				<Input
					id="unit-add-name"
					bind:ref={addInput}
					bind:value={() => addName, (text) => (addName = clean(text))}
					class="tracking-wide placeholder:tracking-normal"
					maxlength={12}
					autocomplete="off"
					placeholder="e.g. CARTON"
					aria-invalid={addExists || undefined}
					required
				/>
				{#if addExists}
					<Field.Error>{addName} is already in the list.</Field.Error>
				{/if}
			</Field.Field>
			<Field.Field orientation="horizontal">
				<Field.Content>
					<Field.Label for="unit-add-priced">Suppliers price by this unit</Field.Label>
					<Field.Description>
						On for a pack such as BOX or BTL. Off for an amount inside a pack, such as TAB or ML.
					</Field.Description>
				</Field.Content>
				<Switch id="unit-add-priced" bind:checked={addPriced} />
			</Field.Field>
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

<!-- Rename, or combine with a unit already in the list -->
<ActionModal
	bind:open={showRename}
	title={combines ? 'Combine Units' : 'Rename Unit'}
	loading={unitsStore.loading}
	disabled={!isRenameValid}
	dirty={isRenamed}
	confirmText={combines ? 'Combine' : 'Rename'}
	onconfirm={confirmRename}
	oncancel={closeRename}
>
	{#if renaming}
		{@const count = usedBy(renaming.name)}
		<DialogSubject
			name={renaming.name}
			facts={[{ label: 'Used by', value: count > 0 ? plural(count, 'item') : 'no items' }]}
		/>
		<form
			onsubmit={(e) => {
				e.preventDefault()
				confirmRename()
			}}
		>
			<Field.Group>
				<Field.Field>
					<Field.Label for="unit-rename-name">New name</Field.Label>
					<Input
						id="unit-rename-name"
						bind:ref={renameInput}
						bind:value={() => newName, (text) => (newName = clean(text))}
						class="tracking-wide placeholder:tracking-normal"
						maxlength={12}
						autocomplete="off"
						required
					/>
					{#if combines}
						<Field.Description>
							{newName} is already in the list, so the two become one.
							{#if count > 0}
								{plural(count, 'item')} will change from {renaming.name} to {newName}.
							{/if}
							{renaming.name} leaves the list.
						</Field.Description>
					{:else if isRenameValid && count > 0}
						<Field.Description>
							{plural(count, 'item')} will change from {renaming.name} to {newName}.
						</Field.Description>
					{/if}
				</Field.Field>
			</Field.Group>
			<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
		</form>
	{/if}
</ActionModal>

<!-- Delete -->
<ActionModal
	bind:open={showDelete}
	title="Delete Unit"
	description={deleting ? `${deleting.name} leaves the list. No item uses it.` : undefined}
	loading={unitsStore.loading}
	confirmText="Delete"
	onconfirm={confirmDelete}
	oncancel={closeDelete}
/>

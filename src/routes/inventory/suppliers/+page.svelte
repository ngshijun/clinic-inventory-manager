<script lang="ts">
	import { tick } from 'svelte'
	import { toast } from 'svelte-sonner'
	import Building2Icon from '@lucide/svelte/icons/building-2'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import DialogSubject from '$lib/components/app/DialogSubject.svelte'
	import PageHeader from '$lib/components/app/PageHeader.svelte'
	import { Button } from '$lib/components/ui/button'
	import * as Empty from '$lib/components/ui/empty'
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import * as Table from '$lib/components/ui/table'
	import { useErrorToast } from '$lib/composables/errorToast.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { suppliersStore } from '$lib/stores/suppliers.svelte'
	import type { Supplier } from '$lib/types/suppliers'
	import { supplierCounts } from '$lib/utils/supplier'
	import { cn } from '$lib/utils'
	import { capsClass } from '$lib/utils/text'

	/*
	 * The list the Supplier field in Add Item and Edit Item suggests from,
	 * opened from Inventory's More menu. A rename reaches every item that uses
	 * the supplier; renaming to a name already on the list, in any letter case,
	 * combines the two under that supplier's spelling.
	 */
	useErrorToast(() => suppliersStore.error)

	const plural = (count: number, noun: string): string =>
		`${count} ${count === 1 ? noun : `${noun}s`}`

	/** Supplier name -> how many items are bought from it */
	const usage = $derived(
		new Map(supplierCounts(inventoryStore.items).map(({ name, count }) => [name, count])),
	)
	const usedBy = (name: string): number => usage.get(name) ?? 0

	/** The supplier on the list with this name in any letter case, other than `except` */
	const findSupplier = (name: string, except?: Supplier | null): Supplier | null =>
		suppliersStore.suppliers.find(
			(supplier) =>
				supplier.id !== except?.id && supplier.name.toLowerCase() === name.toLowerCase(),
		) ?? null

	// ---------- Add supplier ----------
	let showAdd = $state(false)
	let addName = $state('')
	let addInput = $state<HTMLInputElement | null>(null)
	const addTyped = $derived(addName.trim())
	const addExisting = $derived(findSupplier(addTyped))
	const isAddValid = $derived(addTyped !== '' && addExisting === null)

	const openAdd = async (): Promise<void> => {
		addName = ''
		showAdd = true
		await tick()
		addInput?.focus()
	}

	const confirmAdd = async (): Promise<void> => {
		if (!isAddValid) return
		const name = addTyped
		await suppliersStore.addSupplier(name)
		if (!suppliersStore.error) {
			toast.success(`Added ${name}`)
			showAdd = false
		}
	}

	// ---------- Rename or combine ----------
	let showRename = $state(false)
	let renaming = $state<Supplier | null>(null)
	let newName = $state('')
	let renameInput = $state<HTMLInputElement | null>(null)
	const typed = $derived(newName.trim())
	const isRenameValid = $derived(renaming !== null && typed !== '' && typed !== renaming.name)
	const target = $derived(isRenameValid ? findSupplier(typed, renaming) : null)
	const combines = $derived(target !== null)
	// Combining keeps the spelling already on the list
	const finalName = $derived(target?.name ?? typed)

	const openRename = async (supplier: Supplier): Promise<void> => {
		renaming = supplier
		newName = supplier.name
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
		const result = await suppliersStore.renameSupplier(renaming.id, typed)
		if (!result) return
		const to = result.name
		const changed = result.items > 0 ? `${plural(result.items, 'item')} updated` : undefined
		toast.success(result.combined ? `Combined ${from} into ${to}` : `Renamed ${from} to ${to}`, {
			description: changed,
		})
		closeRename()
	}

	// ---------- Delete ----------
	let showDelete = $state(false)
	let deleting = $state<Supplier | null>(null)

	const openDelete = (supplier: Supplier): void => {
		deleting = supplier
		showDelete = true
	}

	const closeDelete = (): void => {
		showDelete = false
		deleting = null
	}

	const confirmDelete = async (): Promise<void> => {
		if (!deleting) return
		const name = deleting.name
		await suppliersStore.deleteSupplier(deleting.id)
		if (!suppliersStore.error) {
			toast.success(`Deleted ${name}`)
			closeDelete()
		}
	}

	const initialLoading = $derived(suppliersStore.loading && suppliersStore.suppliers.length === 0)
</script>

<PageHeader title="Suppliers" crumbs={[{ label: 'Inventory', href: '/inventory' }]}>
	<Button onclick={openAdd}>
		<PlusIcon data-icon="inline-start" />
		Add Supplier…
	</Button>
</PageHeader>

{#if initialLoading}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Supplier</Table.Head>
				<Table.Head>Used by</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each { length: 8 } as _, i (i)}
				<Table.Row>
					<Table.Cell><Skeleton class="h-4 w-32" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
					<Table.Cell><Skeleton class="ms-auto h-7 w-24" /></Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{:else if suppliersStore.suppliers.length === 0}
	<Empty.Root class="my-auto">
		<Empty.Header>
			<Empty.Media variant="icon">
				<Building2Icon />
			</Empty.Media>
			<Empty.Title>No suppliers yet</Empty.Title>
			<Empty.Description>Add the suppliers the clinic buys its items from.</Empty.Description>
		</Empty.Header>
		<Empty.Content>
			<Button onclick={openAdd}>
				<PlusIcon data-icon="inline-start" />
				Add Supplier…
			</Button>
		</Empty.Content>
	</Empty.Root>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Supplier</Table.Head>
				<Table.Head>Used by</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each suppliersStore.suppliers as supplier (supplier.id)}
				{@const count = usedBy(supplier.name)}
				<Table.Row>
					<Table.Cell class={cn('font-medium', capsClass(supplier.name))}
						>{supplier.name}</Table.Cell
					>
					<Table.Cell class="tabular-nums">
						{#if count > 0}
							{plural(count, 'item')}
						{:else}
							<span class="text-muted-foreground">No items</span>
						{/if}
					</Table.Cell>
					<Table.Cell>
						<div class="flex justify-end gap-1">
							<Button
								variant="outline"
								size="sm"
								disabled={suppliersStore.loading}
								onclick={() => openRename(supplier)}
							>
								Rename…
							</Button>
							<!-- Only a supplier no item uses can go; one in use is combined into another instead -->
							{#if count === 0}
								<Button
									variant="outline"
									size="sm"
									disabled={suppliersStore.loading}
									onclick={() => openDelete(supplier)}
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
	<div class="text-muted-foreground text-sm">
		{plural(suppliersStore.suppliers.length, 'supplier')}
	</div>
{/if}

<!-- Add Supplier -->
<ActionModal
	bind:open={showAdd}
	title="Add Supplier"
	loading={suppliersStore.loading}
	disabled={!isAddValid}
	dirty={addName !== ''}
	confirmText="Add Supplier"
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
			<Field.Field data-invalid={addExisting !== null || undefined}>
				<Field.Label for="supplier-add-name">Name</Field.Label>
				<Input
					id="supplier-add-name"
					bind:ref={addInput}
					bind:value={addName}
					class={capsClass(addName)}
					autocomplete="off"
					placeholder="e.g. PHARMANIAGA"
					aria-invalid={addExisting !== null || undefined}
					required
				/>
				{#if addExisting}
					<Field.Error>{addExisting.name} is already in the list.</Field.Error>
				{/if}
			</Field.Field>
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

<!-- Rename, or combine with a supplier already in the list -->
<ActionModal
	bind:open={showRename}
	title={combines ? 'Combine Suppliers' : 'Rename Supplier'}
	loading={suppliersStore.loading}
	disabled={!isRenameValid}
	dirty={isRenameValid}
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
					<Field.Label for="supplier-rename-name">New name</Field.Label>
					<Input
						id="supplier-rename-name"
						bind:ref={renameInput}
						bind:value={newName}
						class={capsClass(newName)}
						autocomplete="off"
						required
					/>
					{#if combines}
						<Field.Description>
							{finalName} is already in the list, so the two become one.
							{#if count > 0}
								{plural(count, 'item')} will change from {renaming.name} to {finalName}.
							{/if}
							{renaming.name} leaves the list.
						</Field.Description>
					{:else if isRenameValid && count > 0}
						<Field.Description>
							{plural(count, 'item')} will change from {renaming.name} to {finalName}.
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
	title="Delete Supplier"
	description={deleting ? `${deleting.name} leaves the list. No item uses it.` : undefined}
	loading={suppliersStore.loading}
	confirmText="Delete"
	onconfirm={confirmDelete}
	oncancel={closeDelete}
/>

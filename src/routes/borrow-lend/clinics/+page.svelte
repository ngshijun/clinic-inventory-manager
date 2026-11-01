<script lang="ts">
	import { tick } from 'svelte'
	import { toast } from 'svelte-sonner'
	import Building2Icon from '@lucide/svelte/icons/building-2'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import ActionModal from '#lib/components/app/ActionModal.svelte'
	import DialogSubject from '#lib/components/app/DialogSubject.svelte'
	import PageHeader from '#lib/components/app/PageHeader.svelte'
	import { Button } from '#lib/components/ui/button/index.js'
	import * as Empty from '#lib/components/ui/empty/index.js'
	import * as Field from '#lib/components/ui/field/index.js'
	import { Input } from '#lib/components/ui/input/index.js'
	import { Skeleton } from '#lib/components/ui/skeleton/index.js'
	import * as Table from '#lib/components/ui/table/index.js'
	import { useErrorToast } from '#lib/composables/errorToast.svelte.js'
	import { clinicsStore } from '#lib/stores/clinics.svelte.js'
	import { loansStore } from '#lib/stores/loans.svelte.js'
	import type { Clinic } from '#lib/types/loans.js'

	/*
	 * The clinics medicine is borrowed from and lent to, opened from Borrow &
	 * Lend's More menu. It works as the Suppliers page does: a rename reaches
	 * every entry that names the clinic, renaming to a name already on the
	 * list combines the two, and only a clinic no entry names can be deleted.
	 * Names are kept in capitals, so the fields raise the letters as typed.
	 */
	useErrorToast(clinicsStore)

	const plural = (count: number): string => `${count} ${count === 1 ? 'entry' : 'entries'}`

	/** Clinic name -> how many entries name it */
	const usage = $derived.by(() => {
		const counts = new Map<string, number>()
		for (const loan of loansStore.loans) counts.set(loan.clinic, (counts.get(loan.clinic) ?? 0) + 1)
		return counts
	})
	const usedBy = (name: string): number => usage.get(name) ?? 0

	/** The clinic on the list with this name, other than `except` */
	const findClinic = (name: string, except?: Clinic | null): Clinic | null =>
		clinicsStore.clinics.find((clinic) => clinic.id !== except?.id && clinic.name === name) ?? null

	// ---------- Add clinic ----------
	let showAdd = $state(false)
	let addName = $state('')
	let addInput = $state<HTMLInputElement | null>(null)
	const addTyped = $derived(addName.trim())
	const addExisting = $derived(findClinic(addTyped))
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
		await clinicsStore.addClinic(name)
		if (!clinicsStore.error) {
			toast.success(`Added ${name}`)
			showAdd = false
		}
	}

	// ---------- Rename or combine ----------
	let showRename = $state(false)
	let renaming = $state<Clinic | null>(null)
	let newName = $state('')
	let renameInput = $state<HTMLInputElement | null>(null)
	const typed = $derived(newName.trim())
	const isRenameValid = $derived(renaming !== null && typed !== '' && typed !== renaming.name)
	const target = $derived(isRenameValid ? findClinic(typed, renaming) : null)
	const combines = $derived(target !== null)
	// Combining keeps the spelling already on the list
	const finalName = $derived(target?.name ?? typed)

	const openRename = async (clinic: Clinic): Promise<void> => {
		renaming = clinic
		newName = clinic.name
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
		const result = await clinicsStore.renameClinic(renaming.id, typed)
		if (!result) return
		const changed = result.entries > 0 ? `${plural(result.entries)} updated` : undefined
		toast.success(
			result.combined
				? `Combined ${from} into ${result.name}`
				: `Renamed ${from} to ${result.name}`,
			{ description: changed },
		)
		closeRename()
	}

	// ---------- Delete ----------
	let showDelete = $state(false)
	let deleting = $state<Clinic | null>(null)

	const openDelete = (clinic: Clinic): void => {
		deleting = clinic
		showDelete = true
	}

	const closeDelete = (): void => {
		showDelete = false
		deleting = null
	}

	const confirmDelete = async (): Promise<void> => {
		if (!deleting) return
		const name = deleting.name
		await clinicsStore.deleteClinic(deleting.id)
		if (!clinicsStore.error) {
			toast.success(`Deleted ${name}`)
			closeDelete()
		}
	}

	const initialLoading = $derived(clinicsStore.loading && clinicsStore.clinics.length === 0)
</script>

<PageHeader title="Clinics" crumbs={[{ label: 'Borrow & Lend', href: '/borrow-lend' }]}>
	<Button onclick={openAdd}>
		<PlusIcon data-icon="inline-start" />
		Add Clinic…
	</Button>
</PageHeader>

{#if initialLoading}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Clinic</Table.Head>
				<Table.Head>Used by</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each { length: 4 } as _, i (i)}
				<Table.Row>
					<Table.Cell><Skeleton class="h-4 w-32" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
					<Table.Cell><Skeleton class="ms-auto h-7 w-24" /></Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{:else if clinicsStore.clinics.length === 0}
	<Empty.Root class="my-auto">
		<Empty.Header>
			<Empty.Media variant="icon">
				<Building2Icon />
			</Empty.Media>
			<Empty.Title>No clinics yet</Empty.Title>
			<Empty.Description>Add the clinics medicine is borrowed from or lent to.</Empty.Description>
		</Empty.Header>
		<Empty.Content>
			<Button onclick={openAdd}>
				<PlusIcon data-icon="inline-start" />
				Add Clinic…
			</Button>
		</Empty.Content>
	</Empty.Root>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Clinic</Table.Head>
				<Table.Head>Used by</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each clinicsStore.clinics as clinic (clinic.id)}
				{@const count = usedBy(clinic.name)}
				<Table.Row>
					<Table.Cell class="font-medium tracking-wide">{clinic.name}</Table.Cell>
					<Table.Cell class="tabular-nums">
						{#if count > 0}
							{plural(count)}
						{:else}
							<span class="text-muted-foreground">No entries</span>
						{/if}
					</Table.Cell>
					<Table.Cell>
						<div class="flex justify-end gap-1">
							<Button
								variant="outline"
								size="sm"
								disabled={clinicsStore.loading}
								onclick={() => openRename(clinic)}
							>
								Rename…
							</Button>
							<!-- Only a clinic no entry names can go; one in use is combined into another instead -->
							{#if count === 0}
								<Button
									variant="destructive"
									size="sm"
									disabled={clinicsStore.loading}
									onclick={() => openDelete(clinic)}
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
		{clinicsStore.clinics.length}
		{clinicsStore.clinics.length === 1 ? 'clinic' : 'clinics'}
	</div>
{/if}

<!-- Add Clinic -->
<ActionModal
	bind:open={showAdd}
	title="Add Clinic"
	loading={clinicsStore.loading}
	disabled={!isAddValid}
	dirty={addName !== ''}
	confirmText="Add Clinic"
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
				<Field.Label for="clinic-add-name">Name</Field.Label>
				<Input
					id="clinic-add-name"
					bind:ref={addInput}
					bind:value={() => addName, (text) => (addName = text.toUpperCase())}
					class="tracking-wide placeholder:tracking-normal"
					autocomplete="off"
					placeholder="e.g. KLINIK SETIA"
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

<!-- Rename, or combine with a clinic already in the list -->
<ActionModal
	bind:open={showRename}
	title={combines ? 'Combine Clinics' : 'Rename Clinic'}
	loading={clinicsStore.loading}
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
			facts={[{ label: 'Used by', value: count > 0 ? plural(count) : 'no entries' }]}
		/>
		<form
			onsubmit={(e) => {
				e.preventDefault()
				confirmRename()
			}}
		>
			<Field.Group>
				<Field.Field>
					<Field.Label for="clinic-rename-name">New name</Field.Label>
					<Input
						id="clinic-rename-name"
						bind:ref={renameInput}
						bind:value={() => newName, (text) => (newName = text.toUpperCase())}
						class="tracking-wide placeholder:tracking-normal"
						autocomplete="off"
						required
					/>
					{#if combines}
						<Field.Description>
							{finalName} is already in the list, so the two become one.
							{#if count > 0}
								{plural(count)} will change from {renaming.name} to {finalName}.
							{/if}
							{renaming.name} leaves the list.
						</Field.Description>
					{:else if isRenameValid && count > 0}
						<Field.Description>
							{plural(count)} will change from {renaming.name} to {finalName}.
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
	title="Delete Clinic"
	description={deleting ? `${deleting.name} leaves the list. No entry names it.` : undefined}
	loading={clinicsStore.loading}
	confirmText="Delete"
	onconfirm={confirmDelete}
	oncancel={closeDelete}
/>

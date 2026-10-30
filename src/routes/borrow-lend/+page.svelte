<script lang="ts">
	import { untrack } from 'svelte'
	import { goto } from '$app/navigation'
	import { toast } from 'svelte-sonner'
	import Building2Icon from '@lucide/svelte/icons/building-2'
	import HandshakeIcon from '@lucide/svelte/icons/handshake'
	import HandCoinsIcon from '@lucide/svelte/icons/hand-coins'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import SearchIcon from '@lucide/svelte/icons/search'
	import Trash2Icon from '@lucide/svelte/icons/trash-2'
	import XIcon from '@lucide/svelte/icons/x'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import CountBadge from '$lib/components/app/CountBadge.svelte'
	import LoanDialog from '$lib/components/app/LoanDialog.svelte'
	import MoreMenuTrigger from '$lib/components/app/MoreMenuTrigger.svelte'
	import PageHeader from '$lib/components/app/PageHeader.svelte'
	import Quantity from '$lib/components/app/Quantity.svelte'
	import ReturnDialog from '$lib/components/app/ReturnDialog.svelte'
	import SettleDialog from '$lib/components/app/SettleDialog.svelte'
	import { Button } from '$lib/components/ui/button'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import * as Empty from '$lib/components/ui/empty'
	import * as InputGroup from '$lib/components/ui/input-group'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import * as Table from '$lib/components/ui/table'
	import * as Tabs from '$lib/components/ui/tabs'
	import { useErrorToast } from '$lib/composables/errorToast.svelte'
	import { createLoadMore } from '$lib/composables/loadMore.svelte'
	import { loansStore } from '$lib/stores/loans.svelte'
	import type { Loan } from '$lib/types/loans'
	import { daysSince, formatDate, formatDuration } from '$lib/utils/date'

	/*
	 * Medicine borrowed from and lent to other clinics: what the clinic has to
	 * give back, what it is owed, and what is settled. A record only; stock
	 * counts are never touched. The open tabs list the oldest first, since
	 * that is the one to chase.
	 */
	useErrorToast(loansStore)

	type Tab = 'owe' | 'owed' | 'settled'
	const isTab = (value: string): value is Tab =>
		value === 'owe' || value === 'owed' || value === 'settled'

	let tab = $state<Tab>('owe')
	let searchQuery = $state('')

	const open = $derived(loansStore.loans.filter((loan) => loan.settled_on === undefined))
	const owe = $derived(open.filter((loan) => loan.direction === 'borrowed'))
	const owed = $derived(open.filter((loan) => loan.direction === 'lent'))

	const byOldest = (a: Loan, b: Loan): number =>
		a.loaned_on.localeCompare(b.loaned_on) || a._creationTime - b._creationTime

	const rows = $derived.by((): Loan[] => {
		const query = searchQuery.trim().toLowerCase()
		const matches = (loan: Loan): boolean =>
			query === '' ||
			loan.item_name.toLowerCase().includes(query) ||
			loan.clinic.toLowerCase().includes(query)
		if (tab === 'owe') return owe.filter(matches).sort(byOldest)
		if (tab === 'owed') return owed.filter(matches).sort(byOldest)
		return loansStore.loans
			.filter((loan) => loan.settled_on !== undefined && matches(loan))
			.sort((a, b) => (b.settled_on ?? '').localeCompare(a.settled_on ?? ''))
	})

	const list = createLoadMore(() => rows)

	// A new tab or search starts the list from the top again
	$effect(() => {
		void tab
		void searchQuery
		untrack(() => list.reset())
	})

	const plural = (count: number, noun: string, many = `${noun}s`): string =>
		`${count} ${count === 1 ? noun : many}`

	const ago = (date: string): string => {
		const days = daysSince(date)
		if (days === 0) return 'today'
		if (days === 1) return 'yesterday'
		return `${formatDuration(days)} ago`
	}

	// ---------- Dialogs ----------
	let loanDialog = $state<LoanDialog | null>(null)
	let returnDialog = $state<ReturnDialog | null>(null)
	let settleDialog = $state<SettleDialog | null>(null)

	// The tab says which way the new entry most likely went
	const addEntry = (): void => loanDialog?.open(tab === 'owed' ? 'lent' : 'borrowed')

	let showDelete = $state(false)
	let deleting = $state<Loan | null>(null)

	const openDelete = (loan: Loan): void => {
		deleting = loan
		showDelete = true
	}

	const closeDelete = (): void => {
		showDelete = false
		deleting = null
	}

	const confirmDelete = async (): Promise<void> => {
		if (!deleting) return
		const name = deleting.item_name
		await loansStore.deleteLoan(deleting.id)
		if (!loansStore.error) {
			toast.success(`Deleted ${name}`)
			closeDelete()
		}
	}

	const initialLoading = $derived(loansStore.loading && loansStore.loans.length === 0)

	const EMPTY: Record<Tab, { title: string; description: string }> = {
		owe: {
			title: 'Nothing to give back',
			description: 'Medicine borrowed from another clinic appears here until it is returned.',
		},
		owed: {
			title: 'Nobody owes the clinic',
			description: 'Medicine lent to another clinic appears here until it comes back.',
		},
		settled: {
			title: 'Nothing settled yet',
			description: 'Entries move here once they are returned or settled another way.',
		},
	}
</script>

<Tabs.Root
	value={tab}
	onValueChange={(value) => {
		if (isTab(value)) tab = value
	}}
	class="flex-1 gap-4"
>
	<PageHeader title="Borrow & Lend">
		<div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
			<InputGroup.Root class="w-full sm:w-96">
				<InputGroup.Addon>
					<SearchIcon />
				</InputGroup.Addon>
				<InputGroup.Input
					bind:value={searchQuery}
					type="search"
					placeholder="Search by item or clinic"
					aria-label="Search by item or clinic"
				/>
				{#if searchQuery}
					<InputGroup.Addon align="inline-end">
						<InputGroup.Button
							size="icon-sm"
							aria-label="Clear search"
							onclick={() => (searchQuery = '')}
						>
							<XIcon />
						</InputGroup.Button>
					</InputGroup.Addon>
				{/if}
			</InputGroup.Root>
			<Tabs.List aria-label="Which entries to show" class="grid auto-cols-fr grid-flow-col">
				<Tabs.Trigger value="owe">
					We Owe
					{#if owe.length > 0}<CountBadge count={owe.length} />{/if}
				</Tabs.Trigger>
				<Tabs.Trigger value="owed">
					Owed to Us
					{#if owed.length > 0}<CountBadge count={owed.length} />{/if}
				</Tabs.Trigger>
				<Tabs.Trigger value="settled">Settled</Tabs.Trigger>
			</Tabs.List>
		</div>
		<DropdownMenu.Root>
			<MoreMenuTrigger />
			<DropdownMenu.Content align="end">
				<DropdownMenu.Item onclick={() => goto('/borrow-lend/clinics')}>
					<Building2Icon />
					Clinics
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
		<Button onclick={addEntry}>
			<PlusIcon data-icon="inline-start" />
			Add Entry…
		</Button>
	</PageHeader>

	<Tabs.Content value={tab} class="flex flex-1 flex-col gap-4">
		{#if initialLoading}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Clinic</Table.Head>
						<Table.Head>Item</Table.Head>
						<Table.Head>Quantity</Table.Head>
						<Table.Head>Date</Table.Head>
						<Table.Head>Remark</Table.Head>
						<Table.Head><span class="sr-only">Actions</span></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each { length: 6 } as _, i (i)}
						<Table.Row>
							<Table.Cell><Skeleton class="h-4 w-32" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-48" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-20" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-28" /></Table.Cell>
							<Table.Cell><Skeleton class="h-4 w-32" /></Table.Cell>
							<Table.Cell><Skeleton class="ms-auto h-7 w-28" /></Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{:else if rows.length === 0}
			<Empty.Root class="my-auto">
				<Empty.Header>
					<Empty.Media variant="icon">
						<HandshakeIcon />
					</Empty.Media>
					<Empty.Title>{searchQuery ? 'No entries match' : EMPTY[tab].title}</Empty.Title>
					<Empty.Description>
						{searchQuery ? 'Try another search or clear it.' : EMPTY[tab].description}
					</Empty.Description>
				</Empty.Header>
				<Empty.Content>
					{#if searchQuery}
						<Button variant="outline" onclick={() => (searchQuery = '')}>Clear Search</Button>
					{:else if tab !== 'settled'}
						<Button variant="outline" onclick={addEntry}>Add Entry…</Button>
					{/if}
				</Empty.Content>
			</Empty.Root>
		{:else}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Clinic</Table.Head>
						<Table.Head>Item</Table.Head>
						<Table.Head>Quantity</Table.Head>
						{#if tab === 'settled'}
							<Table.Head>Borrowed or lent</Table.Head>
							<Table.Head>Settled</Table.Head>
							<Table.Head class="w-[20%]">How</Table.Head>
						{:else}
							<Table.Head>{tab === 'owe' ? 'Borrowed on' : 'Lent on'}</Table.Head>
							<Table.Head class="w-[24%]">Remark</Table.Head>
						{/if}
						<Table.Head><span class="sr-only">Actions</span></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each list.visible as loan (loan.id)}
						<Table.Row>
							<Table.Cell class="tracking-wide">{loan.clinic}</Table.Cell>
							<Table.Cell class="font-medium tracking-wide">{loan.item_name}</Table.Cell>
							<Table.Cell>
								<Quantity value={loan.quantity} unit={loan.unit_label} />
								{#if tab !== 'settled' && loan.returned > 0}
									<span class="text-warning ms-1 text-xs">
										{loan.returned} returned, {loan.owed} to go
									</span>
								{/if}
							</Table.Cell>
							{#if tab === 'settled'}
								<Table.Cell class="tabular-nums">
									{loan.direction === 'borrowed' ? 'Borrowed' : 'Lent'}
									{formatDate(loan.loaned_on)}
								</Table.Cell>
								<Table.Cell class="tabular-nums">{formatDate(loan.settled_on)}</Table.Cell>
								<Table.Cell class="max-w-0">
									<div class="text-foreground/80 truncate" title={loan.settled_note ?? 'Returned'}>
										{loan.settled_note ?? 'Returned'}
									</div>
								</Table.Cell>
							{:else}
								<Table.Cell class="tabular-nums">
									{formatDate(loan.loaned_on)}
									<span class="text-muted-foreground ms-1 text-xs">{ago(loan.loaned_on)}</span>
								</Table.Cell>
								<Table.Cell class="max-w-0">
									{#if loan.remark}
										<div class="text-foreground/80 truncate" title={loan.remark}>
											{loan.remark}
										</div>
									{:else}
										<span class="text-muted-foreground">—</span>
									{/if}
								</Table.Cell>
							{/if}
							<Table.Cell>
								<div class="flex justify-end gap-1">
									{#if tab !== 'settled'}
										<Button
											variant="outline"
											size="sm"
											disabled={loansStore.loading}
											onclick={() => returnDialog?.open(loan)}
										>
											Returned…
										</Button>
									{/if}
									<DropdownMenu.Root>
										<MoreMenuTrigger size="icon-sm" />
										<DropdownMenu.Content align="end" class="min-w-56">
											{#if tab !== 'settled'}
												<DropdownMenu.Group>
													<DropdownMenu.Item onclick={() => settleDialog?.open(loan)}>
														<HandCoinsIcon />
														Settle Another Way…
													</DropdownMenu.Item>
													<DropdownMenu.Item onclick={() => loanDialog?.edit(loan)}>
														<PencilIcon />
														Edit…
													</DropdownMenu.Item>
												</DropdownMenu.Group>
												<DropdownMenu.Separator />
											{/if}
											<DropdownMenu.Item variant="destructive" onclick={() => openDelete(loan)}>
												<Trash2Icon />
												Delete…
											</DropdownMenu.Item>
										</DropdownMenu.Content>
									</DropdownMenu.Root>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
			<div class="text-muted-foreground flex items-center justify-between gap-3 text-sm">
				<span>Showing {list.shown} of {plural(list.total, 'entry', 'entries')}</span>
				{#if list.hasMore}
					<Button variant="outline" onclick={list.loadMore}>Load More</Button>
				{/if}
			</div>
		{/if}
	</Tabs.Content>
</Tabs.Root>

<LoanDialog bind:this={loanDialog} />
<ReturnDialog bind:this={returnDialog} />
<SettleDialog bind:this={settleDialog} />

<ActionModal
	bind:open={showDelete}
	title="Delete Entry"
	description={deleting
		? `The entry for ${deleting.quantity} ${deleting.unit_label} of ${deleting.item_name} ${deleting.direction === 'borrowed' ? 'from' : 'to'} ${deleting.clinic} is deleted. Stock is not changed. This cannot be undone.`
		: undefined}
	loading={loansStore.loading}
	confirmText="Delete"
	onconfirm={confirmDelete}
	oncancel={closeDelete}
/>

<script lang="ts">
	import { untrack } from 'svelte'
	import { toast } from 'svelte-sonner'
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
	import ClipboardCheckIcon from '@lucide/svelte/icons/clipboard-check'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import SearchIcon from '@lucide/svelte/icons/search'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import XIcon from '@lucide/svelte/icons/x'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import EditRequestDialog from '$lib/components/app/EditRequestDialog.svelte'
	import PageHeader from '$lib/components/app/PageHeader.svelte'
	import RequestDayFilter from '$lib/components/app/RequestDayFilter.svelte'
	import SortHeader from '$lib/components/app/SortHeader.svelte'
	import type { SortState } from '$lib/components/app/sort'
	import ToneBadge from '$lib/components/app/ToneBadge.svelte'
	import * as Alert from '$lib/components/ui/alert'
	import { Button } from '$lib/components/ui/button'
	import * as Card from '$lib/components/ui/card'
	import { Checkbox } from '$lib/components/ui/checkbox'
	import * as Empty from '$lib/components/ui/empty'
	import * as Field from '$lib/components/ui/field'
	import * as InputGroup from '$lib/components/ui/input-group'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import * as Table from '$lib/components/ui/table'
	import { Textarea } from '$lib/components/ui/textarea'
	import * as Tooltip from '$lib/components/ui/tooltip'
	import { useErrorToast } from '$lib/composables/errorToast.svelte'
	import { createLoadMore } from '$lib/composables/loadMore.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockRequestsStore } from '$lib/stores/stockRequests.svelte'
	import { todayIsoDate } from '$lib/types/stockBatches'
	import type { StockRequest, StockRequestId } from '$lib/types/stockRequests'
	import { formatDate, formatDayMonth, formatTime } from '$lib/utils/date'
	import {
		STATUS_RANK,
		STATUS_TONE,
		isOlderPending,
		localDateKey,
		matchesDay,
		matchesSearch,
		withUnit,
		type DayMode,
	} from '$lib/utils/requests'
	import { cn } from '$lib/utils'

	// ---------- Toolbar state ----------
	type SortKey = 'item_name' | 'quantity' | 'status'

	let searchQuery = $state('')
	let searchInput = $state<HTMLInputElement | null>(null)
	let dayMode = $state<DayMode>('today')
	let dayDate = $state(todayIsoDate())
	let sort = $state<SortState<SortKey>>({ key: null, direction: 'asc' })

	useErrorToast(() => stockRequestsStore.error)
	useErrorToast(() => inventoryStore.error)

	const requests = $derived(stockRequestsStore.requests)

	// ---------- Headline strip ----------
	const todayKey = $derived(todayIsoDate())
	const pendingToday = $derived(
		requests.filter((r) => r.status === 'Pending' && localDateKey(r.created_at) === todayKey),
	)
	const olderPending = $derived(requests.filter(isOlderPending))
	const oldestPending = $derived.by((): StockRequest | null =>
		olderPending.reduce<StockRequest | null>(
			(oldest, r) => (oldest === null || r._creationTime < oldest._creationTime ? r : oldest),
			null,
		),
	)
	const decidedToday = (status: 'Approved' | 'Rejected'): number =>
		requests.filter((r) => r.status === status && localDateKey(r.updated_at) === todayKey).length
	const approvedToday = $derived(decidedToday('Approved'))
	const rejectedToday = $derived(decidedToday('Rejected'))

	// ---------- Rows ----------
	const onHand = (request: StockRequest): number =>
		inventoryStore.getItemById(request.item_id)?.quantity ?? 0

	const hasEnoughStock = (request: StockRequest): boolean => onHand(request) >= request.quantity

	const plural = (count: number, noun: string): string =>
		`${count} ${count === 1 ? noun : `${noun}s`}`

	/** "Requested today, 14:05" or "Requested 22 Sep, 16:20" */
	const requestedLabel = (request: StockRequest): string => {
		const day =
			localDateKey(request.created_at) === todayKey ? 'today' : formatDayMonth(request.created_at)
		return `Requested ${day}, ${formatTime(request.created_at)}`
	}

	const sortedRequests = $derived.by((): StockRequest[] => {
		const rows = requests.filter(
			(r) => matchesSearch(r, searchQuery) && matchesDay(r, dayMode, dayDate),
		)
		const key = sort.key
		if (!key) return rows
		const dir = sort.direction === 'asc' ? 1 : -1
		return [...rows].sort((a, b) => {
			if (key === 'item_name') {
				return dir * a.item_name.toLowerCase().localeCompare(b.item_name.toLowerCase())
			}
			if (key === 'quantity') return dir * (a.quantity - b.quantity)
			return dir * (STATUS_RANK[a.status] - STATUS_RANK[b.status])
		})
	})

	const list = createLoadMore(() => sortedRequests)

	const toggleSort = (key: SortKey): void => {
		if (sort.key === key) {
			sort.direction = sort.direction === 'asc' ? 'desc' : 'asc'
		} else {
			sort = { key, direction: 'asc' }
		}
	}

	// A new search, day or sort starts the list from the top again
	$effect(() => {
		void searchQuery
		void dayMode
		void dayDate
		void sort.key
		void sort.direction
		untrack(() => list.reset())
	})

	const isFiltered = $derived(searchQuery !== '' || dayMode !== 'today')
	const clearFilters = (): void => {
		searchQuery = ''
		dayMode = 'today'
		dayDate = todayIsoDate()
	}

	// ⌥⌘F focuses the search field
	const onKeydown = (event: KeyboardEvent): void => {
		if (event.metaKey && event.altKey && event.code === 'KeyF') {
			event.preventDefault()
			searchInput?.focus()
			searchInput?.select()
		}
	}

	const initialLoading = $derived(stockRequestsStore.loading && requests.length === 0)

	// ---------- Selection ----------
	let selectedIds = $state<StockRequestId[]>([])

	// Selection only ever holds pending rows; a decision elsewhere drops the row
	const selected = $derived(
		selectedIds
			.map((id) => requests.find((r) => r.id === id))
			.filter((r): r is StockRequest => r !== undefined && r.status === 'Pending'),
	)
	const visiblePendingIds = $derived(
		list.visible.filter((r) => r.status === 'Pending').map((r) => r.id),
	)
	const allVisibleSelected = $derived(
		visiblePendingIds.length > 0 && visiblePendingIds.every((id) => selectedIds.includes(id)),
	)
	const someVisibleSelected = $derived(
		!allVisibleSelected && visiblePendingIds.some((id) => selectedIds.includes(id)),
	)

	const isSelected = (id: StockRequestId): boolean => selectedIds.includes(id)

	const toggleSelected = (id: StockRequestId, checked: boolean): void => {
		if (checked) {
			if (!selectedIds.includes(id)) selectedIds = [...selectedIds, id]
		} else {
			selectedIds = selectedIds.filter((other) => other !== id)
		}
	}

	const toggleAllVisible = (checked: boolean): void => {
		if (checked) {
			selectedIds = [...new Set([...selectedIds, ...visiblePendingIds])]
		} else {
			selectedIds = selectedIds.filter((id) => !visiblePendingIds.includes(id))
		}
	}

	const clearSelection = (): void => {
		selectedIds = []
	}

	// ---------- Approve ----------
	const approveOne = async (request: StockRequest): Promise<void> => {
		await stockRequestsStore.approveRequest(request.id)
		if (!stockRequestsStore.error) {
			toast.success(`Approved ${withUnit(request.quantity, request.unit)} of ${request.item_name}`)
			toggleSelected(request.id, false)
		}
	}

	let showBulkApprove = $state(false)
	const approvable = $derived(selected.filter(hasEnoughStock))
	const skipped = $derived(selected.filter((r) => !hasEnoughStock(r)))

	const confirmBulkApprove = async (): Promise<void> => {
		const targets = [...approvable]
		let approved = 0
		for (const request of targets) {
			await stockRequestsStore.approveRequest(request.id)
			if (stockRequestsStore.error) break
			approved++
		}
		showBulkApprove = false
		if (approved > 0) toast.success(`Approved ${plural(approved, 'request')}`)
		selectedIds = selectedIds.filter((id) => !targets.some((r) => r.id === id))
	}

	// ---------- Reject ----------
	let showReject = $state(false)
	let rejectTargets = $state<StockRequest[]>([])
	let rejectReason = $state('')

	const openReject = (targets: StockRequest[]): void => {
		rejectTargets = targets
		rejectReason = ''
		showReject = true
	}

	const closeReject = (): void => {
		showReject = false
		rejectTargets = []
	}

	const confirmReject = async (): Promise<void> => {
		const targets = [...rejectTargets]
		const reason = rejectReason.trim()
		let rejected = 0
		for (const request of targets) {
			await stockRequestsStore.rejectRequest(request.id, reason)
			if (stockRequestsStore.error) break
			rejected++
		}
		closeReject()
		if (rejected === 1 && targets.length === 1) {
			toast.success(`Rejected the request for ${targets[0].item_name}`)
		} else if (rejected > 0) {
			toast.success(`Rejected ${plural(rejected, 'request')}`)
		}
		selectedIds = selectedIds.filter((id) => !targets.some((r) => r.id === id))
	}

	const rejectTitle = $derived(
		rejectTargets.length === 1
			? `Reject “${rejectTargets[0].item_name}”?`
			: `Reject ${plural(rejectTargets.length, 'Request')}?`,
	)

	// ---------- Edit ----------
	let editDialog = $state<EditRequestDialog | null>(null)
</script>

<svelte:window onkeydown={onKeydown} />

<PageHeader title="Stock Approvals">
	<div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
		<InputGroup.Root class="w-full sm:w-72">
			<InputGroup.Addon>
				<SearchIcon />
			</InputGroup.Addon>
			<InputGroup.Input
				bind:ref={searchInput}
				bind:value={searchQuery}
				type="search"
				placeholder="Search by item or remark"
				aria-label="Search by item or remark"
			/>
			{#if searchQuery}
				<InputGroup.Addon align="inline-end">
					<InputGroup.Button
						size="icon-xs"
						aria-label="Clear search"
						onclick={() => (searchQuery = '')}
					>
						<XIcon />
					</InputGroup.Button>
				</InputGroup.Addon>
			{/if}
		</InputGroup.Root>
		<RequestDayFilter
			bind:mode={dayMode}
			bind:date={dayDate}
			olderPendingCount={olderPending.length}
		/>
	</div>
</PageHeader>

<!-- Headline strip -->
<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
	{@render stat(
		'Pending today',
		pendingToday.length,
		'Requested since midnight',
		pendingToday.length > 0 ? 'warning' : null,
	)}
	{@render stat(
		'Older pending',
		olderPending.length,
		oldestPending ? `Oldest from ${formatDate(oldestPending.created_at)}` : 'None waiting',
		olderPending.length > 0 ? 'danger' : null,
	)}
	{@render stat('Approved today', approvedToday, 'Stock already deducted', null)}
	{@render stat(
		'Rejected today',
		rejectedToday,
		rejectedToday > 0 ? 'Stock stays put' : 'Nothing turned down',
		null,
	)}
</div>

{#snippet stat(label: string, value: number, sub: string, tone: 'warning' | 'danger' | null)}
	<Card.Root
		size="sm"
		class={cn(
			'gap-1',
			tone === 'warning' && 'bg-warning-soft ring-warning/30',
			tone === 'danger' && 'bg-destructive/10 ring-destructive/30',
		)}
	>
		<Card.Content class="flex flex-col gap-0.5">
			<span class="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</span>
			<span
				class={cn(
					'text-2xl font-semibold tabular-nums',
					tone === 'warning' && 'text-warning',
					tone === 'danger' && 'text-destructive',
					tone === null && value === 0 && 'text-muted-foreground',
				)}
			>
				{value}
			</span>
			<span class="text-muted-foreground text-xs">{sub}</span>
		</Card.Content>
	</Card.Root>
{/snippet}

{#if selected.length > 0}
	<Alert.Root class="bg-primary/5 border-primary/30 flex flex-wrap items-center gap-x-3 gap-y-2">
		<CircleCheckIcon class="text-primary" />
		<Alert.Description class="text-foreground">
			<span class="font-medium">{plural(selected.length, 'request')} selected.</span>
			Approving deducts stock now; requests without enough stock are skipped.
		</Alert.Description>
		<div class="ms-auto flex items-center gap-1.5">
			<Button variant="ghost" size="sm" onclick={clearSelection}>Clear</Button>
			<Button variant="destructive" size="sm" onclick={() => openReject(selected)}>Reject…</Button>
			<Button size="sm" onclick={() => (showBulkApprove = true)}>Approve…</Button>
		</div>
	</Alert.Root>
{/if}

{#if initialLoading}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head class="w-9"></Table.Head>
				<Table.Head>Item</Table.Head>
				<Table.Head>Quantity</Table.Head>
				<Table.Head>On hand</Table.Head>
				<Table.Head>Remark</Table.Head>
				<Table.Head>Status</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each { length: 6 } as _, i (i)}
				<Table.Row>
					<Table.Cell class="py-3"><Skeleton class="size-4 rounded-[4px]" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-44" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-16" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-16" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-40" /></Table.Cell>
					<Table.Cell><Skeleton class="h-5 w-16 rounded-full" /></Table.Cell>
					<Table.Cell><Skeleton class="ms-auto h-7 w-36" /></Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{:else if sortedRequests.length === 0}
	<Empty.Root class="my-auto">
		<Empty.Header>
			<Empty.Media variant="icon">
				<ClipboardCheckIcon />
			</Empty.Media>
			<Empty.Title>
				{#if searchQuery}
					No requests match
				{:else if dayMode === 'older'}
					Nothing older is waiting
				{:else if dayMode === 'date'}
					No requests on {formatDate(dayDate)}
				{:else}
					No requests today
				{/if}
			</Empty.Title>
			<Empty.Description>
				{#if searchQuery}
					Try another search or clear the filter.
				{:else if dayMode === 'today'}
					Requests made today appear here as they arrive.
				{:else}
					Pick another day, or go back to today.
				{/if}
			</Empty.Description>
		</Empty.Header>
		{#if isFiltered}
			<Empty.Content>
				<Button variant="outline" onclick={clearFilters}>Show Today</Button>
			</Empty.Content>
		{/if}
	</Empty.Root>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head class="w-9 pe-0">
					<Checkbox
						checked={allVisibleSelected}
						indeterminate={someVisibleSelected}
						disabled={visiblePendingIds.length === 0}
						aria-label="Select all pending requests"
						onCheckedChange={(checked) => toggleAllVisible(checked === true)}
					/>
				</Table.Head>
				<SortHeader key="item_name" {sort} onsort={toggleSort}>Item</SortHeader>
				<SortHeader key="quantity" {sort} onsort={toggleSort}>Quantity</SortHeader>
				<Table.Head>On hand</Table.Head>
				<Table.Head class="w-[30%]">Remark</Table.Head>
				<SortHeader key="status" {sort} onsort={toggleSort}>Status</SortHeader>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each list.visible as request (request.id)}
				{@const pending = request.status === 'Pending'}
				{@const stock = onHand(request)}
				{@const short = pending && stock < request.quantity}
				{@const checked = isSelected(request.id)}
				<Table.Row
					data-state={checked ? 'selected' : undefined}
					class={cn(short && 'shadow-[inset_2px_0_0_var(--destructive)]')}
				>
					<Table.Cell class="py-2.5 pe-0">
						{#if pending}
							<Checkbox
								{checked}
								aria-label={`Select ${request.item_name}`}
								onCheckedChange={(value) => toggleSelected(request.id, value === true)}
							/>
						{/if}
					</Table.Cell>
					<Table.Cell class="max-w-md min-w-48 py-2.5 whitespace-normal">
						<div class="font-medium break-words">{request.item_name}</div>
						<div class="text-muted-foreground mt-0.5 text-xs">{requestedLabel(request)}</div>
					</Table.Cell>
					<Table.Cell class={cn('py-2.5 tabular-nums', pending && 'font-semibold')}>
						{withUnit(request.quantity, request.unit)}
					</Table.Cell>
					<Table.Cell class="py-2.5 tabular-nums">
						{#if short}
							<ToneBadge tone="danger">
								<TriangleAlertIcon />
								Only {withUnit(stock, request.unit)}
							</ToneBadge>
						{:else}
							<span class={cn(stock === 0 ? 'text-destructive' : 'text-muted-foreground')}>
								{withUnit(stock, request.unit)}
							</span>
						{/if}
					</Table.Cell>
					<Table.Cell class="py-2.5 whitespace-normal">
						{#if request.remark}
							<div class="text-foreground/80 break-words whitespace-pre-wrap">{request.remark}</div>
						{:else}
							<span class="text-muted-foreground">No remark</span>
						{/if}
					</Table.Cell>
					<Table.Cell class="py-2.5">
						<ToneBadge tone={STATUS_TONE[request.status]}>{request.status}</ToneBadge>
					</Table.Cell>
					<Table.Cell class="py-2.5">
						<div class="flex items-center justify-end gap-1">
							{#if pending}
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<Button
												{...props}
												variant="ghost"
												size="icon-sm"
												aria-label="Edit Request…"
												onclick={() => editDialog?.open(request)}
											>
												<PencilIcon />
											</Button>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content>Edit request</Tooltip.Content>
								</Tooltip.Root>
								<Button variant="destructive" size="sm" onclick={() => openReject([request])}>
									Reject…
								</Button>
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<span {...props}>
												<Button
													variant="outline"
													size="sm"
													disabled={short || stockRequestsStore.loading}
													onclick={() => approveOne(request)}
												>
													Approve
												</Button>
											</span>
										{/snippet}
									</Tooltip.Trigger>
									{#if short}
										<Tooltip.Content>Not enough stock on hand</Tooltip.Content>
									{/if}
								</Tooltip.Root>
							{:else}
								<span
									class="text-muted-foreground text-xs tabular-nums"
									title={`${request.status} ${formatDate(request.updated_at)}`}
								>
									{formatTime(request.updated_at)}
								</span>
							{/if}
						</div>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
	<div class="text-muted-foreground flex items-center justify-between gap-3 text-sm">
		<span>Showing {list.shown} of {plural(list.total, 'request')}</span>
		{#if list.hasMore}
			<Button variant="outline" size="sm" onclick={list.loadMore}>Load More</Button>
		{/if}
	</div>
{/if}

<EditRequestDialog bind:this={editDialog} />

<!-- Approve selected -->
<ActionModal
	bind:open={showBulkApprove}
	title={`Approve ${plural(approvable.length, 'Request')}?`}
	description="Stock is deducted as soon as you approve."
	loading={stockRequestsStore.loading}
	disabled={approvable.length === 0}
	confirmText="Approve"
	onconfirm={confirmBulkApprove}
	oncancel={() => (showBulkApprove = false)}
>
	<ul class="divide-y rounded-md border text-sm">
		{#each approvable as request (request.id)}
			<li class="flex items-center justify-between gap-3 px-3 py-2">
				<span class="truncate">{request.item_name}</span>
				<span class="shrink-0 font-medium tabular-nums">
					{withUnit(request.quantity, request.unit)}
					<span class="text-muted-foreground font-normal">
						· {onHand(request)} on hand
					</span>
				</span>
			</li>
		{/each}
		{#each skipped as request (request.id)}
			<li class="text-muted-foreground flex items-center justify-between gap-3 px-3 py-2">
				<span class="truncate">{request.item_name}</span>
				<span class="text-destructive shrink-0 text-xs">
					Skipped, only {withUnit(onHand(request), request.unit)} on hand
				</span>
			</li>
		{/each}
	</ul>
</ActionModal>

<!-- Reject -->
<ActionModal
	bind:open={showReject}
	title={rejectTitle}
	loading={stockRequestsStore.loading}
	dirty={rejectReason.trim() !== ''}
	confirmText="Reject"
	onconfirm={confirmReject}
	oncancel={closeReject}
>
	{#if rejectTargets.length > 1}
		<p class="text-muted-foreground mb-4 text-sm">
			{rejectTargets.map((r) => r.item_name).join(', ')}.
		</p>
	{/if}
	<Field.Group>
		<Field.Field>
			<Field.Label for="reject-reason">Reason</Field.Label>
			<Textarea
				id="reject-reason"
				bind:value={rejectReason}
				rows={3}
				placeholder="e.g. Supplier has no stock, use the alternative in cabinet B"
			/>
			<Field.Description
				>Optional. The requester sees it on their Stock Requests page.</Field.Description
			>
		</Field.Field>
	</Field.Group>
</ActionModal>

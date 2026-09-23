<script lang="ts">
	import { tick, untrack } from 'svelte'
	import { toast } from 'svelte-sonner'
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import SearchIcon from '@lucide/svelte/icons/search'
	import Trash2Icon from '@lucide/svelte/icons/trash-2'
	import XIcon from '@lucide/svelte/icons/x'
	import { selectOnFocus } from '$lib/attachments/focus'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import EditRequestDialog from '$lib/components/app/EditRequestDialog.svelte'
	import ItemPicker from '$lib/components/app/ItemPicker.svelte'
	import PageHeader from '$lib/components/app/PageHeader.svelte'
	import RequestDayFilter from '$lib/components/app/RequestDayFilter.svelte'
	import SortHeader from '$lib/components/app/SortHeader.svelte'
	import type { SortState } from '$lib/components/app/sort'
	import ToneBadge from '$lib/components/app/ToneBadge.svelte'
	import { Button } from '$lib/components/ui/button'
	import * as Empty from '$lib/components/ui/empty'
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import * as InputGroup from '$lib/components/ui/input-group'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import * as Table from '$lib/components/ui/table'
	import { Textarea } from '$lib/components/ui/textarea'
	import * as Tooltip from '$lib/components/ui/tooltip'
	import { useErrorToast } from '$lib/composables/errorToast.svelte'
	import { createLoadMore } from '$lib/composables/loadMore.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockRequestsStore } from '$lib/stores/stockRequests.svelte'
	import type { InventoryItem } from '$lib/types/inventory'
	import { todayIsoDate } from '$lib/types/stockBatches'
	import type { StockRequest } from '$lib/types/stockRequests'
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
	import Quantity from '$lib/components/app/Quantity.svelte'
	import { cn } from '$lib/utils'
	import { capsClass } from '$lib/utils/text'

	// ---------- Toolbar state ----------
	type SortKey = 'item_name' | 'created_at' | 'quantity' | 'status'

	let searchQuery = $state('')
	let searchInput = $state<HTMLInputElement | null>(null)
	let dayMode = $state<DayMode>('today')
	let dayDate = $state(todayIsoDate())
	let sort = $state<SortState<SortKey>>({ key: null, direction: 'asc' })

	useErrorToast(() => stockRequestsStore.error)
	useErrorToast(() => inventoryStore.error)

	const requests = $derived(stockRequestsStore.requests)
	const todayKey = $derived(todayIsoDate())
	const olderPendingCount = $derived(requests.filter(isOlderPending).length)

	const plural = (count: number, noun: string): string =>
		`${count} ${count === 1 ? noun : `${noun}s`}`

	/** "Today" or "22 Sep"; the time follows in the cell */
	const requestedDay = (request: StockRequest): string =>
		localDateKey(request.created_at) === todayKey ? 'Today' : formatDayMonth(request.created_at)

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
			if (key === 'created_at') return dir * a.created_at.localeCompare(b.created_at)
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

	// ---------- New request ----------
	let showNew = $state(false)
	let newItemId = $state<InventoryItem['id'] | null>(null)
	let newQuantity = $state('')
	let newRemark = $state('')
	let quantityInput = $state<HTMLInputElement | null>(null)

	const newItem = $derived(newItemId === null ? undefined : inventoryStore.getItemById(newItemId))
	const newOnHand = $derived(newItem?.quantity ?? 0)
	const newUnit = $derived(newItem?.unit ?? '')
	const newParsed = $derived(Number(newQuantity))
	const newOverStock = $derived(
		newItem !== undefined && newQuantity !== '' && newParsed > newOnHand,
	)
	const isNewValid = $derived(
		newItem !== undefined && Number.isInteger(newParsed) && newParsed > 0 && !newOverStock,
	)

	const itemOptions = $derived(
		[...inventoryStore.items].sort((a, b) =>
			a.item_name.toLowerCase().localeCompare(b.item_name.toLowerCase()),
		),
	)

	const openNew = (): void => {
		newItemId = null
		newQuantity = ''
		newRemark = ''
		showNew = true
	}

	const closeNew = (): void => {
		showNew = false
	}

	const pickItem = async (item: InventoryItem): Promise<void> => {
		newItemId = item.id
		// The quantity field unlocks on the pick, so hand it focus once it has
		await tick()
		quantityInput?.focus()
	}

	const confirmNew = async (): Promise<void> => {
		if (!newItem || !isNewValid) return
		const item = newItem
		await stockRequestsStore.addRequest({
			item_id: item.id,
			quantity: newParsed,
			remark: newRemark.trim(),
		})
		if (!stockRequestsStore.error) {
			toast.success(`Requested ${withUnit(newParsed, item.unit)} of ${item.item_name}`)
			closeNew()
		}
	}

	// ---------- Edit ----------
	let editDialog = $state<EditRequestDialog | null>(null)

	// ---------- Remove ----------
	// Removing is reversible (the request is simply added again), so it takes
	// an undo toast rather than a confirmation.
	const removeRequest = async (request: StockRequest): Promise<void> => {
		await stockRequestsStore.removeRequest(request.id)
		if (stockRequestsStore.error) return
		toast.success(`Removed the request for ${request.item_name}`, {
			duration: 8000,
			action: {
				label: 'Undo',
				onClick: async () => {
					await stockRequestsStore.addRequest({
						item_id: request.item_id,
						quantity: request.quantity,
						remark: request.remark ?? '',
					})
					if (!stockRequestsStore.error) {
						toast.success(`Restored the request for ${request.item_name}`)
					}
				},
			},
		})
	}
</script>

<svelte:window onkeydown={onKeydown} />

<PageHeader title="Stock Requests">
	<div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
		<InputGroup.Root class="w-full sm:w-96">
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
						size="icon-sm"
						aria-label="Clear search"
						onclick={() => (searchQuery = '')}
					>
						<XIcon />
					</InputGroup.Button>
				</InputGroup.Addon>
			{/if}
		</InputGroup.Root>
		<RequestDayFilter bind:mode={dayMode} bind:date={dayDate} {olderPendingCount} />
	</div>
	<Button onclick={openNew}>
		<PlusIcon data-icon="inline-start" />
		New Request…
	</Button>
</PageHeader>

{#if initialLoading}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Item</Table.Head>
				<Table.Head>Quantity</Table.Head>
				<Table.Head>Remark</Table.Head>
				<Table.Head>Status</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each { length: 6 } as _, i (i)}
				<Table.Row>
					<Table.Cell><Skeleton class="h-4 w-44" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-16" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-40" /></Table.Cell>
					<Table.Cell><Skeleton class="h-5 w-16 rounded-full" /></Table.Cell>
					<Table.Cell><Skeleton class="ms-auto h-7 w-16" /></Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{:else if sortedRequests.length === 0}
	<Empty.Root class="my-auto">
		<Empty.Header>
			<Empty.Media variant="icon">
				<ClipboardListIcon />
			</Empty.Media>
			<Empty.Title>
				{#if searchQuery}
					No requests match
				{:else if dayMode === 'older'}
					Nothing older is waiting
				{:else if dayMode === 'date'}
					No requests on {formatDate(dayDate)}
				{:else if requests.length === 0}
					No requests yet
				{:else}
					No requests today
				{/if}
			</Empty.Title>
			<Empty.Description>
				{#if searchQuery}
					Try another search or clear the filter.
				{:else if dayMode === 'today'}
					Ask for stock and the manager approves it from here.
				{:else}
					Pick another day, or go back to today.
				{/if}
			</Empty.Description>
		</Empty.Header>
		<Empty.Content>
			{#if isFiltered}
				<Button variant="outline" onclick={clearFilters}>Show Today</Button>
			{:else}
				<Button onclick={openNew}>
					<PlusIcon data-icon="inline-start" />
					New Request…
				</Button>
			{/if}
		</Empty.Content>
	</Empty.Root>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<SortHeader key="item_name" {sort} onsort={toggleSort}>Item</SortHeader>
				<SortHeader key="created_at" {sort} onsort={toggleSort}>Requested</SortHeader>
				<SortHeader key="quantity" {sort} onsort={toggleSort}>Quantity</SortHeader>
				<Table.Head class="w-[30%]">Remark</Table.Head>
				<SortHeader key="status" {sort} onsort={toggleSort}>Status</SortHeader>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each list.visible as request (request.id)}
				{@const pending = request.status === 'Pending'}
				<Table.Row>
					<Table.Cell class={cn('font-medium', capsClass(request.item_name))}
						>{request.item_name}</Table.Cell
					>
					<Table.Cell class="tabular-nums">
						{requestedDay(request)}
						<span class="text-muted-foreground ms-1 text-xs">{formatTime(request.created_at)}</span>
					</Table.Cell>
					<Table.Cell><Quantity value={request.quantity} unit={request.unit} /></Table.Cell>
					<!-- One line: the full remark is the title and opens in Edit Request. -->
					<Table.Cell class="max-w-0">
						{#if request.remark}
							<div
								class={cn(
									'truncate',
									request.status === 'Rejected' ? 'text-destructive' : 'text-foreground/80',
								)}
								title={request.remark}
							>
								{request.remark}
							</div>
						{:else}
							<span class="text-muted-foreground">No remark</span>
						{/if}
					</Table.Cell>
					<Table.Cell>
						<ToneBadge tone={STATUS_TONE[request.status]}>{request.status}</ToneBadge>
					</Table.Cell>
					<Table.Cell>
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
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<Button
												{...props}
												variant="destructive"
												size="icon-sm"
												aria-label="Remove Request"
												onclick={() => removeRequest(request)}
											>
												<Trash2Icon />
											</Button>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content>Remove request</Tooltip.Content>
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
			<Button variant="outline" onclick={list.loadMore}>Load More</Button>
		{/if}
	</div>
{/if}

<EditRequestDialog bind:this={editDialog} />

<!-- New request -->
<ActionModal
	bind:open={showNew}
	title="New Request"
	loading={stockRequestsStore.loading}
	disabled={!isNewValid}
	dirty={newItemId !== null || newQuantity !== '' || newRemark !== ''}
	confirmText="Create Request"
	onconfirm={confirmNew}
	oncancel={closeNew}
>
	<form
		onsubmit={(event) => {
			event.preventDefault()
			confirmNew()
		}}
	>
		<Field.Group>
			<Field.Field>
				<Field.Label for="new-request-item">Item</Field.Label>
				<!-- One search field that holds the pick, as HealthOS finds a patient. -->
				<ItemPicker
					id="new-request-item"
					bind:value={newItemId}
					items={itemOptions}
					showOnHand
					autofocus
					onSelect={pickItem}
				/>
			</Field.Field>
			<Field.Field data-invalid={newOverStock || undefined} data-disabled={!newItem || undefined}>
				<Field.Label for="new-request-quantity">Quantity</Field.Label>
				<!-- The unit sits where the number is typed, pack size included, so "3" means 3 BOX (20 BTL). -->
				<InputGroup.Root>
					<InputGroup.Input
						id="new-request-quantity"
						bind:ref={quantityInput}
						bind:value={newQuantity}
						type="number"
						min="1"
						max={newOnHand}
						step="1"
						placeholder="e.g. 3"
						disabled={!newItem}
						aria-invalid={newOverStock || undefined}
						{@attach selectOnFocus()}
					/>
					{#if newItem}
						<InputGroup.Addon align="inline-end">
							<InputGroup.Text class={capsClass(newUnit)}>{newUnit}</InputGroup.Text>
						</InputGroup.Addon>
					{/if}
				</InputGroup.Root>
				{#if newItem && newOverStock}
					<Field.Error>Only {withUnit(newOnHand, newUnit)} on hand.</Field.Error>
				{:else if newItem && newOnHand === 0}
					<Field.Error>Nothing on hand.</Field.Error>
				{:else if newItem}
					<Field.Description>{withUnit(newOnHand, newUnit)} on hand.</Field.Description>
				{/if}
			</Field.Field>
			<Field.Field>
				<Field.Label for="new-request-remark">
					Remark <span class="text-muted-foreground font-normal">optional</span>
				</Field.Label>
				<Textarea
					id="new-request-remark"
					bind:value={newRemark}
					rows={2}
					placeholder="e.g. Dispensary running low"
				/>
			</Field.Field>
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

<script lang="ts">
	import { untrack } from 'svelte'
	import { toast } from 'svelte-sonner'
	import PackageOpenIcon from '@lucide/svelte/icons/package-open'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import SearchIcon from '@lucide/svelte/icons/search'
	import XIcon from '@lucide/svelte/icons/x'
	import { caretAtEnd } from '$lib/attachments/focus'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import DialogSubject from '$lib/components/app/DialogSubject.svelte'
	import MarkOrderedDialog from '$lib/components/app/MarkOrderedDialog.svelte'
	import OrderControls from '$lib/components/app/OrderControls.svelte'
	import OrderStatusBadge from '$lib/components/app/OrderStatusBadge.svelte'
	import PageHeader from '$lib/components/app/PageHeader.svelte'
	import SnoozeDialog from '$lib/components/app/SnoozeDialog.svelte'
	import SortHeader from '$lib/components/app/SortHeader.svelte'
	import type { SortState } from '$lib/components/app/sort'
	import StopTrackingDialog from '$lib/components/app/StopTrackingDialog.svelte'
	import { Button } from '$lib/components/ui/button'
	import * as Empty from '$lib/components/ui/empty'
	import * as Field from '$lib/components/ui/field'
	import * as InputGroup from '$lib/components/ui/input-group'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import * as Table from '$lib/components/ui/table'
	import { Textarea } from '$lib/components/ui/textarea'
	import * as ToggleGroup from '$lib/components/ui/toggle-group'
	import * as Tooltip from '$lib/components/ui/tooltip'
	import { useErrorToast } from '$lib/composables/errorToast.svelte'
	import { createLoadMore } from '$lib/composables/loadMore.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import type { InventoryItem } from '$lib/types/inventory'
	import { isOnOrder, isSnoozing, needsDecision } from '$lib/utils/orders'
	import Quantity from '$lib/components/app/Quantity.svelte'
	import { cn } from '$lib/utils'
	import { capsClass } from '$lib/utils/text'

	// ---------- Toolbar state ----------
	type Filter = 'all' | 'toorder' | 'ordered' | 'snoozed'
	type SortKey = 'item_name' | 'quantity' | 'order_status' | 'remark'

	const FILTERS: Array<{ value: Filter; label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'toorder', label: 'To Order' },
		{ value: 'ordered', label: 'On Order' },
		{ value: 'snoozed', label: 'Snoozed' },
	]

	let searchQuery = $state('')
	let searchInput = $state<HTMLInputElement | null>(null)
	let filter = $state<Filter>('all')
	let sort = $state<SortState<SortKey>>({ key: null, direction: 'asc' })

	useErrorToast(() => inventoryStore.error)

	const matchesFilter = (item: InventoryItem): boolean => {
		switch (filter) {
			case 'toorder':
				return needsDecision(item)
			case 'ordered':
				return isOnOrder(item)
			case 'snoozed':
				return isSnoozing(item)
			default:
				return true
		}
	}

	// On order first, then snoozed, then nothing; within each, by date
	const orderStatusValue = (item: InventoryItem): string | null => {
		const status = item.order_status
		if (!status) return null
		return status.kind === 'ordered' ? `0 ${status.ordered_on}` : `1 ${status.until}`
	}

	const quantityTone = (item: InventoryItem): 'danger' | 'warning' | null => {
		if (item.not_track) return null
		if (item.quantity === 0) return 'danger'
		if (item.quantity <= item.reorder_level) return 'warning'
		return null
	}

	const plural = (count: number, noun: string): string =>
		`${count} ${count === 1 ? noun : `${noun}s`}`

	const sortedItems = $derived.by((): InventoryItem[] => {
		const items = inventoryStore.searchItems(searchQuery).filter(matchesFilter)
		const key = sort.key
		if (!key) return items

		const dir = sort.direction === 'asc' ? 1 : -1
		const valueOf = (item: InventoryItem): string | number | null => {
			if (key === 'order_status') return orderStatusValue(item)
			if (key === 'remark') return item.remark || null
			return item[key]
		}
		return [...items].sort((a, b) => {
			const av = valueOf(a)
			const bv = valueOf(b)
			// Missing values always sort last
			if (av === null && bv === null) return 0
			if (av === null) return 1
			if (bv === null) return -1
			if (typeof av === 'string' && typeof bv === 'string') {
				return dir * av.toLowerCase().localeCompare(bv.toLowerCase())
			}
			if (typeof av === 'number' && typeof bv === 'number') return dir * (av - bv)
			return 0
		})
	})

	const list = createLoadMore(() => sortedItems)

	const toggleSort = (key: SortKey): void => {
		if (sort.key === key) {
			sort.direction = sort.direction === 'asc' ? 'desc' : 'asc'
		} else {
			sort = { key, direction: 'asc' }
		}
	}

	// A new search, filter or sort starts the list from the top again
	$effect(() => {
		void searchQuery
		void filter
		void sort.key
		void sort.direction
		untrack(() => list.reset())
	})

	const isFiltered = $derived(searchQuery !== '' || filter !== 'all')
	const clearFilters = (): void => {
		searchQuery = ''
		filter = 'all'
	}

	// ⌥⌘F focuses the search field
	const onKeydown = (event: KeyboardEvent): void => {
		if (event.metaKey && event.altKey && event.code === 'KeyF') {
			event.preventDefault()
			searchInput?.focus()
			searchInput?.select()
		}
	}

	// ---------- Order dialogs ----------
	let orderDialog = $state<MarkOrderedDialog | null>(null)
	let snoozeDialog = $state<SnoozeDialog | null>(null)
	let stopTrackingDialog = $state<StopTrackingDialog | null>(null)

	// ---------- Edit remark ----------
	let showRemarkDialog = $state(false)
	let remarkItem = $state<InventoryItem | null>(null)
	let remark = $state('')

	const isRemarkChanged = $derived(
		remarkItem !== null && remark.trim() !== (remarkItem.remark || '').trim(),
	)

	const openRemark = (item: InventoryItem): void => {
		remarkItem = item
		remark = item.remark || ''
		showRemarkDialog = true
	}

	const closeRemark = (): void => {
		showRemarkDialog = false
		remarkItem = null
	}

	const confirmRemark = async (): Promise<void> => {
		if (!remarkItem || !isRemarkChanged) return
		const item = remarkItem
		await inventoryStore.updateItem(item.id, { remark: remark.trim() })
		if (!inventoryStore.error) {
			toast.success(`Saved the remark of ${item.item_name}`)
			closeRemark()
		}
	}

	const initialLoading = $derived(inventoryStore.loading && inventoryStore.items.length === 0)
</script>

<svelte:window onkeydown={onKeydown} />

<PageHeader title="Price List">
	<div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
		<InputGroup.Root class="w-full sm:w-96">
			<InputGroup.Addon>
				<SearchIcon />
			</InputGroup.Addon>
			<InputGroup.Input
				bind:ref={searchInput}
				bind:value={searchQuery}
				type="search"
				placeholder="Search by item name"
				aria-label="Search by item name"
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
		<ToggleGroup.Root
			class="grid auto-cols-fr grid-flow-col"
			type="single"
			variant="outline"
			value={filter}
			onValueChange={(value) => (filter = (value || 'all') as Filter)}
			aria-label="Filter by order status"
		>
			{#each FILTERS as option (option.value)}
				<ToggleGroup.Item value={option.value}>{option.label}</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>
	</div>
</PageHeader>

{#if initialLoading}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Item</Table.Head>
				<Table.Head>In stock</Table.Head>
				<Table.Head>Order status</Table.Head>
				<Table.Head class="w-[38%]">Remark</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each { length: 8 } as _, i (i)}
				<Table.Row>
					<Table.Cell><Skeleton class="h-4 w-48" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-20" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-28" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-64" /></Table.Cell>
					<Table.Cell><Skeleton class="ms-auto h-7 w-32" /></Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{:else if sortedItems.length === 0}
	<Empty.Root class="my-auto">
		<Empty.Header>
			<Empty.Media variant="icon">
				<PackageOpenIcon />
			</Empty.Media>
			<Empty.Title>{isFiltered ? 'No items match' : 'No items yet'}</Empty.Title>
			<Empty.Description>
				{isFiltered
					? 'Try another search or clear the filter.'
					: 'Add items in Inventory and they appear here.'}
			</Empty.Description>
		</Empty.Header>
		<Empty.Content>
			{#if isFiltered}
				<Button variant="outline" onclick={clearFilters}>Clear Search</Button>
			{:else}
				<Button href="/inventory">Go to Inventory</Button>
			{/if}
		</Empty.Content>
	</Empty.Root>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<SortHeader key="item_name" {sort} onsort={toggleSort}>Item</SortHeader>
				<SortHeader key="quantity" {sort} onsort={toggleSort}>In stock</SortHeader>
				<SortHeader key="order_status" {sort} onsort={toggleSort}>Order status</SortHeader>
				<SortHeader key="remark" {sort} onsort={toggleSort} class="w-[38%]">Remark</SortHeader>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each list.visible as item (item.id)}
				{@const tone = quantityTone(item)}
				<Table.Row>
					<Table.Cell class={cn('font-medium', capsClass(item.item_name))}
						>{item.item_name}</Table.Cell
					>
					<Table.Cell>
						<Quantity
							value={item.quantity}
							unit={item.unit}
							valueClass={cn(
								tone === 'danger' && 'text-destructive font-semibold',
								tone === 'warning' && 'text-warning font-semibold',
							)}
						/>
					</Table.Cell>
					<Table.Cell>
						<OrderStatusBadge {item} />
					</Table.Cell>
					<!-- One line: the full remark is the title and opens in Edit Remark. -->
					<Table.Cell class="max-w-0">
						{#if item.remark}
							<div class="text-foreground/80 truncate" title={item.remark}>{item.remark}</div>
						{:else}
							<span class="text-muted-foreground">No remark</span>
						{/if}
					</Table.Cell>
					<Table.Cell>
						<div class="flex justify-end gap-1">
							<OrderControls
								{item}
								onMarkOrdered={(target) => orderDialog?.open(target)}
								onSnooze={(target) => snoozeDialog?.open(target)}
								onStopTracking={(target) => stopTrackingDialog?.open(target)}
							/>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant="ghost"
											size="icon-sm"
											aria-label="Edit Remark…"
											onclick={() => openRemark(item)}
										>
											<PencilIcon />
										</Button>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content>Edit remark</Tooltip.Content>
							</Tooltip.Root>
						</div>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
	<div class="text-muted-foreground flex items-center justify-between gap-3 text-sm">
		<span>Showing {list.shown} of {plural(list.total, 'item')}</span>
		{#if list.hasMore}
			<Button variant="outline" onclick={list.loadMore}>Load More</Button>
		{/if}
	</div>
{/if}

<MarkOrderedDialog bind:this={orderDialog} />
<SnoozeDialog bind:this={snoozeDialog} />
<StopTrackingDialog bind:this={stopTrackingDialog} />

<!-- Edit Remark -->
<ActionModal
	bind:open={showRemarkDialog}
	title="Edit Remark"
	loading={inventoryStore.loading}
	disabled={!isRemarkChanged}
	dirty={isRemarkChanged}
	confirmText="Save"
	onconfirm={confirmRemark}
	oncancel={closeRemark}
>
	{#if remarkItem}
		<DialogSubject name={remarkItem.item_name} />
	{/if}
	<Field.Group>
		<Field.Field>
			<Field.Label for="remark">Remark</Field.Label>
			<Textarea
				id="remark"
				bind:value={remark}
				rows={3}
				placeholder="e.g. RM 32.00 per 100 · Pharmaniaga"
				{@attach caretAtEnd()}
			/>
		</Field.Field>
	</Field.Group>
</ActionModal>

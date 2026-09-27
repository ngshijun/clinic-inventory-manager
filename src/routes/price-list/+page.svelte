<script lang="ts">
	import { untrack } from 'svelte'
	import { toast } from 'svelte-sonner'
	import PackageOpenIcon from '@lucide/svelte/icons/package-open'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import SearchIcon from '@lucide/svelte/icons/search'
	import XIcon from '@lucide/svelte/icons/x'
	import { caretAtEnd } from '$lib/attachments/focus'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import SupplierField from '$lib/components/app/SupplierField.svelte'
	import SupplierFilter from '$lib/components/app/SupplierFilter.svelte'
	import DialogSubject from '$lib/components/app/DialogSubject.svelte'
	import MarkOrderedDialog from '$lib/components/app/MarkOrderedDialog.svelte'
	import OrderControls from '$lib/components/app/OrderControls.svelte'
	import OrderStatusBadge from '$lib/components/app/OrderStatusBadge.svelte'
	import PageHeader from '$lib/components/app/PageHeader.svelte'
	import Price from '$lib/components/app/Price.svelte'
	import PriceField from '$lib/components/app/PriceField.svelte'
	import SnoozeDialog from '$lib/components/app/SnoozeDialog.svelte'
	import ToneBadge, { type Tone } from '$lib/components/app/ToneBadge.svelte'
	import SortHeader from '$lib/components/app/SortHeader.svelte'
	import type { SortState } from '$lib/components/app/sort'
	import StopOrderingDialog from '$lib/components/app/StopOrderingDialog.svelte'
	import { Button } from '$lib/components/ui/button'
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
	import { suppliersStore } from '$lib/stores/suppliers.svelte'
	import type { InventoryItem, InventoryItemUpdate } from '$lib/types/inventory'
	import Quantity from '$lib/components/app/Quantity.svelte'
	import { cn } from '$lib/utils'
	import { ALL_SUPPLIERS, activeSupplier, matchesSupplier } from '$lib/utils/supplier'
	import { capsClass } from '$lib/utils/text'
	import {
		priceFormFrom,
		priceFormIsValid,
		priceFormValue,
		samePrice,
		type PriceForm,
	} from '$lib/utils/price'
	import { pricePerUnit } from '../../../convex/lib/price'

	// ---------- Toolbar state ----------
	type SortKey = 'item_name' | 'supplier' | 'quantity' | 'price' | 'order_status' | 'remark'

	let searchQuery = $state('')
	let searchInput = $state<HTMLInputElement | null>(null)
	let supplierChoice = $state(ALL_SUPPLIERS)
	const supplier = $derived(activeSupplier(supplierChoice, inventoryStore.items))
	let sort = $state<SortState<SortKey>>({ key: null, direction: 'asc' })

	useErrorToast(() => inventoryStore.error)

	// On order first, then snoozed, then nothing; within each, by date
	const orderStatusValue = (item: InventoryItem): string | null => {
		const status = item.order_status
		if (!status) return null
		return status.kind === 'ordered' ? `0 ${status.ordered_on}` : `1 ${status.until}`
	}

	// In stock is the default and gets no mark, as on Inventory
	const stockStatus = (item: InventoryItem): { tone: Tone; text: string } | null => {
		if (item.not_track) return { tone: 'neutral', text: 'Not ordering' }
		if (item.quantity === 0) return { tone: 'danger', text: 'Out of stock' }
		if (item.quantity <= item.reorder_level) return { tone: 'warning', text: 'Low stock' }
		return null
	}

	const plural = (count: number, noun: string): string =>
		`${count} ${count === 1 ? noun : `${noun}s`}`

	const sortedItems = $derived.by((): InventoryItem[] => {
		const items = inventoryStore
			.searchItems(searchQuery)
			.filter((item) => matchesSupplier(item, supplier))
		const key = sort.key
		if (!key) return items

		const dir = sort.direction === 'asc' ? 1 : -1
		const valueOf = (item: InventoryItem): string | number | null => {
			if (key === 'order_status') return orderStatusValue(item)
			if (key === 'remark') return item.remark || null
			if (key === 'supplier') return item.supplier ?? null
			// By what one of the item's unit costs, so a price per bottle sorts with prices per bundle
			if (key === 'price') {
				return item.price ? (pricePerUnit(item, item.price) ?? item.price.amount) : null
			}
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

	// A new search, supplier or sort starts the list from the top again
	$effect(() => {
		void searchQuery
		void supplier
		void sort.key
		void sort.direction
		untrack(() => list.reset())
	})

	const isFiltered = $derived(searchQuery !== '' || supplier !== ALL_SUPPLIERS)
	const clearFilters = (): void => {
		searchQuery = ''
		supplierChoice = ALL_SUPPLIERS
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
	let stopOrderingDialog = $state<StopOrderingDialog | null>(null)

	// ---------- Edit price details: supplier, price and remark ----------
	let showEditDialog = $state(false)
	let editingItem = $state<InventoryItem | null>(null)
	let editSupplier = $state('')
	let editPrice = $state<PriceForm>({ amount: '', unit: '' })
	let editRemark = $state('')

	const supplierName = $derived(suppliersStore.nameOf(editSupplier))
	const isEditValid = $derived(supplierName !== null && priceFormIsValid(editPrice))

	// Only what changed is sent
	const edits = $derived.by((): InventoryItemUpdate => {
		const item = editingItem
		if (!item) return {}
		const changes: InventoryItemUpdate = {}
		if (supplierName !== null && supplierName !== (item.supplier ?? '')) {
			changes.supplier = supplierName
		}
		const price = priceFormValue(editPrice)
		if (!samePrice(price, priceFormValue(priceFormFrom(item)))) changes.price = price
		if (editRemark.trim() !== (item.remark || '').trim()) changes.remark = editRemark.trim()
		return changes
	})
	const isEdited = $derived(Object.keys(edits).length > 0)

	const openEdit = (item: InventoryItem): void => {
		editingItem = item
		editSupplier = item.supplier ?? ''
		editPrice = priceFormFrom(item)
		editRemark = item.remark || ''
		showEditDialog = true
	}

	const closeEdit = (): void => {
		showEditDialog = false
		editingItem = null
	}

	const confirmEdit = async (): Promise<void> => {
		if (!editingItem || !isEdited || !isEditValid) return
		const item = editingItem
		await inventoryStore.updateItem(item.id, edits)
		if (!inventoryStore.error) {
			toast.success(`Saved ${item.item_name}`)
			closeEdit()
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
				placeholder="Search by item or supplier"
				aria-label="Search by item or supplier"
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
		<SupplierFilter bind:value={supplierChoice} items={inventoryStore.items} />
	</div>
</PageHeader>

{#if initialLoading}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Item</Table.Head>
				<Table.Head>Supplier</Table.Head>
				<Table.Head>In stock</Table.Head>
				<Table.Head>Price</Table.Head>
				<Table.Head>Order status</Table.Head>
				<Table.Head class="w-[25%]">Remark</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each { length: 8 } as _, i (i)}
				<Table.Row>
					<Table.Cell><Skeleton class="h-4 w-48" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-20" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
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
				<SortHeader key="supplier" {sort} onsort={toggleSort}>Supplier</SortHeader>
				<SortHeader key="quantity" {sort} onsort={toggleSort}>In stock</SortHeader>
				<SortHeader key="price" {sort} onsort={toggleSort}>Price</SortHeader>
				<SortHeader key="order_status" {sort} onsort={toggleSort}>Order status</SortHeader>
				<SortHeader key="remark" {sort} onsort={toggleSort} class="w-[25%]">Remark</SortHeader>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each list.visible as item (item.id)}
				{@const status = stockStatus(item)}
				<Table.Row>
					<Table.Cell class={cn('font-medium', capsClass(item.item_name))}>
						<span class="inline-flex items-center gap-2">
							{item.item_name}
							{#if status}
								<ToneBadge tone={status.tone}>{status.text}</ToneBadge>
							{/if}
						</span>
					</Table.Cell>
					<Table.Cell class={capsClass(item.supplier)}>
						{#if item.supplier}
							{item.supplier}
						{:else}
							<span class="text-muted-foreground">—</span>
						{/if}
					</Table.Cell>
					<Table.Cell>
						<Quantity value={item.quantity} unit={item.unit_label} />
					</Table.Cell>
					<Table.Cell>
						<Price price={item.price} />
					</Table.Cell>
					<Table.Cell>
						<OrderStatusBadge {item} />
					</Table.Cell>
					<!-- One line: the full remark is the title and opens in Edit Price Details. -->
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
								onStopOrdering={(target) => stopOrderingDialog?.open(target)}
							/>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant="ghost"
											size="icon-sm"
											aria-label="Edit Price Details…"
											onclick={() => openEdit(item)}
										>
											<PencilIcon />
										</Button>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content>Edit supplier, price and remark</Tooltip.Content>
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
<StopOrderingDialog bind:this={stopOrderingDialog} />

<!-- Edit Price Details -->
<ActionModal
	bind:open={showEditDialog}
	title="Edit Price Details"
	loading={inventoryStore.loading}
	disabled={!isEdited || !isEditValid}
	dirty={isEdited || supplierName === null}
	confirmText="Save"
	onconfirm={confirmEdit}
	oncancel={closeEdit}
>
	{#if editingItem}
		<DialogSubject name={editingItem.item_name} />
	{/if}
	<Field.Group>
		<SupplierField id="edit-supplier" bind:value={editSupplier} />
		{#if editingItem}
			<PriceField id="edit-price" bind:value={editPrice} parts={editingItem} />
		{/if}
		<Field.Field>
			<Field.Label for="remark">Remark</Field.Label>
			<Textarea
				id="remark"
				bind:value={editRemark}
				rows={3}
				placeholder="e.g. another supplier's quote"
				{@attach caretAtEnd()}
			/>
		</Field.Field>
	</Field.Group>
</ActionModal>

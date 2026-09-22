<script lang="ts">
	import { untrack } from 'svelte'
	import CalendarIcon from '$lib/components/icons/CalendarIcon.svelte'
	import ClockIcon from '$lib/components/icons/ClockIcon.svelte'
	import CogIcon from '$lib/components/icons/CogIcon.svelte'
	import ActionButtonGroup, {
		type ActionButtonGroupAction,
	} from '$lib/components/app/ActionButtonGroup.svelte'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import EmptyState from '$lib/components/app/EmptyState.svelte'
	import ErrorAlert from '$lib/components/app/ErrorAlert.svelte'
	import FormField from '$lib/components/app/FormField.svelte'
	import LoadingSpinner from '$lib/components/app/LoadingSpinner.svelte'
	import ReasonBadge from '$lib/components/app/ReasonBadge.svelte'
	import SearchInput from '$lib/components/app/SearchInput.svelte'
	import SortableTableHeader, {
		type SortableTableColumn,
	} from '$lib/components/app/SortableTableHeader.svelte'
	import TablePagination from '$lib/components/app/TablePagination.svelte'
	import * as Table from '$lib/components/ui/table/index.js'
	import { createPagination } from '$lib/composables/pagination.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import type { InventoryId, InventoryItem } from '$lib/types/inventory'

	let searchQuery = $state<string>('')
	let newRemark = $state<string>('')
	let showOrderedOnly = $state<boolean>(false)

	// Order modal variables
	let showOrderModal = $state<boolean>(false)
	let orderItem = $state<InventoryItem | null>(null)
	let orderDate = $state<string>('')
	let backOrder = $state<boolean>(false)

	// Edit remark modal variables
	let showEditRemarkModal = $state<boolean>(false)
	let editingItem = $state<InventoryItem | null>(null)

	// Removed openOrderActionDropdown as we use ActionButtonGroup's internal state

	// Sorting configuration
	let sortConfig = $state<{
		key: keyof InventoryItem | null
		direction: 'asc' | 'desc'
	}>({
		key: null,
		direction: 'asc',
	})

	// Format date for display
	const formatDate = (dateString: string): string => {
		const date = new Date(dateString)
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		})
	}

	// Computed property for remark validation
	const isRemarkChanged = $derived.by(() => {
		if (!editingItem) return false
		return newRemark.trim() !== (editingItem.remark || '').trim()
	})

	// Order modal functions
	const openOrderModal = (item: InventoryItem): void => {
		orderItem = item
		orderDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
			.toISOString()
			.slice(0, 10) // Today's date
		showOrderModal = true
		backOrder = false
	}

	const closeOrderModal = (): void => {
		showOrderModal = false
		orderItem = null
		orderDate = ''
		backOrder = false
	}

	const confirmMarkAsOrdered = async (): Promise<void> => {
		if (!orderItem || !orderDate) return

		// Mark ordered using the store function with selected date
		await inventoryStore.markAsOrdered(orderItem.id, orderDate, backOrder)

		if (!inventoryStore.error) {
			closeOrderModal()
		}
	}

	const clearOrderDate = async (itemId: InventoryId): Promise<void> => {
		await inventoryStore.clearOrderDate(itemId)
	}

	// Removed toggleOrderActionDropdown as ActionButtonGroup handles this internally

	// Set non-order reason for an item
	const setItemNonOrderReason = async (itemId: InventoryId, reason: string): Promise<void> => {
		await inventoryStore.setNonOrderReason(itemId, reason)
	}

	// Clear non-order reason for an item
	const clearItemNonOrderReason = async (itemId: InventoryId): Promise<void> => {
		await inventoryStore.setNonOrderReason(itemId, null)
	}

	// Edit remark modal functions
	const openEditRemarkModal = (item: InventoryItem): void => {
		editingItem = item
		newRemark = item.remark || ''
		showEditRemarkModal = true
	}

	const closeEditRemarkModal = (): void => {
		showEditRemarkModal = false
		editingItem = null
		newRemark = ''
	}

	const confirmSaveRemark = async (): Promise<void> => {
		if (!editingItem || !isRemarkChanged) return

		await saveRemark(editingItem.id)
		if (!inventoryStore.error) {
			closeEditRemarkModal()
		}
	}

	// Sorting and filtering logic
	const sortedAndFilteredItems = $derived.by((): InventoryItem[] => {
		let items = inventoryStore.searchItems(searchQuery)

		// Apply order date filter
		if (showOrderedOnly) {
			items = items.filter((item) => item.order_date)
		}

		const key = sortConfig.key
		if (key) {
			items = [...items].sort((a, b) => {
				const aValue = a[key]
				const bValue = b[key]

				// Handle null values (put them at the end)
				if (aValue === null && bValue === null) return 0
				if (aValue === null) return sortConfig.direction === 'asc' ? 1 : -1
				if (bValue === null) return sortConfig.direction === 'asc' ? -1 : 1

				// Handle string comparison
				if (typeof aValue === 'string' && typeof bValue === 'string') {
					const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase())
					return sortConfig.direction === 'asc' ? comparison : -comparison
				}

				// Handle number comparison
				if (typeof aValue === 'number' && typeof bValue === 'number') {
					return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
				}

				// Handle date comparison for order_date
				if (key === 'order_date') {
					const aDate = aValue ? new Date(aValue as string).getTime() : 0
					const bDate = bValue ? new Date(bValue as string).getTime() : 0
					return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate
				}

				return 0
			})
		}

		return items
	})

	const pagination = createPagination(() => sortedAndFilteredItems)

	// Reset to first page when filters change
	$effect(() => {
		searchQuery
		showOrderedOnly
		untrack(() => pagination.resetToFirstPage())
	})

	// Table column configuration
	const tableColumns: SortableTableColumn[] = [
		{ key: 'item_name', label: 'Item Name', sortable: true },
		{ key: 'quantity', label: 'Current Stock', sortable: true },
		{ key: 'remark', label: 'Remark', sortable: true },
		{ key: 'actions', label: 'Actions', sortable: false },
	]

	// Sorting functions
	const toggleSort = (key: string): void => {
		if (sortConfig.key === key) {
			// Same column clicked - toggle direction
			sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc'
		} else {
			// New column clicked - set ascending
			sortConfig.key = key as keyof InventoryItem
			sortConfig.direction = 'asc'
		}
		pagination.resetToFirstPage()
	}

	// Action button configurations
	const getItemActions = (item: InventoryItem): Array<ActionButtonGroupAction> => {
		const actions: Array<ActionButtonGroupAction> = [
			{
				key: 'edit-remark',
				label: 'Edit Remark',
				variant: 'blue',
			},
		]

		if (item.order_date) {
			// Item is already ordered - show clear date option
			actions.push({
				key: 'clear-date',
				label: 'Clear Date',
				variant: 'yellow',
			})
		} else if (item.non_order_reason) {
			// Item has a reason - show change dropdown
			actions.push({
				key: 'change-action',
				label: 'Change',
				variant: 'orange',
				dropdown: [
					{ key: 'mark-ordered', label: 'Mark Ordered' },
					{ key: 'alternative-ordered', label: 'Alternative ordered' },
					{ key: 'planning-to-order-later', label: 'Planning to order later' },
					{ key: 'supplier-no-stock', label: 'Supplier has no stock' },
					{ key: 'clear-reason', label: 'Clear reason' },
				],
			})
		} else {
			// No status - show dropdown to select action
			actions.push({
				key: 'select-action',
				label: 'Select Action',
				variant: 'green',
				dropdown: [
					{ key: 'mark-ordered', label: 'Mark Ordered' },
					{ key: 'alternative-ordered', label: 'Alternative ordered' },
					{ key: 'planning-to-order-later', label: 'Planning to order later' },
					{ key: 'supplier-no-stock', label: 'Supplier has no stock' },
				],
			})
		}

		return actions
	}

	// Handle action button clicks
	const handleActionClick = (actionKey: string, item: InventoryItem) => {
		switch (actionKey) {
			case 'edit-remark':
				openEditRemarkModal(item)
				break
			case 'mark-ordered':
				openOrderModal(item)
				break
			case 'clear-date':
				clearOrderDate(item.id)
				break
			case 'alternative-ordered':
				setItemNonOrderReason(item.id, 'Alternative ordered')
				break
			case 'planning-to-order-later':
				setItemNonOrderReason(item.id, 'Planning to order later')
				break
			case 'supplier-no-stock':
				setItemNonOrderReason(item.id, 'Supplier has no stock')
				break
			case 'clear-reason':
				clearItemNonOrderReason(item.id)
				break
		}
	}

	// Remark editing functions
	const saveRemark = async (itemId: InventoryId): Promise<void> => {
		const item = inventoryStore.items.find((item) => item.id === itemId)
		if (!item) return

		await inventoryStore.updateItem(itemId, { remark: newRemark.trim() })
	}

	// ReasonBadge centralizes the presentation for non_order_reason
</script>

<div class="px-2 py-3 sm:px-0 sm:py-6">
	<div class="rounded-lg border-4 border-dashed border-gray-200 p-3 sm:p-6">
		<!-- Header -->
		<div class="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-bold text-gray-900 sm:text-2xl">Price List</h2>
		</div>

		<!-- Mark Ordered Modal -->
		<ActionModal
			bind:open={showOrderModal}
			title={`Mark Ordered: ${orderItem?.item_name}`}
			variant="green"
			loading={inventoryStore.loading}
			confirmText="Mark Ordered"
			onclose={closeOrderModal}
			oncancel={closeOrderModal}
			onconfirm={confirmMarkAsOrdered}
		>
			<div class="space-y-4">
				<div class="rounded-md border border-green-200 bg-green-50 p-3">
					<div class="mb-2 flex items-center gap-2">
						<CalendarIcon class="h-4 w-4 text-green-500" />
						<span class="text-sm font-medium text-green-800"> Set Order Date </span>
					</div>
					<p class="text-sm text-green-700">
						This will mark the item as ordered and track its pending status.
					</p>
				</div>

				<FormField bind:value={orderDate} type="date" label="Order Date" required={true} />
				<div class="rounded-md border border-green-200 bg-green-50 p-3">
					<div class="mb-2 flex items-center gap-2">
						<ClockIcon class="h-4 w-4 text-green-500" />
						<span class="text-sm font-medium text-green-800"> Back Order Item </span>
					</div>
					<div class="flex items-start gap-3">
						<input
							id="back-order"
							bind:checked={backOrder}
							type="checkbox"
							class="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
						/>
						<div class="flex-1">
							<label for="back-order" class="text-sm font-medium text-gray-700">
								Mark as back order
							</label>
							<p class="mt-1 text-sm text-gray-500">Check this to mark the item as back order.</p>
						</div>
					</div>
				</div>
			</div>
		</ActionModal>

		<!-- Edit Remark Modal -->
		<ActionModal
			bind:open={showEditRemarkModal}
			title={`Edit Remark: ${editingItem?.item_name}`}
			variant="green"
			loading={inventoryStore.loading}
			confirmText="Save Remark"
			disabled={!isRemarkChanged}
			onclose={closeEditRemarkModal}
			oncancel={closeEditRemarkModal}
			onconfirm={confirmSaveRemark}
		>
			<div class="space-y-4">
				<div class="rounded-md border border-blue-200 bg-blue-50 p-3">
					<div class="mb-2 flex items-center gap-2">
						<CogIcon class="h-4 w-4 text-blue-500" />
						<span class="text-sm font-medium text-blue-800"> Update Item Information </span>
					</div>
					<p class="text-sm text-blue-700">
						Add notes such as last purchase price, supplier information, or other relevant details.
					</p>
				</div>

				<FormField
					bind:value={newRemark}
					type="textarea"
					label="Remark"
					rows={3}
					placeholder="Enter remark (e.g., last purchase price, supplier info)..."
					caretAtEnd
				/>
			</div>
		</ActionModal>

		<!-- Search Bar and Filters -->
		<div class="mb-4 space-y-4 sm:mb-6">
			<SearchInput bind:value={searchQuery} placeholder="Search items..." />

			<!-- Filter Controls -->
			<div class="flex flex-wrap gap-3">
				<div class="flex items-center gap-2">
					<input
						id="filter-ordered"
						bind:checked={showOrderedOnly}
						type="checkbox"
						class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<label for="filter-ordered" class="text-sm font-medium text-gray-700">
						Show only items with order date
					</label>
				</div>
			</div>
		</div>

		<!-- Error Display -->
		{#if inventoryStore.error}
			<div class="mb-4">
				<ErrorAlert message={inventoryStore.error} />
			</div>
		{/if}

		<!-- Mobile Card View -->
		<div class="block lg:hidden">
			<div class="overflow-hidden bg-white shadow sm:rounded-md">
				<div class="border-b border-gray-200 px-4 py-5 sm:px-6">
					<h3 class="text-lg leading-6 font-medium text-gray-900">
						Items ({sortedAndFilteredItems.length})
					</h3>
				</div>

				{#if inventoryStore.loading && sortedAndFilteredItems.length === 0}
					<LoadingSpinner message="Loading items..." />
				{:else if sortedAndFilteredItems.length === 0}
					<EmptyState
						icon="box"
						title="No items found"
						description={searchQuery ? 'Try adjusting your search terms.' : 'No items available.'}
					/>
				{:else}
					<div class="divide-y divide-gray-200">
						{#each pagination.paginatedItems as item (item.id)}
							<div class="px-4 py-4">
								<div class="space-y-3">
									<!-- Item Header -->
									<div class="flex items-center justify-between">
										<h4 class="mr-2 flex-1 truncate text-sm font-medium text-gray-900">
											{item.item_name}
										</h4>
									</div>

									<!-- Item Details -->
									<div class="space-y-1 text-sm">
										<div class="flex items-baseline gap-2">
											<span class="flex-shrink-0 text-gray-500">Current Stock:</span>
											<span class="font-medium text-gray-900">
												{item.quantity}
												{item.unit}
											</span>
										</div>
										{#if item.order_date}
											<div class="flex items-baseline gap-2">
												{#if item.back_order}
													<span class="flex-shrink-0 text-gray-500">Back Ordered:</span>
												{:else}
													<span class="flex-shrink-0 text-gray-500">Ordered:</span>
												{/if}
												<span class="font-medium text-blue-600">
													{formatDate(item.order_date)}
												</span>
											</div>
										{:else if item.non_order_reason}
											<div class="flex items-baseline gap-2">
												<span class="flex-shrink-0 text-gray-500">Reason:</span>
												<ReasonBadge reason={item.non_order_reason} size="sm">
													{item.non_order_reason}
												</ReasonBadge>
											</div>
										{/if}
										<div class="flex items-start gap-2">
											<span class="flex-shrink-0 text-gray-500">Remark:</span>
											<span class="font-medium whitespace-pre-wrap text-gray-900">
												{item.remark || 'No remark'}
											</span>
										</div>
									</div>

									<!-- Actions -->
									<div class="border-t border-gray-100 pt-2">
										<ActionButtonGroup
											class="w-full"
											actions={getItemActions(item)}
											size="sm"
											loading={inventoryStore.loading}
											onactionclick={(actionKey) => handleActionClick(actionKey, item)}
										/>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Mobile Pagination -->
				{#if pagination.totalPages > 1}
					<TablePagination
						currentPage={pagination.currentPage}
						totalPages={pagination.totalPages}
						itemsPerPage={pagination.itemsPerPage}
						totalItems={sortedAndFilteredItems.length}
						startIndex={pagination.startIndex}
						endIndex={pagination.endIndex}
						showItemsPerPageSelector={false}
						onpagechange={pagination.goToPage}
						onitemsperpagechange={pagination.updateItemsPerPage}
					/>
				{/if}
			</div>
		</div>

		<!-- Desktop Table View -->
		<div class="hidden lg:block">
			<div class="overflow-hidden bg-white shadow sm:rounded-md">
				<div class="border-b border-gray-200 px-4 py-5 sm:px-6">
					<h3 class="text-lg leading-6 font-medium text-gray-900">
						Items ({sortedAndFilteredItems.length})
					</h3>
				</div>

				{#if inventoryStore.loading && sortedAndFilteredItems.length === 0}
					<LoadingSpinner message="Loading items..." />
				{:else if sortedAndFilteredItems.length === 0}
					<EmptyState
						icon="box"
						title="No items found"
						description={searchQuery ? 'Try adjusting your search terms.' : 'No items available.'}
					/>
				{:else}
					<Table.Root>
						<SortableTableHeader columns={tableColumns} {sortConfig} onsortchange={toggleSort} />
						<Table.Body>
							{#each pagination.paginatedItems as item (item.id)}
								<Table.Row>
									<Table.Cell
										class="max-w-xs min-w-0 px-6 py-4 text-sm font-medium whitespace-normal text-gray-900"
									>
										<div class="break-words">{item.item_name}</div>
										<!-- Show order status if item has order date -->
										{#if item.order_date}
											<div class="mt-1 text-xs text-blue-600">
												{#if item.back_order}
													<span class="inline-flex items-center gap-1">
														<ClockIcon class="h-3 w-3" />
														Back Ordered: {formatDate(item.order_date)}
													</span>
												{:else}
													<span class="inline-flex items-center gap-1">
														<CalendarIcon class="h-3 w-3" />
														Ordered: {formatDate(item.order_date)}
													</span>
												{/if}
											</div>
											<!-- Show non-order reason if set -->
										{:else if item.non_order_reason}
											<div class="mt-1 text-xs">
												<ReasonBadge reason={item.non_order_reason} size="sm">
													{item.non_order_reason}
												</ReasonBadge>
											</div>
										{/if}
									</Table.Cell>
									<Table.Cell class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
										{item.quantity}
										{item.unit}
									</Table.Cell>
									<Table.Cell class="max-w-md px-6 py-4 text-sm whitespace-normal text-gray-900">
										<div class="break-words whitespace-pre-wrap" title={item.remark || 'No remark'}>
											{item.remark || 'No remark'}
										</div>
									</Table.Cell>
									<Table.Cell class="px-6 py-4 text-sm font-medium whitespace-nowrap">
										<ActionButtonGroup
											actions={getItemActions(item)}
											size="sm"
											loading={inventoryStore.loading}
											onactionclick={(actionKey) => handleActionClick(actionKey, item)}
										/>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				{/if}

				<!-- Desktop Pagination -->
				<TablePagination
					currentPage={pagination.currentPage}
					totalPages={pagination.totalPages}
					itemsPerPage={pagination.itemsPerPage}
					totalItems={sortedAndFilteredItems.length}
					startIndex={pagination.startIndex}
					endIndex={pagination.endIndex}
					showItemsPerPageSelector={true}
					onpagechange={pagination.goToPage}
					onitemsperpagechange={pagination.updateItemsPerPage}
				/>
			</div>
		</div>
	</div>
</div>

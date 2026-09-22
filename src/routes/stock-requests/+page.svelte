<script lang="ts">
	import ActionButtonGroup from '$lib/components/app/ActionButtonGroup.svelte'
	import type { ActionButtonGroupAction } from '$lib/components/app/ActionButtonGroup.svelte'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import EmptyState from '$lib/components/app/EmptyState.svelte'
	import ErrorAlert from '$lib/components/app/ErrorAlert.svelte'
	import FormField from '$lib/components/app/FormField.svelte'
	import LoadingSpinner from '$lib/components/app/LoadingSpinner.svelte'
	import SearchInput from '$lib/components/app/SearchInput.svelte'
	import SortableTableHeader from '$lib/components/app/SortableTableHeader.svelte'
	import type { SortableTableColumn } from '$lib/components/app/SortableTableHeader.svelte'
	import StatusBadge from '$lib/components/app/StatusBadge.svelte'
	import { Button } from '$lib/components/ui/button/index.js'
	import * as Table from '$lib/components/ui/table/index.js'
	import CalendarIcon from '$lib/components/icons/CalendarIcon.svelte'
	import CogIcon from '$lib/components/icons/CogIcon.svelte'
	import WarningTriangleIcon from '$lib/components/icons/WarningTriangleIcon.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockRequestsStore } from '$lib/stores/stockRequests.svelte'
	import type { InventoryItem } from '$lib/types/inventory'
	import type { NewStockRequest, StockRequest } from '$lib/types/stockRequests'
	import { tick, untrack } from 'svelte'

	// Component imports
	import TablePagination from '$lib/components/app/TablePagination.svelte'
	import { createPagination } from '$lib/composables/pagination.svelte'

	// Helper function to map status to StatusBadge color
	const getStatusColor = (status: string): 'yellow' | 'green' | 'red' => {
		switch (status) {
			case 'Pending':
				return 'yellow'
			case 'Approved':
				return 'green'
			case 'Rejected':
				return 'red'
			default:
				return 'yellow'
		}
	}

	// State
	let searchQuery = $state<string>('')
	const today = new Date()
	let filterDate = $state<string>(
		`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
	)
	let showCreateForm = $state<boolean>(false)
	let showOlderPending = $state<boolean>(false)
	let itemSearchQuery = $state<string>('')
	let showItemDropdown = $state<boolean>(false)
	let selectedItemIndex = $state<number>(-1)

	// Edit state
	let editForm = $state<{
		quantity: number
		remark: string
	}>({
		quantity: 1,
		remark: '',
	})

	// Template refs
	let itemInputRef = $state<HTMLInputElement | null>(null)
	let quantityInputRef = $state<HTMLInputElement | null>(null)
	let dropdownRef = $state<HTMLDivElement | null>(null)

	// Remove confirmation modal
	let showRemoveModal = $state<boolean>(false)
	let removeRequestId = $state<string | null>(null)
	let removeLoading = $state<boolean>(false)

	// Edit modal
	let showEditModal = $state<boolean>(false)
	let editingRequest = $state<StockRequest | null>(null)

	// New request form
	let newRequest = $state<NewStockRequest & { quantity: number }>({
		item_id: '',
		item_name: '',
		quantity: 1,
		remark: undefined,
	})

	// Sorting configuration
	let sortConfig = $state<{
		key: keyof StockRequest | null
		direction: 'asc' | 'desc'
	}>({
		key: null,
		direction: 'asc',
	})

	// Computed properties for new request form
	const selectedItem = $derived(inventoryStore.items.find((item) => item.id === newRequest.item_id))

	const selectedItemMaxQuantity = $derived(selectedItem?.quantity || 0)

	const selectedItemUnit = $derived(selectedItem?.unit || '')

	const filteredItems = $derived.by((): InventoryItem[] => {
		if (!itemSearchQuery) return inventoryStore.items
		return inventoryStore.items.filter(
			(item) =>
				item.item_name.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
				item.id.toLowerCase().includes(itemSearchQuery.toLowerCase()),
		)
	})

	const isFormValid = $derived(
		!!(
			newRequest.item_id &&
			newRequest.quantity > 0 &&
			newRequest.quantity <= selectedItemMaxQuantity
		),
	)

	// Edit form validation
	const isEditFormValid = $derived.by(() => {
		if (!editingRequest) return false

		const maxQuantity = getItemMaxQuantity(editingRequest.item_id)
		return (
			editForm.quantity > 0 &&
			editForm.quantity <= maxQuantity &&
			(editForm.quantity !== editingRequest.quantity ||
				editForm.remark !== (editingRequest.remark || ''))
		)
	})

	// Helper function to get item max quantity
	const getItemMaxQuantity = (itemId: string): number => {
		const item = inventoryStore.items.find((item) => item.id === itemId)
		return item?.quantity || 0
	}

	// Computed properties for filtering and sorting
	const sortedAndFilteredRequests = $derived.by((): StockRequest[] => {
		let requests = [...stockRequestsStore.requests]

		// Search filter
		if (searchQuery) {
			requests = stockRequestsStore.searchRequests(searchQuery)
		}

		// Date filter (only apply if not showing older pending)
		if (filterDate && !showOlderPending) {
			const filterDateObj = new Date(filterDate)
			requests = requests.filter((request) => {
				const requestDate = new Date(request.created_at)
				return requestDate.toDateString() === filterDateObj.toDateString()
			})
		}

		// Show older pending filter
		if (showOlderPending) {
			const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
			requests = requests.filter((request) => {
				if (request.status !== 'Pending') return false
				const requestDate = new Date(request.created_at)
				const requestDateString = `${requestDate.getFullYear()}-${String(requestDate.getMonth() + 1).padStart(2, '0')}-${String(requestDate.getDate()).padStart(2, '0')}`
				return requestDateString !== todayString
			})
		}

		// Sorting
		if (sortConfig.key) {
			requests.sort((a, b) => {
				const aValue = a[sortConfig.key as keyof StockRequest]
				const bValue = b[sortConfig.key as keyof StockRequest]

				if (typeof aValue === 'string' && typeof bValue === 'string') {
					const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase())
					return sortConfig.direction === 'asc' ? comparison : -comparison
				}

				if (typeof aValue === 'number' && typeof bValue === 'number') {
					return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
				}

				return 0
			})
		}

		return requests
	})

	// Pagination
	const pagination = createPagination(() => sortedAndFilteredRequests)

	const nonTodayPendingCount = $derived.by(() => {
		const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
		return stockRequestsStore.requests.filter((request) => {
			if (request.status !== 'Pending') return false
			const requestDate = new Date(request.created_at)
			const requestDateString = `${requestDate.getFullYear()}-${String(requestDate.getMonth() + 1).padStart(2, '0')}-${String(requestDate.getDate()).padStart(2, '0')}`
			return requestDateString !== todayString
		}).length
	})

	// Check if reset to today button should be shown
	const showResetButton = $derived.by((): boolean => {
		const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
		const isDateToday = filterDate === todayString
		return !!(filterDate && !isDateToday)
	})

	// Reset to first page when filters change
	$effect(() => {
		searchQuery
		filterDate
		untrack(() => pagination.resetToFirstPage())
	})

	// Table column configuration
	const tableColumns: SortableTableColumn[] = [
		{ key: 'item_name', label: 'Item Name', sortable: true },
		{ key: 'quantity', label: 'Quantity', sortable: true },
		{ key: 'remark', label: 'Remark', sortable: false },
		{ key: 'status', label: 'Status', sortable: true },
		{ key: 'actions', label: 'Actions', sortable: false },
	]

	// Sorting functions
	const toggleSort = (key: string): void => {
		if (sortConfig.key === key) {
			// Same column clicked - toggle direction
			sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc'
		} else {
			// New column clicked - set ascending
			sortConfig.key = key as keyof StockRequest
			sortConfig.direction = 'asc'
		}
		pagination.resetToFirstPage()
	}

	// Action button configurations
	const getRequestActions = (request: StockRequest): Array<ActionButtonGroupAction> => {
		if (request.status !== 'Pending') return []

		return [
			{
				key: 'edit',
				label: 'Edit',
				variant: 'blue',
			},
			{
				key: 'delete',
				label: 'Remove',
				variant: 'red',
			},
		]
	}

	// Handle action button clicks
	const handleActionClick = (actionKey: string, request: StockRequest) => {
		switch (actionKey) {
			case 'edit':
				startEdit(request)
				break
			case 'delete':
				removeRequest(request.id)
				break
		}
	}

	// Reset date filter to today
	const resetToToday = (): void => {
		const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
		filterDate = todayString
		pagination.resetToFirstPage()
	}

	// Edit functions
	const startEdit = (request: StockRequest): void => {
		editingRequest = request
		editForm = {
			quantity: request.quantity,
			remark: request.remark || '',
		}
		showEditModal = true
	}

	const closeEditModal = (): void => {
		showEditModal = false
		editingRequest = null
		editForm = {
			quantity: 1,
			remark: '',
		}
	}

	const confirmEdit = async (): Promise<void> => {
		if (!editingRequest || !isEditFormValid) return

		await saveEdit(editingRequest.id)
		if (!stockRequestsStore.error) {
			closeEditModal()
		}
	}

	const saveEdit = async (requestId: string): Promise<void> => {
		if (!isEditFormValid) return

		await stockRequestsStore.updateRequest(requestId, editForm.quantity, editForm.remark)

		// Modal cleanup is handled by confirmEdit function
	}

	// New request form functions
	const onItemSearch = (): void => {
		showItemDropdown = true
		selectedItemIndex = -1 // Reset selection when searching
	}

	const scrollToSelectedItem = (): void => {
		tick().then(() => {
			if (dropdownRef && selectedItemIndex >= 0) {
				const dropdown = dropdownRef
				const selectedItem = dropdown.querySelector(
					`[data-index="${selectedItemIndex}"]`,
				) as HTMLElement

				if (selectedItem) {
					const dropdownRect = dropdown.getBoundingClientRect()
					const itemRect = selectedItem.getBoundingClientRect()

					// Check if item is above visible area
					if (itemRect.top < dropdownRect.top) {
						dropdown.scrollTop -= dropdownRect.top - itemRect.top
					}
					// Check if item is below visible area
					else if (itemRect.bottom > dropdownRect.bottom) {
						dropdown.scrollTop += itemRect.bottom - dropdownRect.bottom
					}
				}
			}
		})
	}

	const handleKeyDown = (event: KeyboardEvent): void => {
		if (!showItemDropdown || filteredItems.length === 0) return

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault()
				selectedItemIndex = Math.min(selectedItemIndex + 1, filteredItems.length - 1)
				scrollToSelectedItem()
				break
			case 'ArrowUp':
				event.preventDefault()
				selectedItemIndex = Math.max(selectedItemIndex - 1, 0)
				scrollToSelectedItem()
				break
			case 'Enter':
				event.preventDefault()
				if (selectedItemIndex >= 0 && selectedItemIndex < filteredItems.length) {
					selectItem(filteredItems[selectedItemIndex])
				}
				break
			case 'Escape':
				event.preventDefault()
				showItemDropdown = false
				selectedItemIndex = -1
				break
		}
	}

	const selectItem = (item: InventoryItem): void => {
		newRequest.item_id = item.id
		newRequest.item_name = item.item_name
		itemSearchQuery = item.item_name
		showItemDropdown = false
		selectedItemIndex = -1
		newRequest.quantity = 1 // Reset quantity when item changes
		// The quantity field is enabled by the selection, so hand it focus once
		// the DOM reflects that; it selects its default on focus
		tick().then(() => quantityInputRef?.focus())
	}

	const createNewRequest = async (): Promise<void> => {
		if (!isFormValid) return

		await stockRequestsStore.addRequest({
			item_id: newRequest.item_id,
			item_name: newRequest.item_name,
			quantity: newRequest.quantity,
			remark: newRequest.remark || '',
		})

		if (!stockRequestsStore.error) {
			cancelCreateForm()
		}
	}

	const openCreateForm = async (): Promise<void> => {
		showCreateForm = true
		await tick() // Wait for DOM to update
		itemInputRef?.focus() // Focus the item input
	}

	const cancelCreateForm = (): void => {
		showCreateForm = false
		showItemDropdown = false
		itemSearchQuery = ''
		selectedItemIndex = -1
		newRequest = {
			item_id: '',
			item_name: '',
			quantity: 1,
			remark: '',
		}
	}

	// Action functions
	const removeRequest = (requestId: string): void => {
		removeRequestId = requestId
		showRemoveModal = true
	}

	const confirmRemove = async (): Promise<void> => {
		if (!removeRequestId) return

		removeLoading = true
		try {
			await stockRequestsStore.removeRequest(removeRequestId)
			showRemoveModal = false
			removeRequestId = null
		} finally {
			removeLoading = false
		}
	}

	const cancelRemove = (): void => {
		showRemoveModal = false
		removeRequestId = null
		removeLoading = false
	}

	$effect(() => {
		// Close dropdown when clicking outside
		const onDocumentClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement
			if (!target.closest('.relative')) {
				showItemDropdown = false
			}
		}
		document.addEventListener('click', onDocumentClick)
		return () => document.removeEventListener('click', onDocumentClick)
	})
</script>

<div class="px-2 py-3 sm:px-0 sm:py-6">
	<div class="rounded-lg border-4 border-dashed border-gray-200 p-3 sm:p-6">
		<!-- Header -->
		<div class="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-bold text-gray-900 sm:text-2xl">Stock Requests</h2>
			<div class="flex flex-col gap-3 sm:flex-row">
				{#if !showCreateForm}
					<Button variant="blue" class="w-full sm:w-auto" onclick={openCreateForm}>
						Create New Request
					</Button>
				{/if}
			</div>
		</div>

		<!-- Create New Request Form -->
		{#if showCreateForm}
			<div class="mb-4 rounded-lg bg-white p-4 shadow sm:mb-6 sm:p-6">
				<h3 class="mb-4 text-base font-medium text-gray-900 sm:text-lg">Create New Request</h3>
				<form
					onsubmit={(e) => {
						e.preventDefault()
						createNewRequest()
					}}
				>
					<div class="space-y-4 sm:grid sm:grid-cols-4 sm:gap-6 sm:space-y-0">
						<div class="col-span-2">
							<label for="item-search" class="mb-1 block text-sm font-medium text-gray-700">
								Item
							</label>
							<div class="relative">
								<input
									id="item-search"
									bind:this={itemInputRef}
									bind:value={itemSearchQuery}
									onfocus={() => (showItemDropdown = true)}
									oninput={onItemSearch}
									onkeydown={handleKeyDown}
									type="text"
									required
									class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
									placeholder="Search for an item..."
									autocomplete="off"
								/>
								<!-- Dropdown -->
								{#if showItemDropdown && filteredItems.length > 0}
									<div
										bind:this={dropdownRef}
										class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg"
									>
										{#each filteredItems as item, index (item.id)}
											<!-- svelte-ignore a11y_click_events_have_key_events -->
											<!-- svelte-ignore a11y_no_static_element_interactions -->
											<div
												data-index={index}
												onclick={() => selectItem(item)}
												class="cursor-pointer border-b border-gray-100 px-3 py-2 text-sm last:border-b-0 {index ===
												selectedItemIndex
													? 'bg-blue-100'
													: 'hover:bg-blue-50'}"
											>
												<div class="font-medium text-gray-900">{item.item_name}</div>
												<div class="text-xs text-gray-500">
													Available: {item.quantity}
													{item.unit}
												</div>
											</div>
										{/each}
									</div>
								{/if}
								<!-- No results -->
								{#if showItemDropdown && itemSearchQuery && filteredItems.length === 0}
									<div
										class="absolute z-10 mt-1 w-full rounded-md border border-gray-300 bg-white p-3 shadow-lg"
									>
										<div class="text-sm text-gray-500">No items found</div>
									</div>
								{/if}
							</div>
						</div>
						<div class="col-span-2">
							<FormField
								bind:ref={quantityInputRef}
								bind:value={
									() => newRequest.quantity, (value) => (newRequest.quantity = Number(value ?? 0))
								}
								type="number"
								label="Quantity"
								min={1}
								max={selectedItemMaxQuantity}
								disabled={!newRequest.item_id}
								required={true}
								selectOnFocus
								placeholder={selectedItemMaxQuantity
									? `Max: ${selectedItemMaxQuantity}`
									: 'Select item first'}
							/>
							{#if selectedItemMaxQuantity}
								<p class="mt-1 text-xs text-gray-500">
									Maximum available: {selectedItemMaxQuantity}
									{selectedItemUnit}
								</p>
							{/if}
						</div>
					</div>
					<div class="mt-4">
						<FormField
							bind:value={
								() => newRequest.remark ?? undefined,
								(value) => (newRequest.remark = value === undefined ? undefined : String(value))
							}
							type="textarea"
							label="Remark (Optional)"
							rows={3}
							placeholder="Enter reason for request..."
						/>
					</div>
					<div class="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
						<Button
							type="button"
							variant="gray"
							class="w-full sm:w-auto"
							onclick={cancelCreateForm}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="green"
							class="w-full sm:w-auto"
							disabled={stockRequestsStore.loading || !isFormValid}
						>
							{stockRequestsStore.loading ? 'Creating...' : 'Create Request'}
						</Button>
					</div>
				</form>
			</div>
		{/if}

		<!-- Search and Filter Bar -->
		<div class="mb-4 space-y-4 sm:mb-6">
			<!-- Search and Date Filter -->
			<div class="flex flex-col gap-4 sm:flex-row">
				<!-- Search -->
				<div class="flex-1 sm:max-w-md">
					<SearchInput bind:value={searchQuery} placeholder="Search requests..." />
				</div>

				<!-- Filter Controls -->
				<div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
					<!-- Date Filter -->
					<div class="w-full sm:w-40">
						<input
							bind:value={filterDate}
							type="date"
							class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
							disabled={showOlderPending}
							placeholder="Filter by date"
						/>
					</div>

					<!-- Clear Filters -->
					{#if showResetButton}
						<Button
							variant="soft-blue"
							class="w-full border-blue-300 sm:w-auto"
							onclick={resetToToday}
							disabled={showOlderPending}
						>
							<CalendarIcon class="h-4 w-4" />
							Show Today
						</Button>
					{/if}
				</div>
			</div>

			<!-- Show Older Pending Checkbox -->
			{#if nonTodayPendingCount > 0}
				<div class="flex items-center gap-2">
					<input
						id="show-older-pending"
						bind:checked={showOlderPending}
						type="checkbox"
						class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<label for="show-older-pending" class="text-sm font-medium text-gray-700">
						Show only {nonTodayPendingCount} older pending
					</label>
				</div>
			{/if}
		</div>

		<!-- Error Display -->
		{#if stockRequestsStore.error}
			<div class="mb-4">
				<ErrorAlert message={stockRequestsStore.error} />
			</div>
		{/if}

		<!-- Mobile Card View -->
		<div class="block lg:hidden">
			<div class="overflow-hidden bg-white shadow sm:rounded-md">
				<div class="border-b border-gray-200 px-4 py-5 sm:px-6">
					<h3 class="text-lg leading-6 font-medium text-gray-900">
						Requests ({sortedAndFilteredRequests.length})
					</h3>
				</div>
				{#if stockRequestsStore.loading && sortedAndFilteredRequests.length === 0}
					<LoadingSpinner message="Loading requests..." />
				{:else if sortedAndFilteredRequests.length === 0}
					<EmptyState
						icon="document"
						title="No requests found"
						description={showResetButton
							? 'Try adjusting your search terms or filters.'
							: 'No requests have been submitted yet.'}
					/>
				{:else}
					<div class="divide-y divide-gray-200">
						{#each pagination.paginatedItems as request (request.id)}
							<div class="px-4 py-4">
								<!-- View Mode -->
								<div class="space-y-3">
									<!-- Request Header -->
									<div class="flex items-center justify-between">
										<h4 class="mr-2 flex-1 truncate text-sm font-medium text-gray-900">
											{request.item_name}
										</h4>
										<StatusBadge variant={getStatusColor(request.status)} text={request.status} />
									</div>
									<!-- Request Details -->
									<div class="space-y-1 text-sm">
										<div class="flex items-baseline gap-2">
											<span class="flex-shrink-0 text-gray-500">Quantity:</span>
											<span class="font-medium text-gray-900">
												{request.quantity}
												{request.unit}
											</span>
										</div>
										<div class="flex items-start gap-2">
											<span class="flex-shrink-0 text-gray-500">Remark:</span>
											<span class="font-medium whitespace-pre-wrap text-gray-900">
												{request.remark || 'No Remark'}
											</span>
										</div>
									</div>
									<!-- Actions -->
									{#if request.status === 'Pending'}
										<div class="border-t border-gray-100 pt-2">
											<ActionButtonGroup
												class="w-full"
												actions={getRequestActions(request)}
												size="sm"
												loading={stockRequestsStore.loading}
												onactionclick={(actionKey) => handleActionClick(actionKey, request)}
											/>
										</div>
									{/if}
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
						totalItems={sortedAndFilteredRequests.length}
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
						Requests ({sortedAndFilteredRequests.length})
					</h3>
				</div>
				{#if stockRequestsStore.loading && sortedAndFilteredRequests.length === 0}
					<LoadingSpinner message="Loading requests..." />
				{:else if sortedAndFilteredRequests.length === 0}
					<EmptyState
						icon="document"
						title="No requests found"
						description={showResetButton
							? 'Try adjusting your search terms or filters.'
							: 'No requests have been submitted yet.'}
					/>
				{:else}
					<Table.Root>
						<SortableTableHeader columns={tableColumns} {sortConfig} onsortchange={toggleSort} />
						<Table.Body>
							{#each pagination.paginatedItems as request (request.id)}
								<Table.Row>
									<Table.Cell class="max-w-xs min-w-0 font-medium whitespace-normal">
										<div class="break-words">{request.item_name}</div>
									</Table.Cell>
									<Table.Cell>
										{request.quantity}
										{request.unit}
									</Table.Cell>
									<Table.Cell class="max-w-xs whitespace-normal">
										<div
											class="break-words whitespace-pre-wrap"
											title={request.remark || 'No Remark'}
										>
											{request.remark || 'No Remark'}
										</div>
									</Table.Cell>
									<Table.Cell>
										<StatusBadge variant={getStatusColor(request.status)} text={request.status} />
									</Table.Cell>
									<Table.Cell class="font-medium">
										{#if request.status === 'Pending'}
											<ActionButtonGroup
												actions={getRequestActions(request)}
												size="sm"
												loading={stockRequestsStore.loading}
												onactionclick={(actionKey) => handleActionClick(actionKey, request)}
											/>
										{:else}
											<span class="text-xs text-gray-400">
												{request.status === 'Approved' ? 'Completed' : 'Rejected'}
											</span>
										{/if}
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
					totalItems={sortedAndFilteredRequests.length}
					startIndex={pagination.startIndex}
					endIndex={pagination.endIndex}
					showItemsPerPageSelector={true}
					onpagechange={pagination.goToPage}
					onitemsperpagechange={pagination.updateItemsPerPage}
				/>
			</div>
		</div>
	</div>

	<!-- Remove Request Confirmation Modal -->
	<ActionModal
		bind:open={showRemoveModal}
		title="Remove Request"
		variant="red"
		confirmText="Remove"
		loading={removeLoading}
		onconfirm={confirmRemove}
		oncancel={cancelRemove}
		onclose={cancelRemove}
	>
		<div class="rounded-md border border-red-200 bg-red-50 p-3">
			<div class="mb-2 flex items-center gap-2">
				<WarningTriangleIcon class="h-4 w-4 text-red-500" />
				<span class="text-sm font-medium text-red-800">
					Warning: This action cannot be undone
				</span>
			</div>
			<p class="text-sm text-red-700">
				Are you sure you want to remove this request? This action cannot be undone.
			</p>
		</div>
	</ActionModal>

	<!-- Edit Request Modal -->
	<ActionModal
		bind:open={showEditModal}
		title={`Edit Request: ${editingRequest?.item_name}`}
		variant="green"
		loading={stockRequestsStore.loading}
		confirmText="Save Changes"
		disabled={!isEditFormValid}
		onclose={closeEditModal}
		oncancel={closeEditModal}
		onconfirm={confirmEdit}
	>
		<div class="space-y-4">
			<div class="rounded-md border border-blue-200 bg-blue-50 p-3">
				<div class="mb-2 flex items-center gap-2">
					<CogIcon class="h-4 w-4 text-blue-500" />
					<span class="text-sm font-medium text-blue-800"> Modify Request Details </span>
				</div>
				<p class="text-sm text-blue-700">
					Update the quantity and add remarks for this stock request.
				</p>
			</div>

			<div>
				<FormField
					bind:value={() => editForm.quantity, (value) => (editForm.quantity = Number(value ?? 0))}
					type="number"
					label="Quantity"
					min={1}
					max={editingRequest ? getItemMaxQuantity(editingRequest.item_id) : undefined}
					placeholder="Enter quantity"
					required={true}
					selectOnFocus
				/>
				{#if editingRequest}
					<p class="mt-1 text-xs text-gray-500">
						Max available: {getItemMaxQuantity(editingRequest.item_id)}
						{editingRequest.unit}
					</p>
				{/if}
			</div>

			<FormField
				bind:value={() => editForm.remark, (value) => (editForm.remark = String(value ?? ''))}
				type="textarea"
				label="Remark (Optional)"
				rows={3}
				placeholder="Add any notes or comments..."
				caretAtEnd
			/>
		</div>
	</ActionModal>
</div>

<script lang="ts">
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockRequestsStore } from '$lib/stores/stockRequests.svelte'
	import type { StockRequest, StockRequestId } from '$lib/types/stockRequests'

	// Component imports
	import ActionButtonGroup, {
		type ActionButtonGroupAction,
	} from '$lib/components/app/ActionButtonGroup.svelte'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import EmptyState from '$lib/components/app/EmptyState.svelte'
	import ErrorAlert from '$lib/components/app/ErrorAlert.svelte'
	import FormField from '$lib/components/app/FormField.svelte'
	import LoadingSpinner from '$lib/components/app/LoadingSpinner.svelte'
	import SearchInput from '$lib/components/app/SearchInput.svelte'
	import StatusBadge from '$lib/components/app/StatusBadge.svelte'
	import TablePagination from '$lib/components/app/TablePagination.svelte'
	import CalendarIcon from '$lib/components/icons/CalendarIcon.svelte'
	import CheckCircleIcon from '$lib/components/icons/CheckCircleIcon.svelte'
	import ChevronDownSolidIcon from '$lib/components/icons/ChevronDownSolidIcon.svelte'
	import ChevronUpSolidIcon from '$lib/components/icons/ChevronUpSolidIcon.svelte'
	import CogIcon from '$lib/components/icons/CogIcon.svelte'
	import WarningTriangleIcon from '$lib/components/icons/WarningTriangleIcon.svelte'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Input } from '$lib/components/ui/input/index.js'
	import * as Table from '$lib/components/ui/table/index.js'
	import { createPagination } from '$lib/composables/pagination.svelte'

	// State
	let searchQuery = $state<string>('')
	const today = new Date()
	let filterDate = $state<string>(
		`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
	)
	let selectedRequests = $state<StockRequestId[]>([])
	let showOlderPending = $state<boolean>(false)

	// Edit state
	const editForm = $state<{
		quantity: string | number | undefined
		remark: string | number | undefined
	}>({
		quantity: 1,
		remark: '',
	})

	// Reject modal state
	let showRejectModal = $state<boolean>(false)
	let rejectRequestIds = $state<StockRequestId[]>([])
	let rejectRemark = $state<string | number | undefined>('')

	// Bulk approval modal
	let showBulkApprovalModal = $state<boolean>(false)

	// Edit modal
	let showEditModal = $state<boolean>(false)
	let editingRequest = $state<StockRequest | null>(null)

	// Sorting configuration
	const sortConfig = $state<{
		key: keyof StockRequest | null
		direction: 'asc' | 'desc'
	}>({
		key: null,
		direction: 'asc',
	})

	// Computed properties
	const pendingRequests = $derived.by(() => {
		const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
		return stockRequestsStore.requests.filter((request) => {
			if (request.status !== 'Pending') return false
			const requestDate = new Date(request.created_at)
			const requestDateString = `${requestDate.getFullYear()}-${String(requestDate.getMonth() + 1).padStart(2, '0')}-${String(requestDate.getDate()).padStart(2, '0')}`
			return requestDateString === todayString
		})
	})

	const nonTodayPendingCount = $derived.by(() => {
		const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
		return stockRequestsStore.requests.filter((request) => {
			if (request.status !== 'Pending') return false
			const requestDate = new Date(request.created_at)
			const requestDateString = `${requestDate.getFullYear()}-${String(requestDate.getMonth() + 1).padStart(2, '0')}-${String(requestDate.getDate()).padStart(2, '0')}`
			return requestDateString !== todayString
		}).length
	})

	const approvedToday = $derived.by(() => {
		const today = new Date()
		today.setHours(0, 0, 0, 0) // Set to start of day

		const tomorrow = new Date(today)
		tomorrow.setDate(today.getDate() + 1) // Next day start

		return stockRequestsStore.requests.filter((request) => {
			if (request.status !== 'Approved') return false

			const updatedDate = new Date(request.updated_at)

			return updatedDate >= today && updatedDate < tomorrow
		}).length
	})

	// Get item names for rejected requests
	const rejectRequestItemNames = $derived(
		rejectRequestIds
			.map((id) => {
				const request = stockRequestsStore.requests.find((r) => r.id === id)
				return request?.item_name || ''
			})
			.filter(Boolean),
	)

	// Helper function to get item max quantity
	const getItemMaxQuantity = (itemId: string): number => {
		const item = inventoryStore.items.find((item) => item.id === itemId)
		return item?.quantity || 0
	}

	// Edit form validation
	const isEditFormValid = $derived.by(() => {
		if (!editingRequest) return false

		const maxQuantity = getItemMaxQuantity(editingRequest.item_id)
		const quantity = Number(editForm.quantity)
		return (
			quantity > 0 &&
			quantity <= maxQuantity &&
			(quantity !== editingRequest.quantity ||
				String(editForm.remark ?? '') !== (editingRequest.remark || ''))
		)
	})

	// Computed properties for filtering and sorting
	const sortedAndFilteredRequests = $derived.by((): StockRequest[] => {
		let requests = [...stockRequestsStore.requests]

		// Search filter
		if (searchQuery) {
			requests = stockRequestsStore.searchRequests(searchQuery)
		}

		// Date filter (applied to whatever results we have from search)
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

	const pagination = createPagination(() => sortedAndFilteredRequests)

	const allPendingSelected = $derived.by(() => {
		const pendingIds = pagination.paginatedItems
			.filter((request) => request.status === 'Pending')
			.map((request) => request.id)
		return pendingIds.length > 0 && pendingIds.every((id) => selectedRequests.includes(id))
	})

	// Check if reset to today button should be shown
	const showResetButton = $derived.by((): boolean => {
		const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
		const isDateToday = filterDate === todayString
		return !!(filterDate && !isDateToday)
	})

	// Helper functions
	const getAvailableStock = (itemId: string): number => {
		const item = inventoryStore.items.find((item) => item.id === itemId)
		return item?.quantity || 0
	}

	const hasEnoughStock = (request: StockRequest): boolean => {
		return getAvailableStock(request.item_id) >= request.quantity
	}

	// Helper function to get status badge color
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
				key: 'approve',
				label: 'Approve',
				variant: 'green',
				disabled: !hasEnoughStock(request),
			},
			{
				key: 'reject',
				label: 'Reject',
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
			case 'approve':
				approveRequest(request.id)
				break
			case 'reject':
				showRejectDialog(request.id)
				break
		}
	}

	// Edit functions
	const startEdit = (request: StockRequest): void => {
		editingRequest = request
		editForm.quantity = request.quantity
		editForm.remark = request.remark || ''
		showEditModal = true
	}

	const closeEditModal = (): void => {
		showEditModal = false
		editingRequest = null
		editForm.quantity = 1
		editForm.remark = ''
	}

	const confirmEdit = async (): Promise<void> => {
		if (!editingRequest || !isEditFormValid) return

		await saveEdit(editingRequest.id)
		if (!stockRequestsStore.error) {
			closeEditModal()
		}
	}

	const saveEdit = async (requestId: StockRequestId): Promise<void> => {
		if (!isEditFormValid) return

		await stockRequestsStore.updateRequest(
			requestId,
			Number(editForm.quantity),
			String(editForm.remark ?? ''),
		)

		// Modal cleanup is handled by confirmEdit function
	}

	// Reject functions
	const showRejectDialog = (requestId: StockRequestId): void => {
		rejectRequestIds = [requestId]
		rejectRemark = ''
		showRejectModal = true
	}

	const bulkReject = (): void => {
		if (selectedRequests.length === 0) return
		rejectRequestIds = [...selectedRequests]
		rejectRemark = ''
		showRejectModal = true
	}

	const closeRejectModal = (): void => {
		showRejectModal = false
		rejectRequestIds = []
		rejectRemark = ''
	}

	const confirmReject = async (): Promise<void> => {
		if (rejectRequestIds.length === 0) return

		for (const requestId of rejectRequestIds) {
			await stockRequestsStore.rejectRequest(requestId, String(rejectRemark ?? ''))
		}

		// Remove rejected requests from selection
		selectedRequests = selectedRequests.filter((id) => !rejectRequestIds.includes(id))

		closeRejectModal()
	}

	// Pagination functions
	const goToPage = (page: number): void => {
		pagination.currentPage = page
	}

	const updateItemsPerPage = (newItemsPerPage: number): void => {
		pagination.itemsPerPage = newItemsPerPage
		pagination.currentPage = 1 // Reset to first page
	}

	// Reset to first page when filters change
	$effect(() => {
		// reading both filters registers them as dependencies of this effect
		void searchQuery
		void filterDate
		pagination.currentPage = 1
	})

	// Sorting functions
	const toggleSort = (key: keyof StockRequest): void => {
		if (sortConfig.key === key) {
			// Same column clicked - toggle direction
			sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc'
		} else {
			// New column clicked - set ascending
			sortConfig.key = key
			sortConfig.direction = 'asc'
		}
		pagination.resetToFirstPage() // Reset to first page when sorting changes
	}

	// Reset date filter to today
	const resetToToday = (): void => {
		const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
		filterDate = todayString
		pagination.resetToFirstPage()
	}

	// Selection functions
	const toggleSelection = (requestId: StockRequestId): void => {
		const index = selectedRequests.indexOf(requestId)
		if (index > -1) {
			selectedRequests.splice(index, 1)
		} else {
			selectedRequests.push(requestId)
		}
	}

	const toggleAllSelection = (): void => {
		const pendingIds = pagination.paginatedItems
			.filter((request) => request.status === 'Pending')
			.map((request) => request.id)

		if (allPendingSelected) {
			// Deselect all
			selectedRequests = selectedRequests.filter((id) => !pendingIds.includes(id))
		} else {
			// Select all pending
			pendingIds.forEach((id) => {
				if (!selectedRequests.includes(id)) {
					selectedRequests.push(id)
				}
			})
		}
	}

	const clearSelection = (): void => {
		selectedRequests = []
	}

	// Action functions
	const approveRequest = async (requestId: StockRequestId): Promise<void> => {
		await stockRequestsStore.approveRequest(requestId)
		// Remove from selection after approval
		const index = selectedRequests.indexOf(requestId)
		if (index > -1) {
			selectedRequests.splice(index, 1)
		}
	}

	const bulkApprove = (): void => {
		if (selectedRequests.length === 0) return
		showBulkApprovalModal = true
	}

	const confirmBulkApprove = async (): Promise<void> => {
		for (const requestId of selectedRequests) {
			const request = stockRequestsStore.requests.find((r) => r.id === requestId)
			if (request && request.status === 'Pending' && hasEnoughStock(request)) {
				await stockRequestsStore.approveRequest(requestId)
			}
		}
		showBulkApprovalModal = false
		clearSelection()
	}

	const closeBulkApprovalModal = (): void => {
		showBulkApprovalModal = false
	}
</script>

<div class="px-2 py-3 sm:px-0 sm:py-6">
	<div class="rounded-lg border-4 border-dashed border-gray-200 p-3 sm:p-6">
		<!-- Header -->
		<div class="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-bold text-gray-900 sm:text-2xl">Stock Approvals</h2>
			<div class="flex items-center gap-4 text-sm text-gray-600">
				{#if nonTodayPendingCount > 0}
					<span class="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
						{nonTodayPendingCount} Older Pending
					</span>
				{/if}
				<span class="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
					{pendingRequests.length} Pending
				</span>
				<span class="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
					{approvedToday} Approved
				</span>
			</div>
		</div>

		<!-- Search and Filter Bar -->
		<div class="mb-4 space-y-4 sm:mb-6">
			<!-- Search and Date Filter -->
			<div class="flex flex-col gap-4 sm:flex-row">
				<!-- Search -->
				<div class="flex-1 sm:max-w-md">
					<SearchInput bind:value={searchQuery} placeholder="Search requests..." />
				</div>

				<!-- Date Filter and Clear Filters -->
				<div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
					<div class="w-full sm:w-40">
						<Input
							bind:value={filterDate}
							type="date"
							class="box-border block max-w-full px-3 py-2 text-sm focus:ring-1 disabled:bg-white disabled:text-gray-900 disabled:opacity-50"
							disabled={showOlderPending}
							placeholder="Filter by date"
						/>
					</div>

					<!-- Clear Filters -->
					{#if showResetButton}
						<Button
							onclick={resetToToday}
							variant="soft-blue"
							class="w-full border-blue-300 sm:w-auto"
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

		<!-- Bulk Actions -->
		{#if selectedRequests.length > 0}
			<div class="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4">
				<div class="flex items-center justify-between">
					<span class="text-sm text-blue-800">
						{selectedRequests.length} request(s) selected
					</span>
					<div class="flex gap-2">
						<Button
							onclick={bulkApprove}
							disabled={stockRequestsStore.loading}
							variant="green"
							size="sm"
						>
							Approve Selected
						</Button>
						<Button
							onclick={bulkReject}
							disabled={stockRequestsStore.loading}
							variant="red"
							size="sm"
						>
							Reject Selected
						</Button>
						<Button
							onclick={clearSelection}
							variant="gray"
							size="sm"
							class="bg-gray-500 hover:bg-gray-600"
						>
							Clear Selection
						</Button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Error Display -->
		{#if stockRequestsStore.error}
			<ErrorAlert message={stockRequestsStore.error} />
		{/if}

		<!-- Reject Modal -->
		<ActionModal
			bind:open={showRejectModal}
			title={`Reject Request${rejectRequestIds.length > 1 ? 's' : ''}: ${rejectRequestItemNames.join(', ')}`}
			variant="red"
			loading={stockRequestsStore.loading}
			confirmText={`Reject Request${rejectRequestIds.length > 1 ? 's' : ''}`}
			cancelText={`Keep Request${rejectRequestIds.length > 1 ? 's' : ''}`}
			onclose={closeRejectModal}
			oncancel={closeRejectModal}
			onconfirm={confirmReject}
		>
			<div class="space-y-4">
				<!-- Confirmation Message -->
				<div class="rounded-md border border-red-200 bg-red-50 p-3">
					<div class="mb-2 flex items-center gap-2">
						<WarningTriangleIcon class="h-4 w-4 text-red-500" />
						<span class="text-sm font-medium text-red-800">
							Warning: This action cannot be undone
						</span>
					</div>
					<p class="text-sm text-red-700">
						Are you sure you want to reject
						{rejectRequestIds.length > 1 ? `${rejectRequestIds.length} requests` : 'this request'}?
					</p>
				</div>

				<!-- Rejection Reason -->
				<FormField
					bind:value={rejectRemark}
					type="textarea"
					label="Rejection Reason (Optional)"
					rows={3}
					placeholder="Enter reason for rejection..."
				/>
			</div>
		</ActionModal>

		<!-- Bulk Approval Modal -->
		<ActionModal
			bind:open={showBulkApprovalModal}
			title="Approve Requests"
			variant="green"
			loading={stockRequestsStore.loading}
			confirmText="Approve Requests"
			cancelText="Cancel"
			onclose={closeBulkApprovalModal}
			oncancel={closeBulkApprovalModal}
			onconfirm={confirmBulkApprove}
		>
			<div class="space-y-4">
				<div class="rounded-md border border-green-200 bg-green-50 p-3">
					<div class="mb-2 flex items-center gap-2">
						<CheckCircleIcon class="h-4 w-4 text-green-500" />
						<span class="text-sm font-medium text-green-800"> Approve Selected Requests </span>
					</div>
					<p class="text-sm text-green-700">
						Are you sure you want to approve {selectedRequests.length} request(s)?
					</p>
				</div>
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
						bind:value={editForm.quantity}
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
					bind:value={editForm.remark}
					type="textarea"
					label="Remark (Optional)"
					rows={3}
					placeholder="Add any notes or comments..."
					caretAtEnd
				/>
			</div>
		</ActionModal>

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
							: 'No requests need approval at the moment.'}
					/>
				{:else}
					<div class="divide-y divide-gray-200">
						{#each pagination.paginatedItems as request (request.id)}
							<div class="px-4 py-4">
								<!-- View Mode -->
								<div class="space-y-3">
									<!-- Request Header -->
									<div class="flex items-center justify-between">
										<div class="flex min-w-0 flex-1 items-center gap-3">
											{#if request.status === 'Pending'}
												<input
													type="checkbox"
													checked={selectedRequests.includes(request.id)}
													onchange={() => toggleSelection(request.id)}
													class="h-4 w-4 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
												/>
											{/if}
											<h4 class="mr-2 flex-1 truncate text-sm font-medium text-gray-900">
												{request.item_name}
											</h4>
										</div>
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

									<!-- Stock Availability Warning -->
									{#if request.status === 'Pending' && !hasEnoughStock(request)}
										<div class="rounded border border-red-200 bg-red-50 p-2">
											<div class="flex items-center gap-2">
												<WarningTriangleIcon class="h-4 w-4 text-red-400" />
												<span class="text-xs text-red-800">Insufficient stock available</span>
											</div>
										</div>
									{/if}

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
						onpagechange={goToPage}
						onitemsperpagechange={updateItemsPerPage}
					/>
				{/if}
			</div>
		</div>

		<!-- Desktop Table View -->
		<div class="hidden lg:block">
			<div class="overflow-hidden bg-white shadow sm:rounded-md">
				<div class="border-b border-gray-200 px-4 py-5 sm:px-6">
					<div class="flex items-center justify-between">
						<h3 class="text-lg leading-6 font-medium text-gray-900">
							Requests ({sortedAndFilteredRequests.length})
						</h3>
						<div class="flex items-center gap-2">
							<input
								type="checkbox"
								checked={allPendingSelected}
								onchange={toggleAllSelection}
								class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<span class="text-sm text-gray-500">Select All Pending</span>
						</div>
					</div>
				</div>

				{#if stockRequestsStore.loading && sortedAndFilteredRequests.length === 0}
					<LoadingSpinner message="Loading requests..." />
				{:else if sortedAndFilteredRequests.length === 0}
					<EmptyState
						icon="document"
						title="No requests found"
						description={showResetButton
							? 'Try adjusting your search terms or filters.'
							: 'No requests need approval at the moment.'}
					/>
				{:else}
					<Table.Root>
						<Table.Header>
							<Table.Row class="hover:bg-transparent">
								<Table.Head class="px-0 ps-6">
									<input
										type="checkbox"
										checked={allPendingSelected}
										onchange={toggleAllSelection}
										class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
									/>
								</Table.Head>
								<Table.Head
									onclick={() => toggleSort('item_name')}
									class="cursor-pointer select-none hover:bg-gray-100"
								>
									<div class="flex items-center justify-between">
										<span>Item Name</span>
										<div class="ml-2 flex flex-col">
											<ChevronUpSolidIcon
												class="h-3 w-3 transition-colors {sortConfig.key === 'item_name' &&
												sortConfig.direction === 'asc'
													? 'text-blue-600'
													: 'text-gray-400'}"
											/>
											<ChevronDownSolidIcon
												class="-mt-1 h-3 w-3 transition-colors {sortConfig.key === 'item_name' &&
												sortConfig.direction === 'desc'
													? 'text-blue-600'
													: 'text-gray-400'}"
											/>
										</div>
									</div>
								</Table.Head>
								<Table.Head
									onclick={() => toggleSort('quantity')}
									class="cursor-pointer select-none hover:bg-gray-100"
								>
									<div class="flex items-center justify-between">
										<span>Requested</span>
										<div class="ml-2 flex flex-col">
											<ChevronUpSolidIcon
												class="h-3 w-3 transition-colors {sortConfig.key === 'quantity' &&
												sortConfig.direction === 'asc'
													? 'text-blue-600'
													: 'text-gray-400'}"
											/>
											<ChevronDownSolidIcon
												class="-mt-1 h-3 w-3 transition-colors {sortConfig.key === 'quantity' &&
												sortConfig.direction === 'desc'
													? 'text-blue-600'
													: 'text-gray-400'}"
											/>
										</div>
									</div>
								</Table.Head>
								<Table.Head>Remark</Table.Head>
								<Table.Head
									onclick={() => toggleSort('status')}
									class="cursor-pointer select-none hover:bg-gray-100"
								>
									<div class="flex items-center justify-between">
										<span>Status</span>
										<div class="ml-2 flex flex-col">
											<ChevronUpSolidIcon
												class="h-3 w-3 transition-colors {sortConfig.key === 'status' &&
												sortConfig.direction === 'asc'
													? 'text-blue-600'
													: 'text-gray-400'}"
											/>
											<ChevronDownSolidIcon
												class="-mt-1 h-3 w-3 transition-colors {sortConfig.key === 'status' &&
												sortConfig.direction === 'desc'
													? 'text-blue-600'
													: 'text-gray-400'}"
											/>
										</div>
									</div>
								</Table.Head>
								<Table.Head>Actions</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each pagination.paginatedItems as request (request.id)}
								<Table.Row
									class={request.status === 'Pending' && !hasEnoughStock(request)
										? 'bg-red-50'
										: ''}
								>
									<Table.Cell class="px-0 ps-6">
										{#if request.status === 'Pending'}
											<input
												type="checkbox"
												checked={selectedRequests.includes(request.id)}
												onchange={() => toggleSelection(request.id)}
												class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											/>
										{/if}
									</Table.Cell>
									<Table.Cell class="max-w-xs min-w-0 font-medium whitespace-normal">
										<div class="flex items-center gap-2">
											<div class="break-words">{request.item_name}</div>
											{#if request.status === 'Pending' && !hasEnoughStock(request)}
												<WarningTriangleIcon class="h-4 w-4 text-red-400" />
											{/if}
										</div>
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
												{request.status === 'Approved'
													? 'Approved'
													: request.status === 'Rejected'
														? 'Rejected'
														: 'Completed'}
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
					onpagechange={goToPage}
					onitemsperpagechange={updateItemsPerPage}
				/>
			</div>
		</div>
	</div>
</div>

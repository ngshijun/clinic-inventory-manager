<script lang="ts">
	import { untrack } from 'svelte'
	import ActionButtonGroup, {
		type ActionButtonGroupAction,
	} from '$lib/components/app/ActionButtonGroup.svelte'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import EmptyState from '$lib/components/app/EmptyState.svelte'
	import FormField from '$lib/components/app/FormField.svelte'
	import LoadingSpinner from '$lib/components/app/LoadingSpinner.svelte'
	import SearchInput from '$lib/components/app/SearchInput.svelte'
	import SortableTableHeader from '$lib/components/app/SortableTableHeader.svelte'
	import StatusBadge from '$lib/components/app/StatusBadge.svelte'
	import TablePagination from '$lib/components/app/TablePagination.svelte'
	import CloseIcon from '$lib/components/icons/CloseIcon.svelte'
	import CogIcon from '$lib/components/icons/CogIcon.svelte'
	import FilterIcon from '$lib/components/icons/FilterIcon.svelte'
	import * as Table from '$lib/components/ui/table/index.js'
	import { createPagination } from '$lib/composables/pagination.svelte'
	import { stockMovementsStore } from '$lib/stores/stockMovements.svelte'
	import type { StockMovement } from '$lib/types/stockMovements'

	let searchQuery = $state<string>('')
	let newRemark = $state<string>('')
	let showAdvancedSearch = $state<boolean>(false)

	// Edit remark modal variables
	let showEditRemarkModal = $state<boolean>(false)
	let editingMovement = $state<StockMovement | null>(null)

	// Computed property for remark validation
	const isRemarkChanged = $derived.by((): boolean => {
		if (!editingMovement) return false
		return newRemark.trim() !== (editingMovement.remark || '').trim()
	})

	// Advanced search filters
	let advancedFilters = $state({
		itemName: '',
		quantityMin: null as number | null,
		quantityMax: null as number | null,
		movementType: '',
		startDate: '',
		endDate: '',
		remark: '',
	})

	// Computed values for quantity defaults
	const quantityDefaults = $derived.by(() => {
		const movements = stockMovementsStore.movements
		if (movements.length === 0) {
			return { min: 0, max: 1000 }
		}

		const quantities = movements.map((m) => m.quantity)
		return {
			min: Math.min(...quantities),
			max: Math.max(...quantities),
		}
	})

	// Sorting configuration
	let sortConfig = $state<{
		key: keyof StockMovement | null
		direction: 'asc' | 'desc'
	}>({
		key: null,
		direction: 'asc',
	})

	// Check if any advanced filters are active
	const hasActiveFilters = $derived(
		!!(
			advancedFilters.itemName ||
			advancedFilters.quantityMin !== null ||
			advancedFilters.quantityMax !== null ||
			advancedFilters.movementType ||
			advancedFilters.startDate ||
			advancedFilters.endDate ||
			advancedFilters.remark
		),
	)

	// Advanced filtering function
	const applyAdvancedFilters = (movements: StockMovement[]): StockMovement[] => {
		return movements.filter((movement) => {
			// Quick search by item name (legacy compatibility)
			if (searchQuery && !movement.item_name.toLowerCase().includes(searchQuery.toLowerCase())) {
				return false
			}

			// Advanced item name filter
			if (
				advancedFilters.itemName &&
				!movement.item_name.toLowerCase().includes(advancedFilters.itemName.toLowerCase())
			) {
				return false
			}

			// Quantity range filter
			if (advancedFilters.quantityMin !== null && movement.quantity < advancedFilters.quantityMin) {
				return false
			}
			if (advancedFilters.quantityMax !== null && movement.quantity > advancedFilters.quantityMax) {
				return false
			}

			// Movement type filter
			if (advancedFilters.movementType && movement.movement_type !== advancedFilters.movementType) {
				return false
			}

			// Date range filters
			if (advancedFilters.startDate) {
				const movementDate = new Date(movement.created_at).toISOString().split('T')[0]
				if (movementDate < advancedFilters.startDate) {
					return false
				}
			}
			if (advancedFilters.endDate) {
				const movementDate = new Date(movement.created_at).toISOString().split('T')[0]
				if (movementDate > advancedFilters.endDate) {
					return false
				}
			}

			// Remark filter
			if (
				advancedFilters.remark &&
				!movement.remark.toLowerCase().includes(advancedFilters.remark.toLowerCase())
			) {
				return false
			}

			return true
		})
	}

	// Sorting and filtering logic
	const sortedAndFilteredMovements = $derived.by((): StockMovement[] => {
		// Start with all movements
		let movements = [...stockMovementsStore.movements]

		// Apply advanced filters
		movements = applyAdvancedFilters(movements)

		// Apply sorting
		if (sortConfig.key) {
			movements = movements.sort((a, b) => {
				const aValue = a[sortConfig.key as keyof StockMovement]
				const bValue = b[sortConfig.key as keyof StockMovement]

				// Handle string comparison
				if (typeof aValue === 'string' && typeof bValue === 'string') {
					const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase())
					return sortConfig.direction === 'asc' ? comparison : -comparison
				}

				// Handle number comparison
				if (typeof aValue === 'number' && typeof bValue === 'number') {
					return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
				}

				// Handle date comparison
				if (sortConfig.key === 'created_at') {
					const aDate = new Date(aValue as string).getTime()
					const bDate = new Date(bValue as string).getTime()
					return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate
				}

				return 0
			})
		}

		return movements
	})

	// Pagination
	const pagination = createPagination(() => sortedAndFilteredMovements)

	// Reset to first page when filters change
	$effect(() => {
		searchQuery
		advancedFilters.itemName
		advancedFilters.quantityMin
		advancedFilters.quantityMax
		advancedFilters.movementType
		advancedFilters.startDate
		advancedFilters.endDate
		advancedFilters.remark

		untrack(() => pagination.resetToFirstPage())
	})

	// Clear functions
	const clearAdvancedFilters = (): void => {
		advancedFilters = {
			itemName: '',
			quantityMin: null,
			quantityMax: null,
			movementType: '',
			startDate: '',
			endDate: '',
			remark: '',
		}
	}

	const clearAllFilters = (): void => {
		clearAdvancedFilters()
		pagination.resetToFirstPage()
	}

	// Table column configuration
	const tableColumns = [
		{ key: 'item_name', label: 'Item Name', sortable: true },
		{ key: 'quantity', label: 'Quantity', sortable: true },
		{ key: 'movement_type', label: 'Movement', sortable: true },
		{ key: 'created_at', label: 'Date/Time', sortable: true },
		{ key: 'remark', label: 'Remark', sortable: false },
		{ key: 'actions', label: 'Actions', sortable: false },
	]

	// Sorting function
	const toggleSort = (key: string): void => {
		if (sortConfig.key === key) {
			// Same column clicked - toggle direction
			sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc'
		} else {
			// New column clicked - set ascending
			sortConfig.key = key as keyof StockMovement
			sortConfig.direction = 'asc'
		}
		pagination.resetToFirstPage()
	}

	// Action button configurations
	const getMovementActions = (): Array<ActionButtonGroupAction> => {
		return [
			{
				key: 'edit-remark',
				label: 'Edit Remark',
				variant: 'blue',
			},
		]
	}

	// Handle action button clicks
	const handleActionClick = (actionKey: string, movement: StockMovement) => {
		switch (actionKey) {
			case 'edit-remark':
				startEditRemark(movement)
				break
		}
	}

	const startEditRemark = (movement: StockMovement): void => {
		openEditRemarkModal(movement)
	}

	// Edit remark modal functions
	const openEditRemarkModal = (movement: StockMovement): void => {
		editingMovement = movement
		newRemark = movement.remark || ''
		showEditRemarkModal = true
	}

	const closeEditRemarkModal = (): void => {
		showEditRemarkModal = false
		editingMovement = null
		newRemark = ''
	}

	const confirmSaveRemark = async (): Promise<void> => {
		if (!editingMovement || !isRemarkChanged) return

		await saveRemark(editingMovement.id)
		if (!stockMovementsStore.error) {
			closeEditRemarkModal()
		}
	}

	const saveRemark = async (movementId: string): Promise<void> => {
		await stockMovementsStore.updateRemark(movementId, newRemark)
	}

	const formatDateTime = (datetime: string): string => {
		const date = new Date(datetime)
		const dateStr = date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		})
		const timeStr = date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: true,
		})
		return `${dateStr}\n${timeStr}`
	}
</script>

<div class="px-2 py-3 sm:px-0 sm:py-6">
	<div class="rounded-lg border-4 border-dashed border-gray-200 p-3 sm:p-6">
		<!-- Header -->
		<div class="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-bold text-gray-900 sm:text-2xl">Stock Movements</h2>
		</div>

		<!-- Search Bar -->
		<div class="mb-4 sm:mb-6">
			<div class="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
				<!-- Quick Search -->
				<div class="w-full flex-1 sm:max-w-md">
					<SearchInput bind:value={searchQuery} placeholder="Search items..." />
				</div>

				<!-- Advanced Search Toggle -->
				<div class="flex flex-row gap-2">
					<button
						onclick={() => (showAdvancedSearch = !showAdvancedSearch)}
						class="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
					>
						<FilterIcon class="h-4 w-4" />
						{showAdvancedSearch ? 'Hide Filters' : 'Advanced Search'}
					</button>

					<!-- Clear Filters (visible when filters are active) -->
					{#if hasActiveFilters}
						<button
							onclick={clearAllFilters}
							class="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
						>
							<CloseIcon class="h-4 w-4" />
							Clear Filters
						</button>
					{/if}
				</div>
			</div>

			<!-- Advanced Search Panel -->
			{#if showAdvancedSearch}
				<div class="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
					<h4 class="mb-4 text-sm font-medium text-gray-900">Advanced Search Filters</h4>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<!-- Item Name Filter -->
						<FormField
							bind:value={advancedFilters.itemName}
							type="text"
							label="Item Name"
							placeholder="Filter by item name..."
						/>

						<!-- Quantity Range -->
						<div>
							<!-- svelte-ignore a11y_label_has_associated_control -->
							<label class="mb-1 block text-xs font-medium text-gray-700">Quantity Range</label>
							<div class="flex gap-2">
								<input
									bind:value={advancedFilters.quantityMin}
									type="number"
									min="0"
									placeholder={`Min (${quantityDefaults.min})`}
									class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
								/>
								<input
									bind:value={advancedFilters.quantityMax}
									type="number"
									min="0"
									placeholder={`Max (${quantityDefaults.max})`}
									class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
								/>
							</div>
							<div class="mt-1 text-xs text-gray-500">
								Range: {quantityDefaults.min} - {quantityDefaults.max} units
							</div>
						</div>

						<!-- Movement Type -->
						<div>
							<!-- svelte-ignore a11y_label_has_associated_control -->
							<label class="mb-1 block text-xs font-medium text-gray-700">Movement Type</label>
							<select
								bind:value={advancedFilters.movementType}
								class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							>
								<option value="">All Movements</option>
								<option value="stock_in">Stock In Only</option>
								<option value="stock_out">Stock Out Only</option>
							</select>
						</div>

						<!-- Start Date -->
						<FormField bind:value={advancedFilters.startDate} type="date" label="Start Date" />

						<!-- End Date -->
						<FormField bind:value={advancedFilters.endDate} type="date" label="End Date" />

						<!-- Remark Filter -->
						<FormField
							bind:value={advancedFilters.remark}
							type="text"
							label="Remark"
							placeholder="Filter by remark..."
						/>
					</div>

					<!-- Filter Actions -->
					<div class="mt-4 flex items-center justify-between">
						<div class="text-xs text-gray-600">
							Showing {stockMovementsStore.movements.length} movements
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Mobile Card View -->
		<div class="block lg:hidden">
			<div class="overflow-hidden bg-white shadow sm:rounded-md">
				<div class="border-b border-gray-200 px-4 py-5 sm:px-6">
					<h3 class="text-lg leading-6 font-medium text-gray-900">
						Movements ({sortedAndFilteredMovements.length})
					</h3>
				</div>

				{#if stockMovementsStore.loading && sortedAndFilteredMovements.length === 0}
					<LoadingSpinner message="Loading movements..." />
				{:else if sortedAndFilteredMovements.length === 0}
					<EmptyState
						icon="chart"
						title="No movements found"
						description={searchQuery
							? 'Try adjusting your search terms.'
							: 'Stock movements will appear here when you manage inventory.'}
					/>
				{:else}
					<div class="divide-y divide-gray-200">
						{#each pagination.paginatedItems as movement (movement.id)}
							<div class="px-4 py-4">
								<div class="space-y-3">
									<!-- Movement Header -->
									<div class="flex items-center justify-between">
										<h4 class="mr-2 flex-1 truncate text-sm font-medium text-gray-900">
											{movement.item_name}
										</h4>
										<StatusBadge
											variant={movement.movement_type === 'stock_in' ? 'green' : 'red'}
											text={movement.movement_type === 'stock_in'
												? 'Stock In (+)'
												: 'Stock Out (-)'}
										/>
									</div>

									<!-- Movement Details -->
									<div class="space-y-1 text-sm">
										<div class="flex items-baseline gap-2">
											<span class="flex-shrink-0 text-gray-500">Quantity:</span>
											<span class="font-medium text-gray-900">
												{movement.quantity}
												{movement.unit}
											</span>
										</div>
										<div class="flex items-baseline gap-2">
											<span class="flex-shrink-0 text-gray-500">Date/Time:</span>
											<span class="font-medium text-gray-900">
												{formatDateTime(movement.created_at)}
											</span>
										</div>
										<div class="flex items-start gap-2">
											<span class="flex-shrink-0 text-gray-500">Remark:</span>
											<span class="font-medium whitespace-pre-wrap text-gray-900">
												{movement.remark || 'No remark'}
											</span>
										</div>
									</div>

									<!-- Actions -->
									<div class="border-t border-gray-100 pt-2">
										<ActionButtonGroup
											class="w-full"
											actions={getMovementActions()}
											size="sm"
											loading={stockMovementsStore.loading}
											onactionclick={(actionKey) => handleActionClick(actionKey, movement)}
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
						totalItems={sortedAndFilteredMovements.length}
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
						Movements ({sortedAndFilteredMovements.length})
					</h3>
				</div>

				{#if stockMovementsStore.loading && sortedAndFilteredMovements.length === 0}
					<LoadingSpinner message="Loading movements..." />
				{:else if sortedAndFilteredMovements.length === 0}
					<EmptyState
						icon="chart"
						title="No movements found"
						description={searchQuery
							? 'Try adjusting your search terms.'
							: 'Stock movements will appear here when you manage inventory.'}
					/>
				{:else}
					<Table.Root>
						<SortableTableHeader columns={tableColumns} {sortConfig} onsortchange={toggleSort} />
						<Table.Body>
							{#each pagination.paginatedItems as movement (movement.id)}
								<Table.Row>
									<Table.Cell
										class="max-w-xs min-w-0 px-6 py-4 text-sm font-medium whitespace-normal text-gray-900"
									>
										<div class="break-words">{movement.item_name}</div>
									</Table.Cell>
									<Table.Cell class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
										{movement.quantity}
										{movement.unit}
									</Table.Cell>
									<Table.Cell class="px-6 py-4 whitespace-nowrap">
										<StatusBadge
											variant={movement.movement_type === 'stock_in' ? 'green' : 'red'}
											text={movement.movement_type === 'stock_in'
												? 'Stock In (+)'
												: 'Stock Out (-)'}
										/>
									</Table.Cell>
									<Table.Cell class="px-6 py-4 text-sm text-gray-900" style="white-space: pre-line">
										{formatDateTime(movement.created_at)}
									</Table.Cell>
									<Table.Cell class="px-6 py-4 text-sm whitespace-normal text-gray-900">
										<div class="max-w-xs whitespace-pre-wrap">
											<p>{movement.remark || 'No remark'}</p>
										</div>
									</Table.Cell>
									<Table.Cell class="px-6 py-4 text-sm font-medium whitespace-nowrap">
										<ActionButtonGroup
											actions={getMovementActions()}
											size="sm"
											loading={stockMovementsStore.loading}
											onactionclick={(actionKey) => handleActionClick(actionKey, movement)}
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
					totalItems={sortedAndFilteredMovements.length}
					startIndex={pagination.startIndex}
					endIndex={pagination.endIndex}
					showItemsPerPageSelector={true}
					onpagechange={pagination.goToPage}
					onitemsperpagechange={pagination.updateItemsPerPage}
				/>
			</div>
		</div>
	</div>

	<!-- Edit Remark Modal -->
	<ActionModal
		bind:open={showEditRemarkModal}
		title={`Edit Remark: ${editingMovement?.item_name}`}
		variant="green"
		loading={stockMovementsStore.loading}
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
					<span class="text-sm font-medium text-blue-800"> Update Movement Information </span>
				</div>
				<p class="text-sm text-blue-700">
					Add notes or comments about this stock movement for future reference.
				</p>
			</div>

			<FormField
				bind:value={newRemark}
				type="textarea"
				label="Remark"
				rows={3}
				placeholder="Enter remark..."
			/>
		</div>
	</ActionModal>
</div>

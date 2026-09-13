<script lang="ts">
	import { goto } from '$app/navigation'
	import ArrowUpIcon from '$lib/components/icons/ArrowUpIcon.svelte'
	import BoxIcon from '$lib/components/icons/BoxIcon.svelte'
	import CalendarIcon from '$lib/components/icons/CalendarIcon.svelte'
	import ClockIcon from '$lib/components/icons/ClockIcon.svelte'
	import ClockSolidIcon from '$lib/components/icons/ClockSolidIcon.svelte'
	import CloseIcon from '$lib/components/icons/CloseIcon.svelte'
	import ExclamationCircleIcon from '$lib/components/icons/ExclamationCircleIcon.svelte'
	import WarningIcon from '$lib/components/icons/WarningIcon.svelte'
	import WarningTriangleIcon from '$lib/components/icons/WarningTriangleIcon.svelte'
	import ActionButtonGroup, {
		type ActionButtonGroupAction,
	} from '$lib/components/app/ActionButtonGroup.svelte'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import ErrorAlert from '$lib/components/app/ErrorAlert.svelte'
	import FormField from '$lib/components/app/FormField.svelte'
	import LoadingSpinner from '$lib/components/app/LoadingSpinner.svelte'
	import ReasonBadge from '$lib/components/app/ReasonBadge.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import type { InventoryItem } from '$lib/types/inventory'

	// Order modal variables
	let showOrderModal = $state<boolean>(false)
	let orderItem = $state<InventoryItem | null>(null)
	let orderDate = $state<string | number | undefined>('')
	let backOrder = $state<boolean>(false)

	// Dropdown toggle states
	let isOutOfStockOpen = $state(false)
	let isLowStockOpen = $state(false)
	let isStaleInventoryOpen = $state(false)

	const toggleSection = (section: 'outOfStock' | 'lowStock' | 'staleInventory') => {
		switch (section) {
			case 'outOfStock':
				isOutOfStockOpen = !isOutOfStockOpen
				break
			case 'lowStock':
				isLowStockOpen = !isLowStockOpen
				break
			case 'staleInventory':
				isStaleInventoryOpen = !isStaleInventoryOpen
				break
		}
	}

	// Back to top button visibility
	let showBackToTop = $state<boolean>(false)

	// Order modal functions
	const openOrderModal = (item: InventoryItem): void => {
		orderItem = item
		orderDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
			.toISOString()
			.slice(0, 10)
		showOrderModal = true
		backOrder = false
	}

	const closeOrderModal = (): void => {
		showOrderModal = false
		orderItem = null
		orderDate = ''
		backOrder = false
	}

	// Set non-order reason for an item
	const setItemNonOrderReason = async (itemId: string, reason: string): Promise<void> => {
		await inventoryStore.setNonOrderReason(itemId, reason)
	}

	// Clear non-order reason for an item
	const clearItemNonOrderReason = async (itemId: string): Promise<void> => {
		await inventoryStore.setNonOrderReason(itemId, null)
	}

	// Clear order date for an item
	const clearOrderDate = async (itemId: string): Promise<void> => {
		await inventoryStore.clearOrderDate(itemId)
	}

	// Action button configurations for items
	const getItemActions = (item: InventoryItem): Array<ActionButtonGroupAction> => {
		const actions: Array<ActionButtonGroupAction> = []

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
				variant: 'blue',
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
	const handleActionClick = async (actionKey: string, item: InventoryItem) => {
		switch (actionKey) {
			case 'mark-ordered':
				openOrderModal(item)
				return
			case 'clear-date':
				await clearOrderDate(item.id)
				break
			case 'alternative-ordered':
				await setItemNonOrderReason(item.id, 'Alternative ordered')
				break
			case 'planning-to-order-later':
				await setItemNonOrderReason(item.id, 'Planning to order later')
				break
			case 'supplier-no-stock':
				await setItemNonOrderReason(item.id, 'Supplier has no stock')
				break
			case 'clear-reason':
				await clearItemNonOrderReason(item.id)
				break
		}
	}

	// Calculate stale items (not updated for more than 30 days)
	const staleItems = $derived.by(() => {
		const thirtyDaysAgo = new Date()
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

		return inventoryStore.items
			.map((item) => {
				const updatedAt = new Date(item.updated_at)

				const daysSinceUpdate = Math.floor(
					(Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24),
				)

				return {
					...item,
					daysSinceUpdate,
					isStale: updatedAt < thirtyDaysAgo,
				}
			})
			.filter((item) => !item.not_track && item.isStale && item.quantity !== 0)
			.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate) // Sort by oldest first
	})

	// Navigate to inventory page
	const navigateToInventory = () => {
		goto('/inventory')
	}

	// Scroll to section function
	const scrollToSection = (sectionId: string) => {
		const element = document.getElementById(sectionId)
		if (element) {
			element.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
			})
		}
	}

	// Scroll to top function
	const scrollToTop = () => {
		window.scrollTo({
			top: 0,
			behavior: 'smooth',
		})
	}

	// Handle scroll event for back to top button
	const handleScroll = () => {
		showBackToTop = window.scrollY > 300
	}

	// Format duration for display
	const formatDuration = (days: number): string => {
		if (days < 7) {
			return `${days} day${days !== 1 ? 's' : ''}`
		} else if (days < 30) {
			const weeks = Math.floor(days / 7)
			return `${weeks} week${weeks !== 1 ? 's' : ''}`
		} else if (days < 365) {
			const months = Math.floor(days / 30)
			return `${months} month${months !== 1 ? 's' : ''}`
		} else {
			const years = Math.floor(days / 365)
			return `${years} year${years !== 1 ? 's' : ''}`
		}
	}

	// Format date for display
	const formatDate = (dateString: string): string => {
		const date = new Date(dateString)
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		})
	}

	// ReasonBadge centralizes the presentation for non_order_reason

	const confirmMarkAsOrdered = async (): Promise<void> => {
		if (!orderItem || !orderDate) return

		// Mark ordered using the store function with selected date
		await inventoryStore.markAsOrdered(orderItem.id, String(orderDate), backOrder)

		if (!inventoryStore.error) {
			closeOrderModal()
		}
	}

	$effect(() => {
		window.addEventListener('scroll', handleScroll)

		return () => {
			window.removeEventListener('scroll', handleScroll)
		}
	})
</script>

<div class="px-2 py-3 sm:px-0 sm:py-6">
	<div class="rounded-lg border-4 border-dashed border-gray-200 p-3 sm:p-6">
		<h2 class="mb-4 text-xl font-bold text-gray-900 sm:mb-6 sm:text-2xl">Inventory Dashboard</h2>

		<!-- Mark as Ordered Modal -->
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

		<!-- Loading State (non-blocking overlay/inline) -->
		{#if inventoryStore.loading}
			<LoadingSpinner message="Loading inventory data..." size="lg" />
		{/if}

		<!-- Error State (independent, does not block content) -->
		{#if inventoryStore.error}
			<div class="mb-4 sm:mb-6">
				<ErrorAlert title="Error loading data" message={inventoryStore.error} size="lg">
					<button
						onclick={() => inventoryStore.fetchItems()}
						class="mt-2 rounded bg-red-100 px-2 py-1 text-xs text-red-800 hover:bg-red-200 sm:px-3 sm:text-sm"
					>
						Retry
					</button>
				</ErrorAlert>
			</div>
		{/if}

		<!-- Dashboard Content (always rendered to preserve scroll position) -->
		<div>
			<!-- Stats Cards - Responsive Grid -->
			<!-- Simplified Enhanced Hover Effects -->
			<div class="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
				<!-- Total Products -->
				<div
					class="hover:ring-opacity-50 cursor-pointer overflow-hidden rounded-lg bg-white shadow transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg hover:ring-2 hover:ring-green-500"
					onclick={() => navigateToInventory()}
					title="Click to view full inventory"
					role="presentation"
				>
					<div class="p-3 sm:p-5">
						<div class="flex items-center">
							<div class="flex-shrink-0">
								<div
									class="flex h-6 w-6 items-center justify-center rounded-md bg-green-500 transition-colors duration-200 hover:bg-green-600 sm:h-8 sm:w-8"
								>
									<BoxIcon class="h-3 w-3 text-white sm:h-5 sm:w-5" />
								</div>
							</div>
							<div class="ml-3 w-0 flex-1 sm:ml-5">
								<dl>
									<dt class="truncate text-xs font-medium text-gray-500 sm:text-sm">
										Total Products
									</dt>
									<dd class="text-base font-medium text-gray-900 sm:text-lg">
										{inventoryStore.totalProducts}
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>

				<!-- Out of Stock Items -->
				<div
					class="hover:ring-opacity-50 cursor-pointer overflow-hidden rounded-lg bg-white shadow transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg hover:ring-2 hover:ring-red-500"
					onclick={() => scrollToSection('out-of-stock')}
					title={inventoryStore.outOfStockItems.length > 0
						? 'Click to view out of stock items'
						: ''}
					role="presentation"
				>
					<div class="p-3 sm:p-5">
						<div class="flex items-center">
							<div class="flex-shrink-0">
								<div
									class="flex h-6 w-6 items-center justify-center rounded-md bg-red-500 transition-colors duration-200 hover:bg-red-600 sm:h-8 sm:w-8"
								>
									<CloseIcon class="h-3 w-3 text-white sm:h-5 sm:w-5" />
								</div>
							</div>
							<div class="ml-3 w-0 flex-1 sm:ml-5">
								<dl>
									<dt class="truncate text-xs font-medium text-gray-500 sm:text-sm">
										Out of Stock
									</dt>
									<dd class="text-base font-medium text-gray-900 sm:text-lg">
										{inventoryStore.outOfStockItems.length}
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>

				<!-- Low Stock Items -->
				<div
					class="hover:ring-opacity-50 cursor-pointer overflow-hidden rounded-lg bg-white shadow transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg hover:ring-2 hover:ring-yellow-500"
					onclick={() => scrollToSection('low-stock')}
					title="Click to view low stock items"
					role="presentation"
				>
					<div class="p-3 sm:p-5">
						<div class="flex items-center">
							<div class="flex-shrink-0">
								<div
									class="flex h-6 w-6 items-center justify-center rounded-md bg-yellow-500 transition-colors duration-200 hover:bg-yellow-600 sm:h-8 sm:w-8"
								>
									<WarningIcon class="h-3 w-3 text-white sm:h-5 sm:w-5" />
								</div>
							</div>
							<div class="ml-3 w-0 flex-1 sm:ml-5">
								<dl>
									<dt class="truncate text-xs font-medium text-gray-500 sm:text-sm">Low Stock</dt>
									<dd class="text-base font-medium text-gray-900 sm:text-lg">
										{inventoryStore.lowStockItems.length}
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>

				<!-- Stale Inventory -->
				<div
					class="hover:ring-opacity-50 cursor-pointer overflow-hidden rounded-lg bg-white shadow transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg hover:ring-2 hover:ring-purple-500"
					onclick={() => scrollToSection('stale-inventory')}
					title="Click to view stale inventory items"
					role="presentation"
				>
					<div class="p-3 sm:p-5">
						<div class="flex items-center">
							<div class="flex-shrink-0">
								<div
									class="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500 transition-colors duration-200 hover:bg-purple-600 sm:h-8 sm:w-8"
								>
									<ClockIcon class="h-3 w-3 text-white sm:h-5 sm:w-5" />
								</div>
							</div>
							<div class="ml-3 w-0 flex-1 sm:ml-5">
								<dl>
									<dt class="truncate text-xs font-medium text-gray-500 sm:text-sm">Stale Items</dt>
									<dd class="text-base font-medium text-gray-900 sm:text-lg">
										{staleItems.length}
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Out of Stock Alert -->
			{#if inventoryStore.outOfStockItems.length > 0}
				<div
					id="out-of-stock"
					class="mb-4 scroll-mt-4 rounded-md border border-red-200 bg-red-50 p-3 sm:mb-6 sm:p-4"
				>
					<div
						class="flex cursor-pointer items-center justify-between"
						onclick={() => toggleSection('outOfStock')}
						role="presentation"
					>
						<div class="flex items-center gap-2">
							<ExclamationCircleIcon class="h-4 w-4 text-red-400 sm:h-5 sm:w-5" />
							<h3 class="text-sm font-medium text-red-800">Out of Stock Alert</h3>
						</div>
						<ArrowUpIcon
							class="h-4 w-4 transform transition-transform duration-200 {!isOutOfStockOpen
								? 'rotate-180'
								: ''}"
						/>
					</div>

					{#if isOutOfStockOpen}
						<div class="mt-2 text-sm text-red-700">
							<p>The following items are completely out of stock:</p>
							<div class="mt-1 space-y-1">
								{#each inventoryStore.outOfStockItems as item (item.id)}
									<div class="flex items-start border-b border-red-200 py-2 last:border-b-0">
										<div
											class="mt-1.5 mr-3 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400"
										></div>
										<div class="flex-1">
											<!-- Mobile: Stack vertically, Desktop: Grid layout -->
											<div class="block sm:hidden">
												<div class="font-semibold break-words text-gray-900">
													{item.item_name}
												</div>
												<div class="mt-0.5 text-sm font-medium text-red-700">
													(0 {item.unit} remaining)
												</div>
												<!-- Status text and ActionButtonGroup aligned horizontally -->
												<div class="mt-1 flex items-center justify-between gap-2">
													<!-- Status text -->
													<div class="flex items-center">
														{#if item.order_date}
															<div class="text-sm text-blue-600">
																{#if item.back_order}
																	<span class="inline-flex items-center gap-1">
																		<ClockIcon class="h-4 w-4" />
																		Back Ordered: {formatDate(item.order_date)}
																	</span>
																{:else}
																	<span class="inline-flex items-center gap-1">
																		<CalendarIcon class="h-4 w-4" />
																		Ordered: {formatDate(item.order_date)}
																	</span>
																{/if}
															</div>
														{:else if item.non_order_reason}
															<div class="text-sm">
																<ReasonBadge reason={item.non_order_reason} size="sm">
																	{item.non_order_reason}
																</ReasonBadge>
															</div>
														{/if}
													</div>
													<!-- ActionButtonGroup -->
													<div class="flex-shrink-0">
														<ActionButtonGroup
															actions={getItemActions(item)}
															size="sm"
															loading={inventoryStore.loading}
															onactionclick={(actionKey) => handleActionClick(actionKey, item)}
														/>
													</div>
												</div>
											</div>
											<div class="hidden sm:flex sm:items-center sm:justify-between">
												<div class="min-w-0 flex-1">
													<div class="font-semibold break-words text-gray-900">
														{item.item_name}
													</div>
													<div class="mt-0.5 text-sm font-medium text-red-700">
														(0 {item.unit} remaining)
													</div>
												</div>
												<div class="ml-4 flex-shrink-0">
													<!-- Status text and ActionButtonGroup aligned horizontally -->
													<div class="flex items-center gap-3">
														<!-- Status text -->
														<div>
															{#if item.order_date}
																<div class="text-sm text-blue-600">
																	{#if item.back_order}
																		<span class="inline-flex items-center gap-1">
																			<ClockIcon class="h-4 w-4" />
																			Back Ordered: {formatDate(item.order_date)}
																		</span>
																	{:else}
																		<span class="inline-flex items-center gap-1">
																			<CalendarIcon class="h-4 w-4" />
																			Ordered: {formatDate(item.order_date)}
																		</span>
																	{/if}
																</div>
															{:else if item.non_order_reason}
																<div class="text-sm">
																	<ReasonBadge reason={item.non_order_reason} size="sm">
																		{item.non_order_reason}
																	</ReasonBadge>
																</div>
															{/if}
														</div>
														<!-- ActionButtonGroup -->
														<div>
															<ActionButtonGroup
																actions={getItemActions(item)}
																size="sm"
																loading={inventoryStore.loading}
																onactionclick={(actionKey) => handleActionClick(actionKey, item)}
															/>
														</div>
													</div>
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Low Stock Alert -->
			{#if inventoryStore.lowStockItems.length > 0}
				<div
					id="low-stock"
					class="mb-4 scroll-mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 sm:mb-6 sm:p-4"
				>
					<div
						class="flex cursor-pointer items-center justify-between"
						onclick={() => toggleSection('lowStock')}
						role="presentation"
					>
						<div class="flex items-center gap-2">
							<WarningTriangleIcon class="h-4 w-4 text-yellow-400 sm:h-5 sm:w-5" />
							<h3 class="text-sm font-medium text-yellow-800">Low Stock Alert</h3>
						</div>
						<ArrowUpIcon
							class="h-4 w-4 transform transition-transform duration-200 {!isLowStockOpen
								? 'rotate-180'
								: ''}"
						/>
					</div>

					{#if isLowStockOpen}
						<div class="mt-2 text-sm text-yellow-700">
							<p>The following items are running low on stock:</p>
							<div class="mt-1 space-y-1">
								{#each inventoryStore.lowStockItems as item (item.id)}
									<div class="flex items-start border-b border-yellow-200 py-2 last:border-b-0">
										<div
											class="mt-1.5 mr-3 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-400"
										></div>
										<div class="flex-1">
											<!-- Mobile: Stack vertically, Desktop: Grid layout -->
											<div class="block sm:hidden">
												<div class="font-semibold break-words text-gray-900">
													{item.item_name}
												</div>
												<div class="mt-0.5 text-sm font-medium text-yellow-700">
													({item.quantity}
													{item.unit} remaining)
												</div>
												<!-- Status text and ActionButtonGroup aligned horizontally -->
												<div class="mt-1 flex items-center justify-between gap-2">
													<!-- Status text -->
													<div class="flex items-center">
														{#if item.order_date}
															<div class="text-sm text-blue-600">
																{#if item.back_order}
																	<span class="inline-flex items-center gap-1">
																		<ClockIcon class="h-4 w-4" />
																		Back Ordered: {formatDate(item.order_date)}
																	</span>
																{:else}
																	<span class="inline-flex items-center gap-1">
																		<CalendarIcon class="h-4 w-4" />
																		Ordered: {formatDate(item.order_date)}
																	</span>
																{/if}
															</div>
														{:else if item.non_order_reason}
															<div class="text-sm">
																<ReasonBadge reason={item.non_order_reason} size="sm">
																	{item.non_order_reason}
																</ReasonBadge>
															</div>
														{/if}
													</div>
													<!-- ActionButtonGroup -->
													<div class="flex-shrink-0">
														<ActionButtonGroup
															actions={getItemActions(item)}
															size="sm"
															loading={inventoryStore.loading}
															onactionclick={(actionKey) => handleActionClick(actionKey, item)}
														/>
													</div>
												</div>
											</div>
											<div class="hidden sm:flex sm:items-center sm:justify-between">
												<div class="min-w-0 flex-1">
													<div class="font-semibold break-words text-gray-900">
														{item.item_name}
													</div>
													<div class="mt-0.5 text-sm font-medium text-yellow-700">
														({item.quantity}
														{item.unit} remaining)
													</div>
												</div>
												<div class="ml-4 flex-shrink-0">
													<!-- Status text and ActionButtonGroup aligned horizontally -->
													<div class="flex items-center gap-3">
														<!-- Status text -->
														<div>
															{#if item.order_date}
																<div class="text-sm text-blue-600">
																	{#if item.back_order}
																		<span class="inline-flex items-center gap-1">
																			<ClockIcon class="h-4 w-4" />
																			Back Ordered: {formatDate(item.order_date)}
																		</span>
																	{:else}
																		<span class="inline-flex items-center gap-1">
																			<CalendarIcon class="h-4 w-4" />
																			Ordered: {formatDate(item.order_date)}
																		</span>
																	{/if}
																</div>
															{:else if item.non_order_reason}
																<div class="text-sm">
																	<ReasonBadge reason={item.non_order_reason} size="sm">
																		{item.non_order_reason}
																	</ReasonBadge>
																</div>
															{/if}
														</div>
														<!-- ActionButtonGroup -->
														<div>
															<ActionButtonGroup
																actions={getItemActions(item)}
																size="sm"
																loading={inventoryStore.loading}
																onactionclick={(actionKey) => handleActionClick(actionKey, item)}
															/>
														</div>
													</div>
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Stale Inventory Alert -->
			{#if staleItems.length > 0}
				<div
					id="stale-inventory"
					class="mb-4 scroll-mt-4 rounded-md border border-purple-200 bg-purple-50 p-3 sm:mb-6 sm:p-4"
				>
					<div
						class="flex cursor-pointer items-center justify-between"
						onclick={() => toggleSection('staleInventory')}
						role="presentation"
					>
						<div class="flex items-center gap-2">
							<ClockSolidIcon class="h-4 w-4 text-purple-400 sm:h-5 sm:w-5" />
							<h3 class="text-sm font-medium text-purple-800">Stale Inventory Alert</h3>
						</div>
						<ArrowUpIcon
							class="h-4 w-4 transform transition-transform duration-200 {!isStaleInventoryOpen
								? 'rotate-180'
								: ''}"
						/>
					</div>

					{#if isStaleInventoryOpen}
						<div class="mt-2 text-sm text-purple-700">
							<p>The following items have not been updated for more than a month:</p>
							<div class="mt-1 space-y-1">
								{#each staleItems as item (item.id)}
									<div class="flex items-start border-b border-purple-200 py-2 last:border-b-0">
										<div
											class="mt-1.5 mr-3 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-400"
										></div>
										<div class="flex-1">
											<!-- Mobile: Stack vertically, Desktop: Grid layout -->
											<div class="block sm:hidden">
												<div class="font-semibold break-words text-gray-900">
													{item.item_name}
												</div>
												<div class="mt-0.5 text-sm font-medium text-purple-700">
													({formatDuration(item.daysSinceUpdate)} ago)
												</div>
											</div>
											<div class="hidden sm:flex sm:items-center sm:justify-between">
												<div class="min-w-0 flex-1">
													<div class="font-semibold break-words text-gray-900">
														{item.item_name}
													</div>
													<div class="mt-0.5 text-sm font-medium text-purple-700">
														({formatDuration(item.daysSinceUpdate)} ago)
													</div>
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Floating Back to Top Button -->
	{#if showBackToTop}
		<button
			onclick={scrollToTop}
			class="fixed right-6 bottom-6 z-50 rounded-full bg-blue-600 p-3 text-white shadow-lg transition-all duration-200 hover:bg-blue-700"
			title="Back to top"
		>
			<ArrowUpIcon class="h-5 w-5" />
		</button>
	{/if}
</div>

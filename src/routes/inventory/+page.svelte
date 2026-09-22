<script lang="ts">
	import { tick, untrack } from 'svelte'
	import * as XLSX from 'xlsx'
	import { selectOnFocus } from '$lib/attachments/focus'
	import ArrowDownIcon from '$lib/components/icons/ArrowDownIcon.svelte'
	import ArrowUpSolidIcon from '$lib/components/icons/ArrowUpSolidIcon.svelte'
	import ClockIcon from '$lib/components/icons/ClockIcon.svelte'
	import CalendarIcon from '$lib/components/icons/CalendarIcon.svelte'
	import CheckCircleIcon from '$lib/components/icons/CheckCircleIcon.svelte'
	import EyeIcon from '$lib/components/icons/EyeIcon.svelte'
	import WarningTriangleIcon from '$lib/components/icons/WarningTriangleIcon.svelte'
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
	import SortableTableHeader from '$lib/components/app/SortableTableHeader.svelte'
	import StatusBadge from '$lib/components/app/StatusBadge.svelte'
	import TablePagination from '$lib/components/app/TablePagination.svelte'
	import { Button } from '$lib/components/ui/button/index.js'
	import * as Table from '$lib/components/ui/table/index.js'
	import { createPagination } from '$lib/composables/pagination.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockBatchesStore } from '$lib/stores/stockBatches.svelte'
	import type { InventoryItem, NewInventoryItem, StockStatus } from '$lib/types/inventory'
	import {
		EXPIRY_WARNING_DAYS,
		daysUntilExpiry,
		getExpiryStatus,
		todayIsoDate,
		type ExpiryStatus,
		type StockBatch,
	} from '$lib/types/stockBatches'

	let searchQuery = $state<string>('')
	let showAddForm = $state<boolean>(false)
	let showOrderedOnly = $state<boolean>(false)
	let stockQuantity = $state<number>(1)
	let fileInput = $state<HTMLInputElement | null>(null)
	let itemNameInputRef = $state<HTMLInputElement | null>(null)

	// New stock in modal variables
	let showStockInModal = $state<boolean>(false)
	let stockInItem = $state<InventoryItem | null>(null)
	let clearOrderDate = $state<boolean>(true) // Default to clearing order date
	let notTrackStatus = $state<boolean>(false)
	let stockInExpiryDate = $state<string>('')

	// Edit item details modal variables
	let showEditModal = $state<boolean>(false)
	let editingItem = $state<InventoryItem | null>(null)
	interface EditItemForm {
		item_name: string | number | undefined
		unit: string | number | undefined
		reorder_level: string | number | undefined
		remark: string | number | undefined
		not_track: boolean
	}
	let editForm = $state<EditItemForm>({
		item_name: '',
		unit: '',
		reorder_level: 0,
		remark: '',
		not_track: false,
	})

	// Batches modal variables
	let showBatchesModal = $state<boolean>(false)
	let batchesItem = $state<InventoryItem | null>(null)
	let editingBatchId = $state<string | null>(null)
	let batchForm = $state<{ quantity: number; expiry_date: string }>({
		quantity: 0,
		expiry_date: '',
	})

	// Delete confirmation modal variables
	let showDeleteModal = $state<boolean>(false)
	let deleteItem = $state<InventoryItem | null>(null)
	let deleteLoading = $state<boolean>(false)
	let deleteConfirmation = $state<boolean>(false)

	// Stock management modal variables
	let showStockOutModal = $state<boolean>(false)
	let stockManageItem = $state<InventoryItem | null>(null)

	// Sorting configuration
	let sortConfig = $state<{
		key: keyof InventoryItem | 'status' | 'nearest_expiry' | null
		direction: 'asc' | 'desc'
	}>({
		key: null,
		direction: 'asc',
	})

	// Import status tracking
	let importStatus = $state({
		show: false,
		loading: false,
		error: null as string | null,
		success: false,
		fileName: '',
		importedCount: 0,
		updatedCount: 0,
		deletedCount: 0,
		totalProcessed: 0,
	})

	// New item form
	//
	// The shared FormField binds `string | number | undefined`, so the form model
	// is kept loose here and converted to `NewInventoryItem` on submit.
	interface NewItemForm {
		item_name: string | number | undefined
		quantity: string | number | undefined
		reorder_level: string | number | undefined
		unit: string | number | undefined
		expiry_date: string | number | undefined
		back_order: boolean
		not_track: boolean
	}

	const emptyNewItem = (): NewItemForm => ({
		item_name: '',
		quantity: 0,
		reorder_level: 0,
		unit: '',
		expiry_date: '',
		back_order: false,
		not_track: false,
	})

	let newItem = $state<NewItemForm>(emptyNewItem())

	// ---------- Expiry helpers ----------
	const getNearestExpiry = (item: InventoryItem): string | null =>
		stockBatchesStore.nearestExpiryByItem.get(item.id) ?? null

	const expiryBadge = (
		expiryDate: string | null | undefined,
	): { variant: 'red' | 'yellow' | 'green' | 'gray'; text: string } | null => {
		const status: ExpiryStatus = getExpiryStatus(expiryDate)
		if (status === 'none' || !expiryDate) return null
		const days = daysUntilExpiry(expiryDate)
		if (status === 'expired') {
			return { variant: 'red', text: days === 0 ? 'Expires today' : `Expired ${-days}d ago` }
		}
		if (status === 'expiring') {
			return { variant: 'yellow', text: days === 0 ? 'Expires today' : `Expires in ${days}d` }
		}
		return { variant: 'green', text: 'OK' }
	}

	const formatExpiry = (expiryDate: string | null | undefined): string =>
		expiryDate ? formatDate(`${expiryDate}T00:00:00`) : '—'

	const formatReceived = (createdAt: string): string => formatDate(createdAt)

	// Helper function to get stock status for sorting
	const getStockStatusValue = (item: InventoryItem): number => {
		if (item.not_track) return 3 // Not Tracked (check this first)
		if (item.quantity === 0) return 0 // Out of Stock
		if (item.quantity <= item.reorder_level) return 1 // Reorder Level Reached
		return 2 // In Stock
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
				let aValue: string | number | boolean | null | undefined
				let bValue: string | number | boolean | null | undefined

				if (key === 'status') {
					aValue = getStockStatusValue(a)
					bValue = getStockStatusValue(b)
				} else if (key === 'nearest_expiry') {
					aValue = getNearestExpiry(a)
					bValue = getNearestExpiry(b)
				} else {
					aValue = a[key as keyof InventoryItem]
					bValue = b[key as keyof InventoryItem]
				}

				// Handle missing values (put them at the end)
				aValue ??= null
				bValue ??= null
				if (aValue === null && bValue === null) return 0
				if (aValue === null) return sortConfig.direction === 'asc' ? 1 : -1
				if (bValue === null) return sortConfig.direction === 'asc' ? -1 : 1

				// Handle string comparison for item_name
				if (typeof aValue === 'string' && typeof bValue === 'string') {
					const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase())
					return sortConfig.direction === 'asc' ? comparison : -comparison
				}

				// Handle boolean comparison
				if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
					const aNum = aValue ? 1 : 0
					const bNum = bValue ? 1 : 0
					return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum
				}

				// Handle number comparison
				if (typeof aValue === 'number' && typeof bValue === 'number') {
					return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
				}

				return 0
			})
		}

		return items
	})

	// Pagination
	const pagination = createPagination(() => sortedAndFilteredItems)

	// Format date for display
	const formatDate = (dateString: string): string => {
		const date = new Date(dateString)
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		})
	}

	// Close stock in modal
	const closeStockInModal = (): void => {
		showStockInModal = false
		stockInItem = null
		clearOrderDate = true
		notTrackStatus = false
		stockInExpiryDate = ''
		stockQuantity = 1
	}

	// Helper function to get item max quantity
	const getItemMaxQuantity = (itemId: string): number => {
		const item = inventoryStore.items.find((item) => item.id === itemId)
		return item?.quantity || 0
	}

	// Confirm stock in with optional order date clearing
	const confirmStockIn = async (): Promise<void> => {
		if (!stockInItem || stockQuantity <= 0) return

		await inventoryStore.stockIn(
			stockInItem.id,
			stockQuantity,
			clearOrderDate,
			notTrackStatus,
			stockInExpiryDate || null,
		)

		if (!inventoryStore.error) {
			closeStockInModal()
		}
	}

	// Reset to first page when filters change
	$effect(() => {
		searchQuery
		showOrderedOnly
		untrack(() => {
			pagination.resetToFirstPage()
		})
	})

	// Table column configuration
	const tableColumns = [
		{ key: 'item_name', label: 'Item Name', sortable: true },
		{ key: 'quantity', label: 'Current Stock', sortable: true },
		{ key: 'reorder_level', label: 'Reorder Level', sortable: true },
		{ key: 'nearest_expiry', label: 'Nearest Expiry', sortable: true },
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
			sortConfig.key = key as keyof InventoryItem | 'status' | 'nearest_expiry'
			sortConfig.direction = 'asc'
		}
		pagination.resetToFirstPage() // Reset to first page when sorting changes
	}

	// Action button configurations
	const getItemActions = (): Array<ActionButtonGroupAction> => {
		return [
			{
				key: 'stock-in',
				label: 'Stock In',
				variant: 'blue',
			},
			{
				key: 'stock-out',
				label: 'Stock Out',
				variant: 'yellow',
			},
			{
				key: 'edit-action',
				label: 'Edit',
				variant: 'gray',
				dropdown: [
					{ key: 'edit-details', label: 'Edit Details' },
					{ key: 'edit-batches', label: 'Batches & Expiry' },
				],
			},
			{
				key: 'delete',
				label: 'Delete',
				variant: 'red',
			},
		]
	}

	// Handle action button clicks
	const handleActionClick = (actionKey: string, item: InventoryItem) => {
		switch (actionKey) {
			case 'stock-in':
				openStockInFromButton(item)
				break
			case 'stock-out':
				openStockOutModal(item)
				break
			case 'edit-details':
				openEditModal(item)
				break
			case 'edit-batches':
				openBatchesModal(item)
				break
			case 'delete':
				showDeleteConfirmation(item)
				break
		}
	}

	// Stock In Button handler - uses existing stock in modal
	const openStockInFromButton = (item: InventoryItem): void => {
		stockInItem = item
		stockQuantity = 1
		clearOrderDate = !!item.order_date // Set based on whether item has order date
		notTrackStatus = false // Initialize to 0 if current is -1
		stockInExpiryDate = ''
		showStockInModal = true
	}

	// Stock Out Modal functions
	const openStockOutModal = (item: InventoryItem): void => {
		stockManageItem = item
		stockQuantity = 1
		showStockOutModal = true
	}

	const closeStockOutModal = (): void => {
		showStockOutModal = false
		stockManageItem = null
		stockQuantity = 1
	}

	// Which batches a stock out of `stockQuantity` would draw from, earliest expiry first
	const stockOutPlan = $derived.by((): Array<{ batch: StockBatch; take: number }> => {
		if (!stockManageItem) return []
		let remaining = Math.max(0, Math.floor(Number(stockQuantity) || 0))
		const plan: Array<{ batch: StockBatch; take: number }> = []
		for (const batch of stockBatchesStore.getBatchesForItem(stockManageItem.id)) {
			if (remaining <= 0) break
			const take = Math.min(batch.quantity, remaining)
			plan.push({ batch, take })
			remaining -= take
		}
		return plan
	})

	// ---------- Edit item details ----------
	const openEditModal = (item: InventoryItem): void => {
		editingItem = item
		editForm = {
			item_name: item.item_name,
			unit: item.unit,
			reorder_level: item.reorder_level,
			remark: item.remark,
			not_track: item.not_track,
		}
		showEditModal = true
	}

	const closeEditModal = (): void => {
		showEditModal = false
		editingItem = null
	}

	const isEditFormValid = $derived(
		String(editForm.item_name ?? '').trim() !== '' &&
			String(editForm.unit ?? '').trim() !== '' &&
			Number(editForm.reorder_level ?? 0) >= -1,
	)

	const isEditFormChanged = $derived.by((): boolean => {
		if (!editingItem) return false
		return (
			String(editForm.item_name ?? '').trim() !== editingItem.item_name ||
			String(editForm.unit ?? '').trim() !== editingItem.unit ||
			Number(editForm.reorder_level ?? 0) !== editingItem.reorder_level ||
			String(editForm.remark ?? '') !== editingItem.remark ||
			editForm.not_track !== editingItem.not_track
		)
	})

	const confirmEditItem = async (): Promise<void> => {
		if (!editingItem || !isEditFormValid || !isEditFormChanged) return

		await inventoryStore.updateItem(editingItem.id, {
			item_name: String(editForm.item_name ?? '').trim(),
			unit: String(editForm.unit ?? '').trim(),
			reorder_level: Math.max(-1, Math.floor(Number(editForm.reorder_level ?? 0))),
			remark: String(editForm.remark ?? ''),
			not_track: editForm.not_track,
		})

		if (!inventoryStore.error) closeEditModal()
	}

	// ---------- Batches & expiry ----------
	const batchesForModal = $derived(
		batchesItem ? stockBatchesStore.getBatchesForItem(batchesItem.id) : [],
	)

	// The modal keeps a snapshot of the item it was opened for; read the live
	// row so the total updates after a batch is saved.
	const batchesLiveItem = $derived(
		batchesItem ? (inventoryStore.getItemById(batchesItem.id) ?? batchesItem) : null,
	)

	const openBatchesModal = (item: InventoryItem): void => {
		batchesItem = item
		editingBatchId = null
		showBatchesModal = true
	}

	const closeBatchesModal = (): void => {
		showBatchesModal = false
		batchesItem = null
		editingBatchId = null
	}

	const startEditBatch = (batch: StockBatch): void => {
		editingBatchId = batch.id
		batchForm = { quantity: batch.quantity, expiry_date: batch.expiry_date ?? '' }
	}

	const cancelEditBatch = (): void => {
		editingBatchId = null
	}

	const editingBatch = $derived(batchesForModal.find((b) => b.id === editingBatchId) ?? null)

	const isBatchFormChanged = $derived.by((): boolean => {
		if (!editingBatch) return false
		return (
			Math.floor(Number(batchForm.quantity) || 0) !== editingBatch.quantity ||
			(batchForm.expiry_date || '') !== (editingBatch.expiry_date ?? '')
		)
	})

	const confirmSaveBatch = async (): Promise<void> => {
		if (!editingBatch || !isBatchFormChanged) return
		const quantity = Math.floor(Number(batchForm.quantity) || 0)
		if (quantity < 0) return

		await stockBatchesStore.updateBatch(editingBatch.id, quantity, batchForm.expiry_date || null)

		if (!stockBatchesStore.error) editingBatchId = null
	}

	const confirmStockOut = async (): Promise<void> => {
		if (!stockManageItem) return

		const itemId = stockManageItem.id
		const maxQuantity = getItemMaxQuantity(itemId)

		if (stockQuantity > maxQuantity) {
			stockQuantity = maxQuantity
			return
		}

		await inventoryStore.stockOut(itemId, stockQuantity)

		if (!inventoryStore.error) {
			closeStockOutModal()
		}
	}

	const openAddForm = async (): Promise<void> => {
		showAddForm = true
		await tick() // Wait for DOM to update
		itemNameInputRef?.focus() // Focus the item name input
	}

	const addNewItem = async (): Promise<void> => {
		if (String(newItem.item_name ?? '').trim()) {
			const payload: NewInventoryItem = {
				item_name: String(newItem.item_name ?? ''),
				quantity: Number(newItem.quantity ?? 0),
				reorder_level: Number(newItem.reorder_level ?? 0),
				unit: String(newItem.unit ?? ''),
				back_order: newItem.back_order,
				not_track: newItem.not_track,
			}
			await inventoryStore.addItem(payload, String(newItem.expiry_date ?? '') || null)
			if (!inventoryStore.error) {
				newItem = emptyNewItem()
				showAddForm = false
			}
		}
	}

	const showDeleteConfirmation = (item: InventoryItem): void => {
		deleteItem = item
		deleteConfirmation = false
		showDeleteModal = true
	}

	const confirmDelete = async (): Promise<void> => {
		if (!deleteItem || !deleteConfirmation) return

		deleteLoading = true
		try {
			await inventoryStore.deleteItem(deleteItem.id)
			showDeleteModal = false
			deleteItem = null
			deleteConfirmation = false
		} finally {
			deleteLoading = false
		}
	}

	const cancelDelete = (): void => {
		showDeleteModal = false
		deleteItem = null
		deleteConfirmation = false
		deleteLoading = false
	}

	const getStockStatus = (item: InventoryItem): StockStatus => {
		if (item.not_track) return { text: 'Not Tracked', class: 'bg-gray-100 text-gray-800' }
		if (item.quantity === 0) return { text: 'Out of Stock', class: 'bg-red-100 text-red-800' }
		if (item.quantity <= item.reorder_level)
			return { text: 'Low Stock', class: 'bg-yellow-100 text-yellow-800' }
		return { text: 'In Stock', class: 'bg-green-100 text-green-800' }
	}

	const getStockStatusColor = (item: InventoryItem): 'gray' | 'red' | 'yellow' | 'green' => {
		if (item.not_track) return 'gray'
		if (item.quantity === 0) return 'red'
		if (item.quantity <= item.reorder_level) return 'yellow'
		return 'green'
	}

	// Excel Import Functions
	const triggerFileUpload = (): void => {
		fileInput?.click()
	}

	const handleFileUpload = async (event: Event): Promise<void> => {
		const target = event.target as HTMLInputElement
		const file = target.files?.[0]

		if (!file) return

		// Reset import status
		importStatus = {
			show: true,
			loading: true,
			error: null,
			success: false,
			fileName: file.name,
			importedCount: 0,
			updatedCount: 0,
			deletedCount: 0,
			totalProcessed: 0,
		}

		try {
			const data = await parseExcelFile(file)
			await importInventoryData(data)

			importStatus.loading = false
			importStatus.success = true

			// Hide success message after 10 seconds
			setTimeout(() => {
				importStatus.show = false
			}, 10000)
		} catch (error) {
			importStatus.loading = false
			importStatus.error = error instanceof Error ? error.message : 'Unknown error occurred'

			// Hide error message after 10 seconds
			setTimeout(() => {
				importStatus.show = false
			}, 10000)
		}

		// Clear the file input
		target.value = ''
	}

	interface ExcelData {
		item_name: string
		quantity: number
		reorder_level: number
		unit: string
		remark: string
		order_date: string
	}

	const parseExcelFile = async (file: File): Promise<ExcelData[]> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader()

			reader.onload = (e) => {
				try {
					const data = new Uint8Array(e.target?.result as ArrayBuffer)

					const workbook = XLSX.read(data, { type: 'array' })
					const sheetName = workbook.SheetNames[0]
					const worksheet = workbook.Sheets[sheetName]
					const jsonData = XLSX.utils.sheet_to_json(worksheet)

					resolve(jsonData as ExcelData[])
				} catch {
					reject(new Error('Failed to parse Excel file. Please ensure it has the correct format.'))
				}
			}

			reader.onerror = () => {
				reject(new Error('Failed to read file'))
			}

			reader.readAsArrayBuffer(file)
		})
	}

	const importInventoryData = async (data: ExcelData[]): Promise<void> => {
		// Validate all rows first
		for (const row of data) {
			if (
				!row.item_name ||
				typeof row.quantity !== 'number' ||
				typeof row.reorder_level !== 'number' ||
				!row.unit ||
				!row.remark ||
				!row.order_date
			) {
				throw new Error(
					'Invalid data format. Please ensure all rows have: item_name, quantity, reorder_level, unit, remark, order_date',
				)
			}
		}

		// One server transaction: details are updated, quantity differences move
		// through batches, new items are added, and items missing from the sheet
		// are deleted.
		const result = await inventoryStore.importFromRows(
			data.map((row) => ({
				item_name: String(row.item_name),
				quantity: Math.max(0, row.quantity),
				reorder_level: Math.max(0, row.reorder_level),
				unit: String(row.unit),
				remark: String(row.remark),
				order_date: String(row.order_date),
			})),
		)
		if (!result) throw new Error(inventoryStore.error || 'Import failed')

		importStatus.importedCount = result.imported
		importStatus.updatedCount = result.updated
		importStatus.deletedCount = result.deleted
		importStatus.totalProcessed = result.total
	}

	const exportToExcel = (): void => {
		try {
			// Prepare data for export
			const exportData = inventoryStore.items.map((item) => ({
				item_name: item.item_name,
				quantity: item.quantity,
				reorder_level: item.reorder_level,
				unit: item.unit,
				remark: item.remark,
				order_date: item.order_date,
			}))

			// Create workbook and worksheet
			const workbook = XLSX.utils.book_new()
			const worksheet = XLSX.utils.json_to_sheet(exportData)

			// Set column widths for better formatting
			const columnWidths = [
				{ wch: 50 }, // item_name
				{ wch: 12 }, // quantity
				{ wch: 22 }, // reorder_level
				{ wch: 25 }, // unit
				{ wch: 50 }, // remark
				{ wch: 25 }, // order_date
			]
			worksheet['!cols'] = columnWidths

			// Add the worksheet to workbook
			XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory')

			// Generate filename with current date
			const currentDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
				.toISOString()
				.slice(0, 10)
			const filename = `inventory_export_${currentDate}.xlsx`

			// Write and download the file
			XLSX.writeFile(workbook, filename)
		} catch (error) {
			console.error('Export failed:', error)
			alert('Failed to export data. Please try again.')
		}
	}
</script>

<div class="px-2 py-3 sm:px-0 sm:py-6">
	<div class="rounded-lg border-4 border-dashed border-gray-200 p-3 sm:p-6">
		<!-- Header -->
		<div class="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-bold text-gray-900 sm:text-2xl">Inventory Management</h2>
			<div class="flex flex-col gap-3 sm:flex-row">
				{#if !showAddForm}
					<Button variant="green" class="w-full sm:w-auto" onclick={triggerFileUpload}>
						Import from Excel (xlsx)
					</Button>
				{/if}
				{#if !showAddForm}
					<Button
						class="w-full bg-purple-600 hover:bg-purple-700 focus-visible:ring-purple-500 sm:w-auto"
						onclick={exportToExcel}
					>
						Export to Excel (xlsx)
					</Button>
				{/if}
				{#if !showAddForm}
					<Button variant="blue" class="w-full sm:w-auto" onclick={openAddForm}>Add New Item</Button
					>
				{/if}
			</div>
		</div>

		<!-- Hidden File Input -->
		<input
			bind:this={fileInput}
			type="file"
			accept=".xlsx"
			onchange={handleFileUpload}
			class="hidden"
		/>

		<!-- Import Progress/Error Display -->
		{#if importStatus.show}
			<div class="mb-4 sm:mb-6">
				{#if importStatus.loading}
					<div class="rounded-md border border-blue-200 bg-blue-50 p-4">
						<div class="flex">
							<div class="flex-shrink-0">
								<div class="h-5 w-5 animate-spin rounded-full border-b-2 border-blue-600"></div>
							</div>
							<div class="ml-3">
								<h3 class="text-sm font-medium text-blue-800">Importing data...</h3>
								<p class="mt-1 text-sm text-blue-700">Processing {importStatus.fileName}</p>
							</div>
						</div>
					</div>
				{:else if importStatus.error}
					<div>
						<ErrorAlert title="Import failed" message={importStatus.error} />
					</div>
				{:else if importStatus.success}
					<div class="rounded-md border border-green-200 bg-green-50 p-4">
						<div class="flex">
							<div class="flex-shrink-0">
								<CheckCircleIcon class="h-5 w-5 text-green-400" />
							</div>
							<div class="ml-3">
								<h3 class="text-sm font-medium text-green-800">Import successful!</h3>
								<div class="mt-1 text-sm text-green-700">
									<p>Successfully synced inventory with {importStatus.fileName}:</p>
									<ul class="mt-1 space-y-1">
										{#if importStatus.importedCount > 0}
											<li>• Added {importStatus.importedCount} new items</li>
										{/if}
										{#if importStatus.updatedCount > 0}
											<li>• Updated {importStatus.updatedCount} existing items</li>
										{/if}
										{#if importStatus.deletedCount > 0}
											<li>• Removed {importStatus.deletedCount} items not in Excel</li>
										{/if}
									</ul>
									<p class="mt-2 font-medium">
										Total processed: {importStatus.totalProcessed} items
									</p>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Stock In Modal -->
		<ActionModal
			bind:open={showStockInModal}
			title={`Stock In: ${stockInItem?.item_name}`}
			variant="green"
			loading={inventoryStore.loading}
			confirmText="Stock In"
			onclose={closeStockInModal}
			oncancel={closeStockInModal}
			onconfirm={confirmStockIn}
		>
			<div class="space-y-4">
				<div class="rounded-md border border-blue-200 bg-blue-50 p-3">
					<div class="mb-2 flex items-center gap-2">
						<ArrowDownIcon class="h-4 w-4 text-blue-500" />
						<span class="text-sm font-medium text-blue-800">
							Current Stock: {stockInItem?.quantity || 0}
							{stockInItem?.unit}
						</span>
					</div>
					<p class="text-sm text-blue-700">
						Add stock to increase the inventory quantity for this item.
					</p>
				</div>

				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="stock-in-quantity">
						Quantity to Add
					</label>
					<input
						id="stock-in-quantity"
						bind:value={stockQuantity}
						type="number"
						min="1"
						class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500 focus:outline-none"
						placeholder="Enter quantity to add"
						{@attach selectOnFocus()}
					/>
					<p class="mt-1 text-xs text-gray-500">Enter the quantity you want to add to inventory</p>
				</div>

				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="stock-in-expiry">
						Expiry Date <span class="font-normal text-gray-400">(optional)</span>
					</label>
					<input
						id="stock-in-expiry"
						bind:value={stockInExpiryDate}
						type="date"
						min={todayIsoDate()}
						class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-2 focus:ring-green-500 focus:outline-none"
					/>
					<p class="mt-1 text-xs text-gray-500">
						This stock is recorded as its own batch. Stock out takes from the earliest-expiring
						batch first.
					</p>
				</div>

				<!-- Not Track Status -->
				{#if stockInItem?.not_track}
					<div class="rounded-md border border-blue-200 bg-blue-50 p-3">
						<div class="mb-2 flex items-center gap-2">
							<EyeIcon class="h-4 w-4 text-blue-500" />
							<span class="text-sm font-medium text-blue-800">
								Updated Tracking Status: {stockInItem.not_track ? 'Track' : 'Not Track'}
							</span>
						</div>
						<div class="flex items-start gap-3">
							<input
								id="updateNotTrackStatus"
								bind:checked={notTrackStatus}
								type="checkbox"
								class="mt-1 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
							/>
							<div class="flex-1">
								<label for="updateNotTrackStatus" class="text-sm font-medium text-gray-700">
									Mark as untracked
								</label>
								<p class="mt-1 text-xs text-gray-500">Check this to mark the item as untracked.</p>
							</div>
						</div>
					</div>
				{/if}

				<!-- Order Date Handling -->
				{#if stockInItem?.order_date}
					<div class="rounded-md border border-blue-200 bg-blue-50 p-3">
						<div class="mb-2 flex items-center gap-2">
							<CalendarIcon class="h-4 w-4 text-blue-500" />
							<span class="text-sm font-medium text-blue-800">
								Order Date: {formatDate(stockInItem.order_date)}
							</span>
						</div>
						<div class="flex items-start gap-3">
							<input
								id="clearOrderDate"
								bind:checked={clearOrderDate}
								type="checkbox"
								class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<div class="flex-1">
								<label for="clearOrderDate" class="text-sm font-medium text-gray-700">
									Mark as received and clear order date
								</label>
								<p class="mt-1 text-xs text-gray-500">
									Check this to mark the item as received and remove the order date tracking.
								</p>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</ActionModal>

		<!-- Delete Confirmation Modal -->
		<ActionModal
			bind:open={showDeleteModal}
			title={`Delete Item: ${deleteItem?.item_name || ''}`}
			variant="red"
			confirmText="Delete"
			loading={deleteLoading}
			disabled={!deleteConfirmation}
			onconfirm={confirmDelete}
			oncancel={cancelDelete}
			onclose={cancelDelete}
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
						Are you sure you want to delete this item? This action cannot be undone.
					</p>
				</div>

				<div class="flex items-start gap-3">
					<input
						id="delete-confirmation"
						bind:checked={deleteConfirmation}
						type="checkbox"
						class="mt-1 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
					/>
					<label for="delete-confirmation" class="text-sm text-gray-700">
						I understand that this action cannot be undone and I want to permanently delete this
						item.
					</label>
				</div>
			</div>
		</ActionModal>

		<!-- Stock Out Modal -->
		<ActionModal
			bind:open={showStockOutModal}
			title={`Stock Out: ${stockManageItem?.item_name}`}
			variant="green"
			loading={inventoryStore.loading}
			confirmText="Stock Out"
			onclose={closeStockOutModal}
			oncancel={closeStockOutModal}
			onconfirm={confirmStockOut}
		>
			<div class="space-y-4">
				<div class="rounded-md border border-yellow-200 bg-yellow-50 p-3">
					<div class="mb-2 flex items-center gap-2">
						<ArrowUpSolidIcon class="h-4 w-4 text-yellow-500" />
						<span class="text-sm font-medium text-yellow-800">
							Current Stock: {stockManageItem?.quantity || 0}
							{stockManageItem?.unit}
						</span>
					</div>
					<p class="text-sm text-yellow-700">
						Stock out to decrease the inventory quantity for this item.
					</p>
				</div>

				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700" for="stock-out-quantity">
						Quantity to Remove
					</label>
					<input
						id="stock-out-quantity"
						bind:value={stockQuantity}
						type="number"
						min="1"
						max={getItemMaxQuantity(stockManageItem?.id || '')}
						class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
						placeholder="Enter quantity to remove"
						{@attach selectOnFocus()}
					/>
					<p class="mt-1 text-xs text-gray-500">
						Maximum available for stock out: {getItemMaxQuantity(stockManageItem?.id || '')}
						{stockManageItem?.unit}
					</p>
				</div>

				{#if stockOutPlan.length > 0}
					<div class="rounded-md border border-gray-200 bg-gray-50 p-3">
						<p class="mb-2 text-xs font-medium text-gray-700">
							Taken from the earliest-expiring batches first (FEFO):
						</p>
						<ul class="space-y-1 text-xs text-gray-700">
							{#each stockOutPlan as { batch, take } (batch.id)}
								{@const badge = expiryBadge(batch.expiry_date)}
								<li class="flex items-center justify-between gap-2">
									<span>
										{take} of {batch.quantity}
										{stockManageItem?.unit} · received {formatReceived(batch.created_at)} · expires {formatExpiry(
											batch.expiry_date,
										)}
									</span>
									{#if badge && badge.variant !== 'green'}
										<StatusBadge variant={badge.variant} text={badge.text} />
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</ActionModal>

		<!-- Edit Item Details Modal -->
		<ActionModal
			bind:open={showEditModal}
			title={`Edit Item: ${editingItem?.item_name || ''}`}
			variant="blue"
			loading={inventoryStore.loading}
			confirmText="Save Changes"
			disabled={!isEditFormValid || !isEditFormChanged}
			onclose={closeEditModal}
			oncancel={closeEditModal}
			onconfirm={confirmEditItem}
		>
			<form
				class="space-y-4"
				onsubmit={(e) => {
					e.preventDefault()
					confirmEditItem()
				}}
			>
				<FormField
					bind:value={editForm.item_name}
					type="text"
					label="Item Name"
					placeholder="Enter item name"
					required={true}
				/>
				<div class="grid grid-cols-2 gap-4">
					<FormField
						bind:value={editForm.unit}
						type="text"
						label="Unit"
						placeholder="Enter unit"
						required={true}
					/>
					<FormField
						bind:value={editForm.reorder_level}
						type="number"
						label="Reorder Level"
						required={true}
						min={-1}
						selectOnFocus
					/>
				</div>
				<FormField
					bind:value={editForm.remark}
					type="textarea"
					label="Remark"
					rows={2}
					placeholder="Enter remark..."
				/>
				<div class="flex items-start gap-3">
					<input
						id="edit-not-track"
						bind:checked={editForm.not_track}
						type="checkbox"
						class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<div class="flex-1">
						<label for="edit-not-track" class="text-sm font-medium text-gray-700">
							Not tracked
						</label>
						<p class="mt-1 text-xs text-gray-500">
							Untracked items are left out of the stock totals and low-stock alerts.
						</p>
					</div>
				</div>
				<p class="text-xs text-gray-500">
					Current stock is {editingItem?.quantity ?? 0}
					{editingItem?.unit}. Use Stock In, Stock Out or the batch editor to change it.
				</p>
			</form>
		</ActionModal>

		<!-- Batches & Expiry Modal -->
		<ActionModal
			bind:open={showBatchesModal}
			title={`Batches: ${batchesItem?.item_name || ''}`}
			variant="blue"
			loading={stockBatchesStore.loading}
			confirmText="Save Batch"
			cancelText="Close"
			disabled={!editingBatch || !isBatchFormChanged}
			onclose={closeBatchesModal}
			oncancel={closeBatchesModal}
			onconfirm={confirmSaveBatch}
		>
			<div class="space-y-4">
				<div class="rounded-md border border-blue-200 bg-blue-50 p-3">
					<div class="mb-1 flex items-center gap-2">
						<ClockIcon class="h-4 w-4 text-blue-500" />
						<span class="text-sm font-medium text-blue-800">
							Total stock: {batchesLiveItem?.quantity ?? 0}
							{batchesLiveItem?.unit} across {batchesForModal.length}
							{batchesForModal.length === 1 ? 'batch' : 'batches'}
						</span>
					</div>
					<p class="text-sm text-blue-700">
						Stock out takes from the earliest-expiring batch first, then batches with no expiry
						date. Batches expiring within {EXPIRY_WARNING_DAYS}
						days are highlighted. Changing a quantity is logged as a stock movement.
					</p>
				</div>

				{#if stockBatchesStore.error}
					<ErrorAlert title="Batch update failed" message={stockBatchesStore.error} />
				{/if}

				{#if batchesForModal.length === 0}
					<p class="py-4 text-center text-sm text-gray-500">No stock on hand for this item.</p>
				{:else}
					<div
						class="max-h-80 divide-y divide-gray-200 overflow-y-auto rounded-md border border-gray-200"
					>
						{#each batchesForModal as batch, index (batch.id)}
							{@const badge = expiryBadge(batch.expiry_date)}
							<div class="p-3 {editingBatchId === batch.id ? 'bg-blue-50' : 'bg-white'}">
								{#if editingBatchId === batch.id}
									<form
										class="space-y-3"
										onsubmit={(e) => {
											e.preventDefault()
											confirmSaveBatch()
										}}
									>
										<p class="text-xs font-medium text-gray-700">
											Batch {index + 1} · received {formatReceived(batch.created_at)}
										</p>
										<div class="grid grid-cols-2 gap-3">
											<div>
												<label
													class="mb-1 block text-xs font-medium text-gray-700"
													for="batch-quantity"
												>
													Quantity ({batchesItem?.unit})
												</label>
												<input
													id="batch-quantity"
													bind:value={batchForm.quantity}
													type="number"
													min="0"
													step="1"
													class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
													{@attach selectOnFocus()}
												/>
											</div>
											<div>
												<label
													class="mb-1 block text-xs font-medium text-gray-700"
													for="batch-expiry"
												>
													Expiry Date
												</label>
												<input
													id="batch-expiry"
													bind:value={batchForm.expiry_date}
													type="date"
													class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
												/>
											</div>
										</div>
										<div class="flex justify-end">
											<Button type="button" variant="ghost" size="xs" onclick={cancelEditBatch}>
												Cancel edit
											</Button>
										</div>
									</form>
								{:else}
									<div class="flex items-center justify-between gap-3">
										<div class="min-w-0 text-sm">
											<div class="font-medium text-gray-900">
												{batch.quantity}
												{batchesItem?.unit}
												<span class="font-normal text-gray-500">· Batch {index + 1}</span>
											</div>
											<div
												class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500"
											>
												<span>Received {formatReceived(batch.created_at)}</span>
												<span>·</span>
												<span>Expires {formatExpiry(batch.expiry_date)}</span>
												{#if badge && badge.variant !== 'green'}
													<StatusBadge variant={badge.variant} text={badge.text} />
												{/if}
											</div>
										</div>
										<Button
											type="button"
											variant="soft-blue"
											size="xs"
											disabled={stockBatchesStore.loading}
											onclick={() => startEditBatch(batch)}
										>
											Edit
										</Button>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</ActionModal>

		<!-- Add New Item Form -->
		{#if showAddForm}
			<div class="mb-4 rounded-lg bg-white p-4 shadow sm:mb-6 sm:p-6">
				<h3 class="mb-4 text-base font-medium text-gray-900 sm:text-lg">Add New Item</h3>
				<form
					onsubmit={(e) => {
						e.preventDefault()
						addNewItem()
					}}
				>
					<div class="space-y-4 sm:grid sm:grid-cols-6 sm:gap-6 sm:space-y-0">
						<div class="col-span-2">
							<FormField
								bind:ref={itemNameInputRef}
								bind:value={newItem.item_name}
								type="text"
								label="Item Name"
								placeholder="Enter item name"
								required={true}
							/>
						</div>
						<div class="col-span-1">
							<FormField
								bind:value={newItem.quantity}
								type="number"
								label="Initial Quantity"
								required={true}
								min={0}
								selectOnFocus
							/>
						</div>
						<div class="col-span-1">
							<FormField
								bind:value={newItem.reorder_level}
								type="number"
								label="Reorder Level"
								required={true}
								min={-1}
								selectOnFocus
							/>
						</div>
						<div class="col-span-1">
							<FormField
								bind:value={newItem.unit}
								type="text"
								label="Unit"
								placeholder="Enter unit"
								required={true}
							/>
						</div>
						<div class="col-span-1">
							<FormField
								bind:value={newItem.expiry_date}
								type="date"
								label="Expiry Date"
								disabled={Number(newItem.quantity ?? 0) <= 0}
							/>
						</div>
					</div>
					<div class="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
						<Button
							type="button"
							variant="gray"
							class="w-full disabled:opacity-50 sm:w-auto"
							onclick={() => (showAddForm = false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="green"
							class="w-full disabled:opacity-50 sm:w-auto"
							disabled={inventoryStore.loading ||
								newItem.item_name === '' ||
								Number(newItem.quantity) < 0 ||
								Number(newItem.reorder_level) < 0 ||
								newItem.unit === ''}
						>
							{inventoryStore.loading ? 'Adding...' : 'Add Item'}
						</Button>
					</div>
				</form>
			</div>
		{/if}

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
						description={searchQuery
							? 'Try adjusting your search terms.'
							: 'Get started by adding your first item.'}
					/>
				{:else}
					<div class="divide-y divide-gray-200">
						{#each pagination.paginatedItems as item (item.id)}
							{@const nearest = getNearestExpiry(item)}
							{@const badge = expiryBadge(nearest)}
							<div class="px-4 py-4">
								<div class="space-y-3">
									<!-- Item Header -->
									<div class="flex items-center justify-between">
										<div class="mr-2 flex-1">
											<h4 class="truncate text-sm font-medium text-gray-900">
												{item.item_name}
											</h4>
											<!-- Show non-order reason if set -->
											{#if item.non_order_reason}
												<div class="mt-1">
													<ReasonBadge reason={item.non_order_reason} size="sm">
														{item.non_order_reason}
													</ReasonBadge>
												</div>
											{/if}
										</div>
										<StatusBadge
											variant={getStockStatusColor(item)}
											text={getStockStatus(item).text}
										/>
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
										<div class="flex items-baseline gap-2">
											<span class="flex-shrink-0 text-gray-500">Reorder Level:</span>
											<span class="font-medium text-gray-900">
												{item.reorder_level}
												{item.unit}
											</span>
										</div>
										<div class="flex flex-wrap items-center gap-2">
											<span class="flex-shrink-0 text-gray-500">Nearest Expiry:</span>
											<span class="font-medium text-gray-900">{formatExpiry(nearest)}</span>
											{#if badge && badge.variant !== 'green'}
												<StatusBadge variant={badge.variant} text={badge.text} />
											{/if}
										</div>
									</div>

									<!-- Order Status -->
									{#if item.order_date}
										<div class="rounded bg-blue-50 p-2 text-xs text-blue-600">
											{#if item.back_order}
												<span class="inline-flex items-center gap-1">
													<CalendarIcon class="h-3 w-3" />
													Back-ordered: {formatDate(item.order_date)}
												</span>
											{:else}
												<span class="inline-flex items-center gap-1">
													<CalendarIcon class="h-3 w-3" />
													Ordered: {formatDate(item.order_date)}
												</span>
											{/if}
										</div>
									{/if}

									<!-- Actions -->
									<div class="border-t border-gray-100 pt-2">
										<ActionButtonGroup
											class="w-full"
											actions={getItemActions()}
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
						description={searchQuery
							? 'Try adjusting your search terms.'
							: 'Get started by adding your first item.'}
					/>
				{:else}
					<Table.Root>
						<SortableTableHeader columns={tableColumns} {sortConfig} onsortchange={toggleSort} />
						<Table.Body>
							{#each pagination.paginatedItems as item (item.id)}
								{@const nearest = getNearestExpiry(item)}
								{@const badge = expiryBadge(nearest)}
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
									<Table.Cell class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
										{item.reorder_level}
										{item.unit}
									</Table.Cell>
									<Table.Cell class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
										<div>{formatExpiry(nearest)}</div>
										{#if badge && badge.variant !== 'green'}
											<div class="mt-1">
												<StatusBadge variant={badge.variant} text={badge.text} />
											</div>
										{/if}
									</Table.Cell>
									<Table.Cell class="px-6 py-4 whitespace-nowrap">
										<StatusBadge
											variant={getStockStatusColor(item)}
											text={getStockStatus(item).text}
										/>
									</Table.Cell>
									<Table.Cell class="px-6 py-4 text-sm font-medium whitespace-nowrap">
										<ActionButtonGroup
											actions={getItemActions()}
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

<script lang="ts">
	import { tick, untrack } from 'svelte'
	import { toast } from 'svelte-sonner'
	import * as XLSX from 'xlsx'
	import ArrowDownToLineIcon from '@lucide/svelte/icons/arrow-down-to-line'
	import ArrowUpFromLineIcon from '@lucide/svelte/icons/arrow-up-from-line'
	import CalendarIcon from '@lucide/svelte/icons/calendar'
	import ClockIcon from '@lucide/svelte/icons/clock'
	import DownloadIcon from '@lucide/svelte/icons/download'
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis'
	import LayersIcon from '@lucide/svelte/icons/layers'
	import PackageOpenIcon from '@lucide/svelte/icons/package-open'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import SearchIcon from '@lucide/svelte/icons/search'
	import Trash2Icon from '@lucide/svelte/icons/trash-2'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import UploadIcon from '@lucide/svelte/icons/upload'
	import XIcon from '@lucide/svelte/icons/x'
	import { selectOnFocus } from '$lib/attachments/focus'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import PageHeader from '$lib/components/app/PageHeader.svelte'
	import ReasonBadge from '$lib/components/app/ReasonBadge.svelte'
	import SortHeader from '$lib/components/app/SortHeader.svelte'
	import type { SortState } from '$lib/components/app/sort'
	import ToneBadge, { type Tone } from '$lib/components/app/ToneBadge.svelte'
	import * as Alert from '$lib/components/ui/alert'
	import { Button } from '$lib/components/ui/button'
	import { Checkbox } from '$lib/components/ui/checkbox'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import * as Empty from '$lib/components/ui/empty'
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import * as InputGroup from '$lib/components/ui/input-group'
	import { Progress } from '$lib/components/ui/progress'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import * as Table from '$lib/components/ui/table'
	import { Textarea } from '$lib/components/ui/textarea'
	import * as ToggleGroup from '$lib/components/ui/toggle-group'
	import { createLoadMore } from '$lib/composables/loadMore.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockBatchesStore } from '$lib/stores/stockBatches.svelte'
	import type { InventoryItem, NewInventoryItem } from '$lib/types/inventory'
	import {
		daysUntilExpiry,
		getExpiryStatus,
		todayIsoDate,
		type StockBatch,
	} from '$lib/types/stockBatches'
	import { formatDate, formatDayMonth } from '$lib/utils/date'
	import { cn } from '$lib/utils'

	// ---------- Toolbar state ----------
	type Filter = 'all' | 'low' | 'out' | 'ordered' | 'untracked'
	type SortKey = 'item_name' | 'quantity' | 'reorder_level' | 'nearest_expiry' | 'status'

	const FILTERS: Array<{ value: Filter; label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'low', label: 'Low Stock' },
		{ value: 'out', label: 'Out of Stock' },
		{ value: 'ordered', label: 'On Order' },
		{ value: 'untracked', label: 'Not Tracked' },
	]

	let searchQuery = $state('')
	let searchInput = $state<HTMLInputElement | null>(null)
	let filter = $state<Filter>('all')
	let sort = $state<SortState<SortKey>>({ key: null, direction: 'asc' })
	let fileInput = $state<HTMLInputElement | null>(null)

	// ---------- Stock status ----------
	const stockStatus = (item: InventoryItem): { tone: Tone; text: string; rank: number } => {
		if (item.not_track) return { tone: 'neutral', text: 'Not tracked', rank: 3 }
		if (item.quantity === 0) return { tone: 'danger', text: 'Out of stock', rank: 0 }
		if (item.quantity <= item.reorder_level) return { tone: 'warning', text: 'Low stock', rank: 1 }
		return { tone: 'success', text: 'In stock', rank: 2 }
	}

	const matchesFilter = (item: InventoryItem): boolean => {
		switch (filter) {
			case 'low':
				return !item.not_track && item.quantity > 0 && item.quantity <= item.reorder_level
			case 'out':
				return !item.not_track && item.quantity === 0
			case 'ordered':
				return !!item.order_date
			case 'untracked':
				return item.not_track
			default:
				return true
		}
	}

	// ---------- Expiry helpers ----------
	const getNearestExpiry = (item: InventoryItem): string | null =>
		stockBatchesStore.nearestExpiryByItem.get(item.id) ?? null

	const batchCount = (item: InventoryItem): number =>
		stockBatchesStore.batchesByItem.get(item.id)?.length ?? 0

	const expiryBadge = (
		expiryDate: string | null | undefined,
	): { tone: 'danger' | 'warning'; text: string } | null => {
		if (!expiryDate) return null
		const status = getExpiryStatus(expiryDate)
		const days = daysUntilExpiry(expiryDate)
		if (status === 'expired') {
			return {
				tone: 'danger',
				text: days === -1 ? 'Expired yesterday' : `Expired ${-days} days ago`,
			}
		}
		if (status === 'expiring') {
			return {
				tone: 'warning',
				text:
					days === 0
						? 'Expires today'
						: days === 1
							? 'Expires tomorrow'
							: `Expires in ${days} days`,
			}
		}
		return null
	}

	const plural = (count: number, noun: string, many = `${noun}s`): string =>
		`${count} ${count === 1 ? noun : many}`

	// ---------- Filtering and sorting ----------
	const sortedItems = $derived.by((): InventoryItem[] => {
		const items = inventoryStore.searchItems(searchQuery).filter(matchesFilter)
		const key = sort.key
		if (!key) return items

		const dir = sort.direction === 'asc' ? 1 : -1
		const valueOf = (item: InventoryItem): string | number | null => {
			if (key === 'status') return stockStatus(item).rank
			if (key === 'nearest_expiry') return getNearestExpiry(item)
			return item[key as 'item_name' | 'quantity' | 'reorder_level']
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

	// ---------- Errors ----------
	// Store errors surface as toasts that stay until dismissed. Import failures
	// are shown inline instead, so they are kept out of the toast.
	let importing = $state(false)
	let importError = $state<string | null>(null)

	$effect(() => {
		const message = inventoryStore.error
		if (message && !untrack(() => importing)) toast.error(message, { duration: Infinity })
	})
	$effect(() => {
		const message = stockBatchesStore.error
		if (message) toast.error(message, { duration: Infinity })
	})

	// ---------- Add item ----------
	interface NewItemForm {
		item_name: string
		unit: string
		reorder_level: number
		quantity: number
		expiry_date: string
		remark: string
	}
	const emptyNewItem = (): NewItemForm => ({
		item_name: '',
		unit: '',
		reorder_level: 0,
		quantity: 0,
		expiry_date: '',
		remark: '',
	})

	let showAddDialog = $state(false)
	let newItem = $state<NewItemForm>(emptyNewItem())
	let newItemNameInput = $state<HTMLInputElement | null>(null)

	const isNewItemValid = $derived(
		newItem.item_name.trim() !== '' &&
			newItem.unit.trim() !== '' &&
			Number(newItem.quantity) >= 0 &&
			Number(newItem.reorder_level) >= -1,
	)

	const openAddDialog = async (): Promise<void> => {
		newItem = emptyNewItem()
		showAddDialog = true
		await tick()
		newItemNameInput?.focus()
	}

	const closeAddDialog = (): void => {
		showAddDialog = false
	}

	const confirmAddItem = async (): Promise<void> => {
		if (!isNewItemValid) return
		const payload: NewInventoryItem = {
			item_name: newItem.item_name.trim(),
			unit: newItem.unit.trim(),
			quantity: Math.max(0, Math.floor(Number(newItem.quantity))),
			reorder_level: Math.max(-1, Math.floor(Number(newItem.reorder_level))),
			remark: newItem.remark,
		}
		await inventoryStore.addItem(payload, newItem.expiry_date || null)
		if (!inventoryStore.error) {
			toast.success(`Added ${payload.item_name}`)
			closeAddDialog()
		}
	}

	// ---------- Stock in ----------
	let showStockInDialog = $state(false)
	let stockInItem = $state<InventoryItem | null>(null)
	let stockInQuantity = $state(1)
	let stockInExpiryDate = $state('')
	let clearOrderDate = $state(true)
	let keepUntracked = $state(true)

	const openStockIn = (item: InventoryItem): void => {
		stockInItem = item
		stockInQuantity = 1
		stockInExpiryDate = ''
		clearOrderDate = !!item.order_date
		keepUntracked = item.not_track
		showStockInDialog = true
	}

	const closeStockIn = (): void => {
		showStockInDialog = false
		stockInItem = null
	}

	const confirmStockIn = async (): Promise<void> => {
		if (!stockInItem || Number(stockInQuantity) <= 0) return
		const item = stockInItem
		await inventoryStore.stockIn(
			item.id,
			Number(stockInQuantity),
			clearOrderDate,
			keepUntracked,
			stockInExpiryDate || null,
		)
		if (!inventoryStore.error) {
			toast.success(`Stocked in ${plural(Number(stockInQuantity), item.unit)} of ${item.item_name}`)
			closeStockIn()
		}
	}

	// ---------- Stock out ----------
	let showStockOutDialog = $state(false)
	let stockOutItem = $state<InventoryItem | null>(null)
	let stockOutQuantity = $state(1)

	// The dialog keeps a snapshot; read the live row so the maximum tracks the store
	const stockOutLive = $derived(
		stockOutItem ? (inventoryStore.getItemById(stockOutItem.id) ?? stockOutItem) : null,
	)
	const stockOutMax = $derived(stockOutLive?.quantity ?? 0)

	const openStockOut = (item: InventoryItem): void => {
		stockOutItem = item
		stockOutQuantity = 1
		showStockOutDialog = true
	}

	const closeStockOut = (): void => {
		showStockOutDialog = false
		stockOutItem = null
	}

	// Which batches a stock out would draw from, earliest expiry first
	const stockOutPlan = $derived.by((): Array<{ batch: StockBatch; take: number }> => {
		if (!stockOutItem) return []
		let remaining = Math.max(0, Math.floor(Number(stockOutQuantity) || 0))
		const plan: Array<{ batch: StockBatch; take: number }> = []
		for (const batch of stockBatchesStore.getBatchesForItem(stockOutItem.id)) {
			if (remaining <= 0) break
			const take = Math.min(batch.quantity, remaining)
			plan.push({ batch, take })
			remaining -= take
		}
		return plan
	})

	const expiredInPlan = $derived(
		stockOutPlan
			.filter(({ batch }) => getExpiryStatus(batch.expiry_date) === 'expired')
			.reduce((sum, { take }) => sum + take, 0),
	)

	const isStockOutValid = $derived(
		Number(stockOutQuantity) > 0 && Number(stockOutQuantity) <= stockOutMax,
	)

	const confirmStockOut = async (): Promise<void> => {
		if (!stockOutItem || !isStockOutValid) return
		const item = stockOutItem
		await inventoryStore.stockOut(item.id, Number(stockOutQuantity))
		if (!inventoryStore.error) {
			toast.success(
				`Stocked out ${plural(Number(stockOutQuantity), item.unit)} of ${item.item_name}`,
			)
			closeStockOut()
		}
	}

	// ---------- Edit item ----------
	interface EditItemForm {
		item_name: string
		unit: string
		reorder_level: number
		remark: string
		not_track: boolean
	}

	let showEditDialog = $state(false)
	let editingItem = $state<InventoryItem | null>(null)
	let editForm = $state<EditItemForm>({
		item_name: '',
		unit: '',
		reorder_level: 0,
		remark: '',
		not_track: false,
	})

	const openEdit = (item: InventoryItem): void => {
		editingItem = item
		editForm = {
			item_name: item.item_name,
			unit: item.unit,
			reorder_level: item.reorder_level,
			remark: item.remark,
			not_track: item.not_track,
		}
		showEditDialog = true
	}

	const closeEdit = (): void => {
		showEditDialog = false
		editingItem = null
	}

	const isEditValid = $derived(
		editForm.item_name.trim() !== '' &&
			editForm.unit.trim() !== '' &&
			Number(editForm.reorder_level) >= -1,
	)

	const isEditChanged = $derived.by((): boolean => {
		if (!editingItem) return false
		return (
			editForm.item_name.trim() !== editingItem.item_name ||
			editForm.unit.trim() !== editingItem.unit ||
			Number(editForm.reorder_level) !== editingItem.reorder_level ||
			editForm.remark !== editingItem.remark ||
			editForm.not_track !== editingItem.not_track
		)
	})

	const confirmEdit = async (): Promise<void> => {
		if (!editingItem || !isEditValid || !isEditChanged) return
		const item = editingItem
		await inventoryStore.updateItem(item.id, {
			item_name: editForm.item_name.trim(),
			unit: editForm.unit.trim(),
			reorder_level: Math.max(-1, Math.floor(Number(editForm.reorder_level))),
			remark: editForm.remark,
			not_track: editForm.not_track,
		})
		if (!inventoryStore.error) {
			toast.success(`Saved ${editForm.item_name.trim()}`)
			closeEdit()
		}
	}

	// ---------- Delete item ----------
	let showDeleteDialog = $state(false)
	let deletingItem = $state<InventoryItem | null>(null)
	let deleteLoading = $state(false)

	const openDelete = (item: InventoryItem): void => {
		deletingItem = item
		showDeleteDialog = true
	}

	const closeDelete = (): void => {
		showDeleteDialog = false
		deletingItem = null
	}

	// Delete also lives inside Edit, on the leading edge of its footer
	const deleteFromEdit = (): void => {
		const item = editingItem
		closeEdit()
		if (item) openDelete(item)
	}

	const confirmDelete = async (): Promise<void> => {
		if (!deletingItem) return
		const item = deletingItem
		deleteLoading = true
		try {
			await inventoryStore.deleteItem(item.id)
			if (!inventoryStore.error) {
				toast.success(`Deleted ${item.item_name}`)
				closeDelete()
			}
		} finally {
			deleteLoading = false
		}
	}

	// ---------- Batches ----------
	let showBatchesDialog = $state(false)
	let batchesItem = $state<InventoryItem | null>(null)
	let editingBatchId = $state<string | null>(null)
	let batchForm = $state<{ quantity: number; expiry_date: string }>({
		quantity: 0,
		expiry_date: '',
	})

	const batchesForDialog = $derived(
		batchesItem ? stockBatchesStore.getBatchesForItem(batchesItem.id) : [],
	)
	const batchesLive = $derived(
		batchesItem ? (inventoryStore.getItemById(batchesItem.id) ?? batchesItem) : null,
	)
	const editingBatch = $derived(batchesForDialog.find((b) => b.id === editingBatchId) ?? null)

	const openBatches = (item: InventoryItem): void => {
		batchesItem = item
		editingBatchId = null
		showBatchesDialog = true
	}

	const closeBatches = (): void => {
		showBatchesDialog = false
		batchesItem = null
		editingBatchId = null
	}

	const startEditBatch = (batch: StockBatch): void => {
		editingBatchId = batch.id
		batchForm = { quantity: batch.quantity, expiry_date: batch.expiry_date ?? '' }
	}

	const isBatchChanged = $derived.by((): boolean => {
		if (!editingBatch) return false
		return (
			Math.floor(Number(batchForm.quantity) || 0) !== editingBatch.quantity ||
			(batchForm.expiry_date || '') !== (editingBatch.expiry_date ?? '')
		)
	})

	const confirmSaveBatch = async (): Promise<void> => {
		if (!editingBatch || !isBatchChanged) return
		const quantity = Math.floor(Number(batchForm.quantity) || 0)
		if (quantity < 0) return
		await stockBatchesStore.updateBatch(editingBatch.id, quantity, batchForm.expiry_date || null)
		if (!stockBatchesStore.error) {
			toast.success('Batch saved')
			editingBatchId = null
		}
	}

	// ---------- Excel import and export ----------
	interface ExcelRow {
		item_name: string
		quantity: number
		reorder_level: number
		unit: string
		remark: string
		order_date: string
	}

	const parseExcelFile = (file: File): Promise<ExcelRow[]> =>
		new Promise((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = (e) => {
				try {
					const data = new Uint8Array(e.target?.result as ArrayBuffer)
					const workbook = XLSX.read(data, { type: 'array' })
					const worksheet = workbook.Sheets[workbook.SheetNames[0]]
					resolve(XLSX.utils.sheet_to_json(worksheet) as ExcelRow[])
				} catch {
					reject(new Error('The file could not be read as an Excel sheet.'))
				}
			}
			reader.onerror = () => reject(new Error('The file could not be read.'))
			reader.readAsArrayBuffer(file)
		})

	const handleFileUpload = async (event: Event): Promise<void> => {
		const target = event.target as HTMLInputElement
		const file = target.files?.[0]
		target.value = ''
		if (!file) return

		importing = true
		importError = null
		const toastId = toast.loading(`Importing ${file.name}`)
		try {
			const rows = await parseExcelFile(file)
			for (const row of rows) {
				if (
					!row.item_name ||
					typeof row.quantity !== 'number' ||
					typeof row.reorder_level !== 'number' ||
					!row.unit ||
					!row.remark ||
					!row.order_date
				) {
					throw new Error(
						'Every row needs item_name, quantity, reorder_level, unit, remark and order_date.',
					)
				}
			}
			const result = await inventoryStore.importFromRows(
				rows.map((row) => ({
					item_name: String(row.item_name),
					quantity: Math.max(0, row.quantity),
					reorder_level: Math.max(0, row.reorder_level),
					unit: String(row.unit),
					remark: String(row.remark),
					order_date: String(row.order_date),
				})),
			)
			if (!result) throw new Error(inventoryStore.error || 'The import failed.')

			const parts = [
				result.imported > 0 ? `${plural(result.imported, 'item')} added` : null,
				result.updated > 0 ? `${plural(result.updated, 'item')} updated` : null,
				result.deleted > 0 ? `${plural(result.deleted, 'item')} removed` : null,
			].filter((part) => part !== null)
			toast.success(`Imported ${file.name}`, {
				id: toastId,
				description: parts.length > 0 ? parts.join(', ') : 'Nothing changed',
			})
		} catch (error) {
			toast.dismiss(toastId)
			importError = error instanceof Error ? error.message : 'The import failed.'
		} finally {
			importing = false
		}
	}

	const exportToExcel = (): void => {
		try {
			const worksheet = XLSX.utils.json_to_sheet(
				inventoryStore.items.map((item) => ({
					item_name: item.item_name,
					quantity: item.quantity,
					reorder_level: item.reorder_level,
					unit: item.unit,
					remark: item.remark,
					order_date: item.order_date,
				})),
			)
			worksheet['!cols'] = [
				{ wch: 50 },
				{ wch: 12 },
				{ wch: 22 },
				{ wch: 25 },
				{ wch: 50 },
				{ wch: 25 },
			]
			const workbook = XLSX.utils.book_new()
			XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory')
			XLSX.writeFile(workbook, `inventory_export_${todayIsoDate()}.xlsx`)
		} catch (error) {
			console.error('Export failed:', error)
			toast.error('The export failed. Try again.', { duration: Infinity })
		}
	}

	const initialLoading = $derived(inventoryStore.loading && inventoryStore.items.length === 0)
</script>

<svelte:window onkeydown={onKeydown} />

<PageHeader title="Inventory">
	<div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
		<InputGroup.Root class="w-full sm:w-72">
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
						size="icon-xs"
						aria-label="Clear search"
						onclick={() => (searchQuery = '')}
					>
						<XIcon />
					</InputGroup.Button>
				</InputGroup.Addon>
			{/if}
		</InputGroup.Root>
		<ToggleGroup.Root
			type="single"
			variant="outline"
			size="sm"
			value={filter}
			onValueChange={(value) => (filter = (value || 'all') as Filter)}
			aria-label="Filter by status"
		>
			{#each FILTERS as option (option.value)}
				<ToggleGroup.Item value={option.value}>{option.label}</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>
	</div>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon" aria-label="More">
					<EllipsisIcon />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Group>
				<DropdownMenu.Item onclick={() => fileInput?.click()}>
					<UploadIcon />
					Import from Excel…
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={exportToExcel}>
					<DownloadIcon />
					Export to Excel
				</DropdownMenu.Item>
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
	<Button onclick={openAddDialog}>
		<PlusIcon data-icon="inline-start" />
		Add Item…
	</Button>
</PageHeader>

<input
	bind:this={fileInput}
	type="file"
	accept=".xlsx"
	class="hidden"
	onchange={handleFileUpload}
/>

{#if importError}
	<Alert.Root variant="destructive">
		<TriangleAlertIcon />
		<Alert.Title>Import failed</Alert.Title>
		<Alert.Description>{importError}</Alert.Description>
		<Button
			variant="ghost"
			size="icon-xs"
			class="absolute top-2 right-2"
			aria-label="Dismiss"
			onclick={() => (importError = null)}
		>
			<XIcon />
		</Button>
	</Alert.Root>
{/if}

{#if initialLoading}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Item</Table.Head>
				<Table.Head>On hand</Table.Head>
				<Table.Head>Reorder level</Table.Head>
				<Table.Head>Nearest expiry</Table.Head>
				<Table.Head>Status</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each { length: 8 } as _, i (i)}
				<Table.Row>
					<Table.Cell class="py-3"><Skeleton class="h-4 w-48" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-20" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-16" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
					<Table.Cell><Skeleton class="h-5 w-16 rounded-full" /></Table.Cell>
					<Table.Cell><Skeleton class="ms-auto h-7 w-24" /></Table.Cell>
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
					: 'Add your first item to start tracking stock.'}
			</Empty.Description>
		</Empty.Header>
		<Empty.Content>
			{#if isFiltered}
				<Button variant="outline" onclick={clearFilters}>Clear Search</Button>
			{:else}
				<Button onclick={openAddDialog}>
					<PlusIcon data-icon="inline-start" />
					Add Item…
				</Button>
			{/if}
		</Empty.Content>
	</Empty.Root>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<SortHeader key="item_name" {sort} onsort={toggleSort}>Item</SortHeader>
				<SortHeader key="quantity" {sort} onsort={toggleSort}>On hand</SortHeader>
				<SortHeader key="reorder_level" {sort} onsort={toggleSort}>Reorder level</SortHeader>
				<SortHeader key="nearest_expiry" {sort} onsort={toggleSort}>Nearest expiry</SortHeader>
				<SortHeader key="status" {sort} onsort={toggleSort}>Status</SortHeader>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each list.visible as item (item.id)}
				{@const status = stockStatus(item)}
				{@const nearest = getNearestExpiry(item)}
				{@const badge = expiryBadge(nearest)}
				{@const batches = batchCount(item)}
				{@const showBar = !item.not_track && item.reorder_level > 0}
				<Table.Row>
					<Table.Cell class="max-w-md min-w-56 py-2.5 whitespace-normal">
						<div class="font-medium break-words">{item.item_name}</div>
						{#if item.order_date}
							<ToneBadge tone="info" class="mt-1">
								{#if item.back_order}
									<ClockIcon />
									Back-ordered {formatDayMonth(item.order_date)}
								{:else}
									<CalendarIcon />
									Ordered {formatDayMonth(item.order_date)}
								{/if}
							</ToneBadge>
						{:else if item.non_order_reason}
							<ReasonBadge reason={item.non_order_reason} class="mt-1" />
						{:else if batches > 1}
							<div class="text-muted-foreground mt-0.5 text-xs">{batches} batches</div>
						{/if}
					</Table.Cell>
					<Table.Cell class="py-2.5">
						<div
							class={cn(
								'flex flex-col gap-1 tabular-nums',
								status.tone === 'danger' && 'text-destructive',
								status.tone === 'warning' && 'text-warning',
							)}
						>
							<span>{item.quantity} {item.unit}</span>
							{#if showBar}
								<Progress
									value={Math.min(100, (item.quantity / item.reorder_level) * 100)}
									class={cn(
										'w-16',
										status.tone === 'danger' && '[&>[data-slot=progress-indicator]]:bg-destructive',
										status.tone === 'warning' && '[&>[data-slot=progress-indicator]]:bg-warning',
									)}
									aria-label="On hand against reorder level"
								/>
							{/if}
						</div>
					</Table.Cell>
					<Table.Cell class="py-2.5 tabular-nums">
						{#if item.reorder_level < 0 || item.not_track}
							<span class="text-muted-foreground">—</span>
						{:else}
							{item.reorder_level} {item.unit}
						{/if}
					</Table.Cell>
					<Table.Cell class="py-2.5 tabular-nums">
						{#if nearest}
							<div>{formatDate(nearest)}</div>
							{#if badge}
								<ToneBadge tone={badge.tone} class="mt-1">{badge.text}</ToneBadge>
							{/if}
						{:else}
							<span class="text-muted-foreground">—</span>
						{/if}
					</Table.Cell>
					<Table.Cell class="py-2.5">
						<ToneBadge tone={status.tone}>{status.text}</ToneBadge>
					</Table.Cell>
					<Table.Cell class="py-2.5">
						<div class="flex justify-end gap-1">
							<Button
								variant="outline"
								size="icon-sm"
								aria-label="Stock In…"
								title="Stock In…"
								onclick={() => openStockIn(item)}
							>
								<ArrowDownToLineIcon />
							</Button>
							<Button
								variant="outline"
								size="icon-sm"
								aria-label="Stock Out…"
								title="Stock Out…"
								disabled={item.quantity === 0}
								onclick={() => openStockOut(item)}
							>
								<ArrowUpFromLineIcon />
							</Button>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button {...props} variant="ghost" size="icon-sm" aria-label="More">
											<EllipsisIcon />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end">
									<DropdownMenu.Group>
										<DropdownMenu.Item onclick={() => openEdit(item)}>
											<PencilIcon />
											Edit…
										</DropdownMenu.Item>
										<DropdownMenu.Item onclick={() => openBatches(item)}>
											<LayersIcon />
											Batches…
										</DropdownMenu.Item>
									</DropdownMenu.Group>
									<DropdownMenu.Separator />
									<DropdownMenu.Group>
										<DropdownMenu.Item variant="destructive" onclick={() => openDelete(item)}>
											<Trash2Icon />
											Delete…
										</DropdownMenu.Item>
									</DropdownMenu.Group>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
	<div class="text-muted-foreground flex items-center justify-between gap-3 text-sm">
		<span>Showing {list.shown} of {plural(list.total, 'item')}</span>
		{#if list.hasMore}
			<Button variant="outline" size="sm" onclick={list.loadMore}>Load More</Button>
		{/if}
	</div>
{/if}

<!-- Add Item -->
<ActionModal
	bind:open={showAddDialog}
	title="Add Item"
	loading={inventoryStore.loading}
	disabled={!isNewItemValid}
	confirmText="Add Item"
	onconfirm={confirmAddItem}
	oncancel={closeAddDialog}
	onclose={closeAddDialog}
>
	<form
		id="add-item-form"
		onsubmit={(e) => {
			e.preventDefault()
			confirmAddItem()
		}}
	>
		<Field.Group>
			<Field.Field>
				<Field.Label for="add-name">Item name</Field.Label>
				<Input
					id="add-name"
					bind:ref={newItemNameInput}
					bind:value={newItem.item_name}
					placeholder="e.g. Ibuprofen 400 mg"
					required
				/>
			</Field.Field>
			<div class="grid grid-cols-2 gap-4">
				<Field.Field>
					<Field.Label for="add-unit">Unit</Field.Label>
					<Input id="add-unit" bind:value={newItem.unit} placeholder="e.g. tabs" required />
				</Field.Field>
				<Field.Field>
					<Field.Label for="add-reorder">Reorder level</Field.Label>
					<Input
						id="add-reorder"
						bind:value={newItem.reorder_level}
						type="number"
						min={-1}
						step={1}
						required
						{@attach selectOnFocus()}
					/>
					<Field.Description>Set to −1 for no reorder alert.</Field.Description>
				</Field.Field>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<Field.Field>
					<Field.Label for="add-quantity">Initial quantity</Field.Label>
					<Input
						id="add-quantity"
						bind:value={newItem.quantity}
						type="number"
						min={0}
						step={1}
						required
						{@attach selectOnFocus()}
					/>
				</Field.Field>
				<Field.Field data-disabled={Number(newItem.quantity) <= 0 || undefined}>
					<Field.Label for="add-expiry">Expiry date</Field.Label>
					<Input
						id="add-expiry"
						bind:value={newItem.expiry_date}
						type="date"
						min={todayIsoDate()}
						disabled={Number(newItem.quantity) <= 0}
					/>
					<Field.Description>Enabled once a quantity is entered.</Field.Description>
				</Field.Field>
			</div>
			<Field.Field>
				<Field.Label for="add-remark">Remark</Field.Label>
				<Textarea
					id="add-remark"
					bind:value={newItem.remark}
					rows={2}
					placeholder="e.g. last purchase price, supplier"
				/>
			</Field.Field>
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

<!-- Stock In -->
<ActionModal
	bind:open={showStockInDialog}
	title={`Stock In · ${stockInItem?.item_name ?? ''}`}
	description={`On hand ${stockInItem?.quantity ?? 0} ${stockInItem?.unit ?? ''}. This stock is recorded as its own batch; stock out takes from the earliest-expiring batch first.`}
	loading={inventoryStore.loading}
	disabled={Number(stockInQuantity) <= 0}
	confirmText="Stock In"
	onconfirm={confirmStockIn}
	oncancel={closeStockIn}
	onclose={closeStockIn}
>
	<form
		onsubmit={(e) => {
			e.preventDefault()
			confirmStockIn()
		}}
	>
		<Field.Group>
			<div class="grid grid-cols-2 gap-4">
				<Field.Field>
					<Field.Label for="stock-in-quantity">Quantity to add</Field.Label>
					<Input
						id="stock-in-quantity"
						bind:value={stockInQuantity}
						type="number"
						min={1}
						step={1}
						required
						{@attach selectOnFocus()}
					/>
				</Field.Field>
				<Field.Field>
					<Field.Label for="stock-in-expiry">Expiry date</Field.Label>
					<Input
						id="stock-in-expiry"
						bind:value={stockInExpiryDate}
						type="date"
						min={todayIsoDate()}
					/>
					<Field.Description>Leave empty if the batch has no expiry.</Field.Description>
				</Field.Field>
			</div>
			{#if stockInItem?.order_date}
				<Field.Field orientation="horizontal">
					<Checkbox id="stock-in-clear-order" bind:checked={clearOrderDate} />
					<Field.Label for="stock-in-clear-order">
						Received: clear the order date ({formatDayMonth(stockInItem.order_date)})
					</Field.Label>
				</Field.Field>
			{/if}
			{#if stockInItem?.not_track}
				<Field.Field orientation="horizontal">
					<Checkbox id="stock-in-untracked" bind:checked={keepUntracked} />
					<Field.Content>
						<Field.Label for="stock-in-untracked">Keep untracked</Field.Label>
						<Field.Description>
							Untick to start counting this item in stock totals and low-stock alerts.
						</Field.Description>
					</Field.Content>
				</Field.Field>
			{/if}
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

<!-- Stock Out -->
<ActionModal
	bind:open={showStockOutDialog}
	title={`Stock Out · ${stockOutItem?.item_name ?? ''}`}
	description={`On hand ${stockOutMax} ${stockOutLive?.unit ?? ''} across ${plural(stockOutItem ? batchCount(stockOutItem) : 0, 'batch', 'batches')}.`}
	loading={inventoryStore.loading}
	disabled={!isStockOutValid}
	confirmText="Stock Out"
	onconfirm={confirmStockOut}
	oncancel={closeStockOut}
	onclose={closeStockOut}
>
	<form
		onsubmit={(e) => {
			e.preventDefault()
			confirmStockOut()
		}}
	>
		<Field.Group>
			<Field.Field data-invalid={Number(stockOutQuantity) > stockOutMax || undefined}>
				<Field.Label for="stock-out-quantity">Quantity to remove</Field.Label>
				<Input
					id="stock-out-quantity"
					bind:value={stockOutQuantity}
					type="number"
					min={1}
					max={stockOutMax}
					step={1}
					required
					aria-invalid={Number(stockOutQuantity) > stockOutMax || undefined}
					{@attach selectOnFocus()}
				/>
				{#if Number(stockOutQuantity) > stockOutMax}
					<Field.Error>Only {stockOutMax} {stockOutLive?.unit} on hand.</Field.Error>
				{:else}
					<Field.Description>Up to {stockOutMax} {stockOutLive?.unit}.</Field.Description>
				{/if}
			</Field.Field>
			{#if stockOutPlan.length > 0}
				<Field.Field>
					<Field.Label>Taken from</Field.Label>
					<ul class="divide-border bg-muted/40 divide-y rounded-lg border text-sm">
						{#each stockOutPlan as { batch, take } (batch.id)}
							{@const badge = expiryBadge(batch.expiry_date)}
							<li class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
								<span class="tabular-nums">
									{take} of {batch.quantity}
									{stockOutLive?.unit} · received {formatDate(batch._creationTime)}
								</span>
								{#if badge}
									<ToneBadge tone={badge.tone}>{badge.text}</ToneBadge>
								{:else if batch.expiry_date}
									<span class="text-muted-foreground text-xs">
										Expires {formatDate(batch.expiry_date)}
									</span>
								{:else}
									<span class="text-muted-foreground text-xs">No expiry</span>
								{/if}
							</li>
						{/each}
					</ul>
					{#if expiredInPlan > 0}
						<p class="text-warning text-sm">
							{expiredInPlan}
							{stockOutLive?.unit} in this stock-out are already expired.
						</p>
					{/if}
				</Field.Field>
			{/if}
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

<!-- Edit Item -->
<ActionModal
	bind:open={showEditDialog}
	title={`Edit Item · ${editingItem?.item_name ?? ''}`}
	loading={inventoryStore.loading}
	disabled={!isEditValid || !isEditChanged}
	confirmText="Save"
	onconfirm={confirmEdit}
	oncancel={closeEdit}
	onclose={closeEdit}
>
	{#snippet leading()}
		<Button variant="destructive" onclick={deleteFromEdit}>Delete Item…</Button>
	{/snippet}
	<form
		onsubmit={(e) => {
			e.preventDefault()
			confirmEdit()
		}}
	>
		<Field.Group>
			<Field.Field>
				<Field.Label for="edit-name">Item name</Field.Label>
				<Input id="edit-name" bind:value={editForm.item_name} required />
			</Field.Field>
			<div class="grid grid-cols-2 gap-4">
				<Field.Field>
					<Field.Label for="edit-unit">Unit</Field.Label>
					<Input id="edit-unit" bind:value={editForm.unit} required />
				</Field.Field>
				<Field.Field>
					<Field.Label for="edit-reorder">Reorder level</Field.Label>
					<Input
						id="edit-reorder"
						bind:value={editForm.reorder_level}
						type="number"
						min={-1}
						step={1}
						required
						{@attach selectOnFocus()}
					/>
					<Field.Description>Set to −1 for no reorder alert.</Field.Description>
				</Field.Field>
			</div>
			<Field.Field>
				<Field.Label for="edit-remark">Remark</Field.Label>
				<Textarea id="edit-remark" bind:value={editForm.remark} rows={2} />
			</Field.Field>
			<Field.Field orientation="horizontal">
				<Checkbox id="edit-not-track" bind:checked={editForm.not_track} />
				<Field.Content>
					<Field.Label for="edit-not-track">Not tracked</Field.Label>
					<Field.Description>
						Untracked items are left out of stock totals and low-stock alerts. On hand is {editingItem?.quantity ??
							0}
						{editingItem?.unit}; use Stock In, Stock Out or Batches to change it.
					</Field.Description>
				</Field.Content>
			</Field.Field>
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

<!-- Batches -->
<ActionModal
	bind:open={showBatchesDialog}
	title={`Edit Batches · ${batchesItem?.item_name ?? ''}`}
	description={`${batchesLive?.quantity ?? 0} ${batchesLive?.unit ?? ''} across ${plural(batchesForDialog.length, 'batch', 'batches')}. Changing a quantity is logged as a stock movement.`}
	loading={stockBatchesStore.loading}
	disabled={!editingBatch || !isBatchChanged}
	confirmText="Save"
	cancelText="Close"
	onconfirm={confirmSaveBatch}
	oncancel={closeBatches}
	onclose={closeBatches}
>
	{#if batchesForDialog.length === 0}
		<Empty.Root class="py-6">
			<Empty.Header>
				<Empty.Title>No stock on hand</Empty.Title>
				<Empty.Description>Stock In adds the first batch.</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	{:else}
		<ul class="divide-border max-h-80 divide-y overflow-y-auto rounded-lg border text-sm">
			{#each batchesForDialog as batch, index (batch.id)}
				{@const badge = expiryBadge(batch.expiry_date)}
				{#if editingBatchId === batch.id}
					<li class="bg-muted/40 p-3">
						<form
							class="flex flex-col gap-3"
							onsubmit={(e) => {
								e.preventDefault()
								confirmSaveBatch()
							}}
						>
							<div class="flex items-center justify-between gap-2">
								<span class="font-medium">
									Batch {index + 1} · received {formatDate(batch._creationTime)}
								</span>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onclick={() => (editingBatchId = null)}
								>
									Cancel Edit
								</Button>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<Field.Field>
									<Field.Label for="batch-quantity">Quantity ({batchesItem?.unit})</Field.Label>
									<Input
										id="batch-quantity"
										bind:value={batchForm.quantity}
										type="number"
										min={0}
										step={1}
										{@attach selectOnFocus()}
									/>
								</Field.Field>
								<Field.Field>
									<Field.Label for="batch-expiry">Expiry date</Field.Label>
									<Input id="batch-expiry" bind:value={batchForm.expiry_date} type="date" />
								</Field.Field>
							</div>
							<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
						</form>
					</li>
				{:else}
					<li class="flex items-center justify-between gap-3 p-3">
						<div class="min-w-0">
							<div class="tabular-nums">
								<span class="font-medium">{batch.quantity} {batchesItem?.unit}</span>
								<span class="text-muted-foreground"> · Batch {index + 1}</span>
							</div>
							<div
								class="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
							>
								<span>
									Received {formatDate(batch._creationTime)} · {batch.expiry_date
										? `expires ${formatDate(batch.expiry_date)}`
										: 'no expiry'}
								</span>
								{#if badge}
									<ToneBadge tone={badge.tone}>{badge.text}</ToneBadge>
								{/if}
							</div>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label="Edit batch {index + 1}"
							title="Edit"
							disabled={stockBatchesStore.loading}
							onclick={() => startEditBatch(batch)}
						>
							<PencilIcon />
						</Button>
					</li>
				{/if}
			{/each}
		</ul>
	{/if}
</ActionModal>

<!-- Delete Item -->
<ActionModal
	bind:open={showDeleteDialog}
	title={`Delete “${deletingItem?.item_name ?? ''}”?`}
	description="Its movement history stays in Stock Movements. This cannot be undone."
	loading={deleteLoading}
	confirmText="Delete"
	onconfirm={confirmDelete}
	oncancel={closeDelete}
	onclose={closeDelete}
/>

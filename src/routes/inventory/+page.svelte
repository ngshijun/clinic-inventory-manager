<script lang="ts">
	import { tick, untrack } from 'svelte'
	import { SvelteSet } from 'svelte/reactivity'
	import { page } from '$app/state'
	import { toast } from 'svelte-sonner'
	import * as XLSX from 'xlsx'
	import ArrowDownToLineIcon from '@lucide/svelte/icons/arrow-down-to-line'
	import ArrowUpFromLineIcon from '@lucide/svelte/icons/arrow-up-from-line'
	import CalendarIcon from '@lucide/svelte/icons/calendar'
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
	import ClockIcon from '@lucide/svelte/icons/clock'
	import DownloadIcon from '@lucide/svelte/icons/download'
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis'
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
	import DialogSubject from '$lib/components/app/DialogSubject.svelte'
	import DiscardDialog from '$lib/components/app/DiscardDialog.svelte'
	import PageHeader from '$lib/components/app/PageHeader.svelte'
	import ReasonBadge from '$lib/components/app/ReasonBadge.svelte'
	import SortHeader from '$lib/components/app/SortHeader.svelte'
	import StatusDot from '$lib/components/app/StatusDot.svelte'
	import StockOutDialog from '$lib/components/app/StockOutDialog.svelte'
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
	import { Skeleton } from '$lib/components/ui/skeleton'
	import { Spinner } from '$lib/components/ui/spinner'
	import * as Table from '$lib/components/ui/table'
	import { Textarea } from '$lib/components/ui/textarea'
	import * as ToggleGroup from '$lib/components/ui/toggle-group'
	import { useErrorToast } from '$lib/composables/errorToast.svelte'
	import { createLoadMore } from '$lib/composables/loadMore.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockBatchesStore } from '$lib/stores/stockBatches.svelte'
	import type { InventoryItem, NewInventoryItem } from '$lib/types/inventory'
	import { getExpiryStatus, todayIsoDate, type StockBatch } from '$lib/types/stockBatches'
	import { formatDate, formatDayMonth } from '$lib/utils/date'
	import { expiryBadge } from '$lib/utils/expiry'
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
	// The dashboard links here with ?filter=low, ?filter=out and so on
	const isFilter = (value: string | null): value is Filter =>
		FILTERS.some((option) => option.value === value)
	const initialFilter = page.url.searchParams.get('filter')
	let filter = $state<Filter>(isFilter(initialFilter) ? initialFilter : 'all')
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

	useErrorToast(
		() => inventoryStore.error,
		() => importing,
	)
	useErrorToast(() => stockBatchesStore.error)

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

	const isNewItemDirty = $derived(JSON.stringify(newItem) !== JSON.stringify(emptyNewItem()))

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

	// What the person needs to know before typing a quantity; prose says none of it
	const stockInFacts = $derived.by((): Array<{ label: string; value: string }> => {
		if (!stockInItem) return []
		const rows = [
			{ label: 'On hand', value: `${stockInItem.quantity} ${stockInItem.unit}` },
			{ label: 'Reorder at', value: String(stockInItem.reorder_level) },
			{
				label: 'Batches',
				value: String(stockBatchesStore.batchesByItem.get(stockInItem.id)?.length ?? 0),
			},
		]
		if (stockInItem.order_date)
			rows.push({ label: 'Ordered', value: formatDate(stockInItem.order_date) })
		return rows
	})
	const stockInAfter = $derived(
		(stockInItem?.quantity ?? 0) + Math.max(0, Math.floor(Number(stockInQuantity) || 0)),
	)

	const isStockInDirty = $derived(
		stockInItem !== null &&
			(Number(stockInQuantity) !== 1 ||
				stockInExpiryDate !== '' ||
				clearOrderDate !== !!stockInItem.order_date ||
				keepUntracked !== stockInItem.not_track),
	)

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
	let stockOutDialog = $state<StockOutDialog | null>(null)

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

	// ---------- Batches (inline rows under the item) ----------
	const expandedIds = new SvelteSet<string>()
	let editingBatchId = $state<string | null>(null)
	let batchForm = $state<{ quantity: number; expiry_date: string }>({
		quantity: 0,
		expiry_date: '',
	})
	let askDiscardBatch = $state(false)
	// The item whose rows collapse once the unsaved batch edit is discarded, if any.
	let collapseAfterDiscard: string | null = null

	const editingBatch = $derived(
		editingBatchId
			? (stockBatchesStore.batches.find((batch) => batch.id === editingBatchId) ?? null)
			: null,
	)

	const isBatchChanged = $derived.by((): boolean => {
		if (!editingBatch) return false
		return (
			Math.floor(Number(batchForm.quantity) || 0) !== editingBatch.quantity ||
			(batchForm.expiry_date || '') !== (editingBatch.expiry_date ?? '')
		)
	})

	/** Open or close an item's batch rows. Closing over a dirty edit asks first. */
	const toggleBatches = (item: InventoryItem): void => {
		if (!expandedIds.has(item.id)) {
			expandedIds.add(item.id)
			return
		}
		if (editingBatch?.item_id === item.id) {
			if (isBatchChanged) {
				collapseAfterDiscard = item.id
				askDiscardBatch = true
				return
			}
			editingBatchId = null
		}
		expandedIds.delete(item.id)
	}

	const startEditBatch = async (batch: StockBatch): Promise<void> => {
		editingBatchId = batch.id
		batchForm = { quantity: batch.quantity, expiry_date: batch.expiry_date ?? '' }
		await tick()
		document.getElementById('batch-quantity')?.focus()
	}

	/** Cancel from the button or Escape: a dirty edit asks before it is dropped. */
	const requestCancelBatch = (): void => {
		if (isBatchChanged) {
			collapseAfterDiscard = null
			askDiscardBatch = true
		} else {
			editingBatchId = null
		}
	}

	const discardBatchEdit = (): void => {
		editingBatchId = null
		if (collapseAfterDiscard) expandedIds.delete(collapseAfterDiscard)
		collapseAfterDiscard = null
	}

	const confirmSaveBatch = async (): Promise<void> => {
		if (!editingBatch || !isBatchChanged || stockBatchesStore.loading) return
		const quantity = Math.floor(Number(batchForm.quantity) || 0)
		if (quantity < 0) return
		await stockBatchesStore.updateBatch(editingBatch.id, quantity, batchForm.expiry_date || null)
		if (!stockBatchesStore.error) {
			toast.success('Batch saved')
			editingBatchId = null
		}
	}

	const onBatchKeydown = (event: KeyboardEvent): void => {
		if (event.key === 'Enter') {
			event.preventDefault()
			confirmSaveBatch()
		} else if (event.key === 'Escape') {
			event.preventDefault()
			requestCancelBatch()
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
					<DownloadIcon />
					Import from Excel…
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={exportToExcel}>
					<UploadIcon />
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
			class="absolute end-2 top-2"
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
	<!--
		Borders sit on the cells rather than the rows so an open item can lift
		into a rounded card: each item is its own tbody, and the open one gets
		an outline, a shadow and a card ground.
	-->
	<Table.Root
		class="border-separate border-spacing-0 [&_td]:border-b [&_th]:border-b [&_tr]:border-0 [&>tbody:last-child>tr:last-child>td]:border-b-0"
	>
		<Table.Header>
			<Table.Row>
				<Table.Head class="w-9"><span class="sr-only">Batches</span></Table.Head>
				<SortHeader key="item_name" {sort} onsort={toggleSort}>Item</SortHeader>
				<SortHeader key="quantity" {sort} onsort={toggleSort}>On hand</SortHeader>
				<SortHeader key="reorder_level" {sort} onsort={toggleSort}>Reorder level</SortHeader>
				<SortHeader key="nearest_expiry" {sort} onsort={toggleSort}>Nearest expiry</SortHeader>
				<SortHeader key="status" {sort} onsort={toggleSort}>Status</SortHeader>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		{#each list.visible as item (item.id)}
			{@const status = stockStatus(item)}
			{@const nearest = getNearestExpiry(item)}
			{@const badge = expiryBadge(nearest)}
			{@const batches = batchCount(item)}
			{@const open = expandedIds.has(item.id)}
			<Table.Body
				class={cn(
					open &&
						'[&_td]:bg-card outline-border-strong rounded-xl shadow-[0_8px_24px_-16px_rgba(21,32,40,0.35)] outline -outline-offset-1 [&>tr:first-child>td:first-child]:rounded-tl-xl [&>tr:first-child>td:last-child]:rounded-tr-xl [&>tr:last-child>td]:border-b-0 [&>tr:last-child>td:first-child]:rounded-bl-xl [&>tr:last-child>td:last-child]:rounded-br-xl',
				)}
			>
				<!-- Status is a stripe on the leading edge; it steps aside while the item is open. -->
				<Table.Row
					class={cn(
						!open && status.tone === 'danger' && 'shadow-[inset_3px_0_0_var(--destructive)]',
						!open && status.tone === 'warning' && 'shadow-[inset_3px_0_0_var(--warning)]',
					)}
				>
					<Table.Cell class="w-9 py-2.5 ps-1 pe-0">
						<Button
							variant="ghost"
							size="icon-sm"
							aria-expanded={open}
							aria-label={open
								? `Hide batches for ${item.item_name}`
								: `Show batches for ${item.item_name}`}
							class={cn('[&>svg]:transition-transform', open && 'bg-muted [&>svg]:rotate-90')}
							onclick={() => toggleBatches(item)}
						>
							<ChevronRightIcon />
						</Button>
					</Table.Cell>
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
						{:else if batches > 0}
							<div class="text-muted-foreground mt-0.5 text-xs">
								{plural(batches, 'batch', 'batches')}{open && batches > 1
									? ' · Stock Out takes the earliest expiry first'
									: ''}
							</div>
						{:else if !item.not_track}
							<div class="text-muted-foreground mt-0.5 text-xs">No stock</div>
						{/if}
					</Table.Cell>
					<Table.Cell class="py-2.5 tabular-nums">{item.quantity} {item.unit}</Table.Cell>
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
						<StatusDot tone={status.tone}>{status.text}</StatusDot>
					</Table.Cell>
					<Table.Cell class="py-2.5">
						<div class="flex justify-end gap-1">
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Stock In…"
								title="Stock In…"
								onclick={() => openStockIn(item)}
							>
								<ArrowDownToLineIcon />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Stock Out…"
								title="Stock Out…"
								disabled={item.quantity === 0}
								onclick={() => stockOutDialog?.open(item)}
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
				{#if open}
					{@const itemBatches = stockBatchesStore.getBatchesForItem(item.id)}
					{#if itemBatches.length === 0}
						<Table.Row>
							<Table.Cell class="py-2"></Table.Cell>
							<Table.Cell colspan={6} class="py-2.5 whitespace-normal">
								<div class="flex flex-wrap items-center justify-between gap-3">
									<div>
										<div class="text-sm font-medium">No stock on hand</div>
										<div class="text-muted-foreground text-xs">Stock In adds the first batch.</div>
									</div>
									<Button variant="outline" size="sm" onclick={() => openStockIn(item)}>
										<ArrowDownToLineIcon data-icon="inline-start" />
										Stock In…
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{:else}
						<!-- One lighter row per batch, in stock-out (FEFO) order, using the item's own columns. -->
						{#each itemBatches as batch, index (batch.id)}
							{@const editing = editingBatchId === batch.id}
							{@const batchBadge = expiryBadge(batch.expiry_date)}
							<Table.Row class={cn('text-foreground/85', editing && '[&>td]:bg-muted/60!')}>
								<Table.Cell class="py-2"></Table.Cell>
								<Table.Cell class="py-2 whitespace-normal">
									<div class="flex items-center gap-2 text-sm">
										<span
											class="bg-muted text-muted-foreground flex size-5 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums"
										>
											{index + 1}
										</span>
										<span class="text-foreground font-medium">Batch {index + 1}</span>
									</div>
									<div class="text-muted-foreground mt-0.5 ps-7 text-xs">
										Received {formatDate(batch._creationTime)}
									</div>
								</Table.Cell>
								<Table.Cell class="py-2 tabular-nums">
									{#if editing}
										<Input
											id="batch-quantity"
											type="number"
											min={0}
											step={1}
											bind:value={batchForm.quantity}
											class="h-8 w-28"
											aria-label="Quantity ({item.unit})"
											onkeydown={onBatchKeydown}
											{@attach selectOnFocus()}
										/>
									{:else}
										<span class="text-foreground font-medium">{batch.quantity} {item.unit}</span>
									{/if}
								</Table.Cell>
								<Table.Cell class="py-2"></Table.Cell>
								<Table.Cell class="py-2 tabular-nums">
									{#if editing}
										<Input
											type="date"
											bind:value={batchForm.expiry_date}
											class="h-8 w-40"
											aria-label="Expiry date"
											onkeydown={onBatchKeydown}
										/>
									{:else if batch.expiry_date}
										<div>{formatDate(batch.expiry_date)}</div>
										{#if batchBadge}
											<ToneBadge tone={batchBadge.tone} class="mt-1">{batchBadge.text}</ToneBadge>
										{/if}
									{:else}
										<span class="text-muted-foreground">No expiry</span>
									{/if}
								</Table.Cell>
								<Table.Cell class="py-2"></Table.Cell>
								<Table.Cell class="py-2">
									<div class="flex justify-end gap-1">
										{#if editing}
											<Button
												variant="ghost"
												size="sm"
												disabled={stockBatchesStore.loading}
												onclick={requestCancelBatch}
											>
												Cancel
											</Button>
											<Button
												size="sm"
												disabled={!isBatchChanged || stockBatchesStore.loading}
												onclick={confirmSaveBatch}
											>
												{#if stockBatchesStore.loading}
													<Spinner data-icon="inline-start" />
												{/if}
												Save
											</Button>
										{:else}
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label="Edit batch {index + 1}"
												title="Edit"
												disabled={editingBatchId !== null || stockBatchesStore.loading}
												onclick={() => startEditBatch(batch)}
											>
												<PencilIcon />
											</Button>
										{/if}
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				{/if}
			</Table.Body>
		{/each}
	</Table.Root>
	<div class="text-muted-foreground flex items-center justify-between gap-3 text-sm">
		<span>Showing {list.shown} of {plural(list.total, 'item')}</span>
		{#if list.hasMore}
			<Button variant="outline" onclick={list.loadMore}>Load More</Button>
		{/if}
	</div>
{/if}

<!-- Add Item -->
<ActionModal
	bind:open={showAddDialog}
	title="Add Item"
	loading={inventoryStore.loading}
	disabled={!isNewItemValid}
	dirty={isNewItemDirty}
	confirmText="Add Item"
	onconfirm={confirmAddItem}
	oncancel={closeAddDialog}
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
	title="Stock In"
	loading={inventoryStore.loading}
	disabled={Number(stockInQuantity) <= 0}
	dirty={isStockInDirty}
	confirmText="Stock In"
	onconfirm={confirmStockIn}
	oncancel={closeStockIn}
>
	{#if stockInItem}
		<DialogSubject name={stockInItem.item_name} facts={stockInFacts} />
	{/if}
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
					{#if Number(stockInQuantity) > 0}
						<Field.Description>
							{stockInAfter}
							{stockInItem?.unit} after this stock in.
						</Field.Description>
					{/if}
				</Field.Field>
				<Field.Field>
					<Field.Label for="stock-in-expiry">
						Expiry date <span class="text-muted-foreground font-normal">optional</span>
					</Field.Label>
					<Input
						id="stock-in-expiry"
						bind:value={stockInExpiryDate}
						type="date"
						min={todayIsoDate()}
					/>
				</Field.Field>
			</div>
			{#if stockInItem?.order_date}
				<Field.Field orientation="horizontal">
					<Checkbox id="stock-in-clear-order" bind:checked={clearOrderDate} />
					<Field.Label for="stock-in-clear-order">Received: clear the order date</Field.Label>
				</Field.Field>
			{/if}
			{#if stockInItem?.not_track}
				<Field.Field orientation="horizontal">
					<Checkbox id="stock-in-untracked" bind:checked={keepUntracked} />
					<Field.Label for="stock-in-untracked">Keep untracked</Field.Label>
				</Field.Field>
			{/if}
		</Field.Group>
		<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
	</form>
</ActionModal>

<StockOutDialog bind:this={stockOutDialog} />

<!-- Edit Item -->
<ActionModal
	bind:open={showEditDialog}
	title={`Edit Item · ${editingItem?.item_name ?? ''}`}
	loading={inventoryStore.loading}
	disabled={!isEditValid || !isEditChanged}
	dirty={isEditChanged}
	confirmText="Save"
	onconfirm={confirmEdit}
	oncancel={closeEdit}
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

<DiscardDialog bind:open={askDiscardBatch} ondiscard={discardBatchEdit} />

<!-- Delete Item -->
<ActionModal
	bind:open={showDeleteDialog}
	title={`Delete “${deletingItem?.item_name ?? ''}”?`}
	description="Its movement history stays in Stock Movements. This cannot be undone."
	loading={deleteLoading}
	confirmText="Delete"
	onconfirm={confirmDelete}
	oncancel={closeDelete}
/>

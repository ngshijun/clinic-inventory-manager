<script lang="ts">
	import { untrack } from 'svelte'
	import { toast } from 'svelte-sonner'
	import { getLocalTimeZone, parseDate, today, type DateValue } from '@internationalized/date'
	import type { DateRange } from 'bits-ui'
	import CalendarIcon from '@lucide/svelte/icons/calendar'
	import HistoryIcon from '@lucide/svelte/icons/history'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import SearchIcon from '@lucide/svelte/icons/search'
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal'
	import XIcon from '@lucide/svelte/icons/x'
	import { caretAtEnd } from '$lib/attachments/focus'
	import ActionModal from '$lib/components/app/ActionModal.svelte'
	import DialogSubject from '$lib/components/app/DialogSubject.svelte'
	import ItemPicker from '$lib/components/app/ItemPicker.svelte'
	import PageHeader from '$lib/components/app/PageHeader.svelte'
	import SortHeader from '$lib/components/app/SortHeader.svelte'
	import type { SortState } from '$lib/components/app/sort'
	import { Badge } from '$lib/components/ui/badge'
	import { Button } from '$lib/components/ui/button'
	import * as Empty from '$lib/components/ui/empty'
	import * as Field from '$lib/components/ui/field'
	import { Input } from '$lib/components/ui/input'
	import * as InputGroup from '$lib/components/ui/input-group'
	import * as Popover from '$lib/components/ui/popover'
	import { RangeCalendar } from '$lib/components/ui/range-calendar'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import { Spinner } from '$lib/components/ui/spinner'
	import * as Table from '$lib/components/ui/table'
	import { Textarea } from '$lib/components/ui/textarea'
	import * as ToggleGroup from '$lib/components/ui/toggle-group'
	import * as Tooltip from '$lib/components/ui/tooltip'
	import { useErrorToast } from '$lib/composables/errorToast.svelte'
	import { IsMobile } from '$lib/hooks/is-mobile.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockMovementsStore } from '$lib/stores/stockMovements.svelte'
	import type { InventoryItem } from '$lib/types/inventory'
	import type { MovementType, MovementsQuery, StockMovement } from '$lib/types/stockMovements'
	import { formatDate, formatDateTime, formatDayMonth, formatTime } from '$lib/utils/date'
	import { expiryNote } from '$lib/utils/expiry'
	import Quantity from '$lib/components/app/Quantity.svelte'
	import { cn } from '$lib/utils'
	import { capsClass } from '$lib/utils/text'

	const SEARCH_DEBOUNCE_MS = 300
	const PAGE_SIZE = 25
	const timeZone = getLocalTimeZone()

	// ---------- Toolbar state ----------
	type TypeFilter = MovementType | 'all'
	type SortKey = 'created_at'

	const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'stock_in', label: 'Stock In' },
		{ value: 'stock_out', label: 'Stock Out' },
	]

	let searchQuery = $state('')
	let searchInput = $state<HTMLInputElement | null>(null)
	let typeFilter = $state<TypeFilter>('all')
	let sort = $state<SortState<SortKey>>({ key: 'created_at', direction: 'desc' })

	/** Filters that apply once the popover's Apply is pressed */
	interface AppliedFilters {
		startDate: string
		endDate: string
		quantityMin: number | null
		quantityMax: number | null
		remark: string
		itemId: InventoryItem['id'] | null
	}
	let applied = $state<AppliedFilters>({
		startDate: '',
		endDate: '',
		quantityMin: null,
		quantityMax: null,
		remark: '',
		itemId: null,
	})

	useErrorToast(() => stockMovementsStore.error)

	// Typing in the search box must not hit the server on every keystroke
	let debouncedSearch = $state('')
	$effect(() => {
		const next = searchQuery.trim()
		const timer = setTimeout(() => (debouncedSearch = next), SEARCH_DEBOUNCE_MS)
		return () => clearTimeout(timer)
	})

	// Any change to the filters or sort re-queries from the first page. The
	// store call is untracked: it touches its own loading state, which must
	// not become a dependency of this effect or it would re-run itself.
	$effect(() => {
		const query: MovementsQuery = {
			pageSize: PAGE_SIZE,
			sortDirection: sort.direction,
			filters: {
				itemName: debouncedSearch,
				itemId: applied.itemId,
				quantityMin: applied.quantityMin,
				quantityMax: applied.quantityMax,
				movementType: typeFilter === 'all' ? '' : typeFilter,
				startDate: applied.startDate,
				endDate: applied.endDate,
				remark: applied.remark,
			},
		}
		untrack(() => stockMovementsStore.setQuery(query))
	})

	// Search results come back by relevance, so the date sort only applies without one
	const canSort = $derived(debouncedSearch === '')

	const toggleSort = (): void => {
		sort = { key: 'created_at', direction: sort.direction === 'asc' ? 'desc' : 'asc' }
	}

	const hasDateRange = $derived(applied.startDate !== '' || applied.endDate !== '')
	const hasQuantity = $derived(applied.quantityMin !== null || applied.quantityMax !== null)
	const hasRemark = $derived(applied.remark !== '')
	const hasItem = $derived(applied.itemId !== null)
	const popoverFilterCount = $derived([hasQuantity, hasRemark, hasItem].filter(Boolean).length)
	const hasChips = $derived(hasDateRange || popoverFilterCount > 0)
	const isFiltered = $derived(searchQuery !== '' || typeFilter !== 'all' || hasChips)

	const clearFilters = (): void => {
		applied = {
			startDate: '',
			endDate: '',
			quantityMin: null,
			quantityMax: null,
			remark: '',
			itemId: null,
		}
	}

	const clearEverything = (): void => {
		searchQuery = ''
		typeFilter = 'all'
		clearFilters()
	}

	// ⌥⌘F focuses the search field
	const onKeydown = (event: KeyboardEvent): void => {
		if (event.metaKey && event.altKey && event.code === 'KeyF') {
			event.preventDefault()
			searchInput?.focus()
			searchInput?.select()
		}
	}

	// ---------- Date range popover ----------
	const isMobile = new IsMobile()
	let dateOpen = $state(false)
	let dateDraft = $state<DateRange>({ start: undefined, end: undefined })
	let calendarPlaceholder = $state<DateValue>(today(timeZone))

	const toCalendarDate = (iso: string): DateValue | undefined => (iso ? parseDate(iso) : undefined)
	const toIso = (date: DateValue | undefined): string => (date ? date.toString() : '')

	const DATE_PRESETS: Array<{ label: string; range: () => DateRange }> = [
		{ label: 'Today', range: () => ({ start: today(timeZone), end: today(timeZone) }) },
		{
			label: 'Last 7 Days',
			range: () => ({ start: today(timeZone).subtract({ days: 6 }), end: today(timeZone) }),
		},
		{
			label: 'Last 30 Days',
			range: () => ({ start: today(timeZone).subtract({ days: 29 }), end: today(timeZone) }),
		},
		{
			label: 'This Month',
			range: () => ({ start: today(timeZone).set({ day: 1 }), end: today(timeZone) }),
		},
		{ label: 'All Time', range: () => ({ start: undefined, end: undefined }) },
	]

	const sameRange = (a: DateRange, b: DateRange): boolean =>
		toIso(a.start) === toIso(b.start) && toIso(a.end) === toIso(b.end)

	const openDateRange = (open: boolean): void => {
		dateOpen = open
		if (!open) return
		dateDraft = { start: toCalendarDate(applied.startDate), end: toCalendarDate(applied.endDate) }
		// Two months side by side end on the month in view; one month starts there
		const anchor = dateDraft.start ?? today(timeZone)
		calendarPlaceholder =
			isMobile.current || dateDraft.start ? anchor : anchor.subtract({ months: 1 })
	}

	const applyDateRange = (): void => {
		const start = toIso(dateDraft.start)
		const end = toIso(dateDraft.end)
		// A range with only one end is that one day
		applied.startDate = start || end
		applied.endDate = end || start
		dateOpen = false
	}

	/** "17 – 23 Sep 2026", "28 Aug – 23 Sep 2026" or "28 Dec 2025 – 23 Sep 2026" */
	const formatDateRange = (start: string, end: string): string => {
		if (!start || !end || start === end) return formatDate(start || end)
		const from = new Date(`${start}T00:00:00`)
		const to = new Date(`${end}T00:00:00`)
		if (from.getFullYear() !== to.getFullYear()) return `${formatDate(start)} – ${formatDate(end)}`
		if (from.getMonth() !== to.getMonth()) return `${formatDayMonth(start)} – ${formatDate(end)}`
		return `${String(from.getDate()).padStart(2, '0')} – ${formatDate(end)}`
	}

	const dateLabel = $derived(
		hasDateRange ? formatDateRange(applied.startDate, applied.endDate) : 'Date Range',
	)

	// ---------- Filters popover ----------
	let filtersOpen = $state(false)
	let filterDraft = $state({
		quantityMin: '',
		quantityMax: '',
		remark: '',
		itemId: null as InventoryItem['id'] | null,
	})

	const openFilters = (open: boolean): void => {
		filtersOpen = open
		if (!open) return
		filterDraft = {
			quantityMin: applied.quantityMin === null ? '' : String(applied.quantityMin),
			quantityMax: applied.quantityMax === null ? '' : String(applied.quantityMax),
			remark: applied.remark,
			itemId: applied.itemId,
		}
	}

	const toQuantity = (value: string): number | null => {
		if (value.trim() === '') return null
		const number = Number(value)
		return Number.isFinite(number) && number >= 0 ? number : null
	}

	const applyFilters = (): void => {
		applied.quantityMin = toQuantity(filterDraft.quantityMin)
		applied.quantityMax = toQuantity(filterDraft.quantityMax)
		applied.remark = filterDraft.remark.trim()
		applied.itemId = filterDraft.itemId
		filtersOpen = false
	}

	const clearFilterDraft = (): void => {
		filterDraft = { quantityMin: '', quantityMax: '', remark: '', itemId: null }
	}

	const quantityLabel = $derived.by((): string => {
		const { quantityMin: min, quantityMax: max } = applied
		if (min !== null && max !== null) return `Quantity ${min} – ${max}`
		if (min !== null) return `Quantity ≥ ${min}`
		return `Quantity ≤ ${max}`
	})

	// Item picker inside the filters popover
	const itemOptions = $derived(
		[...inventoryStore.items].sort((a, b) =>
			a.item_name.toLowerCase().localeCompare(b.item_name.toLowerCase()),
		),
	)

	const itemName = (itemId: InventoryItem['id'] | null): string =>
		itemId === null ? '' : (inventoryStore.getItemById(itemId)?.item_name ?? 'Deleted item')

	// ---------- Rows ----------
	const plural = (count: number, noun: string): string =>
		`${count} ${count === 1 ? noun : `${noun}s`}`

	/** "+20 boxes" or "−40 caps"; the unit is blank once the item is deleted */
	const changeLabel = (movement: StockMovement): string => {
		const sign = movement.movement_type === 'stock_in' ? '+' : '−'
		return `${sign}${movement.quantity}${movement.unit ? ` ${movement.unit}` : ''}`
	}

	const movements = $derived(stockMovementsStore.movements)
	const initialLoading = $derived(stockMovementsStore.loading && movements.length === 0)
	const loadingMore = $derived(stockMovementsStore.loading && movements.length > 0)

	// ---------- Edit remark ----------
	let showRemarkDialog = $state(false)
	let remarkMovement = $state<StockMovement | null>(null)
	let remark = $state('')

	const isRemarkChanged = $derived(
		remarkMovement !== null && remark.trim() !== (remarkMovement.remark || '').trim(),
	)

	const openRemark = (movement: StockMovement): void => {
		remarkMovement = movement
		remark = movement.remark || ''
		showRemarkDialog = true
	}

	const closeRemark = (): void => {
		showRemarkDialog = false
		remarkMovement = null
	}

	const confirmRemark = async (): Promise<void> => {
		if (!remarkMovement || !isRemarkChanged) return
		const movement = remarkMovement
		await stockMovementsStore.updateRemark(movement.id, remark.trim())
		if (!stockMovementsStore.error) {
			toast.success(`Saved the remark of ${movement.item_name}`)
			closeRemark()
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<PageHeader title="Stock Movements">
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
			value={typeFilter}
			onValueChange={(value) => (typeFilter = (value || 'all') as TypeFilter)}
			aria-label="Filter by movement type"
		>
			{#each TYPE_FILTERS as option (option.value)}
				<ToggleGroup.Item value={option.value}>{option.label}</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>

		<!-- Date range -->
		<Popover.Root open={dateOpen} onOpenChange={openDateRange}>
			<Popover.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="outline">
						<CalendarIcon data-icon="inline-start" />
						{dateLabel}
					</Button>
				{/snippet}
			</Popover.Trigger>
			<Popover.Content align="start" class="w-auto p-3">
				<div class="flex flex-wrap gap-1">
					{#each DATE_PRESETS as preset (preset.label)}
						{@const range = preset.range()}
						<Button
							variant={sameRange(dateDraft, range) ? 'secondary' : 'ghost'}
							size="xs"
							onclick={() => (dateDraft = range)}
						>
							{preset.label}
						</Button>
					{/each}
				</div>
				<RangeCalendar
					bind:value={dateDraft}
					bind:placeholder={calendarPlaceholder}
					numberOfMonths={isMobile.current ? 1 : 2}
					maxValue={today(timeZone)}
					class="p-0"
				/>
				<div class="flex items-center justify-between gap-2">
					<Button
						variant="ghost"
						size="sm"
						onclick={() => (dateDraft = { start: undefined, end: undefined })}
					>
						Clear
					</Button>
					<Button size="sm" onclick={applyDateRange}>Apply</Button>
				</div>
			</Popover.Content>
		</Popover.Root>

		<!-- Filters -->
		<Popover.Root open={filtersOpen} onOpenChange={openFilters}>
			<Popover.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="outline">
						<SlidersHorizontalIcon data-icon="inline-start" />
						Filters
						{#if popoverFilterCount > 0}
							<Badge class="h-[18px] min-w-[18px] px-1.5">{popoverFilterCount}</Badge>
						{/if}
					</Button>
				{/snippet}
			</Popover.Trigger>
			<Popover.Content align="start" class="w-80 p-4">
				<form
					onsubmit={(event) => {
						event.preventDefault()
						applyFilters()
					}}
				>
					<Field.Group class="gap-4">
						<Field.Field>
							<Field.Label for="filter-quantity-min">Quantity</Field.Label>
							<div class="flex gap-2">
								<Input
									id="filter-quantity-min"
									bind:value={filterDraft.quantityMin}
									type="number"
									min="0"
									placeholder="Min"
									aria-label="Minimum quantity"
								/>
								<Input
									bind:value={filterDraft.quantityMax}
									type="number"
									min="0"
									placeholder="Max"
									aria-label="Maximum quantity"
								/>
							</div>
						</Field.Field>
						<Field.Field>
							<Field.Label for="filter-remark">Remark contains</Field.Label>
							<Input
								id="filter-remark"
								bind:value={filterDraft.remark}
								placeholder="e.g. expired"
							/>
						</Field.Field>
						<Field.Field>
							<Field.Label for="filter-item">Item</Field.Label>
							<ItemPicker
								id="filter-item"
								bind:value={filterDraft.itemId}
								items={itemOptions}
								placeholder="Any item"
							/>
						</Field.Field>
					</Field.Group>
					<div class="mt-4 flex items-center justify-between gap-2">
						<Button type="button" variant="ghost" size="sm" onclick={clearFilterDraft}>Clear</Button
						>
						<Button type="submit" size="sm">Apply</Button>
					</div>
				</form>
			</Popover.Content>
		</Popover.Root>
	</div>
</PageHeader>

{#if hasChips}
	<div class="flex flex-wrap items-center gap-1.5">
		{#if hasDateRange}
			{@render chip(dateLabel, 'Remove date range', () => {
				applied.startDate = ''
				applied.endDate = ''
			})}
		{/if}
		{#if hasQuantity}
			{@render chip(quantityLabel, 'Remove quantity filter', () => {
				applied.quantityMin = null
				applied.quantityMax = null
			})}
		{/if}
		{#if hasRemark}
			{@render chip(`Remark contains “${applied.remark}”`, 'Remove remark filter', () => {
				applied.remark = ''
			})}
		{/if}
		{#if hasItem}
			{@render chip(`Item: ${itemName(applied.itemId)}`, 'Remove item filter', () => {
				applied.itemId = null
			})}
		{/if}
		<Button variant="ghost" size="xs" onclick={clearFilters}>Clear Filters</Button>
	</div>
{/if}

{#snippet chip(label: string, removeLabel: string, onremove: () => void)}
	<Badge variant="secondary" class="pe-1">
		{label}
		<button
			type="button"
			class="hover:bg-foreground/10 rounded-full p-0.5 transition-colors"
			aria-label={removeLabel}
			onclick={onremove}
		>
			<XIcon class="size-3" />
		</button>
	</Badge>
{/snippet}

{#if initialLoading}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Date</Table.Head>
				<Table.Head>Item</Table.Head>
				<Table.Head class="text-end">Change</Table.Head>
				<Table.Head>Batch expiry</Table.Head>
				<Table.Head>Remark</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each { length: 8 } as _, i (i)}
				<Table.Row>
					<Table.Cell><Skeleton class="h-4 w-32" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-44" /></Table.Cell>
					<Table.Cell><Skeleton class="ms-auto h-4 w-16" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-24" /></Table.Cell>
					<Table.Cell><Skeleton class="h-4 w-48" /></Table.Cell>
					<Table.Cell><Skeleton class="ms-auto size-7" /></Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{:else if movements.length === 0}
	<Empty.Root class="my-auto">
		<Empty.Header>
			<Empty.Media variant="icon">
				<HistoryIcon />
			</Empty.Media>
			<Empty.Title>{isFiltered ? 'No movements match' : 'No movements yet'}</Empty.Title>
			<Empty.Description>
				{isFiltered
					? 'Try another search or clear the filters.'
					: 'Every Stock In and Stock Out from Inventory is recorded here.'}
			</Empty.Description>
		</Empty.Header>
		<Empty.Content>
			{#if isFiltered}
				<Button variant="outline" onclick={clearEverything}>Clear Filters</Button>
			{:else}
				<Button variant="outline" href="/inventory">Go to Inventory</Button>
			{/if}
		</Empty.Content>
	</Empty.Root>
{:else}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				{#if canSort}
					<SortHeader key="created_at" {sort} onsort={toggleSort}>Date</SortHeader>
				{:else}
					<Table.Head title="Search results are ordered by relevance">Date</Table.Head>
				{/if}
				<Table.Head>Item</Table.Head>
				<Table.Head class="text-end">Change</Table.Head>
				<Table.Head>Batch expiry</Table.Head>
				<Table.Head class="w-[32%]">Remark</Table.Head>
				<Table.Head><span class="sr-only">Actions</span></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each movements as movement (movement.id)}
				{@const note = expiryNote(movement.expiry_date)}
				{@const isIn = movement.movement_type === 'stock_in'}
				<Table.Row>
					<Table.Cell class="tabular-nums">
						{formatDate(movement.created_at)}
						<span class="text-muted-foreground ms-1 text-xs">{formatTime(movement.created_at)}</span
						>
					</Table.Cell>
					<Table.Cell class={cn('font-medium', capsClass(movement.item_name))}
						>{movement.item_name}</Table.Cell
					>
					<Table.Cell class="text-end">
						<Quantity
							value={`${isIn ? '+' : '−'}${movement.quantity}`}
							unit={movement.unit}
							valueClass={cn('font-semibold', isIn ? 'text-success' : 'text-destructive')}
						/>
					</Table.Cell>
					<Table.Cell class="tabular-nums">
						{#if movement.expiry_date}
							{formatDate(movement.expiry_date)}
							{#if note}
								<span
									class={cn(
										'ms-1 text-xs',
										note.tone === 'danger' ? 'text-destructive' : 'text-warning',
									)}
								>
									{note.text}
								</span>
							{/if}
						{:else}
							<span class="text-muted-foreground">—</span>
						{/if}
					</Table.Cell>
					<!-- One line: the full remark is the title and opens in Edit Remark. -->
					<Table.Cell class="max-w-0">
						{#if movement.remark}
							<div class="text-foreground/80 truncate" title={movement.remark}>
								{movement.remark}
							</div>
						{:else}
							<span class="text-muted-foreground">No remark</span>
						{/if}
					</Table.Cell>
					<Table.Cell>
						<div class="flex justify-end">
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant="ghost"
											size="icon-sm"
											aria-label="Edit Remark…"
											onclick={() => openRemark(movement)}
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
		<span>
			{#if stockMovementsStore.countIsExact}
				Showing {movements.length} of {plural(stockMovementsStore.totalCount, 'movement')}
			{:else}
				Showing {plural(movements.length, 'movement')}
			{/if}
		</span>
		{#if stockMovementsStore.hasMore}
			<Button
				variant="outline"
				size="sm"
				disabled={loadingMore}
				onclick={stockMovementsStore.loadMore}
			>
				{#if loadingMore}
					<Spinner data-icon="inline-start" />
				{/if}
				Load More
			</Button>
		{/if}
	</div>
{/if}

<!-- Edit Remark -->
<ActionModal
	bind:open={showRemarkDialog}
	title="Edit Remark"
	loading={stockMovementsStore.loading}
	disabled={!isRemarkChanged}
	dirty={isRemarkChanged}
	confirmText="Save"
	onconfirm={confirmRemark}
	oncancel={closeRemark}
>
	{#if remarkMovement}
		<DialogSubject
			name={remarkMovement.item_name}
			facts={[
				{ label: 'Movement', value: changeLabel(remarkMovement) },
				{ label: 'When', value: formatDateTime(remarkMovement.created_at) },
			]}
		/>
	{/if}
	<Field.Group>
		<Field.Field>
			<Field.Label for="movement-remark">Remark</Field.Label>
			<Textarea
				id="movement-remark"
				bind:value={remark}
				rows={3}
				placeholder="e.g. Expired batch disposed"
				{@attach caretAtEnd()}
			/>
		</Field.Field>
	</Field.Group>
</ActionModal>

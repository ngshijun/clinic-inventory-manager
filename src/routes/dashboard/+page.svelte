<script lang="ts">
	import type { Component } from 'svelte'
	import { replaceState } from '$app/navigation'
	import { page } from '$app/state'
	import ArchiveIcon from '@lucide/svelte/icons/archive'
	import BoxIcon from '@lucide/svelte/icons/box'
	import CalendarIcon from '@lucide/svelte/icons/calendar'
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
	import ClockIcon from '@lucide/svelte/icons/clock'
	import PackageIcon from '@lucide/svelte/icons/package'
	import MarkOrderedDialog from '$lib/components/app/MarkOrderedDialog.svelte'
	import OrderStatusMenu from '$lib/components/app/OrderStatusMenu.svelte'
	import PageHeader from '$lib/components/app/PageHeader.svelte'
	import ReasonBadge from '$lib/components/app/ReasonBadge.svelte'
	import StockOutDialog from '$lib/components/app/StockOutDialog.svelte'
	import StatusDot from '$lib/components/app/StatusDot.svelte'
	import ToneBadge from '$lib/components/app/ToneBadge.svelte'
	import { Button } from '$lib/components/ui/button'
	import * as Card from '$lib/components/ui/card'
	import * as Empty from '$lib/components/ui/empty'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import * as Table from '$lib/components/ui/table'
	import * as Tabs from '$lib/components/ui/tabs'
	import { useErrorToast } from '$lib/composables/errorToast.svelte'
	import { createLoadMore } from '$lib/composables/loadMore.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockBatchesStore } from '$lib/stores/stockBatches.svelte'
	import type { InventoryItem } from '$lib/types/inventory'
	import { EXPIRY_WARNING_DAYS, daysUntilExpiry, type StockBatch } from '$lib/types/stockBatches'
	import { daysSince, formatDate, formatDayMonth, formatDuration } from '$lib/utils/date'
	import { expiryNote } from '$lib/utils/expiry'
	import { withUnit } from '$lib/utils/requests'
	import { cn } from '$lib/utils'
	import { capsClass } from '$lib/utils/text'

	const STALE_DAYS = 30
	const QUEUE_PAGE = 8

	useErrorToast(() => inventoryStore.error)
	useErrorToast(() => stockBatchesStore.error)

	const items = $derived(inventoryStore.items)
	const initialLoading = $derived(inventoryStore.loading && items.length === 0)

	const plural = (count: number, noun: string, many = `${noun}s`): string =>
		`${count} ${count === 1 ? noun : many}`

	// ---------- Headline strip ----------
	const tracked = $derived(items.filter((item) => !item.not_track))
	const untrackedCount = $derived(items.length - tracked.length)
	const outOfStock = $derived(inventoryStore.outOfStockItems)
	const lowStock = $derived(inventoryStore.lowStockItems)
	const outOnOrder = $derived(outOfStock.filter((item) => !!item.order_date).length)

	// ---------- Expiring batches ----------
	interface ExpiringRow {
		batch: StockBatch
		item: InventoryItem
		daysLeft: number
	}

	const expiring = $derived.by((): ExpiringRow[] => {
		const rows: ExpiringRow[] = []
		for (const batch of stockBatchesStore.batches) {
			if (!batch.expiry_date || batch.quantity <= 0) continue
			const daysLeft = daysUntilExpiry(batch.expiry_date)
			if (daysLeft > EXPIRY_WARNING_DAYS) continue
			const item = inventoryStore.getItemById(batch.item_id)
			if (!item || item.not_track) continue
			rows.push({ batch, item, daysLeft })
		}
		return rows.sort(
			(a, b) => a.daysLeft - b.daysLeft || a.item.item_name.localeCompare(b.item.item_name),
		)
	})
	const expiredCount = $derived(expiring.filter((row) => row.daysLeft < 0).length)
	const expiringList = createLoadMore(() => expiring, QUEUE_PAGE)

	// ---------- Needs reordering ----------
	const byName = (a: InventoryItem, b: InventoryItem): number =>
		a.item_name.toLowerCase().localeCompare(b.item_name.toLowerCase())
	const reorder = $derived([...outOfStock].sort(byName).concat([...lowStock].sort(byName)))
	const reorderList = createLoadMore(() => reorder, QUEUE_PAGE)

	// ---------- Stale items ----------
	const stale = $derived(
		tracked
			.filter((item) => item.quantity > 0 && daysSince(item.updated_at) > STALE_DAYS)
			.sort((a, b) => a.updated_at - b.updated_at),
	)
	const staleList = createLoadMore(() => stale, QUEUE_PAGE)

	// ---------- Which queue is open ----------
	type Queue = 'expiring' | 'reorder' | 'stale'
	const isQueue = (value: string | null): value is Queue =>
		value === 'expiring' || value === 'reorder' || value === 'stale'

	// The open queue lives in the URL, so a reload or a shared link restores it
	const initialQueue = page.url.searchParams.get('queue')
	let queue = $state<Queue>(isQueue(initialQueue) ? initialQueue : 'expiring')

	$effect(() => {
		const url = new URL(page.url)
		if (queue !== 'expiring') url.searchParams.set('queue', queue)
		else url.searchParams.delete('queue')
		if (url.search !== page.url.search) replaceState(url, {})
	})

	// ---------- Dialogs ----------
	let orderDialog = $state<MarkOrderedDialog | null>(null)
	let stockOutDialog = $state<StockOutDialog | null>(null)
</script>

<PageHeader title="Dashboard" />

{#if initialLoading}
	<Card.Root size="sm" class="gap-0 rounded-2xl py-0" aria-busy="true">
		<div class="grid grid-cols-2 lg:grid-cols-5">
			{#each { length: 5 } as _, i (i)}
				<div
					class="border-border flex flex-col gap-2 px-4 py-3.5 last:col-span-2 even:border-s lg:last:col-span-1 lg:[&:not(:first-child)]:border-s [&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0"
				>
					<Skeleton class="h-3.5 w-24" />
					<Skeleton class="h-6 w-12" />
					<Skeleton class="h-3 w-28" />
				</div>
			{/each}
		</div>
	</Card.Root>
	<Skeleton class="h-9 w-full rounded-full sm:w-[28rem]" />
	<Skeleton class="h-40 rounded-md" />
{:else}
	<!-- Headline strip: one box, five segments, each a link into what it counts -->
	<Card.Root size="sm" class="gap-0 rounded-2xl py-0">
		<div class="grid grid-cols-2 lg:grid-cols-5">
			{@render stat(
				PackageIcon,
				'Tracked items',
				tracked.length,
				`${untrackedCount} not tracked`,
				null,
				'/inventory',
			)}
			{@render stat(
				BoxIcon,
				'Out of stock',
				outOfStock.length,
				`${outOnOrder} on order`,
				outOfStock.length > 0 ? 'danger' : null,
				'reorder',
			)}
			{@render stat(
				BoxIcon,
				'Low stock',
				lowStock.length,
				'At or below reorder level',
				lowStock.length > 0 ? 'warning' : null,
				'reorder',
			)}
			{@render stat(
				ClockIcon,
				'Expiring soon',
				expiring.length,
				`${expiredCount} already expired`,
				expiring.length > 0 ? 'warning' : null,
				'expiring',
			)}
			{@render stat(
				ArchiveIcon,
				'Stale items',
				stale.length,
				`No movement in ${STALE_DAYS} days`,
				null,
				'stale',
			)}
		</div>
	</Card.Root>

	<!-- One worklist at a time; the tabs keep every count in view -->
	<Tabs.Root
		value={queue}
		onValueChange={(value) => {
			if (isQueue(value)) queue = value
		}}
		class="flex-1 gap-3"
	>
		<div class="flex flex-wrap items-center justify-between gap-2">
			<Tabs.List class="grid w-full grid-cols-3 sm:w-fit">
				{@render tab('expiring', ClockIcon, 'Expiring Batches', expiring.length, 'warning')}
				{@render tab('reorder', BoxIcon, 'Needs Reordering', reorder.length, 'danger')}
				{@render tab('stale', ArchiveIcon, 'Stale Items', stale.length, null)}
			</Tabs.List>
			<!-- The page that owns the open queue; Stale has none -->
			{#if queue !== 'stale'}
				<Button
					variant="ghost"
					size="sm"
					href={queue === 'expiring' ? '/inventory' : '/price-list'}
					class="-me-2"
				>
					{queue === 'expiring' ? 'Open Inventory' : 'Open Price List'}
					<ChevronRightIcon data-icon="inline-end" />
				</Button>
			{/if}
		</div>

		<!-- Expiring batches -->
		<Tabs.Content value="expiring" class="flex flex-col gap-3">
			{#if expiring.length === 0}
				{@render emptyPane(
					ClockIcon,
					'Nothing expiring',
					`No batch with stock expires in the next ${EXPIRY_WARNING_DAYS} days.`,
				)}
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Item</Table.Head>
							<Table.Head>Batch</Table.Head>
							<Table.Head>Expires</Table.Head>
							<Table.Head class="text-end">Quantity</Table.Head>
							<Table.Head><span class="sr-only">Actions</span></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each expiringList.visible as { batch, item, daysLeft } (batch.id)}
							{@const note = expiryNote(batch.expiry_date)}
							<Table.Row>
								<Table.Cell class={cn('font-medium', capsClass(item.item_name))}
									>{item.item_name}</Table.Cell
								>
								<Table.Cell class="text-muted-foreground tabular-nums">
									Received {formatDate(batch._creationTime)}
								</Table.Cell>
								<Table.Cell class="tabular-nums">
									{formatDate(batch.expiry_date)}
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
								</Table.Cell>
								<Table.Cell class="text-end font-medium tabular-nums">
									{withUnit(batch.quantity, item.unit)}
								</Table.Cell>
								<Table.Cell>
									<div class="flex justify-end">
										<Button variant="outline" size="sm" onclick={() => stockOutDialog?.open(item)}>
											Stock Out…
										</Button>
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
				{@render footer(
					expiringList.shown,
					plural(expiringList.total, 'batch', 'batches'),
					expiringList,
				)}
			{/if}
		</Tabs.Content>

		<!-- Needs reordering -->
		<Tabs.Content value="reorder" class="flex flex-col gap-3">
			{#if reorder.length === 0}
				{@render emptyPane(
					BoxIcon,
					'Nothing to reorder',
					'Every tracked item is above its reorder level.',
				)}
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Item</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head>On hand</Table.Head>
							<Table.Head>Order status</Table.Head>
							<Table.Head><span class="sr-only">Actions</span></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each reorderList.visible as item (item.id)}
							{@const out = item.quantity === 0}
							<Table.Row>
								<Table.Cell class={cn('font-medium', capsClass(item.item_name))}
									>{item.item_name}</Table.Cell
								>
								<Table.Cell>
									<StatusDot tone={out ? 'danger' : 'warning'}>
										{out ? 'Out of stock' : 'Low stock'}
									</StatusDot>
								</Table.Cell>
								<Table.Cell>
									<span class={cn('tabular-nums', out && 'text-destructive')}>
										{item.quantity} of {item.reorder_level}
										{item.unit}
									</span>
								</Table.Cell>
								<Table.Cell>
									{#if item.order_date}
										<ToneBadge tone="info">
											{#if item.back_order}
												<ClockIcon />
												Back-ordered {formatDayMonth(item.order_date)}
											{:else}
												<CalendarIcon />
												Ordered {formatDayMonth(item.order_date)}
											{/if}
										</ToneBadge>
									{:else if item.non_order_reason}
										<ReasonBadge reason={item.non_order_reason} size="md" />
									{:else}
										<span class="text-muted-foreground">—</span>
									{/if}
								</Table.Cell>
								<Table.Cell>
									<div class="flex justify-end">
										<OrderStatusMenu
											{item}
											size="sm"
											onMarkOrdered={(target) => orderDialog?.open(target)}
										/>
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
				{@render footer(reorderList.shown, plural(reorderList.total, 'item'), reorderList)}
			{/if}
		</Tabs.Content>

		<!-- Stale items -->
		<Tabs.Content value="stale" class="flex flex-col gap-3">
			{#if stale.length === 0}
				{@render emptyPane(
					ArchiveIcon,
					'Nothing stale',
					`Every tracked item with stock has moved in the last ${STALE_DAYS} days.`,
				)}
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Item</Table.Head>
							<Table.Head>On hand</Table.Head>
							<Table.Head>Last movement</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each staleList.visible as item (item.id)}
							<Table.Row>
								<Table.Cell class={cn('font-medium', capsClass(item.item_name))}
									>{item.item_name}</Table.Cell
								>
								<Table.Cell class="tabular-nums">
									{withUnit(item.quantity, item.unit)}
								</Table.Cell>
								<Table.Cell class="tabular-nums">
									{formatDate(item.updated_at)}
									<span class="text-muted-foreground ms-1 text-xs">
										{formatDuration(daysSince(item.updated_at))} ago
									</span>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
				{@render footer(staleList.shown, plural(staleList.total, 'item'), staleList)}
			{/if}
		</Tabs.Content>
	</Tabs.Root>
{/if}

<!--
	A strip segment. `target` is either a page (href) or the queue to open.
	The glyph, number and label tint only while the count is above zero; a
	zero is a muted zero in its fixed place, never a message.
-->
{#snippet stat(
	Icon: Component<{ class?: string }>,
	label: string,
	value: number,
	sub: string,
	tone: 'warning' | 'danger' | null,
	target: Queue | `/${string}`,
)}
	{@const live = value > 0 ? tone : null}
	{@const cell =
		'border-border hover:bg-muted/50 focus-visible:bg-muted/50 flex min-w-0 flex-col gap-1.5 px-4 py-3.5 text-start outline-none [&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0 even:border-s lg:[&:not(:first-child)]:border-s last:col-span-2 lg:last:col-span-1'}
	{#snippet body()}
		<span class="text-muted-foreground flex items-center gap-2 text-xs font-medium">
			<span
				class={cn(
					'bg-muted text-foreground/70 flex size-5 shrink-0 items-center justify-center rounded-md',
					live === 'warning' && 'bg-warning-soft text-warning',
					live === 'danger' && 'bg-destructive/10 text-destructive',
				)}
			>
				<Icon class="size-3" />
			</span>
			<span
				class={cn(
					'truncate',
					live === 'warning' && 'text-warning',
					live === 'danger' && 'text-destructive',
				)}
			>
				{label}
			</span>
			<ChevronRightIcon class="ms-auto size-3.5 shrink-0" />
		</span>
		<span
			class={cn(
				'text-[26px] leading-none font-semibold tabular-nums',
				live === 'warning' && 'text-warning',
				live === 'danger' && 'text-destructive',
				value === 0 && 'text-muted-foreground',
			)}
		>
			{value}
		</span>
		<span class="text-muted-foreground truncate text-xs">{sub}</span>
	{/snippet}
	{#if isQueue(target)}
		<button type="button" class={cell} onclick={() => (queue = target)}>
			{@render body()}
		</button>
	{:else}
		<a href={target} class={cell}>
			{@render body()}
		</a>
	{/if}
{/snippet}

<!-- A queue tab: the same glyph as its strip segment, its label, and its count -->
{#snippet tab(
	value: Queue,
	Icon: Component<{ class?: string }>,
	label: string,
	count: number,
	tone: 'warning' | 'danger' | null,
)}
	<Tabs.Trigger {value} class="min-w-0">
		<Icon
			class={cn(
				'size-4',
				count > 0 && tone === 'warning' && 'text-warning',
				count > 0 && tone === 'danger' && 'text-destructive',
			)}
		/>
		<span class="truncate">{label}</span>
		<span
			class="bg-muted-foreground/15 text-foreground/80 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums"
		>
			{count}
		</span>
	</Tabs.Trigger>
{/snippet}

<!-- An empty queue, centred in the space the list would fill: glyph, title, one sentence -->
{#snippet emptyPane(Icon: Component<{ class?: string }>, title: string, description: string)}
	<Empty.Root class="my-auto">
		<Empty.Header>
			<Empty.Media variant="icon"><Icon /></Empty.Media>
			<Empty.Title>{title}</Empty.Title>
			<Empty.Description>{description}</Empty.Description>
		</Empty.Header>
	</Empty.Root>
{/snippet}

{#snippet footer(
	shown: number,
	total: string,
	list: { readonly hasMore: boolean; loadMore: () => void },
)}
	<div class="text-muted-foreground flex items-center justify-between gap-3 text-sm">
		<span>Showing {shown} of {total}</span>
		{#if list.hasMore}
			<Button variant="outline" onclick={list.loadMore}>Load More</Button>
		{/if}
	</div>
{/snippet}

<MarkOrderedDialog bind:this={orderDialog} />
<StockOutDialog bind:this={stockOutDialog} />

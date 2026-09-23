<script lang="ts">
	import CalendarIcon from '@lucide/svelte/icons/calendar'
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
	import ClockIcon from '@lucide/svelte/icons/clock'
	import MarkOrderedDialog from '$lib/components/app/MarkOrderedDialog.svelte'
	import OrderStatusMenu from '$lib/components/app/OrderStatusMenu.svelte'
	import PageHeader from '$lib/components/app/PageHeader.svelte'
	import ReasonBadge from '$lib/components/app/ReasonBadge.svelte'
	import StockOutDialog from '$lib/components/app/StockOutDialog.svelte'
	import StatusDot from '$lib/components/app/StatusDot.svelte'
	import ToneBadge from '$lib/components/app/ToneBadge.svelte'
	import { Button } from '$lib/components/ui/button'
	import * as Card from '$lib/components/ui/card'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import * as Table from '$lib/components/ui/table'
	import { useErrorToast } from '$lib/composables/errorToast.svelte'
	import { createLoadMore } from '$lib/composables/loadMore.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockBatchesStore } from '$lib/stores/stockBatches.svelte'
	import type { InventoryItem } from '$lib/types/inventory'
	import { EXPIRY_WARNING_DAYS, daysUntilExpiry, type StockBatch } from '$lib/types/stockBatches'
	import { daysSince, formatDate, formatDayMonth, formatDuration } from '$lib/utils/date'
	import { expiryBadge } from '$lib/utils/expiry'
	import { withUnit } from '$lib/utils/requests'
	import { cn } from '$lib/utils'

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

	// ---------- Dialogs ----------
	let orderDialog = $state<MarkOrderedDialog | null>(null)
	let stockOutDialog = $state<StockOutDialog | null>(null)
</script>

<PageHeader title="Dashboard" />

{#if initialLoading}
	<div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
		{#each { length: 5 } as _, i (i)}
			<Card.Root size="sm">
				<Card.Content class="flex flex-col gap-2">
					<Skeleton class="h-3 w-24" />
					<Skeleton class="h-7 w-12" />
					<Skeleton class="h-3 w-28" />
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
	<Skeleton class="h-40 rounded-md" />
{:else}
	<!-- Headline strip -->
	<div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
		{@render stat(
			'Tracked items',
			tracked.length,
			`${untrackedCount} not tracked`,
			null,
			'/inventory',
		)}
		{@render stat(
			'Out of stock',
			outOfStock.length,
			`${outOnOrder} on order`,
			outOfStock.length > 0 ? 'danger' : null,
			'/inventory?filter=out',
		)}
		{@render stat(
			'Low stock',
			lowStock.length,
			'At or below reorder level',
			lowStock.length > 0 ? 'warning' : null,
			'/inventory?filter=low',
		)}
		{@render stat(
			'Expiring soon',
			expiring.length,
			`${expiredCount} already expired`,
			expiring.length > 0 ? 'warning' : null,
			'#expiring',
		)}
		{@render stat('Stale items', stale.length, `No movement in ${STALE_DAYS} days`, null, '#stale')}
	</div>

	<!-- Expiring batches -->
	<section id="expiring" class="flex scroll-mt-20 flex-col gap-3">
		{@render heading(
			'Expiring batches',
			`next ${EXPIRY_WARNING_DAYS} days, soonest first`,
			'Open Inventory',
			'/inventory',
		)}
		{#if expiring.length === 0}
			<p class="text-muted-foreground text-sm">
				No batches expire in the next {EXPIRY_WARNING_DAYS} days.
			</p>
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
						{@const badge = expiryBadge(batch.expiry_date)}
						<Table.Row
							class={cn(
								daysLeft < 0
									? 'shadow-[inset_2px_0_0_var(--destructive)]'
									: 'shadow-[inset_2px_0_0_var(--warning)]',
							)}
						>
							<Table.Cell class="max-w-md min-w-48 py-2.5 whitespace-normal">
								<div class="font-medium break-words">{item.item_name}</div>
							</Table.Cell>
							<Table.Cell class="text-muted-foreground py-2.5 tabular-nums">
								Received {formatDate(batch._creationTime)}
							</Table.Cell>
							<Table.Cell class="py-2.5">
								{#if badge}
									<ToneBadge tone={badge.tone}>{badge.text}</ToneBadge>
								{/if}
								<div class="text-muted-foreground mt-1 text-xs tabular-nums">
									{formatDate(batch.expiry_date)}
								</div>
							</Table.Cell>
							<Table.Cell class="py-2.5 text-end font-medium tabular-nums">
								{withUnit(batch.quantity, item.unit)}
							</Table.Cell>
							<Table.Cell class="py-2.5">
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
	</section>

	<!-- Needs reordering -->
	<section class="flex flex-col gap-3">
		{@render heading(
			'Needs reordering',
			'out of stock first, then low',
			'Open Price List',
			'/price-list',
		)}
		{#if reorder.length === 0}
			<p class="text-muted-foreground text-sm">Every tracked item is above its reorder level.</p>
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
							<Table.Cell class="max-w-md min-w-48 py-2.5 whitespace-normal">
								<div class="font-medium break-words">{item.item_name}</div>
							</Table.Cell>
							<Table.Cell class="py-2.5">
								<StatusDot tone={out ? 'danger' : 'warning'}>
									{out ? 'Out of stock' : 'Low stock'}
								</StatusDot>
							</Table.Cell>
							<Table.Cell class="py-2.5">
								<span class={cn('tabular-nums', out && 'text-destructive')}>
									{item.quantity} of {item.reorder_level}
									{item.unit}
								</span>
							</Table.Cell>
							<Table.Cell class="py-2.5">
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
							<Table.Cell class="py-2.5">
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
	</section>

	<!-- Stale items -->
	<section id="stale" class="flex scroll-mt-20 flex-col gap-3">
		{@render heading('Stale items', 'no movement for over a month, oldest first', null, null)}
		{#if stale.length === 0}
			<p class="text-muted-foreground text-sm">
				Every tracked item with stock has moved in the last {STALE_DAYS} days.
			</p>
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
							<Table.Cell class="max-w-md min-w-48 py-2.5 whitespace-normal">
								<div class="font-medium break-words">{item.item_name}</div>
							</Table.Cell>
							<Table.Cell class="py-2.5 tabular-nums"
								>{withUnit(item.quantity, item.unit)}</Table.Cell
							>
							<Table.Cell class="py-2.5 tabular-nums">
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
	</section>
{/if}

{#snippet stat(
	label: string,
	value: number,
	sub: string,
	tone: 'warning' | 'danger' | null,
	href: string,
)}
	<Card.Root
		size="sm"
		class={cn(
			'hover:ring-border-strong transition-shadow',
			tone === 'warning' && 'bg-warning-soft ring-warning/30',
			tone === 'danger' && 'bg-destructive/10 ring-destructive/30',
		)}
	>
		<a
			{href}
			class="flex flex-col gap-0.5 px-(--card-spacing) outline-none focus-visible:underline"
		>
			<span
				class="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium tracking-wide uppercase"
			>
				{label}
				<ChevronRightIcon class="size-3.5" />
			</span>
			<span
				class={cn(
					'text-2xl font-semibold tabular-nums',
					tone === 'warning' && 'text-warning',
					tone === 'danger' && 'text-destructive',
					tone === null && value === 0 && 'text-muted-foreground',
				)}
			>
				{value}
			</span>
			<span class="text-muted-foreground text-xs">{sub}</span>
		</a>
	</Card.Root>
{/snippet}

{#snippet heading(title: string, sub: string, linkLabel: string | null, href: string | null)}
	<div class="border-border-strong flex items-baseline justify-between gap-3 border-b-2 pb-2">
		<h2 class="text-[15px] font-bold">
			{title}
			<span class="text-muted-foreground ms-1.5 text-[13px] font-medium">{sub}</span>
		</h2>
		{#if linkLabel && href}
			<Button variant="ghost" size="sm" {href} class="-me-2">
				{linkLabel}
				<ChevronRightIcon data-icon="inline-end" />
			</Button>
		{/if}
	</div>
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

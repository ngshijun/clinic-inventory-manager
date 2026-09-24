<script lang="ts">
	import type { Component } from 'svelte'
	import { replaceState } from '$app/navigation'
	import { page } from '$app/state'
	import AlarmClockIcon from '@lucide/svelte/icons/alarm-clock'
	import ArchiveIcon from '@lucide/svelte/icons/archive'
	import BoxIcon from '@lucide/svelte/icons/box'
	import PackageIcon from '@lucide/svelte/icons/package'
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check'
	import ClockIcon from '@lucide/svelte/icons/clock'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import TruckIcon from '@lucide/svelte/icons/truck'
	import MarkOrderedDialog from '$lib/components/app/MarkOrderedDialog.svelte'
	import OrderControls from '$lib/components/app/OrderControls.svelte'
	import PageHeader from '$lib/components/app/PageHeader.svelte'
	import Quantity from '$lib/components/app/Quantity.svelte'
	import SnoozeDialog from '$lib/components/app/SnoozeDialog.svelte'
	import StatusDot from '$lib/components/app/StatusDot.svelte'
	import StopTrackingDialog from '$lib/components/app/StopTrackingDialog.svelte'
	import ToneBadge from '$lib/components/app/ToneBadge.svelte'
	import { Button } from '$lib/components/ui/button'
	import * as Card from '$lib/components/ui/card'
	import { Checkbox } from '$lib/components/ui/checkbox'
	import * as Empty from '$lib/components/ui/empty'
	import { Label } from '$lib/components/ui/label'
	import { Skeleton } from '$lib/components/ui/skeleton'
	import * as Table from '$lib/components/ui/table'
	import * as Tabs from '$lib/components/ui/tabs'
	import { useErrorToast } from '$lib/composables/errorToast.svelte'
	import { createLoadMore } from '$lib/composables/loadMore.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockBatchesStore } from '$lib/stores/stockBatches.svelte'
	import type { InventoryItem, OrderedStatus, SnoozedStatus } from '$lib/types/inventory'
	import {
		EXPIRY_WARNING_DAYS,
		daysUntilExpiry,
		todayIsoDate,
		type StockBatch,
	} from '$lib/types/stockBatches'
	import { daysSince, formatDate, formatDuration } from '$lib/utils/date'
	import { expiryNote } from '$lib/utils/expiry'
	import {
		daysBetween,
		isLate,
		isSnoozing,
		needsDecision,
		needsStock,
		wokeFromSnooze,
	} from '$lib/utils/orders'
	import { cn } from '$lib/utils'
	import { capsClass } from '$lib/utils/text'

	const NOT_MOVING_DAYS = 30
	const QUEUE_PAGE = 8

	useErrorToast(() => inventoryStore.error)
	useErrorToast(() => stockBatchesStore.error)

	const items = $derived(inventoryStore.items)
	const initialLoading = $derived(inventoryStore.loading && items.length === 0)
	const today = $derived(todayIsoDate())

	const plural = (count: number, noun: string, many = `${noun}s`): string =>
		`${count} ${count === 1 ? noun : many}`
	const byName = (a: InventoryItem, b: InventoryItem): number =>
		a.item_name.toLowerCase().localeCompare(b.item_name.toLowerCase())

	// ---------- To order: the purchaser's inbox ----------
	const toOrder = $derived(
		items
			.filter((item) => needsDecision(item, today))
			.sort((a, b) => Number(b.quantity === 0) - Number(a.quantity === 0) || byName(a, b)),
	)
	const toOrderOut = $derived(toOrder.filter((item) => item.quantity === 0).length)
	const snoozed = $derived(
		items
			.filter((item) => needsStock(item) && isSnoozing(item, today))
			.sort((a, b) =>
				(a.order_status as SnoozedStatus).until.localeCompare(
					(b.order_status as SnoozedStatus).until,
				),
			),
	)
	// Snoozed rows go first when shown: the person asked to see them, and the
	// inbox behind them can run to a hundred rows
	let showSnoozed = $state(false)
	const toOrderRows = $derived(showSnoozed ? snoozed.concat(toOrder) : toOrder)
	const toOrderList = createLoadMore(() => toOrderRows, QUEUE_PAGE)

	// ---------- Waiting for delivery ----------
	interface WaitingRow {
		item: InventoryItem
		status: OrderedStatus
		late: boolean
	}
	const waiting = $derived.by((): WaitingRow[] => {
		const rows: WaitingRow[] = []
		for (const item of items) {
			if (item.order_status?.kind !== 'ordered') continue
			const status = item.order_status
			rows.push({ item, status, late: isLate(status, today) })
		}
		return rows.sort(
			(a, b) =>
				Number(b.late) - Number(a.late) ||
				a.status.ordered_on.localeCompare(b.status.ordered_on) ||
				byName(a.item, b.item),
		)
	})
	const lateCount = $derived(waiting.filter((row) => row.late).length)
	const waitingList = createLoadMore(() => waiting, QUEUE_PAGE)

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

	// ---------- Not moving ----------
	const stale = $derived(
		items
			.filter(
				(item) =>
					!item.not_track && item.quantity > 0 && daysSince(item.updated_at) > NOT_MOVING_DAYS,
			)
			.sort((a, b) => a.updated_at - b.updated_at),
	)
	const staleList = createLoadMore(() => stale, QUEUE_PAGE)

	// ---------- Which queue is open ----------
	type Queue = 'toorder' | 'waiting' | 'expiring' | 'notmoving'
	const isQueue = (value: string | null): value is Queue =>
		value === 'toorder' || value === 'waiting' || value === 'expiring' || value === 'notmoving'

	// The open queue lives in the URL, so a reload or a shared link restores it
	const initialQueue = page.url.searchParams.get('queue')
	let queue = $state<Queue>(isQueue(initialQueue) ? initialQueue : 'toorder')

	$effect(() => {
		const url = new URL(page.url)
		if (queue !== 'toorder') url.searchParams.set('queue', queue)
		else url.searchParams.delete('queue')
		if (url.search !== page.url.search) replaceState(url, {})
	})

	// ---------- Dialogs ----------
	let orderDialog = $state<MarkOrderedDialog | null>(null)
	let snoozeDialog = $state<SnoozeDialog | null>(null)
	let stopTrackingDialog = $state<StopTrackingDialog | null>(null)
</script>

<PageHeader title="Dashboard" />

{#if initialLoading}
	<Card.Root size="sm" class="gap-0 rounded-2xl py-0" aria-busy="true">
		<div class="grid grid-cols-2 lg:grid-cols-4">
			{#each { length: 4 } as _, i (i)}
				<div
					class="border-border flex flex-col gap-2 px-4 py-3.5 even:border-s lg:[&:not(:first-child)]:border-s [&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0"
				>
					<Skeleton class="h-3.5 w-24" />
					<Skeleton class="h-6 w-12" />
					<Skeleton class="h-3 w-28" />
				</div>
			{/each}
		</div>
	</Card.Root>
	<Skeleton class="h-40 rounded-md" />
{:else}
	<Tabs.Root
		value={queue}
		onValueChange={(value) => {
			if (isQueue(value)) queue = value
		}}
		class="flex-1 gap-3"
	>
		<!-- The headline strip is the tab list: each segment is the tab for its queue -->
		<Card.Root size="sm" class="gap-0 rounded-2xl py-0">
			<Tabs.List
				variant="line"
				class="text-foreground grid h-auto w-full grid-cols-2 gap-0 rounded-none p-0 group-data-horizontal/tabs:h-auto lg:grid-cols-4"
			>
				{@render queueTab(
					'toorder',
					BoxIcon,
					'To Order',
					toOrder.length,
					toOrder.length === 0
						? snoozed.length > 0
							? `${plural(snoozed.length, 'item')} snoozed`
							: 'Nothing waiting on you'
						: `${toOrderOut} out of stock`,
					'danger',
				)}
				{@render queueTab(
					'waiting',
					TruckIcon,
					'Waiting for Delivery',
					waiting.length,
					lateCount > 0 ? `${lateCount} late` : 'None late',
					lateCount > 0 ? 'warning' : 'info',
				)}
				{@render queueTab(
					'expiring',
					ClockIcon,
					'Expiring Batches',
					expiring.length,
					`${expiredCount} already expired`,
					'warning',
				)}
				{@render queueTab(
					'notmoving',
					ArchiveIcon,
					'Not Moving',
					stale.length,
					`No movement in ${NOT_MOVING_DAYS} days`,
					null,
				)}
			</Tabs.List>
		</Card.Root>

		{#if queue === 'toorder'}
			<div class="flex items-center justify-end gap-2">
				<Checkbox id="show-snoozed" bind:checked={showSnoozed} />
				<Label for="show-snoozed" class="font-normal">Show snoozed ({snoozed.length})</Label>
			</div>
		{:else if queue === 'expiring'}
			<div class="flex justify-end">
				<Button variant="ghost" size="sm" href="/inventory" class="-me-2">
					Open Inventory
					<ChevronRightIcon data-icon="inline-end" />
				</Button>
			</div>
		{/if}

		<!-- To order -->
		<Tabs.Content value="toorder" class="flex flex-col gap-3">
			{#if toOrderRows.length === 0}
				{@render emptyPane(
					CircleCheckIcon,
					'Nothing to order',
					snoozed.length > 0
						? `Every low item is on order or snoozed. ${plural(snoozed.length, 'item')} will come back when its snooze ends.`
						: 'Every tracked item is above its reorder level or already on order.',
				)}
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Item</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head>In stock</Table.Head>
							<Table.Head>Note</Table.Head>
							<Table.Head><span class="sr-only">Actions</span></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each toOrderList.visible as item (item.id)}
							{@const out = item.quantity === 0}
							{@const snoozing = isSnoozing(item, today)}
							<Table.Row class={cn(snoozing && 'text-muted-foreground')}>
								<Table.Cell class={cn('font-medium', capsClass(item.item_name))}
									>{item.item_name}</Table.Cell
								>
								<Table.Cell>
									<StatusDot tone={out ? 'danger' : 'warning'}>
										{out ? 'Out of stock' : 'Low stock'}
									</StatusDot>
								</Table.Cell>
								<Table.Cell>
									<Quantity
										value={item.quantity}
										unit={item.unit}
										valueClass={cn(!snoozing && out && 'text-destructive')}
									/>
									<span class="text-muted-foreground ms-1 text-xs"
										>reorder at {item.reorder_level}</span
									>
								</Table.Cell>
								<Table.Cell>
									{#if item.order_status?.kind === 'snoozed'}
										{#if wokeFromSnooze(item, today)}
											<ToneBadge tone="warning">
												<AlarmClockIcon />
												Snooze ended {formatDate(item.order_status.until)}
											</ToneBadge>
										{:else}
											<ToneBadge tone="neutral">
												<AlarmClockIcon />
												Snoozed until {formatDate(item.order_status.until)}
											</ToneBadge>
										{/if}
										<span class="text-muted-foreground ms-1 text-xs"
											>{item.order_status.reason}</span
										>
									{:else}
										<span class="text-muted-foreground">—</span>
									{/if}
								</Table.Cell>
								<Table.Cell>
									<div class="flex justify-end gap-1">
										<OrderControls
											{item}
											onMarkOrdered={(target) => orderDialog?.open(target)}
											onSnooze={(target) => snoozeDialog?.open(target)}
											onStopTracking={(target) => stopTrackingDialog?.open(target)}
										/>
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
				{@render footer(
					toOrderList.shown,
					showSnoozed && snoozed.length > 0
						? `${plural(toOrder.length, 'item')} to order and ${snoozed.length} snoozed`
						: plural(toOrderList.total, 'item'),
					toOrderList,
				)}
			{/if}
		</Tabs.Content>

		<!-- Waiting for delivery -->
		<Tabs.Content value="waiting" class="flex flex-col gap-3">
			{#if waiting.length === 0}
				{@render emptyPane(
					TruckIcon,
					'Nothing on order',
					'Items you mark as ordered wait here until the whole order has been stocked in.',
				)}
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Item</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head>Ordered</Table.Head>
							<Table.Head>Received</Table.Head>
							<Table.Head>Expected</Table.Head>
							<Table.Head>In stock</Table.Head>
							<Table.Head><span class="sr-only">Actions</span></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each waitingList.visible as { item, status, late } (item.id)}
							{@const since = daysBetween(status.ordered_on, today)}
							{@const toCome = status.quantity - status.received}
							<Table.Row>
								<Table.Cell class={cn('font-medium', capsClass(item.item_name))}
									>{item.item_name}</Table.Cell
								>
								<Table.Cell>
									{#if late}
										<ToneBadge tone="danger">
											<TriangleAlertIcon />
											Late
										</ToneBadge>
									{:else if status.received > 0}
										<ToneBadge tone="warning">
											<PackageIcon />
											Partly received
										</ToneBadge>
									{:else}
										<ToneBadge tone="info">
											<TruckIcon />
											On the way
										</ToneBadge>
									{/if}
								</Table.Cell>
								<Table.Cell>
									<Quantity value={status.quantity} unit={item.unit} pack={false} />
									<span class="text-muted-foreground ms-1 text-xs">
										{since === 0
											? 'today'
											: `${formatDate(status.ordered_on)}, ${formatDuration(since)} ago`}
									</span>
								</Table.Cell>
								<Table.Cell>
									{#if status.received > 0}
										<Quantity value={status.received} unit={item.unit} pack={false} />
										<span class="text-warning ms-1 text-xs">{toCome} to come</span>
									{:else}
										<span class="text-muted-foreground">None yet</span>
									{/if}
								</Table.Cell>
								<Table.Cell class="tabular-nums">
									{#if status.expected_by}
										{@const left = daysBetween(today, status.expected_by)}
										{formatDate(status.expected_by)}
										<span
											class={cn(
												'ms-1 text-xs',
												late
													? 'text-destructive'
													: left <= 1
														? 'text-warning'
														: 'text-muted-foreground',
											)}
										>
											{late
												? `${formatDuration(-left)} late`
												: left === 0
													? 'today'
													: left === 1
														? 'tomorrow'
														: `in ${formatDuration(left)}`}
										</span>
									{:else}
										<ToneBadge tone={late ? 'danger' : 'neutral'}>
											<ClockIcon />
											Back-ordered
										</ToneBadge>
										<span
											class={cn(
												'ms-1 text-xs',
												late ? 'text-destructive' : 'text-muted-foreground',
											)}
										>
											{late ? 'chase the supplier' : 'no date yet'}
										</span>
									{/if}
								</Table.Cell>
								<Table.Cell>
									<Quantity
										value={item.quantity}
										unit={item.unit}
										valueClass={cn(item.quantity === 0 && 'text-destructive')}
									/>
								</Table.Cell>
								<Table.Cell>
									<div class="flex justify-end gap-1">
										<OrderControls
											{item}
											onMarkOrdered={(target) => orderDialog?.open(target)}
											onSnooze={(target) => snoozeDialog?.open(target)}
											onStopTracking={(target) => stopTrackingDialog?.open(target)}
										/>
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
				{@render footer(
					waitingList.shown,
					lateCount > 0
						? `${plural(waitingList.total, 'item')} on order, ${lateCount} late`
						: `${plural(waitingList.total, 'item')} on order`,
					waitingList,
				)}
			{/if}
		</Tabs.Content>

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
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each expiringList.visible as { batch, item } (batch.id)}
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
								<Table.Cell class="text-end">
									<Quantity value={batch.quantity} unit={item.unit} />
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

		<!-- Not moving: what to use up before ordering more -->
		<Tabs.Content value="notmoving" class="flex flex-col gap-3">
			{#if stale.length === 0}
				{@render emptyPane(
					ArchiveIcon,
					'Everything is moving',
					`Every tracked item with stock has moved in the last ${NOT_MOVING_DAYS} days.`,
				)}
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Item</Table.Head>
							<Table.Head>In stock</Table.Head>
							<Table.Head>Reorder at</Table.Head>
							<Table.Head>Last movement</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each staleList.visible as item (item.id)}
							<Table.Row>
								<Table.Cell class={cn('font-medium', capsClass(item.item_name))}
									>{item.item_name}</Table.Cell
								>
								<Table.Cell>
									<Quantity value={item.quantity} unit={item.unit} />
								</Table.Cell>
								<Table.Cell class="tabular-nums">
									{item.reorder_level < 0 ? '—' : item.reorder_level}
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
	A strip segment that is the tab for its queue: glyph, label, the count as
	the big figure, one line of context. The glyph, number and label tint only
	while the count is above zero; a zero is a muted zero in its fixed place,
	never a message. The open tab carries a bar along its bottom edge and a
	tint, and drops the chevron.
-->
{#snippet queueTab(
	value: Queue,
	Icon: Component<{ class?: string }>,
	label: string,
	count: number,
	sub: string,
	tone: 'warning' | 'danger' | 'info' | null,
)}
	{@const live = count > 0 ? tone : null}
	<div
		class="border-border flex min-w-0 even:border-s lg:[&:not(:first-child)]:border-s [&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0"
	>
		<Tabs.Trigger
			{value}
			class="group/tile hover:bg-muted/50 focus-visible:bg-muted/50 data-active:bg-muted/50 dark:data-active:bg-muted/50 group-data-[variant=line]/tabs-list:data-active:bg-muted/50 dark:group-data-[variant=line]/tabs-list:data-active:bg-muted/50 h-auto w-full min-w-0 flex-col items-start justify-start gap-1.5 rounded-none border-0 px-4 py-3.5 text-start whitespace-normal after:rounded-t-sm group-data-horizontal/tabs:after:inset-x-4 group-data-horizontal/tabs:after:bottom-0 group-data-horizontal/tabs:after:h-[3px] focus-visible:ring-0 focus-visible:outline-none"
		>
			<span
				class="text-muted-foreground group-data-active/tile:text-foreground flex w-full items-center gap-2 text-xs font-medium"
			>
				<span
					class={cn(
						'bg-muted text-foreground/70 flex size-5 shrink-0 items-center justify-center rounded-md',
						live === 'warning' && 'bg-warning-soft text-warning',
						live === 'danger' && 'bg-destructive/10 text-destructive',
						live === 'info' && 'bg-info-soft text-info',
					)}
				>
					<Icon class="size-3" />
				</span>
				<span
					class={cn(
						'truncate',
						live === 'warning' && 'text-warning',
						live === 'danger' && 'text-destructive',
						live === 'info' && 'text-info',
					)}
				>
					{label}
				</span>
				<ChevronRightIcon class="ms-auto size-3.5 shrink-0 group-data-active/tile:hidden" />
			</span>
			<span
				class={cn(
					'text-foreground text-[26px] leading-none font-semibold tabular-nums',
					live === 'warning' && 'text-warning',
					live === 'danger' && 'text-destructive',
					live === 'info' && 'text-info',
					count === 0 && 'text-muted-foreground',
				)}
			>
				{count}
			</span>
			<span class="text-muted-foreground w-full truncate text-xs">{sub}</span>
		</Tabs.Trigger>
	</div>
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
<SnoozeDialog bind:this={snoozeDialog} />
<StopTrackingDialog bind:this={stopTrackingDialog} />

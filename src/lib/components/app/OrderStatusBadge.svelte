<script lang="ts">
	import AlarmClockIcon from '@lucide/svelte/icons/alarm-clock'
	import CalendarIcon from '@lucide/svelte/icons/calendar'
	import ClockIcon from '@lucide/svelte/icons/clock'
	import PackageIcon from '@lucide/svelte/icons/package'
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert'
	import ToneBadge from '$lib/components/app/ToneBadge.svelte'
	import type { InventoryItem } from '$lib/types/inventory'
	import { formatDayMonth } from '$lib/utils/date'
	import { isLate, wokeFromSnooze } from '$lib/utils/orders'

	/**
	 * An item's order status as one badge for the ledger tables (Inventory,
	 * Price List): Ordered, Partly received, Back-ordered, Late, Snoozed, or a
	 * dash when nothing has been decided. The Dashboard lays the same facts out in columns.
	 */
	let { item }: { item: InventoryItem } = $props()
	const status = $derived(item.order_status)
</script>

{#if !status}
	<span class="text-muted-foreground">—</span>
{:else if status.kind === 'ordered'}
	{#if isLate(status)}
		<ToneBadge tone="danger">
			<TriangleAlertIcon />
			Late, ordered {formatDayMonth(status.ordered_on)}
		</ToneBadge>
	{:else if status.received > 0}
		<ToneBadge tone="warning">
			<PackageIcon />
			{status.received} of {status.quantity} received
		</ToneBadge>
	{:else if status.expected_by}
		<ToneBadge tone="info">
			<CalendarIcon />
			Ordered, due {formatDayMonth(status.expected_by)}
		</ToneBadge>
	{:else}
		<ToneBadge tone="info">
			<ClockIcon />
			Back-ordered {formatDayMonth(status.ordered_on)}
		</ToneBadge>
	{/if}
{:else if wokeFromSnooze(item)}
	<ToneBadge tone="warning">
		<AlarmClockIcon />
		Snooze ended {formatDayMonth(status.until)}
	</ToneBadge>
{:else}
	<ToneBadge tone="neutral">
		<AlarmClockIcon />
		Snoozed until {formatDayMonth(status.until)}
	</ToneBadge>
{/if}

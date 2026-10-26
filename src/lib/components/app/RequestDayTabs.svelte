<script lang="ts">
	import { getLocalTimeZone, parseDate, today, type DateValue } from '@internationalized/date'
	import CalendarIcon from '@lucide/svelte/icons/calendar'
	import CountBadge from '$lib/components/app/CountBadge.svelte'
	import { Button } from '$lib/components/ui/button'
	import { Calendar } from '$lib/components/ui/calendar'
	import * as Popover from '$lib/components/ui/popover'
	import * as Tabs from '$lib/components/ui/tabs'
	import { todayIsoDate } from '$lib/types/stockBatches'
	import { formatDate } from '$lib/utils/date'
	import type { DayMode } from '$lib/utils/requests'

	/**
	 * The day segments shared by Stock Approvals and Stock Requests: Today,
	 * Older Pending with its count, or one chosen date. They sit inside the
	 * page's Tabs.Root, which holds the mode; By Date reveals the date beside
	 * them.
	 */
	let {
		mode,
		date = $bindable(todayIsoDate()),
		olderPendingCount = 0,
	}: { mode: DayMode; date?: string; olderPendingCount?: number } = $props()

	const timeZone = getLocalTimeZone()
	let open = $state(false)

	const calendarValue = $derived<DateValue | undefined>(date ? parseDate(date) : undefined)

	const pick = (value: DateValue | undefined): void => {
		if (!value) return
		date = value.toString()
		open = false
	}
</script>

<Tabs.List aria-label="Which day to show" class="grid auto-cols-fr grid-flow-col">
	<Tabs.Trigger value="today">Today</Tabs.Trigger>
	<Tabs.Trigger value="older">
		Older Pending
		{#if olderPendingCount > 0}<CountBadge count={olderPendingCount} />{/if}
	</Tabs.Trigger>
	<Tabs.Trigger value="date">By Date</Tabs.Trigger>
</Tabs.List>

{#if mode === 'date'}
	<Popover.Root bind:open>
		<Popover.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="outline">
					<CalendarIcon data-icon="inline-start" />
					{formatDate(date)}
				</Button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content align="start" class="w-auto p-0">
			<Calendar
				type="single"
				value={calendarValue}
				onValueChange={pick}
				maxValue={today(timeZone)}
			/>
		</Popover.Content>
	</Popover.Root>
{/if}

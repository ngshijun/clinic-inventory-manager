<script lang="ts">
	import { getLocalTimeZone, parseDate, today, type DateValue } from '@internationalized/date'
	import CalendarIcon from '@lucide/svelte/icons/calendar'
	import { Button } from '$lib/components/ui/button'
	import { Calendar } from '$lib/components/ui/calendar'
	import * as Popover from '$lib/components/ui/popover'
	import * as ToggleGroup from '$lib/components/ui/toggle-group'
	import { todayIsoDate } from '$lib/types/stockBatches'
	import { formatDate } from '$lib/utils/date'
	import type { DayMode } from '$lib/utils/requests'

	/**
	 * The day control shared by Stock Approvals and Stock Requests: Today,
	 * Older Pending with its count, or one chosen date. Choosing By Date
	 * reveals the date beside the control.
	 */
	let {
		mode = $bindable('today'),
		date = $bindable(todayIsoDate()),
		olderPendingCount = 0,
	}: { mode?: DayMode; date?: string; olderPendingCount?: number } = $props()

	const timeZone = getLocalTimeZone()
	let open = $state(false)

	const calendarValue = $derived<DateValue | undefined>(date ? parseDate(date) : undefined)

	const pick = (value: DateValue | undefined): void => {
		if (!value) return
		date = value.toString()
		open = false
	}
</script>

<ToggleGroup.Root
	type="single"
	variant="outline"
	value={mode}
	onValueChange={(value) => (mode = (value || 'today') as DayMode)}
	aria-label="Which day to show"
>
	<ToggleGroup.Item value="today">Today</ToggleGroup.Item>
	<ToggleGroup.Item value="older">
		Older Pending
		{#if olderPendingCount > 0}
			<span
				class="bg-destructive text-destructive-foreground ms-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums"
			>
				{olderPendingCount}
			</span>
		{/if}
	</ToggleGroup.Item>
	<ToggleGroup.Item value="date">By Date</ToggleGroup.Item>
</ToggleGroup.Root>

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

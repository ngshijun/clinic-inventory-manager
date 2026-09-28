<script lang="ts">
	import { parseDate, type DateValue } from '@internationalized/date'
	import CalendarIcon from '@lucide/svelte/icons/calendar'
	import { DateField } from 'bits-ui'
	import { tick, untrack } from 'svelte'
	import type { HTMLAttributes } from 'svelte/elements'
	import { Button } from '$lib/components/ui/button'
	import { Calendar } from '$lib/components/ui/calendar'
	import * as Popover from '$lib/components/ui/popover'
	import { cn } from '$lib/utils'
	import { MONTHS, formatDate } from '$lib/utils/date'

	/**
	 * The one date entry field: day, month, year, in that order on every
	 * computer. The field shows what is typed, "28/09/2027", as the Mac's own date
	 * field does; the button at the end opens a calendar. The value is a
	 * YYYY-MM-DD string, empty until the date is whole.
	 */
	let {
		value = $bindable(''),
		invalid = $bindable(false),
		id,
		min,
		disabled = false,
		label,
		class: className,
		onchange,
		...restProps
	}: Omit<HTMLAttributes<HTMLDivElement>, 'onchange' | 'id'> & {
		id?: string
		value?: string
		/** True while the date is half typed or before `min`; the dialog holds its button off */
		invalid?: boolean
		min?: string
		disabled?: boolean
		/** What the field is, for a screen reader */
		label: string
		onchange?: (value: string) => void
	} = $props()

	const ISO = /^\d{4}-\d{2}-\d{2}$/
	const toValue = (text: string | undefined): DateValue | undefined =>
		text && ISO.test(text) ? parseDate(text) : undefined

	// The field keeps its own date, so a part being retyped is not reset under the keys
	let dateValue = $state<DateValue | undefined>(untrack(() => toValue(value)))
	const minValue = $derived(toValue(min))

	$effect(() => {
		const incoming = value
		untrack(() => {
			if ((dateValue?.toString() ?? '') !== incoming) dateValue = toValue(incoming)
		})
	})

	let open = $state(false)
	let root = $state<HTMLDivElement | null>(null)
	let halfTyped = $state(false)

	// A year still being typed reads as the year 2 or 20
	const yearUnfinished = $derived(value !== '' && value < '1900')
	const tooEarly = $derived(
		!yearUnfinished && value !== '' && min !== undefined && min !== '' && value < min,
	)

	// Some parts typed but not all: the value is still empty, yet the field is not
	const scan = (): void => {
		halfTyped = value === '' && root?.querySelector('[data-filled]') != null
	}

	$effect(() => {
		void value
		tick().then(scan)
	})

	$effect(() => {
		invalid = !disabled && (halfTyped || yearUnfinished || tooEarly)
	})

	const set = (next: DateValue | undefined): void => {
		const text = next?.toString() ?? ''
		if (text === value) return
		value = text
		if (text >= '1900') onchange?.(text)
	}

	// A year being typed reads "20", not "0020"
	const shown = (part: string, text: string): string =>
		part === 'year' ? text.replace(/^0+(?=\d)/, '') : text

	// Enter saves the dialog, as it does from any other field
	const onkeydown = (event: KeyboardEvent): void => {
		if (event.key !== 'Enter' || open) return
		const target = event.target as HTMLElement
		if (!target.hasAttribute('data-segment')) return
		target.closest('form')?.requestSubmit()
	}
</script>

<div {...restProps} class="flex flex-col gap-1.5">
	<DateField.Root
		bind:value={dateValue}
		onValueChange={set}
		locale="en-GB"
		granularity="day"
		{minValue}
		{disabled}
	>
		<DateField.Input
			bind:ref={root}
			{id}
			aria-label={label}
			aria-invalid={invalid || undefined}
			class={cn(
				'bg-input/50 focus-within:border-ring focus-within:ring-ring/30 aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex h-9 w-full min-w-0 items-center rounded-3xl border border-transparent ps-3 pe-0.5 text-base tabular-nums transition-[color,box-shadow,background-color] focus-within:ring-3 aria-invalid:ring-3 data-disabled:pointer-events-none data-disabled:opacity-50 md:text-sm',
				className,
			)}
			{onkeydown}
			onkeyup={scan}
			onfocusout={scan}
		>
			{#snippet children({ segments })}
				{#each segments as segment, index (index)}
					{#if segment.part === 'literal'}
						<span class="text-muted-foreground" aria-hidden="true">{segment.value}</span>
					{:else}
						{@const filled = /^\d+$/.test(segment.value)}
						<DateField.Segment
							part={segment.part}
							data-filled={filled ? '' : undefined}
							class={cn(
								'focus:bg-primary focus:text-primary-foreground rounded-sm px-0.5 caret-transparent outline-none',
								!filled && 'text-muted-foreground',
							)}
						>
							{shown(segment.part, segment.value)}
						</DateField.Segment>
					{/if}
				{/each}
				<Popover.Root bind:open>
					<Popover.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								size="icon-sm"
								class="text-muted-foreground ms-auto"
								aria-label="Open calendar"
								{disabled}
							>
								<CalendarIcon />
							</Button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content align="end" class="w-auto p-0">
						<Calendar
							type="single"
							captionLayout="dropdown"
							monthFormat={(month) => MONTHS[month - 1]}
							value={dateValue}
							{minValue}
							onValueChange={(picked) => {
								if (!picked) return
								dateValue = picked
								set(picked)
								open = false
							}}
						/>
					</Popover.Content>
				</Popover.Root>
			{/snippet}
		</DateField.Input>
	</DateField.Root>
	{#if !disabled && tooEarly}
		<p class="text-destructive text-sm" role="alert">Cannot be before {formatDate(min)}.</p>
	{:else if !disabled && (halfTyped || yearUnfinished)}
		<p class="text-muted-foreground text-sm">Finish the date, or clear it.</p>
	{/if}
</div>

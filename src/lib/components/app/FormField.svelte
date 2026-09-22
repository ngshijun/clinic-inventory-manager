<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js'
	import { Label } from '$lib/components/ui/label/index.js'
	import { Textarea } from '$lib/components/ui/textarea/index.js'
	import * as Select from '$lib/components/ui/select/index.js'
	import { caretAtEnd, selectOnFocus } from '$lib/attachments/focus'

	export interface FormFieldOption {
		value: string | number
		label: string
	}

	interface Props {
		label: string
		value: string | number | undefined
		type: 'text' | 'number' | 'select' | 'textarea' | 'date' | 'password'
		required?: boolean
		error?: string
		options?: FormFieldOption[]
		placeholder?: string
		disabled?: boolean
		min?: number
		max?: number
		step?: number | string
		rows?: number
		ref?: HTMLInputElement | null
		/**
		 * Focus this field on page load. Goes through the native attribute
		 * because SvelteKit resets focus after every navigation (including the
		 * first client-side render) and only an `[autofocus]` element survives.
		 */
		autofocus?: boolean
		/** Select the whole value on focus so typing replaces a prefilled default */
		selectOnFocus?: boolean
		/** Textarea only: put the caret after the existing text on first focus */
		caretAtEnd?: boolean
	}

	let {
		label,
		value = $bindable(),
		type,
		required = false,
		error = '',
		options = [],
		placeholder = '',
		disabled = false,
		min,
		max,
		step,
		rows = 3,
		ref = $bindable(null),
		autofocus = false,
		selectOnFocus: selectAll = false,
		caretAtEnd: caretEnd = false,
	}: Props = $props()

	const fieldId = $props.id()

	// The Vue field emitted 0 rather than NaN for an unparseable number.
	function onNumberInput(event: Event & { currentTarget: HTMLInputElement }) {
		const parsed = parseFloat(event.currentTarget.value)
		value = isNaN(parsed) ? 0 : parsed
	}

	const selectLabel = $derived(
		options.find((option) => String(option.value) === String(value))?.label,
	)
</script>

<div class="space-y-1">
	<Label
		for={fieldId}
		class="block {required ? "after:ml-1 after:text-red-500 after:content-['*']" : ''}"
	>
		{label}
	</Label>

	{#if type === 'textarea'}
		<Textarea
			id={fieldId}
			bind:value
			{rows}
			{placeholder}
			{required}
			{disabled}
			aria-invalid={error ? 'true' : undefined}
			{@attach caretAtEnd(caretEnd)}
		/>
	{:else if type === 'select'}
		<Select.Root
			type="single"
			value={value === undefined ? '' : String(value)}
			onValueChange={(next) => {
				const match = options.find((option) => String(option.value) === next)
				value = match ? match.value : next
			}}
			{disabled}
		>
			<Select.Trigger
				aria-invalid={error ? 'true' : undefined}
				class={error ? 'border-red-300' : ''}
			>
				{selectLabel ?? (placeholder || 'Select an option')}
			</Select.Trigger>
			<Select.Content>
				{#each options as option (option.value)}
					<Select.Item value={String(option.value)} label={option.label}>{option.label}</Select.Item
					>
				{/each}
			</Select.Content>
		</Select.Root>
	{:else if type === 'number'}
		<Input
			bind:ref
			id={fieldId}
			type="number"
			value={value ?? ''}
			oninput={onNumberInput}
			{placeholder}
			{required}
			{disabled}
			{min}
			{max}
			{step}
			{autofocus}
			aria-invalid={error ? 'true' : undefined}
			{@attach selectOnFocus(selectAll)}
		/>
	{:else}
		<Input
			bind:ref
			id={fieldId}
			{type}
			bind:value
			{placeholder}
			{required}
			{disabled}
			{autofocus}
			aria-invalid={error ? 'true' : undefined}
			{@attach selectOnFocus(selectAll)}
		/>
	{/if}

	{#if error}
		<p class="text-sm text-red-600">{error}</p>
	{/if}
</div>

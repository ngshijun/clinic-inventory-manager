<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js'
	import SearchIcon from '$lib/components/icons/SearchIcon.svelte'
	import CloseIcon from '$lib/components/icons/CloseIcon.svelte'

	interface Props {
		value: string
		placeholder?: string
		showAdvancedToggle?: boolean
		showClearFilters?: boolean
		hasActiveFilters?: boolean
		ontoggleadvanced?: () => void
		onclearfilters?: () => void
	}

	let {
		value = $bindable(),
		placeholder = 'Search...',
		showAdvancedToggle = false,
		showClearFilters = false,
		hasActiveFilters = false,
		ontoggleadvanced,
		onclearfilters,
	}: Props = $props()

	const inputId = $props.id()
	const hasTrailingControls = $derived(showAdvancedToggle || showClearFilters)
</script>

<div class="w-full sm:max-w-md">
	<label for={inputId} class="sr-only">{placeholder}</label>
	<div class="relative">
		<Input
			id={inputId}
			type="text"
			bind:value
			{placeholder}
			class="block py-2 pl-10 {hasTrailingControls ? 'pr-24' : value ? 'pr-10' : 'pr-3'}"
		/>

		<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
			<SearchIcon class="h-5 w-5 text-gray-400" />
		</div>

		{#if hasTrailingControls}
			<div class="absolute inset-y-0 right-0 flex items-center pr-3">
				{#if value}
					<button
						type="button"
						onclick={() => (value = '')}
						class="mr-2 text-gray-400 transition-colors hover:text-gray-600"
						title="Clear search"
					>
						<CloseIcon class="h-4 w-4" />
					</button>
				{/if}
				{#if showClearFilters && hasActiveFilters}
					<button
						type="button"
						onclick={onclearfilters}
						class="mr-2 rounded border border-gray-300 px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
						title="Clear all filters"
					>
						Clear
					</button>
				{/if}
				{#if showAdvancedToggle}
					<button
						type="button"
						onclick={ontoggleadvanced}
						class="text-xs font-medium text-blue-600 transition-colors hover:text-blue-800"
						title="Toggle advanced search"
					>
						Advanced
					</button>
				{/if}
			</div>
		{:else if value}
			<button
				type="button"
				onclick={() => (value = '')}
				class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-gray-600"
				title="Clear search"
			>
				<CloseIcon class="h-4 w-4" />
			</button>
		{/if}
	</div>
</div>

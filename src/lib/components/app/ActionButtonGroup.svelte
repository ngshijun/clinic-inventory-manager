<script lang="ts">
	import { cn } from '$lib/utils.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js'
	import CheckIcon from '$lib/components/icons/CheckIcon.svelte'
	import ChevronDownIcon from '$lib/components/icons/ChevronDownIcon.svelte'
	import EditIcon from '$lib/components/icons/EditIcon.svelte'
	import TrashIcon from '$lib/components/icons/TrashIcon.svelte'

	export interface DropdownItem {
		key: string
		label: string
	}

	export interface ActionButtonGroupAction {
		key: string
		label: string
		variant: 'blue' | 'gray' | 'red' | 'green' | 'yellow' | 'orange' | 'cyan'
		icon?: 'edit' | 'delete' | 'check'
		disabled?: boolean
		dropdown?: DropdownItem[]
	}

	interface Props {
		actions: ActionButtonGroupAction[]
		loading?: boolean
		size?: 'sm' | 'md' | 'lg'
		layout?: 'horizontal' | 'vertical'
		onactionclick?: (actionKey: string) => void
		/* The Vue component merged fall-through attributes onto its root; the
		 * mobile card in every list view passes `w-full` that way. */
		class?: string
	}

	let {
		actions,
		loading = false,
		size = 'md',
		layout = 'horizontal',
		onactionclick,
		class: className,
	}: Props = $props()

	// `row` / `row-sm` are the button sizes that reproduce the original in-row
	// action sizing: full width on mobile, compact from sm up.
	const buttonSize = $derived(size === 'sm' ? 'row-sm' : size === 'lg' ? 'lg' : 'row')

	// tailwind-variants cannot infer a template-literal variant name, so map it.
	const soft = (variant: ActionButtonGroupAction['variant']) =>
		`soft-${variant}` as `soft-${ActionButtonGroupAction['variant']}`

	// These two dropdowns sit directly above the pagination bar, so they open
	// upwards to avoid being clipped.
	function sideFor(key: string): 'top' | 'bottom' {
		return key === 'select-action' || key === 'change-action' ? 'top' : 'bottom'
	}

	function handleClick(key: string) {
		if (!loading) onactionclick?.(key)
	}
</script>

<div
	class={cn('flex', layout === 'horizontal' ? 'flex-row gap-x-2' : 'flex-col gap-y-2', className)}
>
	{#each actions as action (action.key)}
		{#if action.dropdown}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger disabled={loading || action.disabled}>
					{#snippet child({ props })}
						<Button
							{...props}
							variant={soft(action.variant)}
							size={buttonSize}
							disabled={loading || action.disabled}
							title={action.label}
						>
							{action.label}
							<ChevronDownIcon class="ml-1 h-3 w-3 flex-shrink-0" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content side={sideFor(action.key)} align="end" class="w-48 min-w-max">
					{#each action.dropdown as item, index (item.key)}
						<DropdownMenu.Item
							onSelect={() => handleClick(item.key)}
							class={item.key === 'mark-ordered' ? 'font-semibold text-gray-900' : ''}
						>
							<span>{item.label}</span>
						</DropdownMenu.Item>
						{#if item.key === 'mark-ordered' && index < action.dropdown.length - 1}
							<div class="my-1 border-t border-gray-200"></div>
						{/if}
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{:else}
			<Button
				variant={soft(action.variant)}
				size={buttonSize}
				disabled={loading || action.disabled}
				title={action.label}
				onclick={() => handleClick(action.key)}
			>
				{#if action.icon === 'edit'}
					<EditIcon class="mr-1 h-4 w-4" />
				{:else if action.icon === 'delete'}
					<TrashIcon class="mr-1 h-4 w-4" />
				{:else if action.icon === 'check'}
					<CheckIcon class="mr-1 h-4 w-4" />
				{/if}
				{action.label}
			</Button>
		{/if}
	{/each}
</div>

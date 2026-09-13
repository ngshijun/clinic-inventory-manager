<script lang="ts">
	import * as Table from '$lib/components/ui/table/index.js'
	import ChevronUpSolidIcon from '$lib/components/icons/ChevronUpSolidIcon.svelte'
	import ChevronDownSolidIcon from '$lib/components/icons/ChevronDownSolidIcon.svelte'

	export interface SortableTableColumn {
		key: string
		label: string
		sortable?: boolean
		align?: 'left' | 'center' | 'right'
	}

	export interface SortConfig {
		key: string | null
		direction: 'asc' | 'desc'
	}

	interface Props {
		columns: SortableTableColumn[]
		sortConfig: SortConfig
		onsortchange?: (key: string) => void
	}

	let { columns, sortConfig, onsortchange }: Props = $props()

	const alignment = { center: 'text-center', right: 'text-right', left: 'text-left' }
</script>

<Table.Header>
	<Table.Row class="hover:bg-transparent">
		{#each columns as column (column.key)}
			<Table.Head
				class="{alignment[column.align ?? 'left']} {column.sortable
					? 'cursor-pointer select-none hover:bg-gray-100'
					: ''}"
				onclick={column.sortable ? () => onsortchange?.(column.key) : undefined}
			>
				{#if column.sortable}
					<div class="flex items-center justify-between">
						<span>{column.label}</span>
						<div class="ml-2 flex flex-col">
							<ChevronUpSolidIcon
								class="h-3 w-3 transition-colors {sortConfig.key === column.key &&
								sortConfig.direction === 'asc'
									? 'text-blue-600'
									: 'text-gray-400'}"
							/>
							<ChevronDownSolidIcon
								class="-mt-1 h-3 w-3 transition-colors {sortConfig.key === column.key &&
								sortConfig.direction === 'desc'
									? 'text-blue-600'
									: 'text-gray-400'}"
							/>
						</div>
					</div>
				{:else}
					<span>{column.label}</span>
				{/if}
			</Table.Head>
		{/each}
	</Table.Row>
</Table.Header>

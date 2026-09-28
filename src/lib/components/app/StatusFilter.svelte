<script lang="ts">
	import * as ToggleGroup from '$lib/components/ui/toggle-group'
	import { STATUS_FILTERS, type StatusFilter } from '$lib/utils/statusFilter'

	/** The status segments in a toolbar. One segment is always chosen. */
	let { value = $bindable() }: { value: StatusFilter } = $props()
</script>

<ToggleGroup.Root
	class="grid auto-cols-fr grid-flow-col"
	type="single"
	variant="outline"
	bind:value={
		() => value,
		(chosen) => {
			if (chosen) value = chosen as StatusFilter
		}
	}
	aria-label="Filter by status"
>
	{#each STATUS_FILTERS as option (option.value)}
		<ToggleGroup.Item value={option.value}>{option.label}</ToggleGroup.Item>
	{/each}
</ToggleGroup.Root>

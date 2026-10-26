<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs'
	import { STATUS_FILTERS } from '$lib/utils/statusFilter'

	/**
	 * The status segments in a toolbar. They sit inside the page's Tabs.Root,
	 * which holds the chosen status and wraps the list they narrow.
	 */
</script>

<Tabs.List aria-label="Filter by status" class="grid auto-cols-fr grid-flow-col">
	{#each STATUS_FILTERS as option (option.value)}
		<Tabs.Trigger value={option.value}>{option.label}</Tabs.Trigger>
	{/each}
</Tabs.List>

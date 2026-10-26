<script lang="ts">
	import { Badge } from '$lib/components/ui/badge'

	/**
	 * Pending work, counted where it waits on a page (a tab, a section heading), so a sidebar badge
	 * can be traced to it. The sidebar badge's shape in the page's colours: the same kind of number.
	 */
	let { count }: { count: number } = $props()
</script>

<Badge class="min-w-5 rounded-full border-0 px-1.5 font-semibold" aria-label="{count} pending">
	{count > 99 ? '99+' : count}
</Badge>

<script lang="ts">
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis'
	import { Button } from '$lib/components/ui/button'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import * as Tooltip from '$lib/components/ui/tooltip'

	/**
	 * The ⋯ button that opens a DropdownMenu of less-used actions, with a
	 * "More actions" hint on hover. Place it inside DropdownMenu.Root.
	 */
	let { size = 'icon' }: { size?: 'icon' | 'icon-sm' } = $props()
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props: tooltipProps })}
			<DropdownMenu.Trigger {...tooltipProps}>
				{#snippet child({ props })}
					<Button {...props} variant="ghost" {size} aria-label="More actions">
						<EllipsisIcon />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content>More actions</Tooltip.Content>
</Tooltip.Root>

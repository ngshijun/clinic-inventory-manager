<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements'

	let { ...restProps }: SVGAttributes<SVGElement> = $props()
</script>

<svg
	fill="none"
	stroke="currentColor"
	viewBox="0 0 24 24"
	xmlns="http://www.w3.org/2000/svg"
	{...restProps}
>
	<path
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width="2"
		d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
	/>
</svg>

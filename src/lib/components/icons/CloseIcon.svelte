<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements'

	let { ...restProps }: SVGAttributes<SVGElement> = $props()
</script>

<svg
	  fill="none"
	  stroke="currentColor"
	  viewBox="0 0 24 24"
	  xmlns="http://www.w3.org/2000/svg"
	  {...restProps}>
	  <path
	    stroke-linecap="round"
	    stroke-linejoin="round"
	    stroke-width="2"
	    d="M6 18L18 6M6 6l12 12"
	  />
	</svg>

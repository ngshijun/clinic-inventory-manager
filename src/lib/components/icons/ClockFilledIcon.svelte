<script lang="ts">
	import type { SVGAttributes } from 'svelte/elements'

	let { ...restProps }: SVGAttributes<SVGElement> = $props()
</script>

<svg fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" {...restProps}>
	  <path
	    fill-rule="evenodd"
	    d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 9V6a1 1 0 10-2 0v6a1 1 0 00.293.707l3 3a1 1 0 101.414-1.414L11 11z"
	    clip-rule="evenodd"
	  />
	</svg>

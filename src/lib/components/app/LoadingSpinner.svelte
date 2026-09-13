<script lang="ts">
	interface Props {
		message?: string
		size?: 'sm' | 'md' | 'lg'
	}

	let { message, size = 'md' }: Props = $props()

	const sizeClasses = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8 sm:h-8 sm:w-8' }
	const textSizeClasses = { sm: 'text-xs', md: 'text-sm', lg: 'text-sm sm:text-base' }
</script>

<div class="py-6 text-center sm:py-8">
	<div
		class="inline-block animate-spin rounded-full border-b-2 border-blue-600 {sizeClasses[size]}"
	></div>
	{#if message}
		<p class="mt-2 text-gray-600 {textSizeClasses[size]}">{message}</p>
	{/if}
</div>

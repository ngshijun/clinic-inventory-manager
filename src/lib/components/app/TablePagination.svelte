<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js'

	interface Props {
		currentPage: number
		totalPages: number
		itemsPerPage: number
		totalItems: number
		startIndex: number
		endIndex: number
		showItemsPerPageSelector?: boolean
		itemsPerPageOptions?: number[]
		onpagechange?: (page: number) => void
		onitemsperpagechange?: (itemsPerPage: number) => void
	}

	let {
		currentPage,
		totalPages,
		itemsPerPage,
		totalItems,
		startIndex,
		endIndex,
		showItemsPerPageSelector = true,
		itemsPerPageOptions = [25, 50, 100, 500],
		onpagechange,
		onitemsperpagechange,
	}: Props = $props()

	const visiblePages = $derived.by((): (number | string)[] => {
		const pages: (number | string)[] = []
		const total = totalPages
		const current = currentPage

		if (total <= 7) {
			for (let i = 1; i <= total; i++) pages.push(i)
		} else {
			pages.push(1)
			if (current <= 4) {
				for (let i = 2; i <= 5; i++) pages.push(i)
				pages.push('...')
				pages.push(total)
			} else if (current >= total - 3) {
				pages.push('...')
				for (let i = total - 4; i <= total; i++) pages.push(i)
			} else {
				pages.push('...')
				for (let i = current - 1; i <= current + 1; i++) pages.push(i)
				pages.push('...')
				pages.push(total)
			}
		}
		return pages
	})

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages && page !== currentPage) onpagechange?.(page)
	}
</script>

<div>
	<!-- Mobile Pagination -->
	<div class="block border-t border-gray-200 bg-gray-50 px-4 py-3 lg:hidden">
		<div class="flex items-center justify-between">
			<div class="text-sm text-gray-700">
				Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} results
			</div>
			<div class="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={currentPage <= 1}
					onclick={() => goToPage(currentPage - 1)}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={currentPage >= totalPages}
					onclick={() => goToPage(currentPage + 1)}
				>
					Next
				</Button>
			</div>
		</div>
	</div>

	<!-- Desktop Pagination -->
	<div class="hidden border-t border-gray-200 bg-gray-50 px-6 py-3 lg:block">
		<div class="flex items-center justify-between">
			<div class="flex items-center text-sm text-gray-700">
				<span>
					Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} results
				</span>
			</div>

			<div class="flex items-center space-x-2">
				{#if showItemsPerPageSelector}
					<div class="flex items-center space-x-2">
						<label for="items-per-page" class="text-sm text-gray-700">Items per page:</label>
						<select
							id="items-per-page"
							value={itemsPerPage}
							onchange={(event) => onitemsperpagechange?.(Number(event.currentTarget.value))}
							class="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
						>
							{#each itemsPerPageOptions as option (option)}
								<option value={option}>{option}</option>
							{/each}
						</select>
					</div>
				{/if}

				<div class="flex items-center space-x-1">
					<Button variant="outline" size="sm" disabled={currentPage <= 1} onclick={() => goToPage(1)}>
						First
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={currentPage <= 1}
						onclick={() => goToPage(currentPage - 1)}
					>
						Previous
					</Button>

					<div class="flex items-center space-x-1">
						{#each visiblePages as page, index (index)}
							{#if page === '...'}
								<span class="px-2 text-gray-500">...</span>
							{:else}
								<Button
									size="sm"
									variant={page === currentPage ? 'blue' : 'outline'}
									class={page === currentPage ? 'border border-blue-600' : ''}
									onclick={() => goToPage(Number(page))}
								>
									{page}
								</Button>
							{/if}
						{/each}
					</div>

					<Button
						variant="outline"
						size="sm"
						disabled={currentPage >= totalPages}
						onclick={() => goToPage(currentPage + 1)}
					>
						Next
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={currentPage >= totalPages}
						onclick={() => goToPage(totalPages)}
					>
						Last
					</Button>
				</div>
			</div>
		</div>
	</div>
</div>

<script lang="ts">
	import '../app.css'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { authStore } from '$lib/stores/auth.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockMovementsStore } from '$lib/stores/stockMovements.svelte'
	import { stockRequestsStore } from '$lib/stores/stockRequests.svelte'
	import { payrollStore } from '$lib/stores/payroll.svelte'
	import { payrollRecordsStore } from '$lib/stores/payrollRecords.svelte'
	import { createConnectionMonitor } from '$lib/composables/connectionMonitor.svelte'
	import CloseIcon from '$lib/components/icons/CloseIcon.svelte'
	import LogoutIcon from '$lib/components/icons/LogoutIcon.svelte'
	import MenuIcon from '$lib/components/icons/MenuIcon.svelte'

	let { children } = $props()

	let mobileMenuOpen = $state(false)

	const connectionMonitor = createConnectionMonitor()

	const pendingRequestsCount = $derived(
		stockRequestsStore.requests.filter((request) => request.status === 'Pending').length,
	)

	const links = $derived(
		authStore.user?.role === 'manager'
			? [
					{ href: '/dashboard', label: 'Dashboard' },
					{ href: '/inventory', label: 'Inventory' },
					{ href: '/price-list', label: 'Price List' },
					{ href: '/stock-movements', label: 'Stock Movements' },
					{ href: '/stock-approvals', label: 'Stock Approvals', badge: true },
					{ href: '/payroll', label: 'Payroll' },
					{ href: '/payroll-history', label: 'Payroll History' },
				]
			: authStore.user?.role === 'requester'
				? [{ href: '/stock-requests', label: 'Stock Requests' }]
				: [],
	)

	function initStores() {
		inventoryStore.initializeStore()
		stockMovementsStore.initializeStore()
		stockRequestsStore.initializeStore()
		payrollStore.initializeStore()
		payrollRecordsStore.initializeStore()
	}

	function cleanupStores() {
		inventoryStore.cleanup()
		stockMovementsStore.cleanup()
		stockRequestsStore.cleanup()
		payrollStore.cleanup()
		payrollRecordsStore.cleanup()
	}

	async function handleLogout() {
		cleanupStores()
		authStore.logout()
		await goto('/')
	}

	// Vue watched `isAuthenticated` and initialised the stores on every
	// transition into the authenticated state, including the very first one when
	// the session was restored from localStorage.
	$effect(() => {
		if (authStore.isAuthenticated) initStores()
	})

	// Close the mobile menu when the click lands outside the nav.
	function handleOutsideClick(e: MouseEvent) {
		const nav = document.querySelector('nav')
		if (nav && !nav.contains(e.target as Node)) mobileMenuOpen = false
	}
</script>

<svelte:document onclick={handleOutsideClick} />

<div id="app" class="min-h-screen bg-gray-50">
	{#if authStore.isAuthenticated}
		<nav class="border-b border-gray-200 bg-white shadow-sm">
			<div class="mx-auto max-w-[100rem] px-2 sm:px-6 lg:px-8">
				<div class="flex h-14 justify-between sm:h-16">
					<div class="flex items-center space-x-3">
						<div class="flex-shrink-0">
							<h1 class="text-lg font-bold text-gray-900 sm:text-xl">
								<span class="block sm:hidden">Inventory</span>
								<span class="hidden sm:block">Inventory Manager</span>
							</h1>
						</div>
						<!-- Connection Status Indicator -->
						<div class="flex items-center">
							<div
								class="h-2 w-2 rounded-full {connectionMonitor.isConnected
									? 'bg-green-500'
									: 'bg-red-500'}"
								title={connectionMonitor.isConnected ? 'Connected' : 'Connection Lost'}
							></div>
						</div>
					</div>

					<!-- Mobile menu button -->
					<div class="flex items-center space-x-2 sm:hidden">
						<button
							type="button"
							onclick={handleLogout}
							class="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-red-100 hover:text-red-500 focus:ring-2 focus:ring-red-500 focus:outline-none focus:ring-inset"
							title="Logout"
						>
							<LogoutIcon class="h-5 w-5" />
						</button>

						<button
							type="button"
							onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
							class="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:ring-inset"
						>
							{#if mobileMenuOpen}
								<CloseIcon class="h-6 w-6" />
							{:else}
								<MenuIcon class="h-6 w-6" />
							{/if}
						</button>
					</div>

					<!-- Desktop Navigation -->
					<div class="hidden sm:flex sm:items-center sm:space-x-8">
						<div class="flex space-x-8">
							{#each links as link (link.href)}
								<a
									href={link.href}
									class="inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium {page.url
										.pathname === link.href
										? 'border-blue-500 text-gray-900'
										: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
								>
									{link.label}
									{#if link.badge && pendingRequestsCount > 0}
										<span
											class="m-0.5 ml-2 inline-flex items-center justify-center rounded-full bg-red-600 px-2 py-1 text-xs leading-none font-bold text-white"
										>
											{pendingRequestsCount}
										</span>
									{/if}
								</a>
							{/each}
						</div>

						<button
							type="button"
							onclick={handleLogout}
							class="inline-flex items-center rounded-md border border-transparent px-3 py-2 text-sm leading-4 font-medium text-gray-500 hover:text-red-500 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
						>
							<LogoutIcon class="mr-2 h-4 w-4" />
							Logout
						</button>
					</div>
				</div>

				<!-- Mobile Navigation Menu -->
				{#if mobileMenuOpen}
					<div class="sm:hidden">
						<div class="space-y-1 pt-2 pb-3">
							{#each links as link (link.href)}
								<a
									href={link.href}
									onclick={() => (mobileMenuOpen = false)}
									class="block border-l-4 py-2 pr-4 pl-3 text-base font-medium {page.url
										.pathname === link.href
										? 'border-blue-500 bg-blue-50 text-blue-700'
										: 'border-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700'}"
								>
									{link.label}
								</a>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</nav>
	{/if}

	<main class="mx-auto max-w-[100rem] px-2 py-3 sm:px-6 sm:py-6 lg:px-8">
		{@render children?.()}
	</main>
</div>

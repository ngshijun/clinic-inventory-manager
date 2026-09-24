<script lang="ts">
	import '../app.css'
	import { goto, afterNavigate, beforeNavigate } from '$app/navigation'
	import { updated } from '$app/state'
	import { toast } from 'svelte-sonner'
	import { authStore } from '$lib/stores/auth.svelte'
	import { inventoryStore } from '$lib/stores/inventory.svelte'
	import { stockMovementsStore } from '$lib/stores/stockMovements.svelte'
	import { stockBatchesStore } from '$lib/stores/stockBatches.svelte'
	import { stockRequestsStore } from '$lib/stores/stockRequests.svelte'
	import { payrollStore } from '$lib/stores/payroll.svelte'
	import { payrollRecordsStore } from '$lib/stores/payrollRecords.svelte'
	import { connection, useConnection } from '$lib/stores/connection.svelte'
	import { setConvexClientContext } from 'convex-svelte'
	import { convex } from '$lib/convex'
	import WifiOffIcon from '@lucide/svelte/icons/wifi-off'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import * as Breadcrumb from '$lib/components/ui/breadcrumb'
	import { Toaster } from '$lib/components/ui/sonner'
	import { ModeWatcher } from 'mode-watcher'
	import AppSidebar from '$lib/components/app/AppSidebar.svelte'
	import { breadcrumbs } from '$lib/components/app/breadcrumbs.svelte'
	import { scrollRegion } from '$lib/components/app/scroll-region.svelte'

	let { children } = $props()

	// Share the app-wide Convex client with any component that uses `useQuery`
	setConvexClientContext(convex)
	useConnection()

	const pendingRequestsCount = $derived(
		stockRequestsStore.requests.filter((request) => request.status === 'Pending').length,
	)

	function initStores() {
		inventoryStore.initializeStore()
		stockBatchesStore.initializeStore()
		stockMovementsStore.initializeStore()
		stockRequestsStore.initializeStore()
		// Payroll queries reject any other role, so a requester never subscribes to them.
		if (authStore.user?.role === 'manager') {
			payrollStore.initializeStore()
			payrollRecordsStore.initializeStore()
		}
	}

	function cleanupStores() {
		inventoryStore.cleanup()
		stockBatchesStore.cleanup()
		stockMovementsStore.cleanup()
		stockRequestsStore.cleanup()
		payrollStore.cleanup()
		payrollRecordsStore.cleanup()
	}

	async function handleSignOut() {
		cleanupStores()
		authStore.logout()
		await goto('/')
	}

	// The stores are initialised on every transition into the authenticated
	// state, including the first one when the session is restored from localStorage,
	// and again if the server corrects the restored role (each store initialises once).
	$effect(() => {
		if (authStore.isAuthenticated && authStore.user) initStores()
	})

	/*
	 * The top bar stays put and only the content scrolls. The scroll edge
	 * hairline sits under the top bar unless the page pins its own toolbar,
	 * which then takes it.
	 */
	let scroller = $state<HTMLDivElement | null>(null)
	const edge = $derived(scrollRegion.scrolled && !scrollRegion.pinned)

	afterNavigate(({ type, to }) => {
		// A new page starts at the top; hash links and back/forward keep SvelteKit's own scrolling.
		if (type !== 'popstate' && !to?.url.hash && scroller) {
			scroller.scrollTop = 0
			scrollRegion.scrolled = false
		}
	})

	/*
	 * A new deploy while the tab is open: offer a reload, and take the next
	 * page change as a full load so the old build never fetches chunks that
	 * no longer exist. The toast stays until Reload is pressed, since a
	 * half-filled form should not be thrown away on a timer.
	 */
	$effect(() => {
		if (!updated.current) return
		toast('A new version of the app is ready.', {
			id: 'app-updated',
			duration: Infinity,
			action: { label: 'Reload', onClick: () => location.reload() },
		})
	})

	beforeNavigate(({ willUnload, to }) => {
		if (updated.current && !willUnload && to?.url) location.href = to.url.href
	})
</script>

<ModeWatcher />
<Toaster richColors position="top-right" />

{#if authStore.isAuthenticated && authStore.user}
	<Sidebar.Provider class="h-svh overflow-hidden">
		<AppSidebar
			user={authStore.user}
			pendingCount={pendingRequestsCount}
			onSignOut={handleSignOut}
		/>
		<Sidebar.Inset class="min-h-0 overflow-hidden">
			<header
				data-scrolled={edge ? '' : undefined}
				class="bg-background data-scrolled:border-border flex h-14 shrink-0 items-center gap-2 border-b border-transparent px-4 transition-colors"
			>
				<Sidebar.Trigger class="-ms-1 me-2" />
				<Breadcrumb.Root>
					<Breadcrumb.List>
						{#each breadcrumbs.current as crumb, i (i)}
							{#if i > 0}
								<Breadcrumb.Separator />
							{/if}
							<Breadcrumb.Item>
								{#if crumb.href}
									<Breadcrumb.Link href={crumb.href}>{crumb.label}</Breadcrumb.Link>
								{:else}
									<Breadcrumb.Page class="font-semibold">{crumb.label}</Breadcrumb.Page>
								{/if}
							</Breadcrumb.Item>
						{/each}
					</Breadcrumb.List>
				</Breadcrumb.Root>
				{#if connection.isOffline}
					<!-- A quiet status, the way Gmail and Slack show a dropped socket: no alert, no prose. -->
					<span
						role="status"
						class="text-muted-foreground ms-auto inline-flex items-center gap-1.5 text-xs"
					>
						<WifiOffIcon class="size-3.5" />
						Reconnecting…
					</span>
				{/if}
			</header>

			<!-- A size container, so a page can size itself to the visible region with cqh. -->
			<div
				bind:this={scroller}
				class="[container-type:size] flex min-h-0 flex-1 flex-col overflow-y-auto"
				onscroll={() => (scrollRegion.scrolled = (scroller?.scrollTop ?? 0) > 0)}
			>
				<div class="flex flex-1 flex-col gap-4 p-4 sm:p-6">
					{@render children?.()}
				</div>
			</div>
		</Sidebar.Inset>
	</Sidebar.Provider>
{:else}
	{@render children?.()}
{/if}

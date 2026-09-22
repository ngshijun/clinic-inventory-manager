<script lang="ts">
	import { page } from '$app/state'
	import type { User } from '$lib/types/auth'
	import BoxesIcon from '@lucide/svelte/icons/boxes'
	import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard'
	import PackageIcon from '@lucide/svelte/icons/package'
	import TagIcon from '@lucide/svelte/icons/tag'
	import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right'
	import ClipboardCheckIcon from '@lucide/svelte/icons/clipboard-check'
	import WalletIcon from '@lucide/svelte/icons/wallet'
	import HistoryIcon from '@lucide/svelte/icons/history'
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down'
	import LogOutIcon from '@lucide/svelte/icons/log-out'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import { useSidebar } from '$lib/components/ui/sidebar'

	type NavItem = { title: string; href: string; icon: typeof PackageIcon }
	type NavGroup = { label: string; items: NavItem[] }

	let {
		user,
		pendingCount = 0,
		onSignOut,
	}: { user: User; pendingCount?: number; onSignOut: () => void } = $props()

	const sidebar = useSidebar()

	// Pages a role cannot open are left out rather than shown locked.
	const groups = $derived<NavGroup[]>(
		user.role === 'manager'
			? [
					{
						label: 'Overview',
						items: [{ title: 'Dashboard', href: '/dashboard', icon: LayoutDashboardIcon }],
					},
					{
						label: 'Stock',
						items: [
							{ title: 'Inventory', href: '/inventory', icon: PackageIcon },
							{ title: 'Price List', href: '/price-list', icon: TagIcon },
							{ title: 'Stock Movements', href: '/stock-movements', icon: ArrowLeftRightIcon },
							{ title: 'Stock Approvals', href: '/stock-approvals', icon: ClipboardCheckIcon },
						],
					},
					{
						label: 'Payroll',
						items: [
							{ title: 'Payroll', href: '/payroll', icon: WalletIcon },
							{ title: 'Payroll History', href: '/payroll-history', icon: HistoryIcon },
						],
					},
				]
			: [
					{
						label: 'Stock',
						items: [{ title: 'Stock Requests', href: '/stock-requests', icon: ClipboardCheckIcon }],
					},
				],
	)

	const roleLabel = $derived(user.role === 'manager' ? 'Manager' : 'Requester')
	const initial = $derived(roleLabel.charAt(0))

	function isActive(href: string, pathname: string): boolean {
		return pathname === href || pathname.startsWith(`${href}/`)
	}
</script>

<Sidebar.Root variant="inset" collapsible="icon">
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a href={groups[0].items[0].href} {...props}>
							<span
								class="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-xl"
							>
								<BoxesIcon />
							</span>
							<span class="flex min-w-0 flex-col leading-tight">
								<span class="truncate text-sm font-extrabold">Clinic Inventory</span>
								<span class="text-sidebar-foreground/85 truncate text-xs">Poliklinik Ng PLT</span>
							</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<Sidebar.Content>
		{#each groups as group (group.label)}
			<Sidebar.Group>
				<Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each group.items as item (item.href)}
							{@const active = isActive(item.href, page.url.pathname)}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton isActive={active} tooltipContent={item.title}>
									{#snippet child({ props })}
										<a href={item.href} aria-current={active ? 'page' : undefined} {...props}>
											<item.icon />
											<span>{item.title}</span>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
								{#if item.href === '/stock-approvals' && pendingCount > 0}
									<Sidebar.MenuBadge class="bg-sidebar-accent">{pendingCount}</Sidebar.MenuBadge>
								{/if}
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/each}
	</Sidebar.Content>

	<!-- The signed-in role sits at the foot of the sidebar; the menu opens beside it, or above it when the sidebar is a sheet. -->
	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Sidebar.MenuButton size="lg" {...props} aria-label="Account">
								<span
									class="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
								>
									{initial}
								</span>
								<span class="flex min-w-0 flex-col leading-tight">
									<span class="truncate text-sm font-medium">{roleLabel}</span>
									<span class="text-sidebar-foreground/85 truncate text-xs"
										>Signed in with clinic password</span
									>
								</span>
								<ChevronsUpDownIcon class="ms-auto size-4" />
							</Sidebar.MenuButton>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content
						class="min-w-56"
						side={sidebar.isMobile ? 'top' : 'right'}
						align="end"
						sideOffset={4}
					>
						<DropdownMenu.Group>
							<DropdownMenu.Label class="flex flex-col gap-0.5 font-normal">
								<span class="font-medium">{roleLabel}</span>
								<span class="text-muted-foreground text-xs">Signed in with clinic password</span>
							</DropdownMenu.Label>
						</DropdownMenu.Group>
						<DropdownMenu.Separator />
						<DropdownMenu.Group>
							<DropdownMenu.Item onSelect={onSignOut}>
								<LogOutIcon />
								Sign Out
							</DropdownMenu.Item>
						</DropdownMenu.Group>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>

	<Sidebar.Rail />
</Sidebar.Root>

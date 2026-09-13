import type { User } from '$lib/types/auth'

type Role = User['role']

interface RouteAccess {
	requiresAuth?: boolean
	requiresGuest?: boolean
	roles?: Role[]
}

/* The table that vue-router kept in each route's `meta`. */
export const ROUTE_ACCESS: Record<string, RouteAccess> = {
	'/': { requiresGuest: true },
	'/dashboard': { requiresAuth: true, roles: ['manager'] },
	'/inventory': { requiresAuth: true, roles: ['manager'] },
	'/price-list': { requiresAuth: true, roles: ['manager'] },
	'/stock-movements': { requiresAuth: true, roles: ['manager'] },
	'/stock-approvals': { requiresAuth: true, roles: ['manager'] },
	'/stock-requests': { requiresAuth: true, roles: ['requester'] },
	'/payroll': { requiresAuth: true, roles: ['manager'] },
	'/payroll-history': { requiresAuth: true, roles: ['manager'] },
}

/* Where each role lands when it is bounced off a route it may not see. */
export const HOME_FOR_ROLE: Record<Role, string> = {
	manager: '/dashboard',
	requester: '/stock-requests',
}

/**
 * Port of `router.beforeEach`. Returns the path to redirect to, or null to
 * allow the navigation.
 */
export function resolveRedirect(
	pathname: string,
	isAuthenticated: boolean,
	user: User | null,
): string | null {
	const access = ROUTE_ACCESS[pathname]
	if (!access) return null

	if (access.requiresAuth && !isAuthenticated) return '/'

	if (access.requiresGuest && isAuthenticated) {
		return user ? HOME_FOR_ROLE[user.role] : null
	}

	if (access.requiresAuth && isAuthenticated && user && access.roles) {
		if (!access.roles.includes(user.role)) return HOME_FOR_ROLE[user.role]
	}

	return null
}

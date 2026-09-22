import { ConvexError } from 'convex/values'
import { env } from '../_generated/server'

export type Role = 'manager' | 'requester'

/** Maps a shared password to its role, or null when it matches neither. */
export function roleForPassword(password: string): Role | null {
	if (password.length === 0) return null
	if (env.MANAGER_PASSWORD.length > 0 && password === env.MANAGER_PASSWORD) return 'manager'
	if (env.REQUESTER_PASSWORD.length > 0 && password === env.REQUESTER_PASSWORD) {
		return 'requester'
	}
	return null
}

/**
 * Resolves the caller's role from the `auth` password argument and throws
 * UNAUTHORIZED unless that role is one of `roles`. Returns the role.
 */
export function requireRole(auth: string, roles: Role[]): Role {
	const role = roleForPassword(auth)
	if (role === null) {
		throw new ConvexError({ code: 'UNAUTHORIZED', message: 'Invalid password' })
	}
	if (!roles.includes(role)) {
		throw new ConvexError({
			code: 'UNAUTHORIZED',
			message: `This action requires the ${roles.join(' or ')} role`,
		})
	}
	return role
}

import { api } from '../../../convex/_generated/api'
import { convex } from '$lib/convex'
import type { User } from '$lib/types/auth'

const PASSWORD_KEY = 'password'
const ROLE_KEY = 'role'

/*
 * The two shared passwords live only on the Convex deployment now. Signing in
 * asks the server which role a password maps to; the password itself is kept
 * in localStorage and sent as the `auth` argument of every query and
 * mutation, where the server checks it again.
 *
 * On a reload the stored role is trusted immediately so the route guard can
 * run synchronously, then re-validated in the background: an invalid or
 * rotated password logs the user out.
 */
class AuthStore {
	isLoggedIn = $state(false)
	user = $state<User | null>(null)

	get isAuthenticated(): boolean {
		return this.isLoggedIn
	}

	/** The credential every store passes to the server as `auth` */
	get token(): string {
		return localStorage.getItem(PASSWORD_KEY) ?? ''
	}

	// Initialize from localStorage
	initAuth(): void {
		const password = localStorage.getItem(PASSWORD_KEY)
		const role = localStorage.getItem(ROLE_KEY)
		if (!password || (role !== 'manager' && role !== 'requester')) return

		this.isLoggedIn = true
		this.user = { role }

		convex
			.query(api.auth.login, { password })
			.then((serverRole) => {
				if (serverRole === null) this.logout()
				else if (serverRole !== role) {
					localStorage.setItem(ROLE_KEY, serverRole)
					this.user = { role: serverRole }
				}
			})
			.catch((error) => console.warn('Could not re-validate the stored password:', error))
	}

	// Login function
	async login(value: string): Promise<boolean> {
		const role = await convex.query(api.auth.login, { password: value })
		if (role === null) return false

		localStorage.setItem(PASSWORD_KEY, value)
		localStorage.setItem(ROLE_KEY, role)
		this.isLoggedIn = true
		this.user = { role }
		return true
	}

	// Logout function
	logout(): void {
		localStorage.removeItem(PASSWORD_KEY)
		localStorage.removeItem(ROLE_KEY)
		this.isLoggedIn = false
		this.user = null
	}
}

export const authStore = new AuthStore()

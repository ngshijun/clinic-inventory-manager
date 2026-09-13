import type { User } from '$lib/types/auth'

/*
 * Port of the Vue auth store. It was a module-scope pair of refs rather than a
 * Pinia store, so the singleton below keeps the same "one instance for the
 * whole app" semantics — but as class fields, because `$state` loses its
 * reactivity when exported directly from a module.
 */
class AuthStore {
  isLoggedIn = $state(false)
  user = $state<User | null>(null)

  get isAuthenticated(): boolean {
    return this.isLoggedIn
  }

  // Initialize from localStorage
  initAuth(): void {
    const password = localStorage.getItem('password')
    if (password === import.meta.env.VITE_MANAGER_PASSWORD) {
      this.isLoggedIn = true
      this.user = { role: 'manager' }
    } else if (password === import.meta.env.VITE_REQUESTER_PASSWORD) {
      this.isLoggedIn = true
      this.user = { role: 'requester' }
    }
  }

  // Login function
  login(value: string): boolean {
    if (value === import.meta.env.VITE_MANAGER_PASSWORD) {
      localStorage.setItem('password', value)
      this.isLoggedIn = true
      this.user = { role: 'manager' }
    } else if (value === import.meta.env.VITE_REQUESTER_PASSWORD) {
      localStorage.setItem('password', value)
      this.isLoggedIn = true
      this.user = { role: 'requester' }
    } else {
      return false
    }
    return true
  }

  // Logout function
  logout(): void {
    localStorage.removeItem('password')
    this.isLoggedIn = false
    this.user = null
  }
}

export const authStore = new AuthStore()

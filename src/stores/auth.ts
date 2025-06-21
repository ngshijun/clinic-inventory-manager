import { ref, computed } from 'vue'

const isLoggedIn = ref(false)

// Initialize from localStorage
const initAuth = () => {
  isLoggedIn.value = localStorage.getItem('password') === import.meta.env.VITE_PASSWORD
}

// Login function
const login = (value: string) => {
  localStorage.setItem('password', value)
  isLoggedIn.value = true
}

// Logout function
const logout = () => {
  localStorage.removeItem('password')
  isLoggedIn.value = false
}

// Computed for authentication status
const isAuthenticated = computed(() => isLoggedIn.value)

export const useAuthStore = () => {
  return {
    isAuthenticated,
    login,
    logout,
    initAuth
  }
}
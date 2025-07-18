import { ref, computed } from 'vue'
import type { User } from '@/types/auth'

const isLoggedIn = ref(false)
const user = ref<User | null>(null)

// Initialize from localStorage
const initAuth = () => {
  const password = localStorage.getItem('password')
  if (password === import.meta.env.VITE_MANAGER_PASSWORD) {
      isLoggedIn.value = true
      user.value = {
        role: 'manager'
      }
  } else if (password === import.meta.env.VITE_REQUESTER_PASSWORD) {
    isLoggedIn.value = true
      user.value = {
        role: 'requester'
      }
  }
}

// Login function
const login = (value: string): boolean => {
  if (value === import.meta.env.VITE_MANAGER_PASSWORD) {
    localStorage.setItem('password', value)
    isLoggedIn.value = true
    user.value = {
      role: 'manager'
    }
  } else if (value === import.meta.env.VITE_REQUESTER_PASSWORD) {
    localStorage.setItem('password', value)
    isLoggedIn.value = true
    user.value = {
      role: 'requester'
    }
  } else {
    return false
  }
  return true
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
    user,
    login,
    logout,
    initAuth
  }
}

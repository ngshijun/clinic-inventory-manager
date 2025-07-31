<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <!-- Only show navigation if user is authenticated -->
    <nav v-if="isAuthenticated" class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div class="flex justify-between h-14 sm:h-16">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <h1 class="text-lg sm:text-xl font-bold text-gray-900">
                <span class="block sm:hidden">Inventory</span>
                <span class="hidden sm:block">Inventory Manager</span>
              </h1>
            </div>
          </div>

          <!-- Mobile menu button -->
          <div class="sm:hidden flex items-center space-x-2">
            <!-- Logout button for mobile -->
            <button
              @click="handleLogout"
              class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500"
              title="Logout"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                ></path>
              </svg>
            </button>

            <button
              @click="mobileMenuOpen = !mobileMenuOpen"
              class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  v-if="!mobileMenuOpen"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                ></path>
                <path
                  v-else
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>

          <!-- Desktop Navigation -->
          <div class="hidden sm:flex sm:items-center sm:space-x-8">
            <div class="flex space-x-8">
              <router-link
                v-if="user && user.role === 'manager'"
                to="/dashboard"
                class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                :class="
                  $route.name === 'DashBoard'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                "
              >
                Dashboard
              </router-link>
              <router-link
                v-if="user && user.role === 'manager'"
                to="/inventory"
                class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                :class="
                  $route.name === 'Inventory'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                "
              >
                Inventory
              </router-link>
              <router-link
                v-if="user && user.role === 'manager'"
                to="/price-list"
                class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                :class="
                  $route.name === 'PriceList'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                "
              >
                Price List
              </router-link>
              <router-link
                v-if="user && user.role === 'manager'"
                to="/stock-movements"
                class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                :class="
                  $route.name === 'StockMovements'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                "
              >
                Stock Movements
              </router-link>
              <router-link
                v-if="user && user.role === 'requester'"
                to="/stock-requests"
                class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                :class="
                  $route.name === 'StockRequests'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                "
              >
                Stock Requests
              </router-link>
              <router-link
                v-if="user && user.role === 'manager'"
                to="/stock-approvals"
                class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                :class="
                  $route.name === 'StockApprovals'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                "
              >
                Stock Approvals
                <span
                  v-if="pendingRequestsCount > 0"
                  class="ml-2 inline-flex items-center justify-center px-2 py-1 m-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full"
                >
                  {{ pendingRequestsCount }}
                </span>
              </router-link>
            </div>

            <!-- Logout button for desktop -->
            <button
              @click="handleLogout"
              class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                ></path>
              </svg>
              Logout
            </button>
          </div>
        </div>

        <!-- Mobile Navigation Menu -->
        <div v-show="mobileMenuOpen" class="sm:hidden">
          <div class="pt-2 pb-3 space-y-1">
            <router-link
              v-if="user && user.role === 'manager'"
              to="/dashboard"
              @click="mobileMenuOpen = false"
              class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
              :class="
                $route.name === 'DashBoard'
                  ? 'border-blue-500 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300'
              "
            >
              Dashboard
            </router-link>
            <router-link
              v-if="user && user.role === 'manager'"
              to="/inventory"
              @click="mobileMenuOpen = false"
              class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
              :class="
                $route.name === 'Inventory'
                  ? 'border-blue-500 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300'
              "
            >
              Inventory
            </router-link>
            <router-link
              v-if="user && user.role === 'manager'"
              to="/price-list"
              @click="mobileMenuOpen = false"
              class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
              :class="
                $route.name === 'PriceList'
                  ? 'border-blue-500 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300'
              "
            >
              Price List
            </router-link>
            <router-link
              v-if="user && user.role === 'manager'"
              to="/stock-movements"
              @click="mobileMenuOpen = false"
              class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
              :class="
                $route.name === 'StockMovements'
                  ? 'border-blue-500 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300'
              "
            >
              Stock Movements
            </router-link>
            <router-link
              v-if="user && user.role === 'requester'"
              to="/stock-requests"
              @click="mobileMenuOpen = false"
              class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
              :class="
                $route.name === 'StockRequests'
                  ? 'border-blue-500 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300'
              "
            >
              Stock Requests
            </router-link>
            <router-link
              v-if="user && user.role === 'manager'"
              to="/stock-approvals"
              @click="mobileMenuOpen = false"
              class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
              :class="
                $route.name === 'StockApprovals'
                  ? 'border-blue-500 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300'
              "
            >
              Stock Approvals
            </router-link>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto py-3 sm:py-6 px-2 sm:px-6 lg:px-8">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useInventoryStore } from './stores/inventory'
import { useStockMovementsStore } from './stores/stockMovements'
import { useStockRequestsStore } from './stores/stockRequests'

const inventoryStore = useInventoryStore()
const stockRequestsStore = useStockRequestsStore()
const stockMovementStore = useStockMovementsStore()

const router = useRouter()
const mobileMenuOpen = ref(false)
const { isAuthenticated, logout, initAuth, user } = useAuthStore()

const pendingRequestsCount = computed(() => {
  return stockRequestsStore.requests.filter((request) => request.status === 'Pending').length
})

const handleLogout = () => {
  logout()
  router.push('/')
}

// Initialize auth state and close mobile menu when clicking outside
onMounted(() => {
  initAuth()
  inventoryStore.initializeStore()
  stockMovementStore.initializeStore()
  stockRequestsStore.initializeStore()

  document.addEventListener('click', (e) => {
    const nav = document.querySelector('nav')
    if (nav && !nav.contains(e.target as Node)) {
      mobileMenuOpen.value = false
    }
  })
})
</script>

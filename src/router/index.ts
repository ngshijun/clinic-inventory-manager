import { useAuthStore } from '@/stores/auth'
import LoginPage from '@/views/LoginPage.vue'
import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Login',
    component: LoginPage,
    meta: { requiresGuest: true },
  },
  {
    path: '/dashboard',
    name: 'DashBoard',
    component: () => import('@/views/DashBoard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: () => import('@/views/InventoryPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/stock-movements',
    name: 'StockMovements',
    component: () => import('@/views/StockMovements.vue'),
    meta: { requiresAuth: true },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

const { isAuthenticated } = useAuthStore()

// Authentication guard
router.beforeEach((to, from, next) => {
  // Check if route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated) {
    // Redirect to login with return url
    next({
      name: 'Login',
      query: { redirect: to.fullPath },
    })
  }
  // Check if route is for guests only (like login page)
  else if (to.meta.requiresGuest && isAuthenticated) {
    // Redirect authenticated users away from login
    next({ name: 'DashBoard' })
  } else {
    next()
  }
})

export default router

import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import DashBoard from '@/views/DashBoard.vue'
import InventoryPage from '@/views/InventoryPage.vue'
import StockMovements from '@/views/StockMovements.vue'
import LoginPage from '@/views/LoginPage.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Login',
    component: LoginPage,
    meta: { requiresGuest: true }
  },
  {
    path: '/dashboard',
    name: 'DashBoard',
    component: DashBoard,
    meta: { requiresAuth: true }
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: InventoryPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/stock-movements',
    name: 'StockMovements',
    component: StockMovements,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Authentication guard
router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('password') === '1234'

  // Check if route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated) {
    // Redirect to login with return url
    next({
      name: 'Login',
      query: { redirect: to.fullPath }
    })
  }
  // Check if route is for guests only (like login page)
  else if (to.meta.requiresGuest && isAuthenticated) {
    // Redirect authenticated users away from login
    next({ name: 'DashBoard' })
  }
  else {
    next()
  }
})

export default router
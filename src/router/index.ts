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
    meta: { requiresAuth: true, roles: ['manager'] },
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: () => import('@/views/InventoryPage.vue'),
    meta: { requiresAuth: true, roles: ['manager'] },
  },
  {
    path: '/price-list',
    name: 'PriceList',
    component: () => import('@/views/PriceList.vue'),
    meta: { requiresAuth: true, roles: ['manager'] },
  },
  {
    path: '/stock-movements',
    name: 'StockMovements',
    component: () => import('@/views/StockMovements.vue'),
    meta: { requiresAuth: true, roles: ['manager'] },
  },
  {
    path: '/stock-approvals',
    name: 'StockApprovals',
    component: () => import('@/views/StockApprovals.vue'),
    meta: { requiresAuth: true, roles: ['manager'] },
  },
  {
    path: '/stock-requests',
    name: 'StockRequests',
    component: () => import('@/views/StockRequests.vue'),
    meta: { requiresAuth: true, roles: ['requester'] },
  },
  {
    path: '/payroll',
    name: 'PayrollPage',
    component: () => import('@/views/PayrollPage.vue'),
    meta: { requiresAuth: true, roles: ['manager'] },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

const { isAuthenticated, user } = useAuthStore()

// Authentication guard
router.beforeEach((to, from, next) => {
  // Check if route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    // Redirect to login with return url
    next({
      name: 'Login',
      query: { redirect: to.fullPath },
    })
  }
  // Check if route is for guests only (like login page)
  else if (to.meta.requiresGuest && isAuthenticated.value) {
    // Redirect authenticated users away from login
    if (user.value && user.value.role === 'manager') {
      next({ name: 'DashBoard' })
    } else if (user.value && user.value.role === 'requester') {
      next({ name: 'StockRequests' })
    } else {
      next()
    }
  }
  // Check role-based access for authenticated users
  else if (to.meta.requiresAuth && isAuthenticated.value) {
    if (
      user.value &&
      user.value.role === 'manager' &&
      Array.isArray(to.meta.roles) &&
      !to.meta.roles.includes('manager')
    ) {
      next({ name: 'DashBoard' })
    } else if (
      user.value &&
      user.value.role === 'requester' &&
      Array.isArray(to.meta.roles) &&
      !to.meta.roles.includes('requester')
    ) {
      next({ name: 'StockRequests' })
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router

import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import DashBoard from '@/views/DashBoard.vue'
import Inventory from '@/views/Inventory.vue'
import StockMovements from '@/views/StockMovements.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'DashBoard',
    component: DashBoard
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: Inventory
  },
  {
    path: '/stock-movements',
    name: 'StockMovements',
    component: StockMovements
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router

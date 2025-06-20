import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import DashBoard from '@/views/DashBoard.vue'
import Inventory from '@/views/Inventory.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Dashboard',
    component: DashBoard
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: Inventory
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router

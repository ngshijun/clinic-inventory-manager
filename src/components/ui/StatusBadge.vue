<template>
  <span :class="['inline-flex px-2 py-1 text-xs font-semibold rounded-full', variantClass]">
    <slot>{{ text }}</slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface StatusBadgeProps {
  variant?:
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'gray'
    | 'stock-in'
    | 'stock-out'
    | 'pending'
    | 'approved'
    | 'cancelled'
    | 'in-stock'
    | 'low-stock'
    | 'out-of-stock'
  text?: string
  size?: 'xs' | 'sm' | 'md'
  rounded?: boolean
}

const props = withDefaults(defineProps<StatusBadgeProps>(), {
  variant: 'info',
  size: 'sm',
  rounded: true,
})

const variantClass = computed(() => {
  const variants = {
    // Basic variants
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    gray: 'bg-gray-100 text-gray-800',

    // Status-specific variants
    'stock-in': 'bg-green-100 text-green-800',
    'stock-out': 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',

    // Inventory status variants
    'in-stock': 'bg-green-100 text-green-800',
    'low-stock': 'bg-yellow-100 text-yellow-800',
    'out-of-stock': 'bg-red-100 text-red-800',
  }

  return variants[props.variant]
})
</script>

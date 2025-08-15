<template>
  <span :class="['inline-flex px-2 py-1 text-xs font-semibold rounded-full', variantClass]">
    <slot>{{ text }}</slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface StatusBadgeProps {
  variant?: 'green' | 'yellow' | 'red' | 'blue' | 'gray'
  text?: string
  size?: 'xs' | 'sm' | 'md'
  rounded?: boolean
}

const props = withDefaults(defineProps<StatusBadgeProps>(), {
  variant: 'blue',
  size: 'sm',
  rounded: true,
})

const variantClass = computed(() => {
  const variants = {
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
    gray: 'bg-gray-100 text-gray-800',
  }

  return variants[props.variant]
})
</script>

<template>
  <div class="text-center py-6 sm:py-8">
    <div
      :class="['inline-block animate-spin rounded-full border-b-2 border-blue-600', sizeClasses]"
    ></div>
    <p v-if="message" :class="['mt-2 text-gray-600', textSizeClasses]">
      {{ message }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface LoadingSpinnerProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<LoadingSpinnerProps>(), {
  size: 'md',
})

const sizeClasses = computed(() => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8 sm:h-8 sm:w-8',
  }
  return sizes[props.size]
})

const textSizeClasses = computed(() => {
  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-sm sm:text-base',
  }
  return textSizes[props.size]
})
</script>

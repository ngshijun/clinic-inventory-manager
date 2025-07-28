<template>
  <div :class="['border border-red-200 rounded-md p-4', backgroundClass]">
    <div class="flex">
      <div class="flex-shrink-0">
        <svg :class="iconClass" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
      <div class="ml-3">
        <h3 :class="titleClass">
          {{ title }}
        </h3>
        <p :class="messageClass">
          {{ message }}
        </p>
        <div v-if="$slots.default" class="mt-2">
          <slot />
        </div>
      </div>
      <div v-if="dismissible" class="ml-auto pl-3">
        <div class="-mx-1.5 -my-1.5">
          <button
            @click="$emit('dismiss')"
            :class="[
              'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2',
              dismissButtonClass,
            ]"
          >
            <span class="sr-only">Dismiss</span>
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface ErrorAlertProps {
  title?: string
  message: string
  variant?: 'error' | 'warning'
  dismissible?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<ErrorAlertProps>(), {
  title: 'Error',
  variant: 'error',
  dismissible: false,
  size: 'md',
})

defineEmits<{
  dismiss: []
}>()

const backgroundClass = computed(() => {
  const backgrounds = {
    error: 'bg-red-50',
    warning: 'bg-yellow-50',
  }
  return backgrounds[props.variant]
})

const iconClass = computed(() => {
  const iconColors = {
    error: 'text-red-400',
    warning: 'text-yellow-400',
  }
  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-5 w-5 sm:h-6 sm:w-6',
  }
  return `${iconColors[props.variant]} ${iconSizes[props.size]}`
})

const titleClass = computed(() => {
  const titleColors = {
    error: 'text-red-800',
    warning: 'text-yellow-800',
  }
  const titleSizes = {
    sm: 'text-xs font-medium',
    md: 'text-sm font-medium',
    lg: 'text-sm sm:text-base font-medium',
  }
  return `${titleColors[props.variant]} ${titleSizes[props.size]}`
})

const messageClass = computed(() => {
  const messageColors = {
    error: 'text-red-700',
    warning: 'text-yellow-700',
  }
  const messageSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-sm sm:text-base',
  }
  return `mt-1 ${messageColors[props.variant]} ${messageSizes[props.size]}`
})

const dismissButtonClass = computed(() => {
  const buttonColors = {
    error: 'text-red-400 hover:bg-red-100 focus:ring-red-600 focus:ring-offset-red-50',
    warning:
      'text-yellow-400 hover:bg-yellow-100 focus:ring-yellow-600 focus:ring-offset-yellow-50',
  }
  return buttonColors[props.variant]
})
</script>

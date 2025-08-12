<template>
  <div :class="['border border-red-200 rounded-md p-4', backgroundClass]">
    <div class="flex">
      <div class="flex-shrink-0">
        <ExclamationCircleIcon :class="iconClass" />
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
            <CloseIcon class="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CloseIcon from '@/components/icons/CloseIcon.vue'
import ExclamationCircleIcon from '@/components/icons/ExclamationCircleIcon.vue'

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

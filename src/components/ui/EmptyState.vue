<template>
  <div :class="['text-center', paddingClass]">
    <component :is="iconComponent" />
    <h3 :class="titleClass">{{ title }}</h3>
    <p :class="descriptionClass">{{ description }}</p>
    <div v-if="actionText || $slots.action" class="mt-4">
      <slot name="action">
        <button
          v-if="actionText"
          @click="$emit('action')"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {{ actionText }}
        </button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface EmptyStateProps {
  icon?: 'box' | 'document' | 'chart' | 'search' | 'custom'
  title: string
  description: string
  actionText?: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<EmptyStateProps>(), {
  icon: 'box',
  size: 'md',
})

defineEmits<{
  action: []
}>()

const paddingClass = computed(() => {
  const paddings = {
    sm: 'py-8',
    md: 'py-12',
    lg: 'py-16',
  }
  return paddings[props.size]
})

const titleClass = computed(() => {
  const titleSizes = {
    sm: 'mt-2 text-xs font-medium text-gray-900',
    md: 'mt-2 text-sm font-medium text-gray-900',
    lg: 'mt-2 text-base font-medium text-gray-900',
  }
  return titleSizes[props.size]
})

const descriptionClass = computed(() => {
  const descriptionSizes = {
    sm: 'mt-1 text-xs text-gray-500',
    md: 'mt-1 text-sm text-gray-500',
    lg: 'mt-1 text-base text-gray-500',
  }
  return descriptionSizes[props.size]
})

const iconComponent = computed(() => {
  const iconSizes = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  }
  const iconSize = iconSizes[props.size]

  const icons = {
    box: () => `<svg class="mx-auto ${iconSize} text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>`,

    document:
      () => `<svg class="mx-auto ${iconSize} text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>`,

    chart:
      () => `<svg class="mx-auto ${iconSize} text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>`,

    search:
      () => `<svg class="mx-auto ${iconSize} text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>`,

    custom: () => '',
  }

  if (props.icon === 'custom') {
    return 'div'
  }

  return {
    template: icons[props.icon](),
  }
})
</script>

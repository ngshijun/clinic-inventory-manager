<template>
  <div :class="['text-center', paddingClass]">
    <component :is="iconComponent" :class="iconClass" />
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
import BoxIcon from '@/components/icons/BoxIcon.vue'
import ChartIcon from '@/components/icons/ChartIcon.vue'
import DocumentIcon from '@/components/icons/DocumentIcon.vue'
import SearchIcon from '@/components/icons/SearchIcon.vue'

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

const iconClass = computed(() => {
  const iconSizes = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  }
  return `mx-auto ${iconSizes[props.size]} text-gray-400`
})

const iconComponent = computed(() => {
  const iconComponents = {
    box: BoxIcon,
    document: DocumentIcon,
    chart: ChartIcon,
    search: SearchIcon,
    custom: 'div',
  }
  return iconComponents[props.icon]
})
</script>

<template>
  <div class="px-4 py-4">
    <div class="space-y-3">
      <!-- Card Header -->
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-gray-900 truncate flex-1 mr-2">
          {{ title }}
        </h4>
        <div v-if="badge" class="flex-shrink-0">
          <StatusBadge 
            :variant="badge.variant" 
            :text="badge.text"
            size="sm"
          />
        </div>
      </div>

      <!-- Card Subtitle -->
      <div v-if="subtitle" class="text-sm text-gray-600">
        {{ subtitle }}
      </div>

      <!-- Card Content -->
      <div class="space-y-2">
        <slot />
      </div>

      <!-- Card Actions -->
      <div v-if="actions && actions.length > 0" class="flex flex-row gap-2 mt-3 flex-wrap">
        <button
          v-for="action in actions"
          :key="action.key"
          @click="handleActionClick(action.key)"
          :class="getActionButtonClasses(action.variant)"
          class="flex-1 text-sm font-medium px-3 py-1 rounded transition-colors"
        >
          {{ action.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import StatusBadge from './StatusBadge.vue'

interface MobileCardAction {
  key: string
  label: string
  variant: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'
}

interface MobileCardBadge {
  variant: string
  text: string
}

interface MobileCardProps {
  title: string
  subtitle?: string
  badge?: MobileCardBadge
  actions?: MobileCardAction[]
}

defineProps<MobileCardProps>()

const emit = defineEmits<{
  'action-click': [actionKey: string]
}>()

// Get action button classes based on variant
const getActionButtonClasses = (variant: string): string => {
  switch (variant) {
    case 'primary':
      return 'text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100'
    case 'secondary':
      return 'text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100'
    case 'success':
      return 'text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100'
    case 'warning':
      return 'text-orange-600 hover:text-orange-900 bg-orange-50 hover:bg-orange-100'
    case 'danger':
      return 'text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100'
    case 'info':
      return 'text-cyan-600 hover:text-cyan-900 bg-cyan-50 hover:bg-cyan-100'
    default:
      return 'text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100'
  }
}

// Handle action click
const handleActionClick = (actionKey: string) => {
  emit('action-click', actionKey)
}
</script>
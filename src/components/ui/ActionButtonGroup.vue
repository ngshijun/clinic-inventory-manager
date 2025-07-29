<template>
  <div :class="containerClasses">
    <button
      v-for="action in actions"
      :key="action.key"
      @click="handleActionClick(action.key)"
      :disabled="loading || action.disabled"
      :class="getButtonClasses(action.variant)"
      :title="action.label"
    >
      <!-- Icon if provided -->
      <svg
        v-if="action.icon"
        class="w-4 h-4 mr-1"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <!-- Add icon paths based on action.icon type if needed -->
        <path
          v-if="action.icon === 'edit'"
          d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
        />
        <path
          v-else-if="action.icon === 'delete'"
          d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z M4 5a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zm2 3a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 112 0v6a1 1 0 11-2 0V8z"
        />
        <path
          v-else-if="action.icon === 'check'"
          fill-rule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clip-rule="evenodd"
        />
      </svg>
      
      {{ action.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface ActionButtonGroupAction {
  key: string
  label: string
  variant: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'info'
  icon?: string
  disabled?: boolean
}

interface ActionButtonGroupProps {
  actions: ActionButtonGroupAction[]
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  layout?: 'horizontal' | 'vertical'
}

const props = withDefaults(defineProps<ActionButtonGroupProps>(), {
  loading: false,
  size: 'md',
  layout: 'horizontal'
})

const emit = defineEmits<{
  'action-click': [actionKey: string]
}>()

// Container classes based on layout and size
const containerClasses = computed(() => {
  const baseClasses = 'flex'
  const layoutClasses = props.layout === 'horizontal' ? 'flex-row gap-x-2' : 'flex-col gap-y-2'
  
  return `${baseClasses} ${layoutClasses}`
})

// Get button classes based on variant and size
const getButtonClasses = (variant: string): string => {
  const sizeClasses = getSizeClasses()
  const variantClasses = getVariantClasses(variant)
  const baseClasses = 'font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  
  return `${baseClasses} ${sizeClasses} ${variantClasses}`
}

const getSizeClasses = (): string => {
  switch (props.size) {
    case 'sm':
      return 'px-2 py-1 text-xs rounded'
    case 'lg':
      return 'px-4 py-2 text-base rounded-md'
    default:
      return 'px-3 py-1 text-sm rounded'
  }
}

const getVariantClasses = (variant: string): string => {
  switch (variant) {
    case 'primary':
      return 'bg-blue-600 hover:bg-blue-700 text-white'
    case 'secondary':
      return 'text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100'
    case 'success':
      return 'bg-green-600 hover:bg-green-700 text-white'
    case 'warning':
      return 'bg-orange-600 hover:bg-orange-700 text-white'
    case 'danger':
      return 'bg-red-600 hover:bg-red-700 text-white'
    case 'info':
      return 'text-blue-600 hover:text-blue-900'
    default:
      return 'text-gray-600 hover:text-gray-900'
  }
}

// Handle action click
const handleActionClick = (actionKey: string) => {
  if (!props.loading) {
    emit('action-click', actionKey)
  }
}
</script>
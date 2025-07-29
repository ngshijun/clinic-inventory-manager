<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
    @click="handleBackdropClick"
    @keydown.esc="handleEscape"
  >
    <div 
      class="p-5 border w-96 shadow-lg rounded-md bg-white" 
      @click.stop
      role="dialog"
      :aria-labelledby="titleId"
      aria-modal="true"
    >
      <div class="mt-3">
        <!-- Modal Header -->
        <h3 :id="titleId" class="text-lg font-medium text-gray-900 mb-4">
          {{ title }}
        </h3>

        <!-- Modal Body -->
        <div class="space-y-4">
          <slot />
        </div>

        <!-- Modal Footer -->
        <div class="flex justify-end gap-3 mt-6">
          <button
            type="button"
            @click="handleCancel"
            class="px-4 py-2 bg-gray-600 rounded-md text-sm font-medium text-white hover:bg-gray-700 transition-colors"
            :disabled="loading"
          >
            {{ cancelText }}
          </button>
          <button
            type="button"
            @click="handleConfirm"
            :class="confirmButtonClasses"
            :disabled="loading"
          >
            {{ loading ? loadingText : confirmText }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'

interface ActionModalProps {
  isOpen: boolean
  title: string
  variant?: 'create' | 'edit' | 'delete' | 'approve' | 'reject'
  loading?: boolean
  confirmText?: string
  cancelText?: string
}

const props = withDefaults(defineProps<ActionModalProps>(), {
  variant: 'create',
  loading: false,
  confirmText: 'Confirm',
  cancelText: 'Cancel',
})

const emit = defineEmits<{
  close: []
  confirm: []
  cancel: []
}>()

// Generate unique ID for accessibility
const titleId = computed(() => `modal-title-${Math.random().toString(36).substr(2, 9)}`)

// Compute loading text based on variant
const loadingText = computed(() => {
  switch (props.variant) {
    case 'create':
      return 'Creating...'
    case 'edit':
      return 'Updating...'
    case 'delete':
      return 'Deleting...'
    case 'approve':
      return 'Approving...'
    case 'reject':
      return 'Rejecting...'
    default:
      return 'Processing...'
  }
})

// Compute button classes based on variant
const confirmButtonClasses = computed(() => {
  const baseClasses = 'px-4 py-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50'
  
  switch (props.variant) {
    case 'delete':
    case 'reject':
      return `${baseClasses} bg-red-600 hover:bg-red-700`
    case 'approve':
      return `${baseClasses} bg-green-600 hover:bg-green-700`
    case 'create':
      return `${baseClasses} bg-blue-600 hover:bg-blue-700`
    case 'edit':
      return `${baseClasses} bg-orange-600 hover:bg-orange-700`
    default:
      return `${baseClasses} bg-blue-600 hover:bg-blue-700`
  }
})

// Modal event handlers
const handleConfirm = () => {
  if (!props.loading) {
    emit('confirm')
  }
}

const handleCancel = () => {
  if (!props.loading) {
    emit('cancel')
  }
}

const handleBackdropClick = () => {
  if (!props.loading) {
    emit('close')
  }
}

const handleEscape = () => {
  if (!props.loading) {
    emit('close')
  }
}

// Focus trap functionality
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    handleEscape()
  }
}

onMounted(() => {
  if (props.isOpen) {
    document.addEventListener('keydown', handleKeydown)
    document.body.style.overflow = 'hidden'
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})

// Watch for isOpen changes to manage body scroll
import { watch } from 'vue'
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    document.addEventListener('keydown', handleKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
  }
})
</script>
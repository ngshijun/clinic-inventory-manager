<template>
  <div :class="containerClasses">
    <!-- Regular Button or Dropdown -->
    <div
      v-for="action in actions"
      :key="action.key"
      :class="action.dropdown ? 'relative inline-block text-left' : ''"
    >
      <!-- Regular Button -->
      <button
        v-if="!action.dropdown"
        type="button"
        @click="handleActionClick(action.key)"
        :disabled="loading || action.disabled"
        :class="getButtonClasses(action.variant) + ' flex items-center justify-center'"
        :title="action.label"
      >
        <!-- Icon if provided -->
        <svg v-if="action.icon" class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
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

      <!-- Dropdown Button -->
      <button
        v-else
        type="button"
        @click="toggleDropdown(action.key)"
        :disabled="loading || action.disabled"
        :class="getButtonClasses(action.variant) + ' flex items-center justify-center'"
        :title="action.label"
      >
        <span class="flex items-center">
          {{ action.label }}
          <svg
            class="w-3 h-3 ml-1 flex-shrink-0"
            :class="{
              'transform rotate-180': openDropdown === action.key,
            }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </span>
      </button>

      <!-- Dropdown Menu -->
      <div v-if="action.dropdown && openDropdown === action.key" :class="getDropdownClasses()">
        <div class="py-1 flex flex-col">
          <template v-for="(item, idx) in action.dropdown" :key="item.key">
            <button
              type="button"
              @click="handleDropdownItemClick(item.key)"
              :class="[
                'w-full text-left px-3 py-2 text-xs flex items-center gap-2',
                item.key === 'mark-ordered'
                  ? 'text-gray-900 font-semibold hover:bg-gray-100'
                  : 'text-gray-700 hover:bg-gray-100',
              ]"
            >
              <span>{{ item.label }}</span>
            </button>
            <div
              v-if="item.key === 'mark-ordered' && idx < action.dropdown.length - 1"
              class="my-1 border-t border-gray-200"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

interface DropdownItem {
  key: string
  label: string
}

interface ActionButtonGroupAction {
  key: string
  label: string
  variant: 'blue' | 'gray' | 'red' | 'green' | 'yellow' | 'cyan' | 'orange'
  icon?: string
  disabled?: boolean
  dropdown?: DropdownItem[]
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
  layout: 'horizontal',
})

const emit = defineEmits<{
  'action-click': [actionKey: string]
}>()

// Dropdown state
const openDropdown = ref<string | null>(null)

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
  const baseClasses =
    'font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap'

  return `${baseClasses} ${sizeClasses} ${variantClasses}`
}

const getSizeClasses = (): string => {
  switch (props.size) {
    case 'sm':
      return 'px-3 py-2 text-xs rounded flex-1 sm:flex-none sm:px-2 sm:py-1'
    case 'lg':
      return 'px-4 py-2 text-base rounded-md flex-1 sm:flex-none'
    default:
      return 'px-3 py-2 text-sm rounded flex-1 sm:flex-none sm:py-1'
  }
}

const getVariantClasses = (variant: string): string => {
  switch (variant) {
    case 'blue':
      return 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
    case 'gray':
      return 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
    case 'green':
      return 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200'
    case 'yellow':
      return 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200'
    case 'red':
      return 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
    case 'cyan':
      return 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200'
    case 'orange':
      return 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200'
    default:
      return 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
  }
}

// Dropdown positioning
const getDropdownClasses = (): string => {
  return 'absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-max'
}

// Handle action click
const handleActionClick = (actionKey: string) => {
  if (!props.loading) {
    emit('action-click', actionKey)
  }
}

// Toggle dropdown
const toggleDropdown = (actionKey: string) => {
  if (props.loading) return

  if (openDropdown.value === actionKey) {
    openDropdown.value = null
  } else {
    openDropdown.value = actionKey
  }
}

// Handle dropdown item click
const handleDropdownItemClick = (itemKey: string) => {
  openDropdown.value = null
  emit('action-click', itemKey)
}

// Handle click outside to close dropdown
const handleClickOutside = (event: Event): void => {
  const target = event.target as HTMLElement
  if (!target.closest('.relative')) {
    openDropdown.value = null
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

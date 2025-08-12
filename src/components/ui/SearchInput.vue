<template>
  <div class="w-full sm:max-w-md">
    <label :for="inputId" class="sr-only">{{ placeholder }}</label>
    <div class="relative">
      <input
        :id="inputId"
        :value="modelValue"
        @input="updateValue"
        type="text"
        class="block w-full pl-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
        :class="{
          'pr-24': showAdvancedToggle || showClearFilters,
          'pr-10': modelValue && !showAdvancedToggle && !showClearFilters,
          'pr-3': !modelValue && !showAdvancedToggle && !showClearFilters,
        }"
        :placeholder="placeholder"
      />

      <!-- Search Icon -->
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <SearchIcon class="h-5 w-5 text-gray-400" />
      </div>

      <!-- Clear Input Button -->
      <button
        v-if="modelValue && !showAdvancedToggle && !showClearFilters"
        @click="clearInput"
        type="button"
        class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
        title="Clear search"
      >
        <CloseIcon class="h-4 w-4" />
      </button>

      <!-- Right side buttons -->
      <div
        v-if="showAdvancedToggle || showClearFilters"
        class="absolute inset-y-0 right-0 flex items-center pr-3"
      >
        <!-- Clear Input Button (when other buttons are present) -->
        <button
          v-if="modelValue"
          @click="clearInput"
          type="button"
          class="text-gray-400 hover:text-gray-600 mr-2 transition-colors"
          title="Clear search"
        >
          <CloseIcon class="h-4 w-4" />
        </button>

        <!-- Clear Filters Button -->
        <button
          v-if="showClearFilters && hasActiveFilters"
          @click="$emit('clear-filters')"
          type="button"
          class="text-xs text-gray-500 hover:text-gray-700 mr-2 px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          title="Clear all filters"
        >
          Clear
        </button>

        <!-- Advanced Search Toggle -->
        <button
          v-if="showAdvancedToggle"
          @click="$emit('toggle-advanced')"
          type="button"
          class="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          title="Toggle advanced search"
        >
          Advanced
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SearchIcon from '@/components/icons/SearchIcon.vue'
import CloseIcon from '@/components/icons/CloseIcon.vue'

interface SearchInputProps {
  modelValue: string
  placeholder?: string
  showAdvancedToggle?: boolean
  showClearFilters?: boolean
  hasActiveFilters?: boolean
}

withDefaults(defineProps<SearchInputProps>(), {
  placeholder: 'Search...',
  showAdvancedToggle: false,
  showClearFilters: false,
  hasActiveFilters: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'toggle-advanced': []
  'clear-filters': []
}>()

// Generate unique ID for accessibility
const inputId = computed(() => `search-input-${Math.random().toString(36).substring(2, 11)}`)

const updateValue = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

const clearInput = () => {
  emit('update:modelValue', '')
}
</script>

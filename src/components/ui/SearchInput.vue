<template>
  <div class="w-full sm:max-w-md">
    <label :for="inputId" class="sr-only">{{ placeholder }}</label>
    <div class="relative">
      <input
        :id="inputId"
        :value="modelValue"
        @input="updateValue"
        type="text"
        class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
        :class="{ 'pr-24': showAdvancedToggle || showClearFilters }"
        :placeholder="placeholder"
      />
      
      <!-- Search Icon -->
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg
          class="h-5 w-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <!-- Right side buttons -->
      <div v-if="showAdvancedToggle || showClearFilters" class="absolute inset-y-0 right-0 flex items-center pr-3">
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
</script>
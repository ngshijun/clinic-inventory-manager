<template>
  <div class="space-y-2">
    <!-- Text Input -->
    <input
      v-if="fieldType === 'text'"
      :value="modelValue"
      @input="updateValue"
      type="text"
      :placeholder="placeholder"
      :disabled="loading"
      class="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100"
    />

    <!-- Number Input -->
    <input
      v-else-if="fieldType === 'number'"
      :value="modelValue"
      @input="updateValue"
      type="number"
      :placeholder="placeholder"
      :disabled="loading"
      class="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100"
    />

    <!-- Textarea -->
    <textarea
      v-else-if="fieldType === 'textarea'"
      :value="modelValue"
      @input="updateValue"
      rows="3"
      :placeholder="placeholder"
      :disabled="loading"
      class="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100 resize-vertical"
    ></textarea>

    <!-- Select -->
    <select
      v-else-if="fieldType === 'select'"
      :value="modelValue"
      @change="updateValue"
      :disabled="loading"
      class="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100"
    >
      <option value="" disabled>{{ placeholder || 'Select an option' }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>

    <!-- Action Buttons -->
    <div class="flex gap-2">
      <button
        @click="handleSave"
        :disabled="loading"
        class="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
      >
        {{ loading ? 'Saving...' : 'Save' }}
      </button>
      <button
        @click="handleCancel"
        :disabled="loading"
        class="flex-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
      >
        Cancel
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface InlineEditFormOption {
  value: string | number
  label: string
}

interface InlineEditFormProps {
  modelValue: string | number
  fieldType: 'text' | 'number' | 'textarea' | 'select'
  options?: InlineEditFormOption[]
  placeholder?: string
  loading?: boolean
}

const props = withDefaults(defineProps<InlineEditFormProps>(), {
  loading: false,
  placeholder: '',
  options: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  save: []
  cancel: []
}>()

// Update model value
const updateValue = (event: Event) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

  if (props.fieldType === 'number') {
    const numValue = parseFloat(target.value)
    emit('update:modelValue', isNaN(numValue) ? 0 : numValue)
  } else {
    emit('update:modelValue', target.value)
  }
}

// Handle save action
const handleSave = () => {
  if (!props.loading) {
    emit('save')
  }
}

// Handle cancel action
const handleCancel = () => {
  if (!props.loading) {
    emit('cancel')
  }
}
</script>

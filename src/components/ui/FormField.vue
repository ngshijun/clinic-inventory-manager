<template>
  <div class="space-y-1">
    <!-- Label -->
    <label
      :for="fieldId"
      class="block text-sm font-medium text-gray-700"
      :class="{ 'after:content-[\'*\'] after:text-red-500 after:ml-1': required }"
    >
      {{ label }}
    </label>

    <!-- Text Input -->
    <input
      v-if="type === 'text'"
      :id="fieldId"
      :value="modelValue || ''"
      @input="updateValue"
      type="text"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :class="[
        'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
        error ? 'border-red-300' : 'border-gray-300',
        disabled ? 'bg-gray-100 text-gray-500' : '',
      ]"
    />

    <!-- Password Input -->
    <input
      v-else-if="type === 'password'"
      :id="fieldId"
      :value="modelValue || ''"
      @input="updateValue"
      type="password"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :class="[
        'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
        error ? 'border-red-300' : 'border-gray-300',
        disabled ? 'bg-gray-100 text-gray-500' : '',
      ]"
    />

    <!-- Number Input -->
    <input
      v-else-if="type === 'number'"
      :id="fieldId"
      :value="modelValue || ''"
      @input="updateValue"
      type="number"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :min="min"
      :max="max"
      :step="step"
      :class="[
        'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
        error ? 'border-red-300' : 'border-gray-300',
        disabled ? 'bg-gray-100 text-gray-500' : '',
      ]"
    />

    <!-- Date Input -->
    <input
      v-else-if="type === 'date'"
      :id="fieldId"
      :value="modelValue || ''"
      @input="updateValue"
      type="date"
      :required="required"
      :disabled="disabled"
      :class="[
        'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
        error ? 'border-red-300' : 'border-gray-300',
        disabled ? 'bg-gray-100 text-gray-500' : '',
      ]"
    />

    <!-- Textarea -->
    <textarea
      v-else-if="type === 'textarea'"
      :id="fieldId"
      :value="modelValue || ''"
      @input="updateValue"
      :rows="rows || 3"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :class="[
        'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical',
        error ? 'border-red-300' : 'border-gray-300',
        disabled ? 'bg-gray-100 text-gray-500' : '',
      ]"
    ></textarea>

    <!-- Select -->
    <select
      v-else-if="type === 'select'"
      :id="fieldId"
      :value="modelValue || ''"
      @change="updateValue"
      :required="required"
      :disabled="disabled"
      :class="[
        'w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
        error ? 'border-red-300' : 'border-gray-300',
        disabled ? 'bg-gray-100 text-gray-500' : '',
      ]"
    >
      <option value="" disabled>{{ placeholder || 'Select an option' }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>

    <!-- Error Message -->
    <p v-if="error" class="text-sm text-red-600">
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface FormFieldOption {
  value: string | number
  label: string
}

interface FormFieldProps {
  label: string
  modelValue: string | number | undefined
  type: 'text' | 'number' | 'select' | 'textarea' | 'date' | 'password'
  required?: boolean
  error?: string
  options?: FormFieldOption[]
  placeholder?: string
  disabled?: boolean
  min?: number
  max?: number
  step?: number | string
  rows?: number
}

const props = withDefaults(defineProps<FormFieldProps>(), {
  required: false,
  error: '',
  options: () => [],
  placeholder: '',
  disabled: false,
  min: undefined,
  max: undefined,
  step: undefined,
  rows: 3,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | undefined]
}>()

// Generate unique field ID for accessibility
const fieldId = computed(() => `form-field-${Math.random().toString(36).substring(2, 11)}`)

// Update model value
const updateValue = (event: Event) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

  if (props.type === 'number') {
    const numValue = parseFloat(target.value)
    emit('update:modelValue', isNaN(numValue) ? 0 : numValue)
  } else {
    emit('update:modelValue', target.value)
  }
}
</script>

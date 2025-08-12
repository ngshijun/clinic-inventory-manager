<template>
  <span class="inline-flex items-center gap-1.5" :class="meta.colorClass">
    <svg
      class="flex-shrink-0"
      :class="iconSizeClass + ' ' + meta.colorClass"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        v-if="meta.icon === 'tick'"
        fill-rule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clip-rule="evenodd"
      />
      <path
        v-else-if="meta.icon === 'clock'"
        fill-rule="evenodd"
        d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 9V6a1 1 0 10-2 0v6a1 1 0 00.293.707l3 3a1 1 0 101.414-1.414L11 11z"
        clip-rule="evenodd"
      />
      <path
        v-else-if="meta.icon === 'cross'"
        fill-rule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clip-rule="evenodd"
      />
      <path
        v-else
        fill-rule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clip-rule="evenodd"
      />
    </svg>
    <slot>{{ reason }}</slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getNonOrderReasonMeta } from '@/constants/nonOrderReasons'

const props = defineProps<{
  reason: string
  size?: 'sm' | 'md'
}>()

const meta = computed(() => getNonOrderReasonMeta(props.reason))

const iconSizeClass = computed(() => (props.size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'))
</script>

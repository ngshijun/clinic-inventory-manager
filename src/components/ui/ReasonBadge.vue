<template>
  <span class="inline-flex items-center gap-1.5" :class="meta.colorClass">
    <CheckCircleIcon
      v-if="meta.icon === 'tick'"
      class="flex-shrink-0"
      :class="iconSizeClass + ' ' + meta.colorClass"
    />
    <ClockFilledIcon
      v-else-if="meta.icon === 'clock'"
      class="flex-shrink-0"
      :class="iconSizeClass + ' ' + meta.colorClass"
    />
    <CrossCircleIcon
      v-else-if="meta.icon === 'cross'"
      class="flex-shrink-0"
      :class="iconSizeClass + ' ' + meta.colorClass"
    />
    <InfoCircleIcon v-else class="flex-shrink-0" :class="iconSizeClass + ' ' + meta.colorClass" />
    <slot>{{ reason }}</slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getNonOrderReasonMeta } from '@/constants/nonOrderReasons'
import CheckCircleIcon from '@/components/icons/CheckCircleIcon.vue'
import ClockFilledIcon from '@/components/icons/ClockFilledIcon.vue'
import CrossCircleIcon from '@/components/icons/CrossCircleIcon.vue'
import InfoCircleIcon from '@/components/icons/InfoCircleIcon.vue'

const props = defineProps<{
  reason: string
  size?: 'sm' | 'md'
}>()

const meta = computed(() => getNonOrderReasonMeta(props.reason))

const iconSizeClass = computed(() => (props.size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'))
</script>

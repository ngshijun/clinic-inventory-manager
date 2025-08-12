<template>
  <thead class="bg-gray-50">
    <tr>
      <th
        v-for="column in columns"
        :key="column.key"
        :class="[
          'px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider',
          column.sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : '',
          getAlignmentClass(column.align),
        ]"
        @click="column.sortable ? handleSort(column.key) : undefined"
      >
        <div v-if="column.sortable" class="flex items-center justify-between">
          <span>{{ column.label }}</span>
          <div class="flex flex-col ml-2">
            <!-- Up Arrow -->
            <ChevronUpSolidIcon
              :class="[
                'w-3 h-3 transition-colors',
                sortConfig.key === column.key && sortConfig.direction === 'asc'
                  ? 'text-blue-600'
                  : 'text-gray-400',
              ]"
            />
            <!-- Down Arrow -->
            <ChevronDownSolidIcon
              :class="[
                'w-3 h-3 transition-colors -mt-1',
                sortConfig.key === column.key && sortConfig.direction === 'desc'
                  ? 'text-blue-600'
                  : 'text-gray-400',
              ]"
            />
          </div>
        </div>
        <span v-else>{{ column.label }}</span>
      </th>
    </tr>
  </thead>
</template>

<script setup lang="ts">
import ChevronDownSolidIcon from '@/components/icons/ChevronDownSolidIcon.vue'
import ChevronUpSolidIcon from '@/components/icons/ChevronUpSolidIcon.vue'

interface SortableTableColumn {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
}

interface SortConfig {
  key: string | null
  direction: 'asc' | 'desc'
}

interface SortableTableHeaderProps {
  columns: SortableTableColumn[]
  sortConfig: SortConfig
}

defineProps<SortableTableHeaderProps>()

const emit = defineEmits<{
  'sort-change': [key: string]
}>()

// Helper function to get alignment classes
const getAlignmentClass = (align?: 'left' | 'center' | 'right'): string => {
  switch (align) {
    case 'center':
      return 'text-center'
    case 'right':
      return 'text-right'
    default:
      return 'text-left'
  }
}

// Handle sort click
const handleSort = (key: string) => {
  emit('sort-change', key)
}
</script>

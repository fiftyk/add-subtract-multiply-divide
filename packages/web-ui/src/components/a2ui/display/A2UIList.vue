<script setup lang="ts">
import { computed } from 'vue'
import type { ListProps } from '../types.js'

const props = defineProps<{
  id: string
  props: ListProps
}>()

// 提取 items
const items = computed(() => {
  const i = props.props.items
  if (Array.isArray(i)) {
    return i
  }
  if (typeof i === 'string') {
    try {
      return JSON.parse(i)
    } catch {
      return []
    }
  }
  return []
})

// 列表类型
const listType = computed(() => {
  const t = props.props.listType
  if (t && typeof t === 'object' && 'literalString' in t) {
    return t.literalString
  }
  return 'bullet'
})

// 提取列表项文本
function getItemText(item: Record<string, unknown>): string {
  if (typeof item === 'string') return item
  if (item.text && typeof item.text === 'string') return item.text
  if (item.label && typeof item.label === 'string') return item.label
  return String(item)
}

// 提取图标（如果有）
function getItemIcon(item: Record<string, unknown>): string | null {
  if (item.icon && typeof item.icon === 'string') return item.icon
  return null
}
</script>

<template>
  <component :is="listType === 'numbered' ? 'ol' : 'ul'" class="a2ui-list" :class="[`type-${listType}`]">
    <li v-for="(item, index) in items" :key="index" class="a2ui-list-item">
      <span v-if="getItemIcon(item)" class="a2ui-list-icon">{{ getItemIcon(item) }}</span>
      <span class="a2ui-list-text">{{ getItemText(item) }}</span>
    </li>
  </component>
</template>

<style scoped>
.a2ui-list {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.a2ui-list-item {
  margin: 0.25rem 0;
  color: #374151;
}

.type-bullet {
  list-style-type: disc;
}

.type-numbered {
  list-style-type: decimal;
}

.type-none {
  list-style-type: none;
  padding-left: 0;
}

.a2ui-list-icon {
  margin-right: 0.5rem;
}

.a2ui-list-text {
  font-size: 0.875rem;
  line-height: 1.5;
}
</style>

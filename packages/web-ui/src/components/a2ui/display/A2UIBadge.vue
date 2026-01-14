<script setup lang="ts">
import { computed } from 'vue'
import type { BadgeProps } from '../types.js'

const props = defineProps<{
  id: string
  props: BadgeProps
}>()

// 提取标签文本
const label = computed(() => {
  const l = props.props.text
  if (l && typeof l === 'object' && 'literalString' in l) {
    return l.literalString
  }
  return ''
})

// 变体
const variant = computed(() => {
  const v = props.props.variant
  if (v && typeof v === 'object' && 'literalString' in v) {
    return v.literalString
  }
  return 'default'
})

// 样式类
const badgeClass = computed(() => {
  return `a2ui-badge a2ui-badge-${variant.value}`
})
</script>

<template>
  <span :class="badgeClass">
    {{ label }}
  </span>
</template>

<style scoped>
.a2ui-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 9999px;
}

.a2ui-badge-default {
  background-color: #f3f4f6;
  color: #374151;
}

.a2ui-badge-primary {
  background-color: #dbeafe;
  color: #1d4ed8;
}

.a2ui-badge-success {
  background-color: #dcfce7;
  color: #15803d;
}

.a2ui-badge-warning {
  background-color: #fef3c7;
  color: #b45309;
}

.a2ui-badge-error {
  background-color: #fee2e2;
  color: #b91c1c;
}
</style>

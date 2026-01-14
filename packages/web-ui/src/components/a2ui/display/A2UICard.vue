<script setup lang="ts">
import { computed } from 'vue'
import type { CardProps } from '../types.js'

const props = defineProps<{
  id: string
  props: CardProps
}>()

// 标题
const title = computed(() => {
  const t = props.props.title
  if (t && typeof t === 'object' && 'literalString' in t) {
    return t.literalString
  }
  return null
})

// 内容
const content = computed(() => {
  const c = props.props.content
  if (c && typeof c === 'object' && 'literalString' in c) {
    return c.literalString
  }
  return null
})

// 子项
const children = computed(() => {
  const c = props.props.children
  if (Array.isArray(c)) {
    return c
  }
  if (typeof c === 'string') {
    try {
      return JSON.parse(c)
    } catch {
      return []
    }
  }
  return []
})
</script>

<template>
  <div class="a2ui-card">
    <h3 v-if="title" class="a2ui-card-title">{{ title }}</h3>
    <div class="a2ui-card-content">
      <p v-if="content" class="a2ui-card-description">{{ content }}</p>
      <p
        v-for="(line, lineIndex) in children"
        :key="lineIndex"
        class="a2ui-card-line"
      >
        {{ line }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.a2ui-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1rem 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.a2ui-card-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.75rem 0;
}

.a2ui-card-content {
  color: #4b5563;
}

.a2ui-card-description {
  margin: 0 0 0.75rem 0;
  font-size: 0.9375rem;
  color: #374151;
  line-height: 1.5;
}

.a2ui-card-line {
  margin: 0.25rem 0;
  font-size: 0.875rem;
}
</style>

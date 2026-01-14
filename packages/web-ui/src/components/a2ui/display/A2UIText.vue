<script setup lang="ts">
import { computed } from 'vue'
import type { TextProps } from '../types.js'

const props = defineProps<{
  id: string
  props: TextProps
}>()

// 提取文本内容
const text = computed(() => {
  const t = props.props.text
  if (t && typeof t === 'object' && 'literalString' in t) {
    return t.literalString
  }
  return ''
})

// 文本变体
const variant = computed(() => {
  const v = props.props.style
  if (v && typeof v === 'object' && 'literalString' in v) {
    return v.literalString
  }
  return 'default'
})
</script>

<template>
  <component
    :is="variant === 'heading' ? 'h2' : variant === 'caption' ? 'span' : 'p'"
    class="a2ui-text"
    :class="[`variant-${variant}`]"
  >
    {{ text }}
  </component>
</template>

<style scoped>
.a2ui-text {
  margin: 0;
  padding: 0;
}

.variant-heading {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
}

.variant-body,
.variant-default {
  font-size: 1rem;
  color: #374151;
  line-height: 1.5;
}

.variant-caption {
  font-size: 0.875rem;
  color: #6b7280;
}

.variant-subheading {
  font-size: 1.125rem;
  font-weight: 500;
  color: #374151;
}

.variant-code {
  font-family: ui-monospace, monospace;
  font-size: 0.875rem;
  background-color: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}
</style>

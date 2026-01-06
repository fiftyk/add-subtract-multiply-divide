<template>
  <div class="card">
    <div v-if="props.title" class="card-title">{{ props.title }}</div>
    <div class="card-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { A2UIComponent, CardProps } from '../../../../../src/a2ui/types';
import { getProps } from '../../utils/a2ui';

const componentProp = defineProps<{
  component: A2UIComponent;
}>();

const props = computed(() => getProps<CardProps>(componentProp.component));
</script>

<style scoped>
.card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: #1a1a1a;
}
</style>

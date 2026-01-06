<template>
  <div :class="['divider', props.style === 'dashed' ? 'divider-dashed' : '']"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { A2UIComponent, DividerProps } from '../../../../../src/a2ui/types';
import { getProps } from '../../utils/a2ui';

const componentProp = defineProps<{
  component: A2UIComponent;
}>();

const props = computed(() => getProps<DividerProps>(componentProp.component));
</script>

<style scoped>
.divider { height: 1px; background: #e5e7eb; margin: 16px 0; }
.divider-dashed { background: repeating-linear-gradient(90deg, #e5e7eb 0, #e5e7eb 6px, transparent 6px, transparent 12px); height: 2px; }
</style>

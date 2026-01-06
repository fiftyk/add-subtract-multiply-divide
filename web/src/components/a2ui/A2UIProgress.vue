<template>
  <div class="progress">
    <div v-if="props.label" class="progress-label">{{ props.label }}</div>
    <div class="progress-bar">
      <div
        class="progress-fill"
        :style="{ width: `${(props.value / (props.max || 100)) * 100}%` }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { A2UIComponent, ProgressProps } from '../../../../../src/a2ui/types';
import { getProps } from '../../utils/a2ui';

const componentProp = defineProps<{
  component: A2UIComponent;
}>();

const props = computed(() => getProps<ProgressProps>(componentProp.component));
</script>

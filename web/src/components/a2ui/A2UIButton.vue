<template>
  <button
    :class="['btn', `btn-${props.variant || 'primary'}`]"
    :disabled="props.disabled"
    @click="emit('action', { name: 'click', surfaceId: '', componentId: componentProp.component.id, payload: { action: props.action } })"
  >
    {{ props.label }}
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { A2UIComponent, ButtonProps } from '../../../../../src/a2ui/types';
import { getProps } from '../../utils/a2ui';

const componentProp = defineProps<{
  component: A2UIComponent;
}>();

const props = computed(() => getProps<ButtonProps>(componentProp.component));

const emit = defineEmits<{
  action: [action: any];
}>();
</script>

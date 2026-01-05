<template>
  <button
    :class="['btn', `btn-${component.props.variant || 'primary'}`]"
    :disabled="component.props.disabled"
    @click="emit('action', { name: 'click', surfaceId: '', componentId: component.id, payload: { action: component.props.action } })"
  >
    {{ component.props.label }}
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  component: { id: string; props: { label: string; action: string; variant?: string; disabled?: boolean } };
}>();

const emit = defineEmits<{
  action: [action: any];
}>();
</script>

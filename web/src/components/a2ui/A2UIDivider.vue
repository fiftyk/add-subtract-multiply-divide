<template>
  <div :class="['divider', component.props.style === 'dashed' ? 'divider-dashed' : '']"></div>
</template>

<script setup lang="ts">
defineProps<{
  component: { props: { style?: string } };
}>();
</script>

<style scoped>
.divider { height: 1px; background: #e5e7eb; margin: 16px 0; }
.divider-dashed { background: repeating-linear-gradient(90deg, #e5e7eb 0, #e5e7eb 6px, transparent 6px, transparent 12px); height: 2px; }
</style>

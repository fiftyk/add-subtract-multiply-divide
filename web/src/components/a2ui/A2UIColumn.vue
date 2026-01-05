<template>
  <div class="column" :style="{ gap: `${component.props.gap || 12}px` }">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  component: { props: { gap?: number } };
}>();
</script>

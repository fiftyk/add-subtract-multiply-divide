<template>
  <div class="progress">
    <div v-if="component.props.label" class="progress-label">{{ component.props.label }}</div>
    <div class="progress-bar">
      <div
        class="progress-fill"
        :style="{ width: `${(component.props.value / (component.props.max || 100)) * 100}%` }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  component: { props: { value: number; max?: number; label?: string } };
}>();
</script>

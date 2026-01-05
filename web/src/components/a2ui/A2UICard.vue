<template>
  <div class="card">
    <div v-if="component.props.title" class="card-title">{{ component.props.title }}</div>
    <div class="card-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  component: { props: { title?: string } };
}>();
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

<template>
  <div class="a2ui-form-container">
    <form @submit.prevent="handleSubmit" class="a2ui-form">
      <A2UITextField
        v-for="field in textFields"
        :key="field.id"
        :component="field"
        v-model="formData[field.id]"
      />
      <A2UIDateField
        v-for="field in dateFields"
        :key="field.id"
        :component="field"
        v-model="formData[field.id]"
      />
      <A2UISelectField
        v-for="field in selectFields"
        :key="field.id"
        :component="field"
        v-model="formData[field.id]"
      />
      <div class="form-actions">
        <A2UIButton
          type="submit"
          :label="submitLabel"
          variant="primary"
          :disabled="!isValid"
        />
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { A2UIField, A2UISchema } from '../../../../../src/a2ui/types';
import A2UITextField from './A2UITextField.vue';
import A2UIDateField from './A2UIDateField.vue';
import A2UISelectField from './A2UISelectField.vue';
import A2UIButton from './A2UIButton.vue';

const props = defineProps<{
  schema: A2UISchema;
  submitLabel?: string;
}>();

const emit = defineEmits<{
  submit: [values: Record<string, unknown>];
  cancel: [];
}>();

const formData = ref<Record<string, unknown>>({});

// Initialize form data with default values
watch(
  () => props.schema,
  (schema) => {
    formData.value = {};
    for (const field of schema.fields) {
      if (field.defaultValue !== undefined) {
        formData.value[field.id] = field.defaultValue;
      }
    }
  },
  { immediate: true, deep: true }
);

// Group fields by type
const textFields = computed(() =>
  props.schema.fields.filter(
    (f) => f.type === 'text' || f.type === 'number' || f.type === 'boolean'
  )
);

const dateFields = computed(() =>
  props.schema.fields.filter((f) => f.type === 'date')
);

const selectFields = computed(() =>
  props.schema.fields.filter(
    (f) => f.type === 'single_select' || f.type === 'multi_select'
  )
);

// Validate required fields
const isValid = computed(() => {
  for (const field of props.schema.fields) {
    if (field.required) {
      const value = formData.value[field.id];
      if (value === undefined || value === null || value === '') {
        return false;
      }
    }
  }
  return true;
});

function handleSubmit() {
  if (!isValid.value) return;
  emit('submit', { ...formData.value });
}
</script>

<style scoped>
.a2ui-form-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  max-width: 500px;
  margin: 0 auto;
}

.a2ui-form {
  padding: 24px;
}

.form-actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}
</style>

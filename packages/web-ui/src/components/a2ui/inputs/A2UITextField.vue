<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TextFieldProps, ValueChangePayload } from '../types.js'

const props = defineProps<{
  id: string
  props: TextFieldProps
}>()

const emit = defineEmits<{
  (e: 'value-change', payload: ValueChangePayload): void
}>()

// 提取标签文本
const labelText = computed(() => {
  const label = props.props.label
  if (label && typeof label === 'object' && 'literalString' in label) {
    return label.literalString
  }
  return ''
})

// 提取 placeholder
const placeholderText = computed(() => {
  const placeholder = props.props.placeholder
  if (placeholder && typeof placeholder === 'object' && 'literalString' in placeholder) {
    return `${labelText.value}...`
  }
  return `${labelText.value}...`
})

// 提取字段名
const fieldName = computed(() => {
  const name = props.props.name
  if (name && typeof name === 'object' && 'literalString' in name) {
    return name.literalString
  }
  return props.id
})

// 是否必填
const isRequired = computed(() => {
  const required = props.props.required
  if (required && typeof required === 'object' && 'literalBoolean' in required) {
    return required.literalBoolean
  }
  return false
})

// 是否多行
const isMultiline = computed(() => {
  const multiline = props.props.multiline
  if (multiline && typeof multiline === 'object' && 'literalBoolean' in multiline) {
    return multiline.literalBoolean
  }
  return false
})

// 输入类型
const inputType = computed(() => {
  const type = props.props.textFieldType
  if (type && typeof type === 'object' && 'literalString' in type) {
    switch (type.literalString) {
      case 'number':
        return 'number'
      case 'email':
        return 'email'
      case 'password':
        return 'password'
      default:
        return 'text'
    }
  }
  return 'text'
})

// 本地值（用于双向绑定）
const localValue = ref('')

// 处理输入
function handleInput(event: Event) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  localValue.value = target.value

  emit('value-change', {
    id: props.id,
    name: fieldName.value,
    value: target.value,
  })
}
</script>

<template>
  <div class="a2ui-textfield">
    <label v-if="labelText" class="a2ui-textfield-label">
      {{ labelText }}
      <span v-if="isRequired" class="a2ui-required">*</span>
    </label>

    <!-- 多行文本输入 -->
    <textarea
      v-if="isMultiline"
      class="a2ui-textfield-input a2ui-textfield-multiline"
      :placeholder="placeholderText"
      :required="isRequired"
      :disabled="Boolean(props.props.disabled)"
      :value="localValue"
      @input="handleInput"
    />

    <!-- 单行文本输入 -->
    <input
      v-else
      class="a2ui-textfield-input"
      :type="inputType"
      :placeholder="placeholderText"
      :required="isRequired"
      :disabled="Boolean(props.props.disabled)"
      :value="localValue"
      @input="handleInput"
    />
  </div>
</template>

<style scoped>
.a2ui-textfield {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin: 0.5rem 0;
}

.a2ui-textfield-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.a2ui-required {
  color: #ef4444;
  margin-left: 0.25rem;
}

.a2ui-textfield-input {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background-color: white;
  color: #111827;
  transition: border-color 0.15s ease;
}

.a2ui-textfield-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.a2ui-textfield-input:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

.a2ui-textfield-multiline {
  min-height: 80px;
  resize: vertical;
}
</style>

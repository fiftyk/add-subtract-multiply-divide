<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MultipleChoiceProps, ValueChangePayload, BooleanValue, TextValue } from '../types.js'

const props = defineProps<{
  id: string
  props: MultipleChoiceProps
}>()

const emit = defineEmits<{
  (e: 'value-change', payload: ValueChangePayload): void
}>()

// 辅助函数：提取布尔值
function getBooleanValue(value: BooleanValue | undefined): boolean {
  if (!value) return false
  if (typeof value === 'object' && 'literalBoolean' in value) {
    return value.literalBoolean
  }
  return false
}

// 提取标签文本
const labelText = computed(() => {
  const label = props.props.label
  if (label && typeof label === 'object' && 'literalString' in label) {
    return label.literalString
  }
  return ''
})

// 最大选择数
const maxSelections = computed(() => {
  const max = props.props.maxAllowedSelections
  if (max && typeof max === 'object' && 'literalNumber' in max) {
    return max.literalNumber
  }
  return 1 // A2UI v0.8 默认单选
})

// 是否单选
const isSingleSelect = computed(() => {
  return maxSelections.value === 1
})

// 提取选项列表
const optionsList = computed(() => {
  return props.props.options.map(opt => ({
    value: opt.value,
    label: opt.label && typeof opt.label === 'object' && 'literalString' in opt.label
      ? opt.label.literalString
      : opt.value
  }))
})

// 初始选中值（从 selections.literalArray 获取）
const selectedValues = ref<Set<string>>(new Set(() => {
  if ('literalArray' in props.props.selections) {
    return new Set(props.props.selections.literalArray)
  }
  return new Set<string>()
})())

// 处理选择
function handleSelection(value: string) {
  if (isSingleSelect.value) {
    // 单选：直接替换
    selectedValues.value.clear()
    selectedValues.value.add(value)
  } else {
    // 多选：切换
    if (selectedValues.value.has(value)) {
      selectedValues.value.delete(value)
    } else {
      // 检查是否达到最大选择数
      if (selectedValues.value.size < maxSelections.value) {
        selectedValues.value.add(value)
      }
    }
  }

  // 发射事件
  const result = isSingleSelect.value
    ? Array.from(selectedValues.value)[0] || ''
    : Array.from(selectedValues.value)

  emit('value-change', {
    id: props.id,
    name: props.id, // 使用组件ID作为字段名
    value: result,
  })
}

// 检查选项是否被禁用（达到最大选择数时禁用未选项）
function isOptionDisabled(value: string): boolean {
  if (isSingleSelect.value) return false
  if (selectedValues.value.has(value)) return false
  return selectedValues.value.size >= maxSelections.value
}
</script>

<template>
  <div class="a2ui-multiple-choice">
    <fieldset class="a2ui-choice-fieldset">
      <legend v-if="labelText" class="a2ui-choice-legend">
        {{ labelText }}
        <span v-if="getBooleanValue(props.props.required)" class="a2ui-required">*</span>
      </legend>

      <!-- 单选模式 -->
      <template v-if="isSingleSelect">
        <label
          v-for="option in optionsList"
          :key="option.value"
          class="a2ui-choice-option a2ui-choice-radio"
        >
          <input
            type="radio"
            :name="fieldName"
            :value="option.value"
            :checked="selectedValues.has(option.value)"
            @change="handleSelection(option.value)"
          />
          <span class="a2ui-choice-label">{{ option.label }}</span>
        </label>
      </template>

      <!-- 多选模式 -->
      <template v-else>
        <label
          v-for="option in optionsList"
          :key="option.value"
          class="a2ui-choice-option a2ui-choice-checkbox"
        >
          <input
            type="checkbox"
            :value="option.value"
            :checked="selectedValues.has(option.value)"
            :disabled="isOptionDisabled(option.value)"
            @change="handleSelection(option.value)"
          />
          <span class="a2ui-choice-label">{{ option.label }}</span>
        </label>
      </template>
    </fieldset>

    <!-- 提示信息 -->
    <div v-if="!isSingleSelect" class="a2ui-choice-hint">
      已选择 {{ selectedValues.size }} / {{ maxSelections === Infinity ? '∞' : maxSelections }}
    </div>
  </div>
</template>

<style scoped>
.a2ui-multiple-choice {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.a2ui-choice-fieldset {
  border: none;
  padding: 0;
  margin: 0;
}

.a2ui-choice-legend {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
  padding: 0;
}

.a2ui-required {
  color: #ef4444;
  margin-left: 0.25rem;
}

.a2ui-choice-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0;
  cursor: pointer;
  font-size: 0.875rem;
  color: #374151;
}

.a2ui-choice-option:hover {
  background-color: #f9fafb;
  border-radius: 0.25rem;
  padding-left: 0.25rem;
}

.a2ui-choice-option input[type="radio"],
.a2ui-choice-option input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  accent-color: #3b82f6;
}

.a2ui-choice-label {
  flex: 1;
}

.a2ui-choice-option:has(input:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

.a2ui-choice-hint {
  font-size: 0.75rem;
  color: #6b7280;
}
</style>

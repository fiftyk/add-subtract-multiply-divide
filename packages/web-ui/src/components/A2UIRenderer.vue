<script setup lang="ts">
import { computed } from 'vue'

interface A2UIComponent {
  id: string
  component: Record<string, Record<string, unknown>>
}

const props = defineProps<{
  components: A2UIComponent[]
}>()

// 扁平化所有组件（将嵌套结构展平）
const flatComponents = computed(() => {
  const result: Array<{
    id: string
    type: string
    props: Record<string, unknown>
  }> = []

  for (const comp of props.components) {
    for (const [type, props] of Object.entries(comp.component)) {
      result.push({
        id: comp.id,
        type,
        props
      })
    }
  }

  return result
})

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

// 查找子组件
function findChildComponents(childId: string) {
  return props.components.filter(c => c.id === childId)
}

// 获取 Row 样式
function getRowStyle(props: Record<string, unknown>): Record<string, string> {
  const distribution = props.distribution as { literalString: string } | undefined
  const gap = props.gap as number | undefined

  const justifyContent = distribution?.literalString || 'flex-start'

  return {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: getJustifyContent(justifyContent),
    gap: gap ? `${gap}px` : '8px'
  }
}

// 获取 Column 样式
function getColumnStyle(props: Record<string, unknown>): Record<string, string> {
  const distribution = props.distribution as { literalString: string } | undefined
  const gap = props.gap as number | undefined

  const alignItems = distribution?.literalString || 'flex-start'

  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: getAlignItems(alignItems),
    gap: gap ? `${gap}px` : '8px'
  }
}

function getJustifyContent(value: string): string {
  const map: Record<string, string> = {
    'start': 'flex-start',
    'center': 'center',
    'end': 'flex-end',
    'space-between': 'space-between',
    'space-around': 'space-around',
    'space-evenly': 'space-evenly'
  }
  return map[value] || 'flex-start'
}

function getAlignItems(value: string): string {
  const map: Record<string, string> = {
    'start': 'flex-start',
    'center': 'center',
    'end': 'flex-end'
  }
  return map[value] || 'flex-start'
}

// 获取 CheckBox 的 checked 状态
function getCheckBoxChecked(props: Record<string, unknown>): boolean {
  const checked = props.checked as { literalBoolean?: boolean } | undefined
  return checked?.literalBoolean || false
}

// 获取 CheckBox 的 label 文本
function getCheckBoxLabel(props: Record<string, unknown>): string {
  const label = props.label as { literalString?: string } | undefined
  return label?.literalString || ''
}
</script>

<template>
  <div class="a2ui-renderer">
    <template v-for="comp in flatComponents" :key="comp.id + '-' + comp.type">
      <!-- Table 组件 -->
      <div v-if="comp.type === 'Table'" class="a2ui-table-container">
        <table class="a2ui-table">
          <thead>
            <tr>
              <th
                v-for="header in (comp.props.headers as string[] | undefined)"
                :key="header"
              >
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rowIndex) in (comp.props.rows as Array<Array<unknown>> | undefined)"
              :key="rowIndex"
            >
              <td
                v-for="(cell, cellIndex) in row"
                :key="cellIndex"
              >
                {{ formatCellValue(cell) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Card 组件 -->
      <div v-else-if="comp.type === 'Card'" class="a2ui-card">
        <h3 v-if="comp.props.title" class="a2ui-card-title">
          {{ comp.props.title }}
        </h3>
        <div class="a2ui-card-content">
          <!-- 支持 content 字段（单行描述文本） -->
          <p v-if="comp.props.content" class="a2ui-card-description">
            {{ comp.props.content }}
          </p>
          <!-- 支持 children 字段（多行列表） -->
          <p
            v-for="(line, lineIndex) in (comp.props.children as string[] | undefined)"
            :key="lineIndex"
            class="a2ui-card-line"
          >
            {{ line }}
          </p>
        </div>
      </div>

      <!-- Text 组件 -->
      <div v-else-if="comp.type === 'Text'" class="a2ui-text">
        <span
          :class="{
            'text-heading': comp.props.style === 'heading',
            'text-subheading': comp.props.style === 'subheading',
            'text-caption': comp.props.style === 'caption',
            'text-code': comp.props.style === 'code',
            'text-default': !comp.props.style || comp.props.style === 'default'
          }"
        >
          {{ comp.props.text }}
        </span>
      </div>

      <!-- Badge 组件 -->
      <div v-else-if="comp.type === 'Badge'" class="a2ui-badge" :class="(comp.props.variant as string || 'info')">
        {{ comp.props.text }}
      </div>

      <!-- Progress 组件 -->
      <div v-else-if="comp.type === 'Progress'" class="a2ui-progress">
        <div class="a2ui-progress-bar">
          <div
            class="a2ui-progress-fill"
            :style="{ width: ((comp.props.value as number) / ((comp.props.max as number) || 100) * 100) + '%' }"
          ></div>
        </div>
        <span v-if="comp.props.label" class="a2ui-progress-label">{{ comp.props.label }}</span>
      </div>

      <!-- Divider 组件 -->
      <div v-else-if="comp.type === 'Divider'" class="a2ui-divider" :class="(comp.props.style as string || 'solid')"></div>

      <!-- List 组件 -->
      <div v-else-if="comp.type === 'List'" class="a2ui-list">
        <div
          v-for="(item, index) in (comp.props.children as string[] | undefined)"
          :key="index"
          class="a2ui-list-item"
          :class="{ 'a2ui-list-ordered': comp.props.ordered }"
        >
          <span v-if="comp.props.ordered" class="a2ui-list-number">{{ index + 1 }}.</span>
          <span class="a2ui-list-content">{{ item }}</span>
        </div>
      </div>

      <!-- Row 组件 (水平布局) -->
      <div v-else-if="comp.type === 'Row'" class="a2ui-row" :style="getRowStyle(comp.props)">
        <div
          v-for="childId in (comp.props.children as string[] | undefined)"
          :key="childId"
          class="a2ui-row-item"
        >
          <!-- Row 子元素需要通过 ID 查找实际组件 -->
          <template v-for="childComp in findChildComponents(childId)" :key="childComp.id + '-' + childComp.type">
            <A2UIRenderer :components="[childComp]" />
          </template>
        </div>
      </div>

      <!-- Column 组件 (垂直布局) -->
      <div v-else-if="comp.type === 'Column'" class="a2ui-column" :style="getColumnStyle(comp.props)">
        <div
          v-for="childId in (comp.props.children as string[] | undefined)"
          :key="childId"
          class="a2ui-column-item"
        >
          <template v-for="childComp in findChildComponents(childId)" :key="childComp.id + '-' + childComp.type">
            <A2UIRenderer :components="[childComp]" />
          </template>
        </div>
      </div>

      <!-- Button 组件 -->
      <button
        v-else-if="comp.type === 'Button'"
        class="a2ui-button"
        :class="(comp.props.variant as string || 'primary')"
        :disabled="Boolean(comp.props.disabled)"
      >
        {{ comp.props.label }}
      </button>

      <!-- Slider 组件 -->
      <div v-else-if="comp.type === 'Slider'" class="a2ui-slider">
        <label v-if="comp.props.label" class="a2ui-slider-label">{{ comp.props.label }}</label>
        <input
          type="range"
          class="a2ui-slider-input"
          :min="(comp.props.minValue as number | undefined) || 0"
          :max="(comp.props.maxValue as number | undefined) || 100"
          :value="(comp.props.value as number)"
        />
        <span class="a2ui-slider-value">{{ comp.props.value }}</span>
      </div>

      <!-- CheckBox 组件 -->
      <div v-else-if="comp.type === 'CheckBox'" class="a2ui-checkbox">
        <input
          type="checkbox"
          class="a2ui-checkbox-input"
          :checked="getCheckBoxChecked(comp.props)"
          disabled
        />
        <label class="a2ui-checkbox-label">{{ getCheckBoxLabel(comp.props) }}</label>
      </div>

      <!-- 其他不支持的组件类型 -->
      <div v-else class="a2ui-unsupported">
        Unsupported component type: {{ comp.type }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.a2ui-renderer {
  width: 100%;
}

/* Table 样式 */
.a2ui-table-container {
  width: 100%;
  overflow-x: auto;
  margin: 1rem 0;
}

.a2ui-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.a2ui-table th,
.a2ui-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.a2ui-table th {
  background-color: #f9fafb;
  font-weight: 600;
  color: #374151;
}

.a2ui-table tbody tr:hover {
  background-color: #f9fafb;
}

/* Card 样式 */
.a2ui-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1rem 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.a2ui-card-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.75rem 0;
}

.a2ui-card-content {
  color: #4b5563;
}

.a2ui-card-description {
  margin: 0 0 0.75rem 0;
  font-size: 0.9375rem;
  color: #374151;
  line-height: 1.5;
}

.a2ui-card-line {
  margin: 0.25rem 0;
  font-size: 0.875rem;
}

/* Text 样式 */
.a2ui-text {
  padding: 0.5rem 0;
}

.text-default {
  color: #4b5563;
}

.text-heading {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
}

.text-subheading {
  font-size: 1.125rem;
  font-weight: 500;
  color: #374151;
}

.text-caption {
  font-size: 0.75rem;
  color: #9ca3af;
}

.text-code {
  font-family: ui-monospace, monospace;
  font-size: 0.875rem;
  background-color: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

/* Badge 样式 */
.a2ui-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 9999px;
  margin: 0.25rem;
}

.a2ui-badge.success {
  background-color: #dcfce7;
  color: #166534;
}

.a2ui-badge.warning {
  background-color: #fef3c7;
  color: #92400e;
}

.a2ui-badge.error {
  background-color: #fee2e2;
  color: #991b1b;
}

.a2ui-badge.info {
  background-color: #dbeafe;
  color: #1e40af;
}

/* Progress 样式 */
.a2ui-progress {
  margin: 1rem 0;
}

.a2ui-progress-bar {
  height: 0.5rem;
  background-color: #e5e7eb;
  border-radius: 9999px;
  overflow: hidden;
}

.a2ui-progress-fill {
  height: 100%;
  background-color: #3b82f6;
  border-radius: 9999px;
  transition: width 0.3s ease;
}

.a2ui-progress-label {
  display: block;
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

/* Divider 样式 */
.a2ui-divider {
  height: 1px;
  margin: 1rem 0;
}

.a2ui-divider.solid {
  background-color: #e5e7eb;
}

.a2ui-divider.dashed {
  background: repeating-linear-gradient(
    to right,
    #e5e7eb 0,
    #e5e7eb 8px,
    transparent 8px,
    transparent 16px
  );
}

/* List 样式 */
.a2ui-list {
  margin: 0.5rem 0;
}

.a2ui-list-item {
  display: flex;
  align-items: flex-start;
  padding: 0.375rem 0;
  font-size: 0.875rem;
  color: #374151;
}

.a2ui-list-item::before {
  content: '•';
  color: #9ca3af;
  margin-right: 0.5rem;
}

.a2ui-list-ordered .a2ui-list-number {
  color: #6b7280;
  margin-right: 0.5rem;
  font-weight: 500;
}

.a2ui-list-ordered .a2ui-list-item::before {
  content: none;
}

/* Row 样式 */
.a2ui-row {
  display: flex;
  flex-direction: row;
  margin: 0.5rem 0;
  flex-wrap: wrap;
}

.a2ui-row-item {
  flex-shrink: 0;
}

/* Column 样式 */
.a2ui-column {
  display: flex;
  flex-direction: column;
  margin: 0.5rem 0;
}

.a2ui-column-item {
  flex-shrink: 0;
}

/* Button 样式 */
.a2ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.a2ui-button.primary {
  background-color: #3b82f6;
  color: white;
}

.a2ui-button.primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.a2ui-button.secondary {
  background-color: #f3f4f6;
  color: #374151;
}

.a2ui-button.secondary:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.a2ui-button.danger {
  background-color: #ef4444;
  color: white;
}

.a2ui-button.danger:hover:not(:disabled) {
  background-color: #dc2626;
}

.a2ui-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Slider 样式 */
.a2ui-slider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.5rem 0;
}

.a2ui-slider-label {
  font-size: 0.875rem;
  color: #374151;
  min-width: 60px;
}

.a2ui-slider-input {
  flex: 1;
  height: 0.375rem;
  background-color: #e5e7eb;
  border-radius: 9999px;
  appearance: none;
  cursor: pointer;
}

.a2ui-slider-input::-webkit-slider-thumb {
  appearance: none;
  width: 1rem;
  height: 1rem;
  background-color: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
}

.a2ui-slider-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
  min-width: 40px;
  text-align: right;
}

/* CheckBox 样式 */
.a2ui-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0;
}

.a2ui-checkbox-input {
  width: 1rem;
  height: 1rem;
  border-radius: 0.25rem;
  border-color: #d1d5db;
  cursor: pointer;
}

.a2ui-checkbox-label {
  font-size: 0.875rem;
  color: #374151;
}

/* Unsupported 样式 */
.a2ui-unsupported {
  padding: 0.5rem;
  background-color: #fef3c7;
  color: #92400e;
  font-size: 0.75rem;
  border-radius: 0.25rem;
  margin: 0.25rem 0;
}
</style>

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

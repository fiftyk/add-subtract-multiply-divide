<script setup lang="ts">
import { computed } from 'vue'
import type { TableProps } from '../types.js'

const props = defineProps<{
  id: string
  props: TableProps
}>()

// 解析 headers
const headers = computed(() => {
  const h = props.props.headers
  if (Array.isArray(h)) {
    return h
  }
  if (typeof h === 'string') {
    try {
      return JSON.parse(h)
    } catch {
      return []
    }
  }
  return []
})

// 解析 rows
const rows = computed(() => {
  const r = props.props.rows
  if (Array.isArray(r)) {
    return r
  }
  if (typeof r === 'string') {
    try {
      return JSON.parse(r)
    } catch {
      return []
    }
  }
  return []
})

// 格式化单元格值
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
  <div class="a2ui-table-container">
    <table class="a2ui-table">
      <thead>
        <tr>
          <th v-for="header in headers" :key="header">{{ header }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
          <td v-for="(cell, cellIndex) in row" :key="cellIndex">
            {{ formatCellValue(cell) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
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
</style>

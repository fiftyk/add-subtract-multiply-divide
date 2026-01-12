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
  <div class="w-full">
    <template v-for="comp in flatComponents" :key="comp.id + '-' + comp.type">
      <!-- Table 组件 -->
      <div v-if="comp.type === 'Table'" class="w-full overflow-x-auto my-4">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th
                v-for="header in (comp.props.headers as string[] | undefined)"
                :key="header"
                class="px-4 py-3 text-left bg-gray-50 font-semibold text-gray-700 border-b border-gray-200"
              >
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rowIndex) in (comp.props.rows as Array<Array<unknown>> | undefined)"
              :key="rowIndex"
              class="hover:bg-gray-50"
            >
              <td
                v-for="(cell, cellIndex) in row"
                :key="cellIndex"
                class="px-4 py-3 text-left border-b border-gray-100 text-gray-600"
              >
                {{ formatCellValue(cell) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Card 组件 -->
      <div v-else-if="comp.type === 'Card'" class="bg-white border border-gray-200 rounded-lg p-4 my-4 shadow-sm">
        <h3 v-if="comp.props.title" class="text-base font-semibold text-gray-900 mb-3">
          {{ comp.props.title }}
        </h3>
        <div class="text-gray-600">
          <!-- 支持 content 字段（单行描述文本） -->
          <p v-if="comp.props.content" class="text-[15px] text-gray-700 leading-relaxed mb-3">
            {{ comp.props.content }}
          </p>
          <!-- 支持 children 字段（多行列表） -->
          <p
            v-for="(line, lineIndex) in (comp.props.children as string[] | undefined)"
            :key="lineIndex"
            class="text-sm my-1"
          >
            {{ line }}
          </p>
        </div>
      </div>

      <!-- Text 组件 -->
      <div v-else-if="comp.type === 'Text'" class="py-2">
        <span
          :class="{
            'text-xl font-semibold text-gray-900': comp.props.style === 'heading',
            'text-lg font-medium text-gray-700': comp.props.style === 'subheading',
            'text-xs text-gray-400': comp.props.style === 'caption',
            'text-sm font-mono bg-gray-100 px-1.5 py-0.5 rounded': comp.props.style === 'code',
            'text-sm text-gray-600': !comp.props.style || comp.props.style === 'default'
          }"
        >
          {{ comp.props.text }}
        </span>
      </div>

      <!-- Badge 组件 -->
      <div
        v-else-if="comp.type === 'Badge'"
        class="inline-flex px-3 py-1 text-xs font-medium rounded-full mx-1"
        :class="{
          'bg-green-100 text-green-800': (comp.props.variant as string) === 'success',
          'bg-yellow-100 text-yellow-800': (comp.props.variant as string) === 'warning',
          'bg-red-100 text-red-800': (comp.props.variant as string) === 'error',
          'bg-blue-100 text-blue-800': (comp.props.variant as string) === 'info' || !comp.props.variant
        }"
      >
        {{ comp.props.text }}
      </div>

      <!-- Progress 组件 -->
      <div v-else-if="comp.type === 'Progress'" class="my-4">
        <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            class="h-full bg-blue-600 rounded-full transition-all duration-300"
            :style="{ width: ((comp.props.value as number) / ((comp.props.max as number) || 100) * 100) + '%' }"
          ></div>
        </div>
        <span v-if="comp.props.label" class="block text-xs text-gray-500 mt-1">{{ comp.props.label }}</span>
      </div>

      <!-- Divider 组件 -->
      <div
        v-else-if="comp.type === 'Divider'"
        class="h-px my-4"
        :class="{
          'bg-gray-200': !comp.props.style || (comp.props.style as string) === 'solid',
          'bg-[length:16px_8px] bg-gray-200': (comp.props.style as string) === 'dashed'
        }"
        :style="(comp.props.style as string) === 'dashed' ? { backgroundImage: 'repeating-linear-gradient(to right, #e5e7eb 0, #e5e7eb 8px, transparent 8px, transparent 16px)' } : {}"
      ></div>

      <!-- 其他不支持的组件类型 -->
      <div v-else class="py-2 bg-amber-50 text-amber-800 text-xs rounded px-2 my-1">
        Unsupported component type: {{ comp.type }}
      </div>
    </template>
  </div>
</template>

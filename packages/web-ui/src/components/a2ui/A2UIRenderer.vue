/**
 * A2UI Renderer Component
 *
 * SOLID Principles Applied:
 * - SRP: Only handles component rendering orchestration
 * - OCP: Components are registered externally, no code changes needed
 * - DIP: Uses component registry abstraction
 *
 * This component uses a component registry to dynamically render A2UI components.
 * New components can be added by registering them with the global registry.
 */

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import type { A2UIComponentDefinition } from './types.js'
import { getGlobalRegistry, registerA2UIComponent } from './registry/index.js'

// Import all components (auto-registered on load)
import { A2UITextField, A2UICheckBox, A2UIDateTimeInput, A2UIMultipleChoice, A2UISlider, A2UIButton } from './inputs/index.js'
import { A2UIText, A2UIBadge, A2UIProgress, A2UIDivider, A2UIList, A2UITable, A2UICard } from './display/index.js'
import { A2UIRow, A2UIColumn } from './layout/index.js'

const props = defineProps<{
  components: A2UIComponentDefinition[]
}>()

// Get the component registry
const registry = getGlobalRegistry()

// Register all A2UI v0.8 components (OCP: registration happens once, components can be extended)
function initializeRegistry(): void {
  // Standard A2UI v0.8 Input components
  registerA2UIComponent('TextField', A2UITextField)
  registerA2UIComponent('CheckBox', A2UICheckBox)
  registerA2UIComponent('DateTimeInput', A2UIDateTimeInput)
  registerA2UIComponent('MultipleChoice', A2UIMultipleChoice)
  registerA2UIComponent('Slider', A2UISlider)
  registerA2UIComponent('Button', A2UIButton)

  // Display components
  registerA2UIComponent('Text', A2UIText)
  registerA2UIComponent('Badge', A2UIBadge)
  registerA2UIComponent('Progress', A2UIProgress)
  registerA2UIComponent('Divider', A2UIDivider)
  registerA2UIComponent('List', A2UIList)
  registerA2UIComponent('Table', A2UITable)
  registerA2UIComponent('Card', A2UICard)

  // Layout components
  registerA2UIComponent('Row', A2UIRow)
  registerA2UIComponent('Column', A2UIColumn)

  console.debug('[A2UI] Registry initialized with components:', registry.getRegisteredTypes())
}

// Initialize registry on mount
onMounted(() => {
  initializeRegistry()
})

// Cleanup on unmount (optional, if using per-instance registry)
onUnmounted(() => {
  // Registry is global, so we don't clear it here
})

// Flatten all components (flatten nested structure)
const flatComponents = computed(() => {
  const result: Array<{
    id: string
    type: string
    props: Record<string, unknown>
  }> = []

  for (const comp of props.components) {
    for (const [type, componentProps] of Object.entries(comp.component)) {
      result.push({
        id: comp.id,
        type,
        props: componentProps
      })
    }
  }

  return result
})

// Get component from registry
function getComponent(type: string): unknown {
  return registry.get(type)
}

// Check if component is registered
function hasComponent(type: string): boolean {
  return registry.has(type)
}
</script>

<template>
  <div class="a2ui-renderer">
    <template v-for="comp in flatComponents" :key="comp.id + '-' + comp.type">
      <!-- Dynamic component rendering using registry -->
      <component
        v-if="hasComponent(comp.type)"
        :is="getComponent(comp.type)"
        :id="comp.id"
        :props="comp.props"
      />

      <!-- Unsupported component type -->
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

.a2ui-unsupported {
  padding: 0.5rem;
  background-color: #fef3c7;
  color: #92400e;
  font-size: 0.75rem;
  border-radius: 0.25rem;
  margin: 0.25rem 0;
}
</style>

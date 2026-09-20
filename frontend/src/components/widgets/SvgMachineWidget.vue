<script lang="ts">
export { default as SvgMachineConfig } from './SvgMachineConfig.vue'
</script>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { OnyxIcon } from 'sit-onyx'
import { iconEngine } from '@sit-onyx/icons'
import type { SvgBinding } from '@/types/dashboard'

const props = defineProps<{
  svgContent?: string
  bindings?: SvgBinding[]
  isPickerActive?: boolean
  selectedElementId?: string | null
  selectedElementIds?: string[]
  telemetryValues?: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'select-element', elementId: string, label?: string, isShift?: boolean): void
}>()

const svgContainer = ref<HTMLDivElement | null>(null)
const hoveredLabel = ref<string | null>(null)
const hoveredId = ref<string | null>(null)
const hoverPos = ref({ x: 0, y: 0 })

// Helper to get all element IDs targeted by a single binding
function getBindingIds(b: SvgBinding): string[] {
  const ids = new Set<string>()
  if (b.elementId) ids.add(b.elementId)
  if (b.elementIds) {
    b.elementIds.forEach((id) => id && ids.add(id))
  }
  return Array.from(ids)
}

// Compute if the hovered shape belongs to any active binding
const hoveredBinding = computed(() => {
  if (!hoveredId.value || !props.bindings) return null
  return props.bindings.find((b) => getBindingIds(b).includes(hoveredId.value!)) || null
})

// Parse or clean SVG content to make it responsive inside the widget container
const sanitizedSvg = computed(() => {
  if (!props.svgContent) return ''
  let content = props.svgContent
  content = content.replace(/<svg\b([^>]*)>/i, (_match, attrs) => {
    let newAttrs = attrs
    if (!newAttrs.includes('width="100%"')) {
      newAttrs = newAttrs.replace(/width="[^"]*"/i, 'width="100%"')
    }
    if (!newAttrs.includes('height="100%"')) {
      newAttrs = newAttrs.replace(/height="[^"]*"/i, 'height="100%"')
    }
    return `<svg ${newAttrs} style="width: 100%; height: 100%; display: block; overflow: visible;">`
  })
  return content
})

function applyBindings() {
  if (!svgContainer.value) return
  const svgEl = svgContainer.value.querySelector('svg')
  if (!svgEl) return

  const bindings = props.bindings || []
  const activeShapes = new Set<Element>()

  // 1. Identify all currently bound shapes across all compound bindings
  for (const binding of bindings) {
    const targetIds = getBindingIds(binding)
    for (const elId of targetIds) {
      const selector = `[data-cell-id="${elId}"], #${elId}, [id="${elId}"]`
      const target = svgEl.querySelector(selector) as HTMLElement | SVGElement | null
      if (!target) continue

      const shapes = target.tagName.toLowerCase() === 'g'
        ? Array.from(target.querySelectorAll('rect, ellipse, circle, path, polygon, polyline'))
        : [target]

      shapes.forEach((el) => activeShapes.add(el))
    }
  }

  // 2. Revert any previously mutated shapes that are no longer bound
  const mutatedElements = svgEl.querySelectorAll('[data-marmot-mutated="true"]')
  mutatedElements.forEach((el) => {
    if (!activeShapes.has(el)) {
      const shape = el as HTMLElement | SVGElement
      const origFill = shape.getAttribute('data-marmot-orig-fill')
      const origStroke = shape.getAttribute('data-marmot-orig-stroke')

      if (origFill !== null && origFill !== '') {
        shape.style.setProperty('fill', origFill)
      } else {
        shape.style.removeProperty('fill')
      }

      if (origStroke !== null && origStroke !== '') {
        shape.style.setProperty('stroke', origStroke)
      } else {
        shape.style.removeProperty('stroke')
      }

      shape.removeAttribute('data-marmot-mutated')
      shape.removeAttribute('data-marmot-orig-fill')
      shape.removeAttribute('data-marmot-orig-stroke')
    }
  })

  // Remove existing selection highlights
  svgEl.querySelectorAll('.marmot-selected-shape').forEach((el) => {
    el.classList.remove('marmot-selected-shape')
  })

  // 3. Apply active bindings and mutations
  for (const binding of bindings) {
    const targetIds = getBindingIds(binding)
    let targetColor = binding.defaultColor || '#94a3b8'
    const currentValue = props.telemetryValues?.[binding.dataPoint]

    if (currentValue !== undefined && binding.colorRules?.length) {
      const match = binding.colorRules.find((r) => String(r.value) === String(currentValue))
      if (match) {
        targetColor = match.color
      }
    }

    for (const elId of targetIds) {
      const selector = `[data-cell-id="${elId}"], #${elId}, [id="${elId}"]`
      const target = svgEl.querySelector(selector) as HTMLElement | SVGElement | null
      if (!target) continue

      const shapes = target.tagName.toLowerCase() === 'g'
        ? target.querySelectorAll('rect, ellipse, circle, path, polygon, polyline')
        : [target]

      shapes.forEach((el) => {
        const shape = el as HTMLElement | SVGElement
        // Save original style before mutating if not already saved
        if (!shape.hasAttribute('data-marmot-orig-fill')) {
          shape.setAttribute('data-marmot-orig-fill', shape.style.fill || '')
        }
        if (!shape.hasAttribute('data-marmot-orig-stroke')) {
          shape.setAttribute('data-marmot-orig-stroke', shape.style.stroke || '')
        }
        shape.setAttribute('data-marmot-mutated', 'true')

        if (binding.action === 'stroke') {
          shape.style.setProperty('stroke', targetColor, 'important')
        } else {
          shape.style.setProperty('fill', targetColor, 'important')
        }
      })
    }
  }

  // 4. Highlight selected elements/group in picker mode
  const highlightIds = new Set<string>()
  if (props.selectedElementId) {
    highlightIds.add(props.selectedElementId)
  }
  if (props.selectedElementIds) {
    props.selectedElementIds.forEach((id) => id && highlightIds.add(id))
  }

  highlightIds.forEach((id) => {
    const sel = svgEl.querySelector(`[data-cell-id="${id}"], #${id}, [id="${id}"]`)
    if (sel) {
      ;(sel as HTMLElement).classList.add('marmot-selected-shape')
    }
  })
}

function extractElementMeta(target: HTMLElement | SVGElement): { id: string; label: string } | null {
  const cellGroup = target.closest('[data-cell-id]') as HTMLElement | SVGElement | null
  const id = cellGroup?.getAttribute('data-cell-id') || target.id || target.getAttribute('name')
  if (!id) return null

  let label = ''
  if (cellGroup) {
    const textEl = cellGroup.querySelector('text, div')
    if (textEl && textEl.textContent) {
      label = textEl.textContent.trim()
    }
  }
  if (!label) {
    label = target.tagName.toLowerCase()
  }

  return { id, label }
}

function handleSvgMouseMove(e: MouseEvent) {
  if (!props.isPickerActive || !svgContainer.value) {
    hoveredId.value = null
    return
  }

  const target = e.target as HTMLElement | SVGElement
  const meta = extractElementMeta(target)

  if (meta) {
    hoveredId.value = meta.id
    hoveredLabel.value = meta.label
    const rect = svgContainer.value.getBoundingClientRect()
    hoverPos.value = {
      x: e.clientX - rect.left + 12,
      y: e.clientY - rect.top + 12,
    }
  } else {
    hoveredId.value = null
  }
}

function handleSvgMouseLeave() {
  hoveredId.value = null
}

function handleSvgClick(e: MouseEvent) {
  if (!props.isPickerActive) return
  const target = e.target as HTMLElement | SVGElement
  if (!target || !svgContainer.value) return

  const meta = extractElementMeta(target)
  if (meta) {
    e.stopPropagation()
    emit('select-element', meta.id, meta.label, e.shiftKey)
  }
}

watch(
  () => [
    props.svgContent,
    props.bindings,
    props.telemetryValues,
    props.selectedElementId,
    props.selectedElementIds,
  ],
  async () => {
    await nextTick()
    applyBindings()
  },
  { deep: true }
)

onMounted(async () => {
  await nextTick()
  applyBindings()
})
</script>

<template>
  <div
    ref="svgContainer"
    class="svg-machine-widget"
    :class="{ 'is-picker-mode': isPickerActive }"
    @mousemove="handleSvgMouseMove"
    @mouseleave="handleSvgMouseLeave"
    @click="handleSvgClick"
  >
    <div v-if="sanitizedSvg" class="svg-inner-wrapper" v-html="sanitizedSvg" />
    <div v-else class="svg-placeholder">
      <div class="placeholder-icon">
        <OnyxIcon :icon="iconEngine" />
      </div>
      <p class="placeholder-text">No SVG layout loaded</p>
      <span class="placeholder-hint">Upload or select an SVG from the catalog</span>
    </div>

    <!-- Floating Hover Inspector Badge in Picker Mode -->
    <div
      v-if="isPickerActive && hoveredId"
      class="hover-badge"
      :style="{ left: `${hoverPos.x}px`, top: `${hoverPos.y}px` }"
    >
      <div class="badge-header">
        <span class="hover-label">{{ hoveredLabel }}</span>
        <span v-if="hoveredBinding" class="badge-bound-tag">
          {{ hoveredBinding.groupName || 'Bound' }}
        </span>
      </div>
      <span class="hover-id">ID: {{ hoveredId }}</span>
      <span class="hover-hint">Click to bind • Shift+Click to toggle</span>
    </div>
  </div>
</template>

<style scoped>
.svg-machine-widget {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  user-select: none;
}

.svg-inner-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.svg-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--app-surface-subtle);
  border: 1px dashed var(--app-border-strong);
  border-radius: 8px;
  color: var(--app-text-muted);
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.placeholder-icon {
  font-size: 32px;
  margin-bottom: 8px;
  color: var(--app-accent);
}

.placeholder-text {
  font-weight: 600;
  margin: 0;
  color: var(--app-text);
}

.placeholder-hint {
  font-size: 12px;
  color: var(--app-text-muted);
  margin-top: 4px;
}

/* Floating Hover Tooltip */
.hover-badge {
  position: absolute;
  pointer-events: none;
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid rgba(2, 132, 199, 0.4);
  color: #ffffff;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 999;
  white-space: nowrap;
  backdrop-filter: blur(4px);
}

.badge-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hover-label {
  font-weight: 700;
  color: #f8fafc;
}

.badge-bound-tag {
  font-size: 9px;
  font-weight: 700;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.2);
  padding: 1px 5px;
  border-radius: 3px;
}

.hover-id {
  font-size: 9px;
  opacity: 0.75;
  font-family: 'Source Code Pro', monospace;
  color: #94a3b8;
}

.hover-hint {
  font-size: 8.5px;
  color: #38bdf8;
  margin-top: 1px;
}

:deep(.is-picker-mode [data-cell-id]),
:deep(.is-picker-mode rect),
:deep(.is-picker-mode ellipse),
:deep(.is-picker-mode circle),
:deep(.is-picker-mode path) {
  cursor: crosshair !important;
  transition: filter 0.15s ease, stroke 0.15s ease;
}

:deep(.is-picker-mode [data-cell-id]:hover),
:deep(.is-picker-mode rect:hover),
:deep(.is-picker-mode ellipse:hover) {
  filter: drop-shadow(0 0 6px #0284c7);
}

:deep(.marmot-selected-shape) {
  outline: 2px dashed #0284c7 !important;
  outline-offset: 3px;
}
</style>

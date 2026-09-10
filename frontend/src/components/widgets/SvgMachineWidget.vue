<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import type { SvgBinding } from '@/types/dashboard'

const props = defineProps<{
  svgContent?: string
  bindings?: SvgBinding[]
  isPickerActive?: boolean
  selectedElementId?: string | null
  telemetryValues?: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'select-element', elementId: string, tagName: string): void
}>()

const svgContainer = ref<HTMLDivElement | null>(null)

// Parse or clean SVG content to make it responsive inside the widget container
const sanitizedSvg = computed(() => {
  if (!props.svgContent) return ''
  let content = props.svgContent
  // Ensure the SVG fills its wrapper container
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

  // Apply binding rules
  const bindings = props.bindings || []
  for (const binding of bindings) {
    // Find target: by data-cell-id or id or attribute
    const selector = `[data-cell-id="${binding.elementId}"], #${binding.elementId}, [id="${binding.elementId}"]`
    const target = svgEl.querySelector(selector) as HTMLElement | SVGElement | null
    if (!target) continue

    // Find inner shape if target is a group <g>
    const shapes = target.tagName.toLowerCase() === 'g' 
      ? target.querySelectorAll('rect, ellipse, circle, path, polygon, polyline') 
      : [target]

    // Determine current color from telemetry or default
    let targetColor = binding.defaultColor || '#94a3b8'
    const currentValue = props.telemetryValues?.[binding.dataPoint]

    if (currentValue !== undefined && binding.colorRules?.length) {
      const match = binding.colorRules.find((r) => String(r.value) === String(currentValue))
      if (match) {
        targetColor = match.color
      }
    }

    shapes.forEach((el) => {
      const shape = el as HTMLElement | SVGElement
      if (binding.action === 'stroke') {
        shape.style.setProperty('stroke', targetColor, 'important')
      } else {
        shape.style.setProperty('fill', targetColor, 'important')
      }
    })
  }

  // Highlight currently selected element in picker mode
  if (props.selectedElementId) {
    const sel = svgEl.querySelector(`[data-cell-id="${props.selectedElementId}"], #${props.selectedElementId}`)
    if (sel) {
      ;(sel as HTMLElement).classList.add('marmot-selected-shape')
    }
  }
}

function handleSvgClick(e: MouseEvent) {
  if (!props.isPickerActive) return
  const target = e.target as HTMLElement | SVGElement
  if (!target || !svgContainer.value) return

  // Find the closest meaningful group or shape
  const cellGroup = target.closest('[data-cell-id]') as HTMLElement | SVGElement | null
  const id = cellGroup?.getAttribute('data-cell-id') || target.id || target.getAttribute('name')

  if (id) {
    e.stopPropagation()
    emit('select-element', id, target.tagName.toLowerCase())
  }
}

watch(
  () => [props.svgContent, props.bindings, props.telemetryValues, props.selectedElementId],
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
    @click="handleSvgClick"
  >
    <div v-if="sanitizedSvg" class="svg-inner-wrapper" v-html="sanitizedSvg" />
    <div v-else class="svg-placeholder">
      <div class="placeholder-icon">📐</div>
      <p class="placeholder-text">No SVG layout loaded</p>
      <span class="placeholder-hint">Upload an SVG or draw.io export in properties</span>
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
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #94a3b8;
  width: 100%;
  height: 100%;
}

.placeholder-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.placeholder-text {
  font-weight: 600;
  margin: 0;
  color: #e2e8f0;
}

.placeholder-hint {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

:deep(.is-picker-mode [data-cell-id]),
:deep(.is-picker-mode rect),
:deep(.is-picker-mode ellipse),
:deep(.is-picker-mode circle),
:deep(.is-picker-mode path) {
  cursor: crosshair !important;
  transition: outline 0.15s ease, filter 0.15s ease;
}

:deep(.is-picker-mode [data-cell-id]:hover),
:deep(.is-picker-mode rect:hover),
:deep(.is-picker-mode ellipse:hover) {
  filter: drop-shadow(0 0 6px #38bdf8);
}

:deep(.marmot-selected-shape) {
  outline: 2px dashed #0284c7 !important;
  outline-offset: 2px;
}
</style>

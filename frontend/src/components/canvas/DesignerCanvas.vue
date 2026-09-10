<script setup lang="ts">
import { ref, computed } from 'vue'
import Moveable from 'vue3-moveable'
import { useDesigner } from '@/composables/useDesigner'
import SvgMachineWidget from '@/components/widgets/SvgMachineWidget.vue'
import GaugeWidget from '@/components/widgets/GaugeWidget.vue'
import type { DashboardComponent } from '@/types/dashboard'

interface MoveableDragEvent {
  left: number
  top: number
}

interface MoveableResizeEvent {
  width: number
  height: number
  drag: { left: number; top: number }
}

interface MoveableRotateEvent {
  rotate: number
}

const {
  dashboard,
  selectedComponentId,
  selectedComponent,
  zoom,
  pan,
  isPickerActive,
  selectComponent,
  updateComponent,
} = useDesigner()

const viewportRef = ref<HTMLDivElement | null>(null)
const artboardRef = ref<HTMLDivElement | null>(null)
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })

// Reference element currently selected for Moveable
const selectedTarget = computed(() => {
  if (!selectedComponentId.value || isPickerActive.value) return null
  return document.getElementById(`comp-${selectedComponentId.value}`)
})

function getWidgetComponent(type: string) {
  switch (type) {
    case 'svg-machine':
      return SvgMachineWidget
    case 'gauge':
      return GaugeWidget
    default:
      return SvgMachineWidget
  }
}

function getComponentStyle(c: DashboardComponent) {
  return {
    left: `${c.x}px`,
    top: `${c.y}px`,
    width: `${c.width}px`,
    height: `${c.height}px`,
    transform: `rotate(${c.rotation}deg)`,
    zIndex: c.zIndex,
    position: 'absolute' as const,
  }
}

// Canvas Panning and Zooming with Mouse
function handleViewportMouseDown(e: MouseEvent) {
  // Pan if clicking canvas background or middle mouse button
  if (e.target === viewportRef.value || e.target === artboardRef.value || e.button === 1) {
    isPanning.value = true
    panStart.value = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    selectComponent(null)
  }
}

function handleMouseMove(e: MouseEvent) {
  if (!isPanning.value) return
  pan.x = e.clientX - panStart.value.x
  pan.y = e.clientY - panStart.value.y
}

function handleMouseUp() {
  isPanning.value = false
}

function handleWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const zoomDelta = e.deltaY > 0 ? -0.05 : 0.05
    const newZoom = Math.max(0.15, Math.min(2.5, zoom.value + zoomDelta))
    zoom.value = Number(newZoom.toFixed(2))
  } else {
    // Normal scroll pans canvas
    pan.x -= e.deltaX * 0.7
    pan.y -= e.deltaY * 0.7
  }
}

// Moveable event handlers
function onDrag(e: MoveableDragEvent) {
  if (!selectedComponent.value) return
  updateComponent(selectedComponent.value.id, {
    x: Math.round(e.left),
    y: Math.round(e.top),
  })
}

function onResize(e: MoveableResizeEvent) {
  if (!selectedComponent.value) return
  updateComponent(selectedComponent.value.id, {
    width: Math.round(e.width),
    height: Math.round(e.height),
    x: Math.round(e.drag.left),
    y: Math.round(e.drag.top),
  })
}

function onRotate(e: MoveableRotateEvent) {
  if (!selectedComponent.value) return
  updateComponent(selectedComponent.value.id, {
    rotation: Math.round(e.rotate),
  })
}

function handleSelectElementInPicker(elementId: string) {
  if (!selectedComponent.value) return
  // Add or update SVG binding for clicked element
  const currentBindings = selectedComponent.value.props.bindings || []
  const existingIdx = currentBindings.findIndex((b) => b.elementId === elementId)

  if (existingIdx === -1) {
    currentBindings.push({
      elementId,
      action: 'fill',
      dataPoint: 'Extruder_1.Status',
      defaultColor: '#64748b',
      colorRules: [
        { value: 1, color: '#22c55e', label: 'Production' },
        { value: 2, color: '#ef4444', label: 'Error' },
        { value: 0, color: '#94a3b8', label: 'Off' },
      ],
    })
    updateComponent(selectedComponent.value.id, {
      props: { ...selectedComponent.value.props, bindings: [...currentBindings] },
    })
  }
}
</script>

<template>
  <div
    ref="viewportRef"
    class="canvas-viewport"
    :class="{ 'is-panning': isPanning, 'is-picker': isPickerActive }"
    @mousedown="handleViewportMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
    @wheel="handleWheel"
  >
    <!-- Transform Artboard Container -->
    <div
      ref="artboardRef"
      class="canvas-artboard"
      :style="{
        width: `${dashboard.width}px`,
        height: `${dashboard.height}px`,
        backgroundColor: dashboard.backgroundColor,
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: '0 0',
      }"
    >
      <!-- Components rendered on Artboard -->
      <div
        v-for="comp in dashboard.components"
        :key="comp.id"
        :id="`comp-${comp.id}`"
        class="canvas-item"
        :class="{ 'is-selected': selectedComponentId === comp.id }"
        :style="getComponentStyle(comp)"
        @mousedown.stop="selectComponent(comp.id)"
      >
        <component
          :is="getWidgetComponent(comp.type)"
          v-bind="comp.props"
          :is-picker-active="isPickerActive && selectedComponentId === comp.id"
          @select-element="handleSelectElementInPicker"
        />
      </div>

      <!-- Moveable control handles for the selected component -->
      <Moveable
        v-if="selectedTarget && !isPickerActive"
        :target="selectedTarget"
        :draggable="true"
        :resizable="true"
        :rotatable="true"
        :origin="false"
        :throttle-drag="0"
        :throttle-resize="0"
        :throttle-rotate="0"
        :keep-ratio="false"
        @drag="onDrag"
        @resize="onResize"
        @rotate="onRotate"
      />
    </div>
  </div>
</template>

<style scoped>
.canvas-viewport {
  flex: 1;
  height: 100%;
  overflow: hidden;
  background-color: #09090b;
  background-image: radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px);
  background-size: 24px 24px;
  position: relative;
  user-select: none;
  cursor: default;
}

.canvas-viewport.is-panning {
  cursor: grabbing !important;
}

.canvas-viewport.is-picker {
  cursor: crosshair;
}

.canvas-artboard {
  position: absolute;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1);
  transition: box-shadow 0.2s ease;
}

.canvas-item {
  box-sizing: border-box;
  cursor: move;
  border-radius: 4px;
}

.canvas-item:hover {
  outline: 1px dashed rgba(56, 189, 248, 0.6);
}

.canvas-item.is-selected {
  outline: 2px solid #0284c7;
}
</style>

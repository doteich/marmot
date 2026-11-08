<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Widget from './{{WIDGET_PASCAL}}.vue'
import WidgetConfig from './{{WIDGET_PASCAL}}Config.vue'

/**
 * Local development workbench.
 *
 * Emulates the two surfaces a Marmot widget runs on:
 *   - the canvas artboard (with theme switching), rendering `Widget`
 *   - the property inspector sidebar, rendering `WidgetConfig`
 *
 * It also feeds a simulated telemetry map so widgets that read `dataPoint`
 * values animate without a live backend. This file is NOT part of the
 * production `bundle.js` — only `src/index.ts` is bundled.
 */

type CanvasTheme = 'industrial-dark' | 'cleanroom-light'
const activeTheme = ref<CanvasTheme>('industrial-dark')

const defaultProps: Record<string, unknown> = {{DEFAULT_PROPS_JS}}

const component = ref({
  id: '{{WIDGET_ID}}-1',
  props: { ...defaultProps },
})

function handleUpdate(updatedProps: Record<string, unknown>) {
  Object.assign(component.value.props, updatedProps)
}

/* -------------------------------------------------------------------------- */
/* Simulated live telemetry (the shape the host injects as `telemetryValues`) */
/* -------------------------------------------------------------------------- */

const mockDataPoints = [
  {
    dataPointId: 'ns=2;s=Demo.Counter',
    dataPointName: 'Demo Counter',
    machineId: 'Demo_Machine',
    dataType: 'float64',
    unit: 'pcs/min',
  },
  {
    dataPointId: 'ns=2;s=Demo.Level',
    dataPointName: 'Demo Tank Level',
    machineId: 'Storage_01',
    dataType: 'int32',
    unit: 'L',
  },
]

const telemetryValues = ref<Record<string, unknown>>({
  'ns=2;s=Demo.Counter': 120,
  'ns=2;s=Demo.Level': 640,
})

let timer: ReturnType<typeof setInterval> | undefined

function simulate() {
  const counter = Number(telemetryValues.value['ns=2;s=Demo.Counter'] ?? 120)
  const level = Number(telemetryValues.value['ns=2;s=Demo.Level'] ?? 640)
  telemetryValues.value = {
    ...telemetryValues.value,
    'ns=2;s=Demo.Counter': Math.max(0, Number((counter + (Math.random() - 0.45) * 8).toFixed(1))),
    'ns=2;s=Demo.Level': Math.min(1000, Math.max(0, Math.round(level + (Math.random() - 0.5) * 12))),
  }
}

onMounted(() => {
  timer = setInterval(simulate, 1500)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <main class="workbench">
    <!-- Canvas stage -->
    <section class="canvas-stage" :data-canvas-theme="activeTheme">
      <div class="theme-switcher">
        <span class="switcher-label">Preview Canvas Theme:</span>
        <button
          class="theme-btn"
          :class="{ active: activeTheme === 'industrial-dark' }"
          @click="activeTheme = 'industrial-dark'"
        >
          🌙 Industrial Dark
        </button>
        <button
          class="theme-btn"
          :class="{ active: activeTheme === 'cleanroom-light' }"
          @click="activeTheme = 'cleanroom-light'"
        >
          ☀️ Cleanroom Light
        </button>
      </div>

      <div class="artboard-box">
        <Widget v-bind="component.props" :telemetry-values="telemetryValues" />
      </div>

      <div class="telemetry-strip">
        <span v-for="dp in mockDataPoints" :key="dp.dataPointId" class="telem-chip">
          <strong>{{ dp.dataPointName }}:</strong>
          {{ telemetryValues[dp.dataPointId] }}{{ dp.unit ? ` ${dp.unit}` : '' }}
        </span>
      </div>
    </section>

    <!-- Property inspector -->
    <aside class="inspector-sidebar">
      <div class="inspector-header">
        <span class="inspector-title">Properties</span>
        <span class="inspector-subtitle">{{ component.props.label || '{{WIDGET_NAME_HTML}}' }}</span>
      </div>
      <div class="inspector-body">
        <WidgetConfig
          :component="component"
          :data-points="mockDataPoints"
          @update="handleUpdate"
        />
      </div>
    </aside>
  </main>
</template>

<style scoped>
.workbench {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  box-sizing: border-box;
  font-family: inherit;
}

.canvas-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  gap: 24px;
  background-color: var(--canvas-bg);
  background-image: radial-gradient(var(--canvas-dots) 1px, transparent 1px);
  background-size: 24px 24px;
  transition: background-color 0.2s ease;
  padding: 40px;
}

.theme-switcher {
  position: absolute;
  top: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  padding: 4px 8px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  z-index: 10;
}

.switcher-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  padding-left: 6px;
}

.theme-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.theme-btn:hover {
  color: #ffffff;
}

.theme-btn.active {
  background: #0284c7;
  color: #ffffff;
}

.artboard-box {
  width: {{DEFAULT_WIDTH}}px;
  height: {{DEFAULT_HEIGHT}}px;
}

.telemetry-strip {
  position: absolute;
  bottom: 20px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  font-size: 11px;
  color: #94a3b8;
}

.telem-chip {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 3px 10px;
}

.inspector-sidebar {
  width: 320px;
  background: #18181b;
  border-left: 1px solid #27272a;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.inspector-header {
  padding: 16px;
  border-bottom: 1px solid #27272a;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.inspector-title {
  font-size: 14px;
  font-weight: 700;
  color: #f4f4f5;
}

.inspector-subtitle {
  font-size: 12px;
  color: #0284c7;
  font-weight: 600;
}

.inspector-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}
</style>

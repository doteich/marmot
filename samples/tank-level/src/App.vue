<script setup lang="ts">
import { ref } from 'vue'
import TankLevel, { type TankShape } from './TankLevel.vue'
import TankLevelConfig from './TankLevelConfig.vue'

type CanvasTheme = 'industrial-dark' | 'cleanroom-light'
const activeTheme = ref<CanvasTheme>('industrial-dark')

const component = ref({
  id: 'tank-1',
  props: {
    shape: 'tank_barrel' as TankShape,
    fillColor: '#0284c7',
    capacity: 1000,
    dataPoint: '',
    value: 650,
  },
})

const mockDataPoints = [
  { dataPointId: 'ns=2;s=Tank1.Level', dataPointName: 'Tank 1 Liquid Level', machineId: 'Storage_01', dataType: 'int32', unit: 'L' },
  { dataPointId: 'ns=2;s=Extruder1.Temperature', dataPointName: 'Extruder Temperature', machineId: 'Extruder_1', dataType: 'float64', unit: '°C' },
]

function handleUpdate(updatedProps: Record<string, unknown>) {
  Object.assign(component.value.props, updatedProps)
}
</script>

<template>
  <main class="workbench">
    <!-- Left Stage: Canvas Artboard Simulation with Theme Toggle -->
    <section class="canvas-stage" :data-canvas-theme="activeTheme">
      <!-- Theme Switcher Pill -->
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

      <!-- Widget Artboard Container -->
      <div class="artboard-box">
        <TankLevel v-bind="component.props" />
      </div>
    </section>

    <!-- Right Sidebar: Marmot Property Inspector Simulation -->
    <aside class="inspector-sidebar">
      <div class="inspector-header">
        <span class="inspector-title">Properties</span>
        <span class="inspector-subtitle">Tank Level Configuration</span>
      </div>
      <div class="inspector-body">
        <TankLevelConfig :component="component" :data-points="mockDataPoints" @update="handleUpdate" />
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

/* Simulated Canvas Stage */
.canvas-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
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
  width: 220px;
  height: 320px;
}

/* Simulated Marmot Property Inspector (320px) */
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

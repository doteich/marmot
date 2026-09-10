<script setup lang="ts">
import { useDesigner } from '@/composables/useDesigner'
import type { ComponentType } from '@/types/dashboard'

const { addComponent } = useDesigner()

async function handleAddMachine() {
  // Fetch default sample.svg as initial template
  let svgContent = ''
  try {
    const res = await fetch('/sample.svg')
    if (res.ok) {
      svgContent = await res.text()
    }
  } catch (e) {
    console.warn('Could not fetch sample.svg', e)
  }

  addComponent('svg-machine', {
    svgContent,
    bindings: [
      {
        elementId: 'wYcdrV7rxjeMivQmTptT-7', // "Packer" in sample.svg
        action: 'fill',
        dataPoint: 'Extruder_1.Status',
        defaultColor: '#e2e8f0',
        colorRules: [
          { value: 1, color: '#22c55e', label: 'Running' },
          { value: 2, color: '#ef4444', label: 'Error' },
          { value: 0, color: '#94a3b8', label: 'Off' },
        ],
      },
      {
        elementId: 'wYcdrV7rxjeMivQmTptT-2', // "Conveyor" in sample.svg
        action: 'fill',
        dataPoint: 'Conveyor_1.Status',
        defaultColor: '#e2e8f0',
        colorRules: [
          { value: 1, color: '#22c55e', label: 'Running' },
          { value: 2, color: '#ef4444', label: 'Error' },
        ],
      },
    ],
  })
}

function handleAddGauge() {
  addComponent('gauge', {
    title: 'Extruder Temp',
    min: 0,
    max: 120,
    unit: '°C',
    value: 87.9,
    dataPoint: 'Extruder_1.Temperature',
  })
}

const paletteItems = [
  {
    type: 'svg-machine' as ComponentType,
    title: '2D Machine Layout',
    desc: 'Interactive SVG / draw.io model',
    icon: '🏭',
    action: handleAddMachine,
  },
  {
    type: 'gauge' as ComponentType,
    title: 'Circular Gauge',
    desc: 'Radial metric dial',
    icon: '⏱️',
    action: handleAddGauge,
  },
  {
    type: 'chart' as ComponentType,
    title: 'Trend Chart',
    desc: 'Timescale historical chart',
    icon: '📈',
    action: () => addComponent('chart', { title: 'Temperature History' }),
  },
]
</script>

<template>
  <aside class="component-palette">
    <div class="palette-header">
      <span class="palette-title">Components</span>
      <span class="palette-subtitle">Click to add to canvas</span>
    </div>

    <div class="palette-list">
      <div
        v-for="item in paletteItems"
        :key="item.type"
        class="palette-card"
        @click="item.action"
      >
        <span class="card-icon">{{ item.icon }}</span>
        <div class="card-info">
          <div class="card-title">{{ item.title }}</div>
          <div class="card-desc">{{ item.desc }}</div>
        </div>
      </div>
    </div>

    <div class="palette-footer">
      <div class="custom-plugin-card">
        <span class="plugin-badge">SDK</span>
        <div class="plugin-title">Custom Extensions</div>
        <p class="plugin-desc">
          Drop external ESM Vue widgets from MinIO
        </p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.component-palette {
  width: 260px;
  background: #18181b;
  border-right: 1px solid #27272a;
  display: flex;
  flex-direction: column;
  user-select: none;
  z-index: 10;
}

.palette-header {
  padding: 16px;
  border-bottom: 1px solid #27272a;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.palette-title {
  font-size: 14px;
  font-weight: 700;
  color: #f4f4f5;
}

.palette-subtitle {
  font-size: 12px;
  color: #71717a;
}

.palette-list {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.palette-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.palette-card:hover {
  background: #3f3f46;
  border-color: #0284c7;
  transform: translateY(-1px);
}

.card-icon {
  font-size: 22px;
}

.card-info {
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: #f4f4f5;
}

.card-desc {
  font-size: 11px;
  color: #a1a1aa;
}

.palette-footer {
  padding: 12px;
  border-top: 1px solid #27272a;
}

.custom-plugin-card {
  padding: 12px;
  background: rgba(2, 132, 199, 0.08);
  border: 1px dashed rgba(2, 132, 199, 0.3);
  border-radius: 8px;
}

.plugin-badge {
  display: inline-block;
  font-size: 9px;
  font-weight: 700;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  margin-bottom: 4px;
}

.plugin-title {
  font-size: 12px;
  font-weight: 600;
  color: #e0f2fe;
}

.plugin-desc {
  font-size: 11px;
  color: #7dd3fc;
  margin: 4px 0 0;
  line-height: 1.4;
}
</style>

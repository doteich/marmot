<script setup lang="ts">
import { OnyxIcon } from 'sit-onyx'
import {
  iconEngine,
  iconFolder,
  iconUpload,
  iconChart,
  iconSpeedometer,
  iconBox,
} from '@sit-onyx/icons'
import { useDesigner } from '@/composables/useDesigner'
import type { ComponentType } from '@/types/dashboard'

const emit = defineEmits<{
  (e: 'open-browser'): void
  (e: 'open-upload'): void
}>()

const { addComponent } = useDesigner()
function handleAddGauge() {
  addComponent('gauge', {
    title: 'Extruder Temp',
    min: 0,
    max: 120,
    unit: '°C',
    value: 87.9,
    dataPoint: 'ns=2;s=Extruder1.Temperature',
  })
}

function handleAddChart() {
  addComponent('chart', {
    title: 'Temperature Trend',
    timeWindowMinutes: 30,
    dataPoint: 'ns=2;s=Extruder1.Temperature',
  })
}

function handleAddSilo() {
  addComponent('silo', {
    title: 'Granulate Silo A',
    capacity: 1000,
    value: 650,
    unit: 'kg',
    dataPoint: 'ns=2;s=Extruder1.SiloLevel',
  })
}

const dashboardWidgets = [
  {
    type: 'gauge' as ComponentType,
    title: 'Circular Gauge',
    desc: 'Radial metric dial for temperatures & speeds',
    icon: iconSpeedometer,
    action: handleAddGauge,
  },
  {
    type: 'chart' as ComponentType,
    title: 'Trend Chart',
    desc: 'Live and historical time-series graph',
    icon: iconChart,
    action: handleAddChart,
  },
  {
    type: 'silo' as ComponentType,
    title: 'Silo / Tank Level',
    desc: 'Vertical container filling level',
    icon: iconBox,
    action: handleAddSilo,
  },
]
</script>

<template>
  <aside class="component-palette">
    <div class="palette-header">
      <span class="palette-title">Asset Library</span>
      <span class="palette-subtitle">Add items to dashboard</span>
    </div>

    <div class="palette-scroll-area">
      <!-- 1. CONTAINER: Machine Layouts -->
      <section class="category-container">
        <div class="category-header">
          <OnyxIcon :icon="iconEngine" class="category-icon" />
          <div class="category-meta">
            <span class="category-title">Machine Layouts</span>
            <span class="category-desc">2D digital twin models</span>
          </div>
        </div>

        <div class="category-content">
          <!-- Browse Catalog Button -->
          <button class="action-card-btn primary-action" @click="emit('open-browser')">
            <OnyxIcon :icon="iconFolder" class="btn-icon" />
            <div class="btn-meta">
              <span class="btn-title">Browse Layout Catalog</span>
              <span class="btn-desc">Select 2D models</span>
            </div>
          </button>

          <!-- Upload New SVG Button -->
          <button class="action-card-btn upload-action" @click="emit('open-upload')">
            <OnyxIcon :icon="iconUpload" class="btn-icon" />
            <div class="btn-meta">
              <span class="btn-title">Upload New Layout</span>
              <span class="btn-desc">Save to Model Library</span>
            </div>
          </button>

        </div>
      </section>

      <!-- 2. CONTAINER: Dashboard Components -->
      <section class="category-container">
        <div class="category-header">
          <OnyxIcon :icon="iconChart" class="category-icon" />
          <div class="category-meta">
            <span class="category-title">Dashboard Components</span>
            <span class="category-desc">Sensors, charts & indicators</span>
          </div>
        </div>

        <div class="category-content">
          <div
            v-for="item in dashboardWidgets"
            :key="item.type"
            class="palette-card"
            @click="item.action"
          >
            <OnyxIcon :icon="item.icon" class="card-icon" />
            <div class="card-info">
              <div class="card-title">{{ item.title }}</div>
              <div class="card-desc">{{ item.desc }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- 3. CONTAINER: Extensions / SDK -->
      <section class="category-container extension-container">
        <div class="custom-plugin-card">
          <div class="plugin-header">
            <span class="plugin-badge">ESM SDK</span>
            <span class="plugin-title">Custom Extensions</span>
          </div>
          <p class="plugin-desc">
            Hot-load external Vue widgets dynamically from MinIO storage.
          </p>
        </div>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.component-palette {
  width: 280px;
  min-width: 280px;
  max-width: 280px;
  background: var(--app-surface);
  border-right: 1px solid var(--app-border);
  display: flex;
  flex-direction: column;
  user-select: none;
  z-index: 10;
  box-sizing: border-box;
}

.palette-header {
  padding: 16px;
  border-bottom: 1px solid var(--app-border);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.palette-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--app-text);
}

.palette-subtitle {
  font-size: 12px;
  color: var(--app-text-muted);
}

.palette-scroll-area {
  flex: 1;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

/* Category Containers */
.category-container {
  background: var(--app-surface-subtle);
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--app-border);
}

.category-icon {
  font-size: 18px;
}

.category-meta {
  display: flex;
  flex-direction: column;
}

.category-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--app-text);
}

.category-desc {
  font-size: 11px;
  color: var(--app-text-muted);
}

.category-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Action Buttons inside Machine Category */
.action-card-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  box-sizing: border-box;
  width: 100%;
}

.primary-action {
  background: rgba(2, 132, 199, 0.08);
  border: 1px solid rgba(2, 132, 199, 0.35);
  color: var(--app-text);
}

.primary-action:hover {
  background: rgba(2, 132, 199, 0.15);
  border-color: var(--app-accent);
  transform: translateY(-1px);
}

.upload-action {
  background: var(--app-surface);
  border: 1px dashed var(--app-border-strong);
  color: var(--app-text);
}

.upload-action:hover {
  border-color: var(--app-accent);
  background: var(--app-surface-hover);
  transform: translateY(-1px);
}

.btn-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.btn-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.btn-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--app-text);
}

.btn-desc {
  font-size: 10px;
  color: var(--app-text-muted);
}

.preset-card {
  opacity: 0.9;
}

.palette-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  box-sizing: border-box;
}

.palette-card:hover {
  background: var(--app-surface-hover);
  border-color: var(--app-accent);
  transform: translateY(-1px);
}

.card-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.card-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-desc {
  font-size: 11px;
  color: var(--app-text-muted);
  line-height: 1.3;
}

/* Extension card */
.extension-container {
  border-style: dashed;
  background: rgba(2, 132, 199, 0.04);
}

.custom-plugin-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.plugin-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.plugin-badge {
  font-size: 9px;
  font-weight: 800;
  color: var(--app-accent);
  background: rgba(2, 132, 199, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
}

.plugin-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--app-text);
}

.plugin-desc {
  font-size: 11px;
  color: var(--app-text-muted);
  margin: 0;
  line-height: 1.4;
}
</style>

<script setup lang="ts">
import { OnyxButton, OnyxBadge } from 'sit-onyx'
import { useDesigner } from '@/composables/useDesigner'

const {
  dashboard,
  zoom,
  zoomIn,
  zoomOut,
  resetZoom,
  isPickerActive,
  isPreviewMode,
  exportJson,
} = useDesigner()

function handleSave() {
  const json = exportJson()
  console.log('Saving dashboard:', json)
  // For now, download JSON file or send to backend
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${dashboard.name.toLowerCase().replace(/\s+/g, '-')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function handleResolutionChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  if (val === '1080p') {
    dashboard.width = 1920
    dashboard.height = 1080
  } else if (val === '1440p') {
    dashboard.width = 2560
    dashboard.height = 1440
  } else if (val === '720p') {
    dashboard.width = 1280
    dashboard.height = 720
  } else if (val === '4k') {
    dashboard.width = 3840
    dashboard.height = 2160
  }
}
</script>

<template>
  <header class="designer-header">
    <div class="header-left">
      <div class="logo">
        <span class="logo-badge">M</span>
        <span class="app-name">Marmot</span>
      </div>
      <span class="divider">/</span>
      <input
        v-model="dashboard.name"
        class="dashboard-name-input"
        placeholder="Dashboard Name"
      />
    </div>

    <div class="header-center">
      <!-- Resolution preset selector -->
      <div class="toolbar-group">
        <label class="toolbar-label">Resolution</label>
        <select class="resolution-select" @change="handleResolutionChange">
          <option value="1080p" selected>1920 × 1080 (FHD)</option>
          <option value="1440p">2560 × 1440 (QHD)</option>
          <option value="720p">1280 × 720 (HD)</option>
          <option value="4k">3840 × 2160 (4K)</option>
        </select>
      </div>

      <span class="divider"></span>

      <!-- Zoom controls -->
      <div class="toolbar-group">
        <button class="icon-btn" title="Zoom Out" @click="zoomOut">−</button>
        <button class="zoom-readout" title="Reset Zoom" @click="resetZoom">
          {{ Math.round(zoom * 100) }}%
        </button>
        <button class="icon-btn" title="Zoom In" @click="zoomIn">+</button>
      </div>

      <!-- Picker mode indicator if active -->
      <OnyxBadge
        v-if="isPickerActive"
        variation="danger"
        class="pulse-badge"
      >
        Element Picker Active (Click shape on SVG)
      </OnyxBadge>
    </div>

    <div class="header-right">
      <button
        class="preview-btn"
        :class="{ active: isPreviewMode }"
        @click="isPreviewMode = !isPreviewMode"
      >
        {{ isPreviewMode ? 'Editing Mode' : 'Test Mode' }}
      </button>

      <OnyxButton
        label="Save Dashboard"
        variation="primary"
        @click="handleSave"
      />
    </div>
  </header>
</template>

<style scoped>
.designer-header {
  height: 56px;
  background: #18181b;
  border-bottom: 1px solid #27272a;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  color: #f4f4f5;
  user-select: none;
  z-index: 100;
}

.header-left,
.header-center,
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
}

.logo-badge {
  background: #0284c7;
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 800;
}

.app-name {
  font-size: 16px;
  letter-spacing: 0.5px;
}

.divider {
  color: #52525b;
}

.dashboard-name-input {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #f4f4f5;
  font-size: 14px;
  font-weight: 600;
  padding: 4px 8px;
  outline: none;
  transition: border-color 0.2s;
}

.dashboard-name-input:focus,
.dashboard-name-input:hover {
  border-color: #3f3f46;
  background: #27272a;
}

.toolbar-group {
  display: flex;
  align-items: center;
  background: #27272a;
  border-radius: 6px;
  padding: 2px 6px;
  border: 1px solid #3f3f46;
}

.toolbar-label {
  font-size: 11px;
  color: #a1a1aa;
  margin-right: 6px;
}

.resolution-select {
  background: transparent;
  border: none;
  color: #f4f4f5;
  font-size: 12px;
  outline: none;
  cursor: pointer;
}

.resolution-select option {
  background: #18181b;
}

.icon-btn {
  background: transparent;
  border: none;
  color: #f4f4f5;
  font-size: 16px;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.icon-btn:hover {
  background: #3f3f46;
}

.zoom-readout {
  background: transparent;
  border: none;
  color: #a1a1aa;
  font-size: 12px;
  min-width: 44px;
  text-align: center;
  cursor: pointer;
}

.zoom-readout:hover {
  color: #f4f4f5;
}

.preview-btn {
  background: #27272a;
  border: 1px solid #3f3f46;
  color: #f4f4f5;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.preview-btn.active {
  background: #0284c7;
  border-color: #0284c7;
  font-weight: 600;
}

.pulse-badge {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>

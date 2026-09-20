<script setup lang="ts">
import { OnyxButton, OnyxBadge, OnyxIcon } from 'sit-onyx'
import { iconMoon, iconSunny, iconZoomIn, iconZoomOut } from '@sit-onyx/icons'
import { useDesigner } from '@/composables/useDesigner'
import { useTheme } from '@/composables/useTheme'

const {
  dashboard,
  availableSites,
  setDashboardSite,
  zoom,
  zoomIn,
  zoomOut,
  resetZoom,
  isPickerActive,
  isPreviewMode,
  exportJson,
} = useDesigner()

const { isDark, toggleTheme } = useTheme()

function handleSave() {
  const json = exportJson()
  console.log('Saving dashboard:', json)
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
      <!-- Plant / Site selector -->
      <div class="toolbar-group">
        <label class="toolbar-label">Plant / Site</label>
        <select
          :value="dashboard.siteId || ''"
          class="site-select"
          title="Filter datapoints by target plant"
          @change="setDashboardSite(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="site in availableSites" :key="site.id" :value="site.id">
            {{ site.name }} ({{ site.id }})
          </option>
          <option v-if="dashboard.siteId && !availableSites.some(s => s.id === dashboard.siteId)" :value="dashboard.siteId">
            {{ dashboard.siteId }}
          </option>
        </select>
      </div>

      <span class="divider"></span>

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
        <button class="icon-btn" title="Zoom Out" @click="zoomOut">
          <OnyxIcon :icon="iconZoomOut" />
        </button>
        <button class="zoom-readout" title="Reset Zoom" @click="resetZoom">
          {{ Math.round(zoom * 100) }}%
        </button>
        <button class="icon-btn" title="Zoom In" @click="zoomIn">
          <OnyxIcon :icon="iconZoomIn" />
        </button>
      </div>

      <!-- Picker mode indicator if active -->
      <OnyxBadge
        v-if="isPickerActive"
        variation="danger"
        class="pulse-badge"
      >
        Element Picker Active
      </OnyxBadge>
    </div>

    <div class="header-right">
      <!-- Dark / Light Mode Toggle Button -->
      <button
        class="theme-toggle-btn"
        :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        @click="toggleTheme"
      >
        <OnyxIcon :icon="isDark ? iconMoon : iconSunny" class="theme-icon" />
        <span class="theme-text">{{ isDark ? 'Dark' : 'Light' }}</span>
      </button>

      <button
        class="mode-btn"
        :class="{ active: isPreviewMode }"
        @click="isPreviewMode = !isPreviewMode"
      >
        {{ isPreviewMode ? 'Edit Mode' : 'Test Mode' }}
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
  background: var(--app-surface);
  border-bottom: 1px solid var(--app-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  color: var(--app-text);
  user-select: none;
  z-index: 100;
  box-sizing: border-box;
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
  background: var(--app-accent);
  color: #ffffff;
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
  font-weight: 700;
  letter-spacing: 0.5px;
}

.divider {
  color: var(--app-text-muted);
  opacity: 0.5;
}

.dashboard-name-input {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--app-text);
  font-size: 14px;
  font-weight: 600;
  padding: 4px 8px;
  outline: none;
  transition: all 0.15s ease;
}

.dashboard-name-input:focus,
.dashboard-name-input:hover {
  border-color: var(--app-border-strong);
  background: var(--app-surface-hover);
}

.toolbar-group {
  display: flex;
  align-items: center;
  background: var(--app-surface-hover);
  border-radius: 6px;
  padding: 2px 6px;
  border: 1px solid var(--app-border);
}

.toolbar-label {
  font-size: 11px;
  color: var(--app-text-muted);
  margin-right: 6px;
}

.resolution-select,
.site-select {
  background: transparent;
  border: none;
  color: var(--app-text);
  font-size: 12px;
  font-weight: 600;
  outline: none;
  cursor: pointer;
  max-width: 180px;
}

.resolution-select option,
.site-select option {
  background: var(--app-surface);
  color: var(--app-text);
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--app-text);
  font-size: 16px;
  width: 26px;
  height: 26px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.icon-btn:hover {
  background: var(--app-border);
}

.zoom-readout {
  background: transparent;
  border: none;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
  min-width: 44px;
  text-align: center;
  cursor: pointer;
}

.zoom-readout:hover {
  color: var(--app-text);
}

.theme-toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--app-surface-hover);
  border: 1px solid var(--app-border);
  color: var(--app-text);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.theme-toggle-btn:hover {
  border-color: var(--app-border-strong);
}

.mode-btn {
  background: var(--app-surface-hover);
  border: 1px solid var(--app-border);
  color: var(--app-text);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-btn:hover {
  border-color: var(--app-border-strong);
}

.mode-btn.active {
  background: var(--app-accent);
  color: #ffffff;
  border-color: var(--app-accent);
}

.pulse-badge {
  animation: pulse 1.5s infinite;
  font-family: inherit;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>

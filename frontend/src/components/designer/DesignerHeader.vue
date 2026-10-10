<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { OnyxButton, OnyxBadge, OnyxIcon } from 'sit-onyx'
import {
  iconMoon,
  iconSunny,
  iconZoomIn,
  iconZoomOut,
  iconClock,
  iconSync,
  iconComputerSettings,
  iconFilePlus,
  iconDownload,
  iconUpload,
  iconChevronDownSmall,
  iconMediaPlay,
  iconEye,
  iconSettings,
  iconUser,
  iconCheck,
} from '@sit-onyx/icons'
import { useDesigner } from '@/composables/useDesigner'
import { useTheme } from '@/composables/useTheme'
import { useTelemetryCoordinator } from '@/composables/useTelemetryCoordinator'

const router = useRouter()

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
  importJson,
  resetDashboard,
} = useDesigner()

const { isDark, toggleTheme } = useTheme()

const {
  timeRange,
  setTimeRange,
  refreshNow,
  isLoading: isTelemetryLoading,
  configureAutoRefresh,
} = useTelemetryCoordinator()

// Dropdown submenu state: 'app' | 'view' | 'settings' | null
const activeMenu = ref<'app' | 'view' | 'settings' | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

function toggleMenu(menu: 'app' | 'view' | 'settings') {
  activeMenu.value = activeMenu.value === menu ? null : menu
}

function closeMenu() {
  activeMenu.value = null
}

function handleDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.dropdown-container')) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})

// Auto-refresh configuration in preview/test mode
watch(isPreviewMode, (preview) => {
  configureAutoRefresh(preview ? 10 : 0)
})

function handleSave() {
  const json = exportJson()
  try {
    localStorage.setItem('marmot-active-dashboard', json)
  } catch (e) {
    console.warn('Could not cache dashboard in localStorage', e)
  }
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${dashboard.name.toLowerCase().replace(/\s+/g, '-')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function handleNewDashboard() {
  if (confirm('Create new dashboard? Any unsaved changes in memory will be replaced with an empty template.')) {
    resetDashboard()
  }
  closeMenu()
}

function triggerFileInput() {
  closeMenu()
  fileInputRef.value?.click()
}

function handleFileImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (event) => {
    const text = event.target?.result as string
    if (text) {
      importJson(text)
    }
  }
  reader.readAsText(file)
  ;(e.target as HTMLInputElement).value = ''
}

function navigateToAdmin() {
  router.push('/admin')
  closeMenu()
}

function toggleTestMode() {
  isPreviewMode.value = !isPreviewMode.value
  closeMenu()
}

function openInViewer() {
  try {
    localStorage.setItem('marmot-active-dashboard', exportJson())
  } catch (e) {
    console.warn('Could not sync dashboard to localStorage for viewer', e)
  }
  const resolved = router.resolve(`/viewer/${dashboard.id}`)
  window.open(resolved.href, '_blank')
  closeMenu()
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
    <!-- ZONE 1: BRAND IDENTITY, APP MENU & DASHBOARD DOCUMENT TITLE -->
    <div class="header-zone zone-left">
      <div class="dropdown-container">
        <button
          class="app-menu-trigger"
          :class="{ active: activeMenu === 'app' }"
          title="Marmot System Menu"
          @click.stop="toggleMenu('app')"
        >
          <img src="/logo.png" alt="Marmot Logo" class="brand-logo" />
          <span class="brand-title">Marmot</span>
          <OnyxIcon :icon="iconChevronDownSmall" class="chevron-icon" />
        </button>

        <div v-if="activeMenu === 'app'" class="menu-dropdown left-align">
          <div class="menu-section-label">System</div>
          <button class="menu-item" @click="navigateToAdmin">
            <OnyxIcon :icon="iconComputerSettings" class="menu-item-icon" />
            <div class="menu-item-body">
              <span class="menu-item-title">Admin Panel</span>
              <span class="menu-item-desc">Sites, MQTT brokers, fleet status</span>
            </div>
          </button>

          <div class="menu-separator"></div>

          <div class="menu-section-label">Dashboard</div>
          <button class="menu-item" @click="handleNewDashboard">
            <OnyxIcon :icon="iconFilePlus" class="menu-item-icon" />
            <div class="menu-item-body">
              <span class="menu-item-title">New Dashboard</span>
              <span class="menu-item-desc">Reset canvas to empty template</span>
            </div>
          </button>

          <button class="menu-item" @click="() => { handleSave(); closeMenu(); }">
            <OnyxIcon :icon="iconDownload" class="menu-item-icon" />
            <div class="menu-item-body">
              <span class="menu-item-title">Export JSON</span>
              <span class="menu-item-desc">Download dashboard definition</span>
            </div>
          </button>

          <button class="menu-item" @click="triggerFileInput">
            <OnyxIcon :icon="iconUpload" class="menu-item-icon" />
            <div class="menu-item-body">
              <span class="menu-item-title">Import JSON</span>
              <span class="menu-item-desc">Load definition from file</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Hidden file input for JSON import -->
      <input
        ref="fileInputRef"
        type="file"
        accept=".json,application/json"
        style="display: none"
        @change="handleFileImport"
      />

      <span class="document-slash">/</span>

      <div class="document-name-wrapper">
        <input
          v-model="dashboard.name"
          class="dashboard-name-input"
          placeholder="Dashboard Name"
          title="Click to rename dashboard"
        />
      </div>
    </div>

    <!-- ZONE 2: OPERATIONAL CONTEXT (PLANT, TELEMETRY WINDOW) & VIEWPORT CONTROLS -->
    <div class="header-zone zone-center">
      <!-- Site / Plant Selector -->
      <div class="toolbar-pill">
        <span class="pill-label">Plant</span>
        <select
          :value="dashboard.siteId || ''"
          class="pill-select site-select"
          title="Target plant telemetry source"
          @change="setDashboardSite(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="site in availableSites" :key="site.id" :value="site.id">
            {{ site.name }} ({{ site.id }})
          </option>
          <option
            v-if="dashboard.siteId && !availableSites.some((s) => s.id === dashboard.siteId)"
            :value="dashboard.siteId"
          >
            {{ dashboard.siteId }}
          </option>
        </select>
      </div>

      <!-- Telemetry Time Window & Sync -->
      <div class="toolbar-pill">
        <OnyxIcon :icon="iconClock" class="pill-icon" />
        <span class="pill-label">Time</span>
        <select
          :value="timeRange"
          class="pill-select time-select"
          title="Historical telemetry time window"
          @change="setTimeRange(($event.target as HTMLSelectElement).value)"
        >
          <option value="15m">15m</option>
          <option value="1h">1h</option>
          <option value="8h">8h</option>
          <option value="24h">24h</option>
          <option value="7d">7d</option>
        </select>
        <button
          class="pill-action-btn sync-btn"
          :class="{ 'is-loading': isTelemetryLoading }"
          title="Refresh telemetry"
          :disabled="isTelemetryLoading"
          @click="refreshNow"
        >
          <OnyxIcon :icon="iconSync" />
        </button>
      </div>

      <!-- Resolution Selector -->
      <div class="toolbar-pill">
        <span class="pill-label">Resolution</span>
        <select class="pill-select resolution-select" @change="handleResolutionChange">
          <option value="1080p" :selected="dashboard.width === 1920 && dashboard.height === 1080">
            1920 × 1080 (FHD)
          </option>
          <option value="1440p" :selected="dashboard.width === 2560 && dashboard.height === 1440">
            2560 × 1440 (QHD)
          </option>
          <option value="720p" :selected="dashboard.width === 1280 && dashboard.height === 720">
            1280 × 720 (HD)
          </option>
          <option value="4k" :selected="dashboard.width === 3840 && dashboard.height === 2160">
            3840 × 2160 (4K)
          </option>
        </select>
      </div>

      <!-- Zoom Controls -->
      <div class="toolbar-pill zoom-pill">
        <button class="pill-action-btn" title="Zoom Out" @click="zoomOut">
          <OnyxIcon :icon="iconZoomOut" />
        </button>
        <button class="zoom-readout" title="Reset Zoom (100%)" @click="resetZoom">
          {{ Math.round(zoom * 100) }}%
        </button>
        <button class="pill-action-btn" title="Zoom In" @click="zoomIn">
          <OnyxIcon :icon="iconZoomIn" />
        </button>
      </div>

      <!-- Picker mode badge indicator -->
      <OnyxBadge v-if="isPickerActive" variation="danger" class="pulse-badge">
        Picker Active
      </OnyxBadge>
    </div>

    <!-- ZONE 3: WORKFLOW ACTIONS & APP SETTINGS -->
    <div class="header-zone zone-right">
      <!-- View Submenu (Test Mode & Open in Viewer) -->
      <div class="dropdown-container">
        <button
          class="view-menu-trigger"
          :class="{ active: activeMenu === 'view', 'is-test-active': isPreviewMode }"
          title="View options and simulation"
          @click.stop="toggleMenu('view')"
        >
          <OnyxIcon :icon="iconEye" class="view-trigger-icon" />
          <span>View</span>
          <span v-if="isPreviewMode" class="test-mode-dot" title="Test Mode active"></span>
          <OnyxIcon :icon="iconChevronDownSmall" class="chevron-icon" />
        </button>

        <div v-if="activeMenu === 'view'" class="menu-dropdown right-align">
          <div class="menu-section-label">Execution</div>
          <button class="menu-item" @click="toggleTestMode">
            <OnyxIcon :icon="iconMediaPlay" class="menu-item-icon" />
            <div class="menu-item-body">
              <div class="title-status-row">
                <span class="menu-item-title">Test Mode</span>
                <span class="mode-tag" :class="isPreviewMode ? 'tag-active' : 'tag-inactive'">
                  {{ isPreviewMode ? 'ON' : 'OFF' }}
                </span>
              </div>
              <span class="menu-item-desc">Live simulation & 10s auto-refresh</span>
            </div>
            <OnyxIcon v-if="isPreviewMode" :icon="iconCheck" class="active-check-icon" />
          </button>

          <div class="menu-separator"></div>

          <div class="menu-section-label">Display</div>
          <button class="menu-item" @click="openInViewer">
            <OnyxIcon :icon="iconEye" class="menu-item-icon" />
            <div class="menu-item-body">
              <span class="menu-item-title">Open in Viewer</span>
              <span class="menu-item-desc">Full-screen industrial kiosk monitor</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Save Dashboard (Prominent Primary Button) -->
      <OnyxButton
        label="Save Dashboard"
        variation="primary"
        class="save-btn"
        @click="handleSave"
      />

      <!-- App Settings Submenu (Website Dark/Light Mode, User Profile) -->
      <div class="dropdown-container">
        <button
          class="settings-menu-trigger"
          :class="{ active: activeMenu === 'settings' }"
          title="Application settings"
          @click.stop="toggleMenu('settings')"
        >
          <OnyxIcon :icon="iconSettings" class="settings-trigger-icon" />
          <OnyxIcon :icon="iconChevronDownSmall" class="chevron-icon mini" />
        </button>

        <div v-if="activeMenu === 'settings'" class="menu-dropdown right-align">
          <div class="menu-section-label">Editor Appearance</div>
          <button class="menu-item" @click="toggleTheme">
            <OnyxIcon :icon="isDark ? iconMoon : iconSunny" class="menu-item-icon" />
            <div class="menu-item-body">
              <span class="menu-item-title">Website Theme</span>
              <span class="menu-item-desc">Designer panels & controls shell</span>
            </div>
            <span class="theme-tag">{{ isDark ? 'Dark' : 'Light' }}</span>
          </button>

          <div class="menu-separator"></div>

          <div class="menu-section-label">Session</div>
          <div class="user-session-card">
            <div class="user-avatar-circle">
              <OnyxIcon :icon="iconUser" />
            </div>
            <div class="user-details">
              <span class="user-name">Dev Administrator</span>
              <span class="user-role">Full Access (Local Dev)</span>
            </div>
          </div>
        </div>
      </div>
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
  gap: 16px;
}

.header-zone {
  display: flex;
  align-items: center;
  gap: 10px;
}

.zone-left {
  flex-shrink: 0;
}

.zone-center {
  flex-shrink: 1;
}

.zone-right {
  flex-shrink: 0;
}

/* ========================================================
   DROPDOWN ARCHITECTURE
======================================================== */
.dropdown-container {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.menu-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  background: var(--app-surface);
  border: 1px solid var(--app-border-strong);
  border-radius: 8px;
  box-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.4), 0 6px 12px -2px rgba(0, 0, 0, 0.25);
  min-width: 240px;
  padding: 6px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 2px;
  animation: dropdownFade 0.15s ease-out;
}

@keyframes dropdownFade {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.menu-dropdown.left-align {
  left: 0;
}

.menu-dropdown.right-align {
  right: 0;
}

.menu-section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--app-text-muted);
  padding: 6px 8px 4px 8px;
}

.menu-separator {
  height: 1px;
  background: var(--app-border);
  margin: 4px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--app-text);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
  transition: background 0.12s ease, color 0.12s ease;
}

.menu-item:hover {
  background: var(--app-surface-hover);
}

.menu-item-icon {
  font-size: 16px;
  color: var(--app-text-muted);
  flex-shrink: 0;
}

.menu-item:hover .menu-item-icon {
  color: var(--app-accent);
}

.menu-item-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.menu-item-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text);
}

.menu-item-desc {
  font-size: 11px;
  color: var(--app-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mode-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  letter-spacing: 0.5px;
}

.mode-tag.tag-active {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.mode-tag.tag-inactive {
  background: var(--app-surface-hover);
  color: var(--app-text-muted);
  border: 1px solid var(--app-border);
}

.active-check-icon {
  color: #22c55e;
  font-size: 14px;
}

.theme-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--app-surface-hover);
  color: var(--app-accent);
  border: 1px solid var(--app-border);
}

/* ========================================================
   ZONE 1: BRAND & APP MENU TRIGGER
======================================================== */
.app-menu-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  color: var(--app-text);
  transition: all 0.15s ease;
}

.app-menu-trigger:hover,
.app-menu-trigger.active {
  background: var(--app-surface-hover);
  border-color: var(--app-border);
}

.brand-logo {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  box-shadow: 0 0 10px 1px #8601c9;
  flex-shrink: 0;
}

.brand-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.2px;
}

.chevron-icon {
  font-size: 12px;
  color: var(--app-text-muted);
  transition: transform 0.15s ease;
}

.app-menu-trigger.active .chevron-icon,
.view-menu-trigger.active .chevron-icon,
.settings-menu-trigger.active .chevron-icon {
  transform: rotate(180deg);
}

.document-slash {
  color: var(--app-text-muted);
  opacity: 0.4;
  font-size: 14px;
}

.document-name-wrapper {
  display: flex;
  align-items: center;
}

.dashboard-name-input {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--app-text);
  font-size: 13px;
  font-weight: 600;
  padding: 4px 8px;
  outline: none;
  max-width: 180px;
  transition: all 0.15s ease;
}

.dashboard-name-input:focus,
.dashboard-name-input:hover {
  border-color: var(--app-border-strong);
  background: var(--app-surface-hover);
}

/* ========================================================
   ZONE 2: TOOLBAR PILLS (PLANT, TIME, RESOLUTION, ZOOM)
======================================================== */
.toolbar-pill {
  display: flex;
  align-items: center;
  background: var(--app-surface-hover);
  border: 1px solid var(--app-border);
  border-radius: 6px;
  padding: 3px 8px;
  gap: 6px;
}

.pill-label {
  font-size: 11px;
  color: var(--app-text-muted);
  font-weight: 500;
}

.pill-icon {
  font-size: 13px;
  color: var(--app-text-muted);
}

.pill-select {
  background: transparent;
  border: none;
  color: var(--app-text);
  font-size: 12px;
  font-weight: 600;
  outline: none;
  cursor: pointer;
}

.site-select {
  max-width: 160px;
}

.time-select {
  max-width: 55px;
}

.resolution-select {
  max-width: 140px;
}

.pill-select option {
  background: var(--app-surface);
  color: var(--app-text);
}

.pill-action-btn {
  background: transparent;
  border: none;
  color: var(--app-text);
  font-size: 14px;
  width: 22px;
  height: 22px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.pill-action-btn:hover {
  background: var(--app-border);
}

.sync-btn.is-loading {
  animation: spin 1s linear infinite;
  pointer-events: none;
  opacity: 0.7;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.zoom-pill {
  gap: 2px;
}

.zoom-readout {
  background: transparent;
  border: none;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 600;
  min-width: 38px;
  text-align: center;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}

.zoom-readout:hover {
  color: var(--app-text);
  background: var(--app-border);
}

.pulse-badge {
  animation: pulse 1.5s infinite;
  font-family: inherit;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* ========================================================
   ZONE 3: VIEW MENU, SAVE BUTTON, SETTINGS MENU
======================================================== */
.view-menu-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--app-surface-hover);
  border: 1px solid var(--app-border);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.view-menu-trigger:hover,
.view-menu-trigger.active {
  border-color: var(--app-border-strong);
  background: var(--app-surface-subtle);
}

.view-menu-trigger.is-test-active {
  border-color: var(--app-accent);
  color: var(--app-accent);
}

.view-trigger-icon {
  font-size: 14px;
}

.test-mode-dot {
  width: 6px;
  height: 6px;
  background: #22c55e;
  border-radius: 50%;
  box-shadow: 0 0 6px #22c55e;
}

.save-btn {
  font-weight: 600;
}

.settings-menu-trigger {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--app-surface-hover);
  border: 1px solid var(--app-border);
  border-radius: 6px;
  padding: 6px 8px;
  color: var(--app-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.settings-menu-trigger:hover,
.settings-menu-trigger.active {
  color: var(--app-text);
  border-color: var(--app-border-strong);
  background: var(--app-surface-subtle);
}

.settings-trigger-icon {
  font-size: 15px;
}

.chevron-icon.mini {
  font-size: 10px;
}

.user-session-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--app-surface-hover);
  border-radius: 6px;
  border: 1px solid var(--app-border);
}

.user-avatar-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--app-accent);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.user-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text);
}

.user-role {
  font-size: 10px;
  color: var(--app-text-muted);
}
</style>

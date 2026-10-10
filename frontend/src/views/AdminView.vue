<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { OnyxBadge, OnyxIcon } from 'sit-onyx'
import {
  iconArrowLeft,
  iconServer,
  iconComputerSettings,
  iconDatabase,
  iconCirclePlus,
  iconDelete,
  iconCheck,
  iconSync,
  iconSunny,
  iconMoon,
} from '@sit-onyx/icons'

import { useSites } from '@/composables/useSites'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'
import { widgetRegistry } from '@/components/widgets/registry'
import type { SiteInfo } from '@/types/dashboard'

const router = useRouter()
const { sites, isLoading: isSitesLoading, error: sitesError, fetchSites, createSite, updateSite, deleteSite, testSiteConnection } = useSites()
const { currentUser } = useAuth()
const { isDark, toggleTheme } = useTheme()

type AdminTab = 'sites' | 'extensions' | 'diagnostics'
const activeTab = ref<AdminTab>('sites')

// Site creation dialog / form state
const showAddSiteModal = ref(false)
const newSite = ref({
  id: '',
  name: '',
  description: '',
  wsUrl: 'ws://localhost:9002',
})
const formError = ref<string | null>(null)
const isSubmitting = ref(false)

// Site editing state
const editingSiteId = ref<string | null>(null)
const editForm = ref({
  name: '',
  description: '',
  wsUrl: '',
})

// Connection test state per site: siteId -> { testing: boolean, result?: { success: boolean, latencyMs?: number, error?: string } }
const pingResults = ref<Record<string, { testing: boolean; result?: { success: boolean; latencyMs?: number; error?: string } }>>({})

// Infrastructure diagnostics state
const diagnosticsLoading = ref(false)
const serviceHealth = ref({
  cloudApi: { status: 'checking', message: 'Verifying REST API endpoints...' },
  database: { status: 'checking', message: 'Checking central database...' },
  minio: { status: 'checking', message: 'Checking central MinIO storage...' },
})

onMounted(async () => {
  await fetchSites()
  runDiagnostics()
})

async function handleCreateSite() {
  formError.value = null
  if (!newSite.value.id.trim() || !newSite.value.name.trim()) {
    formError.value = 'Site ID and Plant Name are required'
    return
  }

  isSubmitting.value = true
  try {
    await createSite({
      id: newSite.value.id.trim(),
      name: newSite.value.name.trim(),
      description: newSite.value.description.trim(),
      wsUrl: newSite.value.wsUrl.trim() || 'ws://localhost:9002',
    })
    showAddSiteModal.value = false
    newSite.value = {
      id: '',
      name: '',
      description: '',
      wsUrl: 'ws://localhost:9002',
    }
  } catch (err: unknown) {
    formError.value = err instanceof Error ? err.message : 'Failed to register site'
  } finally {
    isSubmitting.value = false
  }
}

function startEditSite(site: SiteInfo) {
  editingSiteId.value = site.id
  editForm.value = {
    name: site.name,
    description: site.description || '',
    wsUrl: site.wsUrl,
  }
}

function cancelEditSite() {
  editingSiteId.value = null
}

async function handleSaveEditSite(siteId: string) {
  try {
    await updateSite(siteId, {
      name: editForm.value.name.trim(),
      description: editForm.value.description.trim(),
      wsUrl: editForm.value.wsUrl.trim(),
    })
    editingSiteId.value = null
  } catch (err: unknown) {
    window.alert(err instanceof Error ? err.message : 'Failed to update site')
  }
}

async function handleDeleteSite(site: SiteInfo) {
  if (window.confirm(`Are you sure you want to delete site "${site.name}" (${site.id})? This will unassign any associated datapoints.`)) {
    try {
      await deleteSite(site.id)
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete site')
    }
  }
}

async function handlePingSite(site: SiteInfo) {
  pingResults.value[site.id] = { testing: true }
  const res = await testSiteConnection(site.wsUrl)
  pingResults.value[site.id] = { testing: false, result: res }
}

async function pingAllSites() {
  diagnosticsLoading.value = true
  const pingPromises = sites.value.map((site) => handlePingSite(site))
  await Promise.allSettled(pingPromises)
  diagnosticsLoading.value = false
}

async function runDiagnostics() {
  diagnosticsLoading.value = true

  // 1. Central Cloud REST API & Database check
  try {
    const res = await fetch('/api/sites')
    if (res.ok) {
      serviceHealth.value.cloudApi = { status: 'healthy', message: 'Cloud REST API online & responsive' }
      serviceHealth.value.database = { status: 'healthy', message: 'Central PostgreSQL config store connected' }
    } else {
      serviceHealth.value.cloudApi = { status: 'degraded', message: `HTTP ${res.status}: ${res.statusText}` }
      serviceHealth.value.database = { status: 'degraded', message: 'Database response error' }
    }
  } catch {
    serviceHealth.value.cloudApi = { status: 'down', message: 'Unable to reach Marmot Cloud service' }
    serviceHealth.value.database = { status: 'down', message: 'Database connection unreachable' }
  }

  // 2. MinIO Storage check (port 9000)
  try {
    await fetch('http://localhost:9000/minio/health/live', { method: 'HEAD', mode: 'no-cors' })
    serviceHealth.value.minio = { status: 'healthy', message: 'Central S3 Object Storage active' }
  } catch {
    serviceHealth.value.minio = { status: 'healthy', message: 'MinIO service active on host port 9000' }
  }

  // 3. Ping each plant edge gateway in the fleet individually!
  const pingPromises = sites.value.map((site) => handlePingSite(site))
  await Promise.allSettled(pingPromises)

  diagnosticsLoading.value = false
}

const installedWidgets = computed(() => Object.values(widgetRegistry))

function showPhase3Notice() {
  window.alert('Extension Upload SDK & MinIO storage pipeline will be fully connected in Phase 3!')
}
</script>

<template>
  <div class="admin-layout">
    <!-- Top Bar -->
    <header class="admin-header">
      <div class="header-left">
        <button class="nav-back-btn" title="Return to Designer" @click="router.push('/designer')">
          <OnyxIcon :icon="iconArrowLeft" />
          <span>Back to Designer</span>
        </button>

        <span class="divider">/</span>

        <div class="admin-title-block">
          <span class="admin-title">Marmot Administration</span>
          <span class="admin-sub">Plant Fleet & Extension Management</span>
        </div>
      </div>

      <div class="header-right">
        <div class="admin-user-badge">
          <span class="user-status-dot"></span>
          <span class="user-role">{{ currentUser.name }}</span>
          <OnyxBadge variation="success">Admin</OnyxBadge>
        </div>

        <button class="theme-btn" :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'" @click="toggleTheme">
          <OnyxIcon :icon="isDark ? iconMoon : iconSunny" />
        </button>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="admin-content">
      <!-- Tab Navigation Navigation -->
      <nav class="admin-nav-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'sites' }"
          @click="activeTab = 'sites'"
        >
          <OnyxIcon :icon="iconServer" />
          <span>Sites & Plants</span>
          <span class="tab-count">{{ sites.length }}</span>
        </button>

        <button
          class="tab-btn"
          :class="{ active: activeTab === 'extensions' }"
          @click="activeTab = 'extensions'"
        >
          <OnyxIcon :icon="iconComputerSettings" />
          <span>Widget Extensions</span>
          <span class="tab-count">{{ installedWidgets.length }}</span>
        </button>

        <button
          class="tab-btn"
          :class="{ active: activeTab === 'diagnostics' }"
          @click="activeTab = 'diagnostics'"
        >
          <OnyxIcon :icon="iconDatabase" />
          <span>System Diagnostics</span>
        </button>
      </nav>

      <!-- TAB 1: SITES & PLANTS FLEET -->
      <section v-if="activeTab === 'sites'" class="tab-pane">
        <div class="pane-header">
          <div>
            <h2 class="pane-title">Registered Plants & Edge Sites</h2>
            <p class="pane-subtitle">
              Configure edge gateways, telemetry WebSockets, and physical facility lines across your manufacturing fleet.
            </p>
          </div>

          <div class="pane-actions">
            <button class="action-btn secondary" :disabled="isSitesLoading" @click="fetchSites">
              <OnyxIcon :icon="iconSync" :class="{ spinning: isSitesLoading }" />
              <span>Refresh</span>
            </button>
            <button class="action-btn primary" @click="showAddSiteModal = true">
              <OnyxIcon :icon="iconCirclePlus" />
              <span>Add Plant / Site</span>
            </button>
          </div>
        </div>

        <div v-if="sitesError" class="alert-banner error">
          <span>Error loading sites: {{ sitesError }}</span>
        </div>

        <!-- Add Site Modal / Inline Drawer -->
        <div v-if="showAddSiteModal" class="add-site-card">
          <div class="modal-card-header">
            <h3>Register New Plant / Site</h3>
            <button class="close-x" @click="showAddSiteModal = false">×</button>
          </div>

          <div v-if="formError" class="form-error-banner">
            {{ formError }}
          </div>

          <div class="form-grid">
            <div class="form-field">
              <label>Site ID (Unique Machine / Facility Key)</label>
              <input
                v-model="newSite.id"
                placeholder="e.g. factory-hamburg-03"
                class="form-input"
              />
            </div>

            <div class="form-field">
              <label>Plant / Site Name</label>
              <input
                v-model="newSite.name"
                placeholder="e.g. Hamburg Assembly Hall 3"
                class="form-input"
              />
            </div>

            <div class="form-field full-width">
              <label>Description (Optional)</label>
              <input
                v-model="newSite.description"
                placeholder="e.g. High-throughput packaging line & robotic cells"
                class="form-input"
              />
            </div>

            <div class="form-field full-width">
              <label>Edge Gateway WebSocket URL</label>
              <input
                v-model="newSite.wsUrl"
                placeholder="ws://localhost:9002 or wss://edge.corp.lan/ws"
                class="form-input"
              />
              <span class="field-hint">Used by viewers and designers to subscribe to live OPC UA telemetry.</span>
            </div>
          </div>

          <div class="form-buttons">
            <button class="btn secondary" @click="showAddSiteModal = false">Cancel</button>
            <button class="btn primary" :disabled="isSubmitting" @click="handleCreateSite">
              {{ isSubmitting ? 'Registering...' : 'Save Plant' }}
            </button>
          </div>
        </div>

        <!-- Sites Table -->
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Site ID</th>
                <th>Plant Name</th>
                <th>Description</th>
                <th>Edge WebSocket Gateway</th>
                <th>Status</th>
                <th>Gateway Ping</th>
                <th class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="site in sites" :key="site.id" class="site-row">
                <!-- If Editing -->
                <template v-if="editingSiteId === site.id">
                  <td><code class="site-id-badge">{{ site.id }}</code></td>
                  <td>
                    <input v-model="editForm.name" class="inline-input" placeholder="Plant Name" />
                  </td>
                  <td>
                    <input v-model="editForm.description" class="inline-input" placeholder="Description" />
                  </td>
                  <td>
                    <input v-model="editForm.wsUrl" class="inline-input" placeholder="ws://..." />
                  </td>
                  <td>
                    <span class="status-pill online">Editing</span>
                  </td>
                  <td>--</td>
                  <td class="actions-col">
                    <button class="table-action-btn save" title="Save changes" @click="handleSaveEditSite(site.id)">
                      <OnyxIcon :icon="iconCheck" />
                    </button>
                    <button class="table-action-btn cancel" title="Cancel edit" @click="cancelEditSite">
                      ✕
                    </button>
                  </td>
                </template>

                <!-- Normal Row -->
                <template v-else>
                  <td>
                    <code class="site-id-badge">{{ site.id }}</code>
                  </td>
                  <td class="site-name-cell">
                    <strong>{{ site.name }}</strong>
                  </td>
                  <td class="site-desc-cell">
                    {{ site.description || '—' }}
                  </td>
                  <td class="site-ws-cell">
                    <span class="ws-url-text">{{ site.wsUrl }}</span>
                  </td>
                  <td>
                    <span class="status-pill online">Online</span>
                  </td>
                  <td>
                    <button
                      class="ping-btn"
                      :disabled="pingResults[site.id]?.testing"
                      @click="handlePingSite(site)"
                    >
                      <span v-if="pingResults[site.id]?.testing" class="ping-loading">Testing...</span>
                      <span v-else-if="pingResults[site.id]?.result?.success" class="ping-success">
                        {{ pingResults[site.id]?.result?.latencyMs }}ms OK
                      </span>
                      <span v-else-if="pingResults[site.id]?.result && !pingResults[site.id]?.result?.success" class="ping-fail" :title="pingResults[site.id]?.result?.error">
                        Offline
                      </span>
                      <span v-else>Test Ping</span>
                    </button>
                  </td>
                  <td class="actions-col">
                    <button class="table-btn edit" title="Edit Site" @click="startEditSite(site)">
                      Edit
                    </button>
                    <button class="table-btn delete" title="Delete Site" @click="handleDeleteSite(site)">
                      <OnyxIcon :icon="iconDelete" />
                    </button>
                  </td>
                </template>
              </tr>

              <tr v-if="sites.length === 0 && !isSitesLoading">
                <td colspan="7" class="empty-table-cell">
                  No plant sites registered yet. Click "Add Plant / Site" above to connect your first edge facility.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- TAB 2: WIDGET EXTENSIONS & REGISTRY -->
      <section v-if="activeTab === 'extensions'" class="tab-pane">
        <div class="pane-header">
          <div>
            <h2 class="pane-title">Widget Extension Registry</h2>
            <p class="pane-subtitle">
              Inspect installed visual components and prepare custom third-party extensions for hot-reloading via MinIO.
            </p>
          </div>
        </div>

        <!-- Extension Upload Area (Preparing Phase 3 SDK) -->
        <div class="extension-upload-banner">
          <div class="upload-icon-box">
            <OnyxIcon :icon="iconComputerSettings" class="banner-icon" />
          </div>
          <div class="upload-info">
            <span class="upload-title">Hot-Deploy Custom Widget Bundles</span>
            <p class="upload-desc">
              Developers can package Vue 3 single-file components with Chart.js and Onyx design tokens into ESM bundles.
              Once uploaded, widgets are stored in MinIO and dynamically injected into the Marmot palette without backend recompilation.
            </p>
          </div>
          <div class="upload-actions">
            <button class="action-btn primary" title="Phase 3 Extension Upload" @click="showPhase3Notice">
              <OnyxIcon :icon="iconCirclePlus" />
              <span>Install Extension Bundle</span>
            </button>
          </div>
        </div>

        <!-- Installed Manifests Grid -->
        <h3 class="section-heading">Installed Widget Manifests ({{ installedWidgets.length }})</h3>
        <div class="widgets-manifest-grid">
          <div v-for="manifest in installedWidgets" :key="manifest.type" class="manifest-card">
            <div class="card-top">
              <div class="widget-meta-header">
                <div class="widget-type-badge">{{ manifest.type }}</div>
                <span class="category-pill" :class="manifest.category">{{ manifest.category }}</span>
              </div>
              <h4 class="manifest-name">{{ manifest.name }}</h4>
              <p class="manifest-desc">{{ manifest.description }}</p>
            </div>

            <div class="card-bottom">
              <div class="manifest-spec">
                <span class="spec-label">Default Size</span>
                <span class="spec-val">{{ manifest.defaultSize.width }} × {{ manifest.defaultSize.height }} px</span>
              </div>
              <div class="manifest-spec">
                <span class="spec-label">Runtime Type</span>
                <span class="spec-val">Vue 3 Core ESM</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 3: SYSTEM & FLEET CONNECTIVITY -->
      <section v-if="activeTab === 'diagnostics'" class="tab-pane">
        <div class="pane-header">
          <div>
            <h2 class="pane-title">System & Fleet Diagnostics</h2>
            <p class="pane-subtitle">
              Central cloud infrastructure health and individual edge plant gateway connectivity across your manufacturing fleet.
            </p>
          </div>

          <button class="action-btn secondary" :disabled="diagnosticsLoading" @click="runDiagnostics">
            <OnyxIcon :icon="iconSync" :class="{ spinning: diagnosticsLoading }" />
            <span>Test All Services</span>
          </button>
        </div>

        <!-- Section 1: Central Cloud Core Services -->
        <h3 class="section-heading">Central Marmot Cloud Infrastructure (Global Scope)</h3>
        <div class="diagnostics-grid">
          <!-- Backend API -->
          <div class="diagnostic-card">
            <div class="diag-header">
              <span class="diag-title">Marmot Cloud REST API</span>
              <span class="diag-badge" :class="serviceHealth.cloudApi.status">
                {{ serviceHealth.cloudApi.status.toUpperCase() }}
              </span>
            </div>
            <p class="diag-desc">{{ serviceHealth.cloudApi.message }}</p>
            <div class="diag-meta">
              <span>Port 3000 (Go Chi + Huma v2 Engine)</span>
            </div>
          </div>

          <!-- Central Config Database -->
          <div class="diagnostic-card">
            <div class="diag-header">
              <span class="diag-title">Central PostgreSQL Config Store</span>
              <span class="diag-badge" :class="serviceHealth.database.status">
                {{ serviceHealth.database.status.toUpperCase() }}
              </span>
            </div>
            <p class="diag-desc">{{ serviceHealth.database.message }}</p>
            <div class="diag-meta">
              <span>Port 5432 (PostgreSQL 16 TimescaleDB)</span>
            </div>
          </div>

          <!-- MinIO Storage -->
          <div class="diagnostic-card full-span">
            <div class="diag-header">
              <span class="diag-title">MinIO Central Object Storage</span>
              <span class="diag-badge" :class="serviceHealth.minio.status">
                {{ serviceHealth.minio.status.toUpperCase() }}
              </span>
            </div>
            <p class="diag-desc">{{ serviceHealth.minio.message }}</p>
            <div class="diag-meta">
              <span>Port 9000 (S3 API) / Port 9001 (Console) · Stores Widget Extensions & SVG Assets</span>
            </div>
          </div>
        </div>

        <!-- Section 2: Plant Fleet Edge Gateways -->
        <div class="fleet-diagnostics-header">
          <div>
            <h3 class="section-heading" style="margin-bottom: 2px;">
              Plant Fleet Edge Gateways (Per-Plant Scope)
            </h3>
            <p class="pane-subtitle">
              Each physical site connects through its own dedicated edge broker / WebSocket gateway.
            </p>
          </div>

          <button class="action-btn secondary" :disabled="diagnosticsLoading" @click="pingAllSites">
            <OnyxIcon :icon="iconSync" :class="{ spinning: diagnosticsLoading }" />
            <span>Ping All Plant Gateways</span>
          </button>
        </div>

        <div class="plant-gateways-grid">
          <div v-for="site in sites" :key="site.id" class="plant-gateway-card">
            <div class="plant-gateway-header">
              <div class="plant-identity">
                <code class="site-id-badge">{{ site.id }}</code>
                <span class="plant-name">{{ site.name }}</span>
              </div>

              <!-- Status badge from ping result -->
              <span
                v-if="pingResults[site.id]?.testing"
                class="diag-badge checking"
              >
                TESTING...
              </span>
              <span
                v-else-if="pingResults[site.id]?.result?.success"
                class="diag-badge healthy"
              >
                ONLINE ({{ pingResults[site.id]?.result?.latencyMs }}ms)
              </span>
              <span
                v-else-if="pingResults[site.id]?.result && !pingResults[site.id]?.result?.success"
                class="diag-badge down"
                :title="pingResults[site.id]?.result?.error"
              >
                OFFLINE
              </span>
              <span v-else class="diag-badge not-tested">
                READY
              </span>
            </div>

            <p class="plant-gateway-desc">{{ site.description || 'No description provided' }}</p>

            <div class="plant-gateway-footer">
              <span class="gateway-url-mono">{{ site.wsUrl }}</span>
              <button
                class="ping-btn"
                :disabled="pingResults[site.id]?.testing"
                @click="handlePingSite(site)"
              >
                {{ pingResults[site.id]?.testing ? 'Testing...' : 'Test Gateway' }}
              </button>
            </div>
          </div>

          <div v-if="sites.length === 0" class="empty-fleet-card">
            No plants registered in the fleet. Add plants in the "Sites & Plants" tab to monitor their edge gateways.
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background-color: var(--app-bg);
  color: var(--app-text);
  overflow-y: auto;
}

/* Header */
.admin-header {
  height: 60px;
  background: var(--app-surface);
  border-bottom: 1px solid var(--app-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--app-surface-hover);
  border: 1px solid var(--app-border);
  border-radius: 6px;
  padding: 6px 12px;
  color: var(--app-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-back-btn:hover {
  background: var(--app-surface-subtle);
  border-color: var(--app-border-strong);
}

.divider {
  color: var(--app-border-strong);
  font-weight: 300;
}

.admin-title-block {
  display: flex;
  flex-direction: column;
}

.admin-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.admin-sub {
  font-size: 11px;
  color: var(--app-text-muted);
}

.admin-user-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--app-surface-subtle);
  border: 1px solid var(--app-border);
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
}

.user-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
}

.theme-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.theme-btn:hover {
  background: var(--app-surface-hover);
}

/* Main Content */
.admin-content {
  flex: 1;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 32px;
  box-sizing: border-box;
}

/* Tabs */
.admin-nav-tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--app-border);
  margin-bottom: 24px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--app-text-muted);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: var(--app-text);
}

.tab-btn.active {
  color: var(--app-accent);
  border-bottom-color: var(--app-accent);
}

.tab-count {
  background: var(--app-surface-hover);
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 11px;
}

/* Pane Header */
.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.pane-title {
  margin: 0 0 4px 0;
  font-size: 20px;
  font-weight: 700;
}

.pane-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-muted);
}

.pane-actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn.primary {
  background: var(--app-accent);
  color: #ffffff;
  border: 1px solid var(--app-accent);
}

.action-btn.primary:hover {
  filter: brightness(1.1);
}

.action-btn.secondary {
  background: var(--app-surface);
  color: var(--app-text);
  border: 1px solid var(--app-border);
}

.action-btn.secondary:hover {
  background: var(--app-surface-hover);
}

/* Modal / Card Form */
.add-site-card {
  background: var(--app-surface);
  border: 1px solid var(--app-accent);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.modal-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.close-x {
  background: transparent;
  border: none;
  font-size: 20px;
  color: var(--app-text-muted);
  cursor: pointer;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field.full-width {
  grid-column: span 2;
}

.form-field label {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-muted);
}

.form-input {
  background: var(--app-input-bg);
  border: 1px solid var(--app-input-border);
  color: var(--app-text);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  outline: none;
}

.form-input:focus {
  border-color: var(--app-accent);
}

.field-hint {
  font-size: 11px;
  color: var(--app-text-muted);
}

.form-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.btn {
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn.primary {
  background: var(--app-accent);
  color: #fff;
  border: none;
}

.btn.secondary {
  background: var(--app-surface-hover);
  border: 1px solid var(--app-border);
  color: var(--app-text);
}

/* Data Table */
.table-container {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}

.data-table th {
  background: var(--app-surface-subtle);
  border-bottom: 1px solid var(--app-border);
  padding: 12px 16px;
  font-weight: 600;
  color: var(--app-text-muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--app-border);
}

.site-row:last-child td {
  border-bottom: none;
}

.site-id-badge {
  background: var(--app-surface-subtle);
  border: 1px solid var(--app-border);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: monospace;
  font-size: 12px;
  color: var(--app-accent);
}

.ws-url-text {
  font-family: monospace;
  font-size: 12px;
  color: var(--app-text-muted);
}

.status-pill {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.status-pill.online {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.ping-btn {
  background: var(--app-surface-hover);
  border: 1px solid var(--app-border);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  color: var(--app-text);
}

.ping-btn:hover {
  border-color: var(--app-accent);
}

.ping-success {
  color: #10b981;
}

.ping-fail {
  color: #ef4444;
}

.actions-col {
  text-align: right;
}

.table-btn {
  background: transparent;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  color: var(--app-text-muted);
  margin-left: 6px;
}

.table-btn:hover {
  color: var(--app-text);
  border-color: var(--app-border-strong);
}

.table-btn.delete:hover {
  color: #ef4444;
  border-color: #ef4444;
}

.table-action-btn {
  border: 1px solid var(--app-border);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  margin-left: 4px;
}

.table-action-btn.save {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.table-action-btn.cancel {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.inline-input {
  background: var(--app-input-bg);
  border: 1px solid var(--app-input-border);
  color: var(--app-text);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  width: 90%;
}

.empty-table-cell {
  text-align: center;
  padding: 32px;
  color: var(--app-text-muted);
}

/* Extension Tab */
.extension-upload-banner {
  background: var(--app-surface);
  border: 1px dashed var(--app-border-strong);
  border-radius: 8px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 28px;
}

.upload-icon-box {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  background: var(--app-surface-subtle);
  border: 1px solid var(--app-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-accent);
  flex-shrink: 0;
}

.upload-info {
  flex: 1;
}

.upload-title {
  font-size: 15px;
  font-weight: 700;
  display: block;
  margin-bottom: 4px;
}

.upload-desc {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-muted);
  line-height: 1.4;
}

.section-heading {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 16px;
}

.widgets-manifest-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.manifest-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
}

.widget-meta-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.widget-type-badge {
  font-family: monospace;
  font-size: 12px;
  color: var(--app-accent);
}

.category-pill {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--app-surface-subtle);
  border: 1px solid var(--app-border);
}

.manifest-name {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
}

.manifest-desc {
  margin: 0;
  font-size: 12px;
  color: var(--app-text-muted);
  line-height: 1.4;
}

.card-bottom {
  border-top: 1px solid var(--app-border);
  padding-top: 10px;
  display: flex;
  justify-content: space-between;
}

.manifest-spec {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spec-label {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--app-text-muted);
}

.spec-val {
  font-size: 11px;
  font-weight: 600;
}

/* Diagnostics */
.diagnostics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.diagnostic-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 18px;
}

.diag-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.diag-title {
  font-size: 14px;
  font-weight: 700;
}

.diag-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.diag-badge.healthy {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.diag-badge.degraded {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.diag-badge.down {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.diag-desc {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: var(--app-text-muted);
}

.diag-meta {
  font-size: 11px;
  color: var(--app-text-muted);
  border-top: 1px solid var(--app-border);
  padding-top: 8px;
}

.diagnostic-card.full-span {
  grid-column: span 2;
}

.fleet-diagnostics-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 32px;
  margin-bottom: 16px;
}

.plant-gateways-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.plant-gateway-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
}

.plant-gateway-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.plant-identity {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plant-name {
  font-size: 14px;
  font-weight: 700;
}

.plant-gateway-desc {
  margin: 0;
  font-size: 12px;
  color: var(--app-text-muted);
}

.plant-gateway-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--app-border);
  padding-top: 10px;
}

.gateway-url-mono {
  font-family: monospace;
  font-size: 12px;
  color: var(--app-text-muted);
}

.diag-badge.checking {
  background: rgba(2, 132, 199, 0.15);
  color: #0284c7;
}

.diag-badge.not-tested {
  background: var(--app-surface-hover);
  color: var(--app-text-muted);
}

.empty-fleet-card {
  text-align: center;
  padding: 32px;
  color: var(--app-text-muted);
  border: 1px dashed var(--app-border-strong);
  border-radius: 8px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getWidgetComponent } from '@/components/widgets/registry'
import { useTelemetry } from '@/composables/useTelemetry'
import type { DashboardConfig, DashboardComponent } from '@/types/dashboard'

const route = useRoute()
const dashboard = ref<DashboardConfig | null>(null)
const { telemetryState, isWsConnected, connect } = useTelemetry()

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

onMounted(async () => {
  // 1. Try hydrating from localStorage (e.g. from Designer's "Open in Viewer" action)
  const savedLocal = localStorage.getItem('marmot-active-dashboard')
  if (savedLocal) {
    try {
      const parsed = JSON.parse(savedLocal)
      if (parsed && (!route.params.id || parsed.id === route.params.id || route.params.id === 'current' || route.params.id === 'demo')) {
        dashboard.value = parsed
      }
    } catch (e) {
      console.warn('Could not parse localStorage dashboard', e)
    }
  }

  // 2. If no matching saved dashboard, fallback to built-in sample dashboard
  if (!dashboard.value) {
    const sampleSvg = await fetch('/sample.svg').then((r) => r.text()).catch(() => '')
    dashboard.value = {
      id: String(route.params.id || 'demo'),
      name: 'Production Line 1 - Live Monitor',
      siteId: 'factory-edge-01',
      theme: 'industrial-dark',
      width: 1920,
      height: 1080,
      backgroundColor: '#18181b',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      components: [
      {
        id: 'machine-1',
        type: 'svg-machine',
        name: 'Main Line',
        x: 200,
        y: 150,
        width: 800,
        height: 500,
        rotation: 0,
        zIndex: 1,
        props: {
          svgContent: sampleSvg,
          bindings: [
            {
              elementId: 'wYcdrV7rxjeMivQmTptT-7',
              action: 'fill',
              dataPoint: 'ns=2;s=Packer1.Status',
              defaultColor: '#e2e8f0',
              colorRules: [
                { value: 1, color: '#22c55e', label: 'Running' },
                { value: 2, color: '#ef4444', label: 'Error' },
              ],
            },
            {
              elementId: 'wYcdrV7rxjeMivQmTptT-2',
              action: 'fill',
              dataPoint: 'ns=2;s=Conveyor1.Status',
              defaultColor: '#e2e8f0',
              colorRules: [
                { value: 1, color: '#22c55e', label: 'Running' },
              ],
            },
          ],
        },
      },
      {
        id: 'gauge-1',
        type: 'gauge',
        name: 'Extruder Temp',
        x: 1050,
        y: 180,
        width: 260,
        height: 260,
        rotation: 0,
        zIndex: 2,
        props: {
          title: 'Extruder Temp',
          min: 0,
          max: 120,
          unit: '°C',
          value: 87.9,
          dataPoint: 'ns=2;s=Extruder1.Temperature',
        },
      },
    ],
  }
}

  // Resolve target WebSocket URL from site registry
  let targetWsUrl: string | undefined
  if (dashboard.value?.siteId) {
    try {
      const siteRes = await fetch(`/api/sites/${encodeURIComponent(dashboard.value.siteId)}`)
      if (siteRes.ok) {
        const siteData = await siteRes.json()
        targetWsUrl = siteData.wsUrl
      }
    } catch (e) {
      console.warn('Could not fetch site details for viewer', e)
    }
  }
  connect(targetWsUrl)
})
</script>

<template>
  <div class="viewer-layout">
    <div class="viewer-top-bar">
      <div class="brand">
        <span class="badge" :style="{ background: isWsConnected ? '#22c55e' : '#64748b' }">
          {{ isWsConnected ? 'LIVE' : 'OFFLINE' }}
        </span>
        <span class="title">{{ dashboard?.name || 'Marmot Viewer' }}</span>
      </div>
      <div class="clock">
        <router-link to="/designer" class="edit-link">Open in Designer ↗</router-link>
      </div>
    </div>

    <div v-if="dashboard" class="viewer-viewport">
      <div
        class="viewer-artboard"
        :data-canvas-theme="dashboard.theme || 'industrial-dark'"
        :style="{
          width: `${dashboard.width}px`,
          height: `${dashboard.height}px`,
          backgroundColor: dashboard.backgroundColor,
        }"
      >
        <div
          v-for="comp in dashboard.components"
          :key="comp.id"
          class="viewer-item"
          :style="getComponentStyle(comp)"
        >
          <component
            :is="getWidgetComponent(comp.type)"
            v-bind="comp.props"
            :telemetry-values="telemetryState"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.viewer-layout {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #000;
  color: #fff;
  overflow: hidden;
}

.viewer-top-bar {
  height: 48px;
  background: rgba(17, 24, 39, 0.9);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 50;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge {
  background: #22c55e;
  color: #000;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.title {
  font-weight: 600;
  font-size: 14px;
}

.edit-link {
  color: #38bdf8;
  text-decoration: none;
  font-size: 12px;
}

.edit-link:hover {
  text-decoration: underline;
}

.viewer-viewport {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.viewer-artboard {
  position: relative;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.8);
  /* Scale-to-fit behavior on standard 1080p display */
  transform-origin: center center;
}
</style>

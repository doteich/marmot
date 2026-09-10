import { reactive, ref, computed } from 'vue'
import type { DashboardConfig, DashboardComponent, DataPoint, ComponentType } from '@/types/dashboard'

const defaultDashboard: DashboardConfig = {
  id: 'dash-' + Date.now(),
  name: 'New Line Dashboard',
  width: 1920,
  height: 1080,
  backgroundColor: '#18181b',
  components: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// Module-level state for designer
const dashboard = reactive<DashboardConfig>(JSON.parse(JSON.stringify(defaultDashboard)))
const selectedComponentId = ref<string | null>(null)
const zoom = ref(0.7)
const pan = reactive({ x: 100, y: 60 })
const availableDataPoints = ref<DataPoint[]>([])
const isPickerActive = ref(false)
const isPreviewMode = ref(false)

export function useDesigner() {
  const selectedComponent = computed(() => {
    if (!selectedComponentId.value) return null
    return dashboard.components.find((c) => c.id === selectedComponentId.value) || null
  })

  function selectComponent(id: string | null) {
    selectedComponentId.value = id
  }

  function addComponent(type: ComponentType, initialProps: Record<string, unknown> = {}) {
    const id = `${type}-${Date.now()}`
    const baseName =
      type === 'svg-machine'
        ? 'Machine Layout'
        : type === 'gauge'
          ? 'Gauge Indicator'
          : type === 'chart'
            ? 'Trend Chart'
            : 'Silo Indicator'

    const newComponent: DashboardComponent = {
      id,
      type,
      name: `${baseName} ${dashboard.components.length + 1}`,
      x: 100 + (dashboard.components.length % 5) * 40,
      y: 100 + (dashboard.components.length % 5) * 40,
      width: type === 'svg-machine' ? 500 : type === 'chart' ? 450 : 250,
      height: type === 'svg-machine' ? 350 : type === 'chart' ? 280 : 250,
      rotation: 0,
      zIndex: dashboard.components.length + 1,
      props: {
        ...initialProps,
      },
    }

    dashboard.components.push(newComponent)
    selectedComponentId.value = id
    return newComponent
  }

  function updateComponent(id: string, updates: Partial<DashboardComponent>) {
    const idx = dashboard.components.findIndex((c) => c.id === id)
    if (idx !== -1 && dashboard.components[idx]) {
      const existing = dashboard.components[idx]
      const updatedProps = updates.props ? { ...existing.props, ...updates.props } : existing.props
      Object.assign(existing, updates, { props: updatedProps })
      dashboard.updatedAt = new Date().toISOString()
    }
  }

  function removeComponent(id: string) {
    const idx = dashboard.components.findIndex((c) => c.id === id)
    if (idx !== -1) {
      dashboard.components.splice(idx, 1)
      if (selectedComponentId.value === id) {
        selectedComponentId.value = null
      }
    }
  }

  function setZoom(newZoom: number) {
    zoom.value = Math.max(0.1, Math.min(2.5, Number(newZoom.toFixed(2))))
  }

  function zoomIn() {
    setZoom(zoom.value + 0.1)
  }

  function zoomOut() {
    setZoom(zoom.value - 0.1)
  }

  function resetZoom() {
    zoom.value = 0.7
    pan.x = 100
    pan.y = 60
  }

  async function fetchDataPoints() {
    try {
      const res = await fetch('/api/datapoints')
      if (res.ok) {
        const data = await res.json()
        availableDataPoints.value = data.datapoints || []
      }
    } catch (e) {
      console.warn('Could not fetch datapoints from backend, using fallback seed list', e)
    }
  }

  function exportJson(): string {
    return JSON.stringify(dashboard, null, 2)
  }

  function importJson(jsonStr: string) {
    try {
      const parsed = JSON.parse(jsonStr)
      Object.assign(dashboard, parsed)
      selectedComponentId.value = null
    } catch (e) {
      console.error('Invalid dashboard JSON', e)
    }
  }

  return {
    dashboard,
    selectedComponentId,
    selectedComponent,
    zoom,
    pan,
    availableDataPoints,
    isPickerActive,
    isPreviewMode,
    selectComponent,
    addComponent,
    updateComponent,
    removeComponent,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    fetchDataPoints,
    exportJson,
    importJson,
  }
}

import { reactive, ref, computed } from 'vue'
import type { DashboardConfig, DashboardComponent, DataPoint, ComponentType, SvgBinding, SiteInfo } from '@/types/dashboard'
import { getWidgetManifest } from '@/components/widgets/registry'

const defaultDashboard: DashboardConfig = {
  id: 'dash-' + Date.now(),
  name: 'New Line Dashboard',
  siteId: 'factory-edge-01',
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
const activeBindingIndex = ref<number | null>(null)
const groupAddingIndex = ref<number | null>(null)
const zoom = ref(0.7)
const pan = reactive({ x: 100, y: 60 })
const availableDataPoints = ref<DataPoint[]>([])
const availableSites = ref<SiteInfo[]>([])
const isPickerActive = ref(false)
const isPreviewMode = ref(false)

export function useDesigner() {
  const selectedComponent = computed(() => {
    if (!selectedComponentId.value) return null
    return dashboard.components.find((c) => c.id === selectedComponentId.value) || null
  })

  const activeBinding = computed(() => {
    if (
      !selectedComponent.value ||
      activeBindingIndex.value === null ||
      !selectedComponent.value.props.bindings
    ) {
      return null
    }
    return selectedComponent.value.props.bindings[activeBindingIndex.value] || null
  })

  const activeElementIds = computed<string[]>(() => {
    if (!activeBinding.value) return []
    const ids = new Set<string>()
    if (activeBinding.value.elementId) ids.add(activeBinding.value.elementId)
    if (activeBinding.value.elementIds) {
      activeBinding.value.elementIds.forEach((id) => id && ids.add(id))
    }
    return Array.from(ids)
  })

  function selectComponent(id: string | null) {
    if (selectedComponentId.value !== id) {
      activeBindingIndex.value = null
      groupAddingIndex.value = null
    }
    selectedComponentId.value = id
  }

  function setActiveBindingIndex(idx: number | null) {
    activeBindingIndex.value = idx
    if (idx === null || idx !== groupAddingIndex.value) {
      groupAddingIndex.value = null
    }
  }

  function setGroupAddingIndex(idx: number | null) {
    groupAddingIndex.value = idx
    if (idx !== null) {
      activeBindingIndex.value = idx
      isPickerActive.value = true
    }
  }

  function addComponent(type: ComponentType, initialProps: Record<string, unknown> = {}) {
    const id = `${type}-${Date.now()}`
    const manifest = getWidgetManifest(type)
    const baseName = manifest?.name || type
    const width = manifest?.defaultSize?.width ?? 300
    const height = manifest?.defaultSize?.height ?? 200
    const defaultProps = manifest?.defaultProps ? JSON.parse(JSON.stringify(manifest.defaultProps)) : {}

    const newComponent: DashboardComponent = {
      id,
      type,
      name: `${baseName} ${dashboard.components.length + 1}`,
      x: 100 + (dashboard.components.length % 5) * 40,
      y: 100 + (dashboard.components.length % 5) * 40,
      width,
      height,
      rotation: 0,
      zIndex: dashboard.components.length + 1,
      props: {
        ...defaultProps,
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

  function bringToFront(id: string) {
    const comp = dashboard.components.find((c) => c.id === id)
    if (!comp) return
    const maxZ = dashboard.components.reduce((max, c) => Math.max(max, c.zIndex || 1), 1)
    comp.zIndex = maxZ + 1
    dashboard.updatedAt = new Date().toISOString()
  }

  function sendToBack(id: string) {
    const comp = dashboard.components.find((c) => c.id === id)
    if (!comp) return
    const minZ = dashboard.components.reduce((min, c) => Math.min(min, c.zIndex || 1), 1)
    if (minZ > 1) {
      comp.zIndex = minZ - 1
    } else {
      dashboard.components.forEach((c) => {
        if (c.id !== id) {
          c.zIndex = (c.zIndex || 1) + 1
        }
      })
      comp.zIndex = 1
    }
    dashboard.updatedAt = new Date().toISOString()
  }

  function bringForward(id: string) {
    const comp = dashboard.components.find((c) => c.id === id)
    if (!comp) return
    comp.zIndex = (comp.zIndex || 1) + 1
    dashboard.updatedAt = new Date().toISOString()
  }

  function sendBackward(id: string) {
    const comp = dashboard.components.find((c) => c.id === id)
    if (!comp) return
    comp.zIndex = Math.max(1, (comp.zIndex || 1) - 1)
    dashboard.updatedAt = new Date().toISOString()
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

  const activeSite = computed(() => {
    return availableSites.value.find((s) => s.id === dashboard.siteId) || null
  })

  async function fetchSites() {
    try {
      const res = await fetch('/api/sites')
      if (res.ok) {
        const sites: SiteInfo[] = await res.json()
        availableSites.value = sites || []
        if ((!dashboard.siteId || dashboard.siteId === '') && availableSites.value.length > 0) {
          dashboard.siteId = availableSites.value[0]?.id || 'factory-edge-01'
        }
      }
    } catch (e) {
      console.warn('Could not fetch sites from backend', e)
    }
  }

  async function fetchDataPoints(siteId?: string) {
    const targetSite = siteId !== undefined ? siteId : (dashboard.siteId || '')
    try {
      const url = targetSite ? `/api/datapoints?siteId=${encodeURIComponent(targetSite)}` : '/api/datapoints'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        availableDataPoints.value = data.datapoints || []
      }
    } catch (e) {
      console.warn('Could not fetch datapoints from backend, using fallback seed list', e)
    }
  }

  function setDashboardSite(siteId: string) {
    dashboard.siteId = siteId
    fetchDataPoints(siteId)
  }

  function addShapeToBinding(bindingIndex: number, shapeId: string, label?: string) {
    if (!selectedComponent.value) return
    const bindings = [...(selectedComponent.value.props.bindings || [])]
    const targetBinding = bindings[bindingIndex]
    if (!targetBinding) return

    const ids = new Set<string>(
      targetBinding.elementIds && targetBinding.elementIds.length
        ? targetBinding.elementIds
        : [targetBinding.elementId]
    )
    ids.add(shapeId)
    targetBinding.elementIds = Array.from(ids)
    if (!targetBinding.groupName && label && label !== shapeId) {
      targetBinding.groupName = `${label} Group`
    }
    updateComponent(selectedComponent.value.id, {
      props: { ...selectedComponent.value.props, bindings },
    })
  }

  function removeShapeFromBinding(bindingIndex: number, shapeId: string) {
    if (!selectedComponent.value) return
    const bindings = [...(selectedComponent.value.props.bindings || [])]
    const targetBinding = bindings[bindingIndex]
    if (!targetBinding) return

    const ids = (
      targetBinding.elementIds && targetBinding.elementIds.length
        ? targetBinding.elementIds
        : [targetBinding.elementId]
    ).filter((id) => id !== shapeId)

    if (ids.length === 0) {
      bindings.splice(bindingIndex, 1)
      if (activeBindingIndex.value === bindingIndex) {
        activeBindingIndex.value = null
      } else if (activeBindingIndex.value !== null && activeBindingIndex.value > bindingIndex) {
        activeBindingIndex.value--
      }
    } else {
      targetBinding.elementIds = ids
      targetBinding.elementId = ids[0] || ''
    }

    updateComponent(selectedComponent.value.id, {
      props: { ...selectedComponent.value.props, bindings },
    })
  }

  function handleSelectElementInPicker(elementId: string, label?: string, isShift = false) {
    if (!selectedComponent.value || selectedComponent.value.type !== 'svg-machine') return

    const currentBindings: SvgBinding[] = [
      ...(selectedComponent.value.props.bindings || []),
    ]

    // Determine target group for appending:
    // Grouping ONLY occurs if:
    // a) User explicitly activated "+ Add Shapes" for a group (groupAddingIndex !== null), OR
    // b) User held Shift while an active binding is selected (isShift && activeBindingIndex !== null)
    const targetGroupIdx =
      groupAddingIndex.value !== null
        ? groupAddingIndex.value
        : isShift && activeBindingIndex.value !== null
          ? activeBindingIndex.value
          : null

    if (targetGroupIdx !== null && currentBindings[targetGroupIdx]) {
      const targetBinding = currentBindings[targetGroupIdx]
      if (targetBinding) {
        const ids = new Set<string>(
          targetBinding.elementIds && targetBinding.elementIds.length
            ? targetBinding.elementIds
            : [targetBinding.elementId]
        )

        if (ids.has(elementId)) {
          // Toggle out of group if Shift is held and group has multiple items
          if (isShift && ids.size > 1) {
            ids.delete(elementId)
            targetBinding.elementIds = Array.from(ids)
            targetBinding.elementId = targetBinding.elementIds[0] || ''
            updateComponent(selectedComponent.value.id, {
              props: { ...selectedComponent.value.props, bindings: currentBindings },
            })
            return
          }
        } else {
          // Add shape to target group!
          currentBindings.forEach((b, idx) => {
            if (idx !== targetGroupIdx) {
              const bIds = (b.elementIds || [b.elementId]).filter((id) => id !== elementId)
              b.elementIds = bIds
              b.elementId = bIds[0] || ''
            }
          })
          const filtered = currentBindings.filter((b) => b.elementIds?.length || b.elementId)
          const newTargetIdx = filtered.findIndex((b) => b === targetBinding)
          const finalIdx = newTargetIdx !== -1 ? newTargetIdx : targetGroupIdx
          activeBindingIndex.value = finalIdx
          if (groupAddingIndex.value !== null) {
            groupAddingIndex.value = finalIdx
          }

          ids.add(elementId)
          targetBinding.elementIds = Array.from(ids)
          if (!targetBinding.groupName && label && label !== elementId) {
            targetBinding.groupName = `${label} Group`
          }

          updateComponent(selectedComponent.value.id, {
            props: { ...selectedComponent.value.props, bindings: filtered },
          })
          return
        }
      }
    }

    // Normal Click (without Shift, and NOT in groupAdding mode):
    // Check if clicked shape already belongs to any binding
    const existingIdx = currentBindings.findIndex(
      (b) =>
        b.elementId === elementId ||
        (b.elementIds && b.elementIds.includes(elementId))
    )

    if (existingIdx !== -1) {
      // Just select this existing binding in the inspector, DO NOT add other shapes to it
      activeBindingIndex.value = existingIdx
      groupAddingIndex.value = null
    } else {
      // Create a brand new independent single-shape binding
      const newBinding: SvgBinding = {
        elementId,
        elementIds: [elementId],
        groupName: label && label !== elementId ? label : undefined,
        action: 'fill',
        dataPoint: availableDataPoints.value[0]?.dataPointId || 'ns=2;s=Extruder1.Status',
        defaultColor: '#64748b',
        colorRules: [
          { value: 1, color: '#22c55e', label: 'Production' },
          { value: 2, color: '#ef4444', label: 'Error' },
          { value: 0, color: '#94a3b8', label: 'Off' },
        ],
      }
      currentBindings.push(newBinding)
      activeBindingIndex.value = currentBindings.length - 1
      groupAddingIndex.value = null
      updateComponent(selectedComponent.value.id, {
        props: { ...selectedComponent.value.props, bindings: currentBindings },
      })
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
      activeBindingIndex.value = null
    } catch (e) {
      console.error('Invalid dashboard JSON', e)
    }
  }

  return {
    dashboard,
    selectedComponentId,
    selectedComponent,
    activeBindingIndex,
    groupAddingIndex,
    activeBinding,
    activeElementIds,
    zoom,
    pan,
    availableDataPoints,
    availableSites,
    activeSite,
    isPickerActive,
    isPreviewMode,
    selectComponent,
    setActiveBindingIndex,
    setGroupAddingIndex,
    handleSelectElementInPicker,
    addShapeToBinding,
    removeShapeFromBinding,
    addComponent,
    updateComponent,
    removeComponent,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    fetchDataPoints,
    fetchSites,
    setDashboardSite,
    exportJson,
    importJson,
  }
}

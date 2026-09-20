<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { OnyxButton, OnyxIcon } from 'sit-onyx'
import {
  iconGrid,
  iconTrash,
  iconPlus,
  iconXSmall,
  iconChevronDown,
  iconChevronUp,
  iconCircleCheck,
  iconCircleMinus,
  iconTag,
} from '@sit-onyx/icons'
import { useDesigner } from '@/composables/useDesigner'
import type { DashboardComponent, SvgBinding } from '@/types/dashboard'

const props = defineProps<{
  component: DashboardComponent
}>()

const {
  availableDataPoints,
  isPickerActive,
  activeBindingIndex,
  groupAddingIndex,
  setActiveBindingIndex,
  setGroupAddingIndex,
  addShapeToBinding,
  removeShapeFromBinding,
  updateComponent,
  fetchDataPoints,
} = useDesigner()

onMounted(() => {
  fetchDataPoints()
})

const showLayersList = ref(false)

function getBindingIds(b: SvgBinding): string[] {
  const ids = new Set<string>()
  if (b.elementId) ids.add(b.elementId)
  if (b.elementIds) {
    b.elementIds.forEach((id) => id && ids.add(id))
  }
  return Array.from(ids)
}

const groupedDataPoints = computed(() => {
  const map = new Map<string, typeof availableDataPoints.value>()
  for (const dp of availableDataPoints.value) {
    const key = dp.machineId || 'Other'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(dp)
  }
  return Array.from(map.entries()).map(([machineId, items]) => ({
    machineId,
    items,
  }))
})

interface DetectedShape {
  id: string
  label: string
  tagName: string
  isBound: boolean
  bindingIndex?: number
  boundLabel?: string
}

const detectedShapes = computed<DetectedShape[]>(() => {
  const svgContent = props.component.props.svgContent
  if (!svgContent) return []

  const parser = new DOMParser()
  const doc = parser.parseFromString(svgContent, 'image/svg+xml')
  const bindings = props.component.props.bindings || []

  const elements = doc.querySelectorAll('[data-cell-id], [id]')
  const result: DetectedShape[] = []
  const seenIds = new Set<string>()

  elements.forEach((el) => {
    const id = el.getAttribute('data-cell-id') || el.id
    if (!id || seenIds.has(id) || id === '0' || id === '1' || id.startsWith('ge-')) return
    seenIds.add(id)

    let label = ''
    const textEl = el.querySelector('text, div')
    if (textEl && textEl.textContent) {
      label = textEl.textContent.trim()
    }
    if (!label) {
      label = id
    }

    const bIdx = bindings.findIndex((b) => getBindingIds(b).includes(id))
    const isBound = bIdx !== -1
    const bound = isBound ? bindings[bIdx] : undefined

    result.push({
      id,
      label,
      tagName: el.tagName.toLowerCase(),
      isBound,
      bindingIndex: isBound ? bIdx : undefined,
      boundLabel: bound?.groupName || bound?.elementId,
    })
  })

  return result
})

function togglePicker() {
  isPickerActive.value = !isPickerActive.value
  if (!isPickerActive.value) {
    setActiveBindingIndex(null)
    setGroupAddingIndex(null)
  }
}

function toggleGroupPick(idx: number) {
  if (groupAddingIndex.value === idx) {
    setGroupAddingIndex(null)
  } else {
    setGroupAddingIndex(idx)
  }
}

function bindShape(shapeId: string, label?: string) {
  const bindings = [...(props.component.props.bindings || [])]
  const existingIdx = bindings.findIndex((b) => getBindingIds(b).includes(shapeId))
  if (existingIdx === -1) {
    const newBinding: SvgBinding = {
      elementId: shapeId,
      elementIds: [shapeId],
      groupName: label && label !== shapeId ? label : undefined,
      action: 'fill',
      dataPoint: availableDataPoints.value[0]?.dataPointId || 'ns=2;s=Extruder1.Status',
      defaultColor: '#64748b',
      colorRules: [
        { value: 1, color: '#22c55e', label: 'Running' },
        { value: 2, color: '#ef4444', label: 'Error' },
        { value: 0, color: '#94a3b8', label: 'Off' },
      ],
    }
    bindings.push(newBinding)
    updateComponent(props.component.id, {
      props: { ...props.component.props, bindings },
    })
    setActiveBindingIndex(bindings.length - 1)
  } else {
    setActiveBindingIndex(existingIdx)
  }
}

function handleAddShapeToCurrentGroup(shapeId: string, label?: string) {
  if (activeBindingIndex.value !== null) {
    addShapeToBinding(activeBindingIndex.value, shapeId, label)
  }
}

function updateBinding(index: number, partial: Partial<SvgBinding>) {
  const bindings = [...(props.component.props.bindings || [])]
  if (!bindings[index]) return
  bindings[index] = { ...bindings[index], ...partial } as SvgBinding
  updateComponent(props.component.id, {
    props: { ...props.component.props, bindings },
  })
}

function removeBinding(index: number) {
  const bindings = [...(props.component.props.bindings || [])]
  bindings.splice(index, 1)
  if (activeBindingIndex.value === index) {
    setActiveBindingIndex(null)
  } else if (activeBindingIndex.value !== null && activeBindingIndex.value > index) {
    setActiveBindingIndex(activeBindingIndex.value - 1)
  }
  updateComponent(props.component.id, {
    props: { ...props.component.props, bindings },
  })
}

function addColorRule(bindingIndex: number) {
  const bindings = [...(props.component.props.bindings || [])]
  const targetBinding = bindings[bindingIndex]
  if (!targetBinding) return
  const rules = [...(targetBinding.colorRules || [])]
  rules.push({ value: rules.length + 1, color: '#f59e0b', label: 'Warning' })
  targetBinding.colorRules = rules
  updateComponent(props.component.id, {
    props: { ...props.component.props, bindings },
  })
}

function removeColorRule(bindingIndex: number, ruleIndex: number) {
  const bindings = [...(props.component.props.bindings || [])]
  const targetBinding = bindings[bindingIndex]
  if (!targetBinding || !targetBinding.colorRules) return
  const rules = [...targetBinding.colorRules]
  rules.splice(ruleIndex, 1)
  targetBinding.colorRules = rules
  updateComponent(props.component.id, {
    props: { ...props.component.props, bindings },
  })
}
</script>

<template>
  <div class="svg-machine-config">
    <div class="section-card">
      <div class="section-title">SVG Layout & Grouping</div>

      <div class="picker-control">
        <OnyxButton
          :label="isPickerActive ? 'Done Picking' : 'Pick / Group Shapes on Canvas'"
          :variation="isPickerActive ? 'primary' : 'secondary'"
          class="picker-btn"
          @click="togglePicker"
        />
      </div>

      <p v-if="isPickerActive" class="picker-help">
        <span v-if="groupAddingIndex !== null">
          <strong>Grouping Mode:</strong> Click shapes on the SVG canvas to add or remove them from this group. Click "Done Adding" when finished.
        </span>
        <span v-else>
          Click any shape to bind individually. <strong>Hold Shift + Click</strong> to group multiple shapes together!
        </span>
      </p>

      <!-- Detected Shapes & Layers Accordion -->
      <div v-if="detectedShapes.length > 0" class="detected-shapes-box">
        <div class="shapes-header" @click="showLayersList = !showLayersList">
          <div class="header-label">
            <OnyxIcon :icon="iconGrid" class="header-icon" />
            <span>Detected Layers & Shapes ({{ detectedShapes.length }})</span>
          </div>
          <OnyxIcon :icon="showLayersList ? iconChevronUp : iconChevronDown" class="toggle-icon" />
        </div>

        <div v-if="showLayersList" class="shapes-list">
          <div
            v-for="shape in detectedShapes"
            :key="shape.id"
            class="shape-item"
            :class="{
              'is-bound': shape.isBound,
              'is-active-group': shape.bindingIndex === activeBindingIndex && activeBindingIndex !== null,
            }"
          >
            <div class="shape-item-left">
              <OnyxIcon
                :icon="shape.isBound ? iconCircleCheck : iconCircleMinus"
                class="shape-status-icon"
                :class="{ bound: shape.isBound }"
              />
              <div class="shape-text">
                <span class="shape-name">{{ shape.label }}</span>
                <span class="shape-subid">{{ shape.id }}</span>
              </div>
            </div>

            <div class="shape-item-actions">
              <!-- Unbound shape options -->
              <template v-if="!shape.isBound">
                <button
                  v-if="activeBindingIndex !== null"
                  class="group-add-btn"
                  title="Add to Active Group"
                  @click="handleAddShapeToCurrentGroup(shape.id, shape.label)"
                >
                  + To Group
                </button>
                <button
                  class="quick-bind-btn"
                  title="Create New Binding Group"
                  @click="bindShape(shape.id, shape.label)"
                >
                  + Bind
                </button>
              </template>

              <!-- Bound shape status / navigation -->
              <template v-else>
                <button
                  v-if="shape.bindingIndex === activeBindingIndex && activeBindingIndex !== null"
                  class="remove-from-group-btn"
                  title="Remove from this Group"
                  @click="removeShapeFromBinding(activeBindingIndex, shape.id)"
                >
                  Remove ✕
                </button>
                <span
                  v-else
                  class="bound-tag clickable"
                  :title="`Bound in: ${shape.boundLabel}. Click to select.`"
                  @click="setActiveBindingIndex(shape.bindingIndex ?? null)"
                >
                  {{ shape.boundLabel || 'Bound' }}
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Element Data Bindings / Compound Groups List -->
      <div class="bindings-section">
        <div class="section-header-row">
          <div class="section-subtitle">
            Binding Groups ({{ component.props.bindings?.length || 0 }})
          </div>
          <span class="group-tip">Multi-shape groups react together</span>
        </div>

        <div
          v-for="(binding, idx) in component.props.bindings || []"
          :key="binding.elementId"
          class="binding-card"
          :class="{ 'is-selected-group': activeBindingIndex === idx }"
          @click="setActiveBindingIndex(idx)"
        >
          <div class="binding-card-header">
            <div class="group-header-left">
              <OnyxIcon :icon="iconTag" class="group-header-icon" />
              <input
                :value="binding.groupName || ''"
                :placeholder="`Group: ${binding.elementId}`"
                class="group-name-input"
                title="Click to rename group"
                @click.stop
                @input="updateBinding(idx, { groupName: ($event.target as HTMLInputElement).value })"
              />
            </div>
            <div class="header-right-actions" @click.stop>
              <span v-if="activeBindingIndex === idx" class="active-badge">
                Active Group
              </span>
              <button class="delete-btn" title="Remove Binding Group" @click="removeBinding(idx)">
                <OnyxIcon :icon="iconTrash" />
              </button>
            </div>
          </div>

          <!-- Grouped Shapes Chips Container -->
          <div class="group-shapes-box">
            <div class="group-shapes-label">
              <span>Grouped Shapes ({{ getBindingIds(binding).length }})</span>
              <button
                class="pick-group-btn"
                :class="{ active: groupAddingIndex === idx }"
                @click.stop="toggleGroupPick(idx)"
              >
                {{ groupAddingIndex === idx ? 'Done Adding' : '+ Add Shapes' }}
              </button>
            </div>

            <div class="shape-chips-container">
              <div
                v-for="shapeId in getBindingIds(binding)"
                :key="shapeId"
                class="shape-chip"
                :title="shapeId"
              >
                <span class="chip-id">{{ shapeId }}</span>
                <button
                  v-if="getBindingIds(binding).length > 1"
                  class="chip-remove"
                  title="Remove shape from group"
                  @click.stop="removeShapeFromBinding(idx, shapeId)"
                >
                  <OnyxIcon :icon="iconXSmall" />
                </button>
              </div>
            </div>
          </div>

          <!-- Action type -->
          <div class="form-row" @click.stop>
            <label>Target Action</label>
            <select
              :value="binding.action"
              class="inspector-select"
              @change="updateBinding(idx, { action: ($event.target as HTMLSelectElement).value as any })"
            >
              <option value="fill">Fill Color (All Group Shapes)</option>
              <option value="stroke">Outline / Stroke (All Group Shapes)</option>
            </select>
          </div>

          <!-- Datapoint mapping -->
          <div class="form-row" @click.stop>
            <label>Data Point (TimescaleDB / OPC UA)</label>
            <select
              :value="binding.dataPoint"
              class="inspector-select"
              @change="updateBinding(idx, { dataPoint: ($event.target as HTMLSelectElement).value })"
            >
              <option value="">-- Select Datapoint --</option>
              <optgroup
                v-for="group in groupedDataPoints"
                :key="group.machineId"
                :label="group.machineId ? `Machine: ${group.machineId}` : 'General / Other'"
              >
                <option
                  v-for="dp in group.items"
                  :key="dp.dataPointId"
                  :value="dp.dataPointId"
                >
                  {{ dp.dataPointName }} ({{ dp.dataType }}){{ dp.unit ? ' [' + dp.unit + ']' : '' }}
                </option>
              </optgroup>
              <!-- Fallback to keep selected custom value visible -->
              <option
                v-if="binding.dataPoint && !availableDataPoints.some((d) => d.dataPointId === binding.dataPoint)"
                :value="binding.dataPoint"
              >
                {{ binding.dataPoint }}
              </option>
            </select>
          </div>

          <!-- Status Rules -->
          <div class="rules-container" @click.stop>
            <div class="rules-header">
              <span>Value → Group Color Rules</span>
              <button class="add-rule-btn" @click="addColorRule(idx)">
                <OnyxIcon :icon="iconPlus" /> Rule
              </button>
            </div>

            <div
              v-for="(rule, rIdx) in binding.colorRules"
              :key="rIdx"
              class="rule-row"
            >
              <input
                v-model="rule.value"
                placeholder="Val"
                class="val-input"
              />
              <input
                v-model="rule.color"
                type="color"
                class="color-picker"
              />
              <input
                v-model="rule.label"
                placeholder="Label"
                class="label-input"
              />
              <button
                class="rule-delete-btn"
                title="Remove Rule"
                @click="removeColorRule(idx, rIdx)"
              >
                <OnyxIcon :icon="iconXSmall" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.svg-machine-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.section-card {
  background: var(--app-surface-subtle);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--app-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-header-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-subtitle {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text);
}

.group-tip {
  font-size: 10px;
  color: var(--app-text-muted);
}

.picker-control {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.picker-btn {
  width: 100%;
}

.picker-help {
  font-size: 11px;
  color: var(--app-accent);
  background: rgba(2, 132, 199, 0.1);
  padding: 8px 10px;
  border-radius: 6px;
  margin: 0;
  line-height: 1.4;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

/* Detected Shapes Accordion */
.detected-shapes-box {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 6px;
  overflow: hidden;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.shapes-header {
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  background: var(--app-surface-hover);
  font-size: 11px;
  font-weight: 700;
  color: var(--app-text);
  user-select: none;
  min-width: 0;
}

.header-label {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-icon {
  font-size: 14px;
  flex-shrink: 0;
  color: var(--app-accent);
}

.toggle-icon {
  font-size: 12px;
  color: var(--app-text-muted);
  flex-shrink: 0;
}

.shapes-list {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 4px;
  gap: 4px;
  min-width: 0;
}

.shape-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--app-surface-subtle);
  border: 1px solid var(--app-border);
  font-size: 11px;
  box-sizing: border-box;
  min-width: 0;
  gap: 6px;
}

.shape-item.is-bound {
  border-color: rgba(34, 197, 94, 0.3);
}

.shape-item.is-active-group {
  border-color: var(--app-accent);
  background: rgba(2, 132, 199, 0.08);
}

.shape-item-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.shape-status-icon {
  font-size: 12px;
  color: var(--app-text-muted);
  flex-shrink: 0;
}

.shape-status-icon.bound {
  color: #22c55e;
}

.shape-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.shape-name {
  font-weight: 600;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.shape-subid {
  font-size: 9px;
  color: var(--app-text-muted);
  font-family: 'Source Code Pro', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.shape-item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.group-add-btn {
  background: rgba(2, 132, 199, 0.15);
  border: 1px solid rgba(2, 132, 199, 0.4);
  color: var(--app-accent);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.group-add-btn:hover {
  background: var(--app-accent);
  color: #ffffff;
}

.quick-bind-btn {
  background: var(--app-accent);
  border: none;
  color: #ffffff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.quick-bind-btn:hover {
  background: var(--app-accent-hover);
}

.remove-from-group-btn {
  background: transparent;
  border: 1px solid #ef4444;
  color: #ef4444;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  cursor: pointer;
}

.remove-from-group-btn:hover {
  background: #ef4444;
  color: #ffffff;
}

.bound-tag {
  font-size: 9px;
  font-weight: 700;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
  max-width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bound-tag.clickable {
  cursor: pointer;
  border: 1px solid transparent;
}

.bound-tag.clickable:hover {
  border-color: #22c55e;
}

/* Bindings Section */
.bindings-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.binding-card {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  transition: all 0.2s ease;
  cursor: pointer;
}

.binding-card:hover {
  border-color: var(--app-border-strong);
}

.binding-card.is-selected-group {
  border-color: var(--app-accent);
  box-shadow: 0 0 0 1px var(--app-accent), 0 2px 8px rgba(2, 132, 199, 0.15);
}

.binding-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.group-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.group-header-icon {
  font-size: 13px;
  color: var(--app-accent);
  flex-shrink: 0;
}

.group-name-input {
  background: transparent;
  border: none;
  border-bottom: 1px dashed var(--app-border);
  color: var(--app-text);
  font-size: 12px;
  font-weight: 700;
  padding: 2px 4px;
  outline: none;
  width: 100%;
  min-width: 0;
  transition: border-color 0.15s ease;
}

.group-name-input:focus {
  border-bottom: 1px solid var(--app-accent);
  background: var(--app-input-bg);
  border-radius: 3px;
}

.header-right-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.active-badge {
  font-size: 9px;
  font-weight: 700;
  color: var(--app-accent);
  background: rgba(2, 132, 199, 0.15);
  padding: 2px 5px;
  border-radius: 3px;
}

.delete-btn {
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 13px;
  padding: 2px 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* Group Shapes Container & Chips */
.group-shapes-box {
  background: var(--app-surface-subtle);
  border: 1px solid var(--app-border);
  border-radius: 6px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.group-shapes-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  font-weight: 700;
  color: var(--app-text-muted);
}

.pick-group-btn {
  background: transparent;
  border: 1px solid var(--app-border);
  color: var(--app-accent);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pick-group-btn:hover,
.pick-group-btn.active {
  background: var(--app-accent);
  color: #ffffff;
  border-color: var(--app-accent);
}

.shape-chips-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.shape-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 4px;
  padding: 2px 5px;
  font-size: 10px;
  font-family: 'Source Code Pro', monospace;
  color: var(--app-accent);
  max-width: 100%;
  box-sizing: border-box;
}

.chip-id {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.chip-remove {
  background: transparent;
  border: none;
  color: var(--app-text-muted);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  font-size: 11px;
}

.chip-remove:hover {
  color: #ef4444;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.form-row label {
  font-size: 11px;
  color: var(--app-text-muted);
}

.inspector-select {
  background: var(--app-input-bg);
  border: 1px solid var(--app-input-border);
  border-radius: 6px;
  color: var(--app-text);
  font-size: 12px;
  padding: 6px 8px;
  outline: none;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

.inspector-select:focus {
  border-color: var(--app-accent);
}

.rules-container {
  margin-top: 4px;
  border-top: 1px solid var(--app-border);
  padding-top: 8px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.rules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--app-text-muted);
  margin-bottom: 6px;
  min-width: 0;
}

.add-rule-btn {
  background: transparent;
  border: none;
  color: var(--app-accent);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  padding: 2px 4px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.rule-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.val-input {
  width: 44px;
  min-width: 44px;
  max-width: 44px;
  font-size: 11px;
  padding: 4px 6px;
  box-sizing: border-box;
  background: var(--app-input-bg);
  border: 1px solid var(--app-input-border);
  border-radius: 4px;
  color: var(--app-text);
  outline: none;
}

.color-picker {
  width: 28px;
  min-width: 28px;
  max-width: 28px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--app-input-border);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  box-sizing: border-box;
}

.label-input {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  padding: 4px 6px;
  box-sizing: border-box;
  background: var(--app-input-bg);
  border: 1px solid var(--app-input-border);
  border-radius: 4px;
  color: var(--app-text);
  outline: none;
}

.rule-delete-btn {
  background: transparent;
  border: none;
  color: var(--app-text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 12px;
}

.rule-delete-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}
</style>

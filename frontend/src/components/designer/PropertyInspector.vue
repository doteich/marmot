<script setup lang="ts">
import { ref, watch } from 'vue'
import { OnyxButton } from 'sit-onyx'
import { useDesigner } from '@/composables/useDesigner'
import type { SvgBinding } from '@/types/dashboard'

const {
  dashboard,
  selectedComponent,
  availableDataPoints,
  isPickerActive,
  updateComponent,
  removeComponent,
  fetchDataPoints,
} = useDesigner()

const fileInputRef = ref<HTMLInputElement | null>(null)

function handleNumberChange(prop: 'x' | 'y' | 'width' | 'height' | 'rotation', val: string) {
  if (!selectedComponent.value) return
  updateComponent(selectedComponent.value.id, {
    [prop]: Number(val) || 0,
  })
}

function handleSvgUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !selectedComponent.value) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    const text = ev.target?.result as string
    if (text) {
      updateComponent(selectedComponent.value!.id, {
        props: {
          ...selectedComponent.value!.props,
          svgContent: text,
        },
      })
    }
  }
  reader.readAsText(file)
}

function togglePicker() {
  isPickerActive.value = !isPickerActive.value
}

function updateBinding(index: number, partial: Partial<SvgBinding>) {
  if (!selectedComponent.value) return
  const bindings = [...(selectedComponent.value.props.bindings || [])]
  if (!bindings[index]) return
  bindings[index] = { ...bindings[index], ...partial } as SvgBinding
  updateComponent(selectedComponent.value.id, {
    props: { ...selectedComponent.value.props, bindings },
  })
}

function removeBinding(index: number) {
  if (!selectedComponent.value) return
  const bindings = [...(selectedComponent.value.props.bindings || [])]
  bindings.splice(index, 1)
  updateComponent(selectedComponent.value.id, {
    props: { ...selectedComponent.value.props, bindings },
  })
}

function addColorRule(bindingIndex: number) {
  if (!selectedComponent.value) return
  const bindings = [...(selectedComponent.value.props.bindings || [])]
  const targetBinding = bindings[bindingIndex]
  if (!targetBinding) return
  const rules = [...(targetBinding.colorRules || [])]
  rules.push({ value: rules.length + 1, color: '#f59e0b', label: 'Warning' })
  targetBinding.colorRules = rules
  updateComponent(selectedComponent.value.id, {
    props: { ...selectedComponent.value.props, bindings },
  })
}

function handleDeleteComponent() {
  if (selectedComponent.value) {
    removeComponent(selectedComponent.value.id)
  }
}

// Fetch available datapoints when component inspector mounts or opens
watch(
  () => selectedComponent.value?.id,
  () => {
    if (selectedComponent.value) {
      fetchDataPoints()
    }
  },
  { immediate: true }
)
</script>

<template>
  <aside class="property-inspector">
    <div class="inspector-header">
      <span class="inspector-title">Properties</span>
      <span class="inspector-subtitle">
        {{ selectedComponent ? selectedComponent.name : 'Canvas Settings' }}
      </span>
    </div>

    <!-- 1. COMPONENT SELECTED -->
    <div v-if="selectedComponent" class="inspector-content">
      <!-- General Transform section -->
      <div class="section-card">
        <div class="section-title">Transform</div>
        <div class="grid-2x2">
          <div class="field-item">
            <label>X (px)</label>
            <input
              type="number"
              :value="selectedComponent.x"
              @input="handleNumberChange('x', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="field-item">
            <label>Y (px)</label>
            <input
              type="number"
              :value="selectedComponent.y"
              @input="handleNumberChange('y', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="field-item">
            <label>Width</label>
            <input
              type="number"
              :value="selectedComponent.width"
              @input="handleNumberChange('width', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="field-item">
            <label>Height</label>
            <input
              type="number"
              :value="selectedComponent.height"
              @input="handleNumberChange('height', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>

      <!-- 2. SPECIFIC: SVG Machine Model -->
      <div v-if="selectedComponent.type === 'svg-machine'" class="section-card">
        <div class="section-title">SVG Layout & Mapping</div>

        <input
          ref="fileInputRef"
          type="file"
          accept=".svg"
          style="display: none"
          @change="handleSvgUpload"
        />

        <div class="button-row">
          <button class="action-btn" @click="fileInputRef?.click()">
            Upload New SVG
          </button>
          <button
            class="action-btn"
            :class="{ active: isPickerActive }"
            @click="togglePicker"
          >
            {{ isPickerActive ? 'Done Picking' : '🎯 Pick SVG Shape' }}
          </button>
        </div>

        <p v-if="isPickerActive" class="picker-help">
          Click any shape inside the machine SVG on the canvas to add a new data binding!
        </p>

        <!-- Element Data Bindings List -->
        <div class="bindings-section">
          <div class="section-subtitle">
            Active Data Bindings ({{ selectedComponent.props.bindings?.length || 0 }})
          </div>

          <div
            v-for="(binding, idx) in selectedComponent.props.bindings || []"
            :key="binding.elementId"
            class="binding-card"
          >
            <div class="binding-card-header">
              <span class="shape-tag">ID: {{ binding.elementId }}</span>
              <button class="delete-btn" @click="removeBinding(idx)">✕</button>
            </div>

            <!-- Action type -->
            <div class="form-row">
              <label>Target Action</label>
              <select
                :value="binding.action"
                @change="updateBinding(idx, { action: ($event.target as HTMLSelectElement).value as any })"
              >
                <option value="fill">Fill Color</option>
                <option value="stroke">Outline / Stroke</option>
              </select>
            </div>

            <!-- Datapoint mapping -->
            <div class="form-row">
              <label>Data Point</label>
              <select
                :value="binding.dataPoint"
                @change="updateBinding(idx, { dataPoint: ($event.target as HTMLSelectElement).value })"
              >
                <option value="">-- Select Datapoint --</option>
                <option
                  v-for="dp in availableDataPoints"
                  :key="`${dp.machine_id}.${dp.datapoint}`"
                  :value="`${dp.machine_id}.${dp.datapoint}`"
                >
                  {{ dp.machine_id }} → {{ dp.datapoint }} ({{ dp.datatype }})
                </option>
                <!-- Fallback options if backend is offline -->
                <option value="Extruder_1.Status">Extruder_1.Status</option>
                <option value="Extruder_1.Temperature">Extruder_1.Temperature</option>
                <option value="Conveyor_1.Status">Conveyor_1.Status</option>
                <option value="Packer_1.Status">Packer_1.Status</option>
              </select>
            </div>

            <!-- Status Rules -->
            <div class="rules-container">
              <div class="rules-header">
                <span>Value → Color Rules</span>
                <button class="add-rule-btn" @click="addColorRule(idx)">+ Rule</button>
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
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. SPECIFIC: Gauge Properties -->
      <div v-else-if="selectedComponent.type === 'gauge'" class="section-card">
        <div class="section-title">Gauge Settings</div>
        <div class="form-row">
          <label>Title</label>
          <input
            v-model="selectedComponent.props.title"
            placeholder="Metric Title"
          />
        </div>
        <div class="grid-2x2">
          <div class="field-item">
            <label>Min</label>
            <input v-model.number="selectedComponent.props.min" type="number" />
          </div>
          <div class="field-item">
            <label>Max</label>
            <input v-model.number="selectedComponent.props.max" type="number" />
          </div>
        </div>
        <div class="form-row">
          <label>Unit</label>
          <input v-model="selectedComponent.props.unit" placeholder="°C, bar, rpm" />
        </div>
        <div class="form-row">
          <label>Test Value</label>
          <input
            v-model.number="selectedComponent.props.value"
            type="range"
            :min="selectedComponent.props.min || 0"
            :max="selectedComponent.props.max || 100"
          />
        </div>
      </div>

      <!-- Delete Component button -->
      <div class="danger-zone">
        <OnyxButton
          label="Delete Component"
          variation="danger"
          @click="handleDeleteComponent"
        />
      </div>
    </div>

    <!-- 2. NO COMPONENT SELECTED: CANVAS GLOBAL SETTINGS -->
    <div v-else class="inspector-content">
      <div class="section-card">
        <div class="section-title">Canvas Dimensions</div>
        <div class="grid-2x2">
          <div class="field-item">
            <label>Width (px)</label>
            <input v-model.number="dashboard.width" type="number" />
          </div>
          <div class="field-item">
            <label>Height (px)</label>
            <input v-model.number="dashboard.height" type="number" />
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-title">Appearance</div>
        <div class="form-row">
          <label>Background Color</label>
          <div class="color-row">
            <input v-model="dashboard.backgroundColor" type="color" class="color-picker" />
            <input v-model="dashboard.backgroundColor" class="text-input" />
          </div>
        </div>
      </div>

      <div class="canvas-info-box">
        <p>💡 Tip: Click any element on the canvas to configure its position, rotation, and data point bindings.</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.property-inspector {
  width: 320px;
  background: #18181b;
  border-left: 1px solid #27272a;
  display: flex;
  flex-direction: column;
  user-select: none;
  z-index: 10;
  overflow-y: auto;
}

.inspector-header {
  padding: 16px;
  border-bottom: 1px solid #27272a;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.inspector-title {
  font-size: 14px;
  font-weight: 700;
  color: #f4f4f5;
}

.inspector-subtitle {
  font-size: 12px;
  color: #0284c7;
  font-weight: 600;
}

.inspector-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-card {
  background: #27272a;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 12px;
  font-weight: 700;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-subtitle {
  font-size: 12px;
  font-weight: 600;
  color: #e4e4e7;
  margin-bottom: 8px;
}

.grid-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-item label,
.form-row label {
  font-size: 11px;
  color: #a1a1aa;
}

.field-item input,
.form-row input,
.form-row select {
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  color: #f4f4f5;
  font-size: 12px;
  padding: 6px 8px;
  outline: none;
}

.field-item input:focus,
.form-row input:focus,
.form-row select:focus {
  border-color: #0284c7;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.button-row {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  background: #3f3f46;
  border: 1px solid #52525b;
  color: #f4f4f5;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.action-btn.active {
  background: #0284c7;
  border-color: #38bdf8;
}

.picker-help {
  font-size: 11px;
  color: #38bdf8;
  background: rgba(2, 132, 199, 0.1);
  padding: 6px 8px;
  border-radius: 4px;
  margin: 0;
}

.binding-card {
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.binding-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.shape-tag {
  font-size: 11px;
  font-family: monospace;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.delete-btn {
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 12px;
}

.rules-container {
  margin-top: 4px;
  border-top: 1px solid #27272a;
  padding-top: 6px;
}

.rules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  color: #a1a1aa;
  margin-bottom: 6px;
}

.add-rule-btn {
  background: transparent;
  border: none;
  color: #0284c7;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.rule-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.val-input {
  width: 40px;
  font-size: 11px;
  padding: 2px 4px;
}

.color-picker {
  width: 28px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.label-input {
  flex: 1;
  font-size: 11px;
  padding: 2px 4px;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.danger-zone {
  margin-top: 8px;
}

.canvas-info-box {
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  font-size: 12px;
  color: #a1a1aa;
  line-height: 1.5;
}
</style>

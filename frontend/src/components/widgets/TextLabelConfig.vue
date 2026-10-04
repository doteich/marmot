<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useDesigner } from '@/composables/useDesigner'
import type { DashboardComponent } from '@/types/dashboard'

const props = defineProps<{
  component: DashboardComponent
}>()

const { availableDataPoints, updateComponent, fetchDataPoints } = useDesigner()

onMounted(() => {
  fetchDataPoints()
})

const groupedDataPoints = computed(() => {
  const map = new Map<string, typeof availableDataPoints.value>()
  for (const dp of availableDataPoints.value) {
    const key = dp.machineId || 'General'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(dp)
  }
  return Array.from(map.entries()).map(([machineId, items]) => ({
    machineId,
    items,
  }))
})

function updateProp(key: string, value: unknown) {
  updateComponent(props.component.id, {
    props: {
      ...props.component.props,
      [key]: value,
    },
  })
}

const colorPresets = [
  { label: 'Dark Slate', bg: 'rgba(30, 41, 59, 0.85)', text: '#f8fafc', border: '#475569' },
  { label: 'Transparent', bg: 'transparent', text: '#f8fafc', border: 'transparent' },
  { label: 'Blue Header', bg: 'rgba(2, 132, 199, 0.15)', text: '#38bdf8', border: '#0284c7' },
  { label: 'Emerald Good', bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: '#059669' },
  { label: 'Amber Alert', bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: '#d97706' },
  { label: 'Red Critical', bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: '#dc2626' },
]

function applyPreset(preset: typeof colorPresets[0]) {
  updateComponent(props.component.id, {
    props: {
      ...props.component.props,
      backgroundColor: preset.bg,
      textColor: preset.text,
      borderColor: preset.border,
    },
  })
}
</script>

<template>
  <div class="text-label-config">
    <div class="section-card">
      <div class="section-title">Label Content</div>

      <div class="form-row">
        <label>Text Content (use {value} for tag)</label>
        <textarea
          :value="component.props.text ?? 'Zone Label'"
          rows="2"
          class="inspector-textarea"
          placeholder="e.g. Line 1: Infeed or {value} rpm"
          @input="updateProp('text', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>

      <div class="form-row">
        <label>Live Data Point (Optional)</label>
        <select
          :value="component.props.dataPoint || ''"
          class="inspector-select"
          @change="updateProp('dataPoint', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">-- None (Static Text) --</option>
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
          <option
            v-if="component.props.dataPoint && !availableDataPoints.some((d) => d.dataPointId === component.props.dataPoint)"
            :value="component.props.dataPoint"
          >
            {{ component.props.dataPoint }}
          </option>
        </select>
      </div>

      <div class="form-row" v-if="component.props.dataPoint">
        <label>Unit Override</label>
        <input
          :value="component.props.unit || ''"
          placeholder="e.g. °C, pcs, bar"
          class="inspector-input"
          @input="updateProp('unit', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <!-- Typography -->
    <div class="section-card">
      <div class="section-title">Typography & Layout</div>

      <div class="grid-2x2">
        <div class="field-item">
          <label>Font Size (px)</label>
          <input
            :value="component.props.fontSize ?? 14"
            type="number"
            min="8"
            max="72"
            class="inspector-input"
            @input="updateProp('fontSize', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="field-item">
          <label>Font Weight</label>
          <select
            :value="component.props.fontWeight ?? '600'"
            class="inspector-select"
            @change="updateProp('fontWeight', ($event.target as HTMLSelectElement).value)"
          >
            <option value="400">Regular (400)</option>
            <option value="500">Medium (500)</option>
            <option value="600">SemiBold (600)</option>
            <option value="700">Bold (700)</option>
            <option value="800">Black (800)</option>
          </select>
        </div>
      </div>

      <div class="grid-2x2">
        <div class="field-item">
          <label>Alignment</label>
          <select
            :value="component.props.textAlign ?? 'center'"
            class="inspector-select"
            @change="updateProp('textAlign', ($event.target as HTMLSelectElement).value)"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
        <div class="field-item">
          <label>Border Radius (px)</label>
          <input
            :value="component.props.borderRadius ?? 6"
            type="number"
            min="0"
            max="30"
            class="inspector-input"
            @input="updateProp('borderRadius', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>
    </div>

    <!-- Style presets -->
    <div class="section-card">
      <div class="section-title">Visual Presets</div>
      <div class="presets-grid">
        <button
          v-for="p in colorPresets"
          :key="p.label"
          class="preset-badge-btn"
          :style="{ background: p.bg, color: p.text, borderColor: p.border }"
          @click="applyPreset(p)"
        >
          {{ p.label }}
        </button>
      </div>

      <div class="grid-2x2">
        <div class="field-item">
          <label>Text Color</label>
          <input
            :value="component.props.textColor ?? '#f8fafc'"
            type="text"
            class="inspector-input"
            @input="updateProp('textColor', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field-item">
          <label>Background</label>
          <input
            :value="component.props.backgroundColor ?? 'rgba(30, 41, 59, 0.85)'"
            type="text"
            class="inspector-input"
            @input="updateProp('backgroundColor', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.text-label-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
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
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--app-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
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
  color: var(--app-text-muted);
}

.inspector-input,
.inspector-select,
.inspector-textarea {
  background: var(--app-input-bg);
  border: 1px solid var(--app-input-border);
  border-radius: 6px;
  color: var(--app-text);
  font-size: 12px;
  padding: 6px 8px;
  outline: none;
  box-sizing: border-box;
  width: 100%;
  transition: border-color 0.15s ease;
  font-family: inherit;
}

.inspector-input:focus,
.inspector-select:focus,
.inspector-textarea:focus {
  border-color: var(--app-accent);
}

.inspector-textarea {
  resize: vertical;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.presets-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.preset-badge-btn {
  padding: 6px;
  border-radius: 6px;
  border-width: 1px;
  border-style: solid;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition: transform 0.1s ease;
}

.preset-badge-btn:hover {
  transform: translateY(-1px);
}
</style>

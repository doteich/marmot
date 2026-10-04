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
  { label: 'Cyan', color: '#0284c7' },
  { label: 'Emerald', color: '#10b981' },
  { label: 'Amber', color: '#f59e0b' },
  { label: 'Purple', color: '#8b5cf6' },
  { label: 'Rose', color: '#f43f5e' },
]
</script>

<template>
  <div class="trend-chart-config">
    <div class="section-card">
      <div class="section-title">Telemetry Binding</div>

      <div class="form-row">
        <label>Title</label>
        <input
          :value="component.props.title ?? 'Trend Chart'"
          placeholder="Chart Title"
          class="inspector-input"
          @input="updateProp('title', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="form-row">
        <label>Data Point (TimescaleDB Historical)</label>
        <select
          :value="component.props.dataPoint || ''"
          class="inspector-select"
          @change="updateProp('dataPoint', ($event.target as HTMLSelectElement).value)"
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
          <option
            v-if="component.props.dataPoint && !availableDataPoints.some((d) => d.dataPointId === component.props.dataPoint)"
            :value="component.props.dataPoint"
          >
            {{ component.props.dataPoint }}
          </option>
        </select>
      </div>

      <div class="form-row">
        <label>Unit Override</label>
        <input
          :value="component.props.unit || ''"
          placeholder="e.g. °C, bar, rpm (leave empty to use tag unit)"
          class="inspector-input"
          @input="updateProp('unit', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <!-- Appearance -->
    <div class="section-card">
      <div class="section-title">Appearance & Scale</div>

      <div class="form-row">
        <label>Line Color</label>
        <div class="color-presets">
          <button
            v-for="p in colorPresets"
            :key="p.color"
            class="color-btn"
            :class="{ active: (component.props.lineColor || '#0284c7') === p.color }"
            :style="{ backgroundColor: p.color }"
            :title="p.label"
            @click="updateProp('lineColor', p.color)"
          />
          <input
            :value="component.props.lineColor || '#0284c7'"
            type="text"
            class="inspector-input hex-input"
            @input="updateProp('lineColor', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="grid-2x2">
        <div class="field-item">
          <label>Area Gradient</label>
          <select
            :value="component.props.showArea !== false ? 'true' : 'false'"
            class="inspector-select"
            @change="updateProp('showArea', ($event.target as HTMLSelectElement).value === 'true')"
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>

        <div class="field-item">
          <label>Grid Lines</label>
          <select
            :value="component.props.showGrid !== false ? 'true' : 'false'"
            class="inspector-select"
            @change="updateProp('showGrid', ($event.target as HTMLSelectElement).value === 'true')"
          >
            <option value="true">Visible</option>
            <option value="false">Hidden</option>
          </select>
        </div>
      </div>

      <div class="grid-2x2">
        <div class="field-item">
          <label>Min Scale (Optional)</label>
          <input
            :value="component.props.min"
            type="number"
            placeholder="Auto"
            class="inspector-input"
            @input="updateProp('min', ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined)"
          />
        </div>
        <div class="field-item">
          <label>Max Scale (Optional)</label>
          <input
            :value="component.props.max"
            type="number"
            placeholder="Auto"
            class="inspector-input"
            @input="updateProp('max', ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined)"
          />
        </div>
      </div>
    </div>

    <!-- Card Background Styling -->
    <div class="section-card">
      <div class="section-title">Card Background</div>

      <div class="grid-2x2">
        <div class="field-item">
          <label>Style</label>
          <select
            :value="component.props.backgroundColor === 'transparent' ? 'transparent' : component.props.backgroundColor ? 'custom' : 'surface'"
            class="inspector-select"
            @change="(e) => {
              const val = (e.target as HTMLSelectElement).value
              if (val === 'surface') updateProp('backgroundColor', '')
              else if (val === 'transparent') updateProp('backgroundColor', 'transparent')
              else updateProp('backgroundColor', 'rgba(15, 23, 42, 0.75)')
            }"
          >
            <option value="surface">Default Surface (Theme)</option>
            <option value="transparent">Transparent</option>
            <option value="custom">Custom Color</option>
          </select>
        </div>

        <div class="field-item" v-if="component.props.backgroundColor && component.props.backgroundColor !== 'transparent'">
          <label>Custom Color</label>
          <input
            :value="component.props.backgroundColor"
            type="text"
            class="inspector-input"
            placeholder="e.g. #1e293b"
            @input="updateProp('backgroundColor', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trend-chart-config {
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
  transition: border-color 0.15s ease;
}

.inspector-input:focus,
.inspector-select:focus {
  border-color: var(--app-accent);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.color-presets {
  display: flex;
  align-items: center;
  gap: 6px;
}

.color-btn {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.active {
  border-color: #f8fafc;
}

.hex-input {
  flex: 1;
}
</style>

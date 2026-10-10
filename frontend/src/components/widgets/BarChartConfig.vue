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
  { label: 'Emerald', color: '#10b981' },
  { label: 'Sky Blue', color: '#0284c7' },
  { label: 'Amber', color: '#f59e0b' },
  { label: 'Purple', color: '#8b5cf6' },
  { label: 'Rose', color: '#f43f5e' },
]
</script>

<template>
  <div class="bar-chart-config">
    <div class="section-card">
      <div class="section-title">Telemetry Binding</div>

      <div class="form-row">
        <label>Title</label>
        <input
          :value="component.props.title ?? 'Output / Throughput'"
          placeholder="Chart Title"
          class="inspector-input"
          @input="updateProp('title', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="form-row">
        <label>Data Point (Bucketed Metrics)</label>
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

      <div class="grid-2x2">
        <div class="field-item">
          <label>Bucket Interval</label>
          <select
            :value="component.props.interval || '1h'"
            class="inspector-select"
            @change="updateProp('interval', ($event.target as HTMLSelectElement).value)"
          >
            <option value="5m">5 Minutes</option>
            <option value="10m">10 Minutes</option>
            <option value="15m">15 Minutes</option>
            <option value="30m">30 Minutes</option>
            <option value="1h">1 Hour</option>
            <option value="4h">4 Hours</option>
            <option value="8h">8 Hours (Shift)</option>
            <option value="24h">24 Hours (Day)</option>
          </select>
        </div>

        <div class="field-item">
          <label>Calculation</label>
          <select
            :value="component.props.calcMode || 'delta'"
            class="inspector-select"
            @change="updateProp('calcMode', ($event.target as HTMLSelectElement).value)"
          >
            <option value="delta">Delta (Last - First)</option>
            <option value="sum">Sum</option>
            <option value="avg">Average</option>
            <option value="max">Max</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <label>Unit</label>
        <input
          :value="component.props.unit || ''"
          placeholder="e.g. pcs, kg, units"
          class="inspector-input"
          @input="updateProp('unit', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <!-- Appearance & Target Line -->
    <div class="section-card">
      <div class="section-title">Bar Appearance & Targets</div>

      <div class="form-row">
        <label>Bar Color</label>
        <div class="color-presets">
          <button
            v-for="p in colorPresets"
            :key="p.color"
            class="color-btn"
            :class="{ active: (component.props.barColor || '#10b981') === p.color }"
            :style="{ backgroundColor: p.color }"
            :title="p.label"
            @click="updateProp('barColor', p.color)"
          />
          <input
            :value="component.props.barColor || '#10b981'"
            type="text"
            class="inspector-input hex-input"
            @input="updateProp('barColor', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="grid-2x2">
        <div class="field-item">
          <label>Target Line</label>
          <select
            :value="component.props.showTargetLine ? 'true' : 'false'"
            class="inspector-select"
            @change="updateProp('showTargetLine', ($event.target as HTMLSelectElement).value === 'true')"
          >
            <option value="false">Hidden</option>
            <option value="true">Visible</option>
          </select>
        </div>

        <div class="field-item" v-if="component.props.showTargetLine">
          <label>Target Value</label>
          <input
            :value="component.props.targetValue"
            type="number"
            placeholder="e.g. 500"
            class="inspector-input"
            @input="updateProp('targetValue', ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined)"
          />
        </div>
      </div>
    </div>

    <!-- Card Background Styling -->
    <div class="section-card">
      <div class="section-title">Card Background</div>

      <div class="form-row">
        <label>Style</label>
        <select
          :value="(!component.props.backgroundColor || ['glass', 'transparent', 'glass-dark', 'glass-light'].includes(component.props.backgroundColor as string)) ? 'glass' : (['solid', 'surface'].includes(component.props.backgroundColor as string) ? 'solid' : 'custom')"
          class="inspector-select"
          @change="(e) => {
            const val = (e.target as HTMLSelectElement).value
            if (val === 'glass') updateProp('backgroundColor', 'glass')
            else if (val === 'solid') updateProp('backgroundColor', 'solid')
            else updateProp('backgroundColor', '#1e293b')
          }"
        >
          <option value="glass">Glass (Theme)</option>
          <option value="solid">Solid (Theme)</option>
          <option value="custom">Custom Color</option>
        </select>
      </div>

      <div
        class="form-row"
        v-if="component.props.backgroundColor && !['glass', 'solid', 'surface', 'transparent', 'glass-dark', 'glass-light'].includes(component.props.backgroundColor as string)"
      >
        <label>Custom Color</label>
        <div class="color-row">
          <input
            :value="component.props.backgroundColor"
            type="color"
            class="color-picker"
            @input="updateProp('backgroundColor', ($event.target as HTMLInputElement).value)"
          />
          <input
            :value="component.props.backgroundColor"
            type="text"
            class="inspector-input"
            placeholder="#1e293b or rgba(...)"
            @input="updateProp('backgroundColor', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bar-chart-config {
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

.color-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.color-picker {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  flex-shrink: 0;
}
</style>

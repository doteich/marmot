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
</script>

<template>
  <div class="gauge-config">
    <div class="section-card">
      <div class="section-title">Gauge Settings</div>

      <div class="form-row">
        <label>Title</label>
        <input
          :value="component.props.title"
          placeholder="Metric Title"
          class="inspector-input"
          @input="updateProp('title', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="form-row">
        <label>Data Point (TimescaleDB / OPC UA)</label>
        <select
          :value="component.props.dataPoint || ''"
          class="inspector-select"
          @change="updateProp('dataPoint', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">-- Manual / Test Mode --</option>
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
          <label>Min</label>
          <input
            :value="component.props.min ?? 0"
            type="number"
            class="inspector-input"
            @input="updateProp('min', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="field-item">
          <label>Max</label>
          <input
            :value="component.props.max ?? 100"
            type="number"
            class="inspector-input"
            @input="updateProp('max', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>

      <div class="form-row">
        <label>Unit</label>
        <input
          :value="component.props.unit || ''"
          placeholder="°C, bar, rpm, %"
          class="inspector-input"
          @input="updateProp('unit', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="form-row">
        <label>Test Value ({{ component.props.value ?? 0 }})</label>
        <input
          :value="component.props.value ?? 0"
          type="range"
          :min="component.props.min ?? 0"
          :max="component.props.max ?? 100"
          class="inspector-range"
          @input="updateProp('value', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.gauge-config {
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

.grid-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  box-sizing: border-box;
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
  max-width: 100%;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
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
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.inspector-range {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  cursor: pointer;
}
</style>

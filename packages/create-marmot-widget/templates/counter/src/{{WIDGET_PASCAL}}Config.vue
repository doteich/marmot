<script setup lang="ts">
/**
 * Trend Counter property inspector.
 * Uses ONLY host global CSS classes (zero custom CSS).
 */
interface DataPointMeta {
  dataPointId: string
  dataPointName?: string
  machineId?: string
  dataType?: string
  unit?: string
}

interface GroupedDataPoint {
  machineId?: string
  items: DataPointMeta[]
}

interface WidgetComponent {
  id: string
  props: Record<string, unknown>
}

const props = defineProps<{
  component: WidgetComponent
  dataPoints?: DataPointMeta[]
  groupedDataPoints?: GroupedDataPoint[]
}>()

const emit = defineEmits<{
  (e: 'update', updatedProps: Record<string, unknown>): void
}>()

function updateProp(key: string, value: unknown) {
  emit('update', { [key]: value })
}

function prop<T>(key: string, fallback: T): T {
  const value = props.component.props[key]
  return (value === undefined || value === null ? fallback : value) as T
}

function isKnownDataPoint(id: string): boolean {
  if (props.groupedDataPoints?.some((g) => g.items?.some((d) => d.dataPointId === id))) return true
  if (props.dataPoints?.some((d) => d.dataPointId === id)) return true
  return false
}

const trendColorPresets = [
  { label: 'Emerald (rising)', color: '#10b981' },
  { label: 'Red (falling)', color: '#ef4444' },
  { label: 'Amber (stable)', color: '#f59e0b' },
]
</script>

<template>
  <div class="marmot-config-stack">
    <!-- Section 1: Appearance -->
    <div class="section-card">
      <div class="section-title">Appearance</div>

      <div class="form-row">
        <label>Label</label>
        <input
          :value="prop('label', 'Counter')"
          class="inspector-input"
          placeholder="Counter"
          @input="updateProp('label', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="grid-2x2">
        <div class="field-item">
          <label>Unit</label>
          <input
            :value="prop('unit', '')"
            class="inspector-input"
            placeholder="pcs/min"
            @input="updateProp('unit', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field-item">
          <label>Decimals</label>
          <select
            :value="String(prop('precision', 1))"
            class="inspector-select"
            @change="updateProp('precision', Number(($event.target as HTMLSelectElement).value))"
          >
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <label>Background Color</label>
        <div class="color-row">
          <input
            :value="prop('backgroundColor', '')"
            type="color"
            class="color-picker"
            @input="updateProp('backgroundColor', ($event.target as HTMLInputElement).value)"
          />
          <input
            :value="prop('backgroundColor', '')"
            type="text"
            class="inspector-input"
            placeholder="empty = frosted glass"
            @input="updateProp('backgroundColor', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </div>

    <!-- Section 2: Trend Indicators -->
    <div class="section-card">
      <div class="section-title">Trend Indicators</div>

      <div class="form-row">
        <label>Rising Color</label>
        <div class="color-presets">
          <button
            v-for="preset in trendColorPresets"
            :key="preset.color"
            type="button"
            class="color-btn"
            :class="{ active: prop('upColor', '#10b981') === preset.color }"
            :style="{ backgroundColor: preset.color }"
            :title="preset.label"
            @click="updateProp('upColor', preset.color)"
          />
          <input
            :value="prop('upColor', '#10b981')"
            type="text"
            class="inspector-input hex-input"
            @input="updateProp('upColor', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="form-row">
        <label>Falling Color</label>
        <div class="color-row">
          <input
            :value="prop('downColor', '#ef4444')"
            type="color"
            class="color-picker"
            @input="updateProp('downColor', ($event.target as HTMLInputElement).value)"
          />
          <input
            :value="prop('downColor', '#ef4444')"
            type="text"
            class="inspector-input"
            @input="updateProp('downColor', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="form-row">
        <label>Stable Color</label>
        <div class="color-row">
          <input
            :value="prop('flatColor', '#f59e0b')"
            type="color"
            class="color-picker"
            @input="updateProp('flatColor', ($event.target as HTMLInputElement).value)"
          />
          <input
            :value="prop('flatColor', '#f59e0b')"
            type="text"
            class="inspector-input"
            @input="updateProp('flatColor', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </div>

    <!-- Section 3: Behavior -->
    <div class="section-card">
      <div class="section-title">Behavior</div>

      <div class="form-row">
        <label>Data Point</label>
        <select
          v-if="(groupedDataPoints && groupedDataPoints.length > 0) || (dataPoints && dataPoints.length > 0)"
          :value="String(prop('dataPoint', ''))"
          class="inspector-select"
          @change="updateProp('dataPoint', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">-- Manual / Test Mode --</option>
          <template v-if="groupedDataPoints && groupedDataPoints.length > 0">
            <optgroup
              v-for="group in groupedDataPoints"
              :key="group.machineId || 'general'"
              :label="group.machineId ? `Machine: ${group.machineId}` : 'General / Other'"
            >
              <option v-for="dp in group.items" :key="dp.dataPointId" :value="dp.dataPointId">
                {{ dp.dataPointName || dp.dataPointId }}{{ dp.unit ? ' [' + dp.unit + ']' : '' }}
              </option>
            </optgroup>
          </template>
          <template v-else-if="dataPoints">
            <option v-for="dp in dataPoints" :key="dp.dataPointId" :value="dp.dataPointId">
              {{ dp.dataPointName || dp.dataPointId }}{{ dp.unit ? ' [' + dp.unit + ']' : '' }}
            </option>
          </template>
          <option
            v-if="prop('dataPoint', '') && !isKnownDataPoint(String(prop('dataPoint', '')))"
            :value="String(prop('dataPoint', ''))"
          >
            {{ prop('dataPoint', '') }}
          </option>
        </select>
        <input
          v-else
          :value="String(prop('dataPoint', ''))"
          class="inspector-input"
          placeholder="e.g. Line1.Counter"
          @input="updateProp('dataPoint', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="grid-2x2">
        <div class="field-item">
          <label>Window Size</label>
          <input
            :value="String(prop('windowSize', 5))"
            type="number"
            min="2"
            max="50"
            class="inspector-input"
            @input="updateProp('windowSize', Number(($event.target as HTMLInputElement).value) || 5)"
          />
        </div>
        <div class="field-item">
          <label>Flat Threshold</label>
          <input
            :value="String(prop('flatThreshold', 0.001))"
            type="number"
            step="0.001"
            class="inspector-input"
            @input="updateProp('flatThreshold', Number(($event.target as HTMLInputElement).value) || 0)"
          />
        </div>
      </div>

      <div class="form-row">
        <label>Manual Test Value</label>
        <input
          :value="String(prop('value', 0))"
          type="number"
          class="inspector-input"
          @input="updateProp('value', Number(($event.target as HTMLInputElement).value) || 0)"
        />
      </div>
    </div>
  </div>
</template>

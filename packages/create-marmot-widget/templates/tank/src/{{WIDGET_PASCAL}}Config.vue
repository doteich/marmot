<script setup lang="ts">
/**
 * Tank Gauge property inspector.
 * Uses ONLY host global CSS classes (zero custom CSS).
 */
type TankShape = 'tank_barrel' | 'tank_pin' | 'tank_rounded'

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

const fillColorPresets = [
  { label: 'Sky Blue', color: '#0284c7' },
  { label: 'Emerald', color: '#10b981' },
  { label: 'Amber', color: '#f59e0b' },
  { label: 'Purple', color: '#8b5cf6' },
  { label: 'Rose', color: '#f43f5e' },
]

const shapes: { value: TankShape; label: string }[] = [
  { value: 'tank_barrel', label: 'Barrel Tank' },
  { value: 'tank_pin', label: 'Pin Bottom Tank' },
  { value: 'tank_rounded', label: 'Round Bottom Tank' },
]
</script>

<template>
  <div class="marmot-config-stack">
    <!-- Section 1: Appearance -->
    <div class="section-card">
      <div class="section-title">Appearance</div>

      <div class="form-row">
        <label>Tank Shape</label>
        <select
          :value="prop('shape', 'tank_barrel')"
          class="inspector-select"
          @change="updateProp('shape', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="s in shapes" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
      </div>

      <div class="form-row">
        <label>Fill Color</label>
        <div class="color-presets">
          <button
            v-for="preset in fillColorPresets"
            :key="preset.color"
            type="button"
            class="color-btn"
            :class="{ active: prop('fillColor', '#0284c7') === preset.color }"
            :style="{ backgroundColor: preset.color }"
            :title="preset.label"
            @click="updateProp('fillColor', preset.color)"
          />
          <input
            :value="prop('fillColor', '#0284c7')"
            type="text"
            class="inspector-input hex-input"
            placeholder="#0284c7"
            @input="updateProp('fillColor', ($event.target as HTMLInputElement).value)"
          />
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

    <!-- Section 2: Behavior -->
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
          placeholder="e.g. Tank1.Level"
          @input="updateProp('dataPoint', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="form-row">
        <label>Max Capacity</label>
        <input
          :value="String(prop('capacity', 1000))"
          type="number"
          placeholder="1000"
          class="inspector-input"
          @input="updateProp('capacity', Number(($event.target as HTMLInputElement).value) || 1000)"
        />
      </div>
    </div>
  </div>
</template>

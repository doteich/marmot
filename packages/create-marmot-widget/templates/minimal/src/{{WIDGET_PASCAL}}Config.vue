<script setup lang="ts">
/**
 * Minimal property inspector.
 * Uses ONLY host global CSS classes (zero custom CSS) so the inspector stays
 * visually identical to every other Marmot widget.
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
</script>

<template>
  <div class="marmot-config-stack">
    <!-- Section 1: Appearance -->
    <div class="section-card">
      <div class="section-title">Appearance</div>

      <div class="form-row">
        <label>Label</label>
        <input
          :value="prop('label', 'New Widget')"
          class="inspector-input"
          placeholder="New Widget"
          @input="updateProp('label', ($event.target as HTMLInputElement).value)"
        />
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
          placeholder="e.g. Line1.Value"
          @input="updateProp('dataPoint', ($event.target as HTMLInputElement).value)"
        />
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

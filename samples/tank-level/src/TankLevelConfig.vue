<script setup lang="ts">
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

interface DashboardComponent {
  id: string
  props: {
    shape?: TankShape
    fillColor?: string
    backgroundColor?: string
    capacity?: number
    dataPoint?: string
    value?: number
    [key: string]: unknown
  }
}

const props = defineProps<{
  component: DashboardComponent
  dataPoints?: DataPointMeta[]
  groupedDataPoints?: GroupedDataPoint[]
}>()

const emit = defineEmits<{
  (e: 'update', updatedProps: Record<string, unknown>): void
}>()

const colorPresets = [
  { label: 'Sky Blue', color: '#0284c7' },
  { label: 'Emerald', color: '#10b981' },
  { label: 'Amber', color: '#f59e0b' },
  { label: 'Purple', color: '#8b5cf6' },
  { label: 'Rose', color: '#f43f5e' },
]

function updateProp(key: string, value: unknown) {
  emit('update', { [key]: value })
}

function isKnownDataPoint(id: string): boolean {
  if (props.groupedDataPoints) {
    for (const g of props.groupedDataPoints) {
      if (g.items?.some((d) => d.dataPointId === id)) return true
    }
  }
  if (props.dataPoints?.some((d) => d.dataPointId === id)) return true
  return false
}
</script>

<template>
  <div class="tank-level-config marmot-config-stack">
    <!-- Section 1: Appearance -->
    <div class="section-card">
      <div class="section-title">Appearance</div>

      <div class="form-row">
        <label>Tank Shape</label>
        <select :value="component.props.shape || 'tank_barrel'" class="inspector-select"
          @change="updateProp('shape', ($event.target as HTMLSelectElement).value)">
          <option value="tank_barrel">Barrel Tank</option>
          <option value="tank_pin">Pin Bottom Tank</option>
          <option value="tank_rounded">Round Bottom Tank</option>
        </select>
      </div>

      <div class="form-row">
        <label>Fill Color</label>
        <div class="color-presets">
          <button v-for="p in colorPresets" :key="p.color" type="button" class="color-btn"
            :class="{ active: (component.props.fillColor || '#0284c7') === p.color }"
            :style="{ backgroundColor: p.color }" :title="p.label" @click="updateProp('fillColor', p.color)" />
          <input :value="component.props.fillColor || '#0284c7'" type="text" class="inspector-input hex-input"
            placeholder="#0284c7" @input="updateProp('fillColor', ($event.target as HTMLInputElement).value)" />
        </div>
      </div>


      <div class="form-row">
        <label>Custom Background Color</label>
        <div class="color-row">
          <input :value="component.props.backgroundColor" type="color" class="color-picker"
            @input="updateProp('backgroundColor', ($event.target as HTMLInputElement).value)" />
          <input :value="component.props.backgroundColor" type="text" class="inspector-input"
            placeholder="#1e293b or rgba(...)"
            @input="updateProp('backgroundColor', ($event.target as HTMLInputElement).value)" />
        </div>
      </div>


    </div>

    <!-- Section 2: Telemetry & Capacity -->
    <div class="section-card">
      <div class="section-title">Behavior</div>

      <div class="form-row">
        <label>Data Point (Bucketed Metrics / Telemetry)</label>
        <select v-if="(groupedDataPoints && groupedDataPoints.length > 0) || (dataPoints && dataPoints.length > 0)"
          :value="component.props.dataPoint || ''" class="inspector-select"
          @change="updateProp('dataPoint', ($event.target as HTMLSelectElement).value)">
          <option value="">-- Manual / Test Mode --</option>
          <template v-if="groupedDataPoints && groupedDataPoints.length > 0">
            <optgroup v-for="group in groupedDataPoints" :key="group.machineId"
              :label="group.machineId ? `Machine: ${group.machineId}` : 'General / Other'">
              <option v-for="dp in group.items" :key="dp.dataPointId" :value="dp.dataPointId">
                {{ dp.dataPointName || dp.dataPointId }} ({{ dp.dataType }}){{ dp.unit ? ' [' + dp.unit + ']' : '' }}
              </option>
            </optgroup>
          </template>
          <template v-else-if="dataPoints">
            <option v-for="dp in dataPoints" :key="dp.dataPointId" :value="dp.dataPointId">
              {{ dp.dataPointName || dp.dataPointId }}{{ dp.unit ? ' [' + dp.unit + ']' : '' }}
            </option>
          </template>
          <option v-if="component.props.dataPoint && !isKnownDataPoint(component.props.dataPoint)"
            :value="component.props.dataPoint">
            {{ component.props.dataPoint }}
          </option>
        </select>
        <input v-else :value="component.props.dataPoint || ''" placeholder="e.g. Tank1.Level" class="inspector-input"
          @input="updateProp('dataPoint', ($event.target as HTMLInputElement).value)" />
      </div>

      <div class="form-row">

        <label>Max Capacity</label>
        <input :value="component.props.capacity ?? 1000" type="number" placeholder="1000" class="inspector-input"
          @input="updateProp('capacity', ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : 1000)" />

      </div>


    </div>





  </div>
</template>

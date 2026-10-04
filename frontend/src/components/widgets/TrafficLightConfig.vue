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
  <div class="traffic-light-config">
    <div class="section-card">
      <div class="section-title">Signal Configuration</div>

      <div class="form-row">
        <label>Title</label>
        <input
          :value="component.props.title ?? 'Machine Status'"
          placeholder="Status Title"
          class="inspector-input"
          @input="updateProp('title', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="form-row">
        <label>Data Point (Tag / Status Code)</label>
        <select
          :value="component.props.dataPoint || ''"
          class="inspector-select"
          @change="updateProp('dataPoint', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">-- None (Manual Test State) --</option>
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
              {{ dp.dataPointName }} ({{ dp.dataType }})
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
          <label>Orientation</label>
          <select
            :value="component.props.orientation ?? 'vertical'"
            class="inspector-select"
            @change="updateProp('orientation', ($event.target as HTMLSelectElement).value)"
          >
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </div>

        <div class="field-item">
          <label>Bulb Labels</label>
          <select
            :value="component.props.showLabels ? 'true' : 'false'"
            class="inspector-select"
            @change="updateProp('showLabels', ($event.target as HTMLSelectElement).value === 'true')"
          >
            <option value="false">Hidden</option>
            <option value="true">Visible</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Rule Evaluation -->
    <div class="section-card">
      <div class="section-title">Evaluation Logic</div>

      <div class="form-row">
        <label>Mode</label>
        <select
          :value="component.props.ruleMode ?? 'discrete'"
          class="inspector-select"
          @change="updateProp('ruleMode', ($event.target as HTMLSelectElement).value)"
        >
          <option value="discrete">Discrete Values (Value Matching)</option>
          <option value="threshold">Numeric Thresholds (Ranges)</option>
        </select>
      </div>

      <!-- 1. Discrete Mapping Inputs -->
      <div v-if="(component.props.ruleMode || 'discrete') === 'discrete'" class="form-row-group">
        <div class="form-row">
          <label class="color-label red-lbl">Alarm / Red Match Values</label>
          <input
            :value="component.props.alarmValues ?? '0, 3, fault, stopped, alarm, error'"
            placeholder="e.g. 0, fault, stopped"
            class="inspector-input"
            @input="updateProp('alarmValues', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="form-row">
          <label class="color-label yellow-lbl">Warn / Yellow Match Values</label>
          <input
            :value="component.props.warnValues ?? '2, warn, warning, idle, manual'"
            placeholder="e.g. 2, warn, idle"
            class="inspector-input"
            @input="updateProp('warnValues', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="form-row">
          <label class="color-label green-lbl">Run / Green Match Values</label>
          <input
            :value="component.props.runValues ?? '1, run, running, auto, ok, good'"
            placeholder="e.g. 1, run, auto"
            class="inspector-input"
            @input="updateProp('runValues', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="form-row">
          <label>Fallback / Default State</label>
          <select
            :value="component.props.defaultState || 'off'"
            class="inspector-select"
            @change="updateProp('defaultState', ($event.target as HTMLSelectElement).value)"
          >
            <option value="off">Off (All Bulbs Dim)</option>
            <option value="green">Green (Normal)</option>
            <option value="yellow">Yellow (Warning)</option>
            <option value="red">Red (Alarm)</option>
          </select>
        </div>
      </div>

      <!-- 2. Threshold Mapping Inputs -->
      <div v-else class="form-row-group">
        <div class="form-row">
          <label>Alarm Direction</label>
          <select
            :value="component.props.thresholdType || 'high-alarm'"
            class="inspector-select"
            @change="updateProp('thresholdType', ($event.target as HTMLSelectElement).value)"
          >
            <option value="high-alarm">High-Alarm (&gt;= Red, &gt;= Yellow)</option>
            <option value="low-alarm">Low-Alarm (&lt;= Red, &lt;= Yellow)</option>
          </select>
        </div>

        <div class="grid-2x2">
          <div class="field-item">
            <label class="color-label yellow-lbl">Yellow Threshold</label>
            <input
              :value="component.props.yellowThreshold ?? 50"
              type="number"
              class="inspector-input"
              @input="updateProp('yellowThreshold', Number(($event.target as HTMLInputElement).value))"
            />
          </div>
          <div class="field-item">
            <label class="color-label red-lbl">Red Threshold</label>
            <input
              :value="component.props.redThreshold ?? 80"
              type="number"
              class="inspector-input"
              @input="updateProp('redThreshold', Number(($event.target as HTMLInputElement).value))"
            />
          </div>
        </div>
      </div>

      <!-- Test Preview State -->
      <div class="form-row">
        <label>Preview Test State</label>
        <div class="state-buttons">
          <button
            class="state-btn red"
            :class="{ active: (component.props.activeState ?? 'green') === 'red' }"
            @click="updateProp('activeState', 'red')"
          >
            Red
          </button>
          <button
            class="state-btn yellow"
            :class="{ active: (component.props.activeState ?? 'green') === 'yellow' }"
            @click="updateProp('activeState', 'yellow')"
          >
            Yellow
          </button>
          <button
            class="state-btn green"
            :class="{ active: (component.props.activeState ?? 'green') === 'green' }"
            @click="updateProp('activeState', 'green')"
          >
            Green
          </button>
          <button
            class="state-btn off"
            :class="{ active: (component.props.activeState ?? 'green') === 'off' }"
            @click="updateProp('activeState', 'off')"
          >
            Off
          </button>
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
.traffic-light-config {
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

.state-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.state-btn {
  padding: 6px 4px;
  border-radius: 6px;
  border: 1px solid var(--app-border);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  background: var(--app-surface);
  color: var(--app-text-muted);
  transition: all 0.15s ease;
}

.state-btn.active.red {
  background: #ef4444;
  color: #fff;
  border-color: #ef4444;
}

.state-btn.active.yellow {
  background: #f59e0b;
  color: #fff;
  border-color: #f59e0b;
}

.state-btn.active.green {
  background: #10b981;
  color: #fff;
  border-color: #10b981;
}

.state-btn.active.off {
  background: #475569;
  color: #fff;
  border-color: #475569;
}

.form-row-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.color-label {
  font-weight: 600;
}

.color-label.red-lbl {
  color: #ef4444;
}

.color-label.yellow-lbl {
  color: #f59e0b;
}

.color-label.green-lbl {
  color: #10b981;
}
</style>

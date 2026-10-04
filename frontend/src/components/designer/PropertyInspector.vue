<script setup lang="ts">
import { computed } from 'vue'
import { OnyxButton, OnyxIcon } from 'sit-onyx'
import { iconCircleInformation } from '@sit-onyx/icons'
import { useDesigner } from '@/composables/useDesigner'
import { getWidgetConfigComponent } from '@/components/widgets/registry'

const {
  dashboard,
  selectedComponent,
  updateComponent,
  removeComponent,
  bringToFront,
  sendToBack,
  bringForward,
  sendBackward,
} = useDesigner()

const activeConfigComponent = computed(() => {
  if (!selectedComponent.value) return null
  return getWidgetConfigComponent(selectedComponent.value.type) || null
})

function handleNumberChange(prop: 'x' | 'y' | 'width' | 'height' | 'rotation', val: string) {
  if (!selectedComponent.value) return
  updateComponent(selectedComponent.value.id, {
    [prop]: Number(val) || 0,
  })
}

function handleDeleteComponent() {
  if (selectedComponent.value) {
    removeComponent(selectedComponent.value.id)
  }
}
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
              class="inspector-input"
              @input="handleNumberChange('x', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="field-item">
            <label>Y (px)</label>
            <input
              type="number"
              :value="selectedComponent.y"
              class="inspector-input"
              @input="handleNumberChange('y', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="field-item">
            <label>Width</label>
            <input
              type="number"
              :value="selectedComponent.width"
              class="inspector-input"
              @input="handleNumberChange('width', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="field-item">
            <label>Height</label>
            <input
              type="number"
              :value="selectedComponent.height"
              class="inspector-input"
              @input="handleNumberChange('height', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <!-- Layer Order / z-Index -->
        <div class="layer-order-row">
          <div class="layer-info">
            <label>Layer (z-Index)</label>
            <span class="layer-badge">{{ selectedComponent.zIndex || 1 }}</span>
          </div>
          <div class="layer-actions">
            <button
              class="layer-btn"
              title="Bring to Front"
              @click="bringToFront(selectedComponent.id)"
            >
              ⇈ Front
            </button>
            <button
              class="layer-btn"
              title="Bring Forward"
              @click="bringForward(selectedComponent.id)"
            >
              ↑ Up
            </button>
            <button
              class="layer-btn"
              title="Send Backward"
              @click="sendBackward(selectedComponent.id)"
            >
              ↓ Down
            </button>
            <button
              class="layer-btn"
              title="Send to Back"
              @click="sendToBack(selectedComponent.id)"
            >
              ⇊ Back
            </button>
          </div>
        </div>
      </div>

      <!-- Modular Component-Specific Configuration -->
      <component
        :is="activeConfigComponent"
        v-if="activeConfigComponent"
        :component="selectedComponent"
      />

      <!-- Delete Component button -->
      <div class="danger-zone">
        <OnyxButton
          label="Delete Component"
          variation="danger"
          class="delete-component-btn"
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
            <input v-model.number="dashboard.width" type="number" class="inspector-input" />
          </div>
          <div class="field-item">
            <label>Height (px)</label>
            <input v-model.number="dashboard.height" type="number" class="inspector-input" />
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-title">Appearance</div>
        <div class="form-row">
          <label>Background Color</label>
          <div class="color-row">
            <input v-model="dashboard.backgroundColor" type="color" class="color-picker" />
            <input v-model="dashboard.backgroundColor" class="inspector-input text-input" />
          </div>
        </div>
      </div>

      <div class="canvas-info-box">
        <div class="info-row">
          <OnyxIcon :icon="iconCircleInformation" class="info-icon" />
          <span>Tip: Click any element on the canvas to configure its position, rotation, and data point bindings.</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.property-inspector {
  width: 320px;
  min-width: 320px;
  max-width: 320px;
  background: var(--app-surface);
  border-left: 1px solid var(--app-border);
  display: flex;
  flex-direction: column;
  user-select: none;
  z-index: 10;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

.inspector-header {
  padding: 16px;
  border-bottom: 1px solid var(--app-border);
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.inspector-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--app-text);
}

.inspector-subtitle {
  font-size: 12px;
  color: var(--app-accent);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.inspector-content {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
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

.inspector-input {
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
  transition: border-color 0.15s ease;
}

.inspector-input:focus {
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

.color-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.color-picker {
  width: 30px;
  min-width: 30px;
  max-width: 30px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--app-input-border);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  box-sizing: border-box;
}

.color-row .text-input {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
}

.danger-zone {
  margin-top: 4px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.delete-component-btn {
  width: 100%;
}

.canvas-info-box {
  padding: 12px;
  background: var(--app-surface-subtle);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--app-text-muted);
  line-height: 1.5;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.info-icon {
  font-size: 14px;
  color: var(--app-accent);
  margin-top: 2px;
  flex-shrink: 0;
}

/* Layer Order Controls */
.layer-order-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--app-border);
}

.layer-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.layer-info label {
  font-size: 11px;
  color: var(--app-text-muted);
}

.layer-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--app-accent);
  background: rgba(2, 132, 199, 0.12);
  padding: 1px 6px;
  border-radius: 4px;
}

.layer-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.layer-btn {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  color: var(--app-text);
  border-radius: 4px;
  padding: 4px 2px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s ease;
}

.layer-btn:hover {
  background: var(--app-surface-hover);
  border-color: var(--app-accent);
  color: var(--app-accent);
}
</style>

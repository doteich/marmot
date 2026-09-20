<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { OnyxButton, OnyxIcon } from 'sit-onyx'
import { iconFolder, iconX, iconSearch, iconTrash } from '@sit-onyx/icons'

interface MachineLayoutItem {
  id: string
  name: string
  tags: string[]
  description: string
  svgObjectKey: string
  createdAt: string
  svgContent?: string
}

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select-layout', layout: MachineLayoutItem): void
  (e: 'open-upload'): void
}>()

const layouts = ref<MachineLayoutItem[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const selectedTag = ref<string | null>(null)
const previewCache = ref<Record<string, string>>({})

async function fetchLayouts() {
  isLoading.value = true
  try {
    const res = await fetch('/api/svgs')
    if (res.ok) {
      const data = await res.json()
      layouts.value = data.layouts || []
      // Preload previews for the first few items
      layouts.value.forEach((item) => loadPreview(item.id))
    }
  } catch (e) {
    console.error('Failed to load layouts', e)
  } finally {
    isLoading.value = false
  }
}

async function loadPreview(id: string) {
  if (previewCache.value[id]) return
  try {
    const res = await fetch(`/api/svgs/${id}/content`)
    if (res.ok) {
      const text = await res.text()
      previewCache.value[id] = text
    }
  } catch (e) {
    console.warn(`Could not load preview for layout ${id}`, e)
  }
}

const allTags = computed(() => {
  const set = new Set<string>()
  layouts.value.forEach((l) => l.tags?.forEach((t) => set.add(t)))
  return Array.from(set)
})

const filteredLayouts = computed(() => {
  return layouts.value.filter((l) => {
    const matchesSearch =
      !searchQuery.value ||
      l.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      l.description?.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesTag = !selectedTag.value || l.tags?.includes(selectedTag.value)

    return matchesSearch && matchesTag
  })
})

async function handleSelect(layout: MachineLayoutItem) {
  // If svg content not cached yet, fetch it
  let content = previewCache.value[layout.id]
  if (!content) {
    content = await fetch(`/api/svgs/${layout.id}/content`).then((r) => r.text()).catch(() => '')
  }
  emit('select-layout', { ...layout, svgContent: content })
  emit('close')
}

async function handleDelete(layout: MachineLayoutItem, e: MouseEvent) {
  e.stopPropagation()
  if (!confirm(`Are you sure you want to delete "${layout.name}"?`)) return

  try {
    const res = await fetch(`/api/svgs/${layout.id}`, { method: 'DELETE' })
    if (res.ok) {
      layouts.value = layouts.value.filter((l) => l.id !== layout.id)
    }
  } catch (err) {
    console.error('Failed to delete layout', err)
  }
}

onMounted(() => {
  fetchLayouts()
})
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-card">
      <div class="modal-header">
        <div class="header-left">
          <OnyxIcon :icon="iconFolder" class="header-icon" />
          <div>
            <h3>Machine Layout Catalog</h3>
            <span class="header-subtitle">Browse and reuse existing 2D line models</span>
          </div>
        </div>

        <div class="header-actions">
          <OnyxButton
            label="Upload New SVG"
            variation="primary"
            @click="emit('open-upload')"
          />
          <button class="close-btn" @click="emit('close')">
            <OnyxIcon :icon="iconX" />
          </button>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="catalog-toolbar">
        <div class="search-box">
          <OnyxIcon :icon="iconSearch" class="search-icon" />
          <input
            v-model="searchQuery"
            placeholder="Search layouts by name or description..."
          />
        </div>

        <div v-if="allTags.length > 0" class="tag-filters">
          <button
            class="tag-pill"
            :class="{ active: selectedTag === null }"
            @click="selectedTag = null"
          >
            All Tags
          </button>
          <button
            v-for="t in allTags"
            :key="t"
            class="tag-pill"
            :class="{ active: selectedTag === t }"
            @click="selectedTag = selectedTag === t ? null : t"
          >
            {{ t }}
          </button>
        </div>
      </div>

      <!-- Layouts Grid -->
      <div class="modal-body">
        <div v-if="isLoading" class="loading-box">
          <span>Loading layouts...</span>
        </div>

        <div v-else-if="filteredLayouts.length === 0" class="empty-state">
          <OnyxIcon :icon="iconFolder" class="empty-art" />
          <div class="empty-title">No machine layouts found</div>
          <div class="empty-desc">
            {{ searchQuery || selectedTag ? 'Try adjusting your search filters' : 'Upload your first SVG layout to start building your catalog' }}
          </div>
          <OnyxButton
            label="Upload New Layout"
            variation="primary"
            class="empty-btn"
            @click="emit('open-upload')"
          />
        </div>

        <div v-else class="layout-grid">
          <div
            v-for="layout in filteredLayouts"
            :key="layout.id"
            class="layout-card"
            @click="handleSelect(layout)"
          >
            <div class="card-preview">
              <div
                v-if="previewCache[layout.id]"
                class="svg-thumb"
                v-html="previewCache[layout.id]"
              ></div>
              <div v-else class="preview-loading">Loading SVG...</div>
            </div>

            <div class="card-info">
              <div class="card-header-row">
                <span class="layout-name" :title="layout.name">{{ layout.name }}</span>
                <button
                  class="delete-icon-btn"
                  title="Delete Layout"
                  @click="handleDelete(layout, $event)"
                >
                  <OnyxIcon :icon="iconTrash" />
                </button>
              </div>

              <p v-if="layout.description" class="layout-desc">{{ layout.description }}</p>

              <div v-if="layout.tags?.length" class="card-tags">
                <span v-for="t in layout.tags" :key="t" class="card-tag">{{ t }}</span>
              </div>

              <div class="card-footer-row">
                <span class="date">{{ new Date(layout.createdAt).toLocaleDateString() }}</span>
                <span class="select-hint">Click to Place</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  user-select: none;
}

.modal-card {
  width: 860px;
  max-width: 92vw;
  height: 680px;
  max-height: 85vh;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--app-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 24px;
}

.header-left h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text);
}

.header-subtitle {
  font-size: 12px;
  color: var(--app-text-muted);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--app-text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--app-surface-hover);
  color: var(--app-text);
}

.catalog-toolbar {
  padding: 12px 20px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-subtle);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--app-input-bg);
  border: 1px solid var(--app-input-border);
  border-radius: 8px;
  padding: 6px 12px;
}

.search-icon {
  font-size: 14px;
  opacity: 0.6;
}

.search-box input {
  background: transparent;
  border: none;
  color: var(--app-text);
  font-size: 13px;
  outline: none;
  width: 100%;
}

.tag-filters {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 0;
}

.tag-pill {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  color: var(--app-text-muted);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.tag-pill:hover,
.tag-pill.active {
  background: var(--app-accent);
  color: #ffffff;
  border-color: var(--app-accent);
}

.modal-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.loading-box,
.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  color: var(--app-text-muted);
}

.empty-art {
  font-size: 40px;
}

.empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text);
}

.empty-desc {
  font-size: 13px;
  max-width: 320px;
}

.empty-btn {
  margin-top: 8px;
}

.layout-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.layout-card {
  background: var(--app-surface-subtle);
  border: 1px solid var(--app-border);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.layout-card:hover {
  border-color: var(--app-accent);
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}

.card-preview {
  height: 140px;
  background: var(--app-surface);
  border-bottom: 1px solid var(--app-border);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  overflow: hidden;
  box-sizing: border-box;
}

.svg-thumb {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.svg-thumb svg) {
  max-height: 100%;
  max-width: 100%;
  width: auto;
  height: auto;
  pointer-events: none;
}

.preview-loading {
  font-size: 12px;
  color: var(--app-text-muted);
}

.card-info {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.layout-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.delete-icon-btn {
  background: transparent;
  border: none;
  font-size: 13px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s;
  padding: 2px;
}

.delete-icon-btn:hover {
  opacity: 1;
}

.layout-desc {
  font-size: 11px;
  color: var(--app-text-muted);
  margin: 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.card-tag {
  font-size: 9px;
  font-weight: 700;
  color: var(--app-accent);
  background: rgba(2, 132, 199, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
}

.card-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--app-border);
  font-size: 11px;
}

.date {
  color: var(--app-text-muted);
}

.select-hint {
  color: var(--app-accent);
  font-weight: 600;
}
</style>

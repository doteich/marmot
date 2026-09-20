<script setup lang="ts">
import { ref } from 'vue'
import { OnyxButton, OnyxIcon } from 'sit-onyx'
import { iconUpload, iconX, iconEngine } from '@sit-onyx/icons'

export interface UploadedLayoutPayload {
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
  (e: 'uploaded', layout: UploadedLayoutPayload): void
}>()

const isDragging = ref(false)
const file = ref<File | null>(null)
const previewSvg = ref<string>('')
const name = ref('')
const tags = ref('')
const description = ref('')
const isSubmitting = ref(false)
const errorMessage = ref('')

function handleFileSelect(selectedFile: File) {
  if (!selectedFile.name.toLowerCase().endsWith('.svg')) {
    errorMessage.value = 'Please select a valid .svg file.'
    return
  }

  errorMessage.value = ''
  file.value = selectedFile
  if (!name.value) {
    name.value = selectedFile.name.replace(/\.svg$/i, '')
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    previewSvg.value = (e.target?.result as string) || ''
  }
  reader.readAsText(selectedFile)
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const droppedFile = e.dataTransfer?.files[0]
  if (droppedFile) {
    handleFileSelect(droppedFile)
  }
}

function onFileInputChange(e: Event) {
  const selected = (e.target as HTMLInputElement).files?.[0]
  if (selected) {
    handleFileSelect(selected)
  }
}

async function handleUpload() {
  if (!file.value) {
    errorMessage.value = 'Please select an SVG file first.'
    return
  }
  if (!name.value.trim()) {
    errorMessage.value = 'Please provide a name for this machine layout.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file.value)
    formData.append('name', name.value.trim())
    formData.append('tags', tags.value.trim())
    formData.append('description', description.value.trim())

    const res = await fetch('/api/svgs/upload', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(errText || 'Upload failed')
    }

    const createdLayout = await res.json()
    emit('uploaded', createdLayout)
    emit('close')
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'Failed to upload SVG.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-card">
      <div class="modal-header">
        <div class="header-title-group">
          <OnyxIcon :icon="iconEngine" class="header-icon" />
          <h3>Upload Machine Layout</h3>
        </div>
        <button class="close-btn" @click="emit('close')">
          <OnyxIcon :icon="iconX" />
        </button>
      </div>

      <div class="modal-body">
        <div v-if="errorMessage" class="error-banner">
          {{ errorMessage }}
        </div>

        <!-- Dropzone -->
        <div
          class="dropzone"
          :class="{ 'is-dragging': isDragging, 'has-file': !!previewSvg }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
          @click="($refs.fileInput as HTMLInputElement)?.click()"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".svg"
            style="display: none"
            @change="onFileInputChange"
          />

          <div v-if="previewSvg" class="preview-container">
            <div class="svg-preview" v-html="previewSvg"></div>
            <div class="file-badge">
              <span>{{ file?.name }}</span>
              <span class="change-hint">(Click or drop to replace)</span>
            </div>
          </div>
          <div v-else class="drop-placeholder">
            <OnyxIcon :icon="iconUpload" class="upload-art" />
            <div class="drop-title">Drag & drop your machine SVG here</div>
            <div class="drop-desc">or click to browse from computer (draw.io, Inkscape, Illustrator)</div>
          </div>
        </div>

        <!-- Form fields -->
        <div class="form-fields">
          <div class="form-row">
            <label>Layout Name *</label>
            <input
              v-model="name"
              placeholder="e.g. Bottling & Packaging Line 1"
              required
            />
          </div>

          <div class="form-row">
            <label>Tags (comma separated)</label>
            <input
              v-model="tags"
              placeholder="e.g. extruder, packaging, conveyor, hall-a"
            />
          </div>

          <div class="form-row">
            <label>Description (optional)</label>
            <textarea
              v-model="description"
              rows="2"
              placeholder="Brief description of the machines in this layout..."
            ></textarea>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="secondary-btn" @click="emit('close')">Cancel</button>
        <OnyxButton
          :label="isSubmitting ? 'Sanitizing & Uploading...' : 'Upload to Catalog'"
          variation="primary"
          :disabled="isSubmitting || !file"
          @click="handleUpload"
        />
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
  width: 540px;
  max-width: 90vw;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
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
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  font-size: 20px;
}

.header-title-group h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text);
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

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 70vh;
  overflow-y: auto;
}

.error-banner {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid #ef4444;
  color: #f87171;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.dropzone {
  border: 2px dashed var(--app-border-strong);
  border-radius: 10px;
  background: var(--app-surface-subtle);
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
  padding: 16px;
  box-sizing: border-box;
}

.dropzone:hover,
.dropzone.is-dragging {
  border-color: var(--app-accent);
  background: rgba(2, 132, 199, 0.05);
}

.drop-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
}

.upload-art {
  font-size: 32px;
  margin-bottom: 4px;
}

.drop-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--app-text);
}

.drop-desc {
  font-size: 12px;
  color: var(--app-text-muted);
}

.preview-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.svg-preview {
  max-height: 140px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

:deep(.svg-preview svg) {
  max-height: 130px;
  width: auto;
  max-width: 100%;
}

.file-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-accent);
  background: var(--app-surface);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--app-border);
}

.change-hint {
  font-size: 11px;
  color: var(--app-text-muted);
  font-weight: 400;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-row label {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-muted);
}

.form-row input,
.form-row textarea {
  background: var(--app-input-bg);
  border: 1px solid var(--app-input-border);
  border-radius: 6px;
  color: var(--app-text);
  font-size: 13px;
  padding: 8px 10px;
  outline: none;
  box-sizing: border-box;
  width: 100%;
  transition: border-color 0.15s ease;
}

.form-row input:focus,
.form-row textarea:focus {
  border-color: var(--app-accent);
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--app-border);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  background: var(--app-surface-subtle);
}

.secondary-btn {
  background: transparent;
  border: 1px solid var(--app-border-strong);
  color: var(--app-text);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.secondary-btn:hover {
  background: var(--app-surface-hover);
}
</style>

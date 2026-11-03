import { ref, h, markRaw, type Component } from 'vue'
import { iconComputerSettings } from '@sit-onyx/icons'
import {
  registerWidget,
  unregisterWidget,
  type WidgetManifest,
  type WidgetCategory,
} from '@/components/widgets/registry'
import WidgetErrorFallback from '@/components/widgets/WidgetErrorFallback.vue'
import WidgetErrorConfig from '@/components/widgets/WidgetErrorConfig.vue'

export interface ExtensionManifestData {
  id: string
  name: string
  version: string
  category: string
  description?: string
  author?: string
  entry?: string
  defaultSize: {
    width: number
    height: number
  }
  defaultProps: Record<string, unknown>
}

export interface ExtensionItem {
  id: string
  name: string
  version: string
  category: string
  description: string
  author: string
  manifest: ExtensionManifestData
  bundlePath: string
  bundleUrl: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  loadError?: string
}

// Singleton state across components
const extensions = ref<ExtensionItem[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
let hasInitialized = false

export function useExtensionManager() {
  /**
   * Safely loads an external ESM bundle and registers the widget.
   * If the bundle fails or throws, registers an Error Boundary fallback so the canvas never crashes.
   */
  async function loadExtensionModule(ext: ExtensionItem): Promise<boolean> {
    if (!ext.enabled) {
      unregisterWidget(ext.id)
      return false
    }

    try {
      // Dynamic import with cache-busting timestamp
      const importUrl = `${ext.bundleUrl}?t=${new Date(ext.updatedAt).getTime() || Date.now()}`
      // Dynamic ESM import
      const module = await import(/* @vite-ignore */ importUrl)

      const widgetComponent: Component =
        module.default?.widgetComponent || module.widgetComponent || module.default
      const configComponent: Component | undefined =
        module.default?.configComponent || module.configComponent

      if (!widgetComponent) {
        throw new Error(
          `Extension bundle '${ext.id}' does not export a default component or 'widgetComponent'`
        )
      }

      const manifest: WidgetManifest = {
        type: ext.id,
        name: ext.name,
        category: (ext.category as WidgetCategory) || 'custom',
        description: ext.description || ext.manifest?.description || '',
        icon: iconComputerSettings,
        defaultSize: ext.manifest?.defaultSize || { width: 220, height: 220 },
        defaultProps: ext.manifest?.defaultProps || {},
        widgetComponent,
        configComponent,
      }

      registerWidget(manifest)
      ext.loadError = undefined
      return true
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[Marmot Extensions] Failed to load extension '${ext.id}':`, err)
      ext.loadError = errMsg

      // Register resilient Error Boundary fallback component
      const fallbackManifest: WidgetManifest = {
        type: ext.id,
        name: `${ext.name} (Error)`,
        category: (ext.category as WidgetCategory) || 'custom',
        description: `Failed to load: ${errMsg}`,
        icon: iconComputerSettings,
        defaultSize: ext.manifest?.defaultSize || { width: 220, height: 220 },
        defaultProps: ext.manifest?.defaultProps || {},
        widgetComponent: markRaw(h(WidgetErrorFallback, {
          title: `Error: ${ext.name}`,
          errorMessage: errMsg,
          type: ext.id,
        })),
        configComponent: markRaw(WidgetErrorConfig),
      }
      registerWidget(fallbackManifest)
      return false
    }
  }

  /**
   * Fetch all registered extensions from backend and load enabled ones
   */
  async function fetchExtensions(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const res = await fetch('/api/extensions')
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      const data: ExtensionItem[] = await res.json()
      extensions.value = data

      // Load all enabled extensions in parallel
      await Promise.allSettled(data.map((ext) => loadExtensionModule(ext)))
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch extensions'
      console.warn('[Marmot Extensions] Could not load extension catalog:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Upload and install a new extension bundle (.zip)
   */
  async function uploadExtension(file: File): Promise<ExtensionItem> {
    // 1. Client-side size & extension validation
    const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
    if (file.size > MAX_SIZE) {
      throw new Error(
        `Extension zip size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 5 MB maximum limit.`
      )
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      throw new Error('Please select a valid .zip extension archive.')
    }

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/extensions/upload', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Upload failed with status HTTP ${res.status}`)
    }

    const json = await res.json()
    const newExt: ExtensionItem = json.extension

    // Update local list
    const existingIdx = extensions.value.findIndex((e) => e.id === newExt.id)
    if (existingIdx >= 0) {
      extensions.value[existingIdx] = newExt
    } else {
      extensions.value.unshift(newExt)
    }

    // Immediately load and hot-register into runtime
    await loadExtensionModule(newExt)

    return newExt
  }

  /**
   * Toggle extension enabled status
   */
  async function toggleExtension(id: string, enabled: boolean): Promise<void> {
    const res = await fetch(`/api/extensions/${encodeURIComponent(id)}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || 'Failed to toggle extension')
    }

    const target = extensions.value.find((e) => e.id === id)
    if (target) {
      target.enabled = enabled
      await loadExtensionModule(target)
    }
  }

  /**
   * Uninstall and delete an extension
   */
  async function deleteExtension(id: string): Promise<void> {
    const res = await fetch(`/api/extensions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || 'Failed to delete extension')
    }

    unregisterWidget(id)
    extensions.value = extensions.value.filter((e) => e.id !== id)
  }

  /**
   * Global initialize: runs once when app starts
   */
  async function initExtensions(): Promise<void> {
    if (!hasInitialized) {
      hasInitialized = true
      await fetchExtensions()
    }
  }

  return {
    extensions,
    isLoading,
    error,
    initExtensions,
    fetchExtensions,
    uploadExtension,
    toggleExtension,
    deleteExtension,
  }
}

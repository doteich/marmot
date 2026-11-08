# Marmot Extension SDK — Developer Guide

> **Audience:** third-party widget authors building extensions for the Marmot SCADA/HMI canvas.
> **Status:** Extension SDK v1 — supported in the Designer canvas and the production Viewer.
> **Reference samples:** [`samples/tank-level`](../samples/tank-level), [`samples/trend-counter`](../samples/trend-counter)
> **Scaffolder:** [`packages/create-marmot-widget`](../packages/create-marmot-widget)

---

## Table of contents

1. [What is a Marmot extension?](#1-what-is-a-marmot-extension)
2. [Quick start](#2-quick-start)
3. [Project structure](#3-project-structure)
4. [`manifest.json` reference](#4-manifestjson-reference)
5. [The export contract (`src/index.ts`)](#5-the-export-contract-srcindexts)
6. [Widget component contract](#6-widget-component-contract)
7. [Config component contract](#7-config-component-contract)
8. [The host CSS class library](#8-the-host-css-class-library)
9. [Vite configuration explained](#9-vite-configuration-explained)
10. [Building, packaging & uploading](#10-building-packaging--uploading)
11. [The development workbench](#11-the-development-workbench)
12. [Runtime lifecycle & error boundaries](#12-runtime-lifecycle--error-boundaries)
13. [Constraints, limits & reserved identifiers](#13-constraints-limits--reserved-identifiers)
14. [Built-in templates](#14-built-in-templates)
15. [Troubleshooting & FAQ](#15-troubleshooting--faq)

---

## 1. What is a Marmot extension?

A Marmot extension is a self-contained **micro-frontend widget** that adds a new
visual component to the Marmot canvas. A single extension ships as one `.zip`
containing a compiled ES module (`bundle.js`) and a `manifest.json` describing
it.

Every extension provides two Vue components:

| Component | Rendered where | Responsibility |
| --- | --- | --- |
| **Widget component** | Canvas artboard & Production Viewer | Draw the visual, read live telemetry |
| **Config component** | Designer property inspector | Let the user edit the widget's props |

How the host integrates a widget at runtime:

```
   Admin upload (.zip)
          │
          ▼
   Backend validates manifest + bundle, stores them in MinIO,
   registers a row in the `extensions` table
          │
          ▼
   Frontend page load → GET /api/extensions
          │
          ▼
   useExtensionManager.ts → dynamic import(bundleUrl) inside an error boundary
          │
          ▼
   registerWidget({ type, name, category, defaultSize, defaultProps,
                    widgetComponent, configComponent })
          │
          ▼
   Widgets appear in the designer palette and render on the canvas
```

Key properties of the model:

- **Isolation.** Each bundle is imported dynamically. A bundle that fails to
  load or throws while rendering is replaced by an error card — neighbouring
  widgets keep working.
- **Shared runtime.** Vue is **not** bundled with your widget. The host exposes
  a single Vue instance so reactivity works across the host/widget boundary.
- **No restart needed.** Uploading, toggling, or deleting an extension
  hot-registers or unregisters it in the running designer session.

---

## 2. Quick start

The fastest path is the scaffolder. Inside this repository:

```bash
# from the repository root
node packages/create-marmot-widget/index.js my-counter --template counter
```

Once [`create-marmot-widget`](../packages/create-marmot-widget) is published, the
usual `create` convention works too:

```bash
npm create marmot-widget my-counter --template counter
# or: pnpm create marmot-widget my-counter
```

You will be prompted for a display name, category, description, author and
default size. Then:

```bash
cd my-counter
pnpm install
pnpm dev        # open the local workbench
```

When you are happy with the widget:

```bash
pnpm package    # → my-counter-1.0.0.zip
```

Upload the archive in the Marmot Admin Panel (**Extensions → Upload**), enable
it, and the widget shows up in the designer palette.

> Prefer to start from an existing reference? Copy `samples/tank-level` (SVG
> vessel + `<clipPath>`) or `samples/trend-counter` (sliding-window trend
> computation) and adapt it.

---

## 3. Project structure

```
my-counter/
├─ manifest.json            # extension metadata (read by the backend on upload)
├─ vite.config.ts           # lib-mode build, CSS-in-JS injection, vue external
├─ scripts/package.mjs      # builds the uploadable .zip archive
├─ package.json
├─ tsconfig*.json           # type-checking setup (vue-tsc)
├─ index.html               # dev-server HTML shell (dev only)
└─ src/
   ├─ index.ts              # PRODUCTION EXPORT ROOT → { widgetComponent, configComponent }
   ├─ MyCounter.vue         # the on-canvas widget            (production)
   ├─ MyCounterConfig.vue   # the property inspector panel    (production)
   ├─ App.vue               # dev workbench layout            (dev only)
   ├─ main.ts               # dev entry point                 (dev only)
   └─ dev/marmot-theme.css  # simulated host theme            (dev only)
```

**Only `src/index.ts` and everything it imports are compiled into `bundle.js`.**
`App.vue`, `main.ts` and `dev/` exist purely for local development and never
ship to production.

---

## 4. `manifest.json` reference

The backend reads and validates this file on upload.

```json
{
  "id": "trend-counter",
  "name": "Trend Counter",
  "version": "1.0.0",
  "category": "indicator",
  "description": "Numerical readout with a directional trend arrow",
  "author": "Marmot Dev",
  "entry": "bundle.js",
  "defaultSize": { "width": 260, "height": 170 },
  "defaultProps": {
    "label": "Counter",
    "unit": "",
    "precision": 1,
    "dataPoint": "",
    "backgroundColor": ""
  }
}
```

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `id` | string | ✅ | 3–64 chars, lower-case `a-z0-9` with single hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`). Must not be a [reserved identifier](#13-constraints-limits--reserved-identifiers). Becomes the widget `type` used by the canvas. |
| `name` | string | ✅ | ≤ 100 chars. Shown in the widget palette. |
| `version` | string | ✅ | ≤ 32 chars. Stored and displayed; also used for the MinIO object key `<id>/<version>/bundle.js`. |
| `category` | string | – | One of `layout`, `indicator`, `chart`, `annotation`, `custom`. Defaults to `custom`. |
| `description` | string | – | Shown in the palette tooltip / admin list. |
| `author` | string | – | Free text. |
| `entry` | string | – | Bundle file inside the zip. Defaults to `bundle.js`. Must be a safe relative path (no `..`, no leading `/`). |
| `defaultSize` | object | ✅ | `{ width, height }` in px, each `1…4000`. Used for the initial component size on drop. |
| `defaultProps` | object | – | Arbitrary JSON. Seeded into the component's `props` when it is added to the canvas. Defaults to `{}`. |

> **`id` = `type`.** The manifest `id` is what the designer writes into every
> component instance (`component.type`). Changing an `id` after widgets have
> been placed breaks their binding, so pick it once.

---

## 5. The export contract (`src/index.ts`)

The host imports your bundle and looks for a **default export** (or equivalently
the named `widgetComponent` / `configComponent` exports):

```ts
import Widget from './MyCounter.vue'
import WidgetConfig from './MyCounterConfig.vue'

export default {
  widgetComponent: Widget,
  configComponent: WidgetConfig,
}
```

| Export | Required | Purpose |
| --- | --- | --- |
| `widgetComponent` | ✅ | Rendered on the canvas and in the viewer. |
| `configComponent` | – | Rendered in the property inspector. If omitted, the host falls back to a read-only error/info panel. |

If `widgetComponent` is missing, the extension registers an error boundary
placeholder instead of crashing the app.

---

## 6. Widget component contract

Your widget component receives a flat set of props: everything from its saved
`props` object, **plus** the host-provided props below.

### 6.1 Host-provided props

| Prop | Type | Injected by | Notes |
| --- | --- | --- | --- |
| `telemetryValues` | `Record<string, unknown>` | host | The live telemetry map: `{ [dataPointId]: latestValue }`. |
| `dataPoint` *(convention)* | `string` | your config | The selected telemetry key. By convention the host does **not** set this — your config writes it into `props`. |
| `backgroundColor` *(convention)* | `string` | your config | Empty string ⇒ use `.widget-glass`. Set ⇒ apply directly. |

Because props are passed through from the component instance, any keys you list
in `manifest.json#defaultProps` arrive as regular props too.

### 6.2 Reading live telemetry

`telemetryValues` is a reactive map maintained by the host. Read the value for
the bound data point and fall back to a manual value when unbound:

```ts
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    dataPoint?: string
    value?: number
    telemetryValues?: Record<string, unknown>
  }>(),
  { dataPoint: '', value: 0, telemetryValues: () => ({}) },
)

const currentValue = computed<number>(() => {
  const raw = props.dataPoint ? props.telemetryValues?.[props.dataPoint] : undefined
  if (raw !== undefined && raw !== null) {
    const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw))
    if (Number.isFinite(parsed)) return parsed
  }
  const fallback = typeof props.value === 'number' ? props.value : parseFloat(String(props.value))
  return Number.isFinite(fallback) ? fallback : 0
})
```

> The host delivers only the **latest** value per data point. If your widget
> needs a short history (trends, rates, deltas), keep your own sliding window —
> see `samples/trend-counter`.

### 6.3 Styling & theming

Two mechanisms, both driven by the artboard's `data-canvas-theme` attribute:

1. **Surface classes** — apply to your root element:

   | Class | Effect |
   | --- | --- |
   | `.widget-card` | Base container (radius, box-sizing, colour transition). |
   | `.widget-glass` | Frosted glassmorphism surface. |
   | `.widget-solid` | Opaque industrial surface. |

   Conditional pattern used by the samples:

   ```vue
   <div
     class="widget-card my-widget"
     :class="props.backgroundColor === '' ? 'widget-glass' : ''"
     :style="{ background: props.backgroundColor }"
   >
   ```

2. **Theme CSS variables** — exposed on both themes and safe to use in your own
   `<style scoped>`:

   | Variable | Purpose |
   | --- | --- |
   | `--canvas-theme-text` | Primary text colour |
   | `--canvas-theme-text-muted` | Secondary text |
   | `--canvas-theme-surface` | Solid surface background |
   | `--canvas-theme-border` | Border colour |
   | `--canvas-theme-border-strong` | Emphasis border |
   | `--canvas-theme-glass-bg` / `-border` / `-shadow` | Glass surface tokens |

   Themes: `industrial-dark`, `cleanroom-light`.

### 6.4 SVG tips

- Give every `<clipPath>` a **unique id** per instance
  (`'clip-' + Math.random().toString(36).slice(2, 9)`) — ids are global in the DOM.
- Never put `<clipPath>` directly on an element that also has a `transform`
  (`rotate`, `matrix`, …): the clip is evaluated in that element's local
  coordinate matrix. Wrap the clipped content in an **untransformed** `<g>`, or
  express the geometry in unrotated coordinates.

### 6.5 Sizing

The host sizes the wrapper to the component's `width`/`height`. Make your root
fill it:

```css
.my-widget {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}
```

---

## 7. Config component contract

The config component is what the user manipulates in the property inspector.

### 7.1 Props & events

```ts
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
```

| Prop | Meaning |
| --- | --- |
| `component` | The selected canvas component. Read the current values from `component.props`. |
| `dataPoints` | Flat list of known telemetry data points for the active site. |
| `groupedDataPoints` | The same data points grouped by `machineId` — ideal for `<optgroup>`. |

Emit a **partial** props object; the host merges it into the component:

```ts
emit('update', { fillColor: '#10b981' })
```

A small helper keeps templates tidy:

```ts
function prop<T>(key: string, fallback: T): T {
  const value = props.component.props[key]
  return (value === undefined || value === null ? fallback : value) as T
}
```

### 7.2 The Zero-CSS rule

> **Config components must not bundle their own design system or component
> library** (no `sit-onyx`, no styled-component libraries, no custom CSS files).
> They must use the host's global classes so every inspector looks identical.

Use the host class library (section 8) plus the shared wrapper
`.marmot-config-stack`. A typical layout:

```vue
<template>
  <div class="marmot-config-stack">
    <div class="section-card">
      <div class="section-title">Appearance</div>
      <div class="form-row">
        <label>Label</label>
        <input class="inspector-input" /* … */ />
      </div>
    </div>
  </div>
</template>
```

The reference components `samples/tank-level/src/TankLevelConfig.vue` and
`samples/trend-counter/src/TrendCounterConfig.vue` are worked examples.

---

## 8. The host CSS class library

These classes are provided globally by the Marmot host
(`frontend/src/assets/main.css`). Use them — do not redefine them.

**Containers**

| Class | Purpose |
| --- | --- |
| `.marmot-config-stack` | Root wrapper: vertical stack of sections |
| `.section-card` | Bordered card for a group of fields |
| `.section-title` | Uppercase uppercase section heading |

**Layout**

| Class | Purpose |
| --- | --- |
| `.form-row` | Label + control, stacked vertically |
| `.grid-2x2` | Two-column field grid |
| `.field-item` | A single labelled field inside a grid |

**Controls**

| Class | Purpose |
| --- | --- |
| `.inspector-input` | Text / number input |
| `.inspector-select` | `<select>` dropdown |
| `.color-row` | Colour swatch + text input row |
| `.color-picker` | Native `<input type="color">` swatch |
| `.color-presets` | Row of preset swatches + hex input |
| `.color-btn` | A preset colour button (add `.active` for selection) |
| `.hex-input` | Flex-fill hex text input beside presets |

For local preview the dev-only `src/dev/marmot-theme.css` mirrors these classes
so your workbench looks like the real inspector without bundling host CSS.

---

## 9. Vite configuration explained

The generated `vite.config.ts` is the heart of a correct extension build.

```ts
export default defineConfig({
  plugins: [vue(), cssInjectedByJsPlugin()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': {},
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'my-counter',
      fileName: () => 'bundle.js',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue'],
      output: { globals: { vue: 'window.__MARMOT_SDK__.vue' } },
    },
  },
})
```

| Piece | Why it is required |
| --- | --- |
| `lib` + `formats: ['es']` | Emits a single ES module (`bundle.js`) the browser can `import()`. |
| `external: ['vue']` | **Critical.** The host supplies one shared Vue instance. Bundling a second copy silently breaks reactivity between the host and the widget. |
| `globals.vue` | Documents the shared runtime location, `window.__MARMOT_SDK__.vue`. |
| `cssInjectedByJsPlugin` | Rolls all emitted CSS into `bundle.js`, appending a `<style data-extension="<id>">` tag at runtime (extensions are a single file — no sidecar `.css`). |
| `process.env` shim | Some dependencies probe `process.env` at runtime; the shim prevents browser crashes. |

**How the bare `import 'vue'` resolves.** The host page declares a browser
import map:

```html
<script type="importmap">
  { "imports": { "vue": "/vendor/vue.js" } }
</script>
```

so `import { ref } from 'vue'` inside your bundle resolves to the host's shared
runtime without a bundler on the browser side.

---

## 10. Building, packaging & uploading

```bash
pnpm build       # vue-tsc type-check + vite build → dist/bundle.js
pnpm package     # build, then produce <id>-<version>.zip
```

`scripts/package.mjs` creates an archive containing **`bundle.js` and
`manifest.json` at the archive root** — a flat layout the backend requires.

```
<id>-<version>.zip
├─ bundle.js
└─ manifest.json
```

Upload it via the Marmot **Admin Panel → Extensions → Upload**. The backend:

1. Enforces the size limits (section 13).
2. Locates `manifest.json`, validates its schema, and rejects reserved ids.
3. Verifies the declared `entry` exists and is non-empty.
4. Streams the bundle and manifest to the MinIO `extensions` bucket.
5. Upserts a row into the `extensions` table.

After upload you can **enable/disable** the extension (disabled extensions are
removed from the running registry and their bundle endpoint returns `403`) or
**delete** it (removes the DB row and the MinIO objects).

---

## 11. The development workbench

`pnpm dev` serves `index.html` → `src/main.ts` → `src/App.vue`, a workbench that
mirrors the two real surfaces:

- a **canvas stage** with an Industrial Dark / Cleanroom Light toggle, and
- a **property inspector** sidebar rendering your config component.

It also runs a small telemetry simulator and passes the result into your widget
as `telemetryValues`, so `dataPoint`-driven widgets animate without a backend.
Edit the mock data points and ramp in `src/App.vue`.

> The workbench files are never bundled. `vite.config.ts` only builds
> `src/index.ts`.

---

## 12. Runtime lifecycle & error boundaries

Host loading flow (`frontend/src/composables/useExtensionManager.ts`):

1. On app start, `initExtensions()` fetches `GET /api/extensions` once.
2. Every **enabled** extension is imported in parallel:
   `await import(/* @vite-ignore */ \`${bundleUrl}?t=${updatedAt}\`)`.
   The `?t=` cache-buster guarantees a fresh module after re-upload.
3. The module's `default.widgetComponent` / `default.configComponent` are
   registered via `registerWidget(...)`, wrapped in `markRaw(...)` to avoid the
   Vue "component made reactive" warning.
4. If the import or registration throws, the host registers an error-boundary
   widget (`WidgetErrorFallback.vue` / `WidgetErrorConfig.vue`). The canvas keeps
   running; only the faulty widget shows an error card.
5. Toggling an extension off calls `unregisterWidget(id)`; toggling on
   re-imports it.

Consequences for authors:

- Keep the top-level module side-effect free (no work at import time beyond
  component definitions).
- Throw early and clearly if a required dependency is missing — the error text
  is surfaced on the canvas error card.

---

## 13. Constraints, limits & reserved identifiers

| Constraint | Value |
| --- | --- |
| Max uploaded zip size | **5 MB** |
| Max uncompressed payload | **25 MB** |
| `id` pattern | `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–64 chars |
| `name` length | ≤ 100 chars |
| `version` length | ≤ 32 chars |
| `defaultSize` | each dimension `1…4000` px |
| Categories | `layout`, `indicator`, `chart`, `annotation`, `custom` |

**Reserved ids** (built-in widgets you may not override):

```
svg-machine   gauge   traffic-light   trend-chart
chart         bar-chart   text-label
```

**Archive rules**

- `manifest.json` must be present (any folder depth is tolerated, but a flat
  root is expected).
- Paths containing `..` are rejected (zip-slip protection).
- The declared `entry` must exist and be non-empty.
- `bundle.js` and `manifest.json` at the archive root is the supported layout.

---

## 14. Built-in templates

`create-marmot-widget` ships three starting templates:

| Template | What it demonstrates | Default size |
| --- | --- | --- |
| `minimal` | Smallest possible widget + config. | 240 × 160 |
| `counter` | Numeric readout + ▲/▼/◆ trend from a sliding window of live samples. | 260 × 170 |
| `tank` | SVG vessel with liquid fill clipped to a percentage (`<clipPath>`). | 220 × 320 |

Reference projects in the repository:

- [`samples/tank-level`](../samples/tank-level) — SVG geometry, per-instance
  clip ids, clipped fills, colour presets.
- [`samples/trend-counter`](../samples/trend-counter) — internal history,
  derived state, configurable colour rules.

---

## 15. Troubleshooting & FAQ

**My widget doesn't appear in the palette after upload.**
Check the extension is *enabled*, then reload the designer. Inspect the network
tab for `GET /api/extensions` and `GET /api/extensions/<id>/bundle`. A failing
bundle import shows an error card on the canvas and a console error prefixed
`[Marmot Extensions]`.

**The widget renders but telemetry never updates.**
Confirm the prop is named `telemetryValues` (camelCase; the host passes
`telemetry-values`) and that you read `telemetryValues[dataPoint]`. Also verify
`dataPoint` is actually set on the component.

**Reactivity is broken / values are stale.**
You almost certainly bundled a second copy of Vue. Ensure
`rollupOptions.external` contains `'vue'` and that the host import map is in
place. Never add a second Vue instance.

**`[Vue warn]: Vue received a Component that was made a reactive object.`**
The host wraps dynamic components in `markRaw`. If you register components
yourself, `markRaw(...)` them before putting them in reactive state.

**My inspector looks different from the built-in ones.**
You are shipping custom CSS. Remove it and use the host classes in section 8.
The only local stylesheet you may keep is `src/dev/marmot-theme.css`, and that
is dev-only.

**Styles leak or clash on the canvas.**
Use `<style scoped>` in your widget component. Global selectors can affect the
whole artboard. Avoid bare element selectors (`div { … }`).

**The liquid fill / clip is positioned wrong.**
See section 6.4 — clipping and `transform` interact badly. Clip inside an
untransformed `<g>` or use unrotated coordinates.

**Upload is rejected for size.**
Zip limit is 5 MB. Trim dependencies (Vue is already external), and remember
only `src/index.ts` and its imports are bundled — keep heavy demo code out of
that graph.

**`import 'vue'` fails in the browser at runtime.**
Native ESM cannot resolve bare specifiers without an import map. The host page
provides it; if you embed a bundle elsewhere for testing, add the same import
map.

**Where do I see validation errors?**
The backend returns plain-text error bodies (e.g. `Manifest schema validation
failed: ...`), surfaced by the Admin Panel upload UI.

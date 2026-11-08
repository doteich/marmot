# Trend Counter

Numerical readout with a directional trend arrow computed from the last live samples

A [Marmot SCADA/HMI](https://github.com/) extension widget. `id: trend-counter` · `category: indicator` · `v1.0.0`.

## Getting started

```sh
pnpm install
pnpm dev          # local workbench with simulated live telemetry
```

`pnpm dev` opens a workbench that renders your widget on a canvas artboard
(with Industrial Dark / Cleanroom Light themes) next to a simulated property
inspector, so you can develop the widget and its config in isolation.

## How the trend is computed

The host injects only the *latest* value per data point
(`telemetryValues[dataPointId]`), so a widget that needs history keeps its own
small sliding window. This sample is a reference for exactly that pattern:

1. `currentValue` resolves the newest numeric sample from
   `telemetryValues[props.dataPoint]` (falling back to the manual `value` prop).
2. A `watch` pushes every *distinct* new sample into `history`, capped at
   `windowSize` entries (default `5`).
3. `delta` is `newest − oldest` still inside the window.
4. `trend` compares `|delta|` against `flatThreshold`:

   | Condition | Arrow | Color prop |
   | --- | --- | --- |
   | `delta > flatThreshold` | ▲ | `upColor` |
   | `delta < -flatThreshold` | ▼ | `downColor` |
   | otherwise | ◆ | `flatColor` |

The window is seeded with copies of the first sample so the widget starts
"flat" rather than jumping on its first update.

## Project layout

```
trend-counter/
├─ manifest.json            # extension metadata the host reads on upload
├─ vite.config.ts           # lib-mode build + CSS-in-JS injection + vue external
├─ scripts/package.mjs      # builds the uploadable .zip archive
└─ src/
   ├─ index.ts              # exports { widgetComponent, configComponent }
   ├─ TrendCounter.vue # the on-canvas widget
   ├─ TrendCounterConfig.vue # the property inspector panel
   ├─ App.vue # dev-only workbench (not bundled)
   ├─ main.ts # dev-only entry (not bundled)
   └─ dev/marmot-theme.css # dev-only host theme simulation (not bundled)
```

Only `src/index.ts` and everything it imports are compiled into `bundle.js`.
The workbench files (`App.vue`, `main.ts`, `dev/`) never ship to production.

## Building & packaging

```sh
pnpm build        # type-check + emit dist/bundle.js
pnpm package      # build, then zip dist/bundle.js + manifest.json
```

Upload the resulting `trend-counter-1.0.0.zip` through the Marmot
**Admin Panel → Extensions → Upload**. Once enabled it appears in the designer
widget palette.

## Contracts

### Widget component (`src/TrendCounter.vue`)

Receives its props from the component's saved `props` object plus the host
injected `telemetryValues` map:

| Prop | Source | Notes |
| --- | --- | --- |
| `telemetryValues` | host | `{ [dataPointId]: latestValue }`, injected automatically |
| `backgroundColor` | host / config | empty string falls back to the `.widget-glass` frosted surface |
| _your custom props_ | config | declared in `manifest.json#defaultProps` |

Read the live value for a bound `dataPoint` like this:

```ts
const value = props.dataPoint ? props.telemetryValues?.[props.dataPoint] : undefined
```

Canvas theming is delivered through CSS variables on the artboard
(`--canvas-theme-text`, `--canvas-theme-border`, …) plus the shared widget
surfaces `.widget-glass` and `.widget-solid`.

### Config component (`src/TrendCounterConfig.vue`)

Receives `component`, `dataPoints`, and `groupedDataPoints`, and emits
`update` with a partial props object:

```ts
emit('update', { fillColor: '#10b981' })
```

> **Zero-CSS rule:** the inspector must not ship its own design system.
> Use the host global classes (`.section-card`, `.form-row`, `.inspector-input`,
> `.inspector-select`, `.color-row`, `.color-picker`, `.color-presets`,
> `.color-btn`, `.hex-input`, `.grid-2x2`, `.field-item`) so every widget
> inspector looks identical.

## Learn more

See `docs/EXTENSION_SDK.md` in the Marmot repository for the full developer
guide, manifest reference and troubleshooting.

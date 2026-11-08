# create-marmot-widget

Scaffold a new [Marmot](../..) SCADA/HMI extension widget project — a Vue 3 +
Vite library that compiles to a single `bundle.js` uploadable as a `.zip`.

Zero runtime dependencies. Node ≥ 18.

## Usage

```bash
# via npm / pnpm "create" convention
npm create marmot-widget my-counter
pnpm create marmot-widget my-counter

# or run the CLI directly
node /path/to/packages/create-marmot-widget/index.js my-counter
```

Interactive prompts cover: widget id, starting template, display name,
category, description, author, and default size.

## Options

| Flag | Description |
| --- | --- |
| `--template <name>` | `minimal` \| `counter` \| `tank` (default `minimal`) |
| `--category <name>` | `indicator` \| `chart` \| `layout` \| `annotation` \| `custom` |
| `--name <text>` | Display name (default: Title Case of the id) |
| `--description <text>` | Widget description |
| `--author <text>` | Author name |
| `--dir <path>` | Target directory (default `./<id>`) |
| `-y`, `--yes` | Non-interactive: accept all defaults |
| `--force` | Overwrite a non-empty target directory |
| `--install` / `--no-install` | Force or skip the dependency install step |
| `-h`, `--help` | Show help |

### Examples

```bash
# Non-interactive, trend-counter template, install right away
npm create marmot-widget line-oee --template counter --category indicator --yes --install

# Scaffold into a specific folder
npm create marmot-widget my-gauge --dir widgets/my-gauge
```

## Templates

| Template | Demonstrates |
| --- | --- |
| `minimal` | The smallest possible widget + config pair. |
| `counter` | Numeric readout with ▲/▼/◆ trend derived from a sliding window of the last N live samples. |
| `tank` | SVG vessel with a liquid fill clipped to a percentage (`<clipPath>`). |

## What you get

```
my-counter/
├─ manifest.json            # extension metadata
├─ vite.config.ts           # lib build + CSS-in-JS + vue external
├─ scripts/package.mjs      # produces <id>-<version>.zip
├─ tsconfig*.json, eslint config, prettier config
└─ src/
   ├─ index.ts              # { widgetComponent, configComponent }
   ├─ MyCounter.vue         # on-canvas widget
   ├─ MyCounterConfig.vue   # property inspector panel (host CSS classes only)
   ├─ App.vue               # dev workbench (theme switcher + inspector)
   └─ dev/marmot-theme.css  # simulated host theme for local dev
```

## After scaffolding

```bash
cd my-counter
pnpm install
pnpm dev          # local workbench with simulated live telemetry
pnpm build        # type-check + emit dist/bundle.js
pnpm package      # produce my-counter-1.0.0.zip
```

Upload the archive via the Marmot Admin Panel → Extensions → Upload.

## Template layout (for maintainers)

```
templates/
  base/      shared files (configs, build, workbench, dev theme)
  minimal/   src/<Widget>.vue + src/<Widget>Config.vue
  counter/   …
  tank/      …
```

Placeholders use `{{TOKEN}}` syntax and are substituted in both file **names**
and contents:

| Token | Meaning |
| --- | --- |
| `{{WIDGET_ID}}` | kebab-case id (also `package.json#name`) |
| `{{WIDGET_PASCAL}}` | PascalCase component name |
| `{{WIDGET_NAME}}` | display name |
| `{{WIDGET_NAME_JSON}}` / `{{WIDGET_NAME_HTML}}` | escaped variants |
| `{{WIDGET_CATEGORY}}` | manifest category |
| `{{WIDGET_DESCRIPTION}}` / `{{WIDGET_DESCRIPTION_JSON}}` | description |
| `{{WIDGET_AUTHOR}}` / `{{WIDGET_AUTHOR_JSON}}` | author |
| `{{WIDGET_VERSION}}` | initial version (`1.0.0`) |
| `{{DEFAULT_WIDTH}}` / `{{DEFAULT_HEIGHT}}` | default size |
| `{{DEFAULT_PROPS_JSON}}` / `{{DEFAULT_PROPS_JS}}` | `manifest.json#defaultProps` |
| `{{YEAR}}` | current year |

A leading `_` in a template file name becomes a leading `.` in the output
(`_gitignore` → `.gitignore`, `_vscode/` → `.vscode/`).

To add a template, create `templates/<name>/src/<Widget>.vue` and
`<Widget>Config.vue`, then add an entry to `VARIANT_META` in `lib/scaffold.js`
for its description, default size and default props.

## Learn more

See [`docs/EXTENSION_SDK.md`](../../docs/EXTENSION_SDK.md) for the full developer
guide: manifest reference, component contracts, the host CSS class library, and
troubleshooting.

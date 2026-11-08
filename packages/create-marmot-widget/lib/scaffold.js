import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** Absolute path to the bundled template directory. */
export const templatesDir = path.join(HERE, '..', 'templates')

const BASE_TEMPLATE = 'base'

/**
 * Placeholder syntax used inside template files and file names: `{{TOKEN}}`.
 * Only upper-case letters, digits and underscores are recognised so that
 * unrelated braces (e.g. `${...}` inside a template literal) are left intact.
 */
const TOKEN_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g

/**
 * Metadata for every available widget template.
 * Kept in code (rather than read from templates) so the CLI can show
 * descriptions and default dimensions before copying anything.
 */
const VARIANT_META = {
  minimal: {
    description: 'Bare-bones widget + config to start from scratch',
    width: 240,
    height: 160,
    defaultProps: { value: 0, dataPoint: '', backgroundColor: '' },
  },
  counter: {
    description: 'Trend counter: numeric readout with ▲/▼/◆ trend from the last N samples',
    width: 260,
    height: 170,
    defaultProps: {
      label: 'Counter',
      unit: '',
      precision: 1,
      value: 0,
      dataPoint: '',
      windowSize: 5,
      flatThreshold: 0.001,
      showDelta: true,
      upColor: '#10b981',
      downColor: '#ef4444',
      flatColor: '#f59e0b',
      backgroundColor: '',
    },
  },
  tank: {
    description: 'Tank gauge: SVG vessel with liquid fill clipped to a percentage',
    width: 220,
    height: 320,
    defaultProps: {
      shape: 'tank_barrel',
      fillColor: '#0284c7',
      capacity: 1000,
      dataPoint: '',
      value: 650,
      backgroundColor: '',
    },
  },
}

/**
 * Discover every template that provides widget sources.
 * @returns {Array<{ name: string, description: string, defaultSize: { width: number, height: number }, defaultProps: Record<string, unknown> }>}
 */
export function listVariants() {
  if (!fs.existsSync(templatesDir)) return []
  return fs
    .readdirSync(templatesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== BASE_TEMPLATE)
    .filter((entry) => fs.existsSync(path.join(templatesDir, entry.name, 'src')))
    .map((entry) => {
      const meta = VARIANT_META[entry.name]
      return {
        name: entry.name,
        description: meta?.description ?? `${entry.name} widget template`,
        defaultSize: { width: meta?.width ?? 240, height: meta?.height ?? 160 },
        defaultProps: meta?.defaultProps ?? { value: 0, dataPoint: '', backgroundColor: '' },
      }
    })
}

/** Replace every recognised `{{TOKEN}}` in a string. */
export function applyTokens(content, tokens) {
  return content.replace(TOKEN_PATTERN, (match, key) =>
    Object.prototype.hasOwnProperty.call(tokens, key) ? String(tokens[key]) : match,
  )
}

/**
 * Map a template file/directory name to its destination name.
 * Rule: a leading `_` becomes a leading `.` (so `_gitignore` → `.gitignore`),
 * then tokens are substituted (so `{{WIDGET_PASCAL}}.vue` → `MyWidget.vue`).
 */
function mapEntryName(name, tokens) {
  const mapped = name.startsWith('_') ? '.' + name.slice(1) : name
  return applyTokens(mapped, tokens)
}

function copyTree(srcDir, destDir, tokens, written) {
  fs.mkdirSync(destDir, { recursive: true })
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name)
    const destPath = path.join(destDir, mapEntryName(entry.name, tokens))
    if (entry.isDirectory()) {
      copyTree(srcPath, destPath, tokens, written)
    } else {
      fs.writeFileSync(destPath, applyTokens(fs.readFileSync(srcPath, 'utf8'), tokens), 'utf8')
      written.push(destPath)
    }
  }
}

/**
 * Generate a widget project into `targetDir`.
 * The shared `base/` template is copied first, then the chosen variant's
 * widget sources are layered on top.
 *
 * @param {{ targetDir: string, variant: string, tokens: Record<string, string> }} options
 * @returns {string[]} Absolute paths of every generated file.
 */
export function scaffold({ targetDir, variant, tokens }) {
  const baseDir = path.join(templatesDir, BASE_TEMPLATE)
  const variantDir = path.join(templatesDir, variant)

  if (!fs.existsSync(baseDir)) {
    throw new Error(`Base template is missing at ${baseDir}`)
  }
  if (!fs.existsSync(variantDir)) {
    throw new Error(`Unknown template "${variant}"`)
  }

  const written = []
  copyTree(baseDir, targetDir, tokens, written)
  copyTree(variantDir, targetDir, tokens, written)
  return written
}

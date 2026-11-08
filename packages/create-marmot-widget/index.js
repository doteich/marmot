#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

import { createPrompter } from './lib/prompt.js'
import { listVariants, scaffold } from './lib/scaffold.js'

const CATEGORIES = [
  { value: 'indicator', label: 'indicator', hint: 'gauges, counters, status lights' },
  { value: 'chart', label: 'chart', hint: 'trends, bars, historical plots' },
  { value: 'layout', label: 'layout', hint: 'machine layouts, panels' },
  { value: 'annotation', label: 'annotation', hint: 'labels, notes, callouts' },
  { value: 'custom', label: 'custom', hint: 'anything else' },
]

const VALUE_FLAGS = new Set(['template', 'category', 'dir', 'description', 'author', 'name'])

const HELP = `
create-marmot-widget — scaffold a Marmot SCADA/HMI extension widget

Usage
  npm create marmot-widget <name> [options]
  pnpm create marmot-widget <name> [options]

Options
  --template <name>    Widget template: minimal | counter | tank   (default: minimal)
  --category <name>    Category: indicator | chart | layout | annotation | custom
  --name <text>        Display name (default: Title Case of <name>)
  --description <text> Widget description
  --author <text>      Author name
  --dir <path>         Target directory (default: ./<name>)
  --yes, -y            Accept all defaults, skip interactive prompts
  --force              Overwrite an existing non-empty target directory
  --install            Run the package-manager install step after scaffolding
  --no-install         Skip the install step
  -h, --help           Show this help

Templates
  minimal   Bare-bones widget + config (start from scratch)
  counter   Trend counter: numeric readout with ▲/▼/◆ trend from the last N samples
  tank      Tank gauge: SVG vessel with liquid fill clipped to a percentage

Examples
  npm create marmot-widget my-counter --template counter
  pnpm create marmot-widget line-oee --category chart --yes --install
`

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function parseArgs(argv) {
  const opts = { positional: [], flags: {} }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') {
      opts.flags.help = true
    } else if (arg === '-y' || arg === '--yes') {
      opts.flags.yes = true
    } else if (arg === '--force') {
      opts.flags.force = true
    } else if (arg === '--install') {
      opts.flags.install = true
    } else if (arg === '--no-install') {
      opts.flags.install = false
    } else if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=')
      const key = arg.slice(2, eq)
      const value = arg.slice(eq + 1)
      if (VALUE_FLAGS.has(key)) opts.flags[key] = value
      else throw new Error(`Unknown option: --${key}`)
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2)
      if (VALUE_FLAGS.has(key)) opts.flags[key] = argv[++i]
      else throw new Error(`Unknown option: ${arg}`)
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    } else {
      opts.positional.push(arg)
    }
  }
  return opts
}

function toKebab(input) {
  return String(input)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function toPascal(kebab) {
  return kebab
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function toTitle(kebab) {
  return kebab
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function toInt(value, fallback) {
  const n = Number.parseInt(String(value).trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function detectAuthor() {
  return (
    process.env.GIT_AUTHOR_NAME ||
    process.env.USERNAME ||
    process.env.USER ||
    'Marmot Developer'
  )
}

function detectPackageManager() {
  const ua = process.env.npm_config_user_agent || ''
  if (ua.startsWith('pnpm')) return 'pnpm'
  if (ua.startsWith('yarn')) return 'yarn'
  if (ua.startsWith('bun')) return 'bun'
  if (ua.startsWith('npm')) return 'npm'
  return 'npm'
}

/** Escape a value for safe embedding inside a JSON string literal. */
function toJsonStringBody(value) {
  return JSON.stringify(String(value)).slice(1, -1)
}

function toHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/* -------------------------------------------------------------------------- */
/* Interactive / flag resolution                                               */
/* -------------------------------------------------------------------------- */

async function buildPlan(opts, variants, prompter) {
  const rawName = opts.positional[0]

  let id = rawName ? toKebab(rawName) : ''
  if (!id && prompter) {
    id = toKebab(await prompter.text('Widget id (kebab-case)', { defaultValue: 'my-widget' }))
  }
  if (!id) id = 'my-widget'
  if (id.length < 3 || id.length > 64 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    throw new Error(
      `Invalid widget id "${id}". Use 3-64 characters: lower-case letters, digits and single hyphens.`,
    )
  }

  let variant = opts.flags.template
  if (!variant && prompter) {
    variant = await prompter.select(
      'Choose a starting template:',
      variants.map((v) => ({ value: v.name, label: v.name, hint: v.description })),
      { defaultIndex: 0 },
    )
  }
  if (!variant) variant = 'minimal'
  const preset = variants.find((v) => v.name === variant)
  if (!preset) {
    throw new Error(
      `Unknown template "${variant}". Available: ${variants.map((v) => v.name).join(', ')}`,
    )
  }

  let name = opts.flags.name
  if (name === undefined && prompter) {
    name = await prompter.text('Display name', { defaultValue: toTitle(id) })
  }
  if (name === undefined || name === '') name = toTitle(id)

  let category = opts.flags.category
  if (category === undefined && prompter) {
    category = await prompter.select('Category:', CATEGORIES, { defaultIndex: 4 })
  }
  if (category === undefined) category = 'custom'
  if (!CATEGORIES.some((c) => c.value === category)) {
    throw new Error(`Unknown category "${category}".`)
  }

  let description = opts.flags.description
  if (description === undefined && prompter) {
    description = await prompter.text('Description', {
      defaultValue: `${name} widget for Marmot`,
    })
  }
  if (description === undefined) description = `${name} widget for Marmot`

  let author = opts.flags.author
  if (author === undefined && prompter) {
    author = await prompter.text('Author', { defaultValue: detectAuthor() })
  }
  if (author === undefined || author === '') author = detectAuthor()

  let width = preset.defaultSize.width
  let height = preset.defaultSize.height
  if (prompter) {
    width = toInt(await prompter.text('Default width (px)', { defaultValue: String(width) }), width)
    height = toInt(
      await prompter.text('Default height (px)', { defaultValue: String(height) }),
      height,
    )
  }

  const targetDir = path.resolve(process.cwd(), opts.flags.dir || id)
  const relativeTarget = path.relative(process.cwd(), targetDir) || '.'

  const nonEmpty = fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0
  if (nonEmpty && !opts.flags.force) {
    if (!prompter) {
      throw new Error(`Target directory "${relativeTarget}" is not empty. Re-run with --force.`)
    }
    const ok = await prompter.confirm(`"${relativeTarget}" is not empty. Overwrite existing files?`, {
      defaultValue: false,
    })
    if (!ok) return null
  }

  let install = opts.flags.install
  if (install === undefined) {
    install = prompter ? await prompter.confirm('Install dependencies now?', { defaultValue: true }) : false
  }

  const tokens = {
    WIDGET_ID: id,
    WIDGET_NAME: name,
    WIDGET_NAME_JSON: toJsonStringBody(name),
    WIDGET_NAME_HTML: toHtml(name),
    WIDGET_PASCAL: toPascal(id),
    WIDGET_CATEGORY: category,
    WIDGET_DESCRIPTION: description,
    WIDGET_DESCRIPTION_JSON: toJsonStringBody(description),
    WIDGET_AUTHOR: author,
    WIDGET_AUTHOR_JSON: toJsonStringBody(author),
    WIDGET_VERSION: '1.0.0',
    DEFAULT_WIDTH: String(width),
    DEFAULT_HEIGHT: String(height),
    DEFAULT_PROPS_JSON: JSON.stringify(preset.defaultProps, null, 2).replace(/\n/g, '\n  '),
    DEFAULT_PROPS_JS: JSON.stringify(preset.defaultProps, null, 2),
    YEAR: String(new Date().getFullYear()),
  }

  return { id, name, variant, targetDir, relativeTarget, tokens, install, packageManager: detectPackageManager() }
}

/* -------------------------------------------------------------------------- */
/* Output                                                                      */
/* -------------------------------------------------------------------------- */

function printSummary(plan) {
  const rel = (p) => path.relative(process.cwd(), p).split(path.sep).join('/')
  console.log(`
\x1b[32m✔\x1b[0m Scaffolded \x1b[1m${plan.name}\x1b[0m (\x1b[2m${plan.id}\x1b[0m) using the "\x1b[1m${plan.variant}\x1b[0m" template.

  \x1b[2mProject:  \x1b[0m${rel(plan.targetDir)}
  \x1b[2mWidget:   \x1b[0msrc/${plan.tokens.WIDGET_PASCAL}.vue
  \x1b[2mConfig:   \x1b[0msrc/${plan.tokens.WIDGET_PASCAL}Config.vue
`)
}

function printNextSteps(plan, pm, installed) {
  const cd = plan.targetDir === process.cwd() ? '' : `cd ${plan.relativeTarget}\n  `
  console.log(`Next steps:
  ${cd}${pm} dev          # local workbench with live telemetry simulation
  ${pm} build        # type-check + emit dist/bundle.js
  ${pm} package      # build the uploadable .zip archive
${installed ? '' : `  ${pm} install      # install dependencies first\n`}
Then upload the generated archive via the Marmot Admin Panel → Extensions → Upload.
`)
}

function runInstall(cwd, pm) {
  console.log(`\n▶ Installing dependencies with ${pm}...\n`)
  const res = spawnSync(pm, ['install'], {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (res.error || res.status !== 0) {
    console.log(
      `\n\x1b[33m⚠\x1b[0m Dependency install did not complete. Run "${pm} install" manually inside the project.`,
    )
    return false
  }
  return true
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.flags.help) {
    console.log(HELP)
    return
  }

  const variants = listVariants()
  if (variants.length === 0) {
    throw new Error('No widget templates were found. The package may be corrupted.')
  }

  const prompter = opts.flags.yes ? null : createPrompter()
  let plan
  try {
    plan = await buildPlan(opts, variants, prompter)
  } finally {
    prompter?.close()
  }

  if (!plan) {
    console.log('Aborted — no files were written.')
    return
  }

  const written = scaffold({ targetDir: plan.targetDir, variant: plan.variant, tokens: plan.tokens })
  printSummary(plan)

  const installed = plan.install ? runInstall(plan.targetDir, plan.packageManager) : false
  printNextSteps(plan, plan.packageManager, installed)

  console.log(`\x1b[2mGenerated ${written.length} files.\x1b[0m`)
}

main().catch((err) => {
  console.error(`\n\x1b[31m✖ ${err instanceof Error ? err.message : String(err)}\x1b[0m\n`)
  process.exitCode = 1
})

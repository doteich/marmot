import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * Packages `dist/bundle.js` + `manifest.json` into an uploadable
 * `<id>-<version>.zip` with both files at the archive root.
 */
const root = process.cwd()
const manifestPath = path.join(root, 'manifest.json')
const bundlePath = path.join(root, 'dist', 'bundle.js')

if (!fs.existsSync(manifestPath)) {
  console.error('✖ manifest.json not found. Run this from the widget project root.')
  process.exit(1)
}
if (!fs.existsSync(bundlePath)) {
  console.error('✖ dist/bundle.js not found. Run `pnpm build` (or `npm run build`) first.')
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const id = manifest.id ?? 'widget'
const version = manifest.version ?? '1.0.0'
const outName = `${id}-${version}.zip`
const outPath = path.join(root, outName)

// Stage both files at a flat root so archive entries are `bundle.js` and
// `manifest.json` (the backend rejects nested archive layouts).
const staging = path.join(root, '.package-staging')
fs.rmSync(staging, { recursive: true, force: true })
fs.mkdirSync(staging, { recursive: true })
fs.copyFileSync(bundlePath, path.join(staging, 'bundle.js'))
fs.copyFileSync(manifestPath, path.join(staging, 'manifest.json'))

if (fs.existsSync(outPath)) fs.rmSync(outPath)

try {
  if (process.platform === 'win32') {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${staging}\\*' -DestinationPath '${outPath}' -Force`,
      ],
      { stdio: 'inherit' },
    )
  } else {
    execFileSync('zip', ['-j', outPath, path.join(staging, 'bundle.js'), path.join(staging, 'manifest.json')], {
      stdio: 'inherit',
    })
  }
} finally {
  fs.rmSync(staging, { recursive: true, force: true })
}

console.log(`\n✔ Packaged extension → ${outName}`)
console.log('  Upload it via the Marmot Admin Panel → Extensions → Upload.')

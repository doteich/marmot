import readline from 'node:readline/promises'
import process from 'node:process'

/**
 * Zero-dependency interactive prompt helpers built on `node:readline/promises`.
 * Kept intentionally small so the scaffolder ships with no external deps.
 *
 * @returns {{
 *   text: (question: string, options?: { defaultValue?: string }) => Promise<string>,
 *   select: (question: string, options: Array<{ value: string, label: string, hint?: string }>, options?: { defaultIndex?: number }) => Promise<string>,
 *   confirm: (question: string, options?: { defaultValue?: boolean }) => Promise<boolean>,
 *   close: () => void,
 * }}
 */
export function createPrompter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  async function text(question, { defaultValue = '' } = {}) {
    const suffix = defaultValue ? ` (${defaultValue})` : ''
    const answer = (await rl.question(`${question}${suffix}: `)).trim()
    return answer || defaultValue
  }

  async function select(question, options, { defaultIndex = 0 } = {}) {
    process.stdout.write(`\n${question}\n`)
    options.forEach((opt, i) => {
      const marker = i === defaultIndex ? '❯' : ' '
      const hint = opt.hint ? `  \x1b[2m${opt.hint}\x1b[0m` : ''
      process.stdout.write(`  ${marker} ${i + 1}) ${opt.label}${hint}\n`)
    })

    for (;;) {
      const raw = (
        await rl.question(`Choose [1-${options.length}] (default ${defaultIndex + 1}): `)
      ).trim()
      if (raw === '') {
        const chosen = options[defaultIndex]
        if (chosen) return chosen.value
        continue
      }
      const n = Number(raw)
      if (Number.isInteger(n) && n >= 1 && n <= options.length) {
        const chosen = options[n - 1]
        if (chosen) return chosen.value
      }
      process.stdout.write('  \x1b[31mInvalid selection, try again.\x1b[0m\n')
    }
  }

  async function confirm(question, { defaultValue = true } = {}) {
    const hint = defaultValue ? 'Y/n' : 'y/N'
    const raw = (await rl.question(`${question} (${hint}): `)).trim().toLowerCase()
    if (raw === '') return defaultValue
    return raw === 'y' || raw === 'yes'
  }

  function close() {
    rl.close()
  }

  return { text, select, confirm, close }
}

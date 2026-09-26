/* Example source extraction. Each examples/<page>.tsx file holds its examples as real components between
   `// #region <id>` and `// #endregion` markers, and imports itself with `?raw`. The code panel shows exactly
   that region, headed by the imports it uses — so the sample can never drift from what the preview renders.
   Regions are self-contained (their own data and helpers); workspace packages are shown as '@brett_lamy/ui'. */

interface Imported {
  name: string
  type: boolean
  from: 'react' | 'ui'
}

function parseImports(raw: string): Imported[] {
  const out: Imported[] = []
  const re = /import\s*(type\s*)?\{([^}]*)\}\s*from\s*'(react|@brett_lamy\/[a-z]+)'/g
  for (let m = re.exec(raw); m; m = re.exec(raw)) {
    const allType = !!m[1]
    for (const part of m[2].split(',')) {
      const spec = part.trim()
      if (!spec) continue
      const type = allType || spec.startsWith('type ')
      const name = spec
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()!
        .trim()
      out.push({ name, type, from: m[3] === 'react' ? 'react' : 'ui' })
    }
  }
  return out
}

function importLine(names: string[], from: string): string {
  const one = `import { ${names.join(', ')} } from '${from}'`
  if (one.length <= 80) return one
  const lines: string[] = []
  let cur = ' '
  for (const n of names) {
    if ((cur + ' ' + n + ',').length > 78) {
      lines.push(cur)
      cur = ' '
    }
    cur += ' ' + n + ','
  }
  lines.push(cur)
  return `import {\n${lines.join('\n')}\n} from '${from}'`
}

/** The copy-pasteable source of one region: its imports, then its body with the main export made default. */
export function exampleSource(raw: string, id: string): string {
  const start = raw.indexOf(`// #region ${id}\n`)
  if (start < 0) return `// example "${id}" not found`
  const bodyStart = start + `// #region ${id}\n`.length
  const end = raw.indexOf('// #endregion', bodyStart)
  const body = raw.slice(bodyStart, end).trimEnd()
  const used = (i: Imported) =>
    new RegExp(`(^|[^\\w$.])${i.name.replace(/\$/g, '\\$')}(?![\\w$])`).test(body)
  const imports = parseImports(raw).filter(used)
  const seen = new Set<string>()
  const uniq = imports.filter((i) =>
    seen.has(i.from + i.name) ? false : (seen.add(i.from + i.name), true),
  )
  const fmt = (i: Imported) => (i.type ? `type ${i.name}` : i.name)
  const react = uniq.filter((i) => i.from === 'react').map(fmt)
  const ui = uniq.filter((i) => i.from === 'ui').map(fmt)
  const head = [
    react.length ? importLine(react, 'react') : '',
    ui.length ? importLine(ui, '@brett_lamy/ui') : '',
  ]
    .filter(Boolean)
    .join('\n')
  return `${head}\n\n${body.replace(/^export function /m, 'export default function ')}`
}

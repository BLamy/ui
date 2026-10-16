import { useMemo, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import {
  parseStrudel, StrudelSyntaxError, type MiniGroup, type MiniStep, type StrudelArg, type StrudelSong,
} from '@/components/ui/strudel-syntax'

const initial = `setcpm(120/4)
drums: s("bd*2 [~ bd] sd ~, hh*8").gain(.8)
bass: n("<0 3 4 3>").scale("G2:minor").s("sawtooth").lpf(800)
_$: note("c4 e4 g4").s('piano')`

const step = (s: MiniStep): string => {
  const slice = s.slice
  const body = slice.type === 'atom' ? (slice.rest ? 'rest' : slice.value)
    : slice.type === 'subcycle' ? `[${group(slice.body)}]`
    : slice.type === 'alternation' ? `<${slice.layers.map(group).join(' | ')}>`
    : `{${slice.layers.map(group).join(' | ')}}`
  return body + s.ops.map((o) => ` ${o.op}`).join('')
}
const group = (g: MiniGroup): string =>
  g.type === 'sequence' ? g.steps.map(step).join(', ') : `${g.type}(${g.layers.map(group).join(' / ')})`

const arg = (a: StrudelArg): string => {
  switch (a.kind) {
    case 'number': return `number ${a.value}`
    case 'mini': return a.mini ? `mini "${a.source}" → ${group(a.mini)}` : `mini "${a.source}" ✗ ${a.error?.message}`
    case 'string': return `string '${a.value}'`
    case 'pattern': return `pattern ${'args' in a.chain.head ? a.chain.head.name : a.chain.head.name}(…)`
    default: return a.kind
  }
}

function outline(song: StrudelSong): string {
  const lines = [`song · ${song.layout} · ${song.tracks.length} tracks`]
  if (song.tempo) lines.push(`  tempo ${song.tempo.cps} cps (${song.tempo.unit})`)
  for (const t of song.tracks) {
    lines.push(`  track ${t.index}${t.label ? ` "${t.label}"` : ''} · ${t.kind}${t.sound ? ` · ${t.sound}` : ''}${t.muted ? ' · muted' : ''}`)
    const calls = 'args' in t.chain.head ? [t.chain.head, ...t.chain.methods] : t.chain.methods
    for (const c of calls) {
      lines.push(`    .${c.name}  [${c.start}–${c.end}]`)
      for (const a of c.args) lines.push(`      ${arg(a)}`)
    }
  }
  return lines.join('\n')
}

// Type Strudel; the tree updates as you go: tracks, calls with their source
// ranges, typed arguments and each mini-notation string's own tree.
export default function Inspector() {
  const [code, setCode] = useState(initial)
  const result = useMemo(() => {
    try {
      return outline(parseStrudel(code))
    } catch (err) {
      return err instanceof StrudelSyntaxError ? `Syntax error at ${err.offset}: ${err.message}` : String(err)
    }
  }, [code])
  return (
    <div style={{ width: '100%', display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      <Textarea aria-label="Strudel code" value={code} onChange={(e) => setCode(e.target.value)} rows={10} style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }} />
      <pre tabIndex={0} aria-label="Syntax tree outline" style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, overflow: 'auto' }}>{result}</pre>
    </div>
  )
}

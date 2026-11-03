import { useState } from 'react'
import { CallStack } from '@/components/ui/call-stack'
import type { CallStackFrame } from '@/lib/call-stack'
import { ThemeScope } from '@/lib/theme'

const walk = (i: number): CallStackFrame => ({
  id: `walk-${i}`, functionName: 'walk', location: { file: '/src/tree/walk.ts', line: 40 + (i % 3), column: 3 },
})
const react = (id: string, functionName: string, line: number): CallStackFrame => ({
  id, functionName, kind: 'framework', label: 'React', location: { file: '/node_modules/react-dom/cjs/react-dom-client.development.js', line },
})

const FRAMES: CallStackFrame[] = [{ id: 'visit', functionName: 'visit', location: { file: '/src/tree/walk.ts', line: 12, column: 7 } }]
for (let i = 0; i < 1000; i++) {
  FRAMES.push(walk(i))
  if (i % 50 === 0) FRAMES.push(react(`r-${i}-1`, 'renderWithHooks', 14985), react(`r-${i}-2`, 'beginWork', 19073))
  if (i === 500) FRAMES.push({ id: 'await-walk', kind: 'async', label: 'await loadChildren' })
}
FRAMES.push({ id: 'main', functionName: 'main', location: { file: '/src/index.ts', line: 3 } })

// Only the rows on screen are in the DOM. Home and End reach either end, the arrow keys step, and typing a name jumps to it.
export default function Recursive() {
  const [selected, setSelected] = useState('visit')
  return (
    <ThemeScope className="mx-auto h-80 max-w-2xl overflow-hidden rounded-card bg-card py-1 shadow-hairline">
      <CallStack frames={FRAMES} selectedId={selected} onSelect={(frame) => setSelected(frame.id)} />
    </ThemeScope>
  )
}

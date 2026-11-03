import { useState } from 'react'
import { CallStack } from '@/components/ui/call-stack'
import type { CallStackFrame } from '@/lib/call-stack'
import { ThemeScope } from '@/lib/theme'

const REACT_DOM = 'https://shop.example/_next/static/chunks/node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js'
const app = (id: string, functionName: string, file: string, line: number): CallStackFrame => ({
  id, functionName, location: { file: `/Users/ada/projects/shop/src/${file}`, line, column: 3 },
})
const react = (id: string, functionName: string, line: number): CallStackFrame => ({
  id, functionName, kind: 'framework', label: 'React', location: { file: REACT_DOM, line, column: 9 },
})

const FRAMES: CallStackFrame[] = [
  app('a', 'formatPrice', 'lib/money.ts', 42),
  app('b', 'lineTotal', 'cart/line-item.tsx', 87),
  app('c', 'LineItem', 'cart/line-item.tsx', 31),
  react('r1', 'renderWithHooks', 14985),
  react('r2', 'updateFunctionComponent', 17356),
  react('r3', 'beginWork', 19073),
  app('d', 'CartPage', 'app/cart/page.tsx', 18),
  { id: 'await-1', kind: 'async', label: 'await loadCart' },
  app('e', 'loadCart', 'cart/load.ts', 9),
  { id: 'l1', functionName: 'fetchJson', kind: 'library', location: { file: '/Users/ada/projects/shop/node_modules/ky/distribution/index.js', line: 203 } },
  { id: 'l2', functionName: 'request', kind: 'library', location: { file: '/Users/ada/projects/shop/node_modules/ky/distribution/index.js', line: 88 } },
]

// Press a frame or arrow to it to select it. Press `3 React frames` to open the run. Press a file name for the whole path.
export default function Frames() {
  const [selected, setSelected] = useState('a')
  return (
    <ThemeScope className="mx-auto h-80 max-w-2xl overflow-hidden rounded-card bg-card py-1 shadow-hairline">
      <CallStack frames={FRAMES} selectedId={selected} onSelect={(frame) => setSelected(frame.id)} />
    </ThemeScope>
  )
}

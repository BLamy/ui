import { useState } from 'react'
import { Diagram } from '@/components/ui/diagram'
import { Button } from '@/components/ui/button'
import { ThemeScope } from '@/lib/theme'
import type { DiagramNode } from '@/lib/diagram-model'

const words = (id: string, label: string, x: number, y: number, more: Partial<DiagramNode> = {}): DiagramNode => ({ id, label, x, y, w: 1, h: 1, ...more })

const NODES: DiagramNode[] = [
  words('short', 'idle', 0, 0),
  words('detail', 'checkingQuota', 240, 0, { detail: 'invoke verifyTokenAndQuota' }),
  words('long', 'A very long state name that goes on for a good deal longer than any node should', 0, 90),
  words('nospaces', 'aVeryLongStateNameWithNoSpacesInItAtAllThatHasToBreakSomewhereOrItWillRunOutOfItsBox', 280, 90),
  words('cjk', '認証を確認しています', 0, 190, { detail: 'アップロードを待っています' }),
  words('cjklong', 'これはとても長い状態の名前で、折り返さなければ箱からはみ出してしまいます', 280, 190),
  words('final', 'quarantined', 0, 280, { kind: 'final' }),
  words('emoji', '🚀 launching 🌕', 280, 280),
]

// With `autoSize`, each node's as big as its words, in whatever font it's in. The second one's in another font.
export default function SizedText() {
  const [name, setName] = useState('idle')
  const nodes = NODES.map((n) => (n.id === 'short' ? { ...n, label: name } : n))
  return (
    <div className="grid h-full min-h-96 w-full grid-rows-[1fr_1fr_auto] gap-2">
      <div data-demo="plain" className="relative">
        <Diagram nodes={nodes} autoSize aria-label="In the theme's font" />
      </div>
      <ThemeScope data-demo="serif" className="relative" style={{ '--font-sans': 'Georgia, "Times New Roman", serif', fontFamily: 'Georgia, "Times New Roman", serif' } as React.CSSProperties}>
        <Diagram nodes={nodes} autoSize aria-label="In another font" />
      </ThemeScope>
      <div className="p-2">
        <Button variant="secondary" onClick={() => setName(name === 'idle' ? 'waitingForTheLastOfTheChunks' : 'idle')}>Rename the first node</Button>
      </div>
    </div>
  )
}

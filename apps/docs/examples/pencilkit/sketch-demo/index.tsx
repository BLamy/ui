import { useMemo } from 'react'
import { PencilKitDemo, demoStrokes } from '@brett_lamy/ui'

// Canvas, tool picker, inks, widths, undo/redo. Compose your own from
// PencilCanvas, PencilToolbar, and usePencilHistory.
export default function SketchDemo() {
  const strokes = useMemo(() => demoStrokes(), [])
  return (
    <div style={{ position: 'relative', height: 540, overflow: 'hidden' }}>
      <PencilKitDemo defaultStrokes={strokes} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}

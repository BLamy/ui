import { useState } from 'react'
import {
  Button,
  PencilCanvas,
  StrokePath,
  demoStrokes,
  usePencilHistory,
  type PencilStroke,
} from '@brett_lamy/ui'

/** Fits any strokes into a thumbnail by their bounding box. */
function Thumbnail({ strokes }: { strokes: PencilStroke[] }) {
  const pts = strokes.flatMap((s) => s.points)
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1])
  const pad = 12 // room for the widest nib
  const x = Math.min(...xs) - pad,
    y = Math.min(...ys) - pad
  const w = Math.max(...xs) - x + pad,
    h = Math.max(...ys) - y + pad
  const box = `${x} ${y} ${w} ${h}`
  return (
    <div
      style={{
        flexShrink: 0,
        width: 96,
        height: 72,
        padding: 6,
        boxSizing: 'border-box',
        borderRadius: 10,
        background: 'var(--bl-card)',
        boxShadow: '0 0 0 1px var(--bl-sep)',
      }}
    >
      <svg
        viewBox={box}
        width="100%"
        height="100%"
        style={{ display: 'block' }}
      >
        {strokes.map((s, i) => (
          <StrokePath key={i} st={s} />
        ))}
      </svg>
    </div>
  )
}

export default function SketchGallery() {
  const [saved, setSaved] = useState<PencilStroke[][]>(() => [demoStrokes()])
  const history = usePencilHistory()
  const save = () => {
    setSaved((list) => [history.strokes, ...list])
    history.clear()
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        style={{
          position: 'relative',
          height: 220,
          borderRadius: 14,
          background: 'var(--bl-card)',
          boxShadow: '0 0 0 1px var(--bl-sep)',
        }}
      >
        <PencilCanvas
          tool="pen"
          ink="#0A84FF"
          strokes={history.strokes}
          onStrokesChange={history.onStrokesChange}
          hint="Draw something, then save it"
        />
        <Button
          size="sm"
          style={{ position: 'absolute', right: 12, bottom: 12 }}
          isDisabled={!history.strokes.length}
          onPress={save}
        >
          Save sketch
        </Button>
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
        {saved.map((s, i) => (
          <Thumbnail key={saved.length - i} strokes={s} />
        ))}
      </div>
    </div>
  )
}

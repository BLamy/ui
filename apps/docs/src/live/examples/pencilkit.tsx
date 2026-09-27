/* PencilKit page examples. Each `// #region` is shown verbatim as the example's code. */
import { useState } from 'react'
import {
  Button,
  InkPicker,
  PencilActions,
  PencilCanvas,
  PencilToolbar,
  PencilToolbarDivider,
  StrokePath,
  ToolPicker,
  demoStrokes,
  usePencilHistory,
  type PencilStroke,
  type PencilTool,
} from '@brett_lamy/ui'
import raw from './pencilkit.tsx?raw'
import { examples } from './chrome'

// #region pencil_signature
export function SignaturePad() {
  const [strokes, setStrokes] = useState<PencilStroke[]>([])
  return (
    <div
      style={{
        maxWidth: 460,
        margin: '0 auto',
        padding: 16,
        borderRadius: 16,
        background: 'var(--bl-card)',
        boxShadow: '0 0 0 1px var(--bl-sep)',
      }}
    >
      <div style={{ fontWeight: 650, marginBottom: 10 }}>Sign to accept the terms</div>
      {/* ink="currentColor" draws in the label colour, so it flips with light / dark */}
      <div
        style={{
          position: 'relative',
          height: 150,
          borderRadius: 12,
          background: 'var(--bl-bg2)',
          color: 'var(--bl-label)',
        }}
      >
        <PencilCanvas
          tool="pen"
          ink="currentColor"
          strokes={strokes}
          onStrokesChange={setStrokes}
          hint={<span style={{ fontSize: 14 }}>Sign here</span>}
        />
        <div
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: 34,
            borderTop: '1px dashed var(--bl-label3)',
            pointerEvents: 'none',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Button
          variant="secondary"
          style={{ flex: 1 }}
          isDisabled={!strokes.length}
          onPress={() => setStrokes([])}
        >
          Clear
        </Button>
        <Button style={{ flex: 1 }} isDisabled={!strokes.length}>
          Accept
        </Button>
      </div>
    </div>
  )
}
// #endregion

// #region pencil_annotate
const highlighters = ['#FFD60A', '#FF375F', '#30D158']

export function AnnotateScreenshot() {
  const [tool, setTool] = useState<PencilTool>('marker')
  const [ink, setInk] = useState(0)
  const history = usePencilHistory()
  return (
    <div
      style={{
        position: 'relative',
        height: 400,
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--bl-bg2)',
      }}
    >
      {/* Anything underneath: the canvas is transparent and fills its positioned host */}
      <div
        style={{
          position: 'absolute',
          inset: '20px 20px 80px',
          borderRadius: 12,
          padding: 18,
          background: 'var(--bl-card)',
          boxShadow: '0 0 0 1px var(--bl-sep)',
        }}
      >
        <div
          style={{
            width: '45%',
            height: 14,
            borderRadius: 7,
            background: 'var(--bl-fill2)',
          }}
        />
        {[92, 80, 86, 60].map((w, i) => (
          <div
            key={i}
            style={{
              width: `${w}%`,
              height: 10,
              borderRadius: 5,
              marginTop: 14,
              background: 'var(--bl-fill)',
            }}
          />
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <div
            style={{
              width: 110,
              height: 34,
              borderRadius: 9,
              background: 'var(--bl-tint)',
            }}
          />
          <div
            style={{ width: 90, height: 34, borderRadius: 9, background: 'var(--bl-fill)' }}
          />
        </div>
      </div>
      <PencilCanvas
        tool={tool}
        ink={highlighters[ink]}
        strokes={history.strokes}
        onStrokesChange={history.onStrokesChange}
      >
        <PencilToolbar>
          <ToolPicker value={tool} onChange={setTool} tools={['marker', 'pen', 'eraser']} />
          <PencilToolbarDivider />
          <InkPicker value={ink} onChange={setInk} inks={highlighters} />
          <PencilToolbarDivider />
          <PencilActions
            onUndo={history.undo}
            onRedo={history.redo}
            onClear={history.clear}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
          />
        </PencilToolbar>
      </PencilCanvas>
    </div>
  )
}
// #endregion

// #region pencil_gallery
/** Fits any strokes into a thumbnail by their bounding box. */
function Thumbnail({ strokes }: { strokes: PencilStroke[] }) {
  const pts = strokes.flatMap((s) => s.points)
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1])
  const pad = 12 // room for the widest nib
  const x = Math.min(...xs) - pad,
    y = Math.min(...ys) - pad
  const box = `${x} ${y} ${Math.max(...xs) - x + pad} ${Math.max(...ys) - y + pad}`
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
      <svg viewBox={box} width="100%" height="100%" style={{ display: 'block' }}>
        {strokes.map((s, i) => (
          <StrokePath key={i} st={s} />
        ))}
      </svg>
    </div>
  )
}

export function SketchGallery() {
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
// #endregion

export const PENCILKIT_LIVE = examples(raw, [
  {
    id: 'pencil_signature',
    title: 'Signature pad',
    h: 260,
    Render: () => <SignaturePad />,
  },
  {
    id: 'pencil_annotate',
    title: 'Annotate a screenshot · custom toolbar',
    h: 420,
    Render: () => <AnnotateScreenshot />,
  },
  {
    id: 'pencil_gallery',
    title: 'Save sketches as thumbnails',
    h: 340,
    Render: () => <SketchGallery />,
  },
])

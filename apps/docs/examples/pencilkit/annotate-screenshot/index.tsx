import { useState } from 'react'
import {
  type PencilInk,
  type PencilTool,
  PencilCanvas,
  PencilActions,
  PencilInkPicker,
  PencilToolbar,
  PencilToolPicker,
  usePencilHistory,
} from '@/components/ui/pencilkit'
import { ToolbarSeparator } from '@/components/ui/toolbar'

const highlighters: PencilInk[] = [
  { value: '#FFD60A', label: 'Yellow' },
  { value: '#FF375F', label: 'Pink' },
  { value: '#30D158', label: 'Green' },
]

export default function AnnotateScreenshot() {
  const [tool, setTool] = useState<PencilTool>('marker')
  const [ink, setInk] = useState(highlighters[0].value)
  const history = usePencilHistory()
  return (
    <div
      style={{
        position: 'relative',
        height: 400,
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--muted)',
      }}
    >
      {/* Anything underneath: the canvas is transparent and fills its
          positioned host */}
      <div
        style={{
          position: 'absolute',
          inset: '20px 20px 80px',
          borderRadius: 12,
          padding: 18,
          background: 'var(--card)',
          boxShadow: '0 0 0 1px var(--border)',
        }}
      >
        <div
          style={{
            width: '45%',
            height: 14,
            borderRadius: 7,
            background: 'var(--secondary-strong)',
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
              background: 'var(--secondary)',
            }}
          />
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <div
            style={{
              width: 110,
              height: 34,
              borderRadius: 9,
              background: 'var(--primary)',
            }}
          />
          <div
            style={{
              width: 90,
              height: 34,
              borderRadius: 9,
              background: 'var(--secondary)',
            }}
          />
        </div>
      </div>
      <PencilCanvas
        tool={tool}
        ink={ink}
        strokes={history.strokes}
        onStrokesChange={history.onStrokesChange}
      >
        {/* The toolbar sits in the flow: place it over the canvas yourself. */}
        <PencilToolbar
          className="absolute inset-x-2.5 bottom-3.5 mx-auto"
          trailing={
            <>
              <ToolbarSeparator />
              <PencilActions
                onUndo={history.undo}
                onRedo={history.redo}
                onClear={history.clear}
                canUndo={history.canUndo}
                canRedo={history.canRedo}
                canClear={history.canClear}
              />
            </>
          }
        >
          <PencilToolPicker
            value={tool}
            onValueChange={setTool}
            tools={['marker', 'pen', 'eraser']}
          />
          <ToolbarSeparator />
          <PencilInkPicker value={ink} onValueChange={setInk} inks={highlighters} />
        </PencilToolbar>
      </PencilCanvas>
    </div>
  )
}

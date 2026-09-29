import { useState } from 'react'
import {
  InkPicker,
  PencilActions,
  PencilCanvas,
  PencilToolbar,
  PencilToolbarDivider,
  ToolPicker,
  usePencilHistory,
  type PencilTool,
} from '@brett_lamy/ui'

const highlighters = ['#FFD60A', '#FF375F', '#30D158']

export default function AnnotateScreenshot() {
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
      {/* Anything underneath: the canvas is transparent and fills its
          positioned host */}
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
            style={{
              width: 90,
              height: 34,
              borderRadius: 9,
              background: 'var(--bl-fill)',
            }}
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
          <ToolPicker
            value={tool}
            onChange={setTool}
            tools={['marker', 'pen', 'eraser']}
          />
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

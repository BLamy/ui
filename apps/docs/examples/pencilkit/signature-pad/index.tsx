import { useState } from 'react'
import { Button, PencilCanvas, type PencilStroke } from '@brett_lamy/ui'

export default function SignaturePad() {
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

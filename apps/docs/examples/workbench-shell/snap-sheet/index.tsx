import { useState } from 'react'
import { SnapSheet, TerminalAction, TerminalBody, TerminalHeader, useAppearance, WorkbenchTheme } from '@brett_lamy/ui'

// The sheet needs a phone-sized, positioned host; the terminal stays dark in light mode.
function TerminalSheet() {
  const [open, setOpen] = useState(false)
  const light = useAppearance() === 'light'
  return (
    <WorkbenchTheme
      style={{
        position: 'relative',
        width: 390,
        maxWidth: '100%',
        height: 460,
        margin: '0 auto',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px var(--wb-sep)',
      }}
    >
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>cookbook · main</div>
        <div style={{ fontSize: 13, color: 'var(--wb-label2)', lineHeight: 1.5 }}>
          Open the terminal, then drag its handle: a slow drag settles at the nearest snap, a flick carries on to the next — or down past the lowest to close.
        </div>
        <button
          type="button"
          className="wb-btn"
          onClick={() => setOpen(true)}
          style={{
            justifySelf: 'start',
            border: 0,
            borderRadius: 9,
            background: 'var(--wb-tint)',
            color: '#fff',
            font: 'inherit',
            fontWeight: 600,
            fontSize: 13,
            padding: '8px 14px',
            cursor: 'pointer',
          }}
        >
          Open terminal
        </button>
      </div>
      <SnapSheet
        open={open}
        onClose={() => setOpen(false)}
        snaps={[0.5, 0.92]}
        bg={light ? '#1C1C23' : 'var(--wb-term)'}
        className="wb-term"
      >
        <TerminalHeader title="zsh — cookbook">
          <TerminalAction icon="trash" label="Close terminal" onPress={() => setOpen(false)} />
        </TerminalHeader>
        <TerminalBody seed={[{ t: 'npm run dev', p: true }, { t: '  ➜  Local:   http://localhost:3000/', c: '#8AB4FF' }]} />
      </SnapSheet>
    </WorkbenchTheme>
  )
}

// Workbench parts read the --wb-* tokens WorkbenchTheme sets; it follows the app's light / dark appearance.
export default function TerminalSheetExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <TerminalSheet />
    </WorkbenchTheme>
  )
}

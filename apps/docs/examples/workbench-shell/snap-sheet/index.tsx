import { useState } from 'react'
import {
  SnapSheet,
  TerminalAction,
  TerminalBody,
  TerminalHeader,
  ThemeScope,
  WorkbenchTheme,
} from '@brett_lamy/ui'

// The sheet needs a phone-sized, positioned host; the terminal stays dark in
// light mode.
function TerminalSheet() {
  const [open, setOpen] = useState(false)
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
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>cookbook · main</div>
        <div
          style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.5 }}
        >
          Open the terminal, then drag its handle: a slow drag settles at the
          nearest snap, a flick carries on to the next — or down past the lowest
          to close.
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            justifySelf: 'start',
            border: 0,
            borderRadius: 9,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
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
      {/* A `terminal` theme scope: the terminal's own background and ink. */}
      <ThemeScope scope="terminal" style={{ display: 'contents' }}>
      <SnapSheet
        open={open}
        onClose={() => setOpen(false)}
        snaps={[0.5, 0.92]}
        style={{ background: 'var(--background)' }}
      >
        <TerminalHeader title="zsh — cookbook">
          <TerminalAction
            icon="bin"
            label="Close terminal"
            onPress={() => setOpen(false)}
          />
        </TerminalHeader>
        <TerminalBody
          seed={[
            { t: 'npm run dev', p: true },
            { t: '  ➜  Local:   http://localhost:3000/', c: '#8AB4FF' },
          ]}
        />
      </SnapSheet>
      </ThemeScope>
    </WorkbenchTheme>
  )
}

// WorkbenchTheme is a `workbench` theme scope; it follows the app's light / dark
// appearance.
export default function TerminalSheetExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <TerminalSheet />
    </WorkbenchTheme>
  )
}

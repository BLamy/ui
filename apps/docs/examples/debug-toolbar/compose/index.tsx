import { useState } from 'react'
import { DebugToolbar, DebugToolbarButton, type DebugToolbarAction } from '@/components/ui/debug-toolbar'
import { ToolbarButton, ToolbarSeparator } from '@/components/ui/toolbar'

export default function DebugToolbarCompose() {
  const [paused, setPaused] = useState(true)
  const [log, setLog] = useState<string>('Paused at app.ts:12')

  const run = (action: DebugToolbarAction) => {
    if (action === 'continue') setPaused(false)
    if (action === 'stop') setPaused(true)
    setLog(action === 'continue' ? 'Running…' : `${action} at app.ts:${12 + Math.floor(Math.random() * 20)}`)
  }

  return (
    <div className="flex flex-col items-center gap-3 py-5">
      <DebugToolbar
        aria-label="Debugger"
        onAction={run}
        disabledActions={paused ? [] : ['step-over', 'step-into', 'step-out']}
      >
        <DebugToolbarButton action="continue" label={paused ? 'Resume' : 'Continue'} />
        <DebugToolbarButton action="step-over" />
        <DebugToolbarButton action="step-into" />
        <DebugToolbarButton action="step-out" />
        <ToolbarSeparator />
        <DebugToolbarButton action="stop" />
        <ToolbarSeparator />
        <ToolbarButton size="sm" onClick={() => setLog('Opened DevTools')}>DevTools</ToolbarButton>
      </DebugToolbar>
      <p className="min-h-5 text-caption text-muted-foreground" aria-live="polite">{log}</p>
    </div>
  )
}

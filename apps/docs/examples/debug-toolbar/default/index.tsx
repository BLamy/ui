import { useState } from 'react'
import { DebugToolbar, type DebugToolbarAction } from '@/components/ui/debug-toolbar'

const LABELS: Record<DebugToolbarAction, string> = {
  continue: 'Continue',
  'step-over': 'Step over',
  'step-into': 'Step into',
  'step-out': 'Step out',
  'step-back': 'Step back',
  'reverse-continue': 'Reverse continue',
  restart: 'Restart',
  stop: 'Stop',
}

export default function DebugToolbarDemo() {
  const [lastAction, setLastAction] = useState<DebugToolbarAction | null>(null)

  return (
    <div className="flex flex-col items-center gap-3 py-5">
      <DebugToolbar onAction={setLastAction} />
      <p className="min-h-5 text-caption text-muted-foreground" aria-live="polite">
        {lastAction ? `Last action: ${LABELS[lastAction]}` : 'Choose a debugger action'}
      </p>
      <div className="w-full border-t border-border pt-5">
        <DebugToolbar
          size="compact"
          onAction={setLastAction}
          disabledActions={['step-into', 'step-out', 'reverse-continue']}
          className="mx-auto"
        />
      </div>
    </div>
  )
}

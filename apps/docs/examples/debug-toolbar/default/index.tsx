import { useState } from 'react'
import { DebugToolbar, debugToolbarActions, type DebugToolbarAction } from '@/components/ui/debug-toolbar'

export default function DebugToolbarDemo() {
  const [lastAction, setLastAction] = useState<DebugToolbarAction | null>(null)

  return (
    <div className="flex flex-col items-center gap-3 py-5">
      <DebugToolbar onAction={setLastAction} />
      <p className="min-h-5 text-caption text-foreground/70" aria-live="polite">
        {lastAction ? `Last action: ${debugToolbarActions[lastAction].label}` : 'Choose a debugger action'}
      </p>
      <div className="flex w-full justify-center border-t border-border pt-5">
        <DebugToolbar
          variant="plain"
          size="sm"
          onAction={setLastAction}
          disabledActions={['step-into', 'step-out', 'reverse-continue']}
        />
      </div>
    </div>
  )
}

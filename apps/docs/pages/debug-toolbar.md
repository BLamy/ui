# DebugToolbar

A compact control strip for a paused debugger. It uses Microsoft's Codicons for continue, step over, step into, step out, step back, reverse continue, restart and stop.

{% demo src="debug-toolbar/default" %}

## Usage

```tsx
import '@brett_lamy/ui/styles.css'
import { DebugToolbar, type DebugToolbarAction } from '@brett_lamy/ui'

function DebugControls({ dispatch, stopped }: {
  dispatch: (action: DebugToolbarAction) => void
  stopped: boolean
}) {
  return (
    <DebugToolbar
      onAction={dispatch}
      disabledActions={stopped
        ? ['continue', 'step-over', 'step-into', 'step-out', 'step-back', 'reverse-continue', 'stop']
        : []}
    />
  )
}
```

`onAction` receives one of the eight actions shown above. `disabledActions` disables the controls the active debugger cannot run; they stay focusable (`aria-disabled`) so people can still find them. The strip is a UI SDK Toolbar named "Debugger controls": Tab enters it once and the arrow keys move between the actions. Set `size="compact"` to keep all controls visible in a narrow pane.

The reverse controls need a debugger that supports reverse execution. The icons come from [Microsoft's Codicons](https://microsoft.github.io/vscode-codicons/dist/codicon).

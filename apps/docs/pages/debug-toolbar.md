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

`onAction` receives one of the eight actions shown above. `disabledActions` removes controls the active debugger cannot run. Set `size="compact"` to keep all controls visible in a narrow pane.

The reverse controls need a debugger that supports reverse execution. The icons come from [Microsoft's Codicons](https://microsoft.github.io/vscode-codicons/dist/codicon).

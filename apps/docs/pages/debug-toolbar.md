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

`onAction` receives the action that was pressed. `disabledActions` disables unavailable controls. Set `size="compact"` for a narrow pane.

Pass `actions` to choose and order the controls a debugger supports. The Replay Debugger block uses the standard order. Its host supplies `restartPlayback` and `stopPlayback`; unavailable controls are disabled:

```tsx
<DebugToolbar
  size="compact"
  actions={[
    'continue', 'step-over', 'step-into', 'step-out',
    'step-back', 'reverse-continue', 'restart', 'stop',
  ]}
  onAction={dispatch}
/>
```

The reverse controls need a debugger that supports reverse execution. The icons come from [Microsoft's Codicons](https://microsoft.github.io/vscode-codicons/dist/codicon).

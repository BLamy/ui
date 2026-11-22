# DebugToolbar

A paused debugger's stepping controls: continue, step over, step into, step out, step back, reverse continue, restart and stop, with Microsoft's Codicons. It is a preset of [Toolbar](https://blamy.github.io/ui/#/toolbar): the vocabulary (eight actions, their glyphs, names and colors) on the kit's Toolbar, which owns the look and the keyboard. Use it for a debugger's stepping strip; for any other row of icon actions, use [Toolbar](https://blamy.github.io/ui/#/toolbar) directly.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/debug-toolbar.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`). The copied source is yours to edit. Import from your alias:

```tsx
import { DebugToolbar } from '@/components/ui/debug-toolbar'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { DebugToolbar } from '@brett_lamy/ui/debug-toolbar'
```
{% endtab %}
{% endtabs %}

{% demo src="debug-toolbar/default" %}

## Usage

```tsx
<DebugToolbar
  onAction={dispatch}
  disabledActions={stopped
    ? ['continue', 'step-over', 'step-into', 'step-out', 'step-back', 'reverse-continue', 'stop']
    : []}
/>
```

`onAction(action, details)` receives the action of the pressed control and `{ reason: 'trigger-press', event }`, the kit's action contract; a control's own `onClick` runs first, and `event.preventDefault()` there keeps `onAction` from running. `disabledActions` lists the ones the debugger can't run right now: they stay focusable (`aria-disabled`) so people can still find them, and go grey like any unavailable tool (their tone color is for available actions only). `actions` picks and orders the controls (default: all eight), for a debugger without reverse execution, say:

```tsx
<DebugToolbar actions={['continue', 'step-over', 'step-into', 'step-out', 'restart', 'stop']} onAction={dispatch} />
```

## A controlled debugger

The toolbar holds no state: it says which action was pressed, and `disabledActions` is whatever you say can't go anywhere. So a debugger built on it can be controlled, with the position as one number you hold and every action a pure function from the position to the next one. Here the step is the state; the toolbar, the timeline under it, the code and the values are all drawn from it. Set a breakpoint in the gutter and Continue goes to its next hit, scrub the timeline and the toolbar's choices follow, and an action that would go nowhere from here is greyed out.

{% demo src="debug-toolbar/controlled" %}

```tsx
function debuggerReducer(state, action) {
  if (action === 'stop') return { ...state, stopped: true }
  if (action === 'restart') return { ...state, step: first, stopped: false }
  const next = navigateCached(cache, state.step, NAVIGATION[action], breakpointsOf(state))
  return next < 0 ? state : { ...state, step: next }
}

const [state, setState] = useState(initial)

<DebugToolbar
  onAction={(action) => setState((s) => debuggerReducer(s, action))}
  disabledActions={actions.filter((action) => debuggerReducer(state, action) === state)}
/>
<TraceTimeline value={timeOf(state.step)} onValueChange={(t) => setState((s) => ({ ...s, step: stepAt(t) }))} … />
<CodeEditor currentLine={lineOf(state.step)} … />
```

The answers come from a real recording, read once: an extractor replays a `recording.dat` with Replay's native linker, pauses at every step of the program, and writes where each kind of step goes from each step, every line's hits, and the frames and scopes, to one JSON file. `navigateCached` reads it, and the [Replay Debugger](https://blamy.github.io/ui/#/blocks/replay-debugger) block's `createCachedHost(cache)` answers the whole debugger from the same file (its "A real recording" variant).

## Looks and sizes

`variant` and `size` are Toolbar's. The default is `floating`, the card VS Code floats over the editor; `variant="plain"` sits in a pane's header with no surface (the Replay Debugger block uses it). `size="sm"` gives 28px tools for a narrow pane, `default` 36px, `lg` 44px (a touch layout). The colors are the theme's: Continue, Reverse continue and Restart in `success`, Stop in `destructive`, the steps in the toolbar's neutral color, so the strip follows light, dark and any theme scope.

## Your own row

Pass children instead of `actions` to compose the row: `DebugToolbarButton`s (each takes the toolbar's `onAction` and `disabledActions`, and its own `label`, `tone`, `size`, `disabled` and `onClick`), `ToolbarSeparator`s, and any other Toolbar control, all in one arrow-key order.

{% demo src="debug-toolbar/compose" %}

```tsx
<DebugToolbar aria-label="Debugger" onAction={run}>
  <DebugToolbarButton action="continue" label="Resume" />
  <DebugToolbarButton action="step-over" />
  <ToolbarSeparator />
  <DebugToolbarButton action="stop" />
  <ToolbarSeparator />
  <ToolbarButton size="sm" onClick={openDevTools}>DevTools</ToolbarButton>
</DebugToolbar>
```

## Accessibility

The strip is a toolbar named "Debugger controls" (pass `aria-label` to rename it): Tab enters it once, ←/→, Home and End move between the actions, Enter or Space presses one. Each button is named by its label, which is also its tooltip (the tooltip is the name, so it isn't read twice).

## Props

### DebugToolbar

Every [Toolbar](https://blamy.github.io/ui/#/toolbar) prop (`variant`, `size`, `orientation`, `aria-label`, `className`, `style`, `ref`…), plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `onAction` | — | `(action, details) => unknown`, called with the pressed control's action and `{ reason, event }`. |
| `actions` | all eight | The controls to show, in order. Ignored when children are given. |
| `disabledActions` | `[]` | Actions that are unavailable: focusable, `aria-disabled`, faded. |
| `variant` | `floating` | `floating`, `plain` or `bar` (Toolbar's looks). |
| `size` | `default` | `sm` (28px tools, 16px glyphs), `default` (36px, 20px), `lg` (44px, 24px). |
| `children` | — | Your own row instead of `actions`. |

### DebugToolbarButton

Every ToolbarButton prop, plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `action` | — | One of `continue`, `step-over`, `step-into`, `step-out`, `step-back`, `reverse-continue`, `restart`, `stop`. |
| `label` | the action's | The name and tooltip. |
| `tone` | the action's | Overrides the glyph's color. |
| `size` | from the toolbar | `icon-sm`, `icon` or `icon-lg`. |

`debugToolbarActions` is the table of each action's default `label`, Codicon `icon` and `tone`.

## Styling

The root is a Toolbar (`data-slot="toolbar"`, `data-variant`, `data-size`); each control is a `toolbar-button` with `data-action` set to its action and `data-disabled` while unavailable. The glyph is a `span.codicon.codicon-debug-*` that takes the button's text color.

The icons come from [Microsoft's Codicons](https://microsoft.github.io/vscode-codicons/dist/codicon).

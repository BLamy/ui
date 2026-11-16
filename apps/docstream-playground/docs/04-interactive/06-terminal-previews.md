---
description: Run OpenTUI examples in docs and AI responses with an isolated browser terminal, source, keyboard input, and verified render status.
---

# Terminal previews

OpenTUI code can run inside a documentation page or an AI answer. Mark a code fence `tui`, then click **Run**. The terminal loads the real OpenTUI browser runtime, renders the example, and accepts keyboard input after you click it or use **Focus terminal**.

## Try the keyboard

Click **Run**, focus the terminal, and press a key. The text updates in the terminal itself. **Stop** ends the program and **Run again** creates a fresh one.

```typescript tui title="Keyboard in the browser"
import { createCliRenderer, TextRenderable } from "@opentui/core"

const renderer = await createCliRenderer({ exitOnCtrlC: false })
const screen = new TextRenderable(renderer, {
  id: "keyboard-demo",
  content: "Docstream + OpenTUI\n\nClick the terminal, then press any key.",
  fg: "#a5f3fc",
})
renderer.root.add(screen)
renderer.keyInput.on("keypress", (key) => {
  screen.content = `Docstream + OpenTUI\n\nYou pressed: ${key.name}`
})
```

## Put it in an AI response

Ask the model for a `typescript tui`, `tsx tui`, `javascript tui`, or `jsx tui` fence. A plain `tui` fence uses TypeScript. The regular streaming renderer handles the preview:

```tsx title="Answer.tsx"
import { GitbookStreamdown } from "@brett_lamy/ui/docstream"

export function Answer({ text, streaming }) {
  return <GitbookStreamdown markdown={text} streaming={streaming} />
}
```

Run stays disabled while `streaming` is true or the code fence is unclosed. When the response finishes, the reader chooses whether to run it. Source changes stop the previous program.

{% demo src="interactive-tui/keyboard" %}

## Use the component directly

`TuiPreview` is exported from the root and the small `@brett_lamy/ui/docstream/tui` entry. This entry uses no almost-node dependency. It runs without a stylesheet; `@brett_lamy/ui/docstream/styles.css` styles its toolbar, buttons, status line and source panel, from your `--card`, `--border`, `--primary`, `--ring` and `--font-mono` tokens when it sits outside a docstream article.

```tsx title="TerminalAttachment.tsx"
import { TuiPreview } from "@brett_lamy/ui/docstream/tui"

<TuiPreview
  code={source}
  language="typescript"
  title="Generated terminal"
  height={360}
  streaming={streaming}
  onStateChange={(state) => console.log(state)}
/>
```

| Prop | Default | Purpose |
| --- | --- | --- |
| `code` | Required | Complete JavaScript, TypeScript, JSX, or TSX example. |
| `language` | `typescript` | Source language sent to the runtime. |
| `title` | `OpenTUI preview` | Accessible label and toolbar title. |
| `height` | `360` | Terminal height in pixels, bounded to 160–720. Width follows the container. |
| `runtimeUrl` | OpenTUI GitHub Pages example runtime | Trusted HTTP(S) URL, absolute or relative to the host page, including its deployment prefix. |
| `appearance` | `auto` | `light` or `dark` terminal. `auto` follows the nearest `.dark` / `.light` class or `data-theme` / `data-appearance` attribute, else the page's `color-scheme` and the system setting. The root carries the result as `data-appearance`. Since 2.0.1; 2.0.0 was always dark. |
| `theme` | from `appearance` | Explicit terminal colors over the appearance's: `{ background, foreground }`, either or both. Light or dark itself is `appearance`'s. |
| `streaming` | `false` | Disables Run while source is still arriving. |
| `startupTimeoutMs` | `30000` | Time allowed for the ready handshake, bounded to 1–120 seconds. |
| `renderTimeoutMs` | `30000` | Time allowed for the first rendered frame, bounded to 1–120 seconds. |
| `onStateChange` | — | Reports `idle`, `starting`, `running`, `error`, or `stopped`. |
| `className` | — | Class on the preview section (`section.docstream-tui`). |

Switching the appearance (or the page's theme, with `auto`) while a program runs ends it, like a source change: the terminal's colors are sent to the runtime when it starts. OpenTUI draws text white unless an example sets a color, so a light terminal is the dark one inverted: the runtime gets the inverse colors and the frame a CSS `invert(1) hue-rotate(180deg)` filter (the tscircuit preview does the same). Colors an example sets keep their hue. When you pass your own `background` or `foreground` in `theme`, they are sent as given, with no filter; then make sure the example sets readable colors.

**Controls.** Run (Retry after an error, Run again after Stop) is the primary button and turns into Stop in place while a program runs, so keyboard focus stays on it. Focus terminal appears once the terminal is running. Every button shows a focus ring and is 44px tall on touch screens. An error is an `alert`, drawn in the danger tone. **Source code** is a disclosure that works before hydration (a native `<details>`) and becomes UI SDK's Collapsible after.

| Hook | What it is |
| --- | --- |
| `[data-slot="tui-preview"]`, `.docstream-tui` | The root, with `data-tui-state` and `data-appearance`. |
| `.docstream-tui__toolbar`, `__title`, `__button[data-variant="primary" \| "secondary"]` | The toolbar and its buttons. |
| `[data-slot="tui-preview-terminal"]`, `.docstream-tui__placeholder` | The terminal screen, and what it shows before Run. |
| `[data-slot="tui-preview-status"]`, `[data-tone="error"]` | The status line; an error is an alert. |
| `[data-slot="tui-preview-source"]`, `.docstream-tui__source-trigger`, `__code` | The source disclosure. |
| `--docstream-tui-border` | The hairline color (2.0.0's hook, still read). |

To host the runtime yourself, configure it on the renderer. Use your actual base path:

```tsx
<MarkdownContent markdown={page} tui={{
  runtimeUrl: "/opentui/workbench/example/",
  height: 320,
}} />
```

`tui={false}` renders these fences as ordinary code. Existing `example` and `live` markers keep their existing behavior.

## What “running” confirms

The runtime reports ready before Docstream sends the source. Docstream marks the preview running only when the runtime reports a rendered frame for that exact request. A loaded iframe alone never counts as success. Startup failures and source errors show a message and **Retry**; both waits have time limits. Browser checks can inspect `data-tui-state`.

Each example runs in an opaque-origin iframe with `sandbox="allow-scripts"`. Docstream validates the message's source window and opaque origin, and passes only source, language, and theme. Document environment variables are not passed. Stop, source changes, and unmount remove the iframe, listeners, and timers.

The runtime is the [OpenTUI fork's browser example frame](https://blamy.github.io/opentui/workbench/example/). It loads only when the reader clicks Run.

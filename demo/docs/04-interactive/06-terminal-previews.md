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
import { GitbookStreamdown } from "@brett_lamy/docstream"

export function Answer({ text, isStreaming }) {
  return <GitbookStreamdown markdown={text} isStreaming={isStreaming} />
}
```

Run stays disabled while `isStreaming` is true or the code fence is unclosed. When the response finishes, the reader chooses whether to run it. Source changes stop the previous program.

{% demo src="interactive-tui/keyboard" %}

## Use the component directly

`TuiPreview` and its alias `TuiEmbed` are exported from the root and the small `@brett_lamy/docstream/tui` entry. This entry uses no almost-node dependency and needs no stylesheet.

```tsx title="TerminalAttachment.tsx"
import { TuiPreview } from "@brett_lamy/docstream/tui"

<TuiPreview
  code={source}
  language="typescript"
  title="Generated terminal"
  height={360}
  isStreaming={isStreaming}
  onStatusChange={(state) => console.log(state)}
/>
```

| Prop | Default | Purpose |
| --- | --- | --- |
| `code` | Required | Complete JavaScript, TypeScript, JSX, or TSX example. |
| `language` | `typescript` | Source language sent to the runtime. |
| `title` | `OpenTUI preview` | Accessible label and toolbar title. |
| `height` | `360` | Terminal height in pixels, bounded to 160–720. Width follows the container. |
| `runtimeUrl` | OpenTUI GitHub Pages example runtime | Trusted HTTP(S) URL, absolute or relative to the host page, including its deployment prefix. |
| `theme` | Dark, black background, light foreground | `{ mode, background, foreground }` terminal colors. |
| `isStreaming` | `false` | Disables Run while source is still arriving. |
| `startupTimeoutMs` | `30000` | Time allowed for the ready handshake, bounded to 1–120 seconds. |
| `renderTimeoutMs` | `30000` | Time allowed for the first rendered frame, bounded to 1–120 seconds. |
| `onStatusChange` | — | Reports `idle`, `starting`, `running`, `error`, or `stopped`. |
| `className` | — | Class on the preview section. |

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

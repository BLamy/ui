# TuiPreview

An interactive terminal program rendered by OpenTUI's actual WebAssembly renderer. It lives in Docstream and is exported by BL UI, so documentation and AI responses use the same sandbox, input handling, and lifecycle.

## Installation

{% command %}npm install @brett_lamy/ui{% endcommand %}

```tsx
import { TuiPreview, TuiEmbed } from '@brett_lamy/ui/tui'
```

The package root and `@/components/ui/tui-preview` registry alias export the same components. `TuiEmbed` is an alias of `TuiPreview`.

## Keyboard input

Select **Run**, focus the terminal, and press the Left and Right arrow keys. **Stop** removes the running program. Starting again creates a fresh frame.

{% demo src="tui-preview/keyboard" %}

## In an AI response

`MarkdownView` recognizes a `tui` code fence, or a JavaScript, TypeScript, JSX, or TSX fence with `tui` metadata. The reader starts execution after the response has finished streaming; an unfinished fence never starts a program.

{% demo src="tui-preview/ai-response" %}

````markdown
```typescript tui
import { TextRenderable, createCliRenderer } from "@opentui/core"
const renderer = await createCliRenderer()
renderer.root.add(new TextRenderable(renderer, { content: "Hello from a TUI" }))
```
````

```tsx
<MarkdownView markdown={response} streaming={isStreaming} />
```

## Runtime and lifecycle

The default runtime is the [OpenTUI fork's deployed browser frame](https://blamy.github.io/opentui/workbench/example/). The [OpenTUI documentation](https://blamy.github.io/opentui/docs/getting-started/browser/) contains the component examples, source, build instructions, and browser capability limits.

The sandbox permits scripts and has an opaque origin. Each preview has its own program, timers, and globals. The source is sent only after that frame reports ready; success requires a rendered status from the same frame. Errors and startup timeouts are visible, and Stop, a source change, or unmounting removes the frame and listeners.

Point `runtimeUrl` to another deployed copy or a local runtime during development:

```tsx
<TuiPreview code={program} runtimeUrl="http://localhost:4321/workbench/example/" />
<MarkdownView markdown={response} tui={{ runtimeUrl: '/opentui/workbench/example/' }} />
```

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `code` | required | Complete terminal program. |
| `language` | `typescript` | `typescript`, `javascript`, `tsx`, or `jsx`. |
| `title` | terminal preview | Accessible preview and frame title. |
| `height` | `360` | Terminal height in pixels, bounded to 160–720. |
| `runtimeUrl` | OpenTUI Pages frame | Browser runtime to run the program. |
| `isStreaming` | `false` | Disable Run while the response is incomplete. |
| `onStatusChange` | — | Observe `idle`, `starting`, `running`, `error`, and `stopped`. |

Set `MarkdownView`'s `tui` prop to `false` to render these fences as code only. Native process execution, SSH servers, audio devices, and FFmpeg decoding need a host runtime; the preview does not emulate them.

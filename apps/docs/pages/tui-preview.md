# TuiPreview

`TuiPreview` runs one small terminal program from its source: an [OpenTUI](https://blamy.github.io/opentui/docs/getting-started/browser/) program rendered by OpenTUI's own WebAssembly renderer, in a sandboxed frame, started when the reader presses **Run**. Use it to show a TUI in documentation or in an AI reply. It lives in Docstream, so a `tui` code fence in a [MarkdownView](https://blamy.github.io/ui/#/markdown-view) and this component share one sandbox, input handling and lifecycle.

{% hint style="info" %}
**Which terminal?** [Terminal](https://blamy.github.io/ui/#/terminal) is an emulator for a process you run (a shell, a REPL, a log stream). [OpenCode](https://blamy.github.io/ui/#/open-code) is a whole coding agent with a workspace and app previews. `TuiPreview` runs one program from source, on demand.
{% endhint %}

## Installation

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/tui-preview.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { TuiPreview } from '@/components/ui/tui-preview'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { TuiPreview } from '@brett_lamy/ui/tui-preview'
```
{% endtab %}
{% endtabs %}

The module re-exports Docstream's component with the types of its props and status (`TuiPreviewProps`, `TuiPreviewOptions`, `TuiPreviewState`, `TuiTheme`). `@brett_lamy/ui/tui` is the same module as its own entry, for a bundle that wants nothing else from the package. The default runtime URL (`DEFAULT_TUI_RUNTIME_URL`) and the fence test (`isTuiCodeBlock`) are Docstream's: import them from `@brett_lamy/docstream/tui`.

## Usage

```tsx
<TuiPreview code={program} title="Counter" height={300} />
```

## States

The preview starts **idle**, with a Run button and nothing loaded. Run moves it to **starting** (the runtime frame loads and reports ready, then the source is sent), then **running** once the program draws its first frame. A runtime that does not answer in time, or a program that throws, is an **error**, shown in the frame. Stop, a change of source, or unmounting ends the session (**stopped**) and removes the frame. `onStatusChange` reports each one.

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
| `isStreaming` | `false` | Disable Run while the response is incomplete (Docstream's name; `MarkdownView` calls it `streaming` and passes it on). |
| `theme` | dark: light gray on black | `{ mode, background, foreground }`: the frame's colors. They are concrete colors because the frame has its own origin; for a light page pass `{ mode: 'light', background: '#fff', foreground: '#111' }`. |
| `startupTimeoutMs` · `renderTimeoutMs` | `30000` | How long the runtime has to report ready, and the program to draw its first frame. |
| `className` | — | On the preview's root. |
| `onStatusChange` | — | Observe `idle`, `starting`, `running`, `error`, and `stopped`. |

Set `MarkdownView`'s `tui` prop to `false` to render these fences as code only. Native process execution, SSH servers, audio devices, and FFmpeg decoding need a host runtime; the preview does not emulate them.

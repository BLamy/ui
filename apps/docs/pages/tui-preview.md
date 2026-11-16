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

The module re-exports Docstream's component with the types of its props and state (`TuiPreviewProps`, `TuiPreviewOptions`, `TuiPreviewState`, `TuiAppearance`, `TuiTheme`). `@brett_lamy/ui/tui` is the same module as its own entry, for a bundle that wants nothing else from the package. The default runtime URL (`DEFAULT_TUI_RUNTIME_URL`) and the fence test (`isTuiCodeBlock`) are Docstream's: import them from `@brett_lamy/ui/docstream/tui`.

## Usage

```tsx
<TuiPreview code={program} title="Counter" height={300} />
```

## Light and dark

The terminal follows the page: with `appearance="auto"` (the default) it is light inside a light [ThemeScope](https://blamy.github.io/ui/#/theming) or page and dark inside a dark one, and it switches when the scope does. It reads the nearest `.light` / `.dark` class (what `ThemeScope` and `BLProvider` set) or `data-theme` / `data-appearance` attribute, else the page's `color-scheme` and the system setting. `appearance="light"` or `"dark"` forces one, for example a black terminal on a light page:

```tsx
<TuiPreview code={program} appearance="dark" />
```

The frame has its own origin, so its colors are sent to it rather than inherited. OpenTUI draws text white unless the program sets a color, so the light terminal is the dark one inverted. For exact colors, `theme` overrides any of the appearance's: `theme={{ background: '#101014' }}`. Changing the appearance while a program runs ends the program, like any other change of source.

## States

The preview starts **idle**, with a Run button and nothing loaded. Run moves it to **starting** (the runtime frame loads and reports ready, then the source is sent), then **running** once the program draws its first frame. A runtime that does not answer in time, or a program that throws, is an **error**: an alert under the frame, in the destructive tone, and Run becomes Retry. Stop (Run turns into Stop in place, so focus stays on it), a change of source, or unmounting ends the session (**stopped**) and removes the frame. `onStateChange` reports each one, the same callback name and five states as [OpenCode](https://blamy.github.io/ui/#/open-code)'s.

## Keyboard input

Select **Run**, focus the terminal (click it, or press **Focus terminal**), and press the Left and Right arrow keys. **Stop** removes the running program. Starting again creates a fresh frame.

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
| `streaming` | `false` | Disable Run while the response is incomplete, as `MarkdownView`'s `streaming` does. |
| `appearance` | `auto` | `auto` follows the surrounding scope or page; `light` or `dark` forces one. |
| `theme` | from `appearance` | `{ mode?, background?, foreground? }`: explicit terminal colors over the ones `appearance` picks. |
| `startupTimeoutMs` · `renderTimeoutMs` | `30000` | How long the runtime has to report ready, and the program to draw its first frame. |
| `className` | — | On the preview's root. |
| `onStateChange` | — | `(state)` on each move between `idle`, `starting`, `running`, `error` and `stopped`. |

Set `MarkdownView`'s `tui` prop to `false` to render these fences as code only. Native process execution, SSH servers, audio devices, and FFmpeg decoding need a host runtime; the preview does not emulate them.

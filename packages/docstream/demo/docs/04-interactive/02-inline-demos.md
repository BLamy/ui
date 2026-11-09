---
description: Self-contained demos that carry their own files — run in the browser by almost-node, held in a demo VFS, and copied and pasted between pages and editors with their files intact.
---

# Inline demos

A folder demo needs a host that knows the folder. An **inline demo** needs nothing: the `{% demo %}` block carries its files as titled fences, closed by `{% enddemo %}`. Paste one into an AI answer, a README, or a page on another site, and it still renders — the Code view shows the files, and the Preview runs them in [almost-node](https://www.npmjs.com/package/@agent-wasm/core), a Node.js runtime with a real Vite dev server, inside the reader's browser.

This is also exactly what **Copy page** produces for every folder demo, which is why a copied page renders back identically anywhere.

## A runnable inline demo

No resolver on this site has heard of `inline/tip-splitter`. Everything below — three files in two folders, a stylesheet and two variants — is the Markdown itself:

{% demo src="inline/tip-splitter" title="Tip splitter" description="Three inline files, a nested folder and a stylesheet, running in almost-node. Switching the variant reloads the iframe, not Vite." height="320" variants="light:Light,receipt:Receipt" %}
```tsx title="index.tsx"
import { useState } from "react"
import { Stepper } from "./parts/Stepper"
import "./tip.css"

export default function TipSplitter({ variant = "light" }: { variant?: string }) {
  const [bill, setBill] = useState(84)
  const [tip, setTip] = useState(18)
  const [people, setPeople] = useState(3)
  const total = bill * (1 + tip / 100)
  return (
    <div className={`tip tip-${variant}`}>
      <label className="tip-row">
        <span>Bill</span>
        <input type="number" min={0} value={bill} onChange={(e) => setBill(Number(e.target.value) || 0)} />
      </label>
      <Stepper label="Tip %" value={tip} step={5} min={0} onChange={setTip} />
      <Stepper label="People" value={people} min={1} onChange={setPeople} />
      <output className="tip-total">
        {(total / people).toFixed(2)}
        <small> each · {total.toFixed(2)} total</small>
      </output>
    </div>
  )
}
```
```tsx title="parts/Stepper.tsx"
export function Stepper({ label, value, step = 1, min = 0, onChange }: {
  label: string
  value: number
  step?: number
  min?: number
  onChange: (next: number) => void
}) {
  return (
    <div className="tip-row">
      <span>{label}</span>
      <span className="tip-stepper">
        <button onClick={() => onChange(Math.max(min, value - step))} aria-label={`Less ${label}`}>−</button>
        <b>{value}</b>
        <button onClick={() => onChange(value + step)} aria-label={`More ${label}`}>+</button>
      </span>
    </div>
  )
}
```
```css title="tip.css"
.tip { font-family: system-ui, sans-serif; max-width: 320px; margin: 16px auto; display: grid; gap: 10px; padding: 18px; border-radius: 14px; background: #f8fafc; color: #0f172a; box-shadow: 0 1px 3px #0f172a22; }
.tip-receipt { font-family: ui-monospace, Menlo, monospace; background: #fffdf5; border: 1px dashed #a8a29e; border-radius: 2px; box-shadow: none; }
.tip-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.tip-row input { width: 90px; font: inherit; padding: 4px 8px; text-align: right; }
.tip-stepper { display: inline-flex; align-items: center; gap: 10px; }
.tip-stepper button { width: 28px; height: 28px; border-radius: 999px; border: 1px solid #cbd5e1; background: #fff; font: inherit; cursor: pointer; }
.tip-total { font-size: 28px; font-weight: 700; text-align: center; padding-top: 6px; border-top: 1px solid #e2e8f0; }
.tip-total small { font-size: 13px; font-weight: 500; opacity: 0.6; }
```
{% enddemo %}

The smallest possible form is one file — here with the variant switch driving a prop:

{% demo src="pasted/counter" title="Counter (pasted)" description="No resolver behind this one — the files below *are* the demo." height="300" variants="calm:Calm,loud:Loud" %}
```tsx title="index.tsx"
import { useState } from "react"
import { Pill } from "./Pill"

export default function Counter({ variant = "calm" }: { variant?: string }) {
  const [count, setCount] = useState(0)
  const loud = variant === "loud"
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", gap: 12, padding: 32 }}>
      <Pill loud={loud}>{loud ? "COUNT: " + count : "Count: " + count}</Pill>
      <button onClick={() => setCount((c) => c + 1)} style={{ font: "inherit", padding: "6px 14px", borderRadius: 8 }}>
        Increment
      </button>
    </div>
  )
}
```
```tsx title="Pill.tsx"
import type { ReactNode } from "react"

export function Pill({ loud, children }: { loud?: boolean; children: ReactNode }) {
  return (
    <span
      style={{
        padding: "4px 12px",
        borderRadius: 999,
        fontWeight: 600,
        background: loud ? "#dc2626" : "#2563eb1f",
        color: loud ? "#fff" : "#2563eb",
      }}
    >
      {children}
    </span>
  )
}
```
{% enddemo %}

## Syntax

`````md
{% demo src="composer/scroll-fab" title="Scroll → FAB" variants="full:Full,compact:Compact" height="380" %}
```tsx title="index.tsx"
export default function ScrollFab({ variant }) { … }
```
````md title="README.md"
```sh
npm start
```
````
{% enddemo %}
`````

- **One titled fence per file**, entry first — or name it with `entry="App.tsx"`. Paths may contain folders (`parts/Stepper.tsx`). An untitled fence becomes `index.<lang>` (first) or `file-<n>.<lang>`.
- **Every tag attribute works** — `variants`, `height`, `viewport`, `status`, `surface`, … exactly as on a [folder demo](01-demos.md#tag-attributes).
- **Close it with `{% enddemo %}`.** Only fences (and blank lines) may sit between the tag and the end tag; anything else ends the block.
- **A file that contains fences needs a longer fence**, and the example that shows it needs a longer one still (above: 5 backticks around 4 around 3).
- **Give it a meaningful `src` anyway.** If the host's resolver knows the `src`, the real files win; otherwise the inline files run.

## How the files run

The Preview calls the `demoRuntime` in context with the block's files. `@brett_lamy/docstream/playground` provides one backed by almost-node; the package root never loads a runtime on its own, so hosts without `@agent-wasm/core` still bundle cleanly (such demos show their code and a one-line note).

`createInlineDemoProject` turns the files into a runnable project:

1. The files are written under `/src/demo/`, so relative imports between them keep working.
2. A tiny wrapper entry imports the entry file, takes its default export (or first exported function), and renders it with `variant` read from `?variant=` — so the variant switch only reloads the iframe; the Vite server keeps running.
3. An entry that mounts itself (`createRoot(…)`, `hydrateRoot(…)`, `ReactDOM.render(…)`) is used directly instead, and receives no `variant`.
4. `createReactDemoFiles` adds a `package.json` (React 19) and an `index.html` with `<div id="root">`, unless the files bring their own.

The project is keyed on its content, so re-renders and variant switches never restart Vite.

### npm dependencies

Inline files may import npm packages. Declare them in a `package.json` among the files, or for every demo on a renderer, with `demoDependencies`:

```tsx
<MarkdownContent markdown={answer} demoRuntime={demoRuntime} demoDependencies={{ "@brett_lamy/ui": "^1.2.0" }} />
```

Bare imports resolve through almost-node — installed packages first, else [esm.sh](https://esm.sh) at the major version declared — with `react` and `react-dom` provided. Every package downloads in the reader's browser, so keep the list short.

### Supplying a runtime

{% tabs %}
{% tab title="PlaygroundStreamdown" %}
```tsx title="Answer.tsx"
import { PlaygroundStreamdown } from "@brett_lamy/docstream/playground"

// Live code fences and inline demos run in almost-node by default.
<PlaygroundStreamdown markdown={md} isStreaming={!done} />
```
{% endtab %}
{% tab title="createAlmostNodeDemoRuntime" %}
```tsx title="Page.tsx"
import { MarkdownContent } from "@brett_lamy/docstream"
import { createAlmostNodeDemoRuntime } from "@brett_lamy/docstream/playground"

const demoRuntime = createAlmostNodeDemoRuntime({
  port: 4173, // preferred virtual port; the next free one is used if taken
  workspaceOptions: { basePath: "/docs" }, // static hosting under a sub-path
})

<MarkdownContent markdown={page} demoRuntime={demoRuntime} />
```
{% endtab %}
{% tab title="Lazy (this site)" %}
```tsx title="inline-demo-runtime.tsx"
import { Suspense, lazy } from "react"
import type { InlineDemoRuntime } from "@brett_lamy/docstream"

// The playground entry loads only once an inline demo scrolls into view.
const InlineDemoPreview = lazy(() =>
  import("@brett_lamy/docstream/playground").then((m) => ({ default: m.InlineDemoPreview })),
)
const WORKSPACE_OPTIONS = { basePath: import.meta.env.BASE_URL.replace(/\/$/, "") }

export const demoRuntime: InlineDemoRuntime = (props) => (
  <Suspense fallback={<div>Loading the almost-node runtime…</div>}>
    <InlineDemoPreview {...props} workspaceOptions={WORKSPACE_OPTIONS} />
  </Suspense>
)
```
{% endtab %}
{% endtabs %}

A runtime is just a function, `(props: InlineDemoRuntimeProps) => ReactNode`, receiving `{ src, title, files, entry, variant?, dependencies? }`. Back it with anything that can run files — a sandbox service, a WebContainer, your own bundler. The viewer around it still supplies the header, variants, viewports, Code view and fullscreen.

{% hint style="info" %}
While a block is still streaming in (no `{% enddemo %}` yet), its files show in the Code view and the Preview waits with "The demo is still arriving" — a half-written file never runs. See [Streaming](../06-ai/01-streaming.md).
{% endhint %}

## The demo VFS

A **demo VFS** holds demo files in memory by `src` — typically demos pasted from another page or editor. Give it to a renderer as `demoVFS` and a src-only `{% demo src="…" %}` whose `src` no resolver knows renders from the VFS, exactly like inline files (the host resolver still wins when it knows `src`).

```tsx title="Notes.tsx"
import { useEffect } from "react"
import { GitbookStreamdown, useDemoVFS, useDemoVFSFiles } from "@brett_lamy/docstream"

function Notes({ markdown }: { markdown: string }) {
  const vfs = useDemoVFS()            // created once per component
  const held = useDemoVFSFiles(vfs)   // { [src]: files }, re-renders on change
  useEffect(() => vfs.subscribe(({ src, entry }) => save(src, entry)), [vfs]) // persist pastes
  return <GitbookStreamdown markdown={markdown} demoVFS={vfs} />
}
```

| Member | Purpose |
| --- | --- |
| `createDemoVFS(initial?)` | A new VFS, optionally pre-filled with `{ [src]: files }` or `{ [src]: { files, meta } }`. |
| `get(src)` / `has(src)` / `list()` | Read entries (`{ files, meta? }`); `list` is in insertion order. |
| `set(src, files, meta?)` | Add or replace. A no-op — and no change event — when nothing differs. |
| `delete(src)` / `clear()` | Remove one / all (each removal emits a change). |
| `snapshot()` / `files()` | `{ [src]: entry }` / `{ [src]: files }`, stable until the next change. |
| `subscribe(listener)` | `({ src, entry }) => void`, `entry` is `undefined` on removal. Returns an unsubscribe. |
| `resolver({ resolver?, runtime?, dependencies? })` | The VFS as a `DemoResolver`, layered over a host resolver. |

`vfs.resolver(...)` is for places that want a single resolver: `meta` and `files` come from the host when it knows `src`, else from the VFS; `load` comes from the host, else returns a component that runs the VFS files through `runtime` (and rejects without one). One VFS can be shared by several renderers and editors.

## The docstream clipboard

Copying docstream content writes **one clipboard item with three representations**:

| MIME type | Content |
| --- | --- |
| `text/plain` | Renderable docstream Markdown — every demo carries its files inline, resolver files included. Paste it into a docs page, an LLM, or a plain editor and it still renders. |
| `text/markdown` | The same text. |
| `application/x-docstream+json` | `DOCSTREAM_CLIPBOARD_TYPE`: `{ kind: "docstream", version: 1, markdown, files, meta }` — the *exact* Markdown (src-only demos stay src-only) plus every demo's files and meta by `src`. |

A docstream-aware paste target reads the JSON, keeps the structure exactly as copied, and registers the files in its VFS; anything else gets Markdown that works on its own. The **Copy demo** button in every demo header writes all three.

Try the whole loop. Copy a src-only demo (its files come from this site's resolver), then paste it below — the paste target registers the files in a VFS under `pasted/…`, a namespace the site's resolver doesn't know, so the preview genuinely runs from the VFS through almost-node:

{% demo src="interactive-clipboard/round-trip" %}

| Function | From | Purpose |
| --- | --- | --- |
| `createDocstreamClipboard(doc, { lookup?, serialize? })` | root | Representations for a parsed document or selection. `lookup(node)` supplies files for src-only demos (e.g. `peekDemoSource`). |
| `createDocstreamClipboardFromMarkdown(md, options?)` | root | The same from Markdown, keeping the author's exact bytes in `payload.markdown`. |
| `docstreamClipboardItems(clip)` | root | As react-aria `DragItem`s, for `useClipboard` / `useDrag`. |
| `readDocstreamClipboard(dataTransfer)` | root | The payload from a paste / drop event, or `null`. |
| `readDocstreamClipboardItems(items)` | root | The same from react-aria `DropItem`s. |
| `parseDocstreamClipboard(json)` | root | Validate a payload string. |
| `CopyDemoButton` | root | Icon button: `{ clipboard: () => DocstreamClipboard \| null, label?, className? }`. |
| `useDocstreamCopy(produce)` | `/demo` | The hook behind it — spread `props` and `ref` on any focusable element; ⌘C / Ctrl+C on it copies too. |
| `writeDocstreamClipboard(dataTransfer, clip)` | `/demo` | Write onto a raw `copy` / `dragstart` event. |
| `docstreamPayloadFromMarkdown(md)` | `/demo` | A payload for Markdown that arrived without one. |

### Pasting into your own editor

```tsx title="PasteTarget.tsx"
import { createDocstreamClipboardFromMarkdown, readDocstreamClipboard } from "@brett_lamy/docstream"

function onPaste(event: React.ClipboardEvent) {
  const payload =
    readDocstreamClipboard(event.clipboardData) ??                                   // copied from docstream
    createDocstreamClipboardFromMarkdown(event.clipboardData.getData("text/plain")).payload // plain Markdown
  for (const [src, files] of Object.entries(payload.files)) vfs.set(src, files, payload.meta[src])
  insertMarkdown(payload.markdown)
}
```

{% content-ref url="03-live-code.md" %}
Live code — one-file live fences, ReactCodePreview, and the almost-node filesystem helpers
{% endcontent-ref %}

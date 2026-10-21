---
description: Run React code fences live, embed multi-file projects with ReactCodePreview, and drive the almost-node filesystem directly.
---

# Live code

Folder and inline demos cover components with variants and several files. For a quick snippet, mark a fence **live** and the host's `liveRenderer` takes over. For a whole project — your own files, your own entry, a real Vite dev server — use `ReactCodePreview` from `@brett_lamy/docstream/playground`.

{% hint style="warning" %}
Anything that runs code in the browser needs the optional peer dependency `@agent-wasm/core` (>= 0.4.0) and an import from `@brett_lamy/docstream/playground` — the only entry that references it. The package root and every other entry never do, so hosts without it typecheck and bundle cleanly, and the runtime itself is still loaded lazily.
{% endhint %}

## A real project, running here

This is `ReactCodePreview`, lazily imported by a folder demo. It writes the files into an almost-node virtual filesystem, runs `vite`, and serves the app into a sandboxed iframe — no server involved. Switch to **Multi-file** for three modules and a stylesheet, and open the expandable code panel under the preview.

{% demo src="interactive-live/react-preview" %}

## Live code fences

Add `live="true"` to a `jsx`, `tsx` or `react` fence:

````md
```jsx live="true" title="Counter" entry="/src/main.jsx"
import { useState } from "react"
import { createRoot } from "react-dom/client"

function App() {
  const [n, setN] = useState(0)
  return <button onClick={() => setN(n + 1)}>Clicked {n}×</button>
}

createRoot(document.getElementById("root")).render(<App />)
```
````

| Fence attribute | Default | Meaning |
| --- | --- | --- |
| `live` | `false` | Hand the fence to the `liveRenderer`. Only `jsx`, `tsx` and `react` fences go live. |
| `entry` | `/src/main.jsx` | Virtual path of the fence's code. |
| `title` | `Live React preview` | Header label. |
| `collapsedCodeLines` | `3` | Source lines visible before the code panel is expanded. |
| `expandedCodeLines` | `30` | Maximum lines before the expanded panel scrolls. |

The legacy GitBook wrapper works too: `{% code title="Counter" live="true" entry="/src/main.jsx" %}` around a plain fence, closed by `{% endcode %}`.

Without a `liveRenderer`, a live fence renders as ordinary highlighted code — so write it to read well as code. With `almostNodeLiveRenderer`, the fence becomes the Vite entry of a page with `<div id="root">`, so it **mounts itself with `createRoot`**.

### What the liveRenderer receives

A `liveRenderer` is any function from `LivePreviewProps` to React:

```ts title="types.ts"
interface LivePreviewProps {
  files: Record<string, string> // { [entry]: the fence's code }
  entry: string
  title: string
  collapsedCodeLines?: number
  expandedCodeLines?: number
}
type LivePreviewRenderer = (props: LivePreviewProps) => ReactNode
```

{% tabs %}
{% tab title="almost-node" %}
```tsx title="Page.tsx"
import { MarkdownContent } from "@brett_lamy/docstream"
import { almostNodeLiveRenderer } from "@brett_lamy/docstream/playground"

<MarkdownContent markdown={page} liveRenderer={almostNodeLiveRenderer} />
```
{% endtab %}
{% tab title="PlaygroundStreamdown" %}
```tsx title="Answer.tsx"
import { PlaygroundStreamdown } from "@brett_lamy/docstream/playground"

// almostNodeLiveRenderer and the almost-node demo runtime are wired in by default;
// explicit liveRenderer / demoRuntime props still win.
<PlaygroundStreamdown markdown={md} />
```
{% endtab %}
{% tab title="Your own" %}
```tsx title="live-renderer.tsx"
import type { LivePreviewProps } from "@brett_lamy/docstream"

// Mount components already in your bundle — no runtime at all.
export function liveRenderer({ files, entry, title }: LivePreviewProps) {
  const marker = /^\/\/\s*demo:([\w-]+)/.exec(files[entry] ?? "")?.[1]
  const Demo = marker ? REGISTRY[marker] : undefined
  return <section aria-label={title}>{Demo ? <Demo /> : <pre>{files[entry]}</pre>}</section>
}
```
{% endtab %}
{% endtabs %}

### Live, on this site

This site's `liveRenderer` combines the kinds. A fence whose first line names a registry entry (`// demo:parse-explorer`) mounts the **real exported docstream component** in-page, with no runtime. These two fences are live:

```tsx live="true" title="parseMarkdown explorer"
// demo:parse-explorer
import { parseMarkdown } from "@brett_lamy/docstream"

// Type in the left pane: the right pane is parseMarkdown's AST, updated per keystroke.
const ast = parseMarkdown(source)
```

```tsx live="true" title="Nested GitbookStreamdown"
// demo:nested-markdown
import { GitbookStreamdown } from "@brett_lamy/docstream"

<GitbookStreamdown markdown={NESTED_MD} />
```

Any other fence runs as written, in almost-node — the site loads the playground entry the first time one scrolls into view. This one is plain React:

```jsx live="true" title="Counter"
import { useState } from "react"
import { createRoot } from "react-dom/client"

function App() {
  const [n, setN] = useState(0)
  return <button onClick={() => setN(n + 1)}>Clicked {n}×</button>
}

createRoot(document.getElementById("root")).render(<App />)
```

The renderer, not the Markdown, decides what "live" means: on a host without one, all three fences above are ordinary highlighted code.

## ReactCodePreview

`ReactCodePreview` (an alias of `ReactDemo`) boots an almost-node workspace with your files, runs `vite`, and shows the app in a sandboxed iframe with a status header (idle / starting / ready / error), a Run / Retry button, and an expandable code panel.

```tsx title="Playground.tsx"
import { ReactCodePreview } from "@brett_lamy/docstream/playground"

const files = {
  "/src/main.jsx": `import { createRoot } from "react-dom/client"\nimport App from "./App.jsx"\ncreateRoot(document.getElementById("root")).render(<App />)`,
  "/src/App.jsx": `export default () => <h1>Hello</h1>`,
}

<ReactCodePreview files={files} entry="/src/main.jsx" codeFile="/src/App.jsx" height={320} />
```

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `files` | `AlmostNodeFiles` | — | Project files: `Record<path, content>` or `{ path, content }[]`. Relative paths root at `/`. Keep its identity stable. |
| `entry` | `string` | `"/src/main.jsx"` | Vite entry file. |
| `codeFile` | `string` | `entry` | File shown in the code panel. |
| `code` | `string` | — | Code panel text, instead of reading `codeFile`. |
| `language` | `string` | `codeFile`'s extension | Highlighting language for `code`. |
| `preview` | `ReactNode` | — | Render this instead of the iframe (no runtime starts); the frame, header and code panel stay. |
| `height` | `number \| string` | `360` | Preview height. |
| `title` | `string` | `"Live React preview"` | Header label. |
| `status` | `ReactNode \| false` | runtime state | Header status; `false` hides it. |
| `actions` | `ReactNode` | — | Extra header content, e.g. your own variant buttons. |
| `port` | `number` | `4173` | Preferred virtual port; the next free one is used if taken. |
| `autoStart` | `boolean` | `true` | Start on mount; otherwise a **Run demo** button starts it. |
| `collapsedCodeLines` / `expandedCodeLines` | `number` | `3` / `30` | Code panel sizes. |
| `sandbox` | `string` | `"allow-scripts allow-same-origin allow-forms allow-modals"` | iframe sandbox. |
| `workspaceOptions` | `Partial<AlmostNodeWorkspaceOptions>` | — | Spread into `createAlmostNodeWorkspace` (e.g. `basePath`). Keep its identity stable. |
| `onReady` / `onError` | `(url) => void` / `(error) => void` | — | Lifecycle callbacks. |
| `className` | `string` | — | Appended to `docs-react-demo`. |

`createReactDemoFiles` runs over `files` first, so a bare source map gets its `package.json` and `index.html` for free.

### useAlmostNodeServer

The hook underneath, for a fully custom UI: it boots `vite` for a complete project and disposes the container on change or unmount.

```tsx
import { createReactDemoFiles, useAlmostNodeServer } from "@brett_lamy/docstream/playground"

const project = useMemo(() => createReactDemoFiles(files), [files])
const { state, url, error } = useAlmostNodeServer({ files: project, run: 1 }) // run: bump to restart, 0 stops
return state === "ready" ? <iframe src={url!} sandbox="allow-scripts allow-same-origin" /> : <p>{error ?? state}</p>
```

## Filesystem helpers

`createReactDemoFiles` and `createInlineDemoProject` are pure and runtime-free, so they are also exported from the package root. The rest load `@agent-wasm/core` lazily from `@brett_lamy/docstream/playground`.

| Helper | Returns | Purpose |
| --- | --- | --- |
| `createReactDemoFiles(files, { entry?, dependencies? })` | file map | Adds a `package.json` (React 19 plus `dependencies`) and an `index.html` loading `entry`. Existing ones are always respected. |
| `createInlineDemoProject(files, { entry?, dependencies? })` | `{ files, entry, wrapped }` | An inline demo's files as a runnable project: files under `/src/demo/`, a wrapper entry that renders the default export with `?variant=` (see [Inline demos](02-inline-demos.md#how-the-files-run)). |
| `createAlmostNodeFilesystem(files, { root? })` | `Promise<VirtualFS>` | A standalone almost-node VFS populated with the files. |
| `createAlmostNodeWorkspace(files, options?)` | `Promise<AlmostNodeWorkspace>` | A full container with the files written in; `root` is its cwd and Vite root. |
| `normalizeAlmostNodePath(path, root?)` | `string` | Absolute, `.`/`..`-resolved path; throws if it escapes `root`. |
| `normalizeAlmostNodeFiles` / `toAlmostNodeFileMap` | list / map | Convert between the two `AlmostNodeFiles` shapes. |

```ts title="workspace.ts"
import { createAlmostNodeWorkspace } from "@brett_lamy/docstream/playground"

const ws = await createAlmostNodeWorkspace({ "/src/main.jsx": code }, { basePath: "/docs" })
ws.writeFile("/src/extra.js", "export const x = 1")
console.log(ws.listFiles())               // sorted paths in the VFS
await ws.container.run("vite --port 4173") // run, runFile, npm installs, Vite…
ws.dispose()
```

| `AlmostNodeWorkspace` member | Purpose |
| --- | --- |
| `container` | The almost-node `ContainerInstance`. |
| `root` | Normalized project root. |
| `writeFile(path, content)` / `writeFiles(files)` | Update the VFS. |
| `listFiles()` | Sorted file paths. |
| `dispose()` | Tear the container down. |

## Hosting checklist

{% stepper %}
{% step %}
### Install the runtime

{% command %}npm install @agent-wasm/core{% endcommand %}

Import live features only from `@brett_lamy/docstream/playground`, ideally behind `lazy()` so the runtime downloads when a live block first scrolls into view.
{% endstep %}
{% step %}
### Serve the service worker

Previews are routed by almost-node's service worker, `__sw__.js`. Serve it at `<base>/__sw__.js`. This site copies it from `node_modules/@agent-wasm/core/dist/` into `public/` before every dev and build run (`scripts/copy-sw.mjs`), along with the runtime's worker files from `dist/assets/`.
{% endstep %}
{% step %}
### Pass the base path

Under a sub-path (GitHub Pages: `/docstream/`), give the workspace `basePath` so the worker and preview URLs resolve: `workspaceOptions={{ basePath: import.meta.env.BASE_URL.replace(/\/$/, "") }}` — on `ReactCodePreview`, `InlineDemoPreview`, or `createAlmostNodeDemoRuntime`.
{% endstep %}
{% step %}
### Keep same-origin in the sandbox

The default sandbox includes `allow-same-origin` so the service worker can route the iframe. Opening the first live example waits for the worker to control the page; it does not reload the host page.
{% endstep %}
{% endstepper %}

{% hint style="info" %}
No cross-origin isolation (COOP/COEP headers) is configured for this site — it is a plain static GitHub Pages deployment, and every live preview on these pages runs there.
{% endhint %}

{% content-ref url="04-source-files.md" %}
Source files — render a real component or Storybook story from the repo with source-ref
{% endcontent-ref %}

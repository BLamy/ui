/* Pure, runtime-free helpers for describing an almost-node project as a file map.
   Nothing here imports `@agent-wasm/core`, so these are safe to use from the package
   root; the runtime itself lives in ./filesystem (the `/playground` entry). */

export type AlmostNodeFileContent = string | Uint8Array

export interface AlmostNodeFile {
  path: string
  content: AlmostNodeFileContent
}

export type AlmostNodeFiles =
  | Readonly<Record<string, AlmostNodeFileContent>>
  | readonly AlmostNodeFile[]

export interface AlmostNodeFilesystemOptions {
  /** Prefix for relative file paths. Defaults to the virtual root. */
  root?: string
}

export function normalizeAlmostNodePath(path: string, root = "/"): string {
  const normalizedRoot = normalizeRoot(root)
  const source = path.replaceAll("\\", "/")
  const absolute = source.startsWith("/") ? source : `${normalizedRoot}/${source}`
  const result = normalizeAbsolutePath(absolute)

  if (normalizedRoot !== "/" && result !== normalizedRoot && !result.startsWith(`${normalizedRoot}/`)) {
    throw new Error(`File path escapes the almost-node root: ${path}`)
  }
  return result
}

function normalizeAbsolutePath(path: string): string {
  const parts: string[] = []

  for (const part of path.split("/")) {
    if (!part || part === ".") continue
    if (part === "..") {
      if (parts.length > 0) parts.pop()
      continue
    }
    if (part.includes("\0")) throw new Error("almost-node file paths cannot contain null bytes")
    parts.push(part)
  }

  const result = `/${parts.join("/")}`
  return result === "" ? "/" : result
}

export function normalizeAlmostNodeFiles(files: AlmostNodeFiles): AlmostNodeFile[] {
  if (Array.isArray(files)) return files.map((file) => ({ ...file }))
  return Object.entries(files).map(([path, content]) => ({ path, content }))
}

export function toAlmostNodeFileMap(files: AlmostNodeFiles): Record<string, AlmostNodeFileContent> {
  return Object.fromEntries(normalizeAlmostNodeFiles(files).map(({ path, content }) => [path, content]))
}

function normalizeRoot(root: string): string {
  const normalized = normalizeAbsolutePath(root.replaceAll("\\", "/"))
  return normalized === "/" ? normalized : normalized.replace(/\/$/, "")
}


export interface ReactDemoFilesOptions {
  entry?: string
  /** Extra npm dependencies for the generated package.json (ignored when the files bring one). */
  dependencies?: Record<string, string>
}

/**
 * Add the tiny Vite/React shell needed by a file map that only contains source
 * files. Existing package.json and index.html files are always respected.
 */
export function createReactDemoFiles(
  files: AlmostNodeFiles,
  options: ReactDemoFilesOptions = {},
): Record<string, AlmostNodeFileContent> {
  const map = toAlmostNodeFileMap(files)
  const entry = normalizeAlmostNodePath(options.entry ?? "/src/main.jsx")
  const has = (candidate: string) => Object.keys(map).some((path) => normalizeAlmostNodePath(path) === candidate)

  if (!has("/package.json")) {
    map["/package.json"] = JSON.stringify(
      {
        name: "docstream-react-demo",
        private: true,
        type: "module",
        dependencies: { react: "^19.0.0", "react-dom": "^19.0.0", ...options.dependencies },
      },
      null,
      2,
    )
  }

  if (!has("/index.html")) {
    const entryUrl = `.${entry}`
    map["/index.html"] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Docstream React demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${entryUrl}"></script>
  </body>
</html>
`
  }

  return map
}

export interface InlineDemoProjectOptions {
  /** Entry file among `files` (relative path). Defaults to the first file. */
  entry?: string
  /** Extra npm dependencies (merged over a `package.json` among the files, if any). */
  dependencies?: Record<string, string>
}

export interface InlineDemoProject {
  /** Complete almost-node project: the demo under `/src/demo/`, a wrapper entry, package.json, index.html. */
  files: Record<string, AlmostNodeFileContent>
  /** The Vite entry to hand to `createReactDemoFiles` / `ReactDemo`. */
  entry: string
  /** Whether the entry is wrapped (so `?variant=` reaches the component as its `variant` prop). */
  wrapped: boolean
}

/** Folder the inline demo's files are written to inside the almost-node project. */
export const INLINE_DEMO_DIR = "/src/demo"
const WRAPPER_ENTRY = "/src/__docstream_demo_entry.js"

function selfMounting(source: string): boolean {
  return /\bcreateRoot\s*\(|\bReactDOM\.render\s*\(|\bhydrateRoot\s*\(/.test(source)
}

/**
 * Turn a `{% demo %}` block's inline files into a runnable almost-node project.
 *
 * The files go under `/src/demo/` (relative imports between them keep working). A tiny
 * wrapper entry imports the entry file, takes its default export (or the first exported
 * function), and renders it with `variant` read from the page's `?variant=` query — so
 * switching variants just reloads the iframe, no new Vite server. An entry that mounts
 * itself (`createRoot(…)`) is used directly instead, and receives no `variant`.
 *
 * A `package.json` among the files contributes its `dependencies`; `options.dependencies`
 * are merged over them. Bare imports resolve through almost-node (installed packages, else
 * esm.sh at the major version declared here), with `react`/`react-dom` provided.
 */
export function createInlineDemoProject(
  files: readonly { path: string; content: string }[],
  options: InlineDemoProjectOptions = {},
): InlineDemoProject {
  const map: Record<string, AlmostNodeFileContent> = {}
  let packageDeps: Record<string, string> = {}
  for (const file of files) {
    const relative = file.path.replace(/^\.?\/+/, "")
    if (relative === "package.json") {
      try {
        const pkg = JSON.parse(file.content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
        packageDeps = { ...pkg.devDependencies, ...pkg.dependencies }
      } catch {
        // Not JSON: keep it as a plain file.
      }
    }
    map[normalizeAlmostNodePath(relative, INLINE_DEMO_DIR)] = file.content
  }
  const entryFile = files.find((f) => f.path === options.entry) ?? files[0]
  if (!entryFile) throw new Error("An inline demo needs at least one file")
  const entryPath = normalizeAlmostNodePath(entryFile.path.replace(/^\.?\/+/, ""), INLINE_DEMO_DIR)
  const dependencies = { ...packageDeps, ...options.dependencies }
  const wrapped = !selfMounting(entryFile.content)
  if (wrapped) {
    const specifier = `.${entryPath.slice("/src".length)}`
    map[WRAPPER_ENTRY] = `import { createElement } from "react"
import { createRoot } from "react-dom/client"
import * as demo from ${JSON.stringify(specifier)}

const Component = demo.default ?? Object.values(demo).find((value) => typeof value === "function")
const variant = new URLSearchParams(location.search).get("variant")
const props = variant === null ? {} : { variant }
createRoot(document.getElementById("root")).render(
  Component
    ? createElement(Component, props)
    : createElement("pre", null, ${JSON.stringify(`${entryFile.path} has no default export to render.`)}),
)
`
  }
  const entry = wrapped ? WRAPPER_ENTRY : entryPath
  return { files: createReactDemoFiles(map, { entry, dependencies }), entry, wrapped }
}

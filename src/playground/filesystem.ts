import type { ContainerInstance, ContainerOptions, VirtualFS } from "@agent-wasm/core"

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

export interface AlmostNodeWorkspaceOptions extends Omit<ContainerOptions, "cwd"> {
  /** Project root used as the container cwd and Vite root. */
  root?: string
}

export interface AlmostNodeWorkspace {
  container: ContainerInstance
  root: string
  writeFile(path: string, content: AlmostNodeFileContent): void
  writeFiles(files: AlmostNodeFiles): void
  listFiles(): string[]
  dispose(): void
}

type AlmostNodeModule = typeof import("@agent-wasm/core")

async function loadAlmostNode(): Promise<AlmostNodeModule> {
  try {
    return await import("@agent-wasm/core")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Docstream live previews require @agent-wasm/core (almost-node). Install it in the host app. ${message}`,
      { cause: error },
    )
  }
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

function parentDirectory(path: string): string {
  const index = path.lastIndexOf("/")
  return index <= 0 ? "/" : path.slice(0, index)
}

function writeFilesToVfs(vfs: VirtualFS, files: AlmostNodeFiles, root: string): void {
  for (const { path, content } of normalizeAlmostNodeFiles(files)) {
    const absolutePath = normalizeAlmostNodePath(path, root)
    vfs.mkdirSync(parentDirectory(absolutePath), { recursive: true })
    vfs.writeFileSync(absolutePath, content)
  }
}

/**
 * Create a complete almost-node filesystem from a map or list of files.
 * The runtime is loaded lazily so ordinary markdown rendering does not pull
 * the WASM/browser runtime into the bundle until a live demo is used.
 */
export async function createAlmostNodeFilesystem(
  files: AlmostNodeFiles,
  options: AlmostNodeFilesystemOptions = {},
): Promise<VirtualFS> {
  const { VirtualFS } = await loadAlmostNode()
  const root = normalizeRoot(options.root ?? "/")
  const vfs = new VirtualFS()
  writeFilesToVfs(vfs, files, root)
  return vfs
}

/**
 * Create a container and populate its entire virtual filesystem in one call.
 * Use the returned container for `run`, `runFile`, npm installs, or Vite.
 */
export async function createAlmostNodeWorkspace(
  files: AlmostNodeFiles,
  options: AlmostNodeWorkspaceOptions = {},
): Promise<AlmostNodeWorkspace> {
  const { root: requestedRoot, ...containerOptions } = options
  const root = normalizeRoot(requestedRoot ?? "/")
  const { createContainer } = await loadAlmostNode()
  const container = createContainer({ ...containerOptions, cwd: root })

  const writeFiles = (nextFiles: AlmostNodeFiles) => writeFilesToVfs(container.vfs, nextFiles, root)
  writeFiles(files)

  return {
    container,
    root,
    writeFile(path, content) {
      writeFiles([{ path, content }])
    },
    writeFiles,
    listFiles() {
      return container.vfs
        .toSnapshot()
        .files.filter((entry) => entry.type === "file")
        .map((entry) => entry.path)
        .sort()
    },
    dispose() {
      container.dispose()
    },
  }
}

export interface ReactDemoFilesOptions {
  entry?: string
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
        dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
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

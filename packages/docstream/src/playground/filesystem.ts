import type { ContainerInstance, ContainerOptions, VirtualFS } from "@agent-wasm/core"
import {
  normalizeAlmostNodeFiles,
  normalizeAlmostNodePath,
  type AlmostNodeFileContent,
  type AlmostNodeFiles,
  type AlmostNodeFilesystemOptions,
} from "./project"

export * from "./project"

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
  const root = normalizeAlmostNodePath(options.root ?? "/")
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
  const root = normalizeAlmostNodePath(requestedRoot ?? "/")
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


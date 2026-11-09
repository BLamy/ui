import { promises as fs } from "node:fs"
import path from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin, ViteDevServer } from "vite"

export interface DocstreamSourceMount {
  /** Stable name used by Markdown source references. */
  name: string
  /** Real source directory. Relative paths are resolved from the Vite root. */
  root: string
  /** Allow PUT requests to edit files in this mount. Defaults to true. */
  writable?: boolean
  /**
   * Reload the page after a PUT. Defaults to true. Turn it off for content files whose importers
   * hot-update themselves (an editor autosaving Markdown), so a save doesn't reload the editor.
   */
  reloadOnWrite?: boolean
}

export interface DocstreamSourcesOptions {
  mounts: readonly DocstreamSourceMount[]
  /** HTTP endpoint prefix. Defaults to `/@docstream`. */
  apiBase?: string
}

interface ResolvedMount {
  name: string
  root: string
  writable: boolean
  reloadOnWrite: boolean
}

const VIRTUAL_ID = "virtual:docstream-sources"
const RESOLVED_VIRTUAL_ID = "\0virtual:docstream-sources"

function send(response: ServerResponse, status: number, body: string, type = "application/json; charset=utf-8") {
  response.statusCode = status
  response.setHeader("content-type", type)
  response.setHeader("cache-control", "no-store")
  response.end(body)
}

function requestUrl(request: IncomingMessage): URL {
  return new URL(request.url ?? "/", "http://docstream.local")
}

async function requestBytes(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

async function requestBody(request: IncomingMessage): Promise<string> {
  return (await requestBytes(request)).toString("utf8")
}

function normalizeRelativePath(value: string): string {
  const source = value.replaceAll("\\", "/").replace(/^\.\//, "")
  if (!source || source.startsWith("/") || source.split("/").some((part) => part === ".." || part === "")) {
    throw new Error(`Invalid mounted source path: ${value}`)
  }
  return source
}

function sourcePath(mount: ResolvedMount, requestedPath: string): { relativePath: string; absolutePath: string } {
  const relativePath = normalizeRelativePath(requestedPath)
  const absolutePath = path.resolve(mount.root, relativePath)
  const prefix = mount.root.endsWith(path.sep) ? mount.root : `${mount.root}${path.sep}`
  if (!absolutePath.startsWith(prefix)) throw new Error(`Source path escapes mount ${mount.name}: ${requestedPath}`)
  return { relativePath, absolutePath }
}

function provenance(url: URL, mount: ResolvedMount, relativePath: string, absolutePath: string, mtimeMs: number) {
  return {
    mount: mount.name,
    path: relativePath,
    exportName: url.searchParams.get("export") || "default",
    kind: url.searchParams.get("kind") === "story" ? "story" : "component",
    absolutePath,
    mtimeMs,
  }
}

function findMount(url: URL, mounts: readonly ResolvedMount[]): ResolvedMount {
  const name = url.searchParams.get("mount") ?? ""
  const mount = mounts.find((candidate) => candidate.name === name)
  if (!mount) throw new Error(`Unknown Docstream source mount: ${name}`)
  return mount
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function installMiddleware(server: ViteDevServer, apiBase: string, viteBase: string, mounts: readonly ResolvedMount[]) {
  server.middlewares.use(async (request, response, next) => {
    const url = requestUrl(request)
    if (url.pathname !== `${apiBase}/source` && url.pathname !== `${apiBase}/module`) return next()

    try {
      const mount = findMount(url, mounts)
      const requestedPath = url.searchParams.get("path") ?? ""
      const { relativePath, absolutePath } = sourcePath(mount, requestedPath)

      if (url.pathname === `${apiBase}/module`) {
        if (request.method !== "GET") return send(response, 405, "Method not allowed", "text/plain; charset=utf-8")
        await fs.access(absolutePath)
        const sourceUrl = `${viteBase.replace(/\/$/, "")}/@fs/${absolutePath.replaceAll(path.sep, "/")}?docstream=${Date.now()}`
        const module = `import * as source from ${JSON.stringify(sourceUrl)};\nexport default source;\n`
        return send(response, 200, module, "text/javascript; charset=utf-8")
      }

      if (request.method === "GET") {
        const [content, stat] = await Promise.all([fs.readFile(absolutePath, "utf8"), fs.stat(absolutePath)])
        return send(response, 200, JSON.stringify({ content, provenance: provenance(url, mount, relativePath, absolutePath, stat.mtimeMs) }))
      }

      if (request.method === "PUT") {
        if (!mount.writable) return send(response, 403, `Source mount ${mount.name} is read-only`, "text/plain; charset=utf-8")
        await fs.access(absolutePath)
        const parsed = JSON.parse(await requestBody(request)) as { content?: unknown }
        if (typeof parsed.content !== "string") return send(response, 400, "Expected a JSON string field named content", "text/plain; charset=utf-8")
        await fs.writeFile(absolutePath, parsed.content, "utf8")
        const stat = await fs.stat(absolutePath)
        server.watcher.add(absolutePath)
        if (mount.reloadOnWrite) server.ws.send({ type: "full-reload", path: "*" })
        return send(response, 200, JSON.stringify({ content: parsed.content, provenance: provenance(url, mount, relativePath, absolutePath, stat.mtimeMs) }))
      }

      if (request.method === "POST") {
        // Upload: create (or replace) a file with the raw request body, e.g. a dropped .rrweb recording.
        if (!mount.writable) return send(response, 403, `Source mount ${mount.name} is read-only`, "text/plain; charset=utf-8")
        const bytes = await requestBytes(request)
        await fs.mkdir(path.dirname(absolutePath), { recursive: true })
        await fs.writeFile(absolutePath, bytes)
        const stat = await fs.stat(absolutePath)
        server.watcher.add(absolutePath)
        return send(response, 201, JSON.stringify({ size: stat.size, provenance: provenance(url, mount, relativePath, absolutePath, stat.mtimeMs) }))
      }

      return send(response, 405, "Method not allowed", "text/plain; charset=utf-8")
    } catch (error) {
      const status = error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT" ? 404 : 400
      return send(response, status, errorMessage(error), "text/plain; charset=utf-8")
    }
  })
}

/**
 * Mount real source directories behind safe Vite dev-server endpoints.
 * Markdown references import live modules from these files, and editor writes
 * go back to disk so Vite's normal watcher/HMR pipeline remains authoritative.
 *
 * `GET {apiBase}/source?mount=&path=` reads a file, `PUT` (JSON `{ content }`) edits an existing one,
 * and `POST` (raw body) creates or replaces one — uploads such as `.rrweb` recordings.
 */
export function docstreamSources(options: DocstreamSourcesOptions): Plugin {
  const apiBase = `/${(options.apiBase ?? "/@docstream").replace(/^\/+|\/+$/g, "")}`
  let mounts: ResolvedMount[] = []
  let viteBase = "/"

  return {
    name: "docstream-sources",
    enforce: "pre",
    configResolved(config) {
      viteBase = config.base || "/"
      const names = new Set<string>()
      mounts = options.mounts.map((mount) => {
        if (!mount.name || names.has(mount.name)) throw new Error(`Docstream source mount names must be unique: ${mount.name}`)
        names.add(mount.name)
        return {
          name: mount.name,
          root: path.resolve(config.root, mount.root),
          writable: mount.writable !== false,
          reloadOnWrite: mount.reloadOnWrite !== false,
        }
      })
    },
    configureServer(server) {
      installMiddleware(server, apiBase, viteBase, mounts)
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) return
      return `export const apiBase = ${JSON.stringify(apiBase)};\nexport const mounts = ${JSON.stringify(options.mounts.map(({ name, writable = true }) => ({ name, writable })))};\n`
    },
  }
}

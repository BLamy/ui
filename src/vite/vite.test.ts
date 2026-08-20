import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { createServer, type ViteDevServer } from "vite"
import { docstreamSources } from "./index"

let server: ViteDevServer | undefined
let root: string | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
  if (root) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe("docstreamSources", () => {
  it("reads, imports, and writes a mounted real file with provenance", async () => {
    root = await mkdtemp(path.join(tmpdir(), "docstream-vite-"))
    await mkdir(path.join(root, "src"))
    const file = path.join(root, "src", "Button.tsx")
    await writeFile(file, "export function Button() { return null }\n")
    server = await createServer({
      root,
      logLevel: "silent",
      plugins: [docstreamSources({ mounts: [{ name: "ui", root: "src" }] })],
      server: { port: 0 },
    })
    await server.listen()
    const origin = server.resolvedUrls?.local[0]
    expect(origin).toBeTruthy()
    const query = "mount=ui&path=Button.tsx&export=Button&kind=component"

    const read = await fetch(`${origin}@docstream/source?${query}`)
    expect(read.status).toBe(200)
    const snapshot = await read.json()
    expect(snapshot).toMatchObject({
      content: "export function Button() { return null }\n",
      provenance: { mount: "ui", path: "Button.tsx", exportName: "Button", kind: "component" },
    })

    const module = await fetch(`${origin}@docstream/module?${query}`)
    expect(await module.text()).toContain("/@fs/")

    const next = "export function Button() { return <button>Saved</button> }\n"
    const write = await fetch(`${origin}@docstream/source?${query}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: next }),
    })
    expect(write.status).toBe(200)
    expect(await readFile(file, "utf8")).toBe(next)
  })

  it("rejects paths that escape a mount", async () => {
    root = await mkdtemp(path.join(tmpdir(), "docstream-vite-"))
    await mkdir(path.join(root, "src"))
    server = await createServer({
      root,
      logLevel: "silent",
      plugins: [docstreamSources({ mounts: [{ name: "ui", root: "src" }] })],
      server: { port: 0 },
    })
    await server.listen()
    const response = await fetch(`${server.resolvedUrls?.local[0]}@docstream/source?mount=ui&path=../package.json`)
    expect(response.status).toBe(400)
  })
})

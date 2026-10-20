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

  it("POST uploads raw bytes to a new file, creating folders; read-only mounts refuse", async () => {
    root = await mkdtemp(path.join(tmpdir(), "docstream-vite-"))
    await mkdir(path.join(root, "src"))
    await mkdir(path.join(root, "fixed"))
    server = await createServer({
      root,
      logLevel: "silent",
      plugins: [docstreamSources({ mounts: [{ name: "ui", root: "src" }, { name: "fixed", root: "fixed", writable: false }] })],
      server: { port: 0 },
    })
    await server.listen()
    const origin = server.resolvedUrls?.local[0]
    const bytes = new Uint8Array([0x5b, 0x5d, 0x0a, 0xff])

    const upload = await fetch(`${origin}@docstream/source?mount=ui&path=tickets/a/recording.rrweb`, { method: "POST", body: bytes })
    expect(upload.status).toBe(201)
    expect(await upload.json()).toMatchObject({ size: 4, provenance: { mount: "ui", path: "tickets/a/recording.rrweb" } })
    expect(new Uint8Array(await readFile(path.join(root, "src", "tickets", "a", "recording.rrweb")))).toEqual(bytes)

    const refused = await fetch(`${origin}@docstream/source?mount=fixed&path=x.rrweb`, { method: "POST", body: bytes })
    expect(refused.status).toBe(403)
    const escaped = await fetch(`${origin}@docstream/source?mount=ui&path=../x.rrweb`, { method: "POST", body: bytes })
    expect(escaped.status).toBe(400)
  })

  it("PUT reloads the page unless the mount opts out with reloadOnWrite: false", async () => {
    root = await mkdtemp(path.join(tmpdir(), "docstream-vite-"))
    await mkdir(path.join(root, "a"))
    await mkdir(path.join(root, "b"))
    await writeFile(path.join(root, "a", "x.md"), "a\n")
    await writeFile(path.join(root, "b", "x.md"), "b\n")
    server = await createServer({
      root,
      logLevel: "silent",
      plugins: [docstreamSources({ mounts: [{ name: "a", root: "a" }, { name: "b", root: "b", reloadOnWrite: false }] })],
      server: { port: 0 },
    })
    await server.listen()
    const sent: unknown[] = []
    const send = server.ws.send.bind(server.ws)
    server.ws.send = ((payload: unknown) => {
      sent.push(payload)
      return send(payload as never)
    }) as typeof server.ws.send
    const put = (mount: string) =>
      fetch(`${server!.resolvedUrls?.local[0]}@docstream/source?mount=${mount}&path=x.md`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "next\n" }),
      })
    expect((await put("b")).status).toBe(200)
    expect(sent).toEqual([])
    expect((await put("a")).status).toBe(200)
    expect(sent).toContainEqual({ type: "full-reload", path: "*" })
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

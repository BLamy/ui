import { describe, expect, it } from "vitest"
import { parseMarkdown } from "../gitbook/parse"
import {
  DOCSTREAM_CLIPBOARD_TYPE,
  collectDemoNodes,
  createDocstreamClipboard,
  createDocstreamClipboardFromMarkdown,
  docstreamClipboardItems,
  docstreamPayloadFromMarkdown,
  parseDocstreamClipboard,
  readDocstreamClipboard,
  readDocstreamClipboardItems,
  writeDocstreamClipboard,
} from "./clipboard"
import { createDemoVFS } from "./vfs"
import type { DemoFile, DemoResolver } from "./types"

const BUTTON: DemoFile[] = [
  { path: "index.tsx", content: "export default () => <button>Hi</button>\n", language: "tsx" },
  { path: "styles.css", content: ".b { color: red }\n", language: "css" },
]
const INLINE = '{% demo src="pasted/card" title="Card" %}\n```tsx title="index.tsx"\nexport default () => <div>card</div>\n```\n{% enddemo %}'

class MemoryTransfer {
  private data = new Map<string, string>()
  get types() {
    return Array.from(this.data.keys())
  }
  setData(type: string, value: string) {
    this.data.set(type, value)
  }
  getData(type: string) {
    return this.data.get(type) ?? ""
  }
}

describe("createDocstreamClipboard", () => {
  it("src-only demos: exact Markdown in the payload, resolver files inlined in the text", () => {
    const md = 'Intro\n\n{% demo src="button/basic" %}\n\nOutro\n'
    const clip = createDocstreamClipboardFromMarkdown(md, {
      lookup: (node) => (node.src === "button/basic" ? { files: BUTTON, meta: { title: "Basic button", height: 240 } } : undefined),
    })
    expect(clip.payload.markdown).toBe(md)
    expect(clip.payload.files["button/basic"].map((f) => f.path)).toEqual(["index.tsx", "styles.css"])
    expect(clip.payload.meta["button/basic"]).toEqual({ title: "Basic button", height: 240 })
    expect(clip.text).toContain('{% demo src="button/basic" title="Basic button" height="240" %}')
    expect(clip.text).toContain('```css title="styles.css"')
    expect(clip.text).toContain("{% enddemo %}")
    expect(clip.text).toContain("Intro")
    expect(clip.text).toContain("Outro")
    // The text renders on its own: its demo carries the files.
    expect(collectDemoNodes(parseMarkdown(clip.text))[0].files?.length).toBe(2)
  })

  it("inline-file demos: kept as written, files listed by src", () => {
    const clip = createDocstreamClipboardFromMarkdown(INLINE)
    expect(clip.text.trim()).toBe(INLINE)
    expect(clip.payload.files["pasted/card"]).toEqual([{ path: "index.tsx", content: "export default () => <div>card</div>", language: "tsx" }])
    expect(clip.payload.meta["pasted/card"]).toEqual({ title: "Card" })
  })

  it("demos the lookup can't answer for stay src-only", () => {
    const clip = createDocstreamClipboard(parseMarkdown('{% demo src="nope/x" %}\n'))
    expect(clip.text).toBe('{% demo src="nope/x" %}\n')
    expect(clip.payload.files).toEqual({})
  })

  it("finds demos nested in containers", () => {
    const md = '{% tabs %}\n{% tab title="A" %}\n{% demo src="button/basic" %}\n{% endtab %}\n{% endtabs %}\n'
    const clip = createDocstreamClipboardFromMarkdown(md, { lookup: () => ({ files: BUTTON }) })
    expect(Object.keys(clip.payload.files)).toEqual(["button/basic"])
    expect(clip.text).toContain('```tsx title="index.tsx"')
  })
})

describe("clipboard representations", () => {
  it("one react-aria item with text/plain, text/markdown and the JSON payload", () => {
    const clip = createDocstreamClipboardFromMarkdown(INLINE)
    const [item] = docstreamClipboardItems(clip)
    expect(Object.keys(item).sort()).toEqual([DOCSTREAM_CLIPBOARD_TYPE, "text/markdown", "text/plain"].sort())
    expect(item["text/plain"]).toBe(clip.text)
    expect(parseDocstreamClipboard(item[DOCSTREAM_CLIPBOARD_TYPE])).toEqual(clip.payload)
  })

  it("DataTransfer and DropItem readers agree; junk is rejected", async () => {
    const clip = createDocstreamClipboardFromMarkdown(INLINE)
    const data = new MemoryTransfer()
    writeDocstreamClipboard(data, clip)
    expect(readDocstreamClipboard(data)).toEqual(clip.payload)
    const [item] = docstreamClipboardItems(clip)
    const dropped = await readDocstreamClipboardItems([
      { kind: "text", types: new Set(Object.keys(item)), getText: async (type) => item[type] },
    ])
    expect(dropped).toEqual(clip.payload)
    expect(parseDocstreamClipboard("{")).toBeNull()
    expect(parseDocstreamClipboard('{"kind":"other","markdown":""}')).toBeNull()
    expect(readDocstreamClipboard(new MemoryTransfer())).toBeNull()
  })

  it("Markdown-only clipboards still yield the inline demos' files", () => {
    const payload = docstreamPayloadFromMarkdown(`Text\n\n${INLINE}\n`)
    expect(Object.keys(payload.files)).toEqual(["pasted/card"])
  })
})

describe("DemoVFS", () => {
  const host: DemoResolver = {
    list: () => ["button/basic"],
    meta: async () => ({ title: "Host" }),
    files: async () => BUTTON,
    load: async () => () => null,
  }

  it("stores, reports changes, and skips no-op writes", () => {
    const vfs = createDemoVFS()
    const changes: string[] = []
    vfs.subscribe((c) => changes.push(`${c.src}:${c.entry ? c.entry.files.length : "deleted"}`))
    vfs.set("pasted/card", [{ path: "index.tsx", content: "x" }], { title: "Card" })
    vfs.set("pasted/card", [{ path: "index.tsx", content: "x" }], { title: "Card" })
    const before = vfs.files()
    expect(vfs.files()).toBe(before)
    vfs.set("pasted/other", BUTTON)
    expect(vfs.files()).not.toBe(before)
    expect(vfs.list()).toEqual(["pasted/card", "pasted/other"])
    vfs.delete("pasted/card")
    expect(changes).toEqual(["pasted/card:1", "pasted/other:2", "pasted/card:deleted"])
  })

  it("as a resolver: the host first when it knows src, then the VFS; load runs the runtime", async () => {
    const vfs = createDemoVFS({ "pasted/card": { files: [{ path: "a.tsx", content: "a" }, { path: "index.tsx", content: "i" }], meta: { title: "Card", entry: "index.tsx" } } })
    const calls: unknown[] = []
    const layered = vfs.resolver({ resolver: host, runtime: (props) => (calls.push(props), null) })
    expect(layered.list!()).toEqual(["button/basic", "pasted/card"])
    expect((await layered.meta("button/basic"))?.title).toBe("Host")
    expect(await layered.files("button/basic")).toBe(BUTTON)
    expect((await layered.meta("pasted/card"))?.title).toBe("Card")
    expect((await layered.files("pasted/card")).map((f) => f.path)).toEqual(["index.tsx", "a.tsx"])
    const Component = (await layered.load("pasted/card")) as (p: { variant?: string }) => unknown
    Component({ variant: "dark" })
    expect(calls).toEqual([expect.objectContaining({ src: "pasted/card", title: "Card", entry: "index.tsx", variant: "dark" })])
    await expect(vfs.resolver({ resolver: host }).load("pasted/card")).rejects.toThrow(/runtime/)
    // Unknown to both: the host gets the last word.
    expect(await layered.files("unknown/x")).toBe(BUTTON)
    await expect(createDemoVFS().resolver().files("unknown/x")).rejects.toThrow()
  })
})

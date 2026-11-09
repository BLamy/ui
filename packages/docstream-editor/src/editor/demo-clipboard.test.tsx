// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { Editor as TiptapEditor } from "@tiptap/react"
import { AllSelection, NodeSelection, TextSelection } from "@tiptap/pm/state"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DOCSTREAM_CLIPBOARD_TYPE,
  createDemoVFS,
  parseDocstreamClipboard,
  type DemoFile,
  type DemoResolver,
  type DemoVFS,
} from "@brett_lamy/docstream/demo"
import { GitbookEditor, type GitbookEditorProps } from "./Editor"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const BUTTON: DemoFile[] = [
  { path: "index.tsx", content: 'import "./styles.css"\nexport default () => <button className="b">Hi</button>\n', language: "tsx" },
  { path: "styles.css", content: ".b { color: red }\n", language: "css" },
]
const resolver: DemoResolver = {
  list: () => ["button/basic"],
  meta: async () => ({ title: "Basic button", height: 240 }),
  files: async () => BUTTON,
  load: async () => () => null,
}
const INLINE_DEMO = '{% demo src="pasted/card" title="Card" %}\n```tsx title="index.tsx"\nexport default () => <div>card</div>\n```\n{% enddemo %}'

interface Mounted {
  editor: TiptapEditor
  markdown: () => string
  host: HTMLElement
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", undefined)
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

/** Two editors on one page. */
async function mountTwo(a: Partial<GitbookEditorProps>, b: Partial<GitbookEditorProps>): Promise<[Mounted, Mounted]> {
  const editors: (TiptapEditor | null)[] = [null, null]
  const markdown = ["", ""]
  const Two = () => (
    <>
      {[a, b].map((props, i) => (
        <div key={i} data-editor={i}>
          <GitbookEditor
            toolbar={false}
            slashMenu={false}
            references={false}
            markdown={props.markdown ?? ""}
            onChange={(md) => (markdown[i] = md)}
            onEditorReady={(ed) => {
              if (ed) editors[i] = ed
            }}
            {...props}
          />
        </div>
      ))}
    </>
  )
  await act(async () => root.render(<Two />))
  await flush()
  return [0, 1].map((i) => ({
    editor: editors[i]!,
    markdown: () => markdown[i],
    host: container.querySelector(`[data-editor="${i}"]`)!,
  })) as [Mounted, Mounted]
}

function demoPos(editor: TiptapEditor, src?: string): number {
  let at = -1
  editor.state.doc.descendants((node, pos) => {
    if (at < 0 && node.type.name === "gbDemo" && (!src || node.attrs.src === src)) at = pos
    return at < 0
  })
  return at
}

/** Focus `editor`, then fire a copy / cut the way a browser does (a fresh DataTransfer). */
async function copyFrom(editor: TiptapEditor, type: "copy" | "cut" = "copy"): Promise<DataTransfer> {
  const clipboardData = new DataTransfer()
  await act(async () => {
    editor.view.dom.focus()
    editor.view.dom.dispatchEvent(new ClipboardEvent(type, { clipboardData, bubbles: true, cancelable: true }))
  })
  return clipboardData
}

async function pasteInto(editor: TiptapEditor, clipboardData: DataTransfer) {
  await act(async () => {
    editor.view.dom.focus()
    editor.commands.focus("end")
    editor.view.dom.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }))
  })
  await flush()
}

/** A drag event carrying `dataTransfer` (happy-dom's DragEvent ignores it in the init dict). */
function dragEvent(type: string, dataTransfer: DataTransfer): DragEvent {
  const event = new DragEvent(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer })
  return event
}

function textOnly(data: DataTransfer): DataTransfer {
  const out = new DataTransfer()
  out.setData("text/plain", data.getData("text/plain"))
  return out
}

describe("demo copy → paste between two editors", () => {
  it("a src-only demo: the resolver's files travel with it and land in the VFS", async () => {
    const vfs = createDemoVFS()
    const changes = vi.fn()
    const [a, b] = await mountTwo(
      { markdown: 'Intro\n\n{% demo src="button/basic" %}\n', demoResolver: resolver },
      { demoVFS: vfs, onDemoFilesChange: changes },
    )
    await act(async () => {
      a.editor.view.dispatch(a.editor.state.tr.setSelection(NodeSelection.create(a.editor.state.doc, demoPos(a.editor))))
    })
    const data = await copyFrom(a.editor)

    const payload = parseDocstreamClipboard(data.getData(DOCSTREAM_CLIPBOARD_TYPE))!
    expect(payload.markdown.trim()).toBe('{% demo src="button/basic" %}')
    expect(payload.files["button/basic"].map((f) => f.path)).toEqual(["index.tsx", "styles.css"])
    expect(payload.meta["button/basic"]).toMatchObject({ title: "Basic button", height: 240 })
    const text = data.getData("text/plain")
    expect(text).toContain('{% demo src="button/basic" title="Basic button" height="240" %}')
    expect(text).toContain('```css title="styles.css"')
    expect(data.getData("text/markdown")).toBe(text)
    // Written by react-aria's useClipboard (its multi-representation marker is there too).
    expect(Array.from(data.types)).toContain("application/vnd.react-aria.items+json")

    await pasteInto(b.editor, data)
    // B has no resolver: the block carries the files inline, and the VFS holds them.
    expect(b.markdown()).toContain('{% demo src="button/basic" title="Basic button" height="240" %}')
    expect(b.markdown()).toContain('```css title="styles.css"')
    expect(vfs.get("button/basic")?.files.map((f) => f.path)).toEqual(["index.tsx", "styles.css"])
    expect(changes).toHaveBeenCalledWith({ "button/basic": expect.any(Array) }, expect.objectContaining({ src: "button/basic" }))
    // The pasted block shows its files (Code view; no runtime → the note).
    const demo = b.host.querySelector("[data-docstream-demo]")!
    expect(demo.getAttribute("data-demo-mode")).toBe("inline")
    expect(b.host.textContent).toContain("styles.css")
    // Source editor unchanged.
    expect(demoPos(a.editor)).toBeGreaterThan(0)
  })

  it("an inline-file demo inside a prose selection: structure, prose and files survive", async () => {
    const [a, b] = await mountTwo({ markdown: `Before the demo.\n\n${INLINE_DEMO}\n\nAfter the demo.\n` }, {})
    await act(async () => {
      const { doc } = a.editor.state
      a.editor.view.dispatch(a.editor.state.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)))
    })
    const data = await copyFrom(a.editor)
    const payload = parseDocstreamClipboard(data.getData(DOCSTREAM_CLIPBOARD_TYPE))!
    expect(payload.markdown).toContain("Before the demo.")
    expect(payload.markdown).toContain(INLINE_DEMO)
    expect(payload.files["pasted/card"]).toEqual([{ path: "index.tsx", content: "export default () => <div>card</div>", language: "tsx" }])

    await pasteInto(b.editor, data)
    const md = b.markdown()
    expect(md).toContain("Before the demo.")
    expect(md).toContain(INLINE_DEMO)
    expect(md).toContain("After the demo.")
    expect(b.host.querySelector("[data-docstream-demo]")?.getAttribute("data-demo-mode")).toBe("inline")
  })

  it('pastedDemoFiles="vfs": exact structure; a shared VFS renders the src-only block in both editors', async () => {
    const vfs = createDemoVFS()
    const [a, b] = await mountTwo(
      { markdown: '{% demo src="button/basic" %}\n', demoResolver: resolver },
      { demoVFS: vfs, pastedDemoFiles: "vfs" },
    )
    await act(async () => {
      a.editor.view.dispatch(a.editor.state.tr.setSelection(NodeSelection.create(a.editor.state.doc, 0)))
    })
    await pasteInto(b.editor, await copyFrom(a.editor))
    expect(b.markdown()).toContain('{% demo src="button/basic" %}')
    expect(b.markdown()).not.toContain("enddemo")
    // Rendered from the VFS (no resolver in B): Code view with the files.
    expect(b.host.querySelector("[data-docstream-demo]")?.getAttribute("data-demo-mode")).toBe("inline")
    expect(b.host.textContent).toContain("styles.css")
    expect(vfs.list()).toEqual(["button/basic"])
  })

  it("preview resolution: the host resolver when it knows src, else VFS files through the runtime", async () => {
    const vfs: DemoVFS = createDemoVFS({ "button/basic": { files: [{ path: "index.tsx", content: "vfs" }] }, "only/vfs": { files: BUTTON, meta: { title: "From VFS" } } })
    const runtime = vi.fn(() => <span data-runtime="">ran</span>)
    const [a] = await mountTwo(
      { markdown: '{% demo src="button/basic" %}\n\n{% demo src="only/vfs" %}\n', demoResolver: resolver, demoVFS: vfs, demoRuntime: runtime },
      {},
    )
    const modes = Array.from(a.host.querySelectorAll("[data-docstream-demo]")).map((el) => [el.getAttribute("data-demo-src"), el.getAttribute("data-demo-mode")])
    expect(modes).toEqual([["button/basic", "resolver"], ["only/vfs", "inline"]])
    expect(runtime).toHaveBeenCalledWith(expect.objectContaining({ src: "only/vfs", title: "From VFS" }))
  })

  it("Markdown fallback: only text/plain on the clipboard still recreates the demo and fills the VFS", async () => {
    const vfs = createDemoVFS()
    const [a, b] = await mountTwo({ markdown: `Lead.\n\n${INLINE_DEMO}\n` }, { demoVFS: vfs })
    await act(async () => {
      a.editor.view.dispatch(a.editor.state.tr.setSelection(new AllSelection(a.editor.state.doc)))
    })
    const plain = textOnly(await copyFrom(a.editor))
    expect(Array.from(plain.types)).toEqual(["text/plain"])
    await pasteInto(b.editor, plain)
    expect(b.markdown()).toContain(INLINE_DEMO)
    expect(vfs.get("pasted/card")?.files[0].path).toBe("index.tsx")
  })

  it("cut removes the demo from the source; plain prose copies stay ProseMirror's", async () => {
    const [a] = await mountTwo({ markdown: `Just prose here.\n\n${INLINE_DEMO}\n` }, {})
    await act(async () => {
      a.editor.view.dispatch(a.editor.state.tr.setSelection(TextSelection.create(a.editor.state.doc, 1, 5)))
    })
    const prose = await copyFrom(a.editor)
    expect(Array.from(prose.types)).not.toContain(DOCSTREAM_CLIPBOARD_TYPE)
    expect(prose.getData("text/html")).toContain("Just")

    await act(async () => {
      a.editor.view.dispatch(a.editor.state.tr.setSelection(NodeSelection.create(a.editor.state.doc, demoPos(a.editor))))
    })
    const cut = await copyFrom(a.editor, "cut")
    expect(parseDocstreamClipboard(cut.getData(DOCSTREAM_CLIPBOARD_TYPE))?.files["pasted/card"]).toHaveLength(1)
    expect(demoPos(a.editor)).toBe(-1)
  })

  it("dragging a demo's grip into another editor copies it there (files and all)", async () => {
    const vfs = createDemoVFS()
    const [a, b] = await mountTwo({ markdown: `${INLINE_DEMO}
`, demoResolver: resolver }, { demoVFS: vfs })
    const grip = a.host.querySelector<HTMLElement>("[data-gb-demo-grip]")!
    const dataTransfer = new DataTransfer()
    await act(async () => {
      grip.dispatchEvent(dragEvent("dragstart", dataTransfer))
    })
    expect(parseDocstreamClipboard(dataTransfer.getData(DOCSTREAM_CLIPBOARD_TYPE))?.files["pasted/card"]).toHaveLength(1)
    // No layout in happy-dom: say where the drop lands.
    b.editor.view.posAtCoords = () => ({ pos: 0, inside: -1 })
    await act(async () => {
      b.editor.view.dom.dispatchEvent(dragEvent("drop", dataTransfer))
    })
    await flush()
    expect(b.markdown()).toContain(INLINE_DEMO)
    expect(vfs.has("pasted/card")).toBe(true)
    expect(demoPos(a.editor)).toBe(0)
  })

  it("dragging a demo within its own editor moves it", async () => {
    const [a] = await mountTwo({ markdown: `Top.\n\n${INLINE_DEMO}\n\nBottom.\n` }, {})
    const dataTransfer = new DataTransfer()
    await act(async () => {
      a.host.querySelector<HTMLElement>("[data-gb-demo-grip]")!.dispatchEvent(dragEvent("dragstart", dataTransfer))
    })
    const end = a.editor.state.doc.content.size
    a.editor.view.posAtCoords = () => ({ pos: end, inside: -1 })
    await act(async () => {
      a.editor.view.dom.dispatchEvent(dragEvent("drop", dataTransfer))
    })
    await flush()
    const md = a.markdown()
    expect(md.split("{% demo").length - 1).toBe(1)
    expect(md.indexOf("Bottom.")).toBeLessThan(md.indexOf("{% demo"))
  })
})

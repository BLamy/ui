// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { Editor as TiptapEditor } from "@tiptap/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GitbookEditor, embedBlockFor, type GitbookEditorProps } from "./Editor"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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
  vi.unstubAllGlobals()
})

const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

async function mount(props: Partial<GitbookEditorProps>) {
  let editor: TiptapEditor | null = null
  let markdown = props.markdown ?? ""
  await act(async () =>
    root.render(
      <GitbookEditor
        toolbar={false}
        slashMenu={false}
        references={false}
        markdown={markdown}
        onChange={(md) => (markdown = md)}
        onEditorReady={(ed) => {
          if (ed) editor = ed
        }}
        {...props}
      />,
    ),
  )
  await flush()
  return { editor: editor! as TiptapEditor, markdown: () => markdown }
}

function drop(editor: TiptapEditor, data: DataTransfer) {
  const event = new DragEvent("drop", { bubbles: true, cancelable: true })
  Object.defineProperty(event, "dataTransfer", { value: data })
  // No layout in happy-dom: say where the drop lands.
  editor.view.posAtCoords = () => ({ pos: editor.state.doc.content.size, inside: -1 })
  editor.view.dom.dispatchEvent(event)
  return event
}

describe("file embeds", () => {
  it("embedBlockFor: images become figures, everything else an embed", () => {
    expect(embedBlockFor("./photos/My%20cat.png")).toEqual({ type: "gbFigure", attrs: { src: "./photos/My%20cat.png", alt: "My cat.png", caption: "", md: { raw: "![My cat.png](./photos/My%20cat.png)" } } })
    expect(embedBlockFor("./case/part.stl")).toEqual({ type: "gbEmbed", attrs: { url: "./case/part.stl" } })
  })

  it("a drop the host claims becomes embeds at the drop point", async () => {
    const onDropEmbeds = vi.fn((data: DataTransfer) => (data.types.includes("application/x-test") ? Promise.resolve(["./part.stl", "./shot.png"]) : null))
    const { editor, markdown } = await mount({ markdown: "Intro.\n", onDropEmbeds })
    const data = new DataTransfer()
    data.setData("application/x-test", "x")
    let event!: DragEvent
    await act(async () => {
      event = drop(editor, data)
    })
    await flush()
    expect(event.defaultPrevented).toBe(true)
    expect(markdown()).toContain('{% embed url="./part.stl" %}')
    expect(markdown()).toContain("![shot.png](./shot.png)")
    expect(markdown().indexOf("Intro.")).toBeLessThan(markdown().indexOf("part.stl"))
  })

  it("two drops that resolve late both land; neither replaces the other", async () => {
    let n = 0
    const { editor, markdown } = await mount({ markdown: "Intro.\n", onDropEmbeds: () => Promise.resolve([`./file${++n}.stl`]) })
    await act(async () => {
      drop(editor, new DataTransfer())
      drop(editor, new DataTransfer())
    })
    await flush()
    expect(markdown()).toContain("./file1.stl")
    expect(markdown()).toContain("./file2.stl")
  })

  it("a drop the host passes on is left to the editor", async () => {
    const { editor, markdown } = await mount({ markdown: "Intro.\n", onDropEmbeds: () => null })
    const data = new DataTransfer()
    data.setData("text/plain", "hello")
    await act(async () => {
      drop(editor, data)
    })
    await flush()
    expect(markdown()).not.toContain("embed")
  })

  it("Choose file… asks the host and writes the URL; STL embeds resolve through the host", async () => {
    const pickFile = vi.fn(async () => "./case/stl/back.stl")
    const resolveAsset = vi.fn(() => new Promise<string>(() => {}))
    const { markdown } = await mount({ markdown: '{% embed url="" %}\n', pickFile, resolveAsset })
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Choose file"))!
    await act(async () => button.click())
    await flush()
    expect(pickFile).toHaveBeenCalledWith({ kind: "embed", current: "" })
    expect(markdown()).toContain('{% embed url="./case/stl/back.stl" %}')
    expect(resolveAsset).toHaveBeenCalledWith("./case/stl/back.stl")
    expect(container.querySelector(".docstream-asset-pending")).not.toBeNull()
  })

  it("without a picker there is no Choose file… button", async () => {
    await mount({ markdown: '{% embed url="" %}\n' })
    expect([...container.querySelectorAll("button")].some((b) => b.textContent?.includes("Choose file"))).toBe(false)
  })
})

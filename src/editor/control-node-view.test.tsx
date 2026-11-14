// @vitest-environment happy-dom
/* controlNodeView: every event inside a UI SDK part of the node view is the part's, not ProseMirror's,
   whichever component it is (the docstream viewers it hosts bring parts the editor doesn't list). */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { Node } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import { EditorContent, NodeViewWrapper, useEditor, type Editor } from "@tiptap/react"
import { Slider, SliderControl, SliderThumb, SliderTrack } from "@ui-sdk/react/slider"
import { Toggle } from "@ui-sdk/react/toggle"
import { afterEach, beforeEach, expect, it } from "vitest"
import { controlNodeView } from "./controls"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function View() {
  return (
    <NodeViewWrapper className="probe" contentEditable={false}>
      <span className="chrome">Probe</span>
      <Slider defaultValue={[30]} aria-label="Volume">
        <SliderControl>
          <SliderTrack />
          <SliderThumb className="thumb" />
        </SliderControl>
      </Slider>
      <Toggle className="toggle" aria-label="Loop" />
    </NodeViewWrapper>
  )
}

const Probe = Node.create({
  name: "probe",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: "div[data-probe]" }],
  renderHTML: () => ["div", { "data-probe": "" }],
  addNodeView: () => controlNodeView(View),
})

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

it("stops presses and keys on any UI SDK part, and leaves the node's own chrome and drags to ProseMirror", async () => {
  let editor: Editor | null = null
  function App() {
    const e = useEditor({ extensions: [StarterKit, Probe], content: "<p>Hello</p><div data-probe></div><p>x</p>", immediatelyRender: true })
    editor = e
    return <EditorContent editor={e} />
  }
  await act(async () => root.render(<App />))
  await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
  const view = editor!.view as unknown as { docView: { children: { node?: { type: { name: string } }; spec?: { stopEvent?: (e: Event) => boolean }; stopEvent?: (e: Event) => boolean }[] } }
  const nodeView = view.docView.children.find((child) => child.node?.type.name === "probe")!
  const stop = (type: string, target: Element) => {
    const event = type === "keydown" ? new KeyboardEvent(type, { bubbles: true }) : new MouseEvent(type, { bubbles: true, cancelable: true })
    Object.defineProperty(event, "target", { value: target })
    return (nodeView.spec?.stopEvent ?? nodeView.stopEvent)!(event)
  }
  const thumb = container.querySelector(".thumb")!
  const toggle = container.querySelector(".toggle")!
  const chrome = container.querySelector(".chrome")!
  // A slider thumb and a toggle are divs and buttons outside the editor's own list of components.
  expect(stop("mousedown", thumb)).toBe(true)
  expect(stop("keydown", thumb)).toBe(true)
  expect(stop("mousedown", toggle)).toBe(true)
  // A press on the node itself still selects it, and a drag still moves it.
  expect(stop("mousedown", chrome)).toBe(false)
  expect(stop("drop", thumb)).toBe(false)
  expect(stop("dragover", thumb)).toBe(false)
})

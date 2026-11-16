// @vitest-environment happy-dom
/* The "/" and "@" / "#" menus: one UI SDK Trigger Menu per editor, reading and writing the document
   through `tiptapTriggerAdapter`. The editor keeps focus, and the menu takes its keys first. */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { Editor as TiptapEditor } from "@tiptap/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { GitbookEditor, type GitbookEditorProps } from "./Editor"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const flush = async (ms = 0) => {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, ms)) })
}
// Loaded items wait for typing to pause (150ms).
const loaded = () => flush(40)

async function mount(props: Partial<GitbookEditorProps> = {}) {
  let editor: TiptapEditor | null = null
  let markdown = props.markdown ?? "Start\n"
  await act(async () =>
    root.render(
      <GitbookEditor
        toolbar={false}
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
  const ed = editor! as TiptapEditor
  await act(async () => { ed.commands.focus("end") })
  return { editor: ed, markdown: () => markdown }
}

async function type(editor: TiptapEditor, text: string) {
  for (const char of text) await act(async () => { editor.commands.insertContent(char) })
  await flush()
}

async function press(editor: TiptapEditor, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init })
  await act(async () => { editor.view.dom.dispatchEvent(event) })
  await flush()
  return event
}

const listbox = (name: string) => document.querySelector<HTMLElement>(`[role="listbox"][aria-label="${name}"]`)
const options = (list: HTMLElement) => Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'))
const highlighted = (list: HTMLElement) => options(list).filter((option) => option.hasAttribute("data-highlighted"))

describe("slash menu", () => {
  it("opens a named listbox at the caret with the first block highlighted, and the editor keeps focus", async () => {
    const { editor } = await mount()
    await type(editor, " /")
    const list = listbox("Blocks")!
    expect(list).not.toBeNull()
    expect(list.closest('[data-slot="trigger-menu-content"]')?.classList.contains("slash-menu")).toBe(true)
    expect(options(list).length).toBeGreaterThan(5)
    expect(highlighted(list)).toHaveLength(1)
    expect(highlighted(list)[0]).toBe(options(list)[0])
    expect(highlighted(list)[0]!.getAttribute("aria-selected")).toBe("true")
    // The options never take focus: the caret stays in the document.
    for (const option of options(list)) expect(option.hasAttribute("tabindex") ? option.tabIndex : -1).toBe(-1)
    // The focused editor says it has a listbox popup, and points at it while open.
    expect(editor.view.dom.getAttribute("aria-haspopup")).toBe("listbox")
    expect(editor.view.dom.getAttribute("aria-autocomplete")).toBe("list")
    expect(editor.view.dom.getAttribute("aria-controls")).toBe(list.id)
    // A textbox stays a textbox: no aria-expanded on it.
    expect(editor.view.dom.getAttribute("role")).toBe("textbox")
    expect(editor.view.dom.hasAttribute("aria-expanded")).toBe(false)
    // Not pointed at an option until the highlight moves (a screen reader would read it out of turn).
    expect(editor.view.dom.hasAttribute("aria-activedescendant")).toBe(false)
  })

  it("moves the highlight with the arrows (wrapping), points the editor at it, and Enter inserts it", async () => {
    const { editor, markdown } = await mount()
    await type(editor, " /")
    const list = listbox("Blocks")!
    const all = options(list)
    expect((await press(editor, "ArrowDown")).defaultPrevented).toBe(true)
    expect(highlighted(list)[0]).toBe(all[1])
    expect(editor.view.dom.getAttribute("aria-activedescendant")).toBe(all[1]!.id)
    await press(editor, "ArrowUp")
    await press(editor, "ArrowUp")
    expect(highlighted(list)[0]).toBe(all[all.length - 1])
    await press(editor, "ArrowDown")
    expect(highlighted(list)[0]).toBe(all[0])
    const first = all[0]!.textContent!
    await press(editor, "Enter")
    expect(listbox("Blocks")).toBeNull()
    expect(editor.view.dom.hasAttribute("aria-controls")).toBe(false)
    expect(editor.view.dom.hasAttribute("aria-activedescendant")).toBe(false)
    expect(first).toBe("Heading 1")
    expect(markdown()).toBe("# Start\n")
  })

  it("narrows to the typed query, marks what matched, and restarts the highlight on each change", async () => {
    const { editor } = await mount()
    await type(editor, " /")
    await press(editor, "ArrowDown")
    await type(editor, "hin")
    const list = listbox("Blocks")!
    const titles = options(list).map((option) => option.textContent)
    expect(titles.length).toBeLessThan(5)
    expect(titles.filter((title) => /hin/i.test(title!)).length).toBeGreaterThan(0)
    expect(Array.from(list.querySelectorAll("mark"), (mark) => mark.textContent!.toLowerCase())).toContain("hin")
    expect(highlighted(list)[0]).toBe(options(list)[0])
    expect(editor.view.dom.hasAttribute("aria-activedescendant")).toBe(false)
  })

  it("shows the empty message when nothing matches, and Enter then inserts nothing", async () => {
    const { editor, markdown } = await mount()
    await type(editor, " /zzzz")
    expect(document.querySelector('[data-slot="trigger-menu-empty"]')?.textContent).toBe("No matching blocks")
    const before = markdown()
    await press(editor, "Enter")
    expect(markdown()).toBe(before)
  })

  it("closes on Escape without inserting, and leaves the typed text", async () => {
    const { editor } = await mount()
    await type(editor, " /hea")
    expect(listbox("Blocks")).not.toBeNull()
    expect((await press(editor, "Escape")).defaultPrevented).toBe(true)
    expect(listbox("Blocks")).toBeNull()
    expect(editor.getText()).toContain("/hea")
    // A key after the dismissal is the editor's again, and typing on doesn't reopen it.
    expect((await press(editor, "ArrowDown")).defaultPrevented).toBe(false)
    await type(editor, "d")
    expect(listbox("Blocks")).toBeNull()
    // Control+Space reopens the dismissed match.
    expect((await press(editor, " ", { code: "Space", ctrlKey: true })).defaultPrevented).toBe(true)
    expect(listbox("Blocks")).not.toBeNull()
  })

  it("undo after choosing brings the typed command back", async () => {
    const { editor, markdown } = await mount()
    await type(editor, " /hea")
    await press(editor, "Enter")
    expect(markdown()).toBe("# Start\n")
    await act(async () => { editor.commands.undo() })
    await flush()
    expect(editor.getText()).toContain("/hea")
  })

  it("the highlight follows the pointer", async () => {
    const { editor } = await mount()
    await type(editor, " /")
    const list = listbox("Blocks")!
    const third = options(list)[2]!
    await act(async () => { third.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" })) })
    await flush()
    expect(highlighted(list)).toEqual([third])
  })

  it("offers nothing in a code block", async () => {
    const { editor } = await mount({ markdown: "```\ncode\n```\n" })
    await act(async () => { editor.commands.setTextSelection(5) })
    expect(editor.state.selection.$from.parent.type.name).toMatch(/code/i)
    await type(editor, " /")
    expect(listbox("Blocks")).toBeNull()
  })

  it("closes on a press outside the menu and the editor", async () => {
    const { editor } = await mount()
    await type(editor, " /")
    expect(listbox("Blocks")).not.toBeNull()
    const outside = document.createElement("button")
    document.body.append(outside)
    await act(async () => {
      outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }))
      outside.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0 }))
      outside.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }))
    })
    await flush()
    expect(listbox("Blocks")).toBeNull()
    outside.remove()
  })

  it("inserts the option a pointer presses, without taking focus out of the editor", async () => {
    const { editor, markdown } = await mount()
    await type(editor, " /quote")
    const option = options(listbox("Blocks")!)[0]!
    const down = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 })
    await act(async () => {
      option.dispatchEvent(down)
      option.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0 }))
      option.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }))
    })
    await flush()
    expect(down.defaultPrevented).toBe(true)
    expect(listbox("Blocks")).toBeNull()
    expect(markdown()).toMatch(/^> /m)
  })
})

describe("reference menus", () => {
  const references = {
    mentions: [
      { id: "luna", label: "Luna Résumé", group: "People" },
      { id: "hollis", label: "Hollis Grant", group: "People" },
      { id: "claude", description: "agent", group: "Agents" },
    ],
    tags: async (query: string) => ["general", "design", "launch"].filter((tag) => tag.includes(query)).map((id) => ({ id })),
  }

  it("groups mentions under their headings and matches labels ignoring accents", async () => {
    const { editor } = await mount({ references })
    await type(editor, " @")
    await loaded()
    const list = listbox("Mentions")!
    expect(list).not.toBeNull()
    // Each group is named by its label part.
    const groups = Array.from(list.querySelectorAll<HTMLElement>('[role="group"]'))
    expect(groups.map((group) => document.getElementById(group.getAttribute("aria-labelledby")!)?.textContent)).toEqual(["People", "Agents"])
    await type(editor, "resu")
    await loaded()
    expect(options(listbox("Mentions")!).map((option) => option.textContent)).toEqual(["@lunaLuna Résumé", "@resu"])
    expect(listbox("Mentions")!.querySelector("mark")?.textContent).toBe("Résu")
  })

  it("inserts the highlighted mention as a chip on Enter", async () => {
    const { editor, markdown } = await mount({ references })
    await type(editor, " @hol")
    await loaded()
    expect(highlighted(listbox("Mentions")!)).toHaveLength(1)
    await press(editor, "Enter")
    expect(listbox("Mentions")).toBeNull()
    expect(markdown()).toContain("@hollis")
  })

  it("loads tags from an async source and names its own list", async () => {
    const { editor, markdown } = await mount({ references })
    await type(editor, " #de")
    await loaded()
    const list = listbox("Tags")!
    expect(options(list).map((option) => option.textContent)).toEqual(["#design", "#de"])
    await press(editor, "Tab")
    expect(markdown()).toContain("#design")
  })
})

describe("input method composition", () => {
  const references = {
    mentions: [
      { id: "luna", label: "Luna" },
      { id: "hollis", label: "Hollis" },
    ],
  }
  const fire = async (editor: TiptapEditor, type: "compositionstart" | "compositionend", data = "") => {
    await act(async () => { editor.view.dom.dispatchEvent(new CompositionEvent(type, { bubbles: true, data })) })
  }
  // An input method's text: ProseMirror dispatches it while composing, one transaction per update.
  async function compose(editor: TiptapEditor, text: string) {
    await fire(editor, "compositionstart")
    expect(editor.view.composing).toBe(true)
    for (const char of text) await act(async () => { editor.commands.insertContent(char) })
    await loaded()
  }
  const chips = (editor: TiptapEditor) => {
    let count = 0
    editor.state.doc.descendants((node) => { if (node.isLeaf && !node.isText) count++ })
    return count
  }

  it("matches nothing and inserts nothing mid-composition, then the composed text is the query at once", async () => {
    const { editor, markdown } = await mount({ references })
    await type(editor, " @")
    await loaded()
    const unfiltered = options(listbox("Mentions")!).map((option) => option.textContent)
    expect(unfiltered).toEqual(["@lunaLuna", "@hollisHollis"])

    await compose(editor, "hol")
    // Mid-composition the list is what it was before it, and the Enter that commits the IME is its own.
    expect(options(listbox("Mentions")!).map((option) => option.textContent)).toEqual(unfiltered)
    const commit = await press(editor, "Enter", { isComposing: true, keyCode: 229 })
    expect(commit.defaultPrevented).toBe(false)
    expect(chips(editor)).toBe(0)
    expect(editor.state.doc.textContent).toBe("Start @hol")

    // Composition ends: with no further key, the composed text is the query.
    await fire(editor, "compositionend", "hol")
    await loaded()
    const list = listbox("Mentions")!
    expect(options(list).map((option) => option.textContent)).toEqual(["@hollisHollis", "@hol"])
    expect(highlighted(list)[0]?.textContent).toBe("@hollisHollis")
    await press(editor, "Enter")
    expect(listbox("Mentions")).toBeNull()
    expect(chips(editor)).toBe(1)
    expect(markdown()).toContain("@hollis")
  })

  it("opens for a trigger typed inside a composition once it ends", async () => {
    const { editor } = await mount({ references })
    await type(editor, " ")
    await compose(editor, "@ho")
    expect(listbox("Mentions")).toBeNull()
    await fire(editor, "compositionend", "@ho")
    await loaded()
    expect(options(listbox("Mentions")!).map((option) => option.textContent)).toEqual(["@hollisHollis", "@ho"])
  })
})

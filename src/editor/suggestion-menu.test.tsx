// @vitest-environment happy-dom
/* The "/" and "@" / "#" menus: TipTap's suggestion plugin supplies the query and the caret, the
   editor keeps focus, and the list (UI SDK's listbox, layer and positioning) takes its keys. */
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

const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

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
    expect(list.closest('[data-slot="suggestion-menu-content"]')?.getAttribute("popover")).toBe("manual")
    expect(options(list).length).toBeGreaterThan(5)
    expect(highlighted(list)).toHaveLength(1)
    expect(highlighted(list)[0]).toBe(options(list)[0])
    expect(highlighted(list)[0]!.getAttribute("aria-selected")).toBe("true")
    // The options never take focus: the caret stays in the document.
    for (const option of options(list)) expect(option.hasAttribute("tabindex") ? option.tabIndex : -1).toBe(-1)
    expect(editor.view.dom.getAttribute("aria-controls")).toBe(list.id)
    // Not pointed at an option until the highlight moves (a screen reader would read it out of turn).
    expect(editor.view.dom.hasAttribute("aria-activedescendant")).toBe(false)
  })

  it("out of the top layer (a layer host, or no popover support) it shows in place, raised by z-index", async () => {
    // UI SDK keeps a popup out of the top layer where it can't use it; the markup must not hide it there.
    const showPopover = HTMLElement.prototype.showPopover
    ;(HTMLElement.prototype as { showPopover?: unknown }).showPopover = undefined
    try {
      const { editor } = await mount()
      await type(editor, " /")
      const content = listbox("Blocks")!.closest<HTMLElement>('[data-slot="suggestion-menu-content"]')!
      expect(content.hasAttribute("popover")).toBe(false)
      expect(content.style.zIndex).toBe("2147483000")
      expect(content.hasAttribute("data-open")).toBe(true)
      await press(editor, "Escape")
      expect(listbox("Blocks")).toBeNull()
    } finally {
      HTMLElement.prototype.showPopover = showPopover
    }
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
    expect(document.querySelector('[data-slot="suggestion-menu-empty"]')?.textContent).toBe("No matching blocks")
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
    // A key after the dismissal is the editor's again.
    expect((await press(editor, "ArrowDown")).defaultPrevented).toBe(false)
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
    const list = listbox("Mentions")!
    expect(list).not.toBeNull()
    const groups = Array.from(list.querySelectorAll<HTMLElement>('[role="group"]'))
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual(["People", "Agents"])
    await type(editor, "resu")
    expect(options(listbox("Mentions")!).map((option) => option.textContent)).toEqual(["@lunaLuna Résumé", "@resu"])
    expect(listbox("Mentions")!.querySelector("mark")?.textContent).toBe("Résu")
  })

  it("inserts the highlighted mention as a chip on Enter", async () => {
    const { editor, markdown } = await mount({ references })
    await type(editor, " @hol")
    expect(highlighted(listbox("Mentions")!)).toHaveLength(1)
    await press(editor, "Enter")
    expect(listbox("Mentions")).toBeNull()
    expect(markdown()).toContain("@hollis")
  })

  it("loads tags from an async source and names its own list", async () => {
    const { editor, markdown } = await mount({ references })
    await type(editor, " #de")
    const list = listbox("Tags")!
    expect(options(list).map((option) => option.textContent)).toEqual(["#design", "#de"])
    await press(editor, "Tab")
    expect(markdown()).toContain("#design")
  })
})

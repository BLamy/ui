// @vitest-environment happy-dom
/* The editor's controls are UI SDK components: the formatting toolbar, the link popover, and the
   node views' selects, tabs, checkboxes, disclosure, radio and buttons. These tests check what the
   editor wires: names, values, keys reaching the controls through ProseMirror, and the document. */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { Editor as TiptapEditor } from "@tiptap/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GitbookEditor, type GitbookEditorProps } from "./Editor"
import { ReactDemoEditor } from "./ReactDemoEditor"

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

async function key(target: Element, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init })
  await act(async () => { target.dispatchEvent(event) })
  await flush()
  return event
}

async function click(target: Element) {
  await act(async () => {
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerType: "mouse" }))
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }))
    target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, button: 0, pointerType: "mouse" }))
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }))
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }))
  })
  await flush()
}

async function focus(target: HTMLElement) {
  await act(async () => { target.focus() })
  await flush()
}

async function typeInto(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
  await flush()
}

const byLabel = <T extends HTMLElement = HTMLElement>(label: string, scope: ParentNode = container) =>
  scope.querySelector<T>(`[aria-label="${label}"]`)

describe("formatting toolbar", () => {
  it("is one named toolbar with a single tab stop, arrow keys between its controls", async () => {
    await mount({ markdown: "Hello world\n", toolbar: true })
    const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]')!
    expect(toolbar.getAttribute("aria-label")).toBe("Formatting")
    const controls = Array.from(toolbar.querySelectorAll<HTMLButtonElement>("button"))
    expect(controls.map((control) => control.getAttribute("aria-label"))).toEqual(["Bold", "Italic", "Strike", "Inline code", "Link"])
    expect(controls.filter((control) => control.tabIndex === 0)).toHaveLength(1)
    await focus(controls[0]!)
    await key(controls[0]!, "ArrowRight")
    expect(document.activeElement).toBe(controls[1])
    await key(controls[1]!, "End")
    expect(document.activeElement).toBe(controls[4])
    await key(controls[4]!, "ArrowRight")
    expect(document.activeElement).toBe(controls[0])
    expect(controls.filter((control) => control.tabIndex === 0)).toEqual([controls[0]])
  })

  it("toggles reflect the marks under the selection and a press applies one, keeping the selection", async () => {
    const { editor, markdown } = await mount({ markdown: "Hello world\n", toolbar: true })
    const bold = byLabel<HTMLButtonElement>("Bold")!
    expect(bold.getAttribute("aria-pressed")).toBe("false")
    await act(async () => { editor.commands.setTextSelection({ from: 1, to: 6 }) })
    await click(bold)
    expect(markdown()).toBe("**Hello** world\n")
    expect(editor.state.selection.from).toBe(1)
    expect(editor.state.selection.to).toBe(6)
    expect(bold.getAttribute("aria-pressed")).toBe("true")
    expect(bold.hasAttribute("data-pressed")).toBe(true)
  })

  it("follows `editable`: a read-only editor disables the whole toolbar", async () => {
    await mount({ markdown: "Hello\n", toolbar: true, editable: false })
    const toolbar = container.querySelector<HTMLElement>('[role="toolbar"]')!
    for (const control of toolbar.querySelectorAll("button")) expect(control.hasAttribute("data-disabled")).toBe(true)
  })

  it("edits a link in a popover: the field takes focus, submitting applies it, Escape returns to the button", async () => {
    const { editor, markdown } = await mount({ markdown: "Hello world\n", toolbar: true })
    await act(async () => { editor.commands.setTextSelection({ from: 1, to: 6 }) })
    const link = byLabel<HTMLButtonElement>("Link")!
    expect(link.getAttribute("aria-haspopup")).toBe("dialog")
    await focus(link)
    await key(link, "Enter")
    await act(async () => { link.click() })
    await flush()
    expect(link.getAttribute("aria-expanded")).toBe("true")
    const popup = document.querySelector<HTMLElement>(".gb-link-popover")!
    expect(popup.getAttribute("aria-label")).toBe("Link")
    const url = byLabel<HTMLInputElement>("URL", popup)!
    expect(document.activeElement).toBe(url)
    await typeInto(url, "https://example.com")
    await act(async () => { url.form!.requestSubmit() })
    await flush()
    expect(markdown()).toBe("[Hello](https://example.com) world\n")
    expect(document.querySelector(".gb-link-popover")).toBeNull()

    await act(async () => { editor.commands.setTextSelection({ from: 2, to: 3 }) })
    await focus(link)
    await act(async () => { link.click() })
    await flush()
    const field = byLabel<HTMLInputElement>("URL", document.querySelector(".gb-link-popover")!)!
    expect(field.value).toBe("https://example.com")
    await key(field, "Escape")
    expect(document.querySelector(".gb-link-popover")).toBeNull()
    expect(document.activeElement).toBe(link)
    expect(markdown()).toBe("[Hello](https://example.com) world\n")
  })
})

describe("node view controls", () => {
  it("hint style: a named select whose list writes the style", async () => {
    const { markdown } = await mount({ markdown: '{% hint style="info" %}\nHello\n{% endhint %}\n' })
    const trigger = byLabel<HTMLButtonElement>("Hint style")!
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox")
    expect(trigger.textContent).toBe("info")
    await focus(trigger)
    await key(trigger, "ArrowDown")
    const list = document.querySelector<HTMLElement>('[role="listbox"]')!
    expect(list).not.toBeNull()
    const options = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'))
    expect(options.map((option) => option.textContent)).toEqual(["info", "success", "warning", "danger"])
    await click(options[2]!)
    expect(markdown()).toBe('{% hint style="warning" %}\nHello\n{% endhint %}\n')
    expect(byLabel("Hint style")!.textContent).toBe("warning")
  })

  it("tabs: a named tab list, arrows select a tab, the title field and buttons are named", async () => {
    const { markdown } = await mount({
      markdown: '{% tabs %}\n{% tab title="One" %}\nA\n{% endtab %}\n\n{% tab title="Two" %}\nB\n{% endtab %}\n{% endtabs %}\n',
    })
    const list = container.querySelector<HTMLElement>('[role="tablist"]')!
    expect(list.getAttribute("aria-label")).toBe("Tabs")
    const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'))
    expect(tabs.map((tab) => tab.textContent)).toEqual(["One", "Two"])
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false"])
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1])
    await focus(tabs[0]!)
    await key(tabs[0]!, "ArrowRight")
    const after = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'))
    expect(after.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["false", "true"])
    expect(document.activeElement).toBe(after[1])
    expect(container.querySelector(".gb-tabs-content")!.getAttribute("data-active")).toBe("1")

    const title = byLabel<HTMLInputElement>("Tab title")!
    expect(title.value).toBe("Two")
    await typeInto(title, "Second")
    expect(markdown()).toContain('{% tab title="Second" %}')
    expect(byLabel("Remove One")).not.toBeNull()
    await click(byLabel("Remove Second")!)
    expect(markdown()).not.toContain("Second")
    // One tab left: nothing to remove.
    expect(container.querySelector(".gb-tabs-remove")).toBeNull()
    await click(byLabel("Add tab")!)
    expect(markdown()).toContain('{% tab title="Tab 2" %}')
  })

  it("titled tabs: the heading level is a named select", async () => {
    const { markdown } = await mount({
      markdown: '{% tabs title="Install" %}\n{% tab title="npm" %}\nnpm i\n{% endtab %}\n{% endtabs %}\n',
    })
    expect(byLabel<HTMLInputElement>("Section title")!.value).toBe("Install")
    const level = byLabel<HTMLButtonElement>("Heading level")!
    expect(level.textContent).toBe("H2")
    await click(level)
    const h3 = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((option) => option.textContent === "H3")!
    await click(h3)
    expect(markdown()).toContain('level="3"')
  })

  it("code block: line numbers and live are named checkboxes that write their flags", async () => {
    const { markdown } = await mount({ markdown: '```js title="x.js"\nlet a\n```\n' })
    const lines = container.querySelector<HTMLElement>('[role="checkbox"][aria-label="Line numbers"]')!
    const before = lines.getAttribute("aria-checked")
    expect(before === "true" || before === "false").toBe(true)
    const live = Array.from(container.querySelectorAll<HTMLElement>('[role="checkbox"]')).find((box) => box.closest("label")?.textContent === "Live")!
    expect(live).toBeDefined()
    // ProseMirror leaves the key to the checkbox (the browser turns Space on a button into a click).
    await focus(lines)
    const space = await key(lines, " ")
    expect(space.defaultPrevented).toBe(false)
    expect(markdown()).toBe('```js title="x.js"\nlet a\n```\n')
    // A press: Space on these buttons is the browser's own click, which happy-dom doesn't synthesize.
    await click(lines)
    const after = before === "true" ? "false" : "true"
    expect(markdown()).toContain(`lineNumbers="${after}"`)
    expect(container.querySelector('[role="checkbox"][aria-label="Line numbers"]')!.getAttribute("aria-checked")).toBe(after)
    await click(live)
    expect(markdown()).toMatch(/```js[^\n]*live/)
    expect(byLabel("Entry file")).not.toBeNull()
  })

  it("demo: the files toggle is a disclosure; its panel holds the file tabs, the entry radio and the code", async () => {
    const { markdown } = await mount({
      markdown: '{% demo src="a/b" title="Card" %}\n```tsx title="index.tsx"\nexport default () => null\n```\n```css title="styles.css"\n.b {}\n```\n{% enddemo %}\n',
    })
    const toggle = container.querySelector<HTMLButtonElement>(".gb-demo-files-toggle")!
    expect(toggle.textContent).toBe("2 files")
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    await focus(toggle)
    await key(toggle, "Enter")
    await act(async () => { toggle.click() })
    await flush()
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!
    expect(panel.hidden).toBe(false)
    const tabs = Array.from(panel.querySelectorAll<HTMLElement>('[role="tab"]'))
    expect(panel.querySelector('[role="tablist"]')!.getAttribute("aria-label")).toBe("Demo files")
    expect(tabs.map((tab) => tab.querySelector(".gb-tabs-tab-label")!.textContent)).toEqual(["index.tsx", "styles.css"])
    await focus(tabs[0]!)
    await key(tabs[0]!, "ArrowRight")
    expect(byLabel<HTMLInputElement>("File path", panel)!.value).toBe("styles.css")
    const visible = panel.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')!
    expect(byLabel<HTMLTextAreaElement>("Edit styles.css", visible)!.value).toBe(".b {}")
    const group = visible.querySelector<HTMLElement>('[role="radiogroup"]')!
    expect(group.getAttribute("aria-label")).toBe("Entry file")
    const radio = group.querySelector<HTMLElement>('[role="radio"]')!
    expect(radio.getAttribute("aria-checked")).toBe("false")
    await click(radio)
    await flush()
    expect(markdown()).toContain('entry="styles.css"')
    expect(byLabel("Remove index.tsx", panel)).not.toBeNull()
    expect(byLabel("Add file", panel)).not.toBeNull()

    await key(toggle, "Enter")
    await act(async () => { toggle.click() })
    await flush()
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
  })

  it("source ref: the kind is a named select", async () => {
    const { markdown } = await mount({ markdown: '{% source-ref mount="source" path="src/A.tsx" export="A" kind="component" %}\n' })
    const kind = byLabel<HTMLButtonElement>("Source kind")!
    expect(kind.textContent).toBe("component")
    await click(kind)
    await click(Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((option) => option.textContent === "story")!)
    expect(markdown()).toContain('kind="story"')
  })

  it("command box: each field has a visible label", async () => {
    await mount({ markdown: "{% command %}\nnpm install x\n{% endcommand %}\n" })
    const fields = Array.from(container.querySelectorAll<HTMLElement>(".gb-command-field"))
    expect(fields.map((field) => field.querySelector('[data-slot="field-label"]')!.textContent)).toEqual(["npm", "pnpm", "yarn", "bun"])
    for (const field of fields) {
      const control = field.querySelector<HTMLElement>("input, textarea")!
      const label = field.querySelector<HTMLLabelElement>("label")!
      expect(label.htmlFor).toBe(control.id)
    }
  })

  it("every node view control in a busy document has a name", async () => {
    await mount({
      markdown: [
        '{% hint style="info" %}\nA\n{% endhint %}',
        '{% embed url="" %}',
        '{% content-ref url="a.md" %}\n[A](a.md)\n{% endcontent-ref %}',
        "$$\nx^2\n$$",
        "{% updates %}\n{% update date=\"2024-01-01\" %}\nA\n{% endupdate %}\n{% endupdates %}",
        "![shot](a.png)",
        "[label]: https://example.com",
      ].join("\n\n") + "\n",
      pickFile: async () => "./picked.stl",
      uploadFile: async (file) => `./${file.name}`,
    })
    const controls = Array.from(container.querySelectorAll<HTMLElement>(".gb [data-slot]")).filter((el) =>
      /^(?:button|input|textarea|select-trigger|checkbox|radio|tabs-tab|collapsible-trigger|file-input-trigger)$/.test(el.dataset.slot!),
    )
    expect(controls.length).toBeGreaterThan(8)
    const unnamed = controls.filter((el) => {
      if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return false
      if (el.id && container.querySelector(`label[for="${el.id}"]`)) return false
      if (el.closest("label")?.textContent?.trim()) return false
      return !(el instanceof HTMLButtonElement && el.textContent?.trim())
    })
    expect(unnamed.map((el) => el.outerHTML.slice(0, 120))).toEqual([])
  })

  it("upload: the file input's trigger is a named button and the chosen file goes to the host", async () => {
    const uploadFile = vi.fn(async (file: File) => `./${file.name}`)
    const { markdown } = await mount({ markdown: '{% embed url="" %}\n', uploadFile })
    const root = container.querySelector<HTMLElement>('.gb-embed-fields [data-slot="file-input"]')!
    const trigger = root.querySelector<HTMLButtonElement>('[data-slot="file-input-trigger"]')!
    expect(trigger.textContent?.trim()).toBe("Upload…")
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!
    expect(input.tabIndex).toBe(-1)
    Object.defineProperty(input, "files", { value: [new File(["x"], "part.stl")], configurable: true })
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })) })
    await flush()
    expect(uploadFile).toHaveBeenCalledOnce()
    expect(markdown()).toBe('{% embed url="./part.stl" %}\n')
  })
})

describe("attachment chip", () => {
  const attachments = [{ id: "att-1", name: "image.png", size: 2048, src: "data:image/png;base64,AAAA" }]

  it("is a named button; Enter opens the viewer dialog, Escape closes it and focus returns to the chip", async () => {
    await mount({ markdown: "See ![image.png](attachment:att-1) here.\n", attachments })
    const chip = container.querySelector<HTMLElement>(".gb-attachment")!
    expect(chip.getAttribute("role")).toBe("button")
    expect(chip.getAttribute("aria-label")).toBe("image.png, 2 KB")
    expect(chip.tabIndex).toBe(0)
    await focus(chip)
    await key(chip, "Enter")
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog).not.toBeNull()
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    const title = document.getElementById(dialog.getAttribute("aria-labelledby")!)!
    expect(title.textContent).toBe("image.png")
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(byLabel("Close", dialog)).not.toBeNull()
    await key(document.activeElement!, "Escape")
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(chip)
  })

  it("the close button closes the viewer", async () => {
    await mount({ markdown: "See ![image.png](attachment:att-1) here.\n", attachments })
    const chip = container.querySelector<HTMLElement>(".gb-attachment")!
    await focus(chip)
    await key(chip, "Enter")
    await click(byLabel("Close", document.querySelector('[role="dialog"]')!)!)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it("a host's onAttachmentOpen replaces the viewer", async () => {
    const onAttachmentOpen = vi.fn()
    await mount({ markdown: "See ![image.png](attachment:att-1) here.\n", attachments, onAttachmentOpen })
    const chip = container.querySelector<HTMLElement>(".gb-attachment")!
    await focus(chip)
    await key(chip, "Enter")
    expect(onAttachmentOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "att-1", name: "image.png" }))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})

describe("ReactDemoEditor", () => {
  it("lists the files as vertical tabs; arrows switch the file being edited", async () => {
    const onChange = vi.fn()
    await act(async () =>
      root.render(<ReactDemoEditor files={{ "/src/main.jsx": "main()", "/src/App.jsx": "app()" }} autoPreview={false} onChange={onChange} />),
    )
    await flush()
    const list = container.querySelector<HTMLElement>('[role="tablist"]')!
    expect(list.getAttribute("aria-label")).toBe("Demo files")
    expect(list.getAttribute("aria-orientation")).toBe("vertical")
    const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'))
    expect(tabs.map((tab) => tab.textContent)).toEqual(["src/App.jsx", "src/main.jsx"])
    expect(byLabel<HTMLTextAreaElement>("Edit /src/App.jsx")!.value).toBe("app()")
    await focus(tabs[0]!)
    await key(tabs[0]!, "ArrowDown")
    const textarea = byLabel<HTMLTextAreaElement>("Edit /src/main.jsx")!
    expect(textarea.value).toBe("main()")
    await typeInto(textarea, "main(1)")
    expect(onChange).toHaveBeenLastCalledWith({ "/src/main.jsx": "main(1)", "/src/App.jsx": "app()" })
    const run = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Run demo"))
    expect(run).toBeDefined()
  })
})

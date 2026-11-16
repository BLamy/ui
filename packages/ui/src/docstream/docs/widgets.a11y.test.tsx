// @vitest-environment happy-dom
/* The keyboard, focus and ARIA contract of the document widgets built on UI SDK: tabs (plain, code, section and
   synced), the package-manager command box, the pill segmented control, expandables, the page-actions menu, copy
   buttons, the document property sheet and OpenAPI responses. UI SDK's warnings fail these tests (vitest.setup.ts). */
import { act, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { click, focus, mount, press, tick, type Mounted } from "../__fixtures__/dom"
import { parseMarkdown } from "../gitbook/parse"
import { MarkdownContent } from "./DocsRenderer"
import { DocPageActions } from "./PageActions"
import { CopyButton } from "./copy"
import { Segmented } from "./controls"
import { DocumentProperties } from "./DocumentProperties"
import { OpenApiOperation } from "../openapi/OpenApiOperation"

let mounted: Mounted | undefined
const render = async (ui: Parameters<typeof mount>[0]) => (mounted = await mount(ui))
afterEach(async () => {
  await mounted?.unmount()
  mounted = undefined
  localStorage.clear()
  vi.unstubAllGlobals()
})

function q<T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector)
  if (!found) throw new Error(`no ${selector}`)
  return found
}
const all = (root: ParentNode, selector: string) => [...root.querySelectorAll<HTMLElement>(selector)]
const selected = (list: Element) => list.querySelector('[role="tab"][aria-selected="true"]')?.textContent

const TABS = '{% tabs %}\n{% tab title="One" %}\nFirst panel\n{% endtab %}\n{% tab title="Two" %}\nSecond panel\n{% endtab %}\n{% tab title="Three" %}\nThird panel\n{% endtab %}\n{% endtabs %}\n'

describe("tabs", () => {
  it("are a named tablist with one tab stop; the arrows, Home and End select a tab and show its panel, labelled by the tab", async () => {
    const { host } = await render(<MarkdownContent markdown={TABS} />)
    const list = q(host, '[role="tablist"]')
    expect(list.getAttribute("aria-label")).toBe("Content tabs")
    const tabs = all(list, '[role="tab"]')
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1])
    const panel = () => q(host, '[role="tabpanel"]:not([hidden])')
    expect(panel().getAttribute("aria-labelledby")).toBe(tabs[0]!.id)
    expect(panel().textContent).toBe("First panel")

    await focus(tabs[0])
    await press("ArrowRight")
    expect(document.activeElement).toBe(tabs[1])
    expect(selected(list)).toBe("Two")
    expect(panel().textContent).toBe("Second panel")
    expect(panel().getAttribute("aria-labelledby")).toBe(tabs[1]!.id)
    expect(tabs[1]!.getAttribute("aria-controls")).toBe(panel().id)
    await press("End")
    expect(selected(list)).toBe("Three")
    await press("ArrowRight")
    expect(selected(list)).toBe("One")
    await press("Home")
    expect(document.activeElement).toBe(tabs[0])
    await click(tabs[2])
    expect(panel().textContent).toBe("Third panel")
    expect(tabs[2]!.hasAttribute("data-selected")).toBe(true)
  })

  it("with a sync key, choosing a tab in one set selects it in every set and remembers it", async () => {
    const synced = TABS.replace("{% tabs %}", '{% tabs sync="lang" %}')
    const { host } = await render(<MarkdownContent markdown={`${synced}\nBetween\n\n${synced}`} />)
    const lists = all(host, '[role="tablist"]')
    expect(lists).toHaveLength(2)
    expect(lists[0]!.getAttribute("aria-label")).toBe("lang options")
    await focus(q(lists[0]!, '[role="tab"]'))
    await press("ArrowRight")
    expect(lists.map(selected)).toEqual(["Two", "Two"])
    expect(localStorage.getItem("docstream:tabs:lang")).toBe("Two")
    await click(all(lists[1]!, '[role="tab"]')[2])
    expect(lists.map(selected)).toEqual(["Three", "Three"])
  })

  it("with a title, are a section named by its heading, with pill tabs", async () => {
    const titled = TABS.replace("{% tabs %}", '{% tabs title="Install" %}')
    const { host } = await render(<MarkdownContent markdown={titled} />)
    const section = q(host, "section.docs-tabs-section")
    expect(section.getAttribute("aria-labelledby")).toBe("install")
    const list = q(section, '[role="tablist"]')
    expect(list.className).toBe("docs-pills")
    expect(list.getAttribute("aria-label")).toBe("Install: options")
    expect(all(list, ".docs-pill")).toHaveLength(3)
    expect(list.querySelector(".docs-pill-indicator")?.getAttribute("role")).toBe("presentation")
    await focus(all(list, '[role="tab"]')[0])
    await press("ArrowLeft")
    expect(selected(list)).toBe("Three")
    expect(q(section, '[role="tabpanel"]:not([hidden])').textContent).toBe("Third panel")
  })

  it("made only of code blocks become one code block whose copy button copies the selected tab", async () => {
    const code = '{% tabs %}\n{% tab title="npm" %}\n```sh\nnpm i x\n```\n{% endtab %}\n{% tab title="pnpm" %}\n```sh\npnpm add x\n```\n{% endtab %}\n{% endtabs %}\n'
    const { host } = await render(<MarkdownContent markdown={code} />)
    const list = q(host, ".docs-tabs-code-head [role=tablist]")
    await focus(q(list, '[role="tab"]'))
    await press("ArrowRight")
    expect(q(host, '[role="tabpanel"]:not([hidden])').textContent).toContain("pnpm add x")
    expect(q(host, ".docs-copy").getAttribute("aria-labelledby")).toBeTruthy()
    expect(document.getElementById(q(host, ".docs-copy").getAttribute("aria-labelledby")!)!.textContent).toBe("Copy pnpm")
  })

  it("the command box picks the package manager page-wide", async () => {
    const { host } = await render(<MarkdownContent markdown={"{% command %}npm install x{% endcommand %}\n\n{% command %}npm install y{% endcommand %}\n"} />)
    const lists = all(host, '[role="tablist"]')
    expect(lists.map((l) => l.getAttribute("aria-label"))).toEqual(["Package manager", "Package manager"])
    await focus(q(lists[0]!, '[role="tab"]'))
    await press("ArrowRight")
    expect(lists.map(selected)).toEqual(["npm", "npm"])
    expect(all(host, ".docs-command").map((box) => box.getAttribute("data-pm"))).toEqual(["npm", "npm"])
    expect(q(host, '[role="tabpanel"]:not([hidden])').textContent).toContain("npm install x")
  })
})

describe("Segmented", () => {
  it("is a named radio group with one tab stop; the arrows check the next item", async () => {
    function Fixture() {
      const [value, setValue] = useState<"a" | "b" | "c">("b")
      return <Segmented label="Width" value={value} onChange={setValue} options={[{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }]} />
    }
    const { host } = await render(<Fixture />)
    const group = q(host, '[role="radiogroup"]')
    expect(group.getAttribute("aria-label")).toBe("Width")
    const radios = all(group, '[role="radio"]')
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"])
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1])
    await focus(radios[1])
    await press("ArrowRight")
    expect(document.activeElement).toBe(radios[2])
    expect(radios[2]!.getAttribute("aria-checked")).toBe("true")
    expect(radios[2]!.hasAttribute("data-checked")).toBe(true)
  })
})

describe("expandables", () => {
  it("are a disclosure button whose closed panel stays findable in the page", async () => {
    const { host } = await render(<MarkdownContent markdown={"<details>\n<summary>More</summary>\n\nHidden text\n\n</details>\n"} />)
    const trigger = q(host, ".docs-expandable-trigger")
    expect(trigger.tagName).toBe("BUTTON")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    const panel = q(host, ".docs-expandable-body")
    expect(panel.getAttribute("hidden")).toBe("until-found")
    expect(panel.textContent).toContain("Hidden text")
    expect(trigger.getAttribute("aria-controls")).toBe(panel.id)
    await focus(trigger)
    await press("Enter")
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(trigger.hasAttribute("data-open")).toBe(true)
    expect(panel.hasAttribute("hidden")).toBe(false)
    await press(" ")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
  })
})

describe("DocPageActions", () => {
  it("opens a named menu from its trigger, moves with the arrows, closes on Escape and returns focus", async () => {
    const { host } = await render(<DocPageActions markdown="# Page" markdownUrl="/md/page.md" />)
    const trigger = q(host, ".docs-page-actions-more")
    expect(trigger.getAttribute("aria-label")).toBe("More page actions")
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    await focus(trigger)
    await press("ArrowDown")
    const menu = q(host, '[role="menu"]')
    expect(menu.getAttribute("aria-label")).toBe("Page actions")
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    const items = all(menu, '[role="menuitem"]')
    expect(items.map((i) => i.querySelector(".docs-page-actions-label")!.textContent)).toEqual(["Copy as Markdown", "View as Markdown", "Open in ChatGPT", "Open in Claude"])
    expect(items[1]!.tagName).toBe("A")
    expect(items[1]!.getAttribute("href")).toBe("/md/page.md")
    expect(items[0]!.hasAttribute("data-highlighted")).toBe(true)
    await press("ArrowDown")
    expect(items[1]!.hasAttribute("data-highlighted")).toBe(true)
    await press("End")
    expect(items[3]!.hasAttribute("data-highlighted")).toBe(true)
    await press("Escape")
    expect(host.querySelector('[role="menu"][data-open]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("runs an action item and closes", async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
    const { host } = await render(<DocPageActions markdown="# Page" actions={["copy"]} />)
    await click(q(host, ".docs-page-actions-more"))
    await click(q(host, '[role="menuitem"]'))
    await tick(10)
    expect(writeText).toHaveBeenCalledWith("# Page")
    expect(host.querySelector('[role="menu"][data-open]')).toBeNull()
  })
})

describe("CopyButton", () => {
  // Named by its tooltip, and by its own aria-label with the same words, which is there before the tooltip ever shows.
  it("is named by its tooltip and its own label alike, which say Copied after a copy", async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } })
    const { host } = await render(<CopyButton text="npm i x" label="Copy command" />)
    const button = q(host, "button.docs-copy")
    const name = () => document.getElementById(button.getAttribute("aria-labelledby")!)!.textContent
    expect(name()).toBe("Copy command")
    expect(button.getAttribute("aria-label")).toBe("Copy command")
    await click(button)
    expect(writeText).toHaveBeenCalledWith("npm i x")
    expect(name()).toBe("Copied")
    expect(button.getAttribute("aria-label")).toBe("Copied")
    expect(button.hasAttribute("data-copied")).toBe(true)
  })
})

describe("DocumentProperties", () => {
  const properties = parseMarkdown('---\ntitle: "Note"\npriority: 4\ndone: false\n---\n\nBody\n').properties!

  it("is a disclosure whose sheet stays findable while closed; boolean properties are named checkboxes", async () => {
    const onChange = vi.fn()
    const { host } = await render(<DocumentProperties properties={properties} onChange={onChange} />)
    const trigger = q(host, ".docs-properties-trigger")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(q(host, ".docs-properties-panel").getAttribute("hidden")).toBe("until-found")
    await click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    const checkbox = q(host, '[role="checkbox"]')
    expect(checkbox.getAttribute("aria-label")).toBe("done")
    expect(checkbox.getAttribute("aria-checked")).toBe("false")
    await focus(checkbox)
    await press(" ")
    expect(onChange).toHaveBeenCalledTimes(1)
    const number = q<HTMLInputElement>(host, 'input[aria-label="priority"]')
    expect(number.type).toBe("number")
  })
})

describe("OpenApiOperation responses", () => {
  it("are disclosures, the success response open", async () => {
    const spec = {
      openapi: "3.0.0",
      paths: { "/pets": { get: { summary: "List pets", responses: { "200": { description: "OK" }, "404": { description: "Missing" } } } } },
    }
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(spec), { headers: { "content-type": "application/json" } })))
    const { host } = await render(<OpenApiOperation specUrl="https://api.test/a11y-spec.json" path="/pets" method="get" />)
    for (let i = 0; i < 20 && !host.querySelector(".oas-response-trigger"); i++) await tick(10)
    const triggers = all(host, ".oas-response-trigger")
    expect(triggers.map((t) => t.getAttribute("aria-expanded"))).toEqual(["true", "false"])
    await focus(triggers[1])
    await press("Enter")
    expect(triggers[1]!.getAttribute("aria-expanded")).toBe("true")
    await act(async () => {})
  })
})

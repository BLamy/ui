// @vitest-environment happy-dom
/* The keyboard, focus and ARIA contract of the player's controls, each of them a UI SDK component (or, for the
   docked panel and the Network table, a primitive of its core): what a person presses and what a screen reader hears. */
import { act, forwardRef, useImperativeHandle, type ReactElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { click, focus, mount as mountDom, press, tick, type Mounted } from "../__fixtures__/dom"
import { replayDemoEvents } from "./demo"
import { ReplayPreview } from "./ReplayPreview"
import type { ReplayStageHandle, ReplayStageProps } from "./stage-types"

declare global {
  // eslint-disable-next-line no-var
  var __UI_SDK_STRICT__: boolean | undefined
}
globalThis.__UI_SDK_STRICT__ = true

vi.mock("gpu-lexer", () => ({ parse: async () => [] }))

// The rrweb stage needs a browser: a stub that reports ready and records what the chrome asks of it.
const stage = vi.hoisted(() => ({ calls: [] as string[], props: null as null | Record<string, unknown>, time: 8000, doc: null as Document | null }))
vi.mock("./ReplayStage", () => ({
  preloadReplayStage: () => Promise.resolve(),
  ReplayStage: forwardRef<ReplayStageHandle, ReplayStageProps>(function StubStage(props, ref) {
    stage.props = props as unknown as Record<string, unknown>
    useImperativeHandle(ref, () => ({
      play: (o) => void stage.calls.push(`play:${o ?? ""}`),
      pause: (o) => void stage.calls.push(`pause:${o ?? ""}`),
      seek: (ms) => void stage.calls.push(`seek:${ms}`),
      toggle: () => void stage.calls.push("toggle"),
      getCurrentTime: () => stage.time,
      getDuration: () => 9000,
      isPlaying: () => false,
      getDocument: () => stage.doc,
    }))
    return (
      <div data-stub-stage="">
        <button type="button" data-ready tabIndex={-1} onClick={() => { props.onReady?.({ duration: 9000, width: 1280, height: 800 }); props.onTimeUpdate?.(stage.time) }} />
        {props.overlay}
      </div>
    )
  }),
}))

let mounted: Mounted | undefined
beforeEach(() => {
  stage.calls.length = 0
  stage.time = 8000
  stage.doc = null
})
afterEach(async () => {
  await mounted?.unmount()
  mounted = undefined
})

/** Mounts a player and makes its (stub) stage ready. Returns the player's root. */
async function player(element: ReactElement, { ready = true } = {}) {
  mounted = await mountDom(element)
  if (ready) await act(async () => mounted!.host.querySelector<HTMLElement>("[data-ready]")!.click())
  return mounted.host.querySelector<HTMLElement>('[data-slot="replay-preview"]')!
}
const q = <T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string) => root.querySelector<T>(selector)!
const all = (root: ParentNode, selector: string) => [...root.querySelectorAll<HTMLElement>(selector)]
const panelOf = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-slot="replay-devtools"]')
const selectedTab = (root: ParentNode) => root.querySelector('[role=tab][aria-selected="true"]')?.textContent

describe("the scrubber (Slider)", () => {
  it("is a named slider in the scrubber, with the time as its value text, disabled until the stage is ready", async () => {
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} />, { ready: false })
    const scrubber = q(el, '[data-slot="replay-preview-scrubber"]')
    const slider = q<HTMLInputElement>(scrubber, '[data-slot="slider"] [role="slider"]')
    expect(slider.getAttribute("aria-label")).toBe("Playback position")
    expect(slider.disabled).toBe(true)
    expect(q(scrubber, '[data-slot="slider"]').hasAttribute("data-disabled")).toBe(true)
    await act(async () => q(el, "[data-ready]").click())
    expect(slider.disabled).toBe(false)
    expect(q(scrubber, '[data-slot="slider"]').hasAttribute("data-disabled")).toBe(false)
    expect([slider.min, slider.step, slider.value]).toEqual(["0", "10", "8000"])
    expect(slider.getAttribute("aria-valuetext")).toMatch(/^0:08 of 0:0\d$/)
    // The fill is painted from the same playhead the thumb sits at.
    expect(q(scrubber, '[data-slot="slider-track"]').style.getPropertyValue("--replay-progress")).toMatch(/^9\d(\.\d+)?%$/)
    expect(scrubber.querySelector('[data-slot="slider-thumb"]')).not.toBeNull()
  })

  it("its keys seek: arrows by a step, Page Up and Down by 5 s, Home and End to the ends, with focus staying on it", async () => {
    stage.time = 6000
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} />)
    const slider = q<HTMLInputElement>(el, '[data-slot="replay-preview-scrubber"] [role="slider"]')
    await focus(slider)
    await press("ArrowLeft")
    expect(stage.calls.at(-1)).toBe("seek:5990")
    await press("ArrowUp")
    expect(stage.calls.at(-1)).toBe("seek:6010")
    await press("PageDown")
    expect(stage.calls.at(-1)).toBe("seek:1000")
    await press("PageUp")
    expect(Number(stage.calls.at(-1)!.slice(5))).toBeGreaterThan(8000)
    await press("Home")
    expect(stage.calls.at(-1)).toBe("seek:0")
    expect(document.activeElement).toBe(slider)
    // The player's own J and L still work from the slider.
    await press("j")
    expect(stage.calls.at(-1)).toBe("seek:0")
    expect(stage.calls.filter((c) => c === "toggle")).toHaveLength(0)
  })
})

describe("the captions button (Toggle)", () => {
  const captions = "WEBVTT\n\n00:00.000 --> 00:09.000\nThe checkout fails\n"
  it("says whether captions are on, and Space or Enter turns them off and on", async () => {
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} captions={captions} />)
    const cc = q(el, '[data-part="replay-preview-captions"]')
    expect(cc.getAttribute("data-slot")).toBe("toggle")
    expect(cc.getAttribute("aria-label")).toBe("Captions")
    expect(cc.getAttribute("aria-pressed")).toBe("true")
    expect(cc.hasAttribute("data-pressed")).toBe(true)
    expect(el.querySelector('[data-slot="replay-preview-captions-track"]')!.textContent).toBe("The checkout fails")
    await focus(cc)
    await press(" ")
    expect(cc.getAttribute("aria-pressed")).toBe("false")
    expect(cc.hasAttribute("data-pressed")).toBe(false)
    expect(el.querySelector('[data-slot="replay-preview-captions-track"]')).toBeNull()
    // Space on the button is the button's, not the player's play/pause.
    expect(stage.calls).toEqual([])
    await press("Enter")
    expect(cc.getAttribute("aria-pressed")).toBe("true")
    expect(document.activeElement).toBe(cc)
  })
})

describe("the Console and Network buttons (ToggleGroup)", () => {
  it("are one named group with one tab stop; the arrows move between them and a press opens or closes the panel", async () => {
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} />)
    const group = q(el, '[data-part="replay-devtools-buttons"]')
    expect(group.getAttribute("role")).toBe("group")
    expect(group.getAttribute("aria-label")).toBe("DevTools")
    const [consoleButton, network] = all(group, '[data-part="replay-devtools-button"]') as [HTMLElement, HTMLElement]
    expect([consoleButton.getAttribute("data-slot"), network.getAttribute("data-slot")]).toEqual(["toggle", "toggle"])
    expect([consoleButton.getAttribute("aria-pressed"), network.getAttribute("aria-pressed")]).toEqual(["false", "false"])
    expect(all(group, '[tabindex="0"]')).toHaveLength(1)

    await focus(consoleButton)
    await press("ArrowRight")
    expect(document.activeElement).toBe(network)
    await press("Enter")
    expect(network.getAttribute("aria-pressed")).toBe("true")
    expect(network.hasAttribute("data-pressed")).toBe(true)
    expect(consoleButton.getAttribute("aria-pressed")).toBe("false")
    // Opened by the user: focus moves into the panel, a region named DevTools.
    const panel = panelOf(el)!
    expect(panel.tagName).toBe("SECTION")
    expect(panel.getAttribute("aria-label")).toBe("DevTools")
    expect(panel.getAttribute("role")).toBeNull()
    expect(document.activeElement).toBe(panel)
    expect(selectedTab(panel)).toMatch(/^Network/)

    // The other button switches the tab; pressing the pressed one closes the panel.
    await click(consoleButton)
    expect([consoleButton.getAttribute("aria-pressed"), network.getAttribute("aria-pressed")]).toEqual(["true", "false"])
    expect(selectedTab(panelOf(el)!)).toBe("Console1")
    await focus(consoleButton)
    await press(" ")
    expect(panelOf(el)).toBeNull()
    expect(consoleButton.getAttribute("aria-pressed")).toBe("false")
    expect(stage.calls).toEqual([])
  })

  it("Escape in the panel closes it and hands focus back to the player, whose keys work again", async () => {
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} defaultDevtoolsTab="console" />)
    const panel = panelOf(el)!
    await focus(q(panel, '[role=tab][aria-selected="true"]'))
    // Inside the panel the player's keys are the panel's.
    await press("k")
    expect(stage.calls).toEqual([])
    await press("Escape")
    expect(panelOf(el)).toBeNull()
    expect(document.activeElement).toBe(el)
    await press("k")
    expect(stage.calls).toEqual(["toggle"])
  })
})

describe("the DevTools panel", () => {
  it("its tabs are a named tablist: the arrows, Home and End select a tab and show its panel, labelled by the tab", async () => {
    stage.doc = document.implementation.createHTMLDocument("page")
    const evidence = { sources: [{ path: "src/a.ts", lines: [{ line: 1, text: "a()" }] }] }
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} defaultDevtoolsTab="console" evidence={evidence} />)
    const panel = panelOf(el)!
    const list = q(panel, '[data-part="replay-devtools-tablist"]')
    expect(list.getAttribute("role")).toBe("tablist")
    expect(list.getAttribute("aria-label")).toBe("DevTools panels")
    const tabs = all(list, "[role=tab]")
    expect(tabs.map((t) => t.textContent)).toEqual(["Elements", "Console1", "Sources", "Network1"])
    expect(tabs.map((t) => t.getAttribute("tabindex"))).toEqual(["-1", "0", "-1", "-1"])
    const pane = () => q(panel, '[data-part="replay-devtools-pane"]')
    expect(pane().getAttribute("role")).toBe("tabpanel")
    expect(pane().getAttribute("data-pane")).toBe("console")
    expect(pane().getAttribute("aria-labelledby")).toBe(tabs[1]!.id)
    expect(tabs[1]!.getAttribute("aria-controls")).toBe(pane().id)

    await focus(tabs[1])
    await press("ArrowRight")
    expect(document.activeElement).toBe(tabs[2])
    expect(selectedTab(panel)).toBe("Sources")
    expect(pane().getAttribute("data-pane")).toBe("sources")
    expect(pane().getAttribute("aria-labelledby")).toBe(tabs[2]!.id)
    await press("End")
    expect(pane().getAttribute("data-pane")).toBe("network")
    await press("Home")
    expect(pane().getAttribute("data-pane")).toBe("elements")
    await press("ArrowLeft")
    expect(selectedTab(panel)).toMatch(/^Network/)
    expect(tabs[3]!.hasAttribute("data-selected")).toBe(true)
    // None of it reached the player.
    expect(stage.calls).toEqual([])
  })

  it("its top edge is a separator: the arrow keys resize the panel", async () => {
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} defaultDevtoolsTab="console" />)
    const panel = panelOf(el)!
    const handle = q(panel, '[data-slot="replay-devtools-resize"]')
    expect(handle.getAttribute("role")).toBe("separator")
    expect(handle.getAttribute("aria-label")).toBe("Resize DevTools")
    expect(handle.getAttribute("aria-controls")).toBe(panel.id)
    expect(handle.getAttribute("aria-valuenow")).toBe("58")
    expect(panel.style.getPropertyValue("--replay-devtools-height")).toBe("58%")
    await focus(handle)
    await press("ArrowUp")
    expect(handle.getAttribute("aria-valuenow")).toBe("60")
    expect(panel.style.getPropertyValue("--replay-devtools-height")).toBe("60%")
    await press("End")
    expect(handle.getAttribute("aria-valuenow")).toBe("92")
    await press("Home")
    expect(panel.style.getPropertyValue("--replay-devtools-height")).toBe("22%")
    expect(document.activeElement).toBe(handle)
    // Arrow keys on the separator never seek the recording.
    expect(stage.calls).toEqual([])
  })
})

describe("the Console pane", () => {
  it("the level filter is a named select: it opens from the keyboard, a choice filters the log, and Escape closes only the list", async () => {
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} defaultDevtoolsTab="console" />)
    const panel = panelOf(el)!
    const levels = () => all(panel, '[data-slot="replay-devtools-message"]').map((m) => m.getAttribute("data-level"))
    expect(levels()).toEqual(["log", "info", "info", "warn", "error"])
    const trigger = q(panel, '[data-slot="select-trigger"]')
    expect(trigger.getAttribute("role")).toBe("combobox")
    expect(trigger.getAttribute("aria-label")).toBe("Log levels")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(trigger.textContent).toBe("All levels")

    await focus(trigger)
    await press("Enter")
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    const list = q(panel, '[data-slot="select-content"]')
    expect(list.getAttribute("role")).toBe("listbox")
    expect(all(list, "[role=option]").map((o) => o.textContent)).toEqual(["All levels", "Errors", "Warnings", "Info"])
    await press("Escape")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    // The panel is still there: that Escape was the list's.
    expect(panelOf(el)).not.toBeNull()
    expect(document.activeElement).toBe(trigger)

    await press("Enter")
    await press("ArrowDown")
    await press("Enter")
    expect(trigger.textContent).toBe("Errors")
    expect(levels()).toEqual(["error"])
    expect(stage.calls).toEqual([])
  })

  it("a message with a stack trace is a disclosure: Enter shows its frames and hides them again", async () => {
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} defaultDevtoolsTab="console" />)
    const error = q(panelOf(el)!, '[data-slot="replay-devtools-message"][data-level="error"]')
    const trigger = q(error, '[data-slot="collapsible-trigger"]')
    expect(trigger.tagName).toBe("BUTTON")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(trigger.textContent).toContain("Uncaught TypeError")
    expect(error.querySelector('[data-part="trace"]')).toBeNull()
    await focus(trigger)
    await press("Enter")
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    const trace = q(error, '[data-part="trace"]')
    expect(trace.tagName).toBe("OL")
    expect(trigger.getAttribute("aria-controls")).toBe(trace.id)
    expect(trace.querySelectorAll("li").length).toBeGreaterThan(0)
    await press(" ")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(document.activeElement).toBe(trigger)
    // A message without one is plain text, not a button.
    expect(q(panelOf(el)!, '[data-slot="replay-devtools-message"][data-level="log"]').querySelector("button[aria-expanded]")).toBeNull()
  })

  it("the log is a named live region", async () => {
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} defaultDevtoolsTab="console" />)
    const log = q(panelOf(el)!, '[data-slot="replay-devtools-list"]')
    expect(log.getAttribute("role")).toBe("log")
    expect(log.getAttribute("aria-label")).toBe("Console messages")
  })
})

describe("the Network pane", () => {
  it("the request types are a named radio group: the arrows check the next one and filter the table", async () => {
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} defaultDevtoolsTab="network" />)
    const panel = panelOf(el)!
    const group = q(panel, '[data-part="replay-devtools-chips"]')
    expect(group.getAttribute("role")).toBe("radiogroup")
    expect(group.getAttribute("aria-label")).toBe("Request types")
    const radios = all(group, "[role=radio]")
    expect(radios.map((r) => r.textContent)).toEqual(["All", "Fetch/XHR", "Failed"])
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"])
    expect(radios.map((r) => r.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"])
    const names = () => all(panel, "tbody tr").map((r) => r.querySelector("td")!.textContent)
    expect(names()).toHaveLength(8)
    await focus(radios[0])
    await press("ArrowRight")
    expect(document.activeElement).toBe(radios[1])
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"])
    expect(radios[1]!.hasAttribute("data-checked")).toBe(true)
    expect(names()).toEqual(["products?collection=trail", "cart", "cart", "validate?code=FALL25", "checkout"])
    await press("ArrowRight")
    expect(names()).toEqual(["checkout"])
    await click(radios[0])
    expect(names()).toHaveLength(8)
  })

  it("the table is a named grid with one tab stop: the arrows move between requests, Enter opens one's details and closes them", async () => {
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} defaultDevtoolsTab="network" />)
    const panel = panelOf(el)!
    const table = q(panel, '[data-slot="replay-devtools-table"]')
    expect(table.tagName).toBe("TABLE")
    expect(table.getAttribute("role")).toBe("grid")
    expect(table.getAttribute("aria-label")).toBe("Requests")
    const rows = all(table, "tbody tr")
    expect(rows.every((r) => r.getAttribute("role") === "row" && r.getAttribute("data-slot") === "replay-devtools-table-row")).toBe(true)
    expect(rows.map((r) => r.getAttribute("aria-selected"))).toEqual(Array(8).fill("false"))
    expect(rows.filter((r) => r.getAttribute("tabindex") === "0")).toEqual([rows[0]])

    await focus(rows[0])
    await press("ArrowDown")
    expect(document.activeElement).toBe(rows[1])
    await press("End")
    expect(document.activeElement).toBe(rows[7])
    expect(panel.querySelector('[data-slot="replay-devtools-detail"]')).toBeNull()
    await press("Enter")
    expect(rows[7]!.getAttribute("aria-selected")).toBe("true")
    expect(rows[7]!.hasAttribute("data-selected")).toBe(true)
    expect(q(panel, '[data-slot="replay-devtools-detail"]').textContent).toContain("Request URL/api/checkout")
    // The row keeps focus and the tab stop while its details are open.
    expect(document.activeElement).toBe(all(table, "tbody tr")[7])
    await press("Home")
    await press(" ")
    expect(all(table, "tbody tr").map((r) => r.getAttribute("aria-selected"))).toEqual(["true", ...Array(7).fill("false")])
    await press(" ")
    expect(panel.querySelector('[data-slot="replay-devtools-detail"]')).toBeNull()
    expect(stage.calls).toEqual([])
  })

  it("a request's details are tabs, and their sections are disclosures that start open", async () => {
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} defaultDevtoolsTab="network" />)
    const panel = panelOf(el)!
    await click(q(panel, "tr[data-failed]"))
    const detail = q(panel, '[data-slot="replay-devtools-detail"]')
    const list = q(detail, "[role=tablist]")
    expect(list.getAttribute("aria-label")).toBe("checkout details")
    const tabs = all(list, "[role=tab]")
    expect(tabs.map((t) => t.textContent)).toEqual(["Headers", "Payload", "Response"])
    const body = () => q(detail, '[data-part="replay-devtools-detail-body"]')
    expect(body().getAttribute("role")).toBe("tabpanel")
    expect(body().getAttribute("aria-labelledby")).toBe(tabs[0]!.id)

    const section = q(body(), '[data-part="replay-devtools-section"]')
    const trigger = q(section, '[data-slot="collapsible-trigger"]')
    expect(trigger.textContent).toBe("General")
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(section.hasAttribute("data-open")).toBe(true)
    expect(q(section, "dl").textContent).toContain("Request URL")
    await focus(trigger)
    await press("Enter")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(section.hasAttribute("data-closed")).toBe(true)
    expect(section.querySelector("dl")).toBeNull()
    await press("Enter")
    expect(q(section, "dl").textContent).toContain("Request URL")

    await focus(tabs[0])
    await press("ArrowRight")
    expect(tabs[1]!.getAttribute("aria-selected")).toBe("true")
    expect(body().getAttribute("aria-labelledby")).toBe(tabs[1]!.id)
    await press("ArrowRight")
    expect(body().textContent).toContain("internal_error")
    await click(q(detail, '[aria-label="Close request details"]'))
    expect(panel.querySelector('[data-slot="replay-devtools-detail"]')).toBeNull()
  })
})

describe("the Elements pane (Tree)", () => {
  function page() {
    const doc = document.implementation.createHTMLDocument("page")
    doc.body.innerHTML = '<main><form><input placeholder="Search tasks" class="field"><button>Go</button></form><p>Hello there</p></main>'
    for (const el of doc.querySelectorAll("*")) el.getBoundingClientRect = () => ({ left: 10, top: 40, width: 100, height: 20, right: 110, bottom: 60, x: 10, y: 40, toJSON() {} }) as DOMRect
    return doc
  }
  const label = (item: Element) => item.querySelector(':scope > [data-slot="tree-label"]')!.textContent

  it("is a named tree with one tab stop: Right opens a branch, Down and Up move through the rows, Left closes or goes to the parent", async () => {
    stage.doc = page()
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} defaultDevtoolsTab="elements" />)
    const panel = panelOf(el)!
    const tree = q(panel, '[data-slot="replay-devtools-elements"] [data-slot="tree"]')
    expect(tree.getAttribute("role")).toBe("tree")
    expect(tree.getAttribute("aria-label")).toBe("Elements")
    const items = () => all(tree, "[role=treeitem]")
    expect(items()).toHaveLength(1)
    const html = items()[0]!
    expect(label(html)).toBe("<html>…</html>")
    expect(html.getAttribute("aria-expanded")).toBe("false")
    expect(html.getAttribute("aria-level")).toBe("1")
    expect(html.getAttribute("tabindex")).toBe("0")

    await focus(html)
    await press("ArrowRight")
    expect(html.getAttribute("aria-expanded")).toBe("true")
    expect(items().map(label)).toEqual(["<html>", "<head></head>", "<body>…</body>"])
    await press("ArrowDown")
    await press("ArrowDown")
    expect(document.activeElement).toBe(items()[2])
    expect(items().filter((i) => i.getAttribute("tabindex") === "0")).toEqual([items()[2]])
    // The row the keyboard is on is outlined on the page, as a hovered one is.
    expect(q(el, '[data-slot="replay-preview-highlight"]').textContent).toBe("body 100 × 20")
    await press("ArrowRight")
    await press("ArrowRight")
    expect(label(document.activeElement!)).toBe("<main>…</main>")
    expect(document.activeElement!.getAttribute("aria-level")).toBe("3")
    await press("ArrowLeft")
    expect(label(document.activeElement!)).toBe("<body>")
    await press("ArrowLeft")
    expect(document.activeElement!.getAttribute("aria-expanded")).toBe("false")
    expect(items()).toHaveLength(3)
    await press("Home")
    expect(document.activeElement).toBe(items()[0])
    expect(stage.calls).toEqual([])
  })

  it("Enter selects the element (its row, the page's outline and the breadcrumb follow); text can be reached but not selected", async () => {
    stage.doc = page()
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} defaultDevtoolsTab="elements" />)
    const tree = q(panelOf(el)!, '[data-slot="tree"]')
    const items = () => all(tree, "[role=treeitem]")
    const rowOf = (text: string) => items().find((i) => label(i).startsWith(text))!
    await focus(items()[0])
    for (const key of ["ArrowRight", "End", "ArrowRight", "ArrowDown", "ArrowRight"]) await press(key)
    // html > body > main is open now: its form and paragraph show.
    expect(items().map(label)).toEqual(["<html>", "<head></head>", "<body>", "<main>", "<form>…</form>", "<p>Hello there</p>"])
    expect(items().map((i) => i.getAttribute("aria-selected"))).toEqual(Array(6).fill("false"))
    await press("End")
    await press("Enter")
    const p = rowOf("<p>")
    expect(p.getAttribute("aria-selected")).toBe("true")
    expect(q(p, '[data-part="replay-devtools-node"]').hasAttribute("data-selected")).toBe(true)
    // A leaf has no expanded state.
    expect(p.hasAttribute("aria-expanded")).toBe(false)
    expect(q(el, '[data-slot="replay-preview-highlight"]').textContent).toBe("p 100 × 20")
    const crumbs = q(panelOf(el)!, '[data-slot="replay-devtools-breadcrumb"]')
    expect(crumbs.tagName).toBe("NAV")
    expect(crumbs.textContent).toBe("htmlbodymainp")
    expect(q(crumbs, "[aria-current]").textContent).toBe("p")

    // Space on the selected row leaves it selected: the page always has its selection.
    await press(" ")
    expect(rowOf("<p>").getAttribute("aria-selected")).toBe("true")
    // A breadcrumb selects an ancestor.
    await click(all(crumbs, "button")[2])
    expect(rowOf("<main>").getAttribute("aria-selected")).toBe("true")
    expect(rowOf("<p>").getAttribute("aria-selected")).toBe("false")
  })

  it("a text node is a row the arrows reach, and Enter on it selects nothing", async () => {
    const doc = document.implementation.createHTMLDocument("page")
    doc.body.innerHTML = "<div>Some text that is long enough to get a row of its own, past the eighty characters an inline one may have<b>bold</b></div>"
    stage.doc = doc
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} defaultDevtoolsTab="elements" />)
    const tree = q(panelOf(el)!, '[data-slot="tree"]')
    const items = () => all(tree, "[role=treeitem]")
    await focus(items()[0])
    for (const key of ["ArrowRight", "End", "ArrowRight", "ArrowDown", "ArrowRight", "ArrowDown"]) await press(key)
    const text = document.activeElement as HTMLElement
    expect(text.getAttribute("role")).toBe("treeitem")
    expect(q(text, '[data-part="replay-devtools-node"]').getAttribute("data-kind")).toBe("text")
    await press("Enter")
    expect(items().map((i) => i.getAttribute("aria-selected"))).toEqual(Array(items().length).fill("false"))
    // The closing tag is drawn, but it's nothing to a screen reader.
    expect(q(tree, '[data-kind="close"]').getAttribute("aria-hidden")).toBe("true")
  })
})

describe("the Sources pane", () => {
  const evidence = {
    sources: [
      { path: "https://shop.test/src/checkout.ts", lines: [{ line: 87, text: "const total = res.total" }] },
      { path: "https://shop.test/src/cart.ts", lines: [{ line: 3, text: "addToCart()" }] },
    ],
  }
  it("the files are vertical tabs beside the code: Down shows the next file, whose panel the tab labels", async () => {
    const el = await player(<ReplayPreview events={replayDemoEvents} lazy={false} defaultDevtoolsTab="sources" evidence={evidence} />)
    const panel = panelOf(el)!
    const list = q(panel, '[data-slot="replay-devtools-files"] [role=tablist]')
    expect(list.getAttribute("aria-label")).toBe("Files")
    expect(list.getAttribute("aria-orientation")).toBe("vertical")
    const files = all(list, "[role=tab]")
    expect(files.map((f) => f.textContent)).toEqual(["checkout.ts", "cart.ts"])
    expect(files.map((f) => f.getAttribute("aria-selected"))).toEqual(["true", "false"])
    const code = () => q(panel, '[data-part="replay-devtools-code"]')
    expect(code().getAttribute("role")).toBe("tabpanel")
    expect(code().getAttribute("aria-labelledby")).toBe(files[0]!.id)
    expect(code().textContent).toContain("const total = res.total")

    await focus(files[0])
    // Left and Right are for a horizontal list: here they do nothing.
    await press("ArrowRight")
    expect(files[0]!.getAttribute("aria-selected")).toBe("true")
    await press("ArrowDown")
    expect(document.activeElement).toBe(files[1])
    expect(files.map((f) => f.getAttribute("aria-selected"))).toEqual(["false", "true"])
    expect(files[1]!.hasAttribute("data-selected")).toBe(true)
    expect(code().getAttribute("aria-labelledby")).toBe(files[1]!.id)
    expect(code().textContent).toContain("addToCart()")
    // The DevTools tab bar above is its own list: Sources is still its tab.
    expect(q(panel, '[data-part="replay-devtools-tablist"] [aria-selected="true"]').textContent).toBe("Sources")
    await tick()
  })
})

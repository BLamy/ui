// @vitest-environment happy-dom
// react-dom is installed (a peer of our deps) but its types are not; the tests only need these functions.
// @ts-ignore
import { renderToString as untypedRenderToString } from "react-dom/server"
// @ts-ignore
import { createRoot as untypedCreateRoot } from "react-dom/client"
import { act, forwardRef, useImperativeHandle, type ReactElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { replayDemoEvents } from "./demo"
import { getReplayMeta } from "./markers"
import { ReplayPreview, formatReplayTime } from "./ReplayPreview"
import type { ReplayPreviewHandle } from "./ReplayPreview"
import type { ReplayStageHandle, ReplayStageProps } from "./stage-types"

const renderToString = untypedRenderToString as (element: ReactElement) => string
const createRoot = untypedCreateRoot as (el: Element) => { render(node: ReactElement): void; unmount(): void }

// gpu-lexer needs WebGPU: a stand-in that marks `const` a keyword and identifiers before "(" functions.
vi.mock("gpu-lexer", () => ({
  parse: async (code: string) =>
    [...code.matchAll(/\bconst\b|\w+(?=\()/g)].map((m) => ({ type: m[0] === "const" ? "keyword" : "function", start: m.index!, end: m.index! + m[0].length })),
}))

// The rrweb stage is a lazy boundary around a real Replayer, which needs a browser. Swap it for a stub
// that reports ready and records the calls the player chrome makes.
const stage = vi.hoisted(() => ({
  calls: [] as string[],
  props: null as null | { speed?: number },
  time: 2000,
  doc: null as Document | null,
}))
vi.mock("./ReplayStage", () => ({
  preloadReplayStage: () => Promise.resolve(),
  ReplayStage: forwardRef<ReplayStageHandle, ReplayStageProps>(function StubStage(props, ref) {
    stage.props = props
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
        <button type="button" data-ready onClick={() => { props.onReady?.({ duration: 9000, width: 1280, height: 800 }); props.onTimeUpdate?.(stage.time) }} />
        {props.overlay}
      </div>
    )
  }),
}))

const DEMO_DURATION = getReplayMeta(replayDemoEvents).duration

describe("formatReplayTime", () => {
  it("formats m:ss and clamps below zero", () => {
    expect(formatReplayTime(0)).toBe("0:00")
    expect(formatReplayTime(5400)).toBe("0:05")
    expect(formatReplayTime(65_000)).toBe("1:05")
    expect(formatReplayTime(600_000)).toBe("10:00")
    expect(formatReplayTime(-500)).toBe("0:00")
  })
})

describe("events mode markup", () => {
  it("a plain seek bar by default: no marker rail", () => {
    const html = renderToString(<ReplayPreview events={replayDemoEvents} />)
    expect(html).toContain('data-slot="replay-preview-scrubber"')
    expect(html).not.toContain("replay-preview-markers")
    expect(html).not.toContain("data-kind=")
  })

  it("renders the browser chrome, poster, controls and, with markers, the recording's markers", () => {
    const html = renderToString(<ReplayPreview events={replayDemoEvents} markers />)
    for (const slot of ["replay-preview", "replay-preview-bar", "replay-preview-stage", "replay-preview-poster", "replay-preview-controls", "replay-preview-scrubber", "replay-preview-markers"]) {
      expect(html, slot).toContain(`data-slot="${slot}"`)
    }
    expect(html).toContain('data-state="loading"')
    expect(html).toContain('data-chrome="browser"')
    expect(html).toContain("--replay-ar:1280 / 800")
    expect(html).toContain("shop.northwind.test")
    for (const kind of ["click", "error", "network", "custom"]) expect(html, kind).toContain(`data-kind="${kind}"`)
    expect(html).toContain('aria-label="Playback position"')
  })

  it("chrome=none with controls=false is just the still frame", () => {
    const html = renderToString(<ReplayPreview events={replayDemoEvents} chrome="none" controls={false} className="pointer-events-none w-full" />)
    expect(html).toContain('data-chrome="none"')
    expect(html).not.toContain("replay-preview-bar")
    expect(html).not.toContain("replay-preview-controls")
    expect(html).not.toContain("replay-preview-markers")
    expect(html).toContain("pointer-events-none w-full")
  })

  it("markers={false} hides the rail; custom markers and markerKinds are honoured", () => {
    expect(renderToString(<ReplayPreview events={replayDemoEvents} markers={false} />)).not.toContain("replay-preview-markers")
    const custom = renderToString(
      <ReplayPreview events={replayDemoEvents} markers={[{ id: "f1", kind: "custom", time: 3000, label: "Finding one" }]} />,
    )
    expect(custom).toContain("Finding one at 0:03")
    expect(custom).not.toContain('data-kind="click"')
    const errors = renderToString(<ReplayPreview events={replayDemoEvents} markerKinds={["error"]} />)
    expect(errors).toContain('data-kind="error"')
    expect(errors).not.toContain('data-kind="click"')
  })

  it("an unplayable recording keeps the poster with a note", () => {
    const html = renderToString(<ReplayPreview events={[]} />)
    expect(html).toContain("no page snapshot")
  })
})

describe("player behaviour", () => {
  let host: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    stage.calls.length = 0
    stage.time = 2000
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  async function mount(element: ReactElement) {
    await act(async () => root.render(element))
    await act(async () => host.querySelector<HTMLElement>("[data-ready]")!.click())
    return host.querySelector<HTMLElement>('[data-slot="replay-preview"]')!
  }
  const press = (el: Element, key: string) =>
    act(() => void el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })))

  it("goes from loading to paused once the stage is ready, and the handle drives the stage", async () => {
    const ref: { current: ReplayPreviewHandle | null } = { current: null }
    const times: number[] = []
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} playerRef={ref} onTimeUpdate={(t) => times.push(t)} />)
    expect(el.dataset.state).toBe("paused")
    expect(times).toContain(2000)
    ref.current!.seek(4000)
    ref.current!.toggle()
    ref.current!.play(100)
    ref.current!.pause()
    expect(stage.calls).toEqual(["seek:4000", "toggle", "play:100", "pause:"])
    expect(ref.current!.getCurrentTime()).toBe(2000)
  })

  it("shows Console and Network buttons with what had happened by the playhead, and opens DevTools over the page", async () => {
    stage.time = 8000
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} />)
    const bar = el.querySelector('[data-slot="replay-preview-bar"]')!
    const network = bar.querySelector<HTMLButtonElement>('[data-tab="network"]')!
    const consoleButton = bar.querySelector<HTMLButtonElement>('[data-tab="console"]')!
    expect(network.getAttribute("aria-label")).toBe("Network: 8 requests, 1 failed")
    expect(network.querySelector('[data-part="failed"]')?.textContent).toBe("1")
    expect(consoleButton.getAttribute("aria-label")).toBe("Console: 1 error, 1 warning")

    await act(async () => network.click())
    const panel = el.querySelector<HTMLElement>('[data-slot="replay-devtools"]')!
    expect(panel.closest('[data-slot="replay-preview-stage"]')).toBeTruthy()
    const rows = [...panel.querySelectorAll("tbody tr")]
    expect(rows.map((r) => r.querySelector("td")!.textContent)).toEqual(["trail", "app-4f2a.js", "app-4f2a.css", "products?collection=trail", "cart", "cart", "validate?code=FALL25", "checkout"])
    const failed = panel.querySelector<HTMLElement>("tr[data-failed]")!
    expect(failed.textContent).toContain("500")
    await act(async () => failed.click())
    expect(panel.querySelector('[data-slot="replay-devtools-detail"]')!.textContent).toContain("Request URL/api/checkout")
    const response = [...panel.querySelectorAll<HTMLButtonElement>('[data-slot="replay-devtools-detail-tabs"] [role=tab]')].find((b) => b.textContent === "Response")!
    await act(async () => response.click())
    expect(panel.querySelector('[data-slot="replay-devtools-body"]')!.textContent).toContain('"error": "internal_error"')

    // The panel's own tabs switch to the Console; a message's time seeks the player.
    const tab = [...panel.querySelectorAll<HTMLButtonElement>('[data-slot="replay-devtools-tabs"] [role=tab]')].find((b) => b.textContent?.startsWith("Console"))!
    await act(async () => tab.click())
    const messages = [...el.querySelectorAll('[data-slot="replay-devtools-message"]')]
    expect(messages.map((m) => m.getAttribute("data-level"))).toEqual(["log", "info", "info", "warn", "error"])
    expect(messages.at(-1)!.textContent).toContain("Uncaught TypeError")
    await act(async () => messages[0]!.querySelector<HTMLButtonElement>('[data-part="time"]')!.click())
    expect(stage.calls.at(-1)).toBe("seek:240")

    // Esc closes it, without reaching the player's keys.
    const before = stage.calls.length
    press(el.querySelector('[data-slot="replay-devtools"]')!, "Escape")
    expect(el.querySelector('[data-slot="replay-devtools"]')).toBeNull()
    press(el.querySelector('[data-slot="replay-preview-bar"]')!, "x")
    expect(stage.calls.length).toBe(before)
  })

  it("cuts DevTools at the playhead and can be turned off", async () => {
    stage.time = 2000
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} defaultDevtoolsTab="network" />)
    expect(el.querySelector('[data-tab="network"]')!.getAttribute("aria-label")).toBe("Network: 5 requests, 0 failed")
    // No status bar under the list (the button carries the count).
    expect(el.querySelector('[data-slot="replay-devtools-status"]')).toBeNull()
    expect(el.querySelectorAll('[data-slot="replay-devtools-table"] tbody tr')).toHaveLength(5)
    expect(renderToString(<ReplayPreview events={replayDemoEvents} devtools={false} />)).not.toContain("replay-devtools")
    // Without the browser chrome the buttons sit in the controls row.
    expect(renderToString(<ReplayPreview events={replayDemoEvents} chrome="minimal" />)).toMatch(/replay-preview-controls.*replay-devtools-buttons/s)
  })

  it("follows inspections: DevTools opens on each one's request or message as playback reaches it, without stopping", async () => {
    stage.time = 1000
    const ref: { current: ReplayPreviewHandle | null } = { current: null }
    const inspections = [
      { time: 7600, request: "/api/checkout", label: "Checkout answered 500" },
      { id: "warn", time: 7000, message: "is deprecated", label: "The promo call uses a deprecated field" },
    ]
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} inspections={inspections} playerRef={ref} markers />)
    const playTo = (ms: number) => act(async () => (stage.props as ReplayStageProps).onTimeUpdate?.(ms))
    const panel = () => el.querySelector<HTMLElement>('[data-slot="replay-devtools"]')
    expect(panel()).toBeNull()
    const rail = [...el.querySelectorAll('[data-slot="replay-preview-markers"] button')].map((b) => b.getAttribute("aria-label") ?? "")
    expect(rail.some((l) => l.includes("Checkout answered 500"))).toBe(true)
    expect(rail.some((l) => l.includes("The promo call uses a deprecated field"))).toBe(true)

    // The console inspection: its message is marked, focus stays put.
    await playTo(7100)
    expect(panel()!.querySelector('[role=tab][aria-selected="true"]')!.textContent).toBe("Console")
    expect(panel()!.querySelector('[data-slot="replay-devtools-message"][data-inspected]')!.textContent).toContain("is deprecated")
    expect(panel()!.contains(document.activeElement)).toBe(false)

    // The network one: Network tab, the request selected and its details open. Nothing paused the stage.
    await playTo(7700)
    expect(panel()!.querySelector('[role=tab][aria-selected="true"]')!.textContent).toMatch(/^Network/)
    const row = panel()!.querySelector<HTMLElement>("tbody tr[data-inspected]")!
    expect(row.getAttribute("aria-selected")).toBe("true")
    expect(row.textContent).toContain("checkout")
    expect(panel()!.querySelector('[data-slot="replay-devtools-detail"]')!.textContent).toContain("Request URL/api/checkout")
    expect(stage.calls.filter((c) => c.startsWith("pause"))).toEqual([])

    // Closed, it stays closed through the same inspection; scrubbing back to the previous one opens it again.
    await act(async () => panel()!.querySelector<HTMLButtonElement>('[aria-label="Close DevTools"]')!.click())
    await playTo(8200)
    expect(panel()).toBeNull()
    await playTo(7200)
    expect(panel()!.querySelector('[data-slot="replay-devtools-message"][data-inspected]')!.textContent).toContain("is deprecated")
    // Seeking back before the first inspection (going to another request) leaves the panel open: no flicker.
    await playTo(3000)
    expect(panel()).not.toBeNull()

    // The handle jumps to an inspection by id.
    act(() => ref.current!.inspect("warn"))
    expect(stage.calls.at(-1)).toBe("seek:7000")
    expect(panel()!.querySelector('[role=tab][aria-selected="true"]')!.textContent).toBe("Console")
  })

  it("an auto-opened panel closes after 5 s of playback with no new request, message or inspection; not paused, not once touched", async () => {
    stage.time = 7000
    const inspections = [{ time: 7600, request: "/api/checkout", label: "Checkout answered 500" }]
    // The demo recording's activity stops at 7.9 s (its last console error); it runs to ~8.6 s, so stretch the
    // playhead past the end of the events the way a longer recording would.
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} inspections={inspections} />)
    const props = () => stage.props as ReplayStageProps
    const playTo = (ms: number) => act(async () => props().onTimeUpdate?.(ms))
    const playing = (p: boolean) => act(async () => props().onPlayingChange?.(p))
    const panel = () => el.querySelector<HTMLElement>('[data-slot="replay-devtools"]')

    await playing(true)
    await playTo(7650)
    expect(panel()).not.toBeNull()
    await playTo(12_800) // 4.9 s after the last activity (7.9 s)
    expect(panel()).not.toBeNull()
    await playing(false)
    await playTo(13_500) // paused: stays
    expect(panel()).not.toBeNull()
    await playing(true)
    await playTo(13_600)
    expect(panel()).toBeNull()

    // Reopened by the inspection, then touched: it's the user's now and doesn't close by itself.
    await playTo(7000)
    await playTo(7650)
    expect(panel()).not.toBeNull()
    await act(async () => void panel()!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })))
    await playTo(20_000)
    expect(panel()).not.toBeNull()
  })

  it("autoCloseDevtools={false} keeps an auto-opened panel open", async () => {
    stage.time = 7000
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} inspections={[{ time: 7600, request: "/api/checkout" }]} autoCloseDevtools={false} />)
    const props = () => stage.props as ReplayStageProps
    await act(async () => props().onPlayingChange?.(true))
    await act(async () => props().onTimeUpdate?.(7650))
    await act(async () => props().onTimeUpdate?.(30_000))
    expect(el.querySelector('[data-slot="replay-devtools"]')).not.toBeNull()
  })

  it("an element inspection doesn't open a closed DevTools", async () => {
    stage.time = 1000
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} inspections={[{ time: 1500, element: "main" }]} />)
    await act(async () => (stage.props as ReplayStageProps).onTimeUpdate?.(1600))
    expect(el.querySelector('[data-slot="replay-devtools"]')).toBeNull()
  })

  it("an element inspection highlights it on the page without switching DevTools; Elements opens on it, ancestors expanded", async () => {
    // The replayed page, as the stage's iframe document would hold it.
    const doc = document.implementation.createHTMLDocument("page")
    // rrweb marks replayed hover with `:hover` classes; DevTools shows the page's own.
    doc.body.innerHTML = '<main class=":hover"><form><input placeholder="Search tasks" class="field :hover"><button>Go</button></form></main>'
    const input = doc.querySelector("input")!
    input.getBoundingClientRect = () => ({ left: 40, top: 60, width: 220, height: 32, right: 260, bottom: 92, x: 40, y: 60, toJSON() {} }) as DOMRect
    stage.doc = doc
    stage.time = 1000
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} inspections={[{ time: 1500, element: 'input[placeholder="Search tasks"]', label: "The search box" }]} />)
    await act(async () => el.querySelector<HTMLElement>('[data-slot="replay-devtools-buttons"] button')!.click())
    await act(async () => (stage.props as ReplayStageProps).onTimeUpdate?.(1600))
    const panel = el.querySelector<HTMLElement>('[data-slot="replay-devtools"]')!
    const tab = () => panel.querySelector('[role=tab][aria-selected="true"]')!.textContent
    const opened = tab()
    expect(opened).not.toBe("Elements")
    const highlight = el.querySelector<HTMLElement>('[data-slot="replay-preview-highlight"]')!
    expect(highlight.textContent).toBe("input.field 220 × 32")
    await act(async () => [...panel.querySelectorAll<HTMLElement>("[role=tab]")].find((t) => t.textContent === "Elements")!.click())
    expect(tab()).toBe("Elements")
    const selected = panel.querySelector('[data-slot="replay-devtools-node"][data-selected]')!
    expect(selected.textContent).toBe('<input placeholder="Search tasks" class="field"></input>')
    expect(panel.textContent).not.toContain(":hover")
    // Its ancestors are open: html, body, main and form all show their children.
    expect([...panel.querySelectorAll('[data-slot="replay-devtools-node"][aria-expanded="true"]')].map((n) => n.querySelector('[data-part="tag"]')!.textContent)).toEqual(["<html", "<body", "<main", "<form"])
    expect(panel.querySelector('[data-slot="replay-devtools-breadcrumb"]')!.textContent).toBe("htmlbodymainforminput.field")
    const box = el.querySelector<HTMLElement>('[data-slot="replay-preview-highlight"]')!
    expect([box.style.left, box.style.top, box.style.width, box.style.height]).toEqual(["40px", "60px", "220px", "32px"])
    expect(box.textContent).toBe("input.field 220 × 32")
    // Clicking another node selects it; the tree is the user's now.
    const button = [...panel.querySelectorAll<HTMLElement>('[data-slot="replay-devtools-node"]')].find((n) => n.textContent?.startsWith("<button"))!
    await act(async () => button.click())
    expect(panel.querySelector('[data-slot="replay-devtools-node"][data-selected]')!.textContent).toContain("<button")
    expect(el.querySelector('[data-slot="replay-devtools-status"]')).toBeNull()
    stage.doc = null
  })

  it("a logpoint's first hit opens Sources on its line; its watch value follows the hits in the Watch panel; a screenshot is captured on the way", async () => {
    const evidence = {
      sources: [{ path: "https://shop.test/src/checkout.ts", lines: [{ line: 87, text: "const total = res.total", hits: 2 }, { line: 88, text: "applyPromo(total)", hits: 2 }], focus: [88] }],
      logpoints: [{ path: "https://shop.test/src/checkout.ts", line: 88, expression: "total", hits: [{ at: 2000, value: "130" }, { at: 3000, value: "117" }] }],
      screenshots: [{ at: 2500, src: "/shots/pay.jpg", label: "Pay" }],
    }
    stage.time = 1000
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} evidence={evidence} />)
    const props = () => stage.props as ReplayStageProps
    const playTo = (ms: number) => act(async () => props().onTimeUpdate?.(ms))
    await act(async () => props().onPlayingChange?.(true))
    await playTo(2100)
    const panel = el.querySelector<HTMLElement>('[data-slot="replay-devtools"]')!
    expect(panel.querySelector('[role=tab][aria-selected="true"]')!.textContent).toBe("Sources")
    expect(panel.querySelector('[data-slot="replay-devtools-files"] [aria-current]')!.textContent).toBe("checkout.ts")
    const line88 = () => panel.querySelector('[data-slot="replay-devtools-code-line"][data-line="88"]')!
    expect(line88().hasAttribute("data-focus")).toBe(true)
    expect(line88().hasAttribute("data-breakpoint")).toBe(true)
    expect(line88().hasAttribute("data-paused")).toBe(true)
    const watch = () => panel.querySelector('[data-slot="replay-devtools-watch"] li')!
    expect(watch().querySelector('[data-part="expr"]')!.textContent).toBe("total")
    expect(watch().querySelector('[data-part="value"]')!.textContent).toBe("130")
    expect(watch().querySelector('[data-part="count"]')!.textContent).toBe("1/2")
    expect(el.querySelector('[data-slot="replay-preview-capture"]')).toBeNull()
    // Playing on: the screenshot is captured (flash + thumbnail), and the next hit's value lands.
    await playTo(2600)
    const capture = el.querySelector('[data-slot="replay-preview-capture"]')!
    expect(capture.querySelector("img")!.getAttribute("src")).toBe("/shots/pay.jpg")
    expect(capture.querySelector('[data-part="flash"]')).not.toBeNull()
    await playTo(3100)
    expect(watch().querySelector('[data-part="value"]')!.textContent).toBe("117")
    expect(watch().querySelector('[data-part="count"]')!.textContent).toBe("2/2")
  })

  it("plays slower between inspections close together, then picks the chosen speed back up", async () => {
    stage.time = 0
    await mount(<ReplayPreview events={replayDemoEvents} lazy={false} inspections={[{ time: 2000, request: "/api/checkout" }, { time: 2500, request: "/api/checkout" }]} />)
    const props = () => stage.props as ReplayStageProps
    expect(props().speed).toBe(1)
    await act(async () => props().onTimeUpdate?.(2100))
    expect(props().speed).toBeCloseTo(0.2)
    await act(async () => props().onTimeUpdate?.(2600))
    expect(props().speed).toBe(1)
  })

  it("Sources lines are syntax-highlighted, lexed as one excerpt", async () => {
    const evidence = {
      sources: [{ path: "src/checkout.ts", lines: [{ line: 87, text: "const total = res.total" }, { line: 88, text: "applyPromo(total)" }] }],
    }
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} evidence={evidence} defaultDevtoolsTab="sources" />)
    await act(async () => {})
    const tokens = (line: number) =>
      [...el.querySelectorAll(`[data-slot="replay-devtools-code-line"][data-line="${line}"] .docs-tok`)].map((t) => `${t.className}:${t.textContent}`)
    expect(tokens(87)).toEqual(["docs-tok docs-tok-keyword:const"])
    expect(tokens(88)).toEqual(["docs-tok docs-tok-function:applyPromo"])
    expect(el.querySelector('[data-slot="replay-devtools-code-line"][data-line="88"] [data-part="text"]')!.textContent).toBe("applyPromo(total)")
  })

  it("a seek past a screenshot doesn't take it", async () => {
    stage.time = 1000
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} evidence={{ screenshots: [{ at: 2500, src: "/s.jpg" }] }} />)
    const props = () => stage.props as ReplayStageProps
    await act(async () => props().onPlayingChange?.(true))
    await act(async () => props().onTimeUpdate?.(6000))
    expect(el.querySelector('[data-slot="replay-preview-capture"]')).toBeNull()
  })

  it("disableDevtools removes the buttons, the panel and the inspections", async () => {
    stage.time = 8000
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} disableDevtools inspections={[{ time: 7600, request: "/api/checkout", label: "Checkout answered 500" }]} />)
    expect(el.querySelector('[data-slot="replay-devtools-buttons"]')).toBeNull()
    expect(el.querySelector('[data-slot="replay-devtools"]')).toBeNull()
    expect(el.innerHTML).not.toContain("Checkout answered 500")
  })

  it("a time window opens at its start, highlights it, and plays just it until you scrub outside", async () => {
    stage.time = 3000
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} timeWindow={[3000, 5000]} />)
    const props = () => stage.props as ReplayStageProps
    const tick = (ms: number) => act(async () => { stage.time = ms; props().onTimeUpdate?.(ms) })
    const playing = (p: boolean) => act(async () => props().onPlayingChange?.(p))
    expect(props().initialTime).toBe(3000)
    expect(props().loop).toBe(false)
    const band = el.querySelector<HTMLElement>('[data-slot="replay-preview-window"]')!
    expect(band.style.getPropertyValue("--replay-window-start")).toBe(String(3000 / DEMO_DURATION))
    expect(band.style.getPropertyValue("--replay-window-size")).toBe(String(2000 / DEMO_DURATION))
    expect(el.querySelector('input[type="range"]')!.getAttribute("aria-valuetext")).toContain("segment 0:03 to 0:05")

    // Play from inside: at the window's end the stage pauses there, and the center button replays the segment.
    const playButton = el.querySelector<HTMLButtonElement>('[data-slot="replay-preview-play"]')!
    await act(async () => playButton.click())
    expect(stage.calls.at(-1)).toBe("play:")
    await playing(true)
    await tick(4200)
    expect(stage.calls.at(-1)).toBe("play:")
    await tick(5020)
    expect(stage.calls.at(-1)).toBe("pause:5000")
    await playing(false)
    expect(el.querySelector('[data-slot="replay-preview-center"] button')!.getAttribute("aria-label")).toBe("Replay the segment")
    await act(async () => playButton.click())
    expect(stage.calls.at(-1)).toBe("play:3000")

    // Scrubbed past the window, playback runs on to the end of the recording.
    await act(async () => {
      const input = el.querySelector<HTMLInputElement>('input[type="range"]')!
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "6000")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(stage.calls.at(-1)).toBe("seek:6000")
    await playing(true)
    await tick(7000)
    expect(stage.calls.filter((c) => c === "pause:5000")).toHaveLength(1)
    // Back inside it, the window holds again.
    await act(async () => void el.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })))
    expect(stage.calls.at(-1)).toBe("seek:0")
    await tick(5100)
    expect(stage.calls.filter((c) => c === "pause:5000")).toHaveLength(1)
    const ref: { current: ReplayPreviewHandle | null } = { current: null }
    await mount(<ReplayPreview events={replayDemoEvents} lazy={false} timeWindow={[3000, 5000]} playerRef={ref} />)
    act(() => ref.current!.seek(3500))
    await playing(true)
    await tick(5000)
    expect(stage.calls.at(-1)).toBe("pause:5000")
  })

  it("with loop, a time window goes round again from its start", async () => {
    stage.time = 3000
    await mount(<ReplayPreview events={replayDemoEvents} lazy={false} timeWindow={[3000, 5000]} loop />)
    const props = () => stage.props as ReplayStageProps
    await act(async () => props().onPlayingChange?.(true))
    await act(async () => props().onTimeUpdate?.(5010))
    expect(stage.calls.at(-1)).toBe("seek:3000")
  })

  it("maps keys: space/k toggle, arrows and j/l seek, Home/End jump, < > cycle speed", async () => {
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} />)
    const last = () => stage.calls[stage.calls.length - 1]
    press(el, " ")
    expect(last()).toBe("toggle")
    press(el, "K")
    expect(stage.calls.filter((c) => c === "toggle")).toHaveLength(2)
    press(el, "ArrowRight")
    expect(last()).toBe("seek:7000")
    press(el, "ArrowLeft")
    expect(last()).toBe("seek:0")
    press(el, "l")
    expect(last()).toBe(`seek:${DEMO_DURATION}`) // 2000 + 10 s, clamped to the duration
    press(el, "j")
    expect(last()).toBe("seek:0")
    press(el, "Home")
    expect(last()).toBe("seek:0")
    press(el, "End")
    expect(last()).toBe(`seek:${DEMO_DURATION}`)
    expect(stage.props?.speed).toBe(1)
    press(el, ">")
    expect(stage.props?.speed).toBe(2)
    press(el, "<")
    press(el, "<")
    expect(stage.props?.speed).toBe(0.5)
  })

  it("leaves the arrow keys to the scrubber's range input, and ignores keys with modifiers", async () => {
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} />)
    const range = el.querySelector("input[type=range]")!
    const before = stage.calls.length
    press(range, "ArrowRight")
    press(range, "Home")
    expect(stage.calls.length).toBe(before)
    await act(async () => void range.dispatchEvent(new KeyboardEvent("keydown", { key: "k", bubbles: true, metaKey: true })))
    expect(stage.calls.length).toBe(before)
    // …but J/L and K still work from the slider.
    press(range, "k")
    expect(stage.calls.length).toBe(before + 1)
  })

  it("a marker button seeks a beat before its moment and reports the press", async () => {
    const pressed: string[] = []
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} onMarkerPress={(m) => pressed.push(m.kind)} markers />)
    const error = el.querySelector<HTMLElement>('[data-slot="replay-preview-markers"] [data-kind="error"]')!
    await act(async () => error.click())
    const seek = stage.calls.find((c) => c.startsWith("seek:"))!
    expect(Number(seek.slice(5))).toBeGreaterThan(0)
    expect(pressed).toEqual(["error"])
  })

  it("the scrubber seeks from the range input", async () => {
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} />)
    const range = el.querySelector<HTMLInputElement>("input[type=range]")!
    expect(range.disabled).toBe(false)
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
    await act(async () => {
      setter.call(range, "3500")
      range.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(stage.calls).toContain("seek:3500")
  })
})

describe("source mode (the embed API)", () => {
  it("a Loop QA URL is an iframe on the public route, in a minimal frame", () => {
    const html = renderToString(<ReplayPreview source="https://loop-qa.replay.io/projects/p1/journeys/j1" title="Replay preview" />)
    expect(html).toContain("<iframe")
    expect(html).toContain('src="https://loop-qa.replay.io/p/')
    expect(html).toContain('data-replay-preview="iframe"')
    expect(html).toContain('data-slot="replay-preview"')
    expect(html).toContain('data-chrome="minimal"')
    expect(html).toContain('title="Replay preview"')
  })

  it("an unparsable page URL falls back to an open-in-new-tab link", () => {
    const html = renderToString(<ReplayPreview source={{ kind: "url", url: "javascript:alert(1)" }} />)
    expect(html).not.toContain("<iframe")
    expect(html).toContain("Open replay")
  })

  it("an event array (bare or wrapped) renders the same player as `events`", () => {
    for (const source of [replayDemoEvents, { kind: "events" as const, events: replayDemoEvents }]) {
      const html = renderToString(<ReplayPreview source={source} className="mine" />)
      expect(html).toContain('data-replay-preview="rrweb"')
      expect(html).toContain('data-slot="replay-preview-scrubber"')
      expect(html).toContain('data-chrome="browser"')
      expect(html).toContain("replay-preview mine")
    }
  })

  it("active={false} renders an inert placeholder and neither iframe nor player", () => {
    const html = renderToString(<ReplayPreview source="https://loop-qa.replay.io/projects/p1/journeys/j1" active={false} />)
    expect(html).toContain('data-replay-preview="paused"')
    expect(html).not.toContain("<iframe")
  })

  describe("events-url", () => {
    let host: HTMLDivElement
    let root: ReturnType<typeof createRoot>
    beforeEach(() => {
      ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
      host = document.createElement("div")
      document.body.appendChild(host)
      root = createRoot(host)
    })
    afterEach(() => {
      act(() => root.unmount())
      host.remove()
      vi.unstubAllGlobals()
    })

    it("fetches the events, then plays them", async () => {
      let release!: () => void
      const gate = new Promise<void>((resolve) => (release = resolve))
      const fetchMock = vi.fn(async () => {
        await gate
        return new Response(JSON.stringify({ events: replayDemoEvents }), { status: 200 })
      })
      vi.stubGlobal("fetch", fetchMock)
      await act(async () => root.render(<ReplayPreview source={{ kind: "events-url", url: "https://x.test/events.json" }} lazy={false} />))
      expect(host.textContent).toContain("Loading replay")
      expect(host.querySelector('[data-slot="replay-preview-scrubber"]')).toBeNull()
      release()
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(host.querySelector('[data-slot="replay-preview-scrubber"]')).not.toBeNull()
    })

    it("surfaces a failed request", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })))
      await act(async () => root.render(<ReplayPreview source={{ kind: "events-url", url: "https://x.test/events.json" }} />))
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
      })
      expect(host.querySelector('[role="alert"]')?.textContent).toContain("500")
    })
  })
})

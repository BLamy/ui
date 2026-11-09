// @vitest-environment happy-dom
// A stage of your own, DevTools as data, and Elements through an interface: the seams that let the player sit on
// something other than rrweb. Nothing here loads rrweb, and the mock below fails if anything tries to.
// react-dom is installed (a peer of our deps) but its types are not; the tests only need these functions.
// @ts-ignore
import { renderToString as untypedRenderToString } from "react-dom/server"
// @ts-ignore
import { createRoot as untypedCreateRoot } from "react-dom/client"
import { act, forwardRef, useImperativeHandle, type ReactElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { replayDemoEvents } from "./demo"
import { getReplayDevtools, replayDevtoolsAt, replayDevtoolsCountsAt, replayDevtoolsCutAt, type ReplayDevtools, type ReplayRequest } from "./devtools"
import { getReplayDevtoolsMarkers } from "./markers"
import { ReplayPreview } from "./ReplayPreview"
import type { ReplayCustomStage, ReplayCustomStageProps, ReplayElementsSource, ReplayStageHandle } from "./stage-types"

const renderToString = untypedRenderToString as (element: ReactElement) => string
const createRoot = untypedCreateRoot as (el: Element) => { render(node: ReactElement): void; unmount(): void }

vi.mock("./ReplayStage", () => ({
  preloadReplayStage: () => Promise.reject(new Error("rrweb's stage was asked for")),
  ReplayStage: () => {
    throw new Error("rrweb's stage was rendered")
  },
}))

// A stage with no idea it's being tested: it holds a time and reports it, as a frames stage does.
const stage = vi.hoisted(() => ({
  props: null as null | ReplayCustomStageProps,
  calls: [] as string[],
  time: 0,
  doc: null as Document | null,
  hasDocument: false,
}))

const FakeStage = forwardRef<ReplayStageHandle, ReplayCustomStageProps>(function FakeStage(props, ref) {
  stage.props = props
  useImperativeHandle(ref, () => ({
    play: (o) => void stage.calls.push(`play:${o ?? ""}`),
    pause: (o) => void stage.calls.push(`pause:${o ?? ""}`),
    seek(ms) {
      stage.calls.push(`seek:${ms}`)
      stage.time = ms
      props.onTimeUpdate?.(ms)
    },
    toggle: () => void stage.calls.push("toggle"),
    getCurrentTime: () => stage.time,
    getDuration: () => 60_000,
    isPlaying: () => false,
    ...(stage.hasDocument ? { getDocument: () => stage.doc } : {}),
  }))
  return <div data-fake-stage="" className={props.className}>{props.overlay}</div>
})

const custom: ReplayCustomStage = { component: FakeStage, duration: 60_000, width: 800, height: 600, href: "https://shop.test/cart" }

const request = (over: Partial<ReplayRequest> & { id: string; time: number }): ReplayRequest => ({
  method: "GET", url: `https://shop.test/${over.id}`, name: over.id, type: "fetch", failed: false, ...over,
})

const data: ReplayDevtools = {
  console: [
    { id: "m1", time: 100, level: "log", message: "started", args: ["started"], source: "console" },
    { id: "m2", time: 2_000, level: "warn", message: "slow", args: ["slow"], source: "console" },
    { id: "m3", time: 5_000, level: "error", message: "broke", args: ["broke"], source: "console" },
  ],
  network: [
    request({ id: "page", time: 50, duration: 100, status: 200 }),
    request({ id: "missing", time: 1_000, duration: 2_000, status: 404, failed: true }),
    request({ id: "later", time: 40_000, duration: 10, status: 200 }),
  ],
}

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  stage.props = null
  stage.calls.length = 0
  stage.time = 0
  stage.doc = null
  stage.hasDocument = false
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

async function mount(element: ReactElement, at = 0) {
  await act(async () => root.render(element))
  await act(async () => {
    stage.props!.onReady?.({ duration: 60_000, width: 800, height: 600 })
    stage.time = at
    stage.props!.onTimeUpdate?.(at)
  })
  return host.querySelector<HTMLElement>('[data-slot="replay-preview"]')!
}
const moveTo = (ms: number) => act(async () => { stage.time = ms; stage.props!.onTimeUpdate?.(ms) })
const press = (el: Element, key: string) => act(async () => void el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })))

describe("a stage of your own", () => {
  it("takes rrweb's place: the frame, the poster and the controls are the same", () => {
    const html = renderToString(<ReplayPreview stage={custom} lazy={false} />)
    for (const slot of ["replay-preview", "replay-preview-bar", "replay-preview-stage", "replay-preview-poster", "replay-preview-controls", "replay-preview-scrubber"]) {
      expect(html, slot).toContain(`data-slot="${slot}"`)
    }
    expect(html).toContain("--replay-ar:800 / 600")
    expect(html).toContain("shop.test")
    expect(html).toContain("data-fake-stage")
    expect(html).toContain('data-replay-preview="rrweb"')
    expect(html).not.toContain("no page snapshot")
  })

  it("goes by the stage's ready and time, and the scrubber, keys and handle all drive it", async () => {
    const ref: { current: { seek(ms: number): void; toggle(): void; getCurrentTime(): number } | null } = { current: null }
    const times: number[] = []
    await act(async () => root.render(<ReplayPreview stage={custom} lazy={false} playerRef={ref as never} onTimeUpdate={(t) => times.push(t)} />))
    const el = host.querySelector<HTMLElement>('[data-slot="replay-preview"]')!
    expect(el.dataset.state).toBe("loading")
    await act(async () => stage.props!.onReady?.({ duration: 60_000, width: 800, height: 600 }))
    expect(el.dataset.state).toBe("paused")

    await moveTo(65_000)
    expect(el.querySelector('[data-slot="replay-preview-time"]')!.textContent).toBe("1:05 / 1:00")
    await moveTo(12_000)
    expect(el.querySelector('[data-slot="replay-preview-time"]')!.textContent).toBe("0:12 / 1:00")

    const range = el.querySelector<HTMLInputElement>('input[type="range"]')!
    expect(range.max).toBe("60000")
    expect(range.value).toBe("12000")

    await act(async () => ref.current!.seek(30_000))
    expect(stage.calls).toEqual(["seek:30000"])
    expect(times.at(-1)).toBe(30_000)
    expect(ref.current!.getCurrentTime()).toBe(30_000)

    await press(el, "j")
    expect(stage.calls.at(-1)).toBe("seek:20000")
    await press(el, "End")
    expect(stage.calls.at(-1)).toBe("seek:60000")
    await press(el, "k")
    expect(stage.calls.at(-1)).toBe("toggle")

    await act(async () => stage.props!.onPlayingChange?.(true))
    expect(el.dataset.state).toBe("playing")
  })

  it("gets the chosen speed, and only what isn't about rrweb", async () => {
    await mount(<ReplayPreview stage={custom} lazy={false} speeds={[2, 4]} />)
    expect(stage.props!.speed).toBe(2)
    expect(Object.keys(stage.props!)).not.toContain("events")
    expect(Object.keys(stage.props!)).not.toContain("fit")
    expect(stage.props!.className).toBe("replay-preview__page")
    await act(async () => host.querySelector<HTMLButtonElement>('[data-slot="replay-preview-speed"]')!.click())
    expect(stage.props!.speed).toBe(4)
  })

  it("the URL bar goes by url, then the stage's href", async () => {
    const withUrl = await mount(<ReplayPreview stage={custom} lazy={false} url="https://other.test/here" />)
    expect(withUrl.querySelector('[data-slot="replay-preview-url"]')!.getAttribute("title")).toBe("https://other.test/here")
    await act(async () => root.render(<ReplayPreview stage={{ ...custom, href: "https://shop.test/next" }} lazy={false} />))
    expect(withUrl.querySelector('[data-slot="replay-preview-url"]')!.getAttribute("title")).toBe("https://shop.test/next")
  })

  it("a new duration is picked up without a new stage", async () => {
    const el = await mount(<ReplayPreview stage={custom} lazy={false} />)
    const first = stage.props
    await act(async () => root.render(<ReplayPreview stage={{ ...custom, duration: 3_600_000 }} lazy={false} />))
    expect(el.querySelector<HTMLInputElement>('input[type="range"]')!.max).toBe("3600000")
    expect(el.querySelector("[data-fake-stage]")).not.toBeNull()
    expect(stage.props).not.toBe(first)
  })

  it("has no Console and Network buttons with nothing to show", async () => {
    const el = await mount(<ReplayPreview stage={custom} lazy={false} />)
    expect(el.querySelector('[data-slot="replay-devtools-buttons"]')).toBeNull()
  })
})

describe("DevTools as data", () => {
  it("the buttons and the panel show what's handed over, cut at the playhead", async () => {
    const el = await mount(<ReplayPreview stage={custom} lazy={false} devtools={data} />, 500)
    const network = () => el.querySelector<HTMLButtonElement>('[data-tab="network"]')!
    const consoleButton = () => el.querySelector<HTMLButtonElement>('[data-tab="console"]')!
    expect(network().getAttribute("aria-label")).toBe("Network: 1 request, 0 failed")
    expect(consoleButton().getAttribute("aria-label")).toBe("Console: 0 errors, 0 warnings")

    // Sent, but the 404 hasn't come back yet: it's pending, and not a failure.
    await moveTo(1_500)
    expect(network().getAttribute("aria-label")).toBe("Network: 2 requests, 0 failed")
    await act(async () => network().click())
    const statuses = () => [...el.querySelectorAll("tbody tr")].map((r) => [r.querySelector("td")!.textContent, r.querySelectorAll("td")[1]!.textContent])
    expect(statuses()).toEqual([["page", "200"], ["missing", "(pending)"]])

    await moveTo(6_000)
    expect(network().getAttribute("aria-label")).toBe("Network: 2 requests, 1 failed")
    expect(consoleButton().getAttribute("aria-label")).toBe("Console: 1 error, 1 warning")
    expect(statuses()).toEqual([["page", "200"], ["missing", "404"]])

    // A row's time goes through the stage, as a scrub does.
    const tab = [...el.querySelectorAll<HTMLButtonElement>('[data-slot="replay-devtools-tabs"] [role=tab]')].find((b) => b.textContent?.startsWith("Console"))!
    await act(async () => tab.click())
    const messages = [...el.querySelectorAll('[data-slot="replay-devtools-message"]')]
    expect(messages.map((m) => m.getAttribute("data-level"))).toEqual(["log", "warn", "error"])
    await act(async () => messages[0]!.querySelector<HTMLButtonElement>('[data-part="time"]')!.click())
    expect(stage.calls.at(-1)).toBe("seek:100")
  })

  it("wins over what the events would say", () => {
    // Lazy, so rrweb's stage isn't rendered here: the buttons are all that's being looked at.
    expect(renderToString(<ReplayPreview events={replayDemoEvents} />)).toContain("replay-devtools-buttons")
    expect(renderToString(<ReplayPreview events={replayDemoEvents} devtools={{ console: [], network: [] }} />)).not.toContain("replay-devtools-buttons")
    expect(renderToString(<ReplayPreview events={replayDemoEvents} initialTime={500} devtools={data} />)).toContain("Network: 1 request, 0 failed")
  })

  it("new data can come at any time", async () => {
    const el = await mount(<ReplayPreview stage={custom} lazy={false} devtools={{ console: [], network: [] }} />, 500)
    expect(el.querySelector('[data-slot="replay-devtools-buttons"]')).toBeNull()
    await act(async () => root.render(<ReplayPreview stage={custom} lazy={false} devtools={data} />))
    expect(el.querySelector('[data-tab="network"]')!.getAttribute("aria-label")).toBe("Network: 1 request, 0 failed")
  })

  it("false and disableDevtools both turn it off", async () => {
    const off = await mount(<ReplayPreview stage={custom} lazy={false} devtools={false} />)
    expect(off.querySelector('[data-slot="replay-devtools-buttons"]')).toBeNull()
    await act(async () => root.render(<ReplayPreview stage={custom} lazy={false} devtools={data} disableDevtools />))
    expect(off.querySelector('[data-slot="replay-devtools-buttons"]')).toBeNull()
  })

  it("markers come from the data too, under the same rules", async () => {
    expect(getReplayDevtoolsMarkers(data).map((m) => [m.kind, m.time, m.label, m.detail])).toEqual([
      ["network", 1_000, "GET 404", "https://shop.test/missing"],
      ["error", 5_000, "Console error", "broke"],
    ])
    const el = await mount(<ReplayPreview stage={custom} lazy={false} devtools={data} markers />, 500)
    const labels = [...el.querySelectorAll('[data-slot="replay-preview-markers"] button')].map((b) => b.getAttribute("aria-label"))
    expect(labels).toEqual(["GET 404 at 0:01", "Console error at 0:05"])
    await act(async () => el.querySelector<HTMLButtonElement>('[data-kind="error"]')!.click())
    expect(stage.calls.at(-1)).toBe("seek:4750")
  })

  it("lays out at most 2,000 rows of a long recording, keeping the latest, and says so", async () => {
    const many: ReplayDevtools = {
      console: Array.from({ length: 2_500 }, (_, i) => ({ id: `m${i}`, time: i, level: "log" as const, message: `message ${i}`, args: [`message ${i}`], source: "console" as const })),
      network: Array.from({ length: 2_100 }, (_, i) => request({ id: `r${i}`, time: i, duration: 0, status: 200 })),
    }
    const el = await mount(<ReplayPreview stage={custom} lazy={false} devtools={many} defaultDevtoolsTab="console" />, 10_000)
    const rows = el.querySelectorAll('[data-slot="replay-devtools-message"]')
    expect(rows).toHaveLength(2_000)
    expect(rows[rows.length - 1]!.textContent).toContain("message 2499")
    expect(el.querySelector('[data-slot="replay-devtools-later"]')!.textContent).toBe("500 earlier messages aren't shown here")
    const tab = [...el.querySelectorAll<HTMLButtonElement>('[data-slot="replay-devtools-tabs"] [role=tab]')].find((b) => b.textContent?.startsWith("Network"))!
    await act(async () => tab.click())
    expect(el.querySelectorAll("tbody tr")).toHaveLength(2_000)
    expect(el.querySelector('[data-slot="replay-devtools-later"]')!.textContent).toBe("100 earlier requests aren't shown here")
    expect(el.querySelector('[data-tab="network"]')!.getAttribute("aria-label")).toBe("Network: 2100 requests, 0 failed")
  })
})

describe("the counts and the cut", () => {
  const demo = getReplayDevtools(replayDemoEvents)

  it("the counts are what the lists would say, at every time that could matter", () => {
    const times = new Set<number>()
    for (const set of [demo, data]) {
      for (const e of set.console) for (const d of [-1, 0, 1]) times.add(e.time + d)
      for (const r of set.network) for (const d of [-1, 0, 1]) { times.add(r.time + d); times.add(r.time + (r.duration ?? 0) + d) }
    }
    expect(times.size).toBeGreaterThan(50)
    for (const set of [demo, data]) {
      for (const t of times) expect(replayDevtoolsCountsAt(set, t), `at ${t}`).toEqual(replayDevtoolsAt(set, t).counts)
    }
  })

  it("the cut changes exactly when what's listed does", () => {
    const list = (t: number) => {
      const at = replayDevtoolsAt(data, t)
      return JSON.stringify([at.console.map((m) => m.id), at.network.map((r) => [r.id, r.pending])])
    }
    let lastCut = replayDevtoolsCutAt(data, -1)
    let lastList = list(-1)
    for (let t = 0; t <= 41_000; t += 7) {
      const cut = replayDevtoolsCutAt(data, t)
      const shown = list(t)
      expect(cut !== lastCut, `at ${t}`).toBe(shown !== lastList)
      lastCut = cut
      lastList = shown
    }
  })
})

describe("Elements through an interface", () => {
  const page = () => {
    const doc = document.implementation.createHTMLDocument("page")
    doc.body.innerHTML = '<main><button id="go">Go</button></main>'
    return doc
  }
  const tabs = (el: Element) => [...el.querySelectorAll<HTMLElement>('[data-slot="replay-devtools-tabs"] [role=tab]')].map((t) => t.textContent)

  it("a stage with no document has no Elements tab", async () => {
    const el = await mount(<ReplayPreview stage={custom} lazy={false} devtools={data} defaultDevtoolsTab="console" />, 500)
    expect(tabs(el)).toEqual(["Console", "Network"])
  })

  it("a stage with a document has one, as rrweb's does", async () => {
    stage.hasDocument = true
    stage.doc = page()
    const el = await mount(<ReplayPreview stage={custom} lazy={false} devtools={data} defaultDevtoolsTab="console" />, 500)
    expect(tabs(el)).toEqual(["Elements", "Console", "Network"])
    await act(async () => [...el.querySelectorAll<HTMLElement>("[role=tab]")].find((t) => t.textContent === "Elements")!.click())
    expect(el.querySelector('[data-slot="replay-devtools-elements"]')!.textContent).toContain("<html")
  })

  it("elements hands over a document and where things really are, for a page that's only a picture", async () => {
    const doc = page()
    // In the iframe it was rebuilt in, nothing has a size. The engine knows where it was on screen.
    const button = doc.getElementById("go")!
    button.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }) as DOMRect
    const asked: Element[] = []
    const source: ReplayElementsSource = {
      getDocument: () => doc,
      getElementRect(element) {
        asked.push(element)
        return element === button ? { left: 40, top: 60, width: 200, height: 30 } : null
      },
    }
    const el = await mount(<ReplayPreview stage={custom} lazy={false} devtools={data} elements={source} inspections={[{ time: 1_000, element: "#go", label: "The button" }]} defaultDevtoolsTab="console" />, 500)
    expect(tabs(el)).toEqual(["Elements", "Console", "Network"])
    expect(el.querySelector('[data-slot="replay-preview-highlight"]')).toBeNull()
    await moveTo(1_100)
    const box = el.querySelector<HTMLElement>('[data-slot="replay-preview-highlight"]')!
    expect([box.style.left, box.style.top, box.style.width, box.style.height]).toEqual(["40px", "60px", "200px", "30px"])
    expect(box.textContent).toBe("button#go 200 × 30")
    expect(asked).toContain(button)
  })

  it("a source that doesn't know where something is draws nothing for it", async () => {
    const doc = page()
    const source: ReplayElementsSource = { getDocument: () => doc, getElementRect: () => null }
    const el = await mount(<ReplayPreview stage={custom} lazy={false} devtools={data} elements={source} inspections={[{ time: 1_000, element: "#go" }]} />, 1_100)
    expect(el.querySelector('[data-slot="replay-preview-highlight"]')).toBeNull()
  })

  it("a source with no rectangles leaves it to the document's own", async () => {
    const doc = page()
    doc.getElementById("go")!.getBoundingClientRect = () => ({ left: 1, top: 2, width: 3, height: 4, right: 4, bottom: 6, x: 1, y: 2, toJSON() {} }) as DOMRect
    const el = await mount(<ReplayPreview stage={custom} lazy={false} devtools={data} elements={{ getDocument: () => doc }} inspections={[{ time: 1_000, element: "#go" }]} />, 1_100)
    const box = el.querySelector<HTMLElement>('[data-slot="replay-preview-highlight"]')!
    expect([box.style.left, box.style.width]).toEqual(["1px", "3px"])
  })

  it("elements={false} takes the tab away, even with a document there", async () => {
    stage.hasDocument = true
    stage.doc = page()
    const el = await mount(<ReplayPreview stage={custom} lazy={false} devtools={data} elements={false} defaultDevtoolsTab="console" />, 500)
    expect(tabs(el)).toEqual(["Console", "Network"])
  })
})

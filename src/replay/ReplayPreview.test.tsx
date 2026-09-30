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

// The rrweb stage is a lazy boundary around a real Replayer, which needs a browser. Swap it for a stub
// that reports ready and records the calls the player chrome makes.
const stage = vi.hoisted(() => ({
  calls: [] as string[],
  props: null as null | { speed?: number },
  time: 2000,
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
  it("renders the browser chrome, poster, controls and the recording's markers", () => {
    const html = renderToString(<ReplayPreview events={replayDemoEvents} />)
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
    const el = await mount(<ReplayPreview events={replayDemoEvents} lazy={false} onMarkerPress={(m) => pressed.push(m.kind)} />)
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

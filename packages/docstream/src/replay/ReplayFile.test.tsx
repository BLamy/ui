// @vitest-environment happy-dom
// @ts-ignore react-dom's types are not installed; the tests only need these functions.
import { renderToString as untypedRenderToString } from "react-dom/server"
// @ts-ignore
import { createRoot as untypedCreateRoot } from "react-dom/client"
import { act, type ReactElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AssetResolverProvider } from "../asset-resolver"
import { MarkdownContent } from "../docs/DocsRenderer"
import { replayDemoEvents } from "./demo"
import { BrowserBar, splitReplayAddress } from "./ReplayPlayer"
import { ReplayFile, isRrwebUrl } from "./ReplayFile"

const renderToString = untypedRenderToString as (element: ReactElement) => string
const createRoot = untypedCreateRoot as (el: Element) => { render(node: ReactElement): void; unmount(): void }

vi.mock("./ReplayStage", () => ({
  preloadReplayStage: () => Promise.resolve(),
  ReplayStage: () => <div data-stub-stage="" />,
}))

describe("isRrwebUrl", () => {
  it("matches .rrweb paths, with or without a query or hash", () => {
    for (const url of ["./recording.rrweb", "https://cdn.test/a/b.RRWEB?v=2", "x.rrweb#t=3", " y.rrweb "]) expect(isRrwebUrl(url), url).toBe(true)
    for (const url of ["./recording.json", "https://x.test/rrweb", "a.rrweb.json", ""]) expect(isRrwebUrl(url), url).toBe(false)
  })
})

describe("URL bar", () => {
  it("splits the host from the path, query and hash", () => {
    expect(splitReplayAddress("https://app.test/saved?filter=mine#top")).toEqual({ host: "app.test", path: "/saved?filter=mine#top" })
    expect(splitReplayAddress("http://app.test?q=1")).toEqual({ host: "app.test", path: "?q=1" })
    expect(splitReplayAddress("app.test/")).toEqual({ host: "app.test", path: "/" })
    expect(splitReplayAddress("app.test")).toEqual({ host: "app.test", path: "" })
  })

  it("leads with the path once there is one past the root; the host leads at the root", () => {
    const deep = renderToString(<BrowserBar href="https://app.test/saved?filter=mine#top" trafficLights={false} loading={false} />)
    expect(deep).toContain('data-primary="path"')
    expect(deep).toContain('<span data-part="path">/saved?filter=mine#top</span>')
    const root = renderToString(<BrowserBar href="https://app.test/" trafficLights={false} loading={false} />)
    expect(root).toContain('data-primary="host"')
  })
})

describe("ReplayFile", () => {
  let host: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    vi.stubGlobal("IntersectionObserver", undefined)
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  })

  const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })

  it("fetches the file the host's resolver maps the document URL to, then plays it", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(replayDemoEvents), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const resolve = async (url: string) => (url === "./recording.rrweb" ? "/assets/recording-abc.rrweb" : null)
    await act(async () => root.render(<AssetResolverProvider resolve={resolve}><ReplayFile url="./recording.rrweb" /></AssetResolverProvider>))
    await settle()
    expect(fetchMock).toHaveBeenCalledWith("/assets/recording-abc.rrweb", expect.anything())
    expect(host.querySelector('[data-slot="replay-preview-scrubber"]')).not.toBeNull()
    expect(host.querySelector('[data-slot="replay-preview-bar"]')).not.toBeNull()
  })

  it("an embed of a .rrweb file renders the replay, not a link card", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ events: replayDemoEvents }), { status: 200 })))
    await act(async () => root.render(<MarkdownContent markdown={'{% embed url="https://cdn.test/session.rrweb" %}\n'} />))
    await settle()
    expect(host.querySelector('[data-slot="replay-preview"]')).not.toBeNull()
    expect(host.querySelector(".docs-content-ref")).toBeNull()
  })
})

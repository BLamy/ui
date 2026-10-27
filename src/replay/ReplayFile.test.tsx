// @vitest-environment happy-dom
// @ts-ignore react-dom's types are not installed; the tests only need these functions.
import { renderToString as untypedRenderToString } from "react-dom/server"
// @ts-ignore
import { createRoot as untypedCreateRoot } from "react-dom/client"
import { act, type ReactElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AssetResolverProvider } from "../asset-resolver"
import { MarkdownContent } from "../docs/DocsRenderer"
import { parseMarkdown } from "../gitbook/parse"
import { serializeMarkdown } from "../gitbook/serialize"
import { replayDemoEvents } from "./demo"
import { BrowserBar, splitReplayAddress } from "./ReplayPlayer"
import { ReplayFile, isRrwebUrl, splitReplayFragment } from "./ReplayFile"

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

describe("splitReplayFragment", () => {
  it("reads a #t=start,end media fragment (seconds) as the time window, and resolves the file without it", () => {
    expect(splitReplayFragment("./recording.rrweb#t=4.7,7.4")).toEqual({ file: "./recording.rrweb", segment: [4700, 7400] })
    expect(splitReplayFragment("a.rrweb#t=12")).toEqual({ file: "a.rrweb", segment: [12000, Infinity] })
    expect(splitReplayFragment("a.rrweb#x=1&t=npt:2,3")).toEqual({ file: "a.rrweb", segment: [2000, 3000] })
    expect(splitReplayFragment("a.rrweb#t=5,2")).toEqual({ file: "a.rrweb", segment: undefined })
    expect(splitReplayFragment("a.rrweb#top")).toEqual({ file: "a.rrweb#top" })
    expect(splitReplayFragment("a.rrweb")).toEqual({ file: "a.rrweb" })
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

  it("an embed's har= and log= join the player's DevTools, and round-trip through the markdown", async () => {
    const start = replayDemoEvents[0]!.timestamp
    const iso = (ms: number) => new Date(start + ms).toISOString()
    const har = { log: { entries: [{ startedDateTime: iso(500), time: 120, request: { method: "GET", url: "https://shop.test/api/extra" }, response: { status: 503, content: {} } }] } }
    const files: Record<string, string> = {
      "/a/recording.rrweb": JSON.stringify(replayDemoEvents),
      "/a/network.har": JSON.stringify(har),
      "/a/console.log": `${iso(400)} [warn] from the log file\n`,
    }
    const fetchMock = vi.fn(async (url: string) => new Response(files[url] ?? "", { status: files[url] ? 200 : 404 }))
    vi.stubGlobal("fetch", fetchMock)
    const md = '{% embed url="./recording.rrweb" har="./network.har" log="./console.log" %}\n'
    const resolve = (url: string) => "/a/" + url.slice(2)
    await act(async () => root.render(<AssetResolverProvider resolve={resolve}><MarkdownContent markdown={md} /></AssetResolverProvider>))
    await settle()
    expect(fetchMock.mock.calls.map((c) => c[0]).sort()).toEqual(["/a/console.log", "/a/network.har", "/a/recording.rrweb"])
    const player = host.querySelector('[data-slot="replay-preview"]')!
    expect(player.querySelector('[data-tab="network"]')).not.toBeNull()
    expect(serializeMarkdown(parseMarkdown('{% embed url="./r.rrweb" har="./n.har" log="./c.log" %}'))).toContain('har="./n.har" log="./c.log"')
  })

  it("plays the recording before the HAR arrives, then adds its requests without touching the stage", async () => {
    const start = replayDemoEvents[0]!.timestamp
    const har = { log: { entries: [{ startedDateTime: new Date(start + 100).toISOString(), time: 10, request: { method: "GET", url: "https://shop.test/api/late" }, response: { status: 200, content: {} } }] } }
    let releaseHar!: () => void
    const harReady = new Promise<void>((resolve) => { releaseHar = resolve })
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/a/network.har") { await harReady; return new Response(JSON.stringify(har), { status: 200 }) }
      return new Response(JSON.stringify(replayDemoEvents), { status: 200 })
    }))
    const resolve = (url: string) => "/a/" + url.slice(2)
    await act(async () => root.render(<AssetResolverProvider resolve={resolve}><ReplayFile url="./recording.rrweb" har="./network.har" lazy={false} defaultDevtoolsTab="network" initialTime={9000} /></AssetResolverProvider>))
    await settle()
    const status = () => host.querySelector('[data-tab="network"]')?.getAttribute("aria-label")?.replace(/^Network: /, "") ?? ""
    expect(host.querySelector('[data-slot="replay-preview"]')).not.toBeNull()
    expect(status()).toMatch(/^8 requests/)
    await act(async () => { releaseHar(); await new Promise((r) => setTimeout(r, 20)) })
    expect(status()).toMatch(/^9 requests/)
  })

  it("an embed of a .rrweb file renders the replay, not a link card", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ events: replayDemoEvents }), { status: 200 })))
    await act(async () => root.render(<MarkdownContent markdown={'{% embed url="https://cdn.test/session.rrweb" %}\n'} />))
    await settle()
    expect(host.querySelector('[data-slot="replay-preview"]')).not.toBeNull()
    expect(host.querySelector(".docs-content-ref")).toBeNull()
  })
})

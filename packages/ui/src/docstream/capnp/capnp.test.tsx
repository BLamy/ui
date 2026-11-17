// @vitest-environment happy-dom
import { act, StrictMode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MarkdownContent } from "../docs/DocsRenderer"
import { AssetResolverProvider } from "../asset-resolver"
import { CapnpDiagram } from "./CapnpDiagram"

// The fence must never lay a config out with ELK: placeInLayers places every service. If anything reaches for it, this says so.
const elk = vi.hoisted(() => ({ loaded: false }))
vi.mock("elkjs/lib/elk.bundled.js", () => {
  elk.loaded = true
  return { default: class {} }
})

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let host: HTMLDivElement
let root: Root
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function until(check: () => boolean) {
  // The first board waits for a cold import of the Cloudflare entry (the diagram and its catalog): give it time under load.
  for (let i = 0; i < 500 && !check(); i++) await act(() => new Promise((r) => setTimeout(r, 20)))
  expect(check()).toBe(true)
}
const render = (node: React.ReactNode) => act(() => root.render(<StrictMode>{node}</StrictMode>))

const CONFIG = `using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [ (name = "main", worker = .main), (name = "do-storage", disk = (path = "do-storage", writable = true)) ],
  sockets = [ (name = "http", address = "127.0.0.1:19610", http = (), service = "main") ],
);
const main :Workerd.Worker = (
  modules = [ (name = "worker.js", esModule = embed "worker.js") ],
  bindings = [ (name = "ACCOUNTS", durableObjectNamespace = "ProofAccount") ],
  durableObjectNamespaces = [ (className = "ProofAccount", uniqueKey = "event-log", enableSql = true) ],
  durableObjectStorage = (localDisk = "do-storage"),
);`
const fence = (code: string) => `\`\`\`capnp\n${code}\n\`\`\``

// The services' cards: not the system's own box around them.
const nodes = () => [...host.querySelectorAll('[data-docstream-capnp] [data-slot=diagram-node]:not([data-node^="cloudflare:"])')].map((n) => n.getAttribute("data-node"))

describe("capnp", () => {
  it("draws a workerd config fence as its services, says what it doesn't draw, and keeps the source a press away", async () => {
    const workers = vi.fn()
    vi.stubGlobal("Worker", workers)
    render(<MarkdownContent markdown={fence(CONFIG)} />)
    await until(() => nodes().length === 2)
    expect(nodes().sort()).toEqual(["main", "main.ProofAccount"])
    expect(host.querySelector("[data-docstream-capnp] [data-slot=diagram-edge]")).not.toBeNull()
    // The system is the config, by its name; its class is inside its Worker; its socket is where requests come in.
    expect(host.querySelector('[data-docstream-capnp] [data-node="cloudflare:system"] [data-slot=diagram-node-title]')?.textContent).toBe("workerd config")
    expect(host.querySelector('[data-docstream-capnp] [data-node="main"]')?.getAttribute("data-kind")).toBe("group")
    expect(host.querySelector('[data-docstream-capnp] [data-node="main"] [data-slot=diagram-entry]')).not.toBeNull()
    expect(host.querySelector("[data-docstream-capnp]")?.classList.contains("docs-split-card")).toBe(true)
    expect(host.querySelector("[data-docstream-capnp-notes]")?.textContent).toContain("listens on 127.0.0.1:19610 for main")
    // The board is read-only: nothing on it offers to change the system.
    expect(host.querySelector("[data-docstream-capnp] [data-action=delete], [data-docstream-capnp] [data-action=undo]")).toBeNull()
    expect(host.querySelector('[data-docstream-capnp] [aria-label="workerd config, as Cloudflare services"]')).not.toBeNull()
    // The source is a disclosure under the board, closed, and the board stays when it opens.
    const trigger = host.querySelector<HTMLButtonElement>(".docs-capnp-source-trigger")!
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    act(() => trigger.click())
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(host.querySelector(".docs-capnp-source-body")?.textContent).toContain("durableObjectNamespace")
    expect(nodes()).toHaveLength(2)
    // Every button in the card has a name: the copy button says what it copies.
    expect(host.querySelector(".docs-capnp-preview .docs-split-copy")?.getAttribute("aria-label")).toBe("Copy workerd config source")
    // No layout engine: no ELK, and no layout worker.
    expect(elk.loaded).toBe(false)
    expect(workers).not.toHaveBeenCalled()
  })

  it("leaves Cap'n Proto that isn't a config as code", () => {
    render(<MarkdownContent markdown={"```capnp\nstruct Foo {\n  a @0 :Text;\n}\n```"} />)
    expect(host.querySelector("[data-docstream-capnp]")).toBeNull()
    expect(host.textContent).toContain("struct Foo")
  })

  it("says where a config that doesn't read goes wrong, and still shows its source", async () => {
    render(<MarkdownContent markdown={fence('const config :Workerd.Config = (services = [ (name = "a" ]);')} />)
    await until(() => !!host.querySelector("[data-docstream-capnp] [role=alert]"))
    expect(host.querySelector("[data-docstream-capnp] [role=alert]")?.textContent).toMatch(/line 1, column \d+/)
    expect(host.querySelector("[data-docstream-capnp] .docs-capnp-source-trigger")).not.toBeNull()
  })

  it("asks the host's renderCode first, and draws the config only when it declines", async () => {
    render(<MarkdownContent markdown={fence(CONFIG)} renderCode={(block) => (block.language === "capnp" ? <pre data-mine="">{block.code}</pre> : null)} />)
    expect(host.querySelector("[data-mine]")?.textContent).toContain("Workerd.Config")
    expect(host.querySelector("[data-docstream-capnp]")).toBeNull()
    render(<MarkdownContent markdown={fence(CONFIG)} renderCode={() => null} />)
    await until(() => nodes().length === 2)
  })

  it("follows the page's color scheme, or the one it's given", async () => {
    render(<div className="dark"><CapnpDiagram code={CONFIG} /></div>)
    await until(() => nodes().length === 2)
    expect(host.querySelector(".docs-capnp-board")?.getAttribute("data-appearance")).toBe("dark")
    expect(host.querySelector(".docs-capnp-board")?.classList.contains("dark")).toBe(true)
    render(<div className="dark"><CapnpDiagram code={CONFIG} appearance="light" /></div>)
    await until(() => host.querySelector(".docs-capnp-board")?.getAttribute("data-appearance") === "light")
  })

  it("renders on the server as a card that's drawing, with its source in a native disclosure", () => {
    const html = renderToString(<MarkdownContent markdown={fence(CONFIG)} />)
    expect(html).toContain("data-docstream-capnp")
    expect(html).toContain("Drawing the services")
    expect(html).toMatch(/<details[^>]*class="docs-capnp-source"/)
  })

  it("embeds a .capnp file through the host's resolver, by its file name", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => new Response(String(url).endsWith("/files/config.capnp") ? CONFIG : "missing", { status: String(url).endsWith("/files/config.capnp") ? 200 : 404 }))
    render(
      <AssetResolverProvider resolve={(url) => `https://host.test/files/${url.replace(/^\.\//, "")}`}>
        <MarkdownContent markdown={'{% embed url="./config.capnp" %}'} />
      </AssetResolverProvider>,
    )
    await until(() => nodes().length === 2)
    expect(fetch).toHaveBeenCalledWith("https://host.test/files/config.capnp")
    expect(host.querySelector("[data-docstream-capnp]")?.getAttribute("aria-label")).toBe("config.capnp")
    expect(host.querySelector(".docs-capnp-preview .docs-split-copy")?.getAttribute("aria-label")).toBe("Copy config.capnp source")
  })

  it("says so, in its card, when an embedded file can't be read", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("no", { status: 404, statusText: "Not Found" }))
    render(<MarkdownContent markdown={'{% embed url="https://host.test/gone.capnp" %}'} />)
    await until(() => !!host.querySelector("[role=alert]"))
    expect(host.querySelector("[data-docstream-capnp] [role=alert]")?.textContent).toContain("gone.capnp couldn’t be read: 404")
  })
})

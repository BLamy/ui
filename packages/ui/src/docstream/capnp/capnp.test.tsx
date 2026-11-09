// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MarkdownContent } from "../docs/DocsRenderer"
import { AssetResolverProvider } from "../asset-resolver"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let host: HTMLDivElement
let root: Root
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks() })
async function until(check: () => boolean) {
  for (let i = 0; i < 150 && !check(); i++) await act(() => new Promise((r) => setTimeout(r, 20)))
  expect(check()).toBe(true)
}

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

const nodes = () => [...host.querySelectorAll("[data-docstream-capnp] [data-slot=diagram-node]")].map((n) => n.getAttribute("data-node"))

describe("capnp", () => {
  it("draws a workerd config fence as its services, says what it doesn't draw, and shows the source on a press", async () => {
    act(() => root.render(<MarkdownContent markdown={`\`\`\`capnp\n${CONFIG}\n\`\`\``} />))
    await until(() => nodes().length === 2)
    expect(nodes().sort()).toEqual(["main", "main.ProofAccount"])
    expect(host.querySelector("[data-docstream-capnp] [data-slot=diagram-edge]")).not.toBeNull()
    expect(host.querySelector("[data-docstream-capnp-notes]")?.textContent).toContain("listens on 127.0.0.1:19610 for main")
    const toggle = host.querySelector<HTMLButtonElement>(".docs-capnp-toggle")!
    act(() => toggle.click())
    expect(host.querySelector(".docs-capnp-source")?.textContent).toContain("durableObjectNamespace")
    expect(nodes()).toEqual([])
  })

  it("leaves Cap'n Proto that isn't a config as code", () => {
    act(() => root.render(<MarkdownContent markdown={"```capnp\nstruct Foo {\n  a @0 :Text;\n}\n```"} />))
    expect(host.querySelector("[data-docstream-capnp]")).toBeNull()
    expect(host.textContent).toContain("struct Foo")
  })

  it("says why a config that doesn't read can't be drawn", async () => {
    act(() => root.render(<MarkdownContent markdown={"```capnp\nconst config :Workerd.Config = (services = [ (name = \"a\" ]);\n```"} />))
    await until(() => !!host.querySelector("[data-docstream-capnp] [role=alert]"))
    expect(host.querySelector("[data-docstream-capnp] [role=alert]")?.textContent).toContain("line 1")
  })

  it("embeds a .capnp file through the host's resolver, by its file name", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => new Response(String(url).endsWith("/files/config.capnp") ? CONFIG : "missing", { status: String(url).endsWith("/files/config.capnp") ? 200 : 404 }))
    act(() => root.render(
      <AssetResolverProvider resolve={(url) => `https://host.test/files/${url.replace(/^\.\//, "")}`}>
        <MarkdownContent markdown={'{% embed url="./config.capnp" %}'} />
      </AssetResolverProvider>,
    ))
    await until(() => nodes().length === 2)
    expect(fetch).toHaveBeenCalledWith("https://host.test/files/config.capnp")
    expect(host.querySelector("[data-docstream-capnp]")?.getAttribute("aria-label")).toBe("config.capnp")
  })

  it("says so when an embedded file can't be read", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("no", { status: 404, statusText: "Not Found" }))
    act(() => root.render(<MarkdownContent markdown={'{% embed url="https://host.test/gone.capnp" %}'} />))
    await until(() => !!host.querySelector("[role=alert]"))
    expect(host.querySelector("[role=alert]")?.textContent).toContain("gone.capnp couldn’t be read: 404")
  })
})

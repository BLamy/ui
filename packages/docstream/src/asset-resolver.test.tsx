// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { AssetResolverProvider, type AssetResolver } from "./assets"
import { MarkdownContent } from "./docs/DocsRenderer"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const render = async (markdown: string, resolve?: AssetResolver) => {
  await act(async () => {
    root.render(
      <AssetResolverProvider resolve={resolve}>
        <MarkdownContent markdown={markdown} />
      </AssetResolverProvider>,
    )
  })
}

describe("AssetResolverProvider", () => {
  it("resolves images through the host, synchronously or not", async () => {
    await render("![a](./a.png)\n\n![b](./b.png)", (url) => (url === "./a.png" ? "blob:a" : Promise.resolve("blob:b")))
    const srcs = [...host.querySelectorAll("img")].map((img) => img.getAttribute("src"))
    expect(srcs).toEqual(["blob:a", "blob:b"])
  })

  it("falls back to the URL as written when the host returns nothing", async () => {
    await render("![a](https://example.com/a.png)", () => null)
    expect(host.querySelector("img")?.getAttribute("src")).toBe("https://example.com/a.png")
  })

  it("holds an STL embed until its URL resolves", async () => {
    let finish: (url: string) => void = () => {}
    const pending = new Promise<string>((resolve) => (finish = resolve))
    await render('{% embed url="./part.stl" %}', () => pending)
    expect(host.querySelector(".docstream-asset-pending")).not.toBeNull()
    await act(async () => finish("blob:part"))
    expect(host.querySelector(".docstream-asset-pending")).toBeNull()
    expect(host.querySelector(".docstream-stl")).not.toBeNull()
  })
})

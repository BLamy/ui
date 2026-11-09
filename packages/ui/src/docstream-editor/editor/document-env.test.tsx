// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useDocstreamEnv, type DocstreamEnvHost } from "@brett_lamy/ui/docstream"
import type { DemoResolver } from "@brett_lamy/ui/docstream/demo"
import { GitbookEditor } from "./Editor"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Token() {
  return <output>token:{useDocstreamEnv().values.GITHUB_TOKEN}</output>
}
const load = vi.fn(async () => Token)
const resolver: DemoResolver = {
  list: () => ["repo/token"],
  meta: async () => ({ title: "Token" }),
  files: async () => [{ path: "index.tsx", content: "export default () => process.env.GITHUB_TOKEN\n" }],
  load,
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", undefined)
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  load.mockClear()
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})
const flush = async () => {
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

describe("document env in the editor", () => {
  it("gates a demo that uses a variable the document declares, until the host supplies it", async () => {
    const envHost: DocstreamEnvHost = { label: "Load", request: async () => ({ GITHUB_TOKEN: "gho_1" }) }
    const markdown = "---\nenv: [GITHUB_TOKEN]\n---\n\n{% demo src=\"repo/token\" %}\n"
    await act(async () => root.render(<GitbookEditor markdown={markdown} toolbar={false} slashMenu={false} demoResolver={resolver} envHost={envHost} />))
    await flush()
    expect(container.querySelector("[data-docstream-env-gate]")?.textContent).toContain("GITHUB_TOKEN")
    expect(load).not.toHaveBeenCalled()
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === "Load")!
    await act(async () => button.click())
    await flush()
    expect(container.querySelector("output")?.textContent).toBe("token:gho_1")
  })

  it("runs demos straight away when the document declares nothing", async () => {
    await act(async () => root.render(<GitbookEditor markdown={'{% demo src="repo/token" %}\n'} toolbar={false} slashMenu={false} demoResolver={resolver} />))
    await flush()
    expect(container.querySelector("[data-docstream-env-gate]")).toBeNull()
    // Rendered at once (the viewer may serve the component from its cache rather than call load again).
    expect(container.querySelector("output")?.textContent).toBe("token:")
  })
})

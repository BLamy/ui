// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MarkdownContent, type LivePreviewProps } from "./docs/DocsRenderer"
import { envNamesFromProperties, useDocstreamEnv, usedEnvNames, type DocstreamEnvHost } from "./doc-env"
import { createInlineDemoProject, ENV_MODULE } from "./playground/project"
import type { DemoResolver } from "./demo/types"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// Demos load once near the viewport; without IntersectionObserver they count as near at once.
delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver

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

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

function Token() {
  return <output>token:{useDocstreamEnv().values.GITHUB_TOKEN}</output>
}

function resolverFor(source: string, load = vi.fn(async () => Token)): DemoResolver & { load: typeof load } {
  return {
    list: () => ["repo/token"],
    meta: async () => ({ title: "Token" }),
    files: async () => [{ path: "index.tsx", content: source }],
    load,
  }
}

const PAGE = "---\nenv: [GITHUB_TOKEN]\n---\n\n{% demo src=\"repo/token\" %}\n"

describe("env names", () => {
  it("reads a list or a separated string, ignoring junk", () => {
    expect(envNamesFromProperties({ env: ["GITHUB_TOKEN", "1BAD", "A_B"] })).toEqual(["GITHUB_TOKEN", "A_B"])
    expect(envNamesFromProperties({ env: "A, B C" })).toEqual(["A", "B", "C"])
    expect(envNamesFromProperties({})).toEqual([])
  })

  it("matches whole identifiers only", () => {
    expect(usedEnvNames(["process.env.GITHUB_TOKEN"], ["GITHUB_TOKEN", "TOKEN"])).toEqual(["GITHUB_TOKEN"])
    expect(usedEnvNames(["MY_GITHUB_TOKEN_2"], ["GITHUB_TOKEN"])).toEqual([])
  })
})

describe("env-gated demos", () => {
  it("gates a demo that uses a declared variable and doesn't import it until the host supplies it", async () => {
    const resolver = resolverFor("export default () => process.env.GITHUB_TOKEN")
    const request = vi.fn(async () => ({ GITHUB_TOKEN: "gho_123" }))
    const envHost: DocstreamEnvHost = { request, label: "Load from Keychain", describe: () => "Sign in with GitHub" }
    await act(async () => root.render(<MarkdownContent markdown={PAGE} demoResolver={resolver} envHost={envHost} />))
    await flush()
    expect(host.querySelector("[data-docstream-env-gate]")?.textContent).toContain("GITHUB_TOKEN")
    expect(host.textContent).toContain("Sign in with GitHub")
    expect(resolver.load).not.toHaveBeenCalled()

    const button = [...host.querySelectorAll("button")].find((b) => b.textContent === "Load from Keychain")!
    await act(async () => button.click())
    await flush()
    await flush()
    expect(request).toHaveBeenCalledWith(["GITHUB_TOKEN"])
    expect(resolver.load).toHaveBeenCalled()
    expect(host.querySelector("output")?.textContent).toBe("token:gho_123")
  })

  it("runs demos that use none of the declared variables straight away", async () => {
    const resolver = resolverFor("export default () => 'hi'")
    await act(async () => root.render(<MarkdownContent markdown={PAGE} demoResolver={resolver} />))
    await flush()
    await flush()
    expect(host.querySelector("[data-docstream-env-gate]")).toBeNull()
    expect(resolver.load).toHaveBeenCalled()
  })

  it("without a host, asks the reader for the values", async () => {
    const resolver = resolverFor("GITHUB_TOKEN")
    await act(async () => root.render(<MarkdownContent markdown={PAGE} demoResolver={resolver} />))
    await flush()
    const input = host.querySelector<HTMLInputElement>("[data-docstream-env-gate] input")!
    expect(input.type).toBe("password")
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      setter.call(input, "typed")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => host.querySelector("form")!.requestSubmit())
    await flush()
    await flush()
    expect(host.querySelector("output")?.textContent).toBe("token:typed")
  })

  it("hands live code fences their variables", async () => {
    const live = vi.fn((props: LivePreviewProps) => <pre data-live="">{JSON.stringify(props.env ?? null)}</pre>)
    const markdown = "---\nenv: GITHUB_TOKEN\n---\n\n```jsx live=\"true\"\nconsole.log(process.env.GITHUB_TOKEN)\n```\n"
    const envHost: DocstreamEnvHost = { request: async () => ({ GITHUB_TOKEN: "t" }) }
    await act(async () => root.render(<MarkdownContent markdown={markdown} liveRenderer={live} envHost={envHost} documentProperties={false} />))
    expect(live).not.toHaveBeenCalled()
    await act(async () => host.querySelector<HTMLButtonElement>(".docs-env-gate-button")!.click())
    await flush()
    expect(host.querySelector("[data-live]")?.textContent).toBe('{"GITHUB_TOKEN":"t"}')
  })
})

describe("almost-node env", () => {
  it("sets process.env before the demo runs", () => {
    const project = createInlineDemoProject([{ path: "index.tsx", content: "export default () => null" }], { env: { A: "1" } })
    const files = project.files as Record<string, string>
    expect(files[ENV_MODULE]).toContain('{"A":"1"}')
    expect(files[project.entry]!.startsWith(`import ${JSON.stringify(ENV_MODULE)}`)).toBe(true)
  })
})

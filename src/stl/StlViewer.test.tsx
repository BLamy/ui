// @vitest-environment happy-dom
import { createRef } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { mount } from "../__fixtures__/dom"
import { StlViewer } from "./StlViewer"

afterEach(() => vi.unstubAllGlobals())

describe("StlViewer root props", () => {
  it("passes className, style and aria-label to the figure; without aria-label the caption names it, as in 2.0.0", () => {
    const html = renderToStaticMarkup(<StlViewer src="models/bracket.stl" title="Bracket" className="wide" style={{ maxWidth: 480 }} aria-label="Bracket, front mount" />)
    expect(html).toMatch(/^<figure class="docstream-stl wide" style="max-width:480px" aria-label="Bracket, front mount" data-state="loading">/)
    const plain = renderToStaticMarkup(<StlViewer src="models/bracket.stl" />)
    expect(plain).toMatch(/^<figure class="docstream-stl" data-state="loading">/)
    expect(plain).toContain("<figcaption")
  })

  it("forwards ref to the figure element", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})))
    const ref = createRef<HTMLElement>()
    const view = await mount(<StlViewer ref={ref} src="models/bracket.stl" />)
    expect(ref.current).toBe(view.host.querySelector("figure.docstream-stl"))
    await view.unmount()
    expect(ref.current).toBeNull()
  })
})

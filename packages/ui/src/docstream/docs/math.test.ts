import { describe, expect, it } from "vitest"
import { renderMathToHtml } from "./math"

describe("math rendering", () => {
  it("typesets display math with accessible MathML", () => {
    const html = renderMathToHtml("\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}")

    expect(html).toContain("katex-display")
    expect(html).toContain("<math")
    expect(html).toContain("∫")
  })

  it("renders invalid input as an error instead of throwing", () => {
    expect(renderMathToHtml("\\notARealCommand{")).toContain("katex-error")
  })
})

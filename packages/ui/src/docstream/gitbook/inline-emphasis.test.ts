import { describe, expect, it } from "vitest"
import { parseMarkdown, serializeMarkdown } from "./index"

const roundTrip = (s: string) => serializeMarkdown(parseMarkdown(s)).trim()

describe("emphasis spanning several runs", () => {
  it.each([
    "A **bold [link](url) inside** run",
    "**[x](url)**",
    "[**x**](url)",
    "~~s [a](b) t~~",
    "**a _b [c](d)_ e**",
    "_it [a](b) c_",
    "**bold** plain **bold again**",
  ])("round-trips %s", (s) => {
    expect(roundTrip(s)).toBe(s)
  })

  it("never emits empty marker pairs", () => {
    expect(roundTrip("A **bold [link](url) inside** run")).not.toMatch(/\*\*\*\*|~~~~|__/)
  })
})

import { describe, expect, it } from "vitest"
import { resolveReplayEvidence } from "./evidence"

const T = Date.parse("2026-10-19T10:00:00.000Z")
const iso = (ms: number) => new Date(T + ms).toISOString()

describe("resolveReplayEvidence", () => {
  it("merges excerpts by path, keeps focus lines, puts hits and screenshots on the recording's clock", () => {
    const r = resolveReplayEvidence(JSON.stringify({
      sources: [
        { path: "https://a.test/src/Profile.jsx", lines: [{ line: 60, text: "const res = await save()", hits: 3 }, { line: 61, text: "setVersion(updated)" }], focus: [61] },
        { path: "https://a.test/src/Profile.jsx", lines: [{ line: 62, text: "toast('Saved!')", hits: 1 }], at: iso(5000), label: "Read the toast" },
      ],
      logpoints: [{ path: "https://a.test/src/Profile.jsx", line: 61, expression: "res.status", hits: [{ at: iso(8800), value: "409" }, { at: 2000, value: "200" }] }],
      screenshots: [{ at: iso(9000), src: "/shots/b.jpg" }, { at: iso(-100), src: "/shots/a.jpg", label: "first" }, { at: "never", src: "/x.jpg" }],
    }), T, 10_000)
    expect(r.files).toEqual([{
      path: "https://a.test/src/Profile.jsx",
      lines: [{ line: 60, text: "const res = await save()", hits: 3 }, { line: 61, text: "setVersion(updated)", hits: undefined }, { line: 62, text: "toast('Saved!')", hits: 1 }],
      focus: [61],
    }])
    expect(r.logpoints[0]!.hits).toEqual([{ time: 2000, value: "200" }, { time: 8800, value: "409" }])
    expect(r.reads).toEqual([
      { time: 2000, path: "https://a.test/src/Profile.jsx", line: 61, label: "Logpoint Profile.jsx:61" },
      { time: 5000, path: "https://a.test/src/Profile.jsx", line: undefined, label: "Read the toast" },
    ])
    expect(r.screenshots).toEqual([{ src: "/shots/a.jpg", label: "first", time: 0 }, { src: "/shots/b.jpg", label: undefined, time: 9000 }])
  })

  it("is empty for what isn't evidence", () => {
    expect(resolveReplayEvidence("nope", 0, 1)).toEqual({ files: [], reads: [], logpoints: [], screenshots: [] })
    expect(resolveReplayEvidence(undefined, 0, 1).files).toEqual([])
  })
})

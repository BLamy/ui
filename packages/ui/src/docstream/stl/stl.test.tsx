import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MarkdownContent } from "../docs/DocsRenderer"
import { parseMarkdown } from "../gitbook/parse"
import { serializeMarkdown } from "../gitbook/serialize"
import { isStlUrl, parseStl } from "./parse"

function binaryStl(triangles: number[][]): ArrayBuffer {
  const buf = new ArrayBuffer(84 + triangles.length * 50)
  const view = new DataView(buf)
  view.setUint32(80, triangles.length, true)
  triangles.forEach((tri, t) => tri.forEach((v, k) => view.setFloat32(84 + t * 50 + 12 + k * 4, v, true)))
  return buf
}

describe("STL", () => {
  it("parses binary STL, recomputing normals and bounds", () => {
    const mesh = parseStl(binaryStl([[0, 0, 0, 2, 0, 0, 0, 3, 0]]))
    expect(mesh.triangles).toBe(1)
    expect([...mesh.positions]).toEqual([0, 0, 0, 2, 0, 0, 0, 3, 0])
    expect([...mesh.normals.slice(0, 3)]).toEqual([0, 0, 1])
    expect(mesh.min).toEqual([0, 0, 0])
    expect(mesh.max).toEqual([2, 3, 0])
  })

  it("parses ASCII STL, even when its header says solid", () => {
    const ascii = `solid cube
facet normal 0 0 0
  outer loop
    vertex 0 0 0
    vertex 0 1 0
    vertex 1 0 0
  endloop
endfacet
endsolid cube`
    const mesh = parseStl(new TextEncoder().encode(ascii).buffer as ArrayBuffer)
    expect(mesh.triangles).toBe(1)
    expect([...mesh.normals.slice(0, 3)]).toEqual([0, 0, -1])
  })

  it("rejects data that is neither", () => {
    expect(() => parseStl(new TextEncoder().encode("hello").buffer as ArrayBuffer)).toThrow()
  })

  it("detects .stl URLs", () => {
    expect(isStlUrl("models/part.STL")).toBe(true)
    expect(isStlUrl("https://x.dev/a.stl?raw=1")).toBe(true)
    expect(isStlUrl("https://x.dev/a.stl.html")).toBe(false)
  })

  it("renders {% embed %} of an .stl file as a viewer and round-trips the tag", () => {
    const md = '{% embed url="models/bracket.stl" title="Bracket" %}\n'
    expect(serializeMarkdown(parseMarkdown(md))).toBe(md)
    const html = renderToStaticMarkup(<MarkdownContent markdown={md} />)
    expect(html).toContain("docstream-stl")
    expect(html).toContain("Loading Bracket")
  })
})

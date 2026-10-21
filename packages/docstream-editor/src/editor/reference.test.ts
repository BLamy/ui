import { describe, expect, it } from "vitest"
import { parseMarkdown, serializeMarkdown } from "@brett_lamy/docstream/gitbook"

import { astToTiptap, tiptapToAst, type PMNode } from "./convert"
import { getGitbookSchema } from "./extensions"
import { resolveReferenceOptions } from "./reference-menu"

describe("reference chips in the editor", () => {
  it("round-trips mentions, tags, and citations through PM JSON", () => {
    const src = 'Ask @brett about #seasonal trends [^1].\n\n[^1]: https://scoopdata.io/q3 "ScoopData Q3"\n'
    const doc = parseMarkdown(src)
    const pm = astToTiptap(doc)
    const back = tiptapToAst(pm)
    expect(back.children).toEqual(doc.children)

    const para = pm.content![0]
    expect(para.content).toContainEqual({
      type: "gbReference",
      attrs: { kind: "mention", id: "brett", url: "", label: "" },
    })
    expect(para.content).toContainEqual({
      type: "gbReference",
      attrs: { kind: "citation", id: "1", url: "https://scoopdata.io/q3", label: "ScoopData Q3" },
    })
  })

  it("serializes back to the same markdown when citations are reattached", () => {
    const src = "Ping @dana [^a] and tag #ops.\n\n[^a]: https://example.com\n"
    const doc = parseMarkdown(src)
    const ast = tiptapToAst(astToTiptap(doc))
    ast.citations = doc.citations
    expect(serializeMarkdown(ast)).toBe(src)
  })

  it("keeps unknown-free filters: empty text dropped, references kept", () => {
    const roundtripped = tiptapToAst({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "" },
            { type: "gbReference", attrs: { kind: "tag", id: "x", url: "", label: "" } },
          ] as PMNode[],
        },
      ],
    })
    expect(roundtripped.children).toEqual([
      { type: "paragraph", children: [{ type: "reference", kind: "tag", id: "x" }] },
    ])
  })

  it("registers gbReference in the ProseMirror schema", () => {
    const schema = getGitbookSchema()
    expect(schema.nodes.gbReference).toBeDefined()
    expect(schema.nodes.gbReference.spec.inline).toBe(true)
  })
})

describe("codebase chips and reference sources", () => {
  it("round-trips $codebase chips through PM JSON and markdown", () => {
    const src = "Deploy $reading-room and $maple/stream-lab with @luna in #general.\n"
    const doc = parseMarkdown(src)
    const pm = astToTiptap(doc)
    expect(pm.content![0].content).toContainEqual({
      type: "gbReference",
      attrs: { kind: "codebase", id: "maple/stream-lab", url: "", label: "" },
    })
    expect(serializeMarkdown(tiptapToAst(pm))).toBe(src)
  })

  it("filters static sources by id or label and passes queries to async sources", async () => {
    const people = ["brett", { id: "luna", label: "Luna", group: "Agents" }]
    expect((await resolveReferenceOptions(people, "LU")).map((o) => o.id)).toEqual(["luna"])
    expect((await resolveReferenceOptions(people, "")).map((o) => o.id)).toEqual(["brett", "luna"])
    const seen: string[] = []
    const async = async (query: string) => {
      seen.push(query)
      return [{ id: `${query}-repo`, description: "codebase" }]
    }
    expect(await resolveReferenceOptions(async, "read")).toEqual([
      { id: "read-repo", description: "codebase" },
    ])
    expect(seen).toEqual(["read"])
    expect(await resolveReferenceOptions(undefined, "x")).toEqual([])
  })
})

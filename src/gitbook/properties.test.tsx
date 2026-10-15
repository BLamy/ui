import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { DocumentProperties } from "../docs/DocumentProperties"
import { MarkdownContent } from "../docs/DocsRenderer"
import { parseMarkdown } from "./parse"
import { serializeMarkdown } from "./serialize"
import { readDocumentProperties, removeDocumentProperty, setDocumentProperty } from "./properties"

describe("first-party document properties", () => {
  const source = '---\n# Task metadata\ntitle: "My note"\npriority: 4\ncomplete: false\ntags: [notes, work]\nowner: null\nsettings:\n  theme: dark\n---\n\n## Goal\n\nWrite the note.\n'
  it("separates YAML properties from the body and preserves their complete spelling", () => {
    const doc = parseMarkdown(source)
    expect(doc.children[0].type).toBe("heading")
    expect(readDocumentProperties(doc.properties!).values).toEqual({ title: "My note", priority: 4, complete: false, tags: ["notes", "work"], owner: null, settings: { theme: "dark" } })
    expect(serializeMarkdown(doc)).toBe(source)
    doc.children.push({ type: "paragraph", children: [{ type: "text", text: "Edited body." }] })
    expect(serializeMarkdown(doc).split("\n\n")[0]).toBe(source.split("\n\n")[0])
  })
  it.each([
    "---\n---\n",
    "---\ntitle: Note\n---\n",
    "\uFEFF---  \r\ntitle: Note\r\n...  \r\n\r\n# Heading\r\n\r\n",
    "---\ntitle: Note\n---\n# Heading\n",
  ])("round-trips frontmatter and body boundaries: %j", (markdown) => {
    expect(serializeMarkdown(parseMarkdown(markdown))).toBe(markdown)
  })
  it("does not turn incomplete frontmatter, later dividers or fenced YAML into properties", () => {
    for (const markdown of ["---\ntitle: Note\n", "# Heading\n\n---\ntitle: Note\n---\n", "```yaml\n---\ntitle: Note\n---\n```\n"]) {
      expect(parseMarkdown(markdown).properties).toBeUndefined()
      expect(serializeMarkdown(parseMarkdown(markdown))).toBe(markdown)
    }
  })
  it("changes one property without destroying comments, ordering, quoted strings or the body", () => {
    const doc = parseMarkdown(source)
    doc.properties = setDocumentProperty(doc.properties!, "priority", 7)
    const changed = serializeMarkdown(doc)
    expect(changed).toBe(source.replace("priority: 4", "priority: 7"))
    doc.properties = setDocumentProperty(doc.properties, "complete", true)
    doc.properties = setDocumentProperty(doc.properties, "new", "false")
    expect(readDocumentProperties(doc.properties).values).toMatchObject({ complete: true, new: "false" })
    doc.properties = removeDocumentProperty(doc.properties, "owner")
    expect(readDocumentProperties(doc.properties).values).not.toHaveProperty("owner")
  })
  it("keeps invalid YAML for repair and reports errors without damaging the body", () => {
    const markdown = "---\nitems: [\n---\n\n# Body\n"
    const doc = parseMarkdown(markdown)
    expect(readDocumentProperties(doc.properties!).error).toBeTruthy()
    expect(serializeMarkdown(doc)).toBe(markdown)
    expect(() => setDocumentProperty(doc.properties!, "title", "Note")).toThrow()
  })
  it("renders a compact property sheet with typed values and can hide it", () => {
    const html = renderToStaticMarkup(<MarkdownContent markdown={source} />)
    expect(html).toContain("data-document-properties")
    expect(html).toContain("My note")
    expect(html).toContain("<h2")
    expect(html).not.toContain("# Task metadata")
    expect(renderToStaticMarkup(<MarkdownContent markdown={source} documentProperties={false} />)).not.toContain("data-document-properties")
    const editable = renderToStaticMarkup(<DocumentProperties properties={parseMarkdown(source).properties!} onChange={() => {}} defaultOpen />)
    expect(editable).toContain('aria-label="priority"')
    expect(editable).toContain('type="number"')
    expect(editable).toContain('type="checkbox"')
    expect(editable).toContain("Add property")
  })
})

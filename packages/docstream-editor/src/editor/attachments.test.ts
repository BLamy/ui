import { describe, expect, it } from "vitest"
import { parseMarkdown } from "@brett_lamy/docstream/gitbook"
import { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { EditorState } from "@tiptap/pm/state"

import { GbAttachment, attachmentName, collectAttachmentIds, formatBytes, newAttachmentId } from "./attachments"
import { astToTiptap, serializeEditorMarkdown, tiptapToAst, type PMNode } from "./convert"
import { getGitbookSchema } from "./extensions"

const roundTrip = (md: string) => serializeEditorMarkdown(tiptapToAst(astToTiptap(parseMarkdown(md))))

describe("attachment chips", () => {
  it("maps an inline attachment: image to a gbAttachment chip and back", () => {
    const src = "See ![image.png](attachment:att-xyz) for the bug.\n"
    const pm = astToTiptap(parseMarkdown(src))
    expect(pm.content![0].content).toContainEqual({
      type: "gbAttachment",
      attrs: { id: "att-xyz", name: "image.png" },
    })
    expect(roundTrip(src)).toBe(src)
  })

  it("keeps a chip alone on its line a chip (not a figure)", () => {
    const src = "![Screen Shot 2026-09-01.png](attachment:att-1)\n"
    const pm = astToTiptap(parseMarkdown(src))
    expect(pm.content).toEqual([
      { type: "paragraph", content: [{ type: "gbAttachment", attrs: { id: "att-1", name: "Screen Shot 2026-09-01.png" } }] },
    ])
    expect(roundTrip(src)).toBe(src)
  })

  it("round-trips several chips, a trailing space, and the <img> spelling", () => {
    expect(roundTrip("![a.png](attachment:att-1) ![b.png](attachment:att-2) done\n")).toBe(
      "![a.png](attachment:att-1) ![b.png](attachment:att-2) done\n"
    )
    // A chip written as HTML stays HTML (the Markdown round-trips byte-for-byte); new chips are Markdown.
    expect(roundTrip('Look <img src="attachment:att-9" alt="x.png" /> here\n')).toBe(
      'Look <img src="attachment:att-9" alt="x.png" /> here\n'
    )
    // Serialized straight from editor JSON, as onChange does (chip + trailing space).
    const pm: PMNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Pasted " },
            { type: "gbAttachment", attrs: { id: "att-q", name: "image.png" } },
            { type: "text", text: " " },
          ],
        },
      ],
    }
    expect(serializeEditorMarkdown(tiptapToAst(pm))).toBe("Pasted ![image.png](attachment:att-q)\n")
  })

  it("leaves ordinary images alone", () => {
    const pm = astToTiptap(parseMarkdown("Badge ![ci](https://x.dev/b.svg)\n\n![shot](https://x.dev/s.png)\n"))
    expect(pm.content![0].content![1].type).toBe("gbInlineImage")
    expect(pm.content![1].type).toBe("gbFigure")
  })

  it("registers gbAttachment as an inline atom and finds chip ids in a document", () => {
    const schema = getGitbookSchema()
    const type = schema.nodes.gbAttachment
    expect(type).toBeDefined()
    expect(type.spec.inline).toBe(true)
    expect(type.spec.atom).toBe(true)

    const json = astToTiptap(parseMarkdown("One ![a](attachment:att-a)\n\n- item ![b](attachment:att-b)\n"))
    const doc = ProseMirrorNode.fromJSON(schema, json)
    expect([...collectAttachmentIds(doc)].sort()).toEqual(["att-a", "att-b"])
  })

  it("removeAttachment deletes every chip with the id", () => {
    const schema = getGitbookSchema()
    const doc = ProseMirrorNode.fromJSON(
      schema,
      astToTiptap(parseMarkdown("![a](attachment:att-a) and ![b](attachment:att-b) and ![a](attachment:att-a)\n"))
    )
    // Run the real command against a plain EditorState transaction (no DOM needed).
    const state = EditorState.create({ schema, doc })
    const tr = state.tr
    const commands = GbAttachment.config.addCommands!.call({ name: "gbAttachment" } as never) as unknown as {
      removeAttachment: (id: string) => (props: object) => boolean
    }
    expect(commands.removeAttachment("att-a")({ tr, state, dispatch: () => {} })).toBe(true)
    expect([...collectAttachmentIds(state.apply(tr).doc)]).toEqual(["att-b"])
    expect(commands.removeAttachment("att-zzz")({ tr: state.tr, state, dispatch: () => {} })).toBe(false)
  })

  it("formats sizes, names files, and mints ids", () => {
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(84 * 1024)).toBe("84 KB")
    expect(formatBytes(1.3 * 1024 * 1024)).toBe("1.3 MB")
    expect(formatBytes(undefined)).toBe("")
    expect(attachmentName(new File([], ""))).toBe("image.png")
    expect(attachmentName(new File([], "a [draft].png"))).toBe("a _draft_.png")
    expect(newAttachmentId()).toMatch(/^att-[a-z0-9]+$/)
  })
})

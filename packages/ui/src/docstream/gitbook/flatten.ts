import type { Block, DocumentNode } from "./ast"
import { text } from "./ast"

/**
 * docstream-only presentation blocks as plain Markdown, for LLM prompts and tools that don't
 * know docstream (`resolveDemosToMarkdown(…, { format: "plain" })`):
 *
 * - `{% command %}` → a ```` ```sh ```` fence with the npm command;
 * - titled `{% tabs title="Installation" %}` → a `## Installation` heading, then each tab as a
 *   bold label followed by its blocks.
 *
 * Everything else is kept (GitBook tags included — they're GitBook, not docstream).
 */
export function flattenForPlainMarkdown(doc: DocumentNode): DocumentNode {
  return { ...doc, children: flattenBlocks(doc.children) }
}

export function flattenBlocks(blocks: Block[]): Block[] {
  return blocks.flatMap((b): Block[] => {
    switch (b.type) {
      case "command":
        return [{ type: "code", language: "sh", title: null, lineNumbers: false, code: b.command }]
      case "tabs":
        if (b.title) {
          return [
            { type: "heading", level: b.level ?? 2, children: [text(b.title)] },
            ...b.tabs.flatMap((t): Block[] => [{ type: "paragraph", children: [text(t.title, { bold: true })] }, ...flattenBlocks(t.children)]),
          ]
        }
        return [{ ...b, tabs: b.tabs.map((t) => ({ ...t, children: flattenBlocks(t.children) })) }]
      case "hint":
      case "expandable":
      case "blockquote":
        return [{ ...b, children: flattenBlocks(b.children) }]
      case "stepper":
        return [{ ...b, steps: b.steps.map((s) => ({ ...s, children: flattenBlocks(s.children) })) }]
      case "columns":
        return [{ ...b, columns: b.columns.map((c) => ({ ...c, children: flattenBlocks(c.children) })) }]
      case "list":
        return [{ ...b, items: b.items.map((item) => ({ ...item, children: flattenBlocks(item.children) })) }]
      case "updates":
        return [{ ...b, updates: b.updates.map((u) => ({ ...u, children: flattenBlocks(u.children) })) }]
      default:
        return [b]
    }
  })
}

import type { Node as PmNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { lexSyntax, peekSyntax } from "@brett_lamy/ui/lib/syntax"

/**
 * Code-block syntax highlighting through the kit's lib/syntax, the driver docstream's renderer and CodeEditor use, so
 * edit and preview agree: gpu-lexer on hardware WebGPU (one queue for the page, an adapter probe, one cache, loaded
 * on the first code block), else the kit's synchronous lexer for the block's language. Lexing is async, so
 * decorations are built synchronously from lib/syntax's cache (`peekSyntax`), missing blocks are lexed in the
 * background, and a meta transaction re-decorates when results land.
 */

const MAX_CODE_UNITS = 128 * 1024

const languageOf = (node: PmNode): string | null => (typeof node.attrs.language === "string" ? node.attrs.language : null)
const cached = (node: PmNode) => peekSyntax(node.textContent, "auto", languageOf(node))

function highlightable(code: string) {
  return code.length > 0 && code.length <= MAX_CODE_UNITS
}

/**
 * Decorations from the span cache. A block whose new text is not tokenized yet keeps its
 * previous decorations mapped through the edit, so typing never flickers to plain.
 */
function decorationsFor(doc: PmNode, nodeName: string, previous?: DecorationSet): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== nodeName) return true
    const from = pos + 1
    const result = cached(node)
    if (!result) {
      if (previous) decorations.push(...previous.find(from, from + node.content.size))
      return false
    }
    for (const span of result.spans) {
      if (span.type === "plain" || span.end <= span.start) continue
      decorations.push(
        Decoration.inline(from + span.start, from + span.end, { class: `gb-syntax-${span.type}` }),
      )
    }
    return false
  })
  return DecorationSet.create(doc, decorations)
}

function missingBlocks(doc: PmNode, nodeName: string): Array<{ code: string; language: string | null }> {
  const missing = new Map<string, { code: string; language: string | null }>()
  doc.descendants((node) => {
    if (node.type.name !== nodeName) return true
    const code = node.textContent
    const language = languageOf(node)
    if (highlightable(code) && !cached(node)) missing.set(`${language ?? ""}\0${code}`, { code, language })
    return false
  })
  return [...missing.values()]
}

export function gpuHighlightPlugin(nodeName: string): Plugin {
  const key = new PluginKey<DecorationSet>("gpuHighlight")
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: (_, state) => decorationsFor(state.doc, nodeName),
      apply: (tr, previous) =>
        tr.docChanged || tr.getMeta(key)
          ? decorationsFor(tr.doc, nodeName, previous.map(tr.mapping, tr.doc))
          : previous,
    },
    props: {
      decorations(state) {
        return key.getState(state)
      },
    },
    view(view) {
      let destroyed = false
      let timer: ReturnType<typeof setTimeout> | undefined
      const request = () => {
        for (const { code, language } of missingBlocks(view.state.doc, nodeName)) {
          void lexSyntax(code, "auto", language).then(() => {
            if (!destroyed) view.dispatch(view.state.tr.setMeta(key, true))
          })
        }
      }
      request()
      return {
        update: (_view, previous) => {
          if (previous.doc.eq(view.state.doc)) return
          // One tokenize per typing pause, not per keystroke.
          clearTimeout(timer)
          timer = setTimeout(request, 150)
        },
        destroy: () => {
          destroyed = true
          clearTimeout(timer)
        },
      }
    },
  })
}

import type { Node as PmNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

/**
 * Code-block syntax highlighting through gpu-lexer — the same language-agnostic WebGPU
 * lexer docstream's renderer uses, so edit and preview agree. gpu-lexer is async, so
 * spans are cached by block text: decorations are built synchronously from the cache,
 * missing blocks are tokenized in the background, and a meta transaction re-decorates
 * when results land. Without WebGPU `parse` rejects and blocks stay plain.
 */

type SpanType =
  | "plain"
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "type"
  | "function"
  | "constant"
  | "operator"

interface Span {
  type: SpanType
  start: number
  end: number
}

const MAX_CODE_UNITS = 128 * 1024
const CACHE_LIMIT = 256

let lexer: Promise<(code: string) => Promise<Span[]>> | undefined
const cache = new Map<string, Span[] | null>()
const pending = new Map<string, Promise<void>>()

function remember(code: string, spans: Span[] | null) {
  cache.set(code, spans)
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
}

function tokenize(code: string): Promise<void> {
  const inflight = pending.get(code)
  if (inflight) return inflight
  // Loaded on first code block so the model stays out of the editor's initial bundle.
  lexer ??= import("gpu-lexer").then((module) => module.parse as (code: string) => Promise<Span[]>)
  const run = lexer
    .then((parse) => parse(code))
    .then(
      (spans) => remember(code, spans),
      () => remember(code, null),
    )
    .finally(() => pending.delete(code))
  pending.set(code, run)
  return run
}

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
    const spans = cache.get(node.textContent)
    if (!spans) {
      if (previous) decorations.push(...previous.find(from, from + node.content.size))
      return false
    }
    for (const span of spans) {
      if (span.type === "plain" || span.end <= span.start) continue
      decorations.push(
        Decoration.inline(from + span.start, from + span.end, { class: `gb-syntax-${span.type}` }),
      )
    }
    return false
  })
  return DecorationSet.create(doc, decorations)
}

function missingBlocks(doc: PmNode, nodeName: string): string[] {
  const missing = new Set<string>()
  doc.descendants((node) => {
    if (node.type.name !== nodeName) return true
    const code = node.textContent
    if (highlightable(code) && !cache.has(code)) missing.add(code)
    return false
  })
  return [...missing]
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
        for (const code of missingBlocks(view.state.doc, nodeName)) {
          void tokenize(code).then(() => {
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

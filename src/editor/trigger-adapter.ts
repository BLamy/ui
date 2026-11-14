import type { Editor } from "@tiptap/core"
import type { Node as PMNodeType } from "@tiptap/pm/model"
import { closeHistory } from "@tiptap/pm/history"
import { TextSelection, type Transaction } from "@tiptap/pm/state"
import type { EditorChange, TextEditorAdapter, TextRange, TokenInsert } from "@ui-sdk/core/trigger-menu"

/** What a token becomes in the document. */
export type TokenToNodes = (token: TokenInsert, editor: Editor) => PMNodeType | PMNodeType[] | null

export interface TiptapTriggerAdapterOptions {
  /** Turns a token into nodes: given, the adapter accepts tokens (`tokens: true`). */
  token?: TokenToNodes
}

// A leaf (a chip, an image, a hard break) reads as one character, as the adapter contract asks.
const LEAF = "￼"

/**
 * A UI SDK `TextEditorAdapter` for a Tiptap editor, so a `TriggerMenu` can suggest into it.
 *
 * Its text offsets are ProseMirror positions. Inside one textblock a position is one character (a
 * text character, or U+FFFC for a leaf), and a trigger menu only reads before the caret, so a match
 * never crosses a block: `textBefore` stops at the caret's textblock, and reads its start as a line
 * break (one position, the block's opening), so a trigger at the start of a paragraph is at a word
 * boundary. Code blocks and inline code offer no suggestions.
 */
export function tiptapTriggerAdapter(editor: Editor, { token }: TiptapTriggerAdapterOptions = {}): TextEditorAdapter {
  const view = () => {
    if (editor.isDestroyed) return undefined
    try {
      return editor.view
    } catch {
      return undefined
    }
  }
  const focused = () => {
    const v = view()
    return !!v && (v.hasFocus() || v.dom.ownerDocument.activeElement === v.dom)
  }

  return {
    get element() {
      const dom = view()?.dom
      return dom?.isConnected ? dom : undefined
    },
    textBefore(length) {
      const { selection, doc, schema } = editor.state
      const { $from, from } = selection
      const block = $from.parent
      if (!block.isTextblock || block.type.spec.code) return null
      const code = schema.marks.code
      if (code && code.isInSet($from.marks())) return null
      const blockStart = $from.start()
      const start = Math.max(blockStart, from - length)
      const text = doc.textBetween(start, from, "\n", LEAF)
      if (text.length !== from - start) return null
      // Reaching past the block's start: its opening reads as a line break.
      return start === blockStart && from - length < blockStart && blockStart > 0
        ? { text: `\n${text}`, offset: blockStart - 1 }
        : { text, offset: start }
    },
    selection() {
      if (!focused()) return null
      const { from, to } = editor.state.selection
      return { start: from, end: to }
    },
    rectAt(offset) {
      const v = view()
      if (!v) return null
      try {
        const at = Math.max(0, Math.min(offset, v.state.doc.content.size))
        const { left, top, bottom } = v.coordsAtPos(at)
        return { x: left, y: top, width: 0, height: bottom - top }
      } catch {
        return null
      }
    },
    replace(range, content) {
      const v = view()
      if (!v) return
      const { state } = v
      let tr = state.tr
      if (typeof content === "string") {
        tr = content ? tr.insertText(content, range.start, range.end) : tr.delete(range.start, range.end)
        tr.setSelection(TextSelection.create(tr.doc, range.start + content.length))
      } else {
        const nodes = token?.(content, editor)
        if (!nodes) return
        tr = tr.replaceWith(range.start, range.end, nodes)
        const size = (Array.isArray(nodes) ? nodes : [nodes]).reduce((sum, node) => sum + node.nodeSize, 0)
        tr.setSelection(TextSelection.create(tr.doc, range.start + size))
      }
      // Its own undo step: undo brings the query back.
      v.dispatch(closeHistory(tr).scrollIntoView())
    },
    subscribe(listener) {
      const onTransaction = ({ transaction }: { transaction: Transaction }) => {
        if (transaction.docChanged) listener(inputChange(transaction))
        else if (transaction.selectionSet) listener({ type: "selection" })
      }
      const onFocus = () => listener({ type: "selection" })
      const dom = view()?.dom
      const onCompositionStart = () => listener({ type: "compositionstart" })
      const onCompositionEnd = () => listener({ type: "compositionend" })
      editor.on("transaction", onTransaction)
      editor.on("focus", onFocus)
      editor.on("blur", onFocus)
      dom?.addEventListener("compositionstart", onCompositionStart)
      dom?.addEventListener("compositionend", onCompositionEnd)
      return () => {
        editor.off("transaction", onTransaction)
        editor.off("focus", onFocus)
        editor.off("blur", onFocus)
        dom?.removeEventListener("compositionstart", onCompositionStart)
        dom?.removeEventListener("compositionend", onCompositionEnd)
      }
    },
    composing: () => !!view()?.composing,
    tokens: !!token,
  }
}

// The range a transaction replaced, in the old document's positions, and what now stands there.
function inputChange(tr: Transaction): EditorChange {
  let start = Infinity
  let end = -Infinity
  let newStart = Infinity
  let newEnd = -Infinity
  const maps = tr.mapping.maps
  maps.forEach((map, index) => {
    map.forEach((oldStart, oldEnd, nextStart, nextEnd) => {
      const back = tr.mapping.slice(0, index).invert()
      const ahead = tr.mapping.slice(index + 1)
      start = Math.min(start, back.map(oldStart, -1))
      end = Math.max(end, back.map(oldEnd, 1))
      newStart = Math.min(newStart, ahead.map(nextStart, -1))
      newEnd = Math.max(newEnd, ahead.map(nextEnd, 1))
    })
  })
  if (start === Infinity) {
    start = end = newStart = newEnd = tr.selection.from
  }
  const size = Math.max(0, newEnd - newStart)
  let inserted = tr.doc.textBetween(newStart, newEnd, "\n", LEAF)
  // One character per position, so offsets after the edit line up.
  if (inserted.length !== size) inserted = inserted.padEnd(size, LEAF).slice(0, size)
  const range: TextRange = { start, end: Math.max(start, end) }
  // A collaborator's change, content set by the host, or a change kept out of history isn't typing.
  const user = !tr.getMeta("y-sync$") && !tr.getMeta("preventUpdate") && tr.getMeta("addToHistory") !== false
  return { type: "input", inserted, range, user }
}

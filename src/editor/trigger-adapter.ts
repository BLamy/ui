import type { Editor } from "@tiptap/core"
import type { Node as PMNodeType } from "@tiptap/pm/model"
import { closeHistory } from "@tiptap/pm/history"
import { TextSelection, type Transaction } from "@tiptap/pm/state"
import { Mapping } from "@tiptap/pm/transform"
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

  // Every subscriber hears the same changes, from one set of editor and DOM listeners.
  const listeners = new Set<(change: EditorChange) => void>()
  const emit = (change: EditorChange) => {
    for (const listener of [...listeners]) listener(change)
  }
  // The edits since compositionstart, while an input method composes.
  let composition: Composition | null = null
  // Bumped when a composition ends, so a queued end that's been overtaken does nothing.
  let ending = 0

  // An input method's text arrives as transactions while ProseMirror is composing. Like UI SDK's own
  // text adapters, the menu hears none of it until composition ends, and then one input change
  // covering all of it, so the composed text is the query at once.
  const onTransaction = ({ transaction }: { transaction: Transaction }) => {
    if (composition) {
      if (transaction.docChanged) {
        composition.mapping.appendMapping(transaction.mapping)
        composition.user &&= isUser(transaction)
      }
      return
    }
    if (transaction.docChanged) emit(inputChange(transaction.mapping, transaction.doc, transaction.selection.from, isUser(transaction)))
    else if (transaction.selectionSet) emit({ type: "selection" })
  }
  const finish = () => {
    const done = composition
    composition = null
    ending++
    if (!done) return
    emit({ type: "compositionend" })
    if (done.mapping.maps.length) emit(inputChange(done.mapping, editor.state.doc, editor.state.selection.from, done.user))
    else emit({ type: "selection" })
  }
  const onFocus = () => emit({ type: "selection" })
  const onBlur = () => {
    // A composition cut short by leaving the editor may get no compositionend.
    finish()
    emit({ type: "selection" })
  }
  const onCompositionStart = () => {
    // ProseMirror's own listener ran first and flushed what came before, so this starts clean.
    // One that starts before the last one's end was reported carries on from it.
    if (composition) ending++
    else composition = { mapping: new Mapping(), user: true }
    emit({ type: "compositionstart" })
  }
  const onCompositionEnd = () => {
    if (!composition) return
    // ProseMirror has cleared `composing`, and flushes its last DOM changes in a microtask it queued
    // before this one: report once those are in.
    const at = ending
    queueMicrotask(() => {
      if (at === ending) finish()
    })
  }
  let detach: (() => void) | null = null
  const attach = () => {
    const dom = view()?.dom
    editor.on("transaction", onTransaction)
    editor.on("focus", onFocus)
    editor.on("blur", onBlur)
    dom?.addEventListener("compositionstart", onCompositionStart)
    dom?.addEventListener("compositionend", onCompositionEnd)
    return () => {
      composition = null
      ending++
      editor.off("transaction", onTransaction)
      editor.off("focus", onFocus)
      editor.off("blur", onBlur)
      dom?.removeEventListener("compositionstart", onCompositionStart)
      dom?.removeEventListener("compositionend", onCompositionEnd)
    }
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
      // Its own entry, so the same function subscribed twice is two subscriptions.
      const entry = (change: EditorChange) => listener(change)
      listeners.add(entry)
      detach ??= attach()
      return () => {
        listeners.delete(entry)
        if (!listeners.size && detach) {
          detach()
          detach = null
        }
      }
    },
    composing: () => !!composition || !!view()?.composing,
    tokens: !!token,
  }
}

type Composition = { mapping: Mapping; user: boolean }

// A collaborator's change, content set by the host, or a change kept out of history isn't typing.
function isUser(tr: Transaction): boolean {
  return !tr.getMeta("y-sync$") && !tr.getMeta("preventUpdate") && tr.getMeta("addToHistory") !== false
}

// The range a mapping's steps replaced, in the old document's positions, and what now stands there in `doc`.
function inputChange(mapping: Mapping, doc: PMNodeType, caret: number, user: boolean): EditorChange {
  let start = Infinity
  let end = -Infinity
  let newStart = Infinity
  let newEnd = -Infinity
  mapping.maps.forEach((map, index) => {
    map.forEach((oldStart, oldEnd, nextStart, nextEnd) => {
      const back = mapping.slice(0, index).invert()
      const ahead = mapping.slice(index + 1)
      start = Math.min(start, back.map(oldStart, -1))
      end = Math.max(end, back.map(oldEnd, 1))
      newStart = Math.min(newStart, ahead.map(nextStart, -1))
      newEnd = Math.max(newEnd, ahead.map(nextEnd, 1))
    })
  })
  if (start === Infinity) {
    start = end = newStart = newEnd = caret
  }
  const size = Math.max(0, newEnd - newStart)
  let inserted = doc.textBetween(newStart, newEnd, "\n", LEAF)
  // One character per position, so offsets after the edit line up.
  if (inserted.length !== size) inserted = inserted.padEnd(size, LEAF).slice(0, size)
  const range: TextRange = { start, end: Math.max(start, end) }
  return { type: "input", inserted, range, user }
}

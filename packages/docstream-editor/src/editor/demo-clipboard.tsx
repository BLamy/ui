/* Demo-aware copy / cut / paste / drag for the editor.

   Copy / cut: when the selection holds `{% demo %}` blocks, ProseMirror steps aside and
   react-aria's `useClipboard` (bridged onto the ProseMirror element's focus) writes one item
   with `text/plain` + `text/markdown` (renderable Markdown, every demo's files inline —
   resolver files for src-only demos) and `application/x-docstream+json` (the exact Markdown
   plus files and meta by `src`). Anything else keeps ProseMirror's normal copy.

   Paste: a docstream payload (preferred) is read through the same `useClipboard`; its demos
   keep their inline files and every demo's files go into the editor's `DemoVFS`. Markdown-only
   clipboards take the editor's Markdown paste, and their inline-file demos are registered too.

   Drag: a demo block's grip drags the same payload (native HTML5 drag); dropping it into
   another docstream editor inserts it there (copy), within the same editor it moves. */
import { useEffect, useRef } from "react"
import type { Editor as TiptapEditor } from "@tiptap/react"
import { useClipboard } from "react-aria"
import {
  createDocstreamClipboard,
  docstreamClipboardItems,
  inlineDemoNode,
  mapDemoNodes,
  peekDemoSource,
  readDocstreamClipboardItems,
  type DemoResolver,
  type DemoSourceSnapshot,
  type DemoVFS,
  type DocstreamClipboard,
  type DocstreamClipboardPayload,
} from "@brett_lamy/docstream/demo"
import { parseMarkdown, type CitationDef, type DemoNode, type DocumentNode } from "@brett_lamy/docstream/gitbook"
import { astToTiptap, serializeEditorMarkdown, tiptapToAst, type PMNode } from "./convert"

/**
 * Where a pasted demo's files live.
 * - `"inline"` (default): in the VFS, and also inline in the block unless the host resolver
 *   lists its `src` — the document stays self-contained when saved.
 * - `"vfs"`: only in the VFS; blocks keep exactly the structure they were copied with
 *   (src-only stays src-only). Persist the files with `onDemoFilesChange`.
 */
export type PastedDemoFiles = "inline" | "vfs"

export interface DemoSources {
  resolver?: DemoResolver
  vfs?: DemoVFS
}

/** A demo's files as the editor knows them right now: the resolver's (already fetched), else the VFS's. */
export function lookupDemoSource(node: DemoNode, { resolver, vfs }: DemoSources): DemoSourceSnapshot | undefined {
  if (!node.src) return undefined
  const known = !resolver?.list || resolver.list().includes(node.src)
  const fromResolver = resolver && known ? peekDemoSource(resolver, node.src) : undefined
  if (fromResolver) return fromResolver
  const entry = vfs?.get(node.src)
  return entry?.files.length ? entry : undefined
}

/** The clipboard for a document fragment (editor JSON), with the editor's serializer. */
export function clipboardForDoc(doc: DocumentNode, sources: DemoSources): DocstreamClipboard {
  return createDocstreamClipboard(doc, { lookup: (node) => lookupDemoSource(node, sources), serialize: serializeEditorMarkdown })
}

function sliceHasDemo(editor: TiptapEditor): boolean {
  const { selection } = editor.state
  if (selection.empty) return false
  let found = false
  editor.state.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (found) return false
    if (node.type.name === "gbDemo") found = true
    return !found
  })
  return found
}

/** The clipboard for the current selection, or null when it holds no demo blocks. */
export function selectionClipboard(editor: TiptapEditor, sources: DemoSources): DocstreamClipboard | null {
  if (!sliceHasDemo(editor)) return null
  const slice = editor.state.selection.content()
  const doc = tiptapToAst({ type: "doc", content: slice.content.toJSON() as PMNode[] })
  return clipboardForDoc(doc, sources)
}

/** Registers every demo's files from a payload in the VFS. */
export function registerPayloadFiles(vfs: DemoVFS | undefined, payload: DocstreamClipboardPayload): void {
  if (!vfs) return
  for (const [src, files] of Object.entries(payload.files)) if (src && files.length) vfs.set(src, files, payload.meta[src])
}

/** Editor content for a pasted / dropped payload (after registering its files). */
export function payloadContent(
  payload: DocstreamClipboardPayload,
  { resolver, vfs, mode = "inline" }: DemoSources & { mode?: PastedDemoFiles },
): { content: PMNode[]; citations?: CitationDef[] } {
  registerPayloadFiles(vfs, payload)
  const parsed = parseMarkdown(payload.markdown)
  const doc =
    mode === "inline"
      ? mapDemoNodes(parsed, (node) => {
          const files = node.src ? payload.files[node.src] : undefined
          if (node.files?.length || !files?.length || resolver?.list?.().includes(node.src)) return node
          return inlineDemoNode(node, files, payload.meta[node.src])
        })
      : parsed
  return { content: astToTiptap(doc).content ?? [], ...(parsed.citations?.length ? { citations: parsed.citations } : {}) }
}

/* ---------- drag ---------- */

let activeDrag: { editor: TiptapEditor; pos: number } | null = null

/** Called by a demo block's grip on dragstart / dragend. */
export function setActiveDemoDrag(drag: { editor: TiptapEditor; pos: number } | null): void {
  activeDrag = drag
}

/** The demo block being dragged out of `editor`, if the drag started there. */
export function takeActiveDemoDrag(editor: TiptapEditor): number | null {
  const drag = activeDrag
  activeDrag = null
  return drag && drag.editor === editor ? drag.pos : null
}

/* ---------- react-aria clipboard bridge ---------- */

export interface ClipboardBridge {
  /** Whether react-aria's clipboard handlers are live (the ProseMirror element has focus). */
  focused: () => boolean
  /** Hand react-aria the clipboard for this copy / cut event. */
  arm: (clip: DocstreamClipboard, cut: boolean) => void
  /** Let react-aria's paste handler take this paste event. */
  armPaste: () => void
}

/**
 * Runs react-aria's `useClipboard` for the editor. `useClipboard` tracks focus through React
 * focus props; ProseMirror's element isn't rendered by React, so its native focus / blur
 * events are forwarded (react-aria itself wraps native events the same way).
 */
export function useEditorClipboard(
  editor: TiptapEditor | null,
  handlers: { onCut: () => void; onPastePayload: (payload: DocstreamClipboardPayload) => void },
): ClipboardBridge {
  const armed = useRef<{ clip: DocstreamClipboard; cut: boolean } | null>(null)
  const cutting = useRef(false)
  const pasting = useRef(false)
  const focused = useRef(false)
  const latest = useRef(handlers)
  latest.current = handlers

  const { clipboardProps } = useClipboard({
    getItems: ({ action }) => {
      const job = armed.current
      armed.current = null
      cutting.current = !!job && job.cut && action === "cut"
      return job ? docstreamClipboardItems(job.clip) : []
    },
    onCut: () => {
      if (!cutting.current) return
      cutting.current = false
      latest.current.onCut()
    },
    onPaste: (items) => {
      if (!pasting.current) return
      pasting.current = false
      void readDocstreamClipboardItems(items).then((payload) => {
        if (payload) latest.current.onPastePayload(payload)
      })
    },
  })

  const props = useRef(clipboardProps)
  props.current = clipboardProps
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const dom = editor.view.dom as HTMLElement
    const onFocus = (event: FocusEvent) => {
      focused.current = true
      ;(props.current.onFocus as ((e: unknown) => void) | undefined)?.(synthetic(event))
    }
    const onBlur = (event: FocusEvent) => {
      focused.current = false
      ;(props.current.onBlur as ((e: unknown) => void) | undefined)?.(synthetic(event))
    }
    dom.addEventListener("focus", onFocus)
    dom.addEventListener("blur", onBlur)
    if (dom.ownerDocument.activeElement === dom) onFocus(new FocusEvent("focus"))
    return () => {
      dom.removeEventListener("focus", onFocus)
      dom.removeEventListener("blur", onBlur)
      if (focused.current) onBlur(new FocusEvent("blur"))
    }
    function synthetic(event: FocusEvent) {
      // Shaped like React's synthetic focus event, as react-aria's own `createSyntheticEvent`.
      const e = event as FocusEvent & { nativeEvent?: Event; isDefaultPrevented?: () => boolean; isPropagationStopped?: () => boolean; persist?: () => void }
      if (!e.target || e.target !== dom) {
        Object.defineProperty(e, "target", { value: dom, configurable: true })
      }
      Object.defineProperty(e, "currentTarget", { value: dom, configurable: true })
      e.nativeEvent = event
      e.isDefaultPrevented = () => event.defaultPrevented
      e.isPropagationStopped = () => false
      e.persist = () => {}
      return e
    }
  }, [editor])

  return {
    focused: () => focused.current,
    arm: (clip, cut) => {
      armed.current = { clip, cut }
    },
    armPaste: () => {
      pasting.current = true
    },
  }
}

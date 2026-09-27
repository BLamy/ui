import { useEffect, useMemo, useRef } from "react"
import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react"
import type { AnyExtension } from "@tiptap/core"
import {
  Bold,
  Code as CodeIcon,
  Italic,
  Link2,
  SlashSquare,
  Strikethrough,
} from "lucide-react"

import { parseMarkdown, type CitationDef } from "@brett_lamy/docstream/gitbook"
import type { DemoResolver, InlineDemoRuntime } from "@brett_lamy/docstream/demo"
import type { SourceFileSnapshot, SourceReferenceClient } from "@brett_lamy/docstream/source"
import {
  attachmentName,
  collectAttachmentIds,
  imageFilesFrom,
  newAttachmentId,
  readFileAsDataURL,
  type EditorAttachment,
} from "./attachments"
import { astToTiptap, markdownPasteContent, serializeEditorMarkdown, tiptapToAst, type PMNode } from "./convert"
import { createGitbookExtensions, type ReferenceSources } from "./extensions"
import { EditorRuntimeProvider } from "./runtime"
import type { SlashItem } from "./slash-menu"

export type { EditorAttachment } from "./attachments"

export interface GitbookEditorProps {
  /** Markdown source. When provided, the editor stays in sync with it (controlled). */
  markdown?: string
  /** Called with serialized GitBook markdown on every edit. */
  onChange?: (markdown: string) => void
  /** Show the built-in formatting toolbar (default true). */
  toolbar?: boolean
  /** Built-in "/" slash menu: true (default), false, or a custom item list. */
  slashMenu?: boolean | { items?: SlashItem[] }
  /**
   * Reference chip pickers: true (default "@"/"#"), false, or per-trigger sources —
   * static lists or async `(query) => options`. A `codebases` source enables "$".
   */
  references?: boolean | ReferenceSources
  /** Whether the document is editable (default true). */
  editable?: boolean
  /** Placeholder shown in an empty document. */
  placeholder?: string
  /** Class applied to the editor wrapper. */
  className?: string
  /** Focus the editor on mount. */
  autofocus?: boolean
  /**
   * Disable StarterKit's undo/redo — required when supplying a Yjs Collaboration
   * extension via `extensions`, which manages shared history itself.
   */
  disableHistory?: boolean
  /** Extra TipTap extensions appended last (e.g. Collaboration, CollaborationCursor). */
  extensions?: AnyExtension[]
  /** Handle a key before the editor's built-in keymaps. Return true when handled. */
  onKeyDown?: (event: KeyboardEvent) => boolean
  /** Handle clipboard content before the editor's built-in paste behavior. Return true when handled. */
  onPaste?: (event: ClipboardEvent) => boolean
  /**
   * How pasted or dropped image files enter the document.
   * "inline" (default) — an image block with the file as a data URL, as it will render.
   * "chip" — a compact attachment chip at the caret; the host owns the file via `attachments`.
   */
  imagePaste?: "inline" | "chip"
  /** Chip mode: the host's attachment store. Chips look up their thumbnail, full image and size here by id. */
  attachments?: EditorAttachment[]
  /** Chip mode: fired once per pasted/dropped image with a fresh id and the file read as a data URL. Add it to `attachments`. */
  onAttachmentAdd?: (attachment: EditorAttachment & { file: File }) => void
  /** Chip mode: fired when chips disappear from the document (deleted, cut, cleared) with their ids. */
  onAttachmentRemove?: (ids: string[]) => void
  /** Chip mode: clicking (or Enter/Space on a focused) chip. Omit to open the built-in image viewer. */
  onAttachmentOpen?: (attachment: EditorAttachment) => void
  /** Receive the underlying TipTap editor instance (and null on teardown). */
  onEditorReady?: (editor: TiptapEditor | null) => void
  /** Client used to edit and preview `{% source-ref %}` files. */
  sourceClient?: SourceReferenceClient
  /** Show the rendered export below a file-backed source editor (default true). */
  sourcePreview?: boolean
  /** Autosave file-backed source edits. `true` defaults to 500ms; a number sets the delay. */
  sourceAutoSave?: boolean | number
  /** Called after a file-backed source edit is written. */
  onSourceSaved?: (snapshot: SourceFileSnapshot) => void
  /** Called when reading, writing, or previewing a file-backed source fails. */
  onSourceError?: (error: Error) => void
  /**
   * Resolves `{% demo src %}` ids. Demo blocks show docstream's (read-only) DemoViewer under
   * their header: from the resolver when it knows `src`, otherwise from the files the block
   * carries inline (a pasted Copy-page export), so the block looks like the docs page.
   */
  demoResolver?: DemoResolver
  /**
   * Runs the Preview of demos that carry their files inline and have no resolver behind them
   * (as `DocRenderOptions.demoRuntime`), e.g. `createAlmostNodeDemoRuntime()` from
   * `@brett_lamy/docstream/playground`. Without one, such demos show their code with a note.
   */
  demoRuntime?: InlineDemoRuntime
  /** Extra npm dependencies inline demos may import (as `DocRenderOptions.demoDependencies`). */
  demoDependencies?: Record<string, string>
  /**
   * Parse pasted plain-text Markdown that contains blocks (a docs page's "Copy page", a
   * `{% … %}` block, a fence, a list …) into editor blocks instead of literal text (default true).
   */
  markdownPaste?: boolean
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      className={`gb-tool ${active ? "gb-tool-active" : ""}`}
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: TiptapEditor }) {
  const chain = () => editor.chain().focus()
  return (
    <div className="gb-toolbar">
      <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()}>
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()}>
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton title="Strike" active={editor.isActive("strike")} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough className="size-4" />
      </ToolbarButton>
      <ToolbarButton title="Inline code" active={editor.isActive("code")} onClick={() => chain().toggleCode().run()}>
        <CodeIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Link"
        active={editor.isActive("link")}
        onClick={() => {
          const url = window.prompt("URL")
          if (url) chain().setLink({ href: url }).run()
          else chain().unsetLink().run()
        }}
      >
        <Link2 className="size-4" />
      </ToolbarButton>
      <span className="gb-toolbar-hint">
        <SlashSquare className="size-3.5" /> Type <kbd>/</kbd> for blocks
      </span>
    </div>
  )
}

export function GitbookEditor({
  markdown,
  onChange,
  toolbar = true,
  slashMenu = true,
  references = true,
  editable = true,
  placeholder,
  className,
  autofocus = false,
  disableHistory,
  extensions,
  onKeyDown,
  onPaste,
  imagePaste = "inline",
  attachments,
  onAttachmentAdd,
  onAttachmentRemove,
  onAttachmentOpen,
  onEditorReady,
  sourceClient,
  sourcePreview = true,
  sourceAutoSave = true,
  onSourceSaved,
  onSourceError,
  demoResolver,
  demoRuntime,
  demoDependencies,
  markdownPaste = true,
}: GitbookEditorProps) {
  // Tracks the markdown the editor itself produced, so external updates
  // (file switches) reset content but our own onChange echoes don't.
  const lastEmitted = useRef<string | null>(null)
  // PM JSON has nowhere to carry doc-level citation definitions; remember the
  // ones from the last applied markdown and reattach them on serialize.
  const citationsRef = useRef<CitationDef[] | undefined>(undefined)
  const controlled = markdown !== undefined
  // Ids of the attachment chips in the document, to report removals.
  const attachmentIds = useRef<Set<string>>(new Set())
  // Latest callbacks for handlers the editor captured at creation.
  const latest = useRef({ onPaste, imagePaste, onAttachmentAdd, onAttachmentRemove, markdownPaste })
  latest.current = { onPaste, imagePaste, onAttachmentAdd, onAttachmentRemove, markdownPaste }
  const editorRef = useRef<TiptapEditor | null>(null)

  // Pasted/dropped image files: image blocks ("inline") or attachment chips ("chip").
  const insertImageFiles = (files: File[], at?: number) => {
    const ed = editorRef.current
    if (!ed) return
    const insert = (content: PMNode[]) => {
      const chain = ed.chain().focus()
      const pos = at === undefined ? undefined : Math.min(at, ed.state.doc.content.size)
      ;(pos === undefined ? chain.insertContent(content) : chain.insertContentAt(pos, content)).run()
    }
    if (latest.current.imagePaste === "chip") {
      const items = files.map((file) => ({ file, id: newAttachmentId(), name: attachmentName(file) }))
      // Keep chips off the preceding word: "done.[chip]" → "done. [chip]".
      const $at = at === undefined ? ed.state.selection.$from : ed.state.doc.resolve(Math.min(at, ed.state.doc.content.size))
      const before = $at.parent.isTextblock ? $at.parent.textBetween(Math.max(0, $at.parentOffset - 1), $at.parentOffset, "", "\uFFFC") : ""
      const lead: PMNode[] = before && !/\s/.test(before) ? [{ type: "text", text: " " }] : []
      insert([
        ...lead,
        ...items.flatMap(({ id, name }): PMNode[] => [
          { type: "gbAttachment", attrs: { id, name } },
          { type: "text", text: " " },
        ]),
      ])
      for (const { file, id, name } of items) {
        const base = { id, name, size: file.size, type: file.type, file }
        readFileAsDataURL(file).then(
          (src) => latest.current.onAttachmentAdd?.({ ...base, src }),
          () => latest.current.onAttachmentAdd?.(base)
        )
      }
      return
    }
    void Promise.all(
      files.map((file) =>
        readFileAsDataURL(file).then(
          (src): PMNode => ({ type: "gbFigure", attrs: { src, alt: attachmentName(file), caption: "" } }),
          () => null
        )
      )
    ).then((figures) => {
      const content = figures.filter((f): f is PMNode => f !== null)
      if (content.length && !ed.isDestroyed) insert(content)
    })
  }

  // Plain-text Markdown (e.g. a docs page's "Copy page") becomes blocks, not literal text.
  // Rich HTML clipboards keep ProseMirror's own handling; code editors (VS Code) also
  // put styled HTML there, so their payload still counts as plain text.
  const pasteMarkdown = (event: ClipboardEvent): boolean => {
    const data = event.clipboardData
    const ed = editorRef.current
    if (!data || !ed) return false
    const types = Array.from(data.types ?? [])
    if (types.includes("text/html") && !types.includes("vscode-editor-data")) return false
    const pasted = markdownPasteContent(data.getData("text/plain"))
    if (!pasted?.content.length) return false
    event.preventDefault()
    if (pasted.citations) {
      const known = new Map((citationsRef.current ?? []).map((c) => [c.id, c]))
      for (const c of pasted.citations) known.set(c.id, c)
      citationsRef.current = [...known.values()]
    }
    ed.chain().focus().insertContent(pasted.content).run()
    return true
  }

  const parseAndTrack = (md: string) => {
    const doc = parseMarkdown(md)
    citationsRef.current = doc.citations
    return doc
  }

  const editor = useEditor({
    editable,
    autofocus,
    extensions: createGitbookExtensions({
      ...(placeholder !== undefined ? { placeholder } : {}),
      slashMenu,
      references,
      ...(disableHistory !== undefined ? { disableHistory } : {}),
      ...(extensions ? { extensions } : {}),
    }),
    editorProps: {
      handleKeyDown: (_view, event) => onKeyDown?.(event) ?? false,
      handlePaste: (view, event) => {
        if (latest.current.onPaste?.(event)) return true
        if (!view.editable || view.state.selection.$from.parent.type.spec.code) return false
        const files = imageFilesFrom(event.clipboardData, { ignoreWithText: true })
        if (files.length) {
          event.preventDefault()
          insertImageFiles(files)
          return true
        }
        return latest.current.markdownPaste ? pasteMarkdown(event) : false
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved || !view.editable) return false
        const files = imageFilesFrom(event.dataTransfer)
        if (!files.length) return false
        event.preventDefault()
        insertImageFiles(files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos)
        return true
      },
    },
    ...(controlled ? { content: astToTiptap(parseAndTrack(markdown as string)) } : {}),
    onCreate({ editor }) {
      attachmentIds.current = collectAttachmentIds(editor.state.doc)
    },
    onUpdate({ editor }) {
      const ids = collectAttachmentIds(editor.state.doc)
      const removed = [...attachmentIds.current].filter((id) => !ids.has(id))
      attachmentIds.current = ids
      if (removed.length) latest.current.onAttachmentRemove?.(removed)
      if (!onChange) return
      const ast = tiptapToAst(editor.getJSON() as PMNode)
      if (citationsRef.current?.length) ast.citations = citationsRef.current
      const md = serializeEditorMarkdown(ast)
      lastEmitted.current = md
      onChange(md)
    },
  })

  editorRef.current = editor ?? null

  // Surface the editor instance to the host (for awareness, commands, etc.).
  useEffect(() => {
    onEditorReady?.(editor ?? null)
    return () => onEditorReady?.(null)
  }, [editor, onEditorReady])

  useEffect(() => {
    // StrictMode (and <Activity>) re-run effects against an editor useEditor has already destroyed.
    if (!editor || editor.isDestroyed || !controlled) return
    if (markdown === lastEmitted.current) return
    lastEmitted.current = markdown as string
    const doc = parseMarkdown(markdown as string)
    citationsRef.current = doc.citations
    editor.commands.setContent(astToTiptap(doc), { emitUpdate: false })
    // Chips replaced by the host's own markdown aren't "removed" by the user.
    attachmentIds.current = collectAttachmentIds(editor.state.doc)
  }, [editor, controlled, markdown])

  const runtime = useMemo(() => ({
    ...(sourceClient ? { sourceClient } : {}),
    sourcePreview,
    sourceAutoSave,
    ...(onSourceSaved ? { onSourceSaved } : {}),
    ...(onSourceError ? { onSourceError } : {}),
    ...(demoResolver ? { demoResolver } : {}),
    ...(demoRuntime ? { demoRuntime } : {}),
    ...(demoDependencies ? { demoDependencies } : {}),
    ...(attachments ? { attachments } : {}),
    ...(onAttachmentOpen ? { onAttachmentOpen } : {}),
  }), [attachments, demoDependencies, demoResolver, demoRuntime, onAttachmentOpen, onSourceError, onSourceSaved, sourceAutoSave, sourceClient, sourcePreview])

  if (!editor) return null

  return (
    <div className={className ? `gb ${className}` : "gb"}>
      {toolbar && <Toolbar editor={editor} />}
      <EditorRuntimeProvider value={runtime}>
        <EditorContent editor={editor} className="gb-content" />
      </EditorRuntimeProvider>
    </div>
  )
}

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

import { parseMarkdown, serializeMarkdown, type CitationDef } from "@brett_lamy/docstream/gitbook"
import type { SourceFileSnapshot, SourceReferenceClient } from "@brett_lamy/docstream/source"
import { astToTiptap, tiptapToAst, type PMNode } from "./convert"
import { createGitbookExtensions } from "./extensions"
import { EditorRuntimeProvider } from "./runtime"
import type { SlashItem } from "./slash-menu"

export interface GitbookEditorProps {
  /** Markdown source. When provided, the editor stays in sync with it (controlled). */
  markdown?: string
  /** Called with serialized GitBook markdown on every edit. */
  onChange?: (markdown: string) => void
  /** Show the built-in formatting toolbar (default true). */
  toolbar?: boolean
  /** Built-in "/" slash menu: true (default), false, or a custom item list. */
  slashMenu?: boolean | { items?: SlashItem[] }
  /** The "@" / "#" reference chip pickers: true (default), false, or known id lists. */
  references?: boolean | { mentions?: string[]; tags?: string[] }
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
  onEditorReady,
  sourceClient,
  sourcePreview = true,
  sourceAutoSave = true,
  onSourceSaved,
  onSourceError,
}: GitbookEditorProps) {
  // Tracks the markdown the editor itself produced, so external updates
  // (file switches) reset content but our own onChange echoes don't.
  const lastEmitted = useRef<string | null>(null)
  // PM JSON has nowhere to carry doc-level citation definitions; remember the
  // ones from the last applied markdown and reattach them on serialize.
  const citationsRef = useRef<CitationDef[] | undefined>(undefined)
  const controlled = markdown !== undefined

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
      handlePaste: (_view, event) => onPaste?.(event) ?? false,
    },
    ...(controlled ? { content: astToTiptap(parseAndTrack(markdown as string)) } : {}),
    onUpdate({ editor }) {
      if (!onChange) return
      const ast = tiptapToAst(editor.getJSON() as PMNode)
      if (citationsRef.current?.length) ast.citations = citationsRef.current
      const md = serializeMarkdown(ast)
      lastEmitted.current = md
      onChange(md)
    },
  })

  // Surface the editor instance to the host (for awareness, commands, etc.).
  useEffect(() => {
    onEditorReady?.(editor ?? null)
    return () => onEditorReady?.(null)
  }, [editor, onEditorReady])

  useEffect(() => {
    if (!editor || !controlled) return
    if (markdown === lastEmitted.current) return
    lastEmitted.current = markdown as string
    const doc = parseMarkdown(markdown as string)
    citationsRef.current = doc.citations
    editor.commands.setContent(astToTiptap(doc), { emitUpdate: false })
  }, [editor, controlled, markdown])

  const runtime = useMemo(() => ({
    ...(sourceClient ? { sourceClient } : {}),
    sourcePreview,
    sourceAutoSave,
    ...(onSourceSaved ? { onSourceSaved } : {}),
    ...(onSourceError ? { onSourceError } : {}),
  }), [onSourceError, onSourceSaved, sourceAutoSave, sourceClient, sourcePreview])

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

import { useMemo, useState } from "react"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import { astToTiptap, createGitbookExtensions, serializeEditorMarkdown, tiptapToAst, type PMNode } from "@brett_lamy/docstream-editor"
import { parseMarkdown } from "@brett_lamy/docstream/gitbook"
import { Button, MarkdownPane, Pane, Split } from "./ui"
import { HintShortcut } from "./stamp"

const INITIAL = `# Your own useEditor()

This is TipTap's \`useEditor\` with the GitBook extension set: no \`GitbookEditor\`, no built-in toolbar.

{% hint style="info" %}
GitBook blocks still render and edit.
{% endhint %}

Put the caret in this paragraph and press **⌘⇧H** (Ctrl+Shift+H): a host extension wraps it in a warning hint.
`

/** The editor assembled by hand: createGitbookExtensions + useEditor + the conversion helpers. */
export default function CustomEditor({ variant = "history" }: { variant?: string }) {
  const disableHistory = variant === "no-history"
  const [markdown, setMarkdown] = useState(INITIAL)
  const extensions = useMemo(
    () =>
      createGitbookExtensions({
        placeholder: "Your own editor…",
        references: { mentions: ["ada", "grace"], tags: ["release"] },
        disableHistory,
        extensions: [HintShortcut],
      }),
    [disableHistory],
  )
  const editor = useEditor(
    {
      extensions,
      content: astToTiptap(parseMarkdown(INITIAL)),
      onUpdate: ({ editor }) => setMarkdown(serializeEditorMarkdown(tiptapToAst(editor.getJSON() as PMNode))),
    },
    [extensions],
  )
  // Re-render the toolbar when undo / redo availability changes.
  const can = useEditorState({
    editor,
    selector: ({ editor }) => ({
      // With disableHistory the commands don't exist at all.
      hasHistory: !!editor && "undo" in editor.commands,
      undo: !!editor && "undo" in editor.commands && editor.can().undo(),
      redo: !!editor && "redo" in editor.commands && editor.can().redo(),
    }),
  })

  return (
    <Split>
      <Pane
        title={<>useEditor · disableHistory: {String(disableHistory)}</>}
        actions={
          <>
            <Button disabled={!can?.undo} onClick={() => editor?.chain().focus().undo().run()}>Undo</Button>
            <Button disabled={!can?.redo} onClick={() => editor?.chain().focus().redo().run()}>Redo</Button>
            <span style={{ fontSize: 11, opacity: 0.7 }}>{can?.hasHistory ? "⌘Z works" : "no undo / redo: history belongs to Yjs"}</span>
          </>
        }
      >
        <div className="gb">
          <EditorContent editor={editor} className="gb-content" />
        </div>
      </Pane>
      <MarkdownPane markdown={markdown} title="serializeEditorMarkdown(tiptapToAst(editor.getJSON()))" />
    </Split>
  )
}

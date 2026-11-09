import { TASK_STATES, type DocumentPropertiesNode, type TaskState } from "@brett_lamy/docstream-editor"
import { setDocumentProperty } from "@brett_lamy/docstream/gitbook"
import { Control, type EditorInstance, type Sample } from "./Workbench"

const PROPERTIES = `---
# Comments, key order and quoting survive edits.
title: Q4 launch checklist
status: draft
owner: "@luna"
reviewed: false
priority: 2
tags: [docs, launch]
---

# Q4 launch checklist

Open **Properties** above the editor and change a value: the YAML on the right changes in place, comment and quotes intact.
`

const TASKS = `# Task states

${TASK_STATES.map((state) => `- [${state.marker}] ${state.label}`).join("\n")}

Type a marker at the start of a line — \`[~] \`, \`[b] \`, \`[!] \` — to start a task in that state.
`

/** Buttons that drive the editor through the two commands this page is about. */
function setState(editor: EditorInstance, state: TaskState) {
  editor.chain().focus().setTaskState(state).run()
}

function setStatus(editor: EditorInstance, status: string) {
  const current = editor.state.doc.attrs.properties as DocumentPropertiesNode | null
  editor.commands.setDocumentProperties(setDocumentProperty(current ?? { yaml: "" }, "status", status))
}

export const SAMPLES = {
  properties: {
    label: "Properties",
    markdown: PROPERTIES,
    tip: "Edit, add or remove a property. Undo (⌘Z) steps back through property edits too.",
    props: { documentProperties: { defaultOpen: true } },
  },
  tasks: {
    label: "Tasks",
    markdown: TASKS,
    tip: "Click a box to clear or verify it; right-click it (or focus it and press Shift+F10) for all eight states.",
  },
  commands: {
    label: "Commands",
    markdown: PROPERTIES.replace(/\n# Q4[\s\S]*$/, "\n# Commands\n\n- [ ] Put the caret in this task, then press a state button\n- [~] Or this one\n"),
    tip: "setTaskState(state) acts on the task at the caret; setDocumentProperties(next) replaces the frontmatter.",
    controls: (editor) => (
      <>
        {(["in-progress", "blocked", "verified", "cancelled"] as const).map((state) => (
          <Control key={state} onClick={() => setState(editor, state)}>
            {TASK_STATES.find((s) => s.id === state)!.label}
          </Control>
        ))}
        <Control onClick={() => setStatus(editor, "shipped")}>status: shipped</Control>
      </>
    ),
  },
} satisfies Record<string, Sample>

export type SampleId = keyof typeof SAMPLES

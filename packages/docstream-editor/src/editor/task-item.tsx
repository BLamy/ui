import { getRenderedAttributes, wrappingInputRule } from "@tiptap/core"
import { TaskItem } from "@tiptap/extension-list"
import { createRoot } from "react-dom/client"
import { closeHistory } from "@tiptap/pm/history"
import { getTaskState, taskStateFromMarker, type TaskState } from "@brett_lamy/docstream/gitbook"
import { TaskCheckbox } from "@brett_lamy/docstream/tasks"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    taskState: {
      /** Change the selected task's state. Normal checkbox clicks alternate pending / verified. */
      setTaskState: (state: TaskState) => ReturnType
    }
  }
}

/** The standard nested TaskItem with Docstream's shared state control and native content DOM. */
export const GbTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      state: { default: null, keepOnSplit: false, parseHTML: (element) => element.getAttribute("data-task-state"), renderHTML: (attrs) => attrs.state ? { "data-task-state": attrs.state } : {} },
    }
  },
  addCommands() {
    return {
      setTaskState: (state) => ({ commands, tr }) => { closeHistory(tr); return commands.updateAttributes(this.name, { state, checked: state === "verified" }) },
    }
  },
  addInputRules() {
    return [wrappingInputRule({ find: /^\s*(?:[-+*]\s)?\[([ xX~?bd!-])\]\s$/, type: this.type, getAttributes: (match) => {
      const state = taskStateFromMarker(match[1]) ?? "pending"
      return { state, checked: state === "verified" }
    } })]
  },
  addNodeView() {
    return ({ node: initial, getPos, editor, HTMLAttributes }) => {
      let node = initial
      const dom = document.createElement("li")
      const label = document.createElement("label"); label.contentEditable = "false"
      const content = document.createElement("div")
      dom.append(label, content)
      const root = createRoot(label)
      let previousKeys = new Set<string>()
      let disposed = false
      let scheduled = false
      const render = () => {
        const attrs = { ...this.options.HTMLAttributes, ...HTMLAttributes, ...getRenderedAttributes(node, editor.extensionManager.attributes), "data-type": "taskItem", "data-checked": String(node.attrs.checked), "data-task-state": getTaskState(node.attrs) }
        for (const key of previousKeys) if (!(key in attrs)) dom.removeAttribute(key)
        for (const [key, value] of Object.entries(attrs)) dom.setAttribute(key, String(value))
        previousKeys = new Set(Object.keys(attrs))
        if (scheduled) return
        scheduled = true
        // ProseMirror can create/update node views during React's render phase.
        // Paint the independent checkbox root after that phase and coalesce updates.
        queueMicrotask(() => {
          scheduled = false
          if (disposed) return
          root.render(<TaskCheckbox state={getTaskState(node.attrs)} label={node.textContent || "Task"}
            onChange={editor.isEditable ? (state) => {
              if (!editor.isEditable) return
              const position = typeof getPos === "function" ? getPos() : undefined
              if (typeof position !== "number") return
              const current = editor.state.doc.nodeAt(position)
              if (!current) return
              editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(position, undefined, { ...current.attrs, state, checked: state === "verified" }))
            } : undefined} />)
        })
      }
      render()
      let editable = editor.isEditable
      const onEditable = () => { if (editable !== editor.isEditable) { editable = editor.isEditable; render() } }
      editor.on("update", onEditable)
      return {
        dom, contentDOM: content,
        update(next) { if (next.type !== node.type) return false; node = next; render(); return true },
        stopEvent(event) {
          if (event instanceof KeyboardEvent && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') return false
          return event.target instanceof Node && label.contains(event.target)
        },
        ignoreMutation(mutation) { return mutation.type !== "selection" && !content.contains(mutation.target) },
        destroy() { disposed = true; editor.off("update", onEditable); queueMicrotask(() => root.unmount()) },
      }
    }
  },
})

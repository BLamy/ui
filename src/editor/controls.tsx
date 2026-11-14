import type { ReactNode } from "react"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { FolderOpen, Upload } from "lucide-react"
import { Button } from "@ui-sdk/react/button"
import { Checkbox, CheckboxIndicator } from "@ui-sdk/react/checkbox"
import { FileInput, FileInputTrigger } from "@ui-sdk/react/file-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui-sdk/react/select"

import { useEditorRuntime, type FilePickKind } from "./runtime"

// The controls node views share, each one a UI SDK component with the editor's classes.

type NodeViewRenderer = ReturnType<typeof ReactNodeViewRenderer>

// Parts that aren't native form controls (an option, a checkbox, a tab) still own their presses.
const OWN_EVENTS = /^(?:select|checkbox|radio|tabs|collapsible|file-input|hover-card|dialog|button|input|textarea|field)(?:-|$)/

/**
 * A React node view whose UI SDK parts keep their pointer and key events: ProseMirror would take a
 * press on an option or a checkbox for a click on the node, and move the selection and focus to it.
 */
export function controlNodeView(...args: Parameters<typeof ReactNodeViewRenderer>): NodeViewRenderer {
  const create = ReactNodeViewRenderer(...args)
  return (props) => {
    const view = create(props)
    const stopEvent = view.stopEvent?.bind(view)
    view.stopEvent = (event) => {
      const target = event.target
      const dragging = event.type.startsWith("drag") || event.type === "drop"
      if (!dragging && target instanceof Element && view.dom?.contains(target) && !view.contentDOM?.contains(target)) {
        const slot = target.closest("[data-slot]")?.getAttribute("data-slot")
        if (slot && OWN_EVENTS.test(slot)) return true
      }
      return stopEvent ? stopEvent(event) : false
    }
    return view
  }
}

export interface ChoiceOption<T extends string> {
  value: T
  label: string
}

/** One value out of a few, in a popup list. */
export function ChoiceSelect<T extends string>({
  value,
  options,
  onValueChange,
  label,
  className,
}: {
  value: T
  options: readonly ChoiceOption<T>[]
  onValueChange: (value: T) => void
  /** Names the select: it has no visible label. */
  label: string
  className?: string
}) {
  return (
    <Select<string>
      value={value}
      items={options as ChoiceOption<T>[]}
      onValueChange={(next) => {
        if (typeof next === "string") onValueChange(next as T)
      }}
    >
      <SelectTrigger className={className ? `gb-select ${className}` : "gb-select"} aria-label={label} title={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="gb-select-content" sideOffset={4}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="gb-select-item">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** A checkbox with its text, in one label. */
export function FlagCheckbox({
  checked,
  onCheckedChange,
  className,
  label,
  children,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
  /** The checkbox's name, when its visible text is a symbol. */
  label?: string
  children: ReactNode
}) {
  return (
    <label className={className} title={label}>
      <Checkbox
        className="gb-checkbox"
        {...(label ? { "aria-label": label } : {})}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      >
        <CheckboxIndicator className="gb-checkbox-indicator" aria-hidden="true" />
      </Checkbox>
      {children}
    </label>
  )
}

/** "Choose file…": asks the host's `pickFile` for a path and sets it. Rendered only when the host has one. */
export function PickFileButton({ kind, current, onPick, label }: { kind: FilePickKind; current: string; onPick: (url: string) => void; label: string }) {
  const { pickFile } = useEditorRuntime()
  if (!pickFile) return null
  return (
    <Button
      className="gb-pick-file"
      onClick={async () => {
        const url = await pickFile({ kind, current })
        if (url) onPick(url)
      }}
    >
      <FolderOpen className="size-3.5" aria-hidden="true" /> {label}
    </Button>
  )
}

const NO_FILES: File[] = []

/** "Upload…": the system file chooser, whose file goes to the host's `uploadFile`. Rendered only when the host has one. */
export function UploadFileButton({ kind, onPick, label }: { kind: FilePickKind; onPick: (url: string) => void; label: string }) {
  const { uploadFile } = useEditorRuntime()
  if (!uploadFile) return null
  return (
    <FileInput
      className="gb-upload-file"
      // Nothing is held here: each chosen file goes straight to the host.
      value={NO_FILES}
      {...(kind === "image" ? { accept: "image/*" } : {})}
      onValueChange={async (files) => {
        const file = files[files.length - 1]
        if (!file) return
        const url = await uploadFile(file, { kind })
        if (url) onPick(url)
      }}
    >
      <FileInputTrigger className="gb-pick-file">
        <Upload className="size-3.5" aria-hidden="true" /> {label}
      </FileInputTrigger>
    </FileInput>
  )
}

import type { ReactNode } from "react"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { Glyph } from "./glyph"
import { Button } from "@ui-sdk/react/button"
import { Checkbox, CheckboxIndicator } from "@ui-sdk/react/checkbox"
import { FileInput, FileInputTrigger } from "@ui-sdk/react/file-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui-sdk/react/select"

import { useEditorRuntime, type FilePickKind } from "./runtime"

// The controls node views share, each one a UI SDK component with the editor's classes.

type NodeViewRenderer = ReturnType<typeof ReactNodeViewRenderer>

/**
 * A React node view whose UI SDK parts keep their pointer and key events: ProseMirror would take a
 * press on an option, a checkbox or a slider thumb for a click on the node, and move the selection
 * and focus to it. Every event inside a UI SDK part (any `[data-slot]` element in the node view,
 * outside its editable content) is the part's, whichever component it is: the editor's own controls
 * and the docstream viewers it hosts (Resizable, Toggle, Menu, Slider, …). Drags and drops still
 * reach ProseMirror, so the node can be moved.
 */
export function controlNodeView(...args: Parameters<typeof ReactNodeViewRenderer>): NodeViewRenderer {
  const create = ReactNodeViewRenderer(...args)
  return (props) => {
    const view = create(props)
    const stopEvent = view.stopEvent?.bind(view)
    view.stopEvent = (event) => {
      const dom = view.dom
      const target = event.target
      const dragging = event.type.startsWith("drag") || event.type === "drop"
      if (!dragging && dom && target instanceof Element && dom.contains(target) && !view.contentDOM?.contains(target)) {
        const part = target.closest("[data-slot]")
        if (part && part !== dom && dom.contains(part)) return true
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
  readOnly,
  children,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
  /** The checkbox's name, when its visible text is a symbol. */
  label?: string
  /** Focusable, but can't be changed. */
  readOnly?: boolean
  children: ReactNode
}) {
  return (
    <label className={className} title={label}>
      <Checkbox
        className="gb-checkbox"
        {...(label ? { "aria-label": label } : {})}
        checked={checked}
        {...(readOnly ? { readOnly: true } : {})}
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
      <Glyph name="folder" className="size-3.5" size={24} /> {label}
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
        <Glyph name="share" className="size-3.5" size={24} /> {label}
      </FileInputTrigger>
    </FileInput>
  )
}

import { createContext, useState, type KeyboardEvent } from "react"
import type { ChangeDetails } from "@ui-sdk/core"
import { Checkbox } from "@ui-sdk/react/checkbox"
import { createMenuController, Menu, MenuContent, MenuContextTrigger, MenuItemIndicator, MenuRadioGroup, MenuRadioItem } from "@ui-sdk/react/menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip"
import { Glyph } from "../ui/glyph"
import { type IconName } from "@brett_lamy/ui/lib/icon"
import type { ListItemNode, TaskState } from "../gitbook/ast"
import { TASK_STATES } from "../gitbook/tasks"
import { useOpenOnCurrent } from "../ui/menu-current"
import { changeDetails } from "@brett_lamy/ui/lib/change-details"

/** The icons used by the checkbox, tooltip and state picker. */
export const TASK_STATE_ICONS = {
  pending: "circle",
  "in-progress": "clock",
  implemented: "question-circle",
  blocked: "nosign",
  parked: "pause-circle",
  refuted: "xmark-circle",
  verified: "check-circle",
  cancelled: "minus-circle",
} as const satisfies Record<TaskState, IconName>

export type TaskStateChangeHandler = (item: ListItemNode, state: TaskState) => void
export const TaskStateChangeContext = createContext<TaskStateChangeHandler | undefined>(undefined)

/** Why the state changed: a press on the checkbox (`press`) or a pick from the menu of states (`item-press`). */
export type TaskCheckboxValueChangeReason = "press" | "item-press"
export type TaskCheckboxValueChangeDetails = ChangeDetails<TaskCheckboxValueChangeReason>

export interface TaskCheckboxProps {
  state: TaskState
  /** Called with the state a reader picked, and why. A normal click clears any marked state; clicking pending sets
      verified. The checkbox is controlled: pass the new `state` back. */
  onValueChange?: (state: TaskState, details: TaskCheckboxValueChangeDetails) => void
  label?: string
  className?: string
}

/**
 * An accessible multi-state task checkbox, on UI SDK's Checkbox. Intermediate states read as mixed. With `onValueChange`, a
 * right-click, long press, Shift+F10 or the context-menu key opens a menu of every state, on the current one.
 */
export function TaskCheckbox({ state, onValueChange, label = "Task", className }: TaskCheckboxProps) {
  const meta = TASK_STATES.find((item) => item.id === state) ?? TASK_STATES[0]
  const stateIcon = TASK_STATE_ICONS[meta.id]
  const mixed = state !== "pending" && state !== "verified"
  const [menu] = useState(() => createMenuController())
  const current = useOpenOnCurrent('[role="menuitemradio"][data-checked]')
  // The context trigger opens on the browser's `contextmenu` event, which macOS browsers don't send for Shift+F10
  // (and keyboards there have no context-menu key), so both keys open the menu here, at the checkbox.
  const openFromKey = (event: KeyboardEvent<HTMLElement>) => {
    if (!onValueChange || !(event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey))) return
    event.preventDefault()
    void menu.open({ anchor: event.currentTarget, focus: "first", reason: "trigger-press", event: event.nativeEvent })
  }
  const checkbox = (
    <Checkbox
      className="docs-task-checkbox"
      aria-label={`${label}: ${meta.label}`}
      checked={mixed ? "indeterminate" : state === "verified"}
      readOnly={!onValueChange}
      onCheckedChange={(_checked, details) =>
        onValueChange?.(state === "pending" ? "verified" : "pending", changeDetails({ reason: "press", event: details.event, source: details.source }))
      }
      onKeyDown={onValueChange ? openFromKey : undefined}
    />
  )
  const control = (
    <Tooltip delay={400}>
      <TooltipTrigger render={onValueChange ? <MenuContextTrigger render={checkbox} /> : checkbox} />
      <TooltipContent className="docs-tooltip" side="top" sideOffset={6}>{meta.label}</TooltipContent>
    </Tooltip>
  )
  const icon = <Glyph name={stateIcon} className="docs-task-state-icon" size={20} sw={1.7} data-state-icon={state} />
  const classes = ["docs-task-control", className].filter(Boolean).join(" ")
  if (!onValueChange) return <span className={classes} data-task-state={state}>{control}{icon}</span>
  return (
    <span className={classes} data-task-state={state}>
      <Menu controller={menu} onOpenChange={(open) => current.opened(open)}>
        {control}
        <MenuContent aria-label="Task state" className="docs-task-state-menu" {...current.content}>
          <MenuRadioGroup value={state} onValueChange={(next, details) =>
              onValueChange(next as TaskState, changeDetails({ reason: "item-press", event: details.event, source: details.source }))
            }>
            {TASK_STATES.map((item) => {
              const itemIcon = TASK_STATE_ICONS[item.id]
              return (
                <MenuRadioItem key={item.id} value={item.id} label={item.label} closeOnSelect data-state={item.id}>
                  <Glyph name={itemIcon} size={19} sw={1.7} data-state-icon={item.id} />
                  <span>{item.label}</span>
                  <MenuItemIndicator keepMounted><Glyph name="check" size={14} /></MenuItemIndicator>
                </MenuRadioItem>
              )
            })}
          </MenuRadioGroup>
        </MenuContent>
      </Menu>
      {icon}
    </span>
  )
}

import { createContext, useState, type KeyboardEvent } from "react"
import { Checkbox } from "@ui-sdk/react/checkbox"
import { createMenuController, Menu, MenuContent, MenuContextTrigger, MenuItemIndicator, MenuRadioGroup, MenuRadioItem } from "@ui-sdk/react/menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip"
import { Glyph } from "../ui/glyph"
import { type IconName } from "@brett_lamy/ui/lib/icon"
import type { ListItemNode, TaskState } from "../gitbook/ast"
import { TASK_STATES } from "../gitbook/tasks"
import { useOpenOnCurrent } from "../ui/menu-current"

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

export interface TaskCheckboxProps {
  state: TaskState
  /** A normal click clears any marked state; clicking pending sets verified. */
  onChange?: (state: TaskState) => void
  label?: string
  className?: string
}

/**
 * An accessible multi-state task checkbox, on UI SDK's Checkbox. Intermediate states read as mixed. With `onChange`, a
 * right-click, long press, Shift+F10 or the context-menu key opens a menu of every state, on the current one.
 */
export function TaskCheckbox({ state, onChange, label = "Task", className }: TaskCheckboxProps) {
  const meta = TASK_STATES.find((item) => item.id === state) ?? TASK_STATES[0]
  const stateIcon = TASK_STATE_ICONS[meta.id]
  const mixed = state !== "pending" && state !== "verified"
  const [menu] = useState(() => createMenuController())
  const current = useOpenOnCurrent('[role="menuitemradio"][data-checked]')
  // The context trigger opens on the browser's `contextmenu` event, which macOS browsers don't send for Shift+F10
  // (and keyboards there have no context-menu key), so both keys open the menu here, at the checkbox.
  const openFromKey = (event: KeyboardEvent<HTMLElement>) => {
    if (!onChange || !(event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey))) return
    event.preventDefault()
    void menu.open({ anchor: event.currentTarget, focus: "first", reason: "trigger-press", event: event.nativeEvent })
  }
  const checkbox = (
    <Checkbox
      className="docs-task-checkbox"
      aria-label={`${label}: ${meta.label}`}
      checked={mixed ? "indeterminate" : state === "verified"}
      readOnly={!onChange}
      onCheckedChange={() => onChange?.(state === "pending" ? "verified" : "pending")}
      onKeyDown={onChange ? openFromKey : undefined}
    />
  )
  const control = (
    <Tooltip delay={400}>
      <TooltipTrigger render={onChange ? <MenuContextTrigger render={checkbox} /> : checkbox} />
      <TooltipContent className="docs-tooltip" side="top" sideOffset={6}>{meta.label}</TooltipContent>
    </Tooltip>
  )
  const icon = <Glyph name={stateIcon} className="docs-task-state-icon" size={20} sw={1.7} data-state-icon={state} />
  const classes = ["docs-task-control", className].filter(Boolean).join(" ")
  if (!onChange) return <span className={classes} data-task-state={state}>{control}{icon}</span>
  return (
    <span className={classes} data-task-state={state}>
      <Menu controller={menu} onOpenChange={(open) => current.opened(open)}>
        {control}
        <MenuContent aria-label="Task state" className="docs-task-state-menu" {...current.content}>
          <MenuRadioGroup value={state} onValueChange={(next) => onChange(next as TaskState)}>
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

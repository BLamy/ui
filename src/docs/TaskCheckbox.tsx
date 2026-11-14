import { createContext } from "react"
import { Checkbox } from "@ui-sdk/react/checkbox"
import { Menu, MenuContent, MenuContextTrigger, MenuItemIndicator, MenuRadioGroup, MenuRadioItem } from "@ui-sdk/react/menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip"
import { Ban, Check, Circle, CircleCheck, CircleHelp, CircleMinus, CirclePause, CircleX, Clock3 } from "lucide-react"
import type { ListItemNode, TaskState } from "../gitbook/ast"
import { TASK_STATES } from "../gitbook/tasks"

/** The icons used by the checkbox, tooltip and state picker. */
export const TASK_STATE_ICONS = {
  pending: Circle,
  "in-progress": Clock3,
  implemented: CircleHelp,
  blocked: Ban,
  parked: CirclePause,
  refuted: CircleX,
  verified: CircleCheck,
  cancelled: CircleMinus,
} as const

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
 * right-click, long press, Shift+F10 or the context-menu key opens a menu of every state.
 */
export function TaskCheckbox({ state, onChange, label = "Task", className }: TaskCheckboxProps) {
  const meta = TASK_STATES.find((item) => item.id === state) ?? TASK_STATES[0]
  const StateIcon = TASK_STATE_ICONS[meta.id]
  const mixed = state !== "pending" && state !== "verified"
  const checkbox = (
    <Checkbox
      className="docs-task-checkbox"
      aria-label={`${label}: ${meta.label}`}
      checked={mixed ? "indeterminate" : state === "verified"}
      readOnly={!onChange}
      onCheckedChange={() => onChange?.(state === "pending" ? "verified" : "pending")}
    />
  )
  const control = (
    <Tooltip delay={400}>
      <TooltipTrigger render={onChange ? <MenuContextTrigger render={checkbox} /> : checkbox} />
      <TooltipContent className="docs-tooltip" side="top" sideOffset={6}>{meta.label}</TooltipContent>
    </Tooltip>
  )
  const icon = <StateIcon className="docs-task-state-icon" size={20} strokeWidth={1.7} aria-hidden="true" data-state-icon={state} />
  const classes = ["docs-task-control", className].filter(Boolean).join(" ")
  if (!onChange) return <span className={classes} data-task-state={state}>{control}{icon}</span>
  return (
    <span className={classes} data-task-state={state}>
      <Menu>
        {control}
        <MenuContent aria-label="Task state" className="docs-task-state-menu">
          <MenuRadioGroup value={state} onValueChange={(next) => onChange(next as TaskState)}>
            {TASK_STATES.map((item) => {
              const Icon = TASK_STATE_ICONS[item.id]
              return (
                <MenuRadioItem key={item.id} value={item.id} label={item.label} closeOnSelect data-state={item.id}>
                  <Icon size={19} strokeWidth={1.7} aria-hidden="true" data-state-icon={item.id} />
                  <span>{item.label}</span>
                  <MenuItemIndicator keepMounted><Check size={14} aria-hidden="true" /></MenuItemIndicator>
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

import { createContext, useEffect, useId, useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
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

const TOKENS = ["--foreground", "--muted-foreground", "--popover", "--popover-foreground", "--border", "--primary", "--accent", "--accent-foreground"]

/** An accessible multi-state task checkbox. Right-click or Shift+F10 opens its keyboard-navigable state menu. */
export function TaskCheckbox({ state, onChange, label = "Task", className }: TaskCheckboxProps) {
  const input = useRef<HTMLInputElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const tipId = useId()
  const [popup, setPopup] = useState<{ x: number; y: number; style: CSSProperties }>()
  const [tip, setTip] = useState<{ x: number; y: number }>()
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const meta = TASK_STATES.find((item) => item.id === state) ?? TASK_STATES[0]
  const StateIcon = TASK_STATE_ICONS[meta.id]
  const mixed = state !== "pending" && state !== "verified"
  useEffect(() => { if (input.current) input.current.indeterminate = mixed }, [mixed, state])
  useEffect(() => () => clearTimeout(hoverTimer.current), [])
  const hideTip = () => { clearTimeout(hoverTimer.current); setTip(undefined) }
  const showTip = () => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => {
      const box = input.current?.getBoundingClientRect()
      if (box) setTip({ x: Math.max(80, Math.min(window.innerWidth - 80, box.x + box.width / 2)), y: box.top > 36 ? box.top - 6 : box.bottom + 30 })
    }, 400)
  }
  const open = (x?: number, y?: number) => {
    if (!onChange || !input.current) return
    hideTip()
    const box = input.current.getBoundingClientRect()
    const computed = getComputedStyle(input.current)
    const style = Object.fromEntries(TOKENS.map((token) => [token, computed.getPropertyValue(token)])) as CSSProperties
    style.fontFamily = computed.fontFamily
    style.colorScheme = computed.colorScheme
    setPopup({ x: Math.max(8, Math.min(window.innerWidth - 292, x ?? box.left)), y: Math.max(8, Math.min(window.innerHeight - 330, y ?? box.bottom + 4)), style })
  }
  const close = (restoreFocus = false) => { setPopup(undefined); if (restoreFocus) input.current?.focus({ preventScroll: true }) }
  useEffect(() => {
    if (!popup) return
    menu.current?.querySelector<HTMLButtonElement>(`[data-state="${state}"]`)?.focus()
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !menu.current?.contains(event.target)) close() }
    const scroll = (event: Event) => { if (!(event.target instanceof Node && menu.current?.contains(event.target))) close() }
    document.addEventListener("pointerdown", outside, true)
    window.addEventListener("resize", scroll)
    window.addEventListener("scroll", scroll, true)
    return () => { document.removeEventListener("pointerdown", outside, true); window.removeEventListener("resize", scroll); window.removeEventListener("scroll", scroll, true) }
  }, [popup])
  return <span className={["docs-task-control", className].filter(Boolean).join(" ")} data-task-state={state}>
    <input ref={input} type="checkbox" className="docs-task-checkbox" aria-label={`${label}: ${meta.label}`} aria-describedby={tip ? tipId : undefined}
      aria-checked={mixed ? "mixed" : state === "verified"} aria-readonly={!onChange || undefined} aria-haspopup={onChange ? "menu" : undefined}
      aria-expanded={onChange ? !!popup : undefined} checked={state === "verified"} readOnly={!onChange}
      onClick={(event) => { if (!onChange) event.preventDefault() }}
      onChange={() => { hideTip(); onChange?.(state === "pending" ? "verified" : "pending") }}
      onMouseDown={(event) => { if (event.button === 0) event.preventDefault() }}
      onMouseEnter={showTip} onMouseLeave={hideTip} onFocus={showTip} onBlur={hideTip}
      onContextMenu={(event) => { if (onChange) { event.preventDefault(); open(event.clientX, event.clientY) } }}
      onKeyDown={(event) => {
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) { event.preventDefault(); open() }
      }} />
    <StateIcon className="docs-task-state-icon" size={20} strokeWidth={1.7} aria-hidden="true" data-state-icon={state} />
    {tip && !popup ? createPortal(<div role="tooltip" id={tipId} className="docs-task-tooltip" style={{ left: tip.x, top: tip.y }}>{meta.label}</div>, document.body) : null}
    {popup ? createPortal(<div ref={menu} role="menu" aria-label="Task state" className="docs-task-state-menu" style={{ ...popup.style, left: popup.x, top: popup.y }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])]
        const current = items.indexOf(document.activeElement as HTMLButtonElement)
        let next: number | undefined
        if (event.key === "ArrowDown") next = (current + 1) % items.length
        if (event.key === "ArrowUp") next = (current - 1 + items.length) % items.length
        if (event.key === "Home") next = 0
        if (event.key === "End") next = items.length - 1
        if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); close(true) }
        if (next !== undefined) { event.preventDefault(); items[next]?.focus() }
      }}>
      {TASK_STATES.map((item) => {
        const Icon = TASK_STATE_ICONS[item.id]
        return <button type="button" role="menuitemradio" key={item.id} data-state={item.id} aria-checked={item.id === state}
          onClick={() => { onChange?.(item.id); close(true) }}>
          <Icon size={19} strokeWidth={1.7} aria-hidden="true" data-state-icon={item.id} />
          <span>{item.label}</span>{item.id === state ? <Check size={14} aria-hidden="true" /> : <span />}
        </button>
      })}
    </div>, document.body) : null}
  </span>
}

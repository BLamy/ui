/* Small accessible controls shared by the demo viewer, tabs and page actions: a pill tab strip
   (tabs semantics, roving focus) and a segmented radio group. */
import { useId, type KeyboardEvent, type ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"

export interface PillOption<T extends string> {
  id: T
  label: ReactNode
  /** Accessible name when `label` is not plain text. */
  ariaLabel?: string
}

const SPRING = { type: "spring", bounce: 0.18, duration: 0.45 } as const

/** Arrow/Home/End move focus (and selection) across a row of buttons. */
export function rovingKeyDown<T extends string>(
  event: KeyboardEvent<HTMLElement>,
  ids: readonly T[],
  current: T,
  select: (id: T) => void,
  orientation: "horizontal" | "vertical" = "horizontal",
) {
  const prev = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp"
  const next = orientation === "horizontal" ? "ArrowRight" : "ArrowDown"
  const index = ids.indexOf(current)
  let target = -1
  if (event.key === prev) target = (index - 1 + ids.length) % ids.length
  else if (event.key === next) target = (index + 1) % ids.length
  else if (event.key === "Home") target = 0
  else if (event.key === "End") target = ids.length - 1
  if (target < 0) return
  event.preventDefault()
  select(ids[target])
  const buttons = event.currentTarget.querySelectorAll<HTMLElement>("[data-roving]")
  buttons[target]?.focus()
}

/** A tab strip with a sliding pill. `panelId(id)` wires aria-controls when the panels exist. */
export function PillTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  panelId,
  tabId,
  className,
}: {
  options: readonly PillOption<T>[]
  value: T
  onChange: (id: T) => void
  label: string
  panelId?: (id: T) => string
  tabId?: (id: T) => string
  className?: string
}) {
  const layoutId = useId()
  const reduced = useReducedMotion()
  return (
    <div
      className={className ? `docs-pills ${className}` : "docs-pills"}
      role="tablist"
      aria-label={label}
      onKeyDown={(event) => rovingKeyDown(event, options.map((o) => o.id), value, onChange)}
    >
      {options.map((option) => {
        const selected = option.id === value
        return (
          <button
            key={option.id}
            id={tabId?.(option.id)}
            type="button"
            role="tab"
            data-roving=""
            aria-selected={selected}
            aria-controls={panelId?.(option.id)}
            aria-label={option.ariaLabel}
            tabIndex={selected ? 0 : -1}
            className="docs-pill"
            onClick={() => onChange(option.id)}
          >
            {selected ? (
              <motion.span layoutId={`pill-${layoutId}`} className="docs-pill-indicator" transition={reduced ? { duration: 0 } : SPRING} />
            ) : null}
            <span className="docs-pill-label">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** A segmented single choice (radio semantics), styled like the pill tabs. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly PillOption<T>[]
  value: T
  onChange: (id: T) => void
  label: string
  className?: string
}) {
  const layoutId = useId()
  const reduced = useReducedMotion()
  return (
    <div
      className={className ? `docs-pills docs-segmented ${className}` : "docs-pills docs-segmented"}
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => rovingKeyDown(event, options.map((o) => o.id), value, onChange)}
    >
      {options.map((option) => {
        const selected = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            data-roving=""
            aria-checked={selected}
            aria-label={option.ariaLabel}
            tabIndex={selected ? 0 : -1}
            className="docs-pill"
            onClick={() => onChange(option.id)}
          >
            {selected ? (
              <motion.span layoutId={`seg-${layoutId}`} className="docs-pill-indicator" transition={reduced ? { duration: 0 } : SPRING} />
            ) : null}
            <span className="docs-pill-label">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

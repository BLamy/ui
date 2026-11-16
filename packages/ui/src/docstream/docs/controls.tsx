/* Small controls shared by the demo viewer, tabs and page actions, on UI SDK: a pill tab strip (Tabs) and a
   segmented single choice (Segmented Control). Their selection is one indicator element that slides to the
   chosen item, measured by UI SDK into CSS variables (see `.docs-pill-indicator` in styles.css). */
import type { CSSProperties, ReactNode } from "react"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control"
import { TabsIndicator, TabsList, TabsTab } from "@ui-sdk/react/tabs"

export interface PillOption<T extends string> {
  id: T
  label: ReactNode
  /** Accessible name when `label` is not plain text. */
  ariaLabel?: string
}

const join = (...names: (string | undefined)[]) => names.filter(Boolean).join(" ")

/** The pill tab list. Place it inside a `Tabs` root from `@ui-sdk/react/tabs`, with a `TabsPanel` per option. */
export function PillTabsList<T extends string>({ options, label, className }: {
  options: readonly PillOption<T>[]
  label: string
  className?: string
}) {
  return (
    <TabsList aria-label={label} className={join("docs-pills", className)}>
      {options.map((option) => (
        <TabsTab key={option.id} value={option.id} aria-label={option.ariaLabel} className="docs-pill">
          <span className="docs-pill-label">{option.label}</span>
        </TabsTab>
      ))}
      <TabsIndicator className="docs-pill-indicator" />
    </TabsList>
  )
}

/** A segmented single choice (radio semantics), styled like the pill tabs. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  style,
}: {
  options: readonly PillOption<T>[]
  value: T
  onChange: (id: T) => void
  label: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <SegmentedControl
      value={value}
      onValueChange={(next) => { if (next !== null) onChange(next as T) }}
      aria-label={label}
      className={join("docs-pills docs-segmented", className)}
      style={style}
    >
      <SegmentedControlIndicator className="docs-pill-indicator" />
      {options.map((option) => (
        <SegmentedControlItem key={option.id} value={option.id} aria-label={option.ariaLabel} className="docs-pill">
          <span className="docs-pill-label">{option.label}</span>
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  )
}

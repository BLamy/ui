/* Mini-notation drawn as a step sequencer: sequences are rows whose steps share the width by weight, `[ ]`
   nests a row inside a step, `< >` shows its one-per-cycle choices, `,` stacks rows. Click a step to toggle
   it with a rest; double-click to type a new value. Operators show as badges (×2, (3,8), ?, !3). */
import { useState, type ReactNode } from "react"
import { miniAtoms, type MiniAtom, type MiniGroup, type MiniOp, type MiniSequence, type MiniStep } from "./ast/mini"

export interface StepGridProps {
  mini: MiniGroup
  /** Called with the atom and its new text. */
  onAtomChange: (atom: MiniAtom, text: string) => void
  /** Accessible name for the grid. */
  label?: string
}

function stepWeight(step: MiniStep): number {
  let w = 1
  for (const op of step.ops) {
    if (op.op === "weight") w += (op.amount ?? 2) - 1
    if (op.op === "replicate") w += (op.count ?? 2) - 1
  }
  return w
}

const text = (s: MiniStep | null): string => (s && s.slice.type === "atom" ? s.slice.value : "…")

function badge(op: MiniOp): string | null {
  switch (op.op) {
    case "fast":
      return `×${text(op.amount)}`
    case "slow":
      return `÷${text(op.amount)}`
    case "replicate":
      return `!${op.count ?? 2}`
    case "degrade":
      return op.amount === null ? "?" : `?${op.amount}`
    case "euclid":
      return `(${text(op.pulses)},${text(op.steps)}${op.rotation ? `,${text(op.rotation)}` : ""})`
    case "tail":
      return `:${text(op.value)}`
    case "range":
      return `..${text(op.to)}`
    case "weight":
      return null
  }
}

function AtomCell({ atom, fallback, onAtomChange }: { atom: MiniAtom; fallback: string; onAtomChange: StepGridProps["onAtomChange"] }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <input
        className="strudel-step__input"
        defaultValue={atom.value}
        aria-label="Step value"
        autoFocus
        onBlur={(e) => {
          setEditing(false)
          const v = e.currentTarget.value.trim()
          if (v && v !== atom.value && /^[\p{L}\p{Nl}0-9~\-#.^_]+$/u.test(v)) onAtomChange(atom, v)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") setEditing(false)
        }}
      />
    )
  }
  return (
    <button
      type="button"
      className="strudel-step__cell"
      data-rest={atom.rest || undefined}
      aria-pressed={!atom.rest}
      aria-label={atom.rest ? "Rest" : atom.value}
      title={atom.rest ? "Rest — click to fill, double-click to type" : `${atom.value} — click to rest, double-click to type`}
      onClick={() => onAtomChange(atom, atom.rest ? fallback : "~")}
      onDoubleClick={() => setEditing(true)}
    >
      {atom.rest ? "" : atom.value}
    </button>
  )
}

export function StepGrid({ mini, onAtomChange, label }: StepGridProps) {
  // A rest that's filled back in becomes the row's most common sound/value.
  const counts = new Map<string, number>()
  for (const a of miniAtoms(mini, { ops: false })) if (!a.rest) counts.set(a.value, (counts.get(a.value) ?? 0) + 1)
  const fallback = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "x"

  const row = (seq: MiniSequence, key: number | string): ReactNode => (
    <div key={key} className="strudel-step__row">
      {seq.steps.map((s, i) => step(s, i))}
    </div>
  )

  const group = (g: MiniGroup): ReactNode =>
    g.type === "sequence" ? (
      row(g, 0)
    ) : (
      <div className="strudel-step__layers" data-kind={g.type}>
        {g.layers.map((l, i) => row(l, i))}
      </div>
    )

  const step = (s: MiniStep, key: number): ReactNode => {
    const badges = s.ops.map(badge).filter((b): b is string => !!b)
    const slice = s.slice
    let body: ReactNode
    if (slice.type === "atom") body = <AtomCell atom={slice} fallback={fallback} onAtomChange={onAtomChange} />
    else if (slice.type === "subcycle") body = <div className="strudel-step__nest">{group(slice.body)}</div>
    else
      body = (
        <div className="strudel-step__nest" data-kind={slice.type} title={slice.type === "alternation" ? "One per cycle" : "Polymeter"}>
          <div className="strudel-step__layers">{slice.layers.map((l, i) => row(l, i))}</div>
        </div>
      )
    return (
      <div key={key} className="strudel-step" style={{ flexGrow: stepWeight(s) }}>
        {body}
        {badges.length > 0 && <span className="strudel-step__badge">{badges.join(" ")}</span>}
      </div>
    )
  }

  return (
    <div className="strudel-steps" role="group" aria-label={label ?? "Steps"}>
      {group(mini)}
    </div>
  )
}

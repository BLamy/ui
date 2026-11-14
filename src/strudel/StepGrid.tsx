/* Mini-notation drawn as a step sequencer: sequences are rows whose steps share the width by weight, `[ ]`
   nests a row inside a step, `< >` shows its one-per-cycle choices, `,` stacks rows. Click a step to toggle
   it with a rest; double-click it (or press F2) to type a new value. Operators show as badges (×2, (3,8), ?, !3).
   The keys are the `step-grid` primitive (step-grid.ts): one tab stop, arrows between the steps. */
import type { ReactNode } from "react"
import { StepGridCell, StepGridEditor, StepGridRoot } from "./step-grid-parts"
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

const VALUE = /^[\p{L}\p{Nl}0-9~\-#.^_]+$/u

export function StepGrid({ mini, onAtomChange, label }: StepGridProps) {
  // A rest that's filled back in becomes the row's most common sound/value.
  const counts = new Map<string, number>()
  for (const a of miniAtoms(mini, { ops: false })) if (!a.rest) counts.set(a.value, (counts.get(a.value) ?? 0) + 1)
  const fallback = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "x"

  // A step is its place in the pattern: the nth atom drawn, which a typed value never changes.
  const atoms: MiniAtom[] = []
  const keyOf = (atom: MiniAtom) => String(atoms.push(atom) - 1)

  const cell = (atom: MiniAtom): ReactNode => {
    const key = keyOf(atom)
    return (
      <>
        <StepGridCell
          value={key}
          pressed={!atom.rest}
          className="strudel-step__cell"
          data-rest={atom.rest || undefined}
          aria-label={atom.rest ? "Rest" : atom.value}
          title={atom.rest ? "Rest — click to fill, double-click or F2 to type" : `${atom.value} — click to rest, double-click or F2 to type`}
        >
          {atom.rest ? "" : atom.value}
        </StepGridCell>
        <StepGridEditor value={key} className="strudel-step__input" defaultValue={atom.value} aria-label="Step value" />
      </>
    )
  }

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
    if (slice.type === "atom") body = cell(slice)
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

  const drawn = group(mini)
  return (
    <StepGridRoot
      className="strudel-steps"
      aria-label={label ?? "Steps"}
      onStepPress={(key) => {
        const atom = atoms[Number(key)]
        if (atom) onAtomChange(atom, atom.rest ? fallback : "~")
      }}
      onStepEdit={({ step: key, text }) => {
        const atom = atoms[Number(key)]
        const value = text.trim()
        if (atom && value && value !== atom.value && VALUE.test(value)) onAtomChange(atom, value)
      }}
    >
      {drawn}
    </StepGridRoot>
  )
}

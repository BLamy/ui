import { useState } from 'react'
import { mergeProps, useFocusRing, useHover, usePress } from 'react-aria'
import type { PressEvent } from 'react-aria'

const POINTERS = ['mouse', 'touch', 'pen', 'keyboard', 'virtual'] as const

// A pressable made of three hooks and one mergeProps. It is a native <button>,
// so it is focusable and in the tab order; the hooks add the press
// normalization, the hover state and the focus-visible ring.
export default function Pressable() {
  const [count, setCount] = useState(0)
  const [last, setLast] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const note = (e: PressEvent) =>
    setLog((l) => [`${e.type} · ${e.pointerType}${e.key ? ` · ${e.key === ' ' ? 'Space' : e.key}` : ''}`, ...l].slice(0, 6))

  const { pressProps, isPressed } = usePress({
    onPressStart: note,
    onPressEnd: note,
    onPress: (e) => {
      note(e)
      setCount((c) => c + 1)
      setLast(e.pointerType)
    },
  })
  const { hoverProps, isHovered } = useHover({})
  const { focusProps, isFocusVisible } = useFocusRing()

  return (
    <div className="mx-auto grid w-full max-w-md gap-4">
      <button
        type="button"
        {...mergeProps(pressProps, hoverProps, focusProps)}
        data-pressed={isPressed || undefined}
        data-hovered={isHovered || undefined}
        data-focus-visible={isFocusVisible || undefined}
        className="cursor-pointer rounded-card border-0 bg-foreground px-5 py-4 text-body font-semibold text-background outline-none transition-transform duration-150 select-none data-hovered:opacity-90 data-pressed:scale-[.97] data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45"
      >
        Press me ({count})
      </button>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Pointer type of the last press">
        {POINTERS.map((p) => (
          <span
            key={p}
            data-active={last === p || undefined}
            className="rounded-full bg-muted px-2.5 py-1 text-caption text-foreground data-active:bg-foreground data-active:text-background"
          >
            {p}
          </span>
        ))}
      </div>

      <dl className="m-0 grid grid-cols-3 gap-2 text-footnote">
        {[
          ['isPressed', isPressed],
          ['isHovered', isHovered],
          ['isFocusVisible', isFocusVisible],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-ctl bg-card p-2.5 shadow-hairline">
            <dt className="text-foreground">{String(k)}</dt>
            <dd className="m-0 font-mono text-foreground">{String(v)}</dd>
          </div>
        ))}
      </dl>

      <ol aria-label="Press events" className="m-0 grid list-none gap-1 p-0 font-mono text-footnote text-foreground">
        {log.length ? log.map((l, i) => <li key={`${i}-${l}`}>{l}</li>) : <li>Press the button with a mouse, a finger, a pen or the keyboard.</li>}
      </ol>
    </div>
  )
}

import { useRef, useState, type KeyboardEvent } from 'react'
import { mergeProps, useFocusRing, useHover, useMove } from 'react-aria'

const MIN = 120
const MAX = 360
const clamp = (n: number) => Math.min(MAX, Math.max(MIN, n))

// A resizer: a focusable separator whose position comes from useMove. Mouse,
// touch and pen report pixel deltas; the arrow keys report a delta of 1 per
// press, which we scale (Shift for a bigger step). The width is accumulated in
// a ref so a drag past a limit does not "remember" the overshoot.
export default function MoveHandle() {
  const [width, setWidth] = useState(200)
  const acc = useRef(width)
  const [last, setLast] = useState('none yet')

  const { moveProps } = useMove({
    onMoveStart: (e) => {
      acc.current = width
      setLast(`start · ${e.pointerType}`)
    },
    onMove: (e) => {
      acc.current += e.pointerType === 'keyboard' ? e.deltaX * (e.shiftKey ? 40 : 10) : e.deltaX
      setWidth(clamp(acc.current))
      setLast(`move · ${e.pointerType} · Δx ${e.deltaX}`)
    },
    onMoveEnd: (e) => setLast(`end · ${e.pointerType}`),
  })
  const { hoverProps, isHovered } = useHover({})
  const { focusProps, isFocusVisible } = useFocusRing()

  return (
    <div className="mx-auto grid w-full max-w-xl gap-3">
      <div className="flex h-40 overflow-hidden rounded-panel bg-card shadow-hairline">
        <div className="grid shrink-0 place-items-center bg-muted text-footnote text-foreground" style={{ width }}>
          Sidebar · {Math.round(width)} px
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuenow={Math.round(width)}
          aria-valuemin={MIN}
          aria-valuemax={MAX}
          tabIndex={0}
          {...mergeProps(moveProps, hoverProps, focusProps, {
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key === 'Home') setWidth(MIN)
              else if (e.key === 'End') setWidth(MAX)
              else return
              e.preventDefault()
            },
          })}
          data-hovered={isHovered || undefined}
          data-focus-visible={isFocusVisible || undefined}
          className="relative w-2.5 shrink-0 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-[3px] after:-translate-x-1/2 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity data-focus-visible:after:opacity-100 data-hovered:after:opacity-45"
        />
        <div className="grid flex-1 place-items-center text-footnote text-foreground">Content</div>
      </div>
      <p className="m-0 font-mono text-footnote text-foreground">{last}</p>
      <p className="m-0 text-footnote text-foreground">
        Drag the divider, or focus it and use the arrow keys (Shift for a bigger step, Home and End for the limits).
      </p>
    </div>
  )
}

import { useRef, useState, type CSSProperties } from 'react'
import { mergeProps, useFocusRing, useLongPress, usePress } from 'react-aria'

const THRESHOLD = 700

// Hold the button for 700 ms to archive. Let go sooner and it is a plain tap;
// slide off the button while holding and the hold is cancelled. The fill is a
// CSS transition started by onLongPressStart and reset by onLongPressEnd. Long
// press is a pointer gesture, so the Archive button next to it is the
// keyboard route to the same action.
export default function LongPress() {
  const fired = useRef(false)
  const [holding, setHolding] = useState(false)
  const [status, setStatus] = useState('Nothing yet')
  const [archived, setArchived] = useState(0)

  const { longPressProps } = useLongPress({
    threshold: THRESHOLD,
    accessibilityDescription: 'Hold to archive',
    onLongPressStart: () => {
      fired.current = false
      setHolding(true)
      setStatus('Holding…')
    },
    onLongPress: () => {
      fired.current = true
      setArchived((n) => n + 1)
      setStatus('Archived by a long press')
    },
    onLongPressEnd: () => {
      setHolding(false)
      if (!fired.current) setStatus('Hold cancelled')
    },
  })
  // A press that ends over the button before the threshold is still a tap.
  const { pressProps } = usePress({ onPress: (e) => setStatus(`Tap (${e.pointerType})`) })
  const { focusProps, isFocusVisible } = useFocusRing()

  return (
    <div className="mx-auto grid w-full max-w-md gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          {...mergeProps(longPressProps, pressProps, focusProps)}
          data-focus-visible={isFocusVisible || undefined}
          className="relative cursor-pointer overflow-hidden rounded-card border-0 bg-secondary px-5 py-3.5 text-body font-semibold text-secondary-foreground outline-none select-none data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45"
        >
          <span
            aria-hidden
            data-holding={holding || undefined}
            className="absolute inset-y-0 left-0 w-0 bg-primary/30 data-holding:w-full data-holding:transition-[width] data-holding:duration-(--hold) data-holding:ease-linear"
            style={{ '--hold': `${THRESHOLD}ms` } as CSSProperties}
          />
          <span className="relative">Hold to archive</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setArchived((n) => n + 1)
            setStatus('Archived with the button')
          }}
          className="cursor-pointer rounded-card border-0 bg-card px-4 py-3.5 text-body text-foreground shadow-hairline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
        >
          Archive
        </button>
      </div>
      <p className="m-0 text-footnote text-foreground" role="status">
        {status}
      </p>
      <p className="m-0 text-footnote text-foreground">Archived: {archived}</p>
    </div>
  )
}

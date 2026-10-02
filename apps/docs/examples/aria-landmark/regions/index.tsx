import { useRef, useState, type ReactNode } from 'react'
import { mergeProps, useFocusRing, useFocusWithin, useLandmark } from 'react-aria'
import type { AriaLandmarkRole } from 'react-aria'

// Every landmark registers with a shared manager. F6 moves focus to the next
// one in document order, Shift+F6 to the previous one, and focus coming back
// to a landmark returns to the element that last had it. A landmark is a
// plain element: the hook adds the role, the label and a temporary tabIndex.
function Region({ role, label, className, children }: { role: AriaLandmarkRole; label: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const { landmarkProps } = useLandmark({ role, 'aria-label': label }, ref)
  const { focusProps, isFocusVisible } = useFocusRing()
  const [within, setWithin] = useState(false)
  const { focusWithinProps } = useFocusWithin({ onFocusWithinChange: setWithin })
  return (
    <div
      ref={ref}
      {...mergeProps(landmarkProps, focusProps, focusWithinProps)}
      data-within={within || undefined}
      data-focus-visible={isFocusVisible || undefined}
      className={`rounded-ctl bg-card p-3 shadow-hairline outline-none data-within:bg-accent data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45 ${className ?? ''}`}
    >
      <div className="mb-2 text-caption font-semibold text-foreground">
        {label} <span className="font-mono font-normal">({role})</span>
      </div>
      {children}
    </div>
  )
}

const Btn = ({ children }: { children: ReactNode }) => (
  <button
    type="button"
    className="cursor-pointer rounded-ctl border-0 bg-secondary px-3 py-1.5 text-footnote text-secondary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
  >
    {children}
  </button>
)

export default function Regions() {
  return (
    <div className="mx-auto grid w-full max-w-xl gap-3">
      <div className="grid gap-2">
        <Region role="banner" label="Site header">
          <Btn>Account</Btn>
        </Region>
        <div className="grid grid-cols-[1fr_2fr_1fr] gap-2">
          <Region role="navigation" label="Primary">
            <div className="flex flex-col items-start gap-2">
              <Btn>Inbox</Btn>
              <Btn>Sent</Btn>
            </div>
          </Region>
          <Region role="main" label="Messages">
            <div className="flex flex-col items-start gap-2">
              <Btn>Reply</Btn>
              <Btn>Archive</Btn>
            </div>
          </Region>
          <Region role="complementary" label="Details">
            <Btn>Share</Btn>
          </Region>
        </div>
      </div>
      <p className="m-0 text-footnote text-foreground">
        Click a button, then press F6 to jump to the next region and Shift+F6 for the previous one. Alt+F6 goes to the main region.
      </p>
    </div>
  )
}

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { FocusScope, useFocusManager, useFocusRing, mergeProps } from 'react-aria'

function ScopeButton({ children, ...props }: { children: ReactNode; onClick?: () => void; autoFocus?: boolean; 'aria-label'?: string }) {
  const { focusProps, isFocusVisible } = useFocusRing()
  return (
    <button
      type="button"
      {...mergeProps(props, focusProps)}
      data-focus-visible={isFocusVisible || undefined}
      className="cursor-pointer rounded-ctl border-0 bg-secondary px-3 py-1.5 text-body text-secondary-foreground outline-none data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45"
    >
      {children}
    </button>
  )
}

// Inside a FocusScope, useFocusManager moves focus between the scope's
// focusable elements: here the arrow keys step through a row of reactions.
function Reactions() {
  const manager = useFocusManager()
  const row = useRef<HTMLDivElement>(null)
  const onKeyDown = (e: KeyboardEvent) => {
    // `accept` keeps the search inside the toolbar: without it focusNext would
    // go on to the next focusable thing in the whole scope (the text field).
    const opts = { wrap: true, accept: (node: Element) => !!row.current?.contains(node) }
    if (e.key === 'ArrowRight') manager?.focusNext(opts)
    else if (e.key === 'ArrowLeft') manager?.focusPrevious(opts)
    else return
    e.preventDefault()
  }
  return (
    <div ref={row} role="toolbar" aria-label="Reactions" onKeyDown={onKeyDown} className="flex gap-2">
      {['Like', 'Love', 'Laugh'].map((r) => (
        <ScopeButton key={r}>{r}</ScopeButton>
      ))}
    </div>
  )
}

// A hand-built popover. FocusScope does three things for it:
//   autoFocus      focus moves into the panel when it opens
//   contain        Tab and Shift+Tab wrap inside the panel
//   restoreFocus   when it unmounts, focus goes back to what had it before
export default function FocusScopeDemo() {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const { focusProps, isFocusVisible } = useFocusRing()

  return (
    <div className="mx-auto grid w-full max-w-md gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <ScopeButton>Before</ScopeButton>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          {...focusProps}
          data-focus-visible={isFocusVisible || undefined}
          className="cursor-pointer rounded-ctl border-0 bg-foreground px-4 py-1.5 text-body font-semibold text-background outline-none data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45"
        >
          React
        </button>
        <ScopeButton>After</ScopeButton>
      </div>

      {open ? (
        <FocusScope contain restoreFocus autoFocus>
          <div
            role="dialog"
            aria-label="Add a reaction"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
            }}
            className="grid gap-3 rounded-panel bg-card p-4 shadow-hairline"
          >
            <Reactions />
            <label className="grid gap-1.5 text-footnote text-foreground">
              Add a note
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="box-border w-full rounded-ctl border-0 bg-muted px-3 py-2 text-body text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
              />
            </label>
            <div>
              <ScopeButton onClick={() => setOpen(false)}>Close</ScopeButton>
            </div>
          </div>
        </FocusScope>
      ) : null}
      <p className="m-0 text-footnote text-foreground">
        Open the panel, then press Tab: focus stays inside until you press Escape or Close, and then returns to the React button.
      </p>
    </div>
  )
}

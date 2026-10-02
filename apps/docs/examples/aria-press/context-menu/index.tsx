import { useState } from 'react'
import { mergeProps, useContextMenu, useFocusRing } from 'react-aria'

interface Hit {
  x: number
  y: number
}

// useContextMenu reports *where* a context menu was asked for: right-click,
// the menu key or Shift+F10, and (on touch) a long press. It draws nothing:
// here the answer is a dot. In an app, use it to place your own popover; the
// ContextMenu component builds one for you.
export default function ContextMenuHook() {
  const [hit, setHit] = useState<Hit | null>(null)
  const [count, setCount] = useState(0)
  const { contextMenuProps } = useContextMenu({
    onContextMenu: (e) => {
      setHit({ x: Math.round(e.x), y: Math.round(e.y) })
      setCount((n) => n + 1)
    },
  })
  const { focusProps, isFocusVisible } = useFocusRing()

  return (
    <div className="mx-auto grid w-full max-w-md gap-3">
      <div
        tabIndex={0}
        role="group"
        aria-label="Context menu area"
        {...mergeProps(contextMenuProps, focusProps)}
        data-focus-visible={isFocusVisible || undefined}
        className="relative grid h-44 place-items-center overflow-hidden rounded-panel bg-card text-footnote text-foreground shadow-hairline outline-none select-none data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45"
      >
        Right-click here, or focus it and press Shift+F10
        {hit ? (
          <span
            aria-hidden
            className="pointer-events-none absolute size-3 -translate-1/2 rounded-full bg-primary"
            style={{ left: hit.x, top: hit.y }}
          />
        ) : null}
      </div>
      <p className="m-0 font-mono text-footnote text-foreground" role="status">
        {hit ? `x ${hit.x}, y ${hit.y} (request ${count})` : 'No request yet'}
      </p>
    </div>
  )
}

"use client"

/* Opens a menu of choices on the current one. UI SDK's Menu (0.1.0-beta.2) puts focus on the first item when it opens
   (`focus: "first" | "last" | "popup" | "none"`; there is no "the checked item"), which suits actions but not a
   picker whose items include the one in effect: the task's state, the file that's open. The APG menu button lets a
   menu open on any item, so this moves focus, and with it the Menu's highlight, to the current item the first time
   focus enters the opened menu (whichever item or the popup itself the Menu chose). Spread the result on the Menu's
   content; call `opened()` from the Menu's `onOpenChange` / `onPayloadChange`. */
import { useRef, type FocusEvent, type PointerEvent } from "react"

export function useOpenOnCurrent(selector: string) {
  const pending = useRef(false)
  return {
    opened(open = true) {
      pending.current = open
    },
    content: {
      onFocus(event: FocusEvent<HTMLElement>) {
        if (!pending.current) return
        pending.current = false
        const current = event.currentTarget.querySelector<HTMLElement>(selector)
        if (!current || current === event.target) return
        // After this focusin has run its course, so the Menu's own handler for it doesn't win the highlight back.
        queueMicrotask(() => {
          if (!current.isConnected) return
          current.focus({ preventScroll: true })
          current.scrollIntoView?.({ block: "nearest" })
        })
      },
      // A pointer choosing in the menu owns the highlight from then on.
      onPointerMove(_event: PointerEvent<HTMLElement>) {
        pending.current = false
      },
    },
  }
}

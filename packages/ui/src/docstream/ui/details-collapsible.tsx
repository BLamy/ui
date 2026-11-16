"use client"

/* A readonly disclosure that works before (and without) JavaScript. The server, and the client while it hydrates that
   HTML, render a native `<details>`/`<summary>`: it opens with a click or the keyboard and the browser's find-in-page
   reveals it, with no script at all. Once hydrated it becomes UI SDK's Collapsible (a button with `aria-expanded`,
   `data-open` / `data-closed`, `hidden="until-found"` on the closed panel), keeping whatever the reader opened before
   the script ran. A client-only render starts as the Collapsible. The class names are the same in both, so the CSS
   styles `details[open]` alongside `[data-open]`.

   Known limit: the swap is a different element type, so React remounts the content. A disclosure nested inside one
   that was open before hydration comes back at its default state, focus inside it is lost, and an iframe or demo in
   it mounts again. One level with nothing focused keeps its state. (README, "Known limits in 2.0".) */
import { useRef, useSyncExternalStore, type HTMLAttributes, type ReactNode } from "react"
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible"

const subscribe = () => () => {}

/** False on the server and while the client hydrates server HTML; true afterwards and on a client-only render. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}

export interface DetailsCollapsibleProps extends Omit<HTMLAttributes<HTMLElement>, "children" | "open"> {
  /** The always-visible trigger content. */
  summary: ReactNode
  children?: ReactNode
  defaultOpen?: boolean
  triggerClassName?: string
  panelClassName?: string
}

export function DetailsCollapsible({ summary, children, defaultOpen = false, triggerClassName, panelClassName, ...root }: DetailsCollapsibleProps) {
  const hydrated = useHydrated()
  const details = useRef<HTMLDetailsElement>(null)
  const openAtHydration = useRef<boolean | undefined>(undefined)
  if (!hydrated) {
    return (
      // The reader may open it before the script runs: that `open` is theirs, not a mismatch.
      <details ref={details} {...root} open={defaultOpen || undefined} suppressHydrationWarning>
        <summary className={triggerClassName}>{summary}</summary>
        <div className={panelClassName}>{children}</div>
      </details>
    )
  }
  // The render right after hydration still sees the server's <details>, and whether the reader opened it.
  openAtHydration.current ??= details.current?.open ?? defaultOpen
  return (
    <Collapsible {...root} defaultOpen={openAtHydration.current}>
      <CollapsibleTrigger className={triggerClassName}>{summary}</CollapsibleTrigger>
      <CollapsiblePanel hiddenUntilFound className={panelClassName}>
        {children}
      </CollapsiblePanel>
    </Collapsible>
  )
}

/* DOM test helpers (happy-dom): mount a tree, press keys the way a browser does, wait for timers. */
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export interface Mounted {
  host: HTMLDivElement
  root: Root
  rerender: (ui: ReactNode) => Promise<void>
  unmount: () => Promise<void>
}

/** Waits `ms` inside `act`, so timers, frames and effects settle. */
export const tick = (ms = 0) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) })

export async function mount(ui: ReactNode): Promise<Mounted> {
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(ui))
  await tick()
  return {
    host,
    root,
    rerender: async (next) => { await act(async () => root.render(next)); await tick() },
    unmount: async () => { await act(async () => root.unmount()); host.remove() },
  }
}

const ACTIVATES = new Set(["Enter", " "])

/** Presses a key on `el` (default: the focused element). Enter and Space click a button or link, as browsers do. */
export async function press(key: string, el: Element | null = document.activeElement, init: KeyboardEventInit = {}) {
  const target = el ?? document.body
  await act(async () => {
    const down = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init })
    const allowed = target.dispatchEvent(down)
    if (allowed && ACTIVATES.has(key) && target instanceof HTMLElement && (target.tagName === "BUTTON" || (target.tagName === "A" && key === "Enter"))) target.click()
    ;(document.activeElement ?? target).dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true, ...init }))
  })
  await tick()
}

export async function click(el: Element | null | undefined, init: MouseEventInit = {}) {
  if (!el) throw new Error("click: no element")
  await act(async () => {
    el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, ...init }))
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, ...init }))
    el.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, cancelable: true, button: 0, ...init }))
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0, ...init }))
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }))
  })
  await tick()
}

export async function focus(el: HTMLElement | null | undefined) {
  if (!el) throw new Error("focus: no element")
  await act(async () => el.focus())
  await tick()
}

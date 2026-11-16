/* A surface you orbit a 3D view from: drag to turn it, pinch or ⌘/Ctrl-scroll to zoom, double-click to go home.
   From the keyboard the arrows turn it, + and - zoom and 0 goes home. It holds the view (yaw and pitch in radians,
   and a zoom factor) as live state, since a drag changes it every frame and nothing renders from it: whoever
   draws reads `getView()`. */
import { bindDrag, createChange, definePrimitive, type ChangeDetails } from "@ui-sdk/core"
import { clamp } from "@ui-sdk/core/number"

export type OrbitView = { yaw: number; pitch: number; zoom: number }

// "reset-press" isn't in the shared vocabulary.
export type OrbitViewChangeReason = "drag" | "step-key" | "wheel" | "reset-press" | "imperative"

export type OrbitOptions = {
  view?: OrbitView
  defaultView?: OrbitView
  onViewChange?: (view: OrbitView, details: ChangeDetails<OrbitViewChangeReason>) => void
  /** Where a double-click, 0 and `reset()` go. Defaults to `defaultView`. */
  home?: OrbitView
  minZoom?: number
  maxZoom?: number
  /** How far it tips up or down, in radians. */
  maxPitch?: number
}

const HOME: OrbitView = { yaw: 0, pitch: 0, zoom: 1 }
const TURN = 0.15
const KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "0"] as const

/** @internal */
export const orbit = definePrimitive({
  name: "orbit",
  options: {
    view: "value",
    defaultView: "value",
    onViewChange: "callback",
    home: "value",
    minZoom: "number",
    maxZoom: "number",
    maxPitch: "number",
  },
  controlled: ["view"],
  live: ["view"],
  state: (options: OrbitOptions) => ({ view: options.view ?? options.defaultView ?? HOME, dragging: false }),
  sync: (options) => (options.view === undefined ? {} : { view: options.view }),
  api: (context) => {
    const change = createChange(context)
    const within = (view: OrbitView): OrbitView => {
      const { minZoom = 0.3, maxZoom = 8, maxPitch = 1.5 } = context.options()
      return { yaw: view.yaw, pitch: clamp(view.pitch, -maxPitch, maxPitch), zoom: clamp(view.zoom, minZoom, maxZoom) }
    }
    const set = (next: Partial<OrbitView>, details: { reason: OrbitViewChangeReason; event?: Event }) => {
      const view = context.store.get().view
      const to = within({ ...view, ...next })
      if (to.yaw === view.yaw && to.pitch === view.pitch && to.zoom === view.zoom) return false
      return change("view", to, details)
    }
    const home = () => context.options().home ?? context.options().defaultView ?? HOME
    let stop: (() => void) | undefined
    context.onDestroy(() => stop?.())

    return {
      getView: () => context.store.get().view,
      setView: (view: Partial<OrbitView>) => set(view, { reason: "imperative" }),
      /** Turns it without reporting a change, for a view that spins by itself until someone takes over. */
      spin(yaw: number) {
        const view = context.store.get().view
        context.store.set({ view: { ...view, yaw: view.yaw + yaw } })
      },
      reset: (event?: Event) => set(home(), { reason: event ? "reset-press" : "imperative", event }),
      keydown(event: KeyboardEvent) {
        if (event.altKey || event.ctrlKey || event.metaKey) return
        const view = context.store.get().view
        const next: Partial<OrbitView> | undefined =
          event.key === "ArrowLeft" ? { yaw: view.yaw - TURN }
          : event.key === "ArrowRight" ? { yaw: view.yaw + TURN }
          : event.key === "ArrowUp" ? { pitch: view.pitch - TURN }
          : event.key === "ArrowDown" ? { pitch: view.pitch + TURN }
          : event.key === "+" || event.key === "=" ? { zoom: view.zoom * 1.2 }
          : event.key === "-" ? { zoom: view.zoom / 1.2 }
          : event.key === "0" ? home()
          : undefined
        if (!next) return
        event.preventDefault()
        set(next, { reason: "step-key", event })
      },
      pointerdown(event: PointerEvent, el: HTMLElement) {
        if (event.button !== 0) return
        stop?.()
        stop = bindDrag(el, event, {
          onStart: () => {
            context.store.set({ dragging: true })
          },
          onMove: ({ movementX, movementY, event: move }) => {
            const view = context.store.get().view
            set({ yaw: view.yaw + movementX * 0.01, pitch: view.pitch + movementY * 0.01 }, { reason: "drag", event: move })
          },
          onEnd: () => {
            stop = undefined
            context.store.set({ dragging: false })
          },
        })
      },
      // Plain scrolling keeps scrolling the page; a pinch (which arrives with ctrlKey) and ⌘/Ctrl-scroll zoom.
      wheel(event: WheelEvent) {
        if (!event.ctrlKey && !event.metaKey) return
        event.preventDefault()
        set({ zoom: context.store.get().view.zoom * Math.exp(-event.deltaY * 0.01) }, { reason: "wheel", event })
      },
    }
  },
  slots: (slot) => ({
    root: slot<object, { dragging: boolean }>({
      role: "application",
      focus: "tab-stop",
      keys: [...KEYS],
      state: (state) => ({ dragging: state.dragging }),
      attrs: (state) => ({
        tabindex: "0",
        "data-dragging": state.dragging ? "" : undefined,
      }),
      on: {
        keydown: (event, { api }) => api.keydown(event as KeyboardEvent),
        pointerdown: (event, { el, api }) => {
          if (el) api.pointerdown(event as PointerEvent, el)
        },
        dblclick: (event, { api }) => {
          api.reset(event)
        },
      },
      // React listens to wheel passively, and a zoom has to cancel the page's own.
      bind: (el, part) => {
        const wheel = (event: WheelEvent) => part.api.wheel(event)
        el.addEventListener("wheel", wheel, { passive: false })
        return () => el.removeEventListener("wheel", wheel)
      },
    }),
  }),
  agent: { actions: ["setView", "reset"] },
})


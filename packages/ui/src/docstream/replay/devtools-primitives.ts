/* The two pieces of the replay DevTools UI SDK has no component for, as primitives of its core:

   - `devtoolsPanel`: the panel docked over the page and the separator on its top edge that resizes it. The panel
     overlays the stage rather than sharing it with a second pane, so it isn't a `Resizable` group.
   - `requestTable`: the Network table as a grid of rows, one of which can be selected to open its details. One tab
     stop, arrows between rows, Enter or Space to select.

   Their names keep the player's `data-slot` hooks: `replay-devtools`, `replay-devtools-resize`,
   `replay-devtools-table` (and its new `replay-devtools-table-row`). */
import { bindDrag, createChange, createRovingFocus, css, definePrimitive, type ChangeDetails } from "@ui-sdk/core"

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/* ── the docked panel ──────────────────────────────────────────────────────────────── */

type DevtoolsPanelSizeReason = "drag" | "resize-key" | "imperative"

type DevtoolsPanelOptions = {
  /** The panel's height, in percent of the stage it docks to. */
  size?: number
  defaultSize?: number
  onSizeChange?: (size: number, details: ChangeDetails<DevtoolsPanelSizeReason>) => void
  /** The smallest and largest it gets, in percent (default 22 and 92). */
  minSize?: number
  maxSize?: number
}

/** @internal */
export const devtoolsPanel = definePrimitive({
  name: "replay-devtools",
  options: { size: "number", defaultSize: "number", onSizeChange: "callback", minSize: "number", maxSize: "number" },
  controlled: ["size"],
  state: (options: DevtoolsPanelOptions) => ({
    size: options.size ?? options.defaultSize ?? 58,
    min: options.minSize ?? 22,
    max: options.maxSize ?? 92,
    dragging: false,
  }),
  sync: (options) => ({
    ...(options.size === undefined ? {} : { size: options.size }),
    min: options.minSize ?? 22,
    max: options.maxSize ?? 92,
  }),
  api: (context) => {
    const change = createChange(context)
    const { store } = context
    let stop: (() => void) | undefined
    context.onDestroy(() => stop?.())
    const resizeTo = (size: number, details: { reason: DevtoolsPanelSizeReason; event?: Event }) => {
      const { min, max } = store.get()
      return change("size", clamp(Math.round(size * 10) / 10, min, max), details)
    }
    return {
      /** Sets the panel's height, in percent of the stage, within its limits. */
      setSize: (size: number) => resizeTo(size, { reason: "imperative" }),
      pointerdown(event: PointerEvent, el: HTMLElement) {
        // The stage the panel docks to: the panel's own parent.
        const stage = context.element("root")?.parentElement
        if (event.button !== 0 || !stage) return
        event.preventDefault()
        const from = store.get().size
        stop?.()
        stop = bindDrag(el, event, {
          cancelOnEscape: true,
          onStart: () => void store.set({ dragging: true }),
          onMove: ({ y, event: move }) => {
            const box = stage.getBoundingClientRect()
            if (box.height > 0) resizeTo(((box.bottom - y) / box.height) * 100, { reason: "drag", event: move })
          },
          onEnd: (end, canceled) => {
            store.set({ dragging: false })
            if (canceled) resizeTo(from, { reason: "drag", event: end })
          },
        })
      },
      keydown(event: KeyboardEvent) {
        if (event.altKey || event.ctrlKey || event.metaKey) return
        const { size, min, max } = store.get()
        const step = event.shiftKey ? 10 : 2
        // The separator sits on the panel's top edge: up makes the panel taller.
        const next = { ArrowUp: size + step, ArrowDown: size - step, Home: min, End: max }[event.key]
        if (next === undefined) return
        event.preventDefault()
        resizeTo(next, { reason: "resize-key", event })
      },
    }
  },
  slots: (slot) => ({
    root: slot<object, { size: number; dragging: boolean }>({
      state: (state) => ({ size: state.size, dragging: state.dragging }),
      attrs: (state, part) => ({
        id: `${part.id}-panel`,
        "data-dragging": state.dragging ? "" : undefined,
        style: css({ "--replay-devtools-height": `${state.size}%` }),
      }),
    }),
    resize: slot<object, { dragging: boolean }>({
      role: "separator",
      state: (state) => ({ dragging: state.dragging }),
      attrs: (state, part) => ({
        tabindex: "0",
        "aria-orientation": "horizontal",
        "aria-controls": `${part.id}-panel`,
        "aria-valuenow": String(Math.round(state.size)),
        "aria-valuemin": String(state.min),
        "aria-valuemax": String(state.max),
        "aria-valuetext": `${Math.round(state.size)}% of the page`,
        "data-dragging": state.dragging ? "" : undefined,
      }),
      on: {
        pointerdown: (event, { el, api }) => {
          if (el) api.pointerdown(event as PointerEvent, el)
        },
        keydown: (event, { api }) => api.keydown(event as KeyboardEvent),
      },
    }),
  }),
  agent: { actions: ["setSize"] },
})

/* ── the Network table ─────────────────────────────────────────────────────────────── */

type RequestTableOptions = {
  /** The selected row's value, or null. */
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null, details: ChangeDetails<"item-press">) => void
}

type RowProps = { value: string }

/** @internal */
export const requestTable = definePrimitive({
  name: "replay-devtools-table",
  options: { value: "string", defaultValue: "string", onValueChange: "callback" },
  controlled: ["value"],
  state: (options: RequestTableOptions) => ({
    value: options.value ?? options.defaultValue ?? null,
    focused: null as string | null,
  }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => {
    const change = createChange(context)
    const roving = createRovingFocus<{ value: string | null; focused: string | null }, RowProps>(context, {
      slot: "row",
      key: "focused",
      orientation: () => "vertical",
      preferred: (row) => row.key === context.store.get().value,
      claims: (state, row) => state.value === null || row.key === state.value,
    })
    /** Selects a row, or clears the selection when it's the selected one. */
    const toggle = (key: string, event?: Event) =>
      change("value", context.store.get().value === key ? null : key, { reason: "item-press", event })
    return {
      roving,
      toggle,
      keydown(event: KeyboardEvent, el: HTMLElement, key: string) {
        // Only the row's own keys: a control inside a cell keeps its own.
        if (event.target !== el) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          toggle(key, event)
          return
        }
        roving.keydown(event, el)
      },
    }
  },
  slots: (slot) => ({
    root: slot({
      role: "grid",
      keys: { none: "Each row handles the arrow keys, Home, End, Enter and Space." },
    }),
    row: slot<RowProps, { selected: boolean }>({
      role: "row",
      props: { value: "string" },
      state: (state, part) => ({ selected: state.value === part.key }),
      attrs: (state, part) => ({
        tabindex: part.api.roving.tabIndex(state, part),
        "aria-selected": String(state.value === part.key),
        "data-selected": state.value === part.key ? "" : undefined,
      }),
      press: ({ api, key }, event) => api.toggle(key, event),
      on: {
        keydown: (event, { el, api, key }) => {
          if (el) api.keydown(event as KeyboardEvent, el, key)
        },
      },
      bind: (el, part) => part.api.roving.bind(el, part),
    }),
  }),
  agent: { actions: ["toggle"] },
})

export { type DevtoolsPanelOptions, type RequestTableOptions }

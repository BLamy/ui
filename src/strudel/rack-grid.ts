/* A grid of modules you can rearrange and resize. Each module has a grip and a corner. The grip reorders (UI SDK's
   `createReorder`): drag it, or press Space or Enter to pick the module up, move it with the arrows, Home and End,
   and press Space or Enter to drop it (Escape puts it back). The corner resizes: drag it, or use the arrows, Left and
   Right by a column and Up and Down by 24px. Widths are kept in twelfths of the grid, heights as a minimum in px. */
import {
  announce,
  bindDrag,
  createChange,
  createCommit,
  createReorder,
  definePrimitive,
  isRTL,
  type ChangeDetails,
  type CommitDetails,
  type ReorderDraft,
  type ReorderReason,
} from "@ui-sdk/core"
import { clamp } from "@ui-sdk/core/number"

export type RackGridSize = { w: number; h?: number }
export type RackGridSizes = Record<string, RackGridSize>
export type RackGridSizesChangeReason = "drag" | "handle-key"

export type RackGridOptions = {
  /** The modules' keys, in order. */
  order?: string[]
  defaultOrder?: string[]
  onOrderChange?: (order: string[], details: ChangeDetails<ReorderReason>) => void
  /** Width in twelfths and an optional minimum height in px, per key. */
  sizes?: RackGridSizes
  defaultSizes?: RackGridSizes
  onSizesChange?: (sizes: RackGridSizes, details: ChangeDetails<RackGridSizesChangeReason>) => void
  onSizesCommit?: (sizes: RackGridSizes, details: CommitDetails<RackGridSizesChangeReason>) => void
  /** How many columns the grid shows now. Defaults to 12. */
  columns?: number
  /** The gap between columns, in px. Defaults to 10. */
  gap?: number
  /** The least height a drag gives a module, in px. Defaults to 60. */
  minHeight?: number
  /** What screen readers call a module. Defaults to its key. */
  label?: (key: string) => string | undefined
}

type State = { order: string[]; moving: ReorderDraft | null; sizes: RackGridSizes; resizing: string | null }
type ItemProps = { value: string; span?: number }
// A handle takes its module's key from the item around it.
type HandleProps = { value?: string }

/** @internal */
export const rackGrid = definePrimitive({
  name: "rack-grid",
  options: {
    order: "list",
    defaultOrder: "list",
    onOrderChange: "callback",
    sizes: "value",
    defaultSizes: "value",
    onSizesChange: "callback",
    onSizesCommit: "callback",
    columns: "number",
    gap: "number",
    minHeight: "number",
    label: "value",
  },
  controlled: ["order", "sizes"],
  commits: ["sizes"],
  state: (options: RackGridOptions): State => ({
    order: options.order ?? options.defaultOrder ?? [],
    moving: null,
    sizes: options.sizes ?? options.defaultSizes ?? {},
    resizing: null,
  }),
  sync: (options) => ({
    ...(options.order === undefined ? {} : { order: options.order }),
    ...(options.sizes === undefined ? {} : { sizes: options.sizes }),
  }),
  api: (context) => {
    const change = createChange(context)
    const commit = createCommit(context)
    const nameOf = (key: string) => context.options().label?.(key) ?? key
    const reorder = createReorder<State, ItemProps>(context, {
      slot: "item",
      key: "order",
      draft: "moving",
      set: (value, details) => change("order", value, details),
      orientation: () => "grid",
      label: (key) => context.options().label?.(key),
    })
    const widthOf = (key: string) => context.store.get().sizes[key]?.w ?? context.props<ItemProps>("item", key)?.span ?? 6
    const setSize = (key: string, size: Partial<RackGridSize>, details: { reason: RackGridSizesChangeReason; event?: Event }) => {
      const { sizes } = context.store.get()
      const current = sizes[key]
      const next = { ...current, w: widthOf(key), ...size }
      if (current && current.w === next.w && current.h === next.h) return false
      return change("sizes", { ...sizes, [key]: next }, details)
    }
    let stop: (() => void) | undefined
    context.onDestroy(() => stop?.())

    return {
      reorder,
      resizeStart(event: PointerEvent, key: string, el: HTMLElement) {
        const item = context.element("item", key)
        const root = context.element("root")
        if (event.button !== 0 || !item || !root) return
        const box = item.getBoundingClientRect()
        const rtl = isRTL(el)
        let moved = false
        stop?.()
        stop = bindDrag(el, event, {
          onStart: () => {
            context.store.set({ resizing: key })
          },
          onMove: ({ x, y, event: move }) => {
            const { columns = 12, gap = 10, minHeight = 60 } = context.options()
            const column = (root.clientWidth - gap * (columns - 1)) / columns
            const across = rtl ? box.right - x : x - box.left
            const span = clamp(Math.round((across + gap) / (column + gap)), 1, columns)
            const size = { w: Math.round((span / columns) * 1200) / 100, h: Math.max(minHeight, Math.round(y - box.top)) }
            moved = setSize(key, size, { reason: "drag", event: move }) || moved
          },
          onEnd: (up) => {
            stop = undefined
            context.store.set({ resizing: null })
            if (moved) commit("sizes", context.store.get().sizes, { reason: "drag", event: up })
          },
        })
      },
      resizeKey(event: KeyboardEvent, key: string, el: HTMLElement) {
        if (event.altKey || event.ctrlKey || event.metaKey) return
        const { columns = 12 } = context.options()
        const step = 12 / columns
        const w = widthOf(key)
        const h = context.store.get().sizes[key]?.h ?? (context.element("item", key)?.offsetHeight || 120)
        const wider = isRTL(el) ? "ArrowLeft" : "ArrowRight"
        const narrower = isRTL(el) ? "ArrowRight" : "ArrowLeft"
        const size: Partial<RackGridSize> | undefined =
          event.key === wider ? { w: Math.min(12, w + step) }
          : event.key === narrower ? { w: Math.max(step, w - step) }
          : event.key === "ArrowDown" ? { h: h + 24 }
          : event.key === "ArrowUp" ? { h: Math.max(0, h - 24) }
          : undefined
        if (!size) return
        event.preventDefault()
        if (!setSize(key, size, { reason: "handle-key", event })) return
        commit("sizes", context.store.get().sizes, { reason: "handle-key", event })
        announce(
          size.w === undefined
            ? `${nameOf(key)}, at least ${size.h} pixels tall`
            : `${nameOf(key)}, ${Math.max(1, Math.round((size.w / 12) * columns))} of ${columns} columns wide`,
        )
      },
    }
  },
  slots: (slot) => ({
    root: slot<{}, { order: string[]; moving: string | null; resizing: string | null }>({
      role: "list",
      state: (state, { api }) => ({ order: api.reorder.order(state), moving: state.moving?.key ?? null, resizing: state.resizing }),
      attrs: (state) => ({
        "data-moving": state.moving ? "" : undefined,
        "data-resizing": state.resizing ? "" : undefined,
      }),
    }),
    item: slot<ItemProps, { moving: boolean; dragging: boolean; resizing: boolean }>({
      role: "listitem",
      props: { value: "string", span: "number" },
      state: (state, { api, key }) => ({
        moving: api.reorder.moving(state, key),
        dragging: api.reorder.dragging(state, key),
        resizing: state.resizing === key,
      }),
      attrs: (state, { api, key }) => ({
        "data-moving": api.reorder.moving(state, key) ? "" : undefined,
        "data-dragging": api.reorder.dragging(state, key) ? "" : undefined,
        "data-resizing": state.resizing === key ? "" : undefined,
      }),
      bind: (el, part) => part.api.reorder.bind(el, part),
    }),
    grip: slot<HandleProps, { moving: boolean }>({
      props: { value: { kind: "string", from: "item", required: true } },
      state: (state, { api, key }) => ({ moving: api.reorder.moving(state, key) }),
      attrs: (state, { api, key }) => ({
        type: "button",
        "aria-pressed": String(api.reorder.moving(state, key)),
        "data-pressed": api.reorder.moving(state, key) ? "" : undefined,
      }),
      on: {
        keydown: (event, { api, key }) => {
          api.reorder.keydown(event as KeyboardEvent, key)
        },
        pointerdown: (event, { api, key }) => api.reorder.pointerdown(event as PointerEvent, key),
      },
    }),
    corner: slot<HandleProps, { resizing: boolean }>({
      props: { value: { kind: "string", from: "item", required: true } },
      state: (state, { key }) => ({ resizing: state.resizing === key }),
      attrs: (state, { key }) => ({
        type: "button",
        "data-dragging": state.resizing === key ? "" : undefined,
      }),
      on: {
        keydown: (event, { el, api, key }) => {
          if (el) api.resizeKey(event as KeyboardEvent, key, el)
        },
        pointerdown: (event, { el, api, key }) => {
          if (el) api.resizeStart(event as PointerEvent, key, el)
        },
      },
    }),
  }),
})


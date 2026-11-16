/* A rotary knob: a slider you turn by dragging up and down (Shift for fine) or with the keyboard map every UI SDK
   numeric control shares (arrows step, Shift or Page Up/Down take the large step, Alt the small one, Home/End the
   bounds). Steps and drags move along the knob's travel, from 0 to 1, so a log scale turns evenly. A double-click
   goes back to `resetValue`. */
import { bindDrag, createChange, createCommit, definePrimitive, type ChangeDetails, type CommitDetails } from "@ui-sdk/core"
import { clamp, fractionOf, roundTo, stepBy, stepFromKey, valueAt, type NumberScale } from "@ui-sdk/core/number"

// "reset-press" isn't in the shared vocabulary.
export type KnobValueChangeReason = "drag" | "step-key" | "reset-press" | "imperative"

export type KnobOptions = {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number, details: ChangeDetails<KnobValueChangeReason>) => void
  onValueCommit?: (value: number, details: CommitDetails<KnobValueChangeReason>) => void
  min?: number
  max?: number
  /** `"log"` needs a positive `min`. */
  scale?: "linear" | "log"
  /** How far an arrow turns it, as a share of the travel. */
  step?: number
  largeStep?: number
  smallStep?: number
  /** Pixels of drag from one end of the travel to the other. */
  travel?: number
  /** Where a double-click puts it. */
  resetValue?: number
  disabled?: boolean
  /** What screen readers hear for a value, and what the value part shows. */
  valueText?: (value: number) => string
}

const KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"] as const

const boundsOf = (options: KnobOptions) => ({ min: options.min ?? 0, max: options.max ?? 1 })
const scaleOf = (options: KnobOptions): NumberScale => (options.scale === "log" && (options.min ?? 0) > 0 ? "log" : "linear")
const plain = (value: number) => String(+value.toFixed(4))

/** @internal */
export const knob = definePrimitive({
  name: "knob",
  options: {
    value: "number",
    defaultValue: "number",
    onValueChange: "callback",
    onValueCommit: "callback",
    min: "number",
    max: "number",
    scale: "string",
    step: "number",
    largeStep: "number",
    smallStep: "number",
    travel: "number",
    resetValue: "number",
    disabled: "boolean",
    valueText: "value",
  },
  controlled: ["value"],
  commits: ["value"],
  state: (options: KnobOptions) => ({
    value: options.value ?? options.defaultValue ?? options.min ?? 0,
    dragging: false,
    // Options the parts draw from, copied so attributes and render functions read state alone.
    min: options.min ?? 0,
    max: options.max ?? 1,
    log: scaleOf(options) === "log",
    disabled: !!options.disabled,
    format: options.valueText ?? null,
  }),
  sync: (options) => ({
    ...(options.value === undefined ? {} : { value: options.value }),
    ...boundsOf(options),
    log: scaleOf(options) === "log",
    disabled: !!options.disabled,
    format: options.valueText ?? null,
  }),
  api: (context) => {
    const change = createChange(context)
    const commit = createCommit(context)
    const fraction = () => fractionOf(context.store.get().value, boundsOf(context.options()), scaleOf(context.options()))
    // Rounded, so 55% of 100 is 55 and not 55.00000000000001.
    const at = (position: number) => roundTo(valueAt(clamp(position, 0, 1), boundsOf(context.options()), scaleOf(context.options())), 10)
    let stop: (() => void) | undefined
    context.onDestroy(() => stop?.())

    return {
      keydown(event: KeyboardEvent) {
        if (context.options().disabled || event.ctrlKey || event.metaKey) return
        const move = stepFromKey(event, { orientation: "vertical" })
        if (!move) return
        event.preventDefault()
        const { step = 0.05, largeStep = 0.2, smallStep = 0.01 } = context.options()
        // A step from just off the grid only lands on it, so the travel is read without a log scale's noise.
        const next = at(stepBy(roundTo(fraction(), 6), move, { min: 0, max: 1, step, largeStep, smallStep }))
        if (change("value", next, { reason: "step-key", event })) commit("value", next, { reason: "step-key", event })
      },
      pointerdown(event: PointerEvent, el: HTMLElement) {
        if (context.options().disabled || event.button !== 0) return
        el.focus({ preventScroll: true })
        const from = { y: event.clientY, fraction: fraction() }
        let moved = false
        stop?.()
        stop = bindDrag(el, event, {
          onStart: () => {
            context.store.set({ dragging: true })
          },
          onMove: ({ y, event: move }) => {
            const travel = context.options().travel ?? 160
            moved = change("value", at(from.fraction + ((from.y - y) / travel) * (move.shiftKey ? 0.2 : 1)), { reason: "drag", event: move }) || moved
          },
          onEnd: (up) => {
            stop = undefined
            context.store.set({ dragging: false })
            if (moved) commit("value", context.store.get().value, { reason: "drag", event: up })
          },
        })
      },
      setValue(value: number) {
        const { min, max } = boundsOf(context.options())
        return change("value", clamp(value, min, max), { reason: "imperative" })
      },
      reset(event?: Event) {
        const { disabled, resetValue } = context.options()
        if (disabled || resetValue === undefined) return
        if (change("value", resetValue, { reason: "reset-press", event })) commit("value", resetValue, { reason: "reset-press", event })
      },
    }
  },
  slots: (slot) => ({
    root: slot<{}, { value: number; fraction: number; text: string; disabled: boolean; dragging: boolean }>({
      state: (state) => ({
        value: state.value,
        fraction: fractionOf(state.value, state, state.log ? "log" : "linear"),
        text: (state.format ?? plain)(state.value),
        disabled: state.disabled,
        dragging: state.dragging,
      }),
      attrs: (state) => ({
        "data-disabled": state.disabled ? "" : undefined,
        "data-dragging": state.dragging ? "" : undefined,
      }),
    }),
    dial: slot<{}, { value: number; fraction: number; disabled: boolean; dragging: boolean }>({
      role: "slider",
      focus: "tab-stop",
      keys: [...KEYS],
      state: (state) => ({
        value: state.value,
        fraction: fractionOf(state.value, state, state.log ? "log" : "linear"),
        disabled: state.disabled,
        dragging: state.dragging,
      }),
      attrs: (state) => ({
        tabindex: "0",
        "aria-valuemin": String(state.min),
        "aria-valuemax": String(state.max),
        "aria-valuenow": String(+state.value.toFixed(4)),
        "aria-valuetext": state.format ? state.format(state.value) : undefined,
        "aria-disabled": state.disabled ? "true" : undefined,
        "data-disabled": state.disabled ? "" : undefined,
        "data-dragging": state.dragging ? "" : undefined,
      }),
      on: {
        keydown: (event, { api }) => api.keydown(event as KeyboardEvent),
        pointerdown: (event, { el, api }) => {
          if (el) api.pointerdown(event as PointerEvent, el)
        },
        dblclick: (event, { api }) => api.reset(event),
      },
    }),
    value: slot<{}, { text: string }>({
      state: (state) => ({ text: (state.format ?? plain)(state.value) }),
      attrs: (state) => ({ "data-disabled": state.disabled ? "" : undefined }),
    }),
  }),
  agent: { actions: ["setValue", "reset"] },
})


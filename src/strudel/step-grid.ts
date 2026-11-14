/* A step sequencer's keys: pressed-state buttons in rows that may nest, with one tab stop. Left and Right walk the
   steps in order, Up and Down go to the nearest step in the row above or below, Home and End to the ends. F2 or a
   double-click swaps a step for its editor: Enter (or leaving it) commits, Escape cancels, and focus goes back to
   the step. */
import { createRovingFocus, definePrimitive, dispatch, spatialMove, type ChangeDetails } from "@ui-sdk/core"

export type StepGridOptions = {
  /** A step was pressed: toggle it. */
  onStepPress?: (step: string, details: ChangeDetails<"press">) => void
  /** A step's editor was committed with its text. */
  onStepEdit?: (edit: { step: string; text: string }, details: ChangeDetails<"input-commit">) => void
  /** Whether F2 and a double-click open a step's editor. Defaults to true. */
  editable?: boolean
}

type State = { focused: string | null; editing: string | null }
type CellProps = { value: string; pressed?: boolean }

/** @internal */
export const stepGrid = definePrimitive({
  name: "step-grid",
  options: { onStepPress: "callback", onStepEdit: "callback", editable: "boolean" },
  state: (_options: StepGridOptions): State => ({ focused: null, editing: null }),
  api: (context) => {
    const spatial = spatialMove()
    const roving = createRovingFocus<State, CellProps>(context, {
      slot: "cell",
      key: "focused",
      move: (event, around) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return undefined
        const { from, items, rtl } = around
        const at = items.findIndex((item) => item.key === from.key)
        switch (event.key) {
          case "ArrowRight":
            return (items[at + (rtl ? -1 : 1)] ?? from).key
          case "ArrowLeft":
            return (items[at + (rtl ? 1 : -1)] ?? from).key
          case "Home":
            return items[0]?.key
          case "End":
            return items[items.length - 1]?.key
          case "ArrowUp":
          case "ArrowDown":
            return spatial(event, around) ?? from.key
        }
        return undefined
      },
    })
    const finish = (step: string) => {
      if (context.store.get().editing !== step) return false
      context.store.set({ editing: null })
      return true
    }
    return {
      roving,
      toggle: (step: string, event?: Event) => {
        dispatch(context, "onStepPress", step, { reason: "press", event })
      },
      edit(step: string) {
        if (context.options().editable === false) return
        context.store.set({ editing: step })
      },
      /** Ends the edit with the editor's text. `refocus` sends focus back to the step, as after Enter. */
      commit(step: string, text: string, event?: Event, refocus = false) {
        if (!finish(step)) return
        dispatch(context, "onStepEdit", { step, text }, { reason: "input-commit", event })
        if (refocus) roving.focus(step)
      },
      cancel(step: string) {
        if (finish(step)) roving.focus(step)
      },
    }
  },
  slots: (slot) => ({
    root: slot({ role: "group" }),
    cell: slot<CellProps, { pressed: boolean }>({
      role: "button",
      focus: "roving",
      props: { value: "string", pressed: "boolean" },
      present: (state, part) => state.editing !== part.key,
      state: (_state, part) => ({ pressed: !!part.props.pressed }),
      attrs: (state, part) => ({
        type: "button",
        "aria-pressed": String(!!part.props.pressed),
        tabindex: part.api.roving.tabIndex(state, part),
        "data-pressed": part.props.pressed ? "" : undefined,
      }),
      press: ({ api, key }, event) => api.toggle(key, event),
      on: {
        keydown: (event, { el, api, key }) => {
          if ((event as KeyboardEvent).key === "F2") {
            event.preventDefault()
            api.edit(key)
          } else if (el) api.roving.keydown(event as KeyboardEvent, el)
        },
        dblclick: (_event, { api, key }) => api.edit(key),
      },
      bind: (el, part) => part.api.roving.bind(el, part),
    }),
    editor: slot<{ value: string }>({
      props: { value: "string" },
      present: (state, part) => state.editing === part.key,
      on: {
        keydown: (event, { el, api, key }) => {
          const pressed = (event as KeyboardEvent).key
          if (pressed === "Enter") {
            event.preventDefault()
            api.commit(key, (el as HTMLInputElement).value, event, true)
          } else if (pressed === "Escape") {
            event.preventDefault()
            api.cancel(key)
          }
        },
        blur: (event, { el, api, key }) => api.commit(key, (el as HTMLInputElement).value, event),
      },
      bind: (el) => {
        el.focus()
        ;(el as HTMLInputElement).select?.()
      },
    }),
  }),
  agent: { actions: ["toggle"] },
})


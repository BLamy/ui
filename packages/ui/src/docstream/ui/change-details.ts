import { sourceOf, type ChangeDetails } from "@ui-sdk/core"

/** The details a docstream callback hands out with a value (`onMarkerAction(marker, details)`, `onCodeChange(code,
 *  details)`): UI SDK's `ChangeDetails`, as the kit's own callbacks pass them, with `reason`, `event`, `source`,
 *  `cancel()` and `canceled`. Call the consumer first and act only when `!details.canceled`. */
export function changeDetails<Reason extends string>(reason: Reason, event?: Event): ChangeDetails<Reason> {
  let canceled = false
  return {
    reason,
    event,
    source: event ? sourceOf(event) : "programmatic",
    cancel: () => {
      canceled = true
    },
    get canceled() {
      return canceled
    },
  } as ChangeDetails<Reason>
}

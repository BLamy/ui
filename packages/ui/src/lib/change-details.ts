import { sourceOf, type ChangeDetails, type ChangeSource } from '@ui-sdk/core';

/* ══ change details — what a kit hook's `on<Key>Change(value, details)` receives, for state that is not a UI SDK
   primitive's (a FilterBar's filters, a FontPicker's family): the same `ChangeDetails` UI SDK's `createChange` hands
   out, with `reason`, `event`, `source`, `cancel()` and `canceled`. Call the consumer with them first and write your
   own state only when `!details.canceled`, as `createChange` does; a controlled consumer decides by what it passes
   back. No React in here. ══ */

/** What a change's caller knows: why, the event behind it, and who caused it when that is already known (a UI SDK
    part's details carry it). */
export interface ChangeGiven<Reason extends string> {
  reason: Reason;
  event?: Event;
  source?: ChangeSource;
}

/** Cancelable details for one change. `source` falls back to what the event says, read by UI SDK's `sourceOf`;
    with no event (a call from code) it is `programmatic`. */
export function changeDetails<Reason extends string>({ reason, event, source }: ChangeGiven<Reason>): ChangeDetails<Reason> {
  let canceled = false;
  return {
    reason,
    event,
    source: source ?? (event ? sourceOf(event) : 'programmatic'),
    cancel: () => {
      canceled = true;
    },
    get canceled() {
      return canceled;
    },
  } as ChangeDetails<Reason>;
}

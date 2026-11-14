import { definePrimitive, dispatch, type ChangeDetails } from '@ui-sdk/core';
import type { InputController } from '@ui-sdk/core/input';

/* The keys a search field adds around UI SDK's Input, which stays the control: Escape empties a query, and only
   then claims the key, so an empty field leaves Escape to the popup or sheet around it; Enter submits the query.
   Its `input` part renders the Input, hears its keys and writes it through its controller, so the Input's own
   `onValueChange` reports the clear. Submitting is an action, not state, so it goes out through
   `dispatch` with the details a change carries, and an agent can run it as `submit`. */

/** Why a query was submitted: Enter in the field, or `submit()` (an agent's call reports `source: 'agent'`). */
export type SearchInputSubmitReason = 'enter-key' | 'imperative';

/** What `onSubmit` receives besides the query: `reason`, `event`, `source` and `cancel()`. Canceling an Enter
 *  leaves the key to the form around the field. */
export type SearchInputSubmitDetails = ChangeDetails<SearchInputSubmitReason>;

export type SearchInputOptions = {
  /** The controller of the Input inside (`createInputController()`), which Escape clears. */
  input: InputController;
  /** Enter in the field. With it, Enter no longer submits the form around the field. */
  onSubmit?: (value: string, details: SearchInputSubmitDetails) => void;
};

export const searchInput = definePrimitive({
  name: 'search-input',
  options: { input: 'value', onSubmit: 'callback' },
  state: (options: SearchInputOptions) => ({ submits: options.onSubmit !== undefined }),
  sync: (options) => ({ submits: options.onSubmit !== undefined }),
  api: (context) => {
    /** Runs the query in the field. Returns whether `onSubmit` ran without being canceled. */
    const submit = (event?: KeyboardEvent): boolean => {
      const { input, onSubmit } = context.options();
      if (!onSubmit) return false;
      return !dispatch(context, 'onSubmit', input.getValue(), event ? { reason: 'enter-key', event } : { reason: 'imperative' });
    };
    return {
      submit: () => { submit(); },
      internal: {
        keydown(event: KeyboardEvent) {
          const field = event.target as HTMLInputElement;
          // A read-only query can't be cleared, but it can still be submitted.
          if (event.key === 'Escape' && !field.readOnly && field.value !== '') {
            event.preventDefault();
            // A key that does the Clear part's job reports its reason.
            context.options().input.clear({ reason: 'clear-press', event });
          } else if (event.key === 'Enter' && submit(event)) {
            event.preventDefault();
          }
        },
      },
    };
  },
  slots: (slot) => ({
    root: slot({}),
    // UI SDK's Input, rendered through this part: it names the field for an agent, and its keys are the field's.
    // A slot hears no key that a handler before it took, or that belongs to an input method composing text.
    input: slot({
      on: { keydown: (event, { api }) => api.internal.keydown(event) },
    }),
  }),
  // The Input carries the value and its actions; the field is listed, under the Input's name, only when it submits.
  agent: { actions: ['submit'], shown: (state) => state.submits },
});

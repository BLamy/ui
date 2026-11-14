import { createChange, createListbox, definePrimitive, selects, type ChangeDetails } from '@ui-sdk/core';

/* ══ optionSearch — a search field over an always-open list of options you tick: UI SDK's `createListbox` (virtual
   focus: the field keeps focus while the arrows move the highlight, and typing filters by label and keywords,
   ignoring case and accents) with a list of chosen values. Enter or a press toggles the highlighted option; Escape
   empties the search first. The list is a `listbox` with `aria-multiselectable`, each option `aria-selected` while
   it is chosen.
   No React in here: render it with `createParts(optionSearch, { root: 'div', input: 'input', list: 'div',
   option: 'div', empty: 'div' })`. ══ */

/** Why the chosen values changed. */
export type OptionSearchReason = 'item-press' | 'enter-key' | 'imperative';

export interface OptionSearchOptions {
  /** The chosen values. Pass it to control them. */
  value?: string[];
  /** The values chosen at first, when uncontrolled. */
  defaultValue?: string[];
  /** Runs when an option is ticked or unticked, with every chosen value in the order they were chosen. */
  onValueChange?: (value: string[], details: ChangeDetails<OptionSearchReason>) => void;
}

interface OptionSearchState {
  value: string[];
  query: string;
  highlighted: string | null;
}

interface OptionProps {
  value: string;
  /** The text the search matches, when the option's text is more than its name. */
  label?: string;
  /** More words the search finds it by. */
  keywords?: string[];
  disabled?: boolean;
}

export const optionSearch = definePrimitive({
  name: 'option-search',
  options: { value: 'list', defaultValue: 'list', onValueChange: 'callback' },
  state: (options: OptionSearchOptions): OptionSearchState => ({
    value: options.value ?? options.defaultValue ?? [],
    query: '',
    highlighted: null,
  }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    const listbox = createListbox<OptionSearchState>(context, {
      key: 'highlighted',
      focus: 'virtual',
      query: () => store.get().query,
    });
    const toggle = (key: string, details: { reason: OptionSearchReason; event?: Event } = { reason: 'imperative' }) => {
      const { value } = store.get();
      return change('value', value.includes(key) ? value.filter((v) => v !== key) : [...value, key], details);
    };
    const search = (query: string) => {
      store.set({ query });
      listbox.move('first');
    };
    return {
      listbox,
      /** Ticks an option, or unticks it when it is chosen. */
      toggle,
      /** Filters the options, as typing does. */
      search,
      keydown(event: KeyboardEvent) {
        const { highlighted, query } = store.get();
        if (event.key === 'Enter' && highlighted !== null) {
          event.preventDefault();
          toggle(highlighted, { reason: 'enter-key', event });
          return;
        }
        if (event.key === 'Escape' && query !== '') {
          // The first Escape empties the search; the next one is the popup's.
          event.preventDefault();
          event.stopPropagation();
          (event.target as HTMLInputElement).value = '';
          search('');
          return;
        }
        listbox.keydown(event);
      },
    };
  },
  slots: (slot) => ({
    root: slot<object, { value: string[]; query: string }>({
      state: (state) => ({ value: state.value, query: state.query }),
    }),
    input: slot({
      role: 'combobox',
      focus: 'native',
      // The arrows move the highlight in the list (virtual focus), Enter ticks it, Escape empties the search first.
      keys: ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp', 'Enter', 'Escape'],
      attrs: (state, { id, api }) => ({
        type: 'text',
        autocomplete: 'off',
        spellcheck: 'false',
        'aria-expanded': 'true',
        'aria-controls': `${id}-list`,
        'aria-autocomplete': 'list',
        'aria-activedescendant': api.listbox.activeId(state),
      }),
      on: {
        input: (event, { api }) => api.search((event.target as HTMLInputElement).value),
        keydown: (event, { api }) => api.keydown(event),
      },
    }),
    list: slot({
      role: 'listbox',
      keys: { none: 'The search field keeps focus and moves the highlight through the list.' },
      attrs: (_state, { id }) => ({ id: `${id}-list`, 'aria-multiselectable': 'true' }),
    }),
    option: slot<OptionProps, { selected: boolean; highlighted: boolean }>({
      role: 'option',
      focus: 'active-descendant',
      props: { value: 'string', label: 'string', keywords: 'list', disabled: 'boolean' },
      selects: selects({ highlighted: ({ key }) => [key, null] }),
      present: (_state, part) => part.api.listbox.shows(part),
      state: (state, part) => ({ selected: state.value.includes(part.key), highlighted: state.highlighted === part.key }),
      attrs: (state, part) => ({
        ...part.api.listbox.attrs(state, part),
        'aria-selected': String(state.value.includes(part.key)),
        'data-selected': state.value.includes(part.key) ? '' : undefined,
        'data-disabled': part.props.disabled ? '' : undefined,
      }),
      press: ({ key, api, props }, event) => {
        if (!props.disabled) api.toggle(key, { reason: 'item-press', event });
      },
      on: {
        // The field keeps focus.
        pointerdown: (event) => event.preventDefault(),
        pointermove: (event, { key, api }) => api.listbox.highlight(key, { event }),
      },
      bind: (el, part) => part.api.listbox.bind(el, part),
    }),
    /** Shown while nothing matches the search. */
    empty: slot({
      present: (_state, { api }) => api.listbox.count() === 0,
    }),
  }),
  agent: { actions: ['toggle', 'search'] },
});

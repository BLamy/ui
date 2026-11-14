import { createRovingFocus, definePrimitive, dispatch, selects, type ChangeDetails, type RovingFocusMoveContext } from '@ui-sdk/core';

/* ══ codeEditorControls — one Tab stop among a code editor's gutter buttons and markers ══
   A windowed editor renders only the rows on screen, so its controls come and go as it scrolls. They are one roving group
   (`createRovingFocus`), keyed by line and column, so the stop and the focus can move to a control that isn't rendered yet:
   ↑/↓ go to the next line with a control in the same column (a gutter's id, or `marker`: the marker nearest the one
   focus leaves), scrolling it in through `reveal`; ←/→ go along the line, gutters first, then its markers; Home and End
   to the line's first and last. A cell whose content holds a control of its own (a popover's trigger, an input) joins
   through that control, and one that comes or goes while the cell is on screen joins or leaves with it. An editable
   editor's input is its `input` part, so agents find it by the editor's name: `getValue()` reads the text and
   `setValue(text)` replaces it as one edit through the editor's own edit path. No React: `lib/code-editor-window.tsx`
   renders it with `usePart`. ══ */

export type CodeEditorControlsOptions = {
  /** How many lines there are. Lines count from 0. */
  lineCount: number;
  /** The key of `line`'s control in `column` (a gutter's id, or `marker`), or undefined when it has none. For a marker,
   *  `near` is the text column of the one focus leaves, and the answer is the marker nearest it. */
  controlAt: (line: number, column: string, near: number) => string | undefined;
  /** Brings a line's control into view, so that it renders. */
  reveal: (line: number, key: string) => void;
  /** The whole text now, for `getValue`. */
  read?: () => string;
  /** An editable editor's edit for `setValue`: it makes `text` the editor's text as one edit (reason `imperative`, with
   *  the details' `source`), and calls `details.cancel()` when that didn't go through. Leave it out while read-only. */
  onWrite?: (text: string, details: ChangeDetails<'imperative'>) => void;
};

type CodeEditorControlsState = {
  /** The control with the Tab stop. */
  focused: string | null;
};

/** A control's part: its key, its line, its column (a gutter's id, or `marker`), and for a marker its text column. */
export type CodeEditorControlProps = { value: string; line: number; column: string; at: number };

/** A control's key: the line, and the gutter's id or `marker:` with the marker's place among the line's markers. */
export const codeEditorControlKey = (line: number, column: string) => `${line}:${column}`;

const MOVES = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'] as const;

export const codeEditorControls = definePrimitive({
  name: 'code-editor',
  options: { lineCount: 'number', controlAt: 'value', reveal: 'value', read: 'action', onWrite: 'callback' },
  // Typing the options here is what types `context.options()`.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  state: (_options: CodeEditorControlsOptions): CodeEditorControlsState => ({ focused: null }),
  api: (context) => {
    const kind = (column: string) => (column.startsWith('marker') ? 'marker' : column);

    const move = (event: KeyboardEvent, { from, items }: RovingFocusMoveContext<CodeEditorControlProps>) => {
      if (event.ctrlKey || event.metaKey) return undefined;
      const { line, column, at } = from.props;
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const { lineCount, controlAt, reveal } = context.options();
        const by = event.key === 'ArrowDown' ? 1 : -1;
        for (let next = line + by; next >= 0 && next < lineCount; next += by) {
          // What the editor knows of every line, or a control that's on screen in a cell that holds one.
          const key = controlAt(next, kind(column), at)
            ?? items.find((item) => item.props.line === next && item.props.column === column)?.key;
          if (key === undefined) continue;
          if (!items.some((item) => item.key === key)) reveal(next, key);
          return key;
        }
        // At the first or last one: the key is still the group's, so it doesn't scroll the page.
        return from.key;
      }
      const row = items.filter((item) => item.props.line === line);
      const index = row.findIndex((item) => item.key === from.key);
      if (event.key === 'Home') return row[0]?.key;
      if (event.key === 'End') return row[row.length - 1]?.key;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        return row[index + (event.key === 'ArrowRight' ? 1 : -1)]?.key ?? from.key;
      }
      return undefined;
    };

    const roving = createRovingFocus<CodeEditorControlsState, CodeEditorControlProps>(context, {
      slot: 'control',
      key: 'focused',
      move,
    });

    // A cell that isn't a button joins through the first control inside it, if it has one.
    const inner = new WeakMap<HTMLElement, HTMLElement>();
    const FOCUSABLE = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]';

    return {
      /** The editor's text. */
      getValue: () => context.options().read?.() ?? '',
      /** Makes `text` the editor's text, as one edit `onValueChange` sees (reason `imperative`) and can refuse. Returns
       *  whether it was made: false while read-only, or when refused. */
      setValue(text: string): boolean {
        if (typeof text !== 'string' || !context.options().onWrite) return false;
        return !dispatch(context, 'onWrite', text, { reason: 'imperative' });
      },
      internal: {
        roving,
        bindCell(el: HTMLElement, part: { key: string; props: CodeEditorControlProps; store: { get: () => CodeEditorControlsState; subscribe: (listener: () => void) => () => void } }) {
          const item = { key: part.key, props: part.props };
          let control: HTMLElement | null = null;
          let release = () => {};
          // The cell keeps its element while what it shows changes (a breakpoint set on a line on screen brings its
          // popover's trigger), so it joins through whichever control it holds now.
          const join = () => {
            const next = el.querySelector<HTMLElement>(FOCUSABLE);
            if (next === control) return;
            release();
            release = () => {};
            control = next;
            if (!next) {
              inner.delete(el);
              return;
            }
            inner.set(el, next);
            const leave = roving.bind(next, item);
            const write = () => next.setAttribute('tabindex', roving.tabIndex(part.store.get(), item));
            write();
            const unsubscribe = part.store.subscribe(write);
            release = () => {
              unsubscribe();
              leave();
            };
          };
          join();
          const Observer = el.ownerDocument.defaultView?.MutationObserver;
          const watch = Observer ? new Observer(join) : undefined;
          watch?.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'href', 'tabindex'] });
          return () => {
            watch?.disconnect();
            release();
            inner.delete(el);
          };
        },
        cellKeydown(event: KeyboardEvent, el: HTMLElement) {
          // Keys from a popover opened from the cell reach it through React's tree: only its own control's are ours.
          const control = inner.get(el);
          if (control && event.target === control) roving.keydown(event, control);
        },
      },
    };
  },
  slots: (slot) => ({
    // A gutter button or a marker: the control itself.
    control: slot<CodeEditorControlProps>({
      props: { value: 'string', line: 'number', column: 'string', at: 'number' },
      focus: 'roving',
      keys: [...MOVES],
      selects: selects({ focused: ({ key }) => [key, null] }),
      attrs: (state, part) => ({ tabindex: part.api.internal.roving.tabIndex(state, part) }),
      on: {
        keydown: (event, { el, api }) => {
          if (el && event.target === el) api.internal.roving.keydown(event, el);
        },
      },
      bind: (el, part) => part.api.internal.roving.bind(el, part),
    }),
    // An editable editor's input, a textarea that takes the typing. The editor's name is its name.
    input: slot({
      role: 'textbox',
      focus: 'native',
      selects: selects({ focused: [] }),
      attrs: () => ({ 'aria-multiline': 'true', 'aria-readonly': 'false' }),
    }),
    // A gutter cell that isn't a button. What it holds may be a control of its own, which takes part through it.
    'gutter-cell': slot<CodeEditorControlProps>({
      props: { value: 'string', line: 'number', column: 'string', at: 'number' },
      focus: { none: 'A control inside the cell, if it holds one, takes focus.' },
      keys: [...MOVES],
      selects: selects({ focused: ({ key }) => [key, null] }),
      on: {
        keydown: (event, { el, api }) => {
          if (el) api.internal.cellKeydown(event, el);
        },
      },
      bind: (el, part) => part.api.internal.bindCell(el, part),
    }),
  }),
  // Each gutter control is a UI SDK Button with a name of its own, which the agent bridge presses; the text is read and
  // replaced through the api.
  agent: { actions: ['getValue', 'setValue'] },
});

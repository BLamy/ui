import { useState } from 'react';
import {
  createChange,
  createRovingFocus,
  createSelection,
  definePrimitive,
  selects,
  type ChangeDetails,
} from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';

type FilesState = { value: string[]; focused: string | null };
type FilesReason = 'item-press' | 'list-navigation' | 'imperative';
type FilesOptions = {
  defaultValue?: string[];
  onValueChange?: (value: string[], details: ChangeDetails<FilesReason>) => void;
};

/* A multi-select file list, the Finder way: click chooses one, Command/Control-click toggles one, Shift-click and
   Shift+arrows extend a range from the anchor, Space toggles the focused file, and Command/Control+A selects or
   clears everything. createSelection owns the rules; createRovingFocus owns the keyboard. */
const files = definePrimitive({
  name: 'file-list',
  options: { defaultValue: 'list', onValueChange: 'callback' },
  state: (options: FilesOptions): FilesState => ({ value: options.defaultValue ?? [], focused: null }),
  api: (context) => {
    const change = createChange(context);
    const roving = createRovingFocus<FilesState, { value: string }>(context, { slot: 'file', key: 'focused' });
    const selection = createSelection(context, {
      key: 'value',
      set: (value, details) => change('value', value, details),
      order: () => roving.items().map((item) => item.key),
      multiple: () => true,
    });
    return {
      roving,
      selection,
      /** For a controller or an agent: replace the selection. */
      setValue: (value: string[]) => change('value', value, { reason: 'imperative' }),
      keydown(event: KeyboardEvent, el: HTMLElement, key: string) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
          event.preventDefault();
          selection.toggleAll({ reason: 'list-navigation', event });
        } else if (event.key === ' ') {
          event.preventDefault();
          selection.toggle(key, { reason: 'item-press', event });
        } else {
          const moved = roving.keydown(event, el);
          if (moved?.shift) selection.extend(moved.key, { from: moved.from, reason: 'list-navigation', event });
        }
      },
      press(event: PointerEvent, key: string) {
        const why = { reason: 'item-press' as const, event };
        if (event.shiftKey) selection.extend(key, { ...why, from: context.store.get().focused });
        else if (event.metaKey || event.ctrlKey) selection.toggle(key, why);
        else selection.choose(key, why);
      },
    };
  },
  slots: (slot) => ({
    root: slot({ attrs: () => ({ role: 'listbox', 'aria-multiselectable': 'true' }) }),
    file: slot<{ value: string }>({
      props: { value: 'string' },
      selects: selects({ focused: ({ key }) => [key, null] }),
      attrs: (state, part) => ({
        role: 'option',
        'aria-selected': String(state.value.includes(part.key)),
        'data-selected': state.value.includes(part.key) ? '' : undefined,
        tabindex: part.api.roving.tabIndex(state, part),
      }),
      on: {
        keydown: (event, { el, api, key }) => api.keydown(event, el!, key),
        pointerdown: (event, { api, key }) => api.press(event, key),
      },
      bind: (el, part) => part.api.roving.bind(el, part),
    }),
  }),
  agent: { actions: ['setValue'] },
});

const parts = createParts(files, { root: 'div', file: 'div' });

const NAMES = ['notes.md', 'budget.xlsx', 'photo.jpg', 'slides.key', 'draft.docx', 'logo.svg'];

export default function FileListDemo() {
  const [status, setStatus] = useState('Nothing selected');
  return (
    <div className="mx-auto grid w-full max-w-sm gap-3">
      <parts.Root
        aria-label="Files"
        onValueChange={(value, details) => setStatus(`${value.length} selected (${details.reason}): ${value.join(', ') || 'none'}`)}
        className="grid overflow-hidden rounded-panel bg-card shadow-hairline select-none"
      >
        {NAMES.map((name) => (
          <parts.File
            key={name}
            value={name}
            className="flex h-row cursor-default items-center px-4 text-body text-foreground shadow-hairline-b outline-none last:shadow-none focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:ring-inset data-selected:bg-primary data-selected:text-primary-foreground"
          >
            {name}
          </parts.File>
        ))}
      </parts.Root>
      <p className="m-0 text-footnote text-foreground/70" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

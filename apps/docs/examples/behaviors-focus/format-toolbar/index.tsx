import { useState } from 'react';
import {
  ariaKeyshortcuts,
  createChange,
  createRovingFocus,
  definePrimitive,
  matchesShortcut,
  selects,
  type ChangeDetails,
} from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

const FORMATS = [
  { value: 'Bold', shortcut: 'mod+b' },
  { value: 'Italic', shortcut: 'mod+i' },
  { value: 'Underline', shortcut: 'mod+u' },
];

type FormatState = { focused: string | null; marks: string[] };
type FormatReason = 'item-press' | 'shortcut-key';
type FormatOptions = {
  defaultMarks?: string[];
  onMarksChange?: (marks: string[], details: ChangeDetails<FormatReason>) => void;
};

/* A formatting toolbar beside a text field. The toolbar is one tab stop (createRovingFocus, Left/Right/Home/End,
   wrapping), and each format has a platform shortcut: matchesShortcut reads it in the field, ariaKeyshortcuts
   announces it on the button, and the kit's Kbd shows it (⌘B on a Mac, Ctrl+B elsewhere). Using a shortcut also
   moves the toolbar's tab stop to that format (`remember`), so Shift+Tab out of the field lands on it. */
const formatBar = definePrimitive({
  name: 'format-bar',
  options: { defaultMarks: 'list', onMarksChange: 'callback' },
  state: (options: FormatOptions): FormatState => ({ focused: null, marks: options.defaultMarks ?? [] }),
  api: (context) => {
    const change = createChange(context);
    const roving = createRovingFocus<FormatState, { value: string }>(context, {
      slot: 'button',
      key: 'focused',
      orientation: () => 'horizontal',
      loop: () => true,
    });
    const toggle = (format: string, details: { reason: FormatReason; event?: Event }) => {
      const { marks } = context.store.get();
      change('marks', marks.includes(format) ? marks.filter((m) => m !== format) : [...marks, format], details);
    };
    return {
      roving,
      toggle,
      fieldKeydown(event: KeyboardEvent) {
        const format = FORMATS.find((f) => matchesShortcut(event, f.shortcut));
        if (!format) return;
        event.preventDefault();
        toggle(format.value, { reason: 'shortcut-key', event });
        roving.remember(format.value);
      },
    };
  },
  slots: (slot) => ({
    root: slot<object, { marks: string[] }>({ state: (state) => ({ marks: state.marks }) }),
    toolbar: slot({ attrs: () => ({ role: 'toolbar', 'aria-orientation': 'horizontal' }) }),
    button: slot<{ value: string }>({
      props: { value: 'string' },
      selects: selects({ focused: ({ key }) => [key, null] }),
      attrs: (state, part) => ({
        type: 'button',
        tabindex: part.api.roving.tabIndex(state, part),
        'aria-pressed': String(state.marks.includes(part.key)),
        'data-pressed': state.marks.includes(part.key) ? '' : undefined,
      }),
      on: { keydown: (event, { el, api }) => api.roving.keydown(event, el!) },
      press: ({ api, key }, event) => api.toggle(key, { reason: 'item-press', event }),
      bind: (el, part) => {
        // Platform-dependent, so it is written after mount rather than rendered.
        const shortcut = FORMATS.find((f) => f.value === part.key)?.shortcut;
        if (shortcut) el.setAttribute('aria-keyshortcuts', ariaKeyshortcuts(shortcut));
        return part.api.roving.bind(el, part);
      },
    }),
    field: slot({ on: { keydown: (event, { api }) => api.fieldKeydown(event) } }),
  }),
  agent: { actions: ['toggle'] },
});

const parts = createParts(formatBar, { root: 'div', toolbar: 'div', button: 'button', field: 'textarea' });

export default function FormatToolbarDemo() {
  const [log, setLog] = useState('Nothing yet');
  return (
    <parts.Root
      onMarksChange={(marks, details) => setLog(`${marks.join(', ') || 'No formats'} (${details.reason})`)}
      className="mx-auto grid w-full max-w-md gap-3"
    >
      {({ marks }) => (
        <>
          <parts.Toolbar aria-label="Format" className="flex gap-1 rounded-panel bg-card p-1 shadow-hairline">
            {FORMATS.map((f) => (
              <parts.Button
                key={f.value}
                value={f.value}
                className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-ctl border-0 bg-transparent px-2.5 text-footnote font-semibold text-foreground/70 outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/45 data-pressed:bg-secondary-strong data-pressed:text-foreground"
              >
                {f.value}
                <Kbd keys={f.shortcut} aria-hidden className="text-current" />
              </parts.Button>
            ))}
          </parts.Toolbar>
          <parts.Field
            aria-label="Notes"
            rows={3}
            defaultValue="Type here, press a shortcut, then Shift+Tab."
            className={cn(
              'box-border w-full resize-none rounded-ctl border-0 bg-secondary px-3 py-2 text-body text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45',
              marks.includes('Bold') && 'font-semibold',
              marks.includes('Italic') && 'italic',
              marks.includes('Underline') && 'underline',
            )}
          />
          <p className="m-0 text-footnote text-foreground/70" aria-live="polite">
            {log}
          </p>
        </>
      )}
    </parts.Root>
  );
}

import { bindAvoidKeyboard, bindViewport, type ViewportState } from '@ui-sdk/core';
import { useEffect, useRef, useState } from 'react';

const GROCERIES = 'Groceries\n- oat milk\n- lemons';

const count = (text: string) => text.split('\n').filter((line) => line.startsWith('-')).length;

/* On a phone the browser scrolls a focused field into view above the on-screen keyboard, and nothing else.
   `bindAvoidKeyboard` lifts the status pill by as much of it as the keyboard covers (a `translate` it owns, so no
   transition on it), and `bindViewport` reports the keyboard and the visible viewport. On a desktop both stay at 0. */
export default function AvoidKeyboardDemo() {
  const [items, setItems] = useState(count(GROCERIES));
  const [viewport, setViewport] = useState<ViewportState | null>(null);
  const lift = useRef<HTMLDivElement>(null);
  useEffect(() => (lift.current ? bindAvoidKeyboard(lift.current) : undefined), []);
  useEffect(() => bindViewport(document.documentElement, { onChange: setViewport }), []);
  return (
    <div className="mx-auto grid w-full max-w-sm gap-3">
      <textarea
        aria-label="Groceries"
        rows={4}
        defaultValue={GROCERIES}
        onChange={(event) => setItems(count(event.target.value))}
        // 16px or more, or iOS zooms into the field when it takes focus.
        className="resize-none rounded-card border-0 bg-card p-3 text-callout text-foreground shadow-hairline outline-none [font-family:inherit] focus-visible:ring-[3px] focus-visible:ring-ring/45"
      />
      {/* The wrapper is what moves: its bottom padding is the gap left between the pill and the keyboard. */}
      <div ref={lift} className="justify-self-center pb-2 data-keyboard:shadow-hairline">
        <p aria-live="polite" className="m-0 rounded-full bg-secondary px-3 py-1 text-footnote text-secondary-foreground">
          {items === 1 ? '1 item' : `${items} items`} · Saved
        </p>
      </div>
      <p className="m-0 text-caption text-foreground/70">
        Keyboard {Math.round(viewport?.keyboard ?? 0)}px · covers {Math.round(viewport?.keyboardInset ?? 0)}px of the page · visible height{' '}
        {Math.round(viewport?.height ?? 0)}px
      </p>
    </div>
  );
}

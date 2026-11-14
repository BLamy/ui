import { createPointerKind } from '@ui-sdk/core';
import { usePreference } from '@ui-sdk/react/preferences';
import { useState } from 'react';

/* One pointer kind for the page, read like a preference. It is for behavior and content (here: whether resting the
   pointer opens the details, and what the button says); styles should use the media queries themselves
   (`pointer-coarse:`, `@media (hover: hover)`), which are right from the first paint. */
const pointerKind = createPointerKind();

export default function PointerKindDemo() {
  const kind = usePreference(pointerKind);
  const [open, setOpen] = useState(false);
  const hovers = kind.hover === 'hover';
  return (
    <div className="mx-auto grid w-full max-w-sm gap-3">
      <div className="grid gap-1 overflow-hidden rounded-card bg-card shadow-hairline">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="pointer-kind-details"
          onPointerEnter={hovers ? () => setOpen(true) : undefined}
          onPointerLeave={hovers ? () => setOpen(false) : undefined}
          onClick={() => setOpen((o) => !o)}
          className="flex h-row cursor-pointer items-center border-0 bg-transparent px-4 text-left text-body text-foreground outline-none [font-family:inherit] hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/45 pointer-coarse:h-12"
        >
          {kind.hover === 'unknown' ? 'Shipping' : hovers ? 'Shipping (hover for details)' : 'Shipping (tap for details)'}
        </button>
        <p id="pointer-kind-details" role="status" className="m-0 px-4 pb-3 text-footnote text-foreground/70 empty:hidden">
          {open ? 'Free over $50. Arrives in 2 to 4 days.' : ''}
        </p>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-footnote">
        {(['pointer', 'hover', 'anyPointer', 'anyHover'] as const).map((key) => (
          <div key={key} className="contents">
            <dt className="font-mono text-foreground/70">{key}</dt>
            <dd className="m-0 font-mono text-foreground">{kind[key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

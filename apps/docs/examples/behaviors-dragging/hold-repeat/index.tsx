import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { bindHold, bindRepeat } from '@ui-sdk/core';
import { Icon } from '@/lib/icon';

/** The latest callback, for a binding made once on mount. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

const MIN = 25;
const MAX = 400;

/** A button that steps once when pressed and keeps stepping while held (bindRepeat). No click handler: the press
    steps, and the click that follows doesn't step again. */
function StepButton({ label, disabled, onStep, children }: { label: string; disabled: boolean; onStep: () => boolean; children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const step = useLatest(onStep);
  useEffect(() => bindRepeat(ref.current!, { repeat: 80, onStep: () => step.current() }), [step]);
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      disabled={disabled}
      className="grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-secondary text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 disabled:cursor-default disabled:opacity-40 data-holding:bg-secondary-strong"
    >
      {children}
    </button>
  );
}

/** A destructive button that only acts once it has been held for `delay` (bindHold). While pressed it has
    data-holding, and --hold-delay is the delay, so the fill runs for exactly that long. */
function HoldButton({ onHold, hint }: { onHold: () => void; hint: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const hold = useLatest(onHold);
  useEffect(() => bindHold(ref.current!, { delay: 1200, onHold: () => hold.current() }), [hold]);
  return (
    <button
      ref={ref}
      type="button"
      aria-describedby={hint}
      className="group relative h-9 cursor-pointer overflow-hidden rounded-ctl border-0 bg-secondary px-4 text-subhead font-semibold text-foreground outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
    >
      <span
        aria-hidden
        className="absolute inset-0 origin-left scale-x-0 bg-destructive/20 group-data-holding:scale-x-100 group-data-holding:transition-transform group-data-holding:duration-(--hold-delay) group-data-holding:ease-linear"
      />
      <span className="relative">Reset zoom</span>
    </button>
  );
}

export default function HoldRepeatDemo() {
  const [zoom, setZoom] = useState(100);
  const hint = useId();
  const zoomBy = (amount: number) => {
    const next = Math.min(Math.max(zoom + amount, MIN), MAX);
    setZoom(next);
    return next > MIN && next < MAX; // false stops the repeat at a bound
  };
  return (
    <div className="mx-auto grid w-fit justify-items-center gap-3">
      <div className="flex items-center gap-3">
        <StepButton label="Zoom out" disabled={zoom === MIN} onStep={() => zoomBy(-5)}>
          <Icon name="minus" />
        </StepButton>
        <output aria-live="polite" className="w-14 text-center text-body font-semibold text-foreground tabular-nums">
          {zoom}%
        </output>
        <StepButton label="Zoom in" disabled={zoom === MAX} onStep={() => zoomBy(5)}>
          <Icon name="plus" />
        </StepButton>
      </div>
      <HoldButton hint={hint} onHold={() => setZoom(100)} />
      <p id={hint} className="m-0 text-footnote text-foreground/70">
        Hold a zoom button to keep going. Hold Reset zoom until it fills.
      </p>
    </div>
  );
}

/* ══ wave-rail — the chrome a thin overlay rail shares: IndexBar's `wave` variant and TraceTimeline's `vertical` rail ══
   - The wave: one short dash per stop that swells around the pointer like the macOS Dock (a raised-cosine falloff), the
     current stop at full length in the tint, the hot one in the foreground.
   - The card beside the rail (a stop's title and preview), on the surface both rails draw.
   - `bindRowInset`: a right-hand rail overlays a list, so it publishes how far the list's rows run under it as
     `--bl-index-bar-inset` on its parent, and ListRows there widen their trailing inset by it to keep their chevrons
     and accessories clear of it.
   No React. */

/** A dash at rest and at the peak of the swell, in px; a nested stop (`level > 1`) rests 3px shorter. */
export const WAVE_REST = 9;
export const WAVE_PEAK = 28;
/** How many stops the swell reaches either side of the pointer. */
export const WAVE_REACH = 3.2;

/** The swell at `distance` stops from the pointer: 1 there, 0 at `WAVE_REACH` stops away. */
export function waveSwell(distance: number): number {
  const d = Math.abs(distance);
  return d >= WAVE_REACH ? 0 : (1 + Math.cos((Math.PI * d) / WAVE_REACH)) / 2;
}

/** A dash's length for its swell `f` (0..1). */
export function waveDashLength(f: number, level = 1): number {
  const rest = level > 1 ? WAVE_REST - 3 : WAVE_REST;
  return rest + (WAVE_PEAK - rest) * f;
}

/** A dash: 2px tall, `--len` long, `--f` its swell, which blends a resting dash toward the foreground. */
export const waveDash =
  'h-[2px] w-(--len) shrink-0 rounded-full transition-[width,background-color] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none';

/** A dash's colour: the stop under the pointer (`hot`), the current stop, or a resting one that darkens as it swells. */
export function waveDashTone({ hot, current }: { hot?: boolean; current?: boolean }): string {
  if (hot) return 'bg-foreground';
  if (current) return 'bg-primary';
  return 'bg-[color:color-mix(in_oklab,var(--foreground)_calc(var(--f)*75%),var(--tertiary-foreground,color-mix(in_oklab,var(--muted-foreground)_60%,transparent)))]';
}

/** The card beside a rail: the surface, the shadow and the pop it opens with. Place it and give it `origin-*`. */
export const waveCard =
  'rounded-card bg-card shadow-[0_8px_28px_--alpha(black/28%),0_0_0_1px_var(--border)] animate-[blWaveCard_var(--duration-spring-snappy)_var(--ease-spring-snappy)] motion-reduce:animate-none';

export interface RowInsetOptions {
  /** Whether to publish now (a right-hand rail that hasn't opted out); read on every sync. */
  enabled: () => boolean;
  /** The inset when there are no rows to measure: usually the rail's width. */
  fallback: () => number;
  /** Ignore changes inside the rail itself (its own dashes change as it's used). */
  ignoreOwnChanges?: boolean;
}

/** Publishes how far list rows run under `rail` as `--bl-index-bar-inset` on its parent: a row's right edge minus the
 *  rail's left edge (the rail's width for an edge-to-edge list, less, often nothing, for an inset-grouped one). Rows'
 *  own padding doesn't move their edge, so publishing it never feeds back. Returns the cleanup and a `sync` to call when
 *  the options change. */
export function bindRowInset(rail: HTMLElement, { enabled, fallback, ignoreOwnChanges = false }: RowInsetOptions) {
  const host = rail.parentElement;
  let raf = 0;
  const sync = () => {
    raf = 0;
    if (!host) return;
    if (!enabled()) { host.style.removeProperty('--bl-index-bar-inset'); return; }
    const row = host.querySelector<HTMLElement>('[data-slot="list-row-content"]');
    const overlap = row ? Math.max(0, row.getBoundingClientRect().right - rail.getBoundingClientRect().left) : fallback();
    const v = `${Math.round(overlap)}px`;
    if (host.style.getPropertyValue('--bl-index-bar-inset') !== v) host.style.setProperty('--bl-index-bar-inset', v);
  };
  const later = () => { if (!raf && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(sync); };
  let disconnect = () => {};
  if (host) {
    sync();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(later);
    ro?.observe(host);
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver((records) => {
      if (!ignoreOwnChanges || records.some((r) => !rail.contains(r.target))) later();
    });
    mo?.observe(host, { childList: true, subtree: true });
    disconnect = () => { ro?.disconnect(); mo?.disconnect(); };
  }
  return {
    sync: later,
    cleanup: () => {
      if (raf) cancelAnimationFrame(raf);
      disconnect();
      host?.style.removeProperty('--bl-index-bar-inset');
    },
  };
}

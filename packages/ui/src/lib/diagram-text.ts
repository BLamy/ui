/* ══ Diagram text — how much room a node's words take, before anything's drawn ══
   Layout needs real sizes, so text is measured in the real font, by the browser's own text layout: an element that can't
   be seen, with the same classes the words are drawn with, inside the diagram so a `ThemeScope`'s font applies. It wraps
   the way a node does, so long names, names with no spaces and CJK all come out right, and it needs nothing mounted but
   the document.

   A server has no fonts, and can't know which of the stack a browser will pick, so there `estimateText` works from
   typical letter widths. The hydrating client starts from the same estimate, measures straight after, and only moves
   things if the sizes came out different. An app that wants no such move gives nodes fixed sizes. */

/** What a piece of text is, which sets how it's drawn. */
export type DiagramTextKind = 'label' | 'detail' | 'title' | 'edge';

/** The classes each kind of text is drawn with. The measuring element uses them too, so the two can't disagree. */
export const DIAGRAM_TEXT_CLASS: Record<DiagramTextKind, string> = {
  /** A node's name. */
  label: 'text-caption font-medium leading-tight',
  /** A node's second line. */
  detail: 'text-caption2 leading-tight',
  /** The name of what holds other nodes. */
  title: 'text-caption font-semibold leading-tight',
  /** An edge's label. */
  edge: 'text-caption2 leading-none',
};

/** Past this width a node's words wrap. An edge's label doesn't wrap. */
export const DIAGRAM_TEXT_MAX_WIDTH = 216;

export interface TextSize {
  w: number;
  h: number;
}

export interface TextRun {
  text: string;
  kind: DiagramTextKind;
}

export type TextMeasurer = (text: string, kind: DiagramTextKind) => TextSize;

/* ── Estimating ── */

const EM: Record<DiagramTextKind, { size: number; line: number; weight: number }> = {
  label: { size: 12, line: 15, weight: 1.03 },
  detail: { size: 11, line: 13.75, weight: 1 },
  title: { size: 12, line: 15, weight: 1.05 },
  edge: { size: 11, line: 11, weight: 1 },
};

const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{1f000}-\u{1faff}\u{20000}-\u{3ffff}]/u;

/** How wide a character usually is, in em. On the generous side, as text that fits is what matters. */
function charWidth(c: string): number {
  if (WIDE.test(c)) return 1;
  if (/[ijlI.,:;'`|!()[\]{} ]/.test(c)) return 0.32;
  if (/[mwMW@%]/.test(c)) return 0.9;
  if (/[A-Z]/.test(c)) return 0.7;
  return 0.58;
}

/** A size for `text` with no fonts to go on: the same on a server and in a browser. */
export function estimateText(text: string, kind: DiagramTextKind, maxWidth = DIAGRAM_TEXT_MAX_WIDTH): TextSize {
  const { size, line, weight } = EM[kind];
  let w = 0;
  for (const c of text) w += charWidth(c);
  w = Math.ceil(w * size * weight);
  if (kind === 'edge' || w <= maxWidth) return { w, h: line };
  return { w: maxWidth, h: Math.ceil(w / maxWidth) * line };
}

/* ── Measuring ── */

/** Sizes that are already known, by what sets them: the computed font, then the kind and text. */
const cache = new Map<string, Map<string, TextSize>>();

/** Forget everything measured, because the fonts have changed. */
export function clearTextCache(): void {
  cache.clear();
}

const PROBE = 'position:absolute;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;contain:layout style;';

/** One probe per place to measure in, which stays there. Putting one in and taking it out again each time changes what the
 *  last child of that place is, and a `:last-child` rule anywhere in the page then restyles all of it: a whole diagram,
 *  for every frame's worth of a large layout's measuring. */
const probes = new WeakMap<Element, { probe: HTMLElement; rulers: Record<DiagramTextKind, HTMLElement> }>();

function probeIn(parent: Element) {
  const known = probes.get(parent);
  if (known && known.probe.parentNode === parent) return known;
  const probe = document.createElement('div');
  probe.setAttribute('data-slot', 'diagram-measure');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = PROBE;
  // One ruler per kind: its computed font is what the cache goes by, and its width says if a transform is scaling things.
  const rulers = {} as Record<DiagramTextKind, HTMLElement>;
  for (const kind of Object.keys(DIAGRAM_TEXT_CLASS) as DiagramTextKind[]) {
    const ruler = document.createElement('div');
    ruler.className = DIAGRAM_TEXT_CLASS[kind];
    ruler.style.cssText = 'position:absolute;width:100px;height:0;';
    probe.append(ruler);
    rulers[kind] = ruler;
  }
  parent.append(probe);
  const made = { probe, rulers };
  probes.set(parent, made);
  return made;
}

/**
 * Measures many runs in one go, so there's only one layout however many there are, and returns a measurer that knows
 * them. Measuring inside `host` gets `host`'s fonts. Without a document, it returns estimates.
 */
export function measureText(runs: readonly TextRun[], host?: Element | null, maxWidth = DIAGRAM_TEXT_MAX_WIDTH): TextMeasurer {
  if (typeof document === 'undefined') return (text, kind) => estimateText(text, kind, maxWidth);
  // Nothing has a size in something that isn't drawn, a `display: none` tab say, so that measures in the page, and a caller
  // that cares (`useShownVersion`) measures again once it's shown.
  const parent = host && host.getClientRects().length ? host : document.body;
  const { probe, rulers } = probeIn(parent);
  const measuring: HTMLElement[] = [];
  try {
    const known = {} as Record<DiagramTextKind, Map<string, TextSize>>;
    for (const kind of Object.keys(rulers) as DiagramTextKind[]) {
      const s = getComputedStyle(rulers[kind]);
      const key = `${s.fontStyle} ${s.fontWeight} ${s.fontSize}/${s.lineHeight} ${s.fontFamily} ${s.letterSpacing} ${maxWidth}`;
      let m = cache.get(key);
      if (!m) { m = new Map(); cache.set(key, m); }
      known[kind] = m;
    }
    const pending: { run: TextRun; el: HTMLElement }[] = [];
    const seen = new Set<string>();
    for (const run of runs) {
      const id = `${run.kind}\0${run.text}`;
      if (seen.has(id) || known[run.kind].has(run.text)) continue;
      seen.add(id);
      const el = document.createElement('div');
      el.className = DIAGRAM_TEXT_CLASS[run.kind];
      el.style.cssText = run.kind === 'edge'
        ? 'position:absolute;width:max-content;white-space:nowrap;'
        : `position:absolute;width:max-content;max-width:${maxWidth}px;white-space:normal;overflow-wrap:anywhere;`;
      el.textContent = run.text;
      probe.append(el);
      measuring.push(el);
      pending.push({ run, el });
    }
    if (pending.length) {
      const scale = (rulers.label.getBoundingClientRect().width || 100) / 100 || 1;
      for (const { run, el } of pending) {
        const r = el.getBoundingClientRect();
        // Up to a whole pixel, so that a box this wide can't wrap what fitted here.
        known[run.kind].set(run.text, { w: Math.ceil(r.width / scale), h: Math.ceil(r.height / scale) });
      }
    }
    return (text, kind) => known[kind].get(text) ?? estimateText(text, kind, maxWidth);
  } finally {
    for (const el of measuring) el.remove();
  }
}

/** Up to how many runs are measured straight away, in the same tick. */
const GENTLE_CHUNK = 250;
/** How long a frame's share of measuring should take, in ms. What a run costs depends on the machine and the page, so the
 *  share's size follows what the last one took. */
const GENTLE_BUDGET = 4;

/**
 * Measures like `measureText`, a frame's worth at a time, so a large diagram doesn't stop the page: 5,000 labels in one go
 * is a gap of about 80 ms. It starts on the next frame, so it doesn't add to whatever's being drawn on this one. A small
 * diagram goes straight through, in the same tick.
 */
export async function measureTextGently(runs: readonly TextRun[], host?: Element | null, maxWidth = DIAGRAM_TEXT_MAX_WIDTH): Promise<TextMeasurer> {
  if (runs.length <= GENTLE_CHUNK) return measureText(runs, host, maxWidth);
  await nextFrame();
  let size = 100;
  for (let i = 0; i + size < runs.length; i += size) {
    // What this remembers is what the last call finds waiting for it.
    const started = performance.now();
    measureText(runs.slice(i, i + size), host, maxWidth);
    const took = performance.now() - started;
    size = Math.max(25, Math.min(1000, Math.round((size * GENTLE_BUDGET) / Math.max(took, 0.5))));
    await nextFrame();
  }
  return measureText(runs, host, maxWidth);
}

/** The next frame, or soon, in a tab that isn't drawing any, for work that shouldn't take one frame all to itself. */
export const nextFrame = () => new Promise<void>((resolve) => {
  if (typeof requestAnimationFrame !== 'function') { resolve(); return; }
  const fallback = setTimeout(resolve, 100);
  requestAnimationFrame(() => { clearTimeout(fallback); resolve(); });
});

/* ── Fonts that arrive late ── */

/** Calls `listener` whenever fonts have finished loading, which is when something measured earlier may be wrong. The sizes
 *  remembered so far are forgotten first. Returns how to stop. */
export function onFontsLoaded(listener: () => void): () => void {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return () => undefined;
  let live = true;
  const loaded = () => {
    if (!live) return;
    clearTextCache();
    listener();
  };
  fonts.addEventListener?.('loadingdone', loaded);
  // Anything already loading finishes with `ready` too, and that's the only sign if nothing else starts.
  if (fonts.status === 'loading') fonts.ready.then(loaded);
  return () => {
    live = false;
    fonts.removeEventListener?.('loadingdone', loaded);
  };
}

'use client';
import { useEffect, useState } from 'react';
import { GOOGLE_FONT_ROWS } from '@/lib/google-fonts.generated';

/* ══ Google Fonts — the families, and loading one from the Google Fonts CDN when it's wanted ══
   GOOGLE_FONTS is the most popular families (regenerated from fonts.google.com's own metadata by
   tools/google-fonts/catalog.mjs), each with its category, its weights and whether it has italics.
   loadGoogleFont(family) fetches the family's stylesheet from fonts.googleapis.com once and adds it to the page;
   `text` loads only the glyphs of a sample (a few hundred bytes: what a font list draws each name in), and a style
   the family doesn't have is dropped rather than failing the request. useGoogleFont does that from a component and
   re-renders when the font is ready (useGoogleFontStatus also says when Google Fonts doesn't have it);
   fontStack(family) is the CSS font-family to set, with a fallback of the same kind (a serif behind a serif, a
   monospace behind a monospace). Both take a stack of families too: ['Inter', 'Roboto'].

     const ready = useGoogleFont('Fraunces', { weights: [400, 700] });
     <h1 style={{ fontFamily: fontStack('Fraunces') }}>…</h1> ══ */

export type FontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';

/** The categories, in Google Fonts' order, with the labels a filter shows. */
export const FONT_CATEGORIES: readonly { id: FontCategory; label: string }[] = [
  { id: 'sans-serif', label: 'Sans Serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'display', label: 'Display' },
  { id: 'handwriting', label: 'Handwriting' },
  { id: 'monospace', label: 'Monospace' },
];

export interface GoogleFont {
  family: string;
  category: FontCategory;
  /** Its weights, lightest first (every hundred in its range, for a variable font). */
  weights: readonly number[];
  /** A variable font: any weight in its range, not only the hundreds. */
  variable: boolean;
  italic: boolean;
}

const decode = ([family, category, weights, italic]: readonly [string, number, string, number]): GoogleFont => {
  const range = /^(\d+)\.\.(\d+)$/.exec(weights);
  const list = range
    ? Array.from({ length: (Number(range[2]) - Number(range[1])) / 100 + 1 }, (_, i) => Number(range[1]) + i * 100)
    : weights.split(',').map(Number);
  return { family, category: FONT_CATEGORIES[category]?.id ?? 'sans-serif', weights: list, variable: !!range, italic: !!italic };
};

/** The most popular Google Fonts families that cover Latin, most popular first. */
export const GOOGLE_FONTS: readonly GoogleFont[] = GOOGLE_FONT_ROWS.map(decode);

const byFamily = new Map(GOOGLE_FONTS.map((f) => [f.family.toLowerCase(), f]));

/** A family in the catalog, by name (any case). */
export const findGoogleFont = (family: string): GoogleFont | undefined => byFamily.get(family.trim().toLowerCase());

const FALLBACK: Record<FontCategory, string> = {
  'sans-serif': 'ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, serif',
  display: 'ui-sans-serif, system-ui, sans-serif',
  handwriting: 'cursive',
  monospace: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

const familiesOf = (family: string | readonly string[] | null | undefined) =>
  (typeof family === 'string' ? [family] : family ?? []).map((f) => f.trim()).filter(Boolean);

/** The CSS `font-family` for a family, or a stack of them (the first that loads wins): quoted, with a fallback of
    the first one's kind. Nothing for no family (inherit). */
export function fontStack(family: string | readonly string[] | null | undefined, category?: FontCategory): string | undefined {
  const names = familiesOf(family);
  if (!names.length) return undefined;
  return `${names.map((n) => `"${n.replace(/"/g, '')}"`).join(', ')}, ${FALLBACK[category ?? findGoogleFont(names[0])?.category ?? 'sans-serif']}`;
}

export interface GoogleFontOptions {
  /** The weights to load (default: every weight the family has, which only costs the stylesheet: the browser
   *  downloads a face when text uses it). */
  weights?: readonly number[];
  /** Load the italics too (when the family has them). */
  italic?: boolean;
  /** Only the glyphs of this text: a tiny file, for drawing a sample such as the family's own name. */
  text?: string;
}

const ALL_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/** The stylesheet URL for a family on the Google Fonts CSS API. */
export function googleFontsUrl(family: string, { weights, italic, text }: GoogleFontOptions = {}): string {
  const name = family.trim().replace(/\s+/g, '+');
  let axes = '';
  if (weights?.length || italic) {
    const ws = [...new Set(weights?.length ? weights : ALL_WEIGHTS)].sort((a, b) => a - b);
    axes = italic ? `:ital,wght@${[0, 1].flatMap((i) => ws.map((w) => `${i},${w}`)).join(';')}` : `:wght@${ws.join(';')}`;
  }
  return `https://fonts.googleapis.com/css2?family=${name}${axes}&display=swap${text ? `&text=${encodeURIComponent(text)}` : ''}`;
}

const loads = new Map<string, Promise<boolean>>();

/**
 * Loads a family from the Google Fonts CDN (once per family and options) and resolves true when its faces can be
 * used, false when Google Fonts doesn't have it (or there's no network, or no document). A request for a style the
 * family lacks (italics it doesn't have) falls back to the plain one.
 */
export function loadGoogleFont(family: string, options: GoogleFontOptions = {}): Promise<boolean> {
  const name = family.trim();
  if (!name || typeof document === 'undefined') return Promise.resolve(false);
  const known = findGoogleFont(name);
  const weights = options.weights ?? (options.text ? undefined : known?.weights ?? ALL_WEIGHTS);
  const italic = !!options.italic && known?.italic !== false;
  const url = googleFontsUrl(name, { ...options, weights, italic });
  let load = loads.get(url);
  if (!load) {
    load = (async () => {
      try {
        let res = await fetch(url);
        if (!res.ok && (italic || weights)) res = await fetch(googleFontsUrl(name, { text: options.text }));
        if (!res.ok) return false;
        const style = document.createElement('style');
        style.dataset.googleFont = name;
        style.textContent = await res.text();
        document.head.append(style);
        await document.fonts.load(`${weights?.includes(400) === false ? weights[0] : 400} 16px "${name}"`, options.text || undefined);
        return true;
      } catch {
        return false;
      }
    })();
    loads.set(url, load);
    // A failed load can be tried again later (the network may come back).
    void load.then((ok) => { if (!ok) loads.delete(url); });
  }
  return load;
}

export type GoogleFontStatus = 'idle' | 'loading' | 'ready' | 'missing';

/** Loads a family, or every family of a stack (see loadGoogleFont), and re-renders as that goes: `idle` with none,
    `missing` when Google Fonts doesn't have one of them. */
export function useGoogleFontStatus(family: string | readonly string[] | null | undefined, options: GoogleFontOptions = {}): GoogleFontStatus {
  const { weights, italic, text } = options;
  const names = familiesOf(family);
  const key = names.map((n) => googleFontsUrl(n, { weights, italic, text })).join(' ');
  const [done, setDone] = useState<{ key: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!key) return undefined;
    let live = true;
    void Promise.all(names.map((n) => loadGoogleFont(n, { weights, italic, text }))).then((oks) => { if (live) setDone({ key, ok: oks.every(Boolean) }); });
    return () => { live = false; };
    // `key` stands for the families and the options.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!key) return 'idle';
  return done?.key === key ? (done.ok ? 'ready' : 'missing') : 'loading';
}

/** Loads a family, or a stack of them (see loadGoogleFont), and re-renders when they're ready: true once their
    faces can be used. */
export const useGoogleFont = (family: string | readonly string[] | null | undefined, options?: GoogleFontOptions): boolean =>
  useGoogleFontStatus(family, options) === 'ready';

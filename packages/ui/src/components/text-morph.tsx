'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type Ref } from 'react';
import { AnimatePresence, animate, motion, useReducedMotion, type AnimationPlaybackControls } from 'framer-motion';
import { springs } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ══ TextMorph — a label that morphs into the next one, Family-style ══
   "Continue" → "Confirm": the letters the two words share ("C", "o", "n", "i") slide to their new places, the
   rest blur out and in, and the box springs to the new width. At rest it is one plain text run (kerning,
   selection and screen readers see ordinary text); the per-letter layer exists only while a morph runs.
   Letters are matched by character and occurrence (the 2nd "o" pairs with the 2nd "o"), which is what reads
   as "shared letters" for labels. The root is an inline-block at rest and while morphing, so box utilities
   (`truncate`, padding, a background) apply the same way throughout. The root's border box (padding included)
   is pinned and springs only while a morph runs; the inline width is released when it ends, when a new text
   interrupts it, or when the change can't morph (reduced motion, multi-line), so a later change of font, size or
   text without a morph is never clipped by a stale width. */

interface Glyph { key: string; ch: string }
/** `xs` are glyph offsets from the root's padding edge (where the absolute letter layer starts); `y` is the run's
    top from the same edge; `box` is the root's border-box width at rest. */
interface Layout { text: string; glyphs: Glyph[]; xs: number[]; y: number; box: number }

function glyphsOf(text: string): Glyph[] {
  const seen: Record<string, number> = {};
  return Array.from(text).map((ch) => {
    seen[ch] = (seen[ch] ?? -1) + 1;
    return { key: `${ch}\u0000${seen[ch]}`, ch };
  });
}

/** Measures the root at its natural width, in the element's own (unscaled) pixels. */
function measure(el: HTMLElement | null, text: string): Layout | null {
  const node = el?.firstElementChild?.firstChild;
  if (!el || !node || node.nodeType !== Node.TEXT_NODE) return null;
  const box = el.getBoundingClientRect();
  const scale = el.offsetWidth ? box.width / el.offsetWidth || 1 : 1;
  const padLeft = box.left + el.clientLeft * scale;
  const padTop = box.top + el.clientTop * scale;
  const r = document.createRange();
  r.selectNodeContents(node);
  const run = r.getBoundingClientRect();
  const glyphs = glyphsOf(text);
  const xs: number[] = [];
  let off = 0;
  for (const g of glyphs) {
    r.setStart(node, off);
    r.setEnd(node, off + g.ch.length);
    xs.push((r.getBoundingClientRect().left - padLeft) / scale);
    off += g.ch.length;
  }
  return { text, glyphs, xs, y: (run.top - padTop) / scale, box: el.offsetWidth };
}

interface Morph { from: Layout; to: Layout }

/* Letters cross a little slower than a plain fade so the eye can follow them; leaving is still quicker. */
const LETTER_IN = { duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: 0.05 } as const;
const LETTER_OUT = { duration: 0.18, ease: [0.4, 0, 1, 1] } as const;
const MORPH_MS = 700;

type MotionConflicts = 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDrag' | 'onDragStart' | 'onDragEnd';

export interface TextMorphProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children' | MotionConflicts> {
  children: string;
  ref?: Ref<HTMLSpanElement>;
}

export function TextMorph({ children, className, style, ref, ...props }: TextMorphProps) {
  const text = String(children ?? '');
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const last = useRef<Layout | null>(null);
  const [morph, setMorph] = useState<Morph | null>(null);
  const morphing = useRef(false);
  const restWidth = useRef('');
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const done = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setRoot = useCallback((node: HTMLSpanElement | null) => {
    rootRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  /* The width is written straight to the element while a morph runs, never through `style`, so ending the morph
     can hand the inline width back exactly as it was (the caller's `style.width`, or nothing). */
  const release = useCallback(() => {
    clearTimeout(done.current);
    anim.current?.stop();
    anim.current = null;
    if (morphing.current && rootRef.current) rootRef.current.style.width = restWidth.current;
    morphing.current = false;
  }, []);

  useLayoutEffect(() => {
    const el = rootRef.current;
    const prev = last.current;
    const pinned = el?.style.width ?? '';
    // Measure the new text at its natural width (unpin for the read; it is put back before paint).
    if (el && morphing.current) el.style.width = restWidth.current;
    const now = measure(el, text);
    if (el && morphing.current) el.style.width = pinned;
    last.current = now;
    if (!el || !now || !prev || prev.text === text) return;
    if (reduced || /\n/.test(text + prev.text)) {
      release();
      setMorph(null);
      return;
    }
    const from = morphing.current ? el.offsetWidth : prev.box;
    if (!morphing.current) restWidth.current = el.style.width;
    clearTimeout(done.current);
    anim.current?.stop();
    morphing.current = true;
    el.style.width = `${from}px`;
    anim.current = animate(from, now.box, {
      ...(springs.snappy as object),
      onUpdate: (w: number) => { if (morphing.current) el.style.width = `${w}px`; },
    } as never);
    setMorph({ from: prev, to: now });
    done.current = setTimeout(() => { release(); setMorph(null); }, MORPH_MS);
  }, [text]);
  // Keep the resting layout current when the box changes without a text change (a late web font, a size change).
  useEffect(() => {
    const el = rootRef.current;
    if (!el || morph) return;
    const remeasure = () => { if (!morphing.current) last.current = measure(el, text); };
    let live = true;
    document.fonts?.ready.then(() => { if (live) remeasure(); });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(remeasure);
    ro?.observe(el);
    return () => { live = false; ro?.disconnect(); };
  }, [text, morph]);
  useEffect(() => release, [release]);

  const fromX = new Map(morph?.from.glyphs.map((g, i) => [g.key, morph.from.xs[i]]) ?? []);
  const toKeys = new Set(morph?.to.glyphs.map((g) => g.key) ?? []);
  return (
    <span
      {...props}
      data-slot="text-morph"
      data-morphing={morph ? '' : undefined}
      className={cn('inline-block', morph && 'relative text-start whitespace-pre', className)}
      ref={setRoot}
      style={style}
    >
      <span style={morph ? { visibility: 'hidden' } : undefined}>{text}</span>
      {morph ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ top: morph.to.y }}>
          {/* The layer mounts with the morph, so its first children must play their `initial` (no initial={false}). */}
          <AnimatePresence>
            {morph.to.glyphs.map((g, i) => {
              const from = fromX.get(g.key);
              const x = morph.to.xs[i];
              return (
                <motion.span
                  key={g.key}
                  className="absolute top-0 left-0 whitespace-pre"
                  initial={from != null ? { x: from, opacity: 1 } : { x, opacity: 0, scale: 0.7, filter: 'blur(4px)' }}
                  animate={{ x, opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.7, filter: 'blur(4px)', transition: LETTER_OUT }}
                  transition={{ x: springs.snappy, default: LETTER_IN }}
                >
                  {g.ch}
                </motion.span>
              );
            })}
            {morph.from.glyphs.map((g, i) => toKeys.has(g.key) ? null : (
              <motion.span
                key={g.key}
                className="absolute top-0 left-0 whitespace-pre"
                initial={{ x: morph.from.xs[i], opacity: 1 }}
                animate={{ opacity: 0, scale: 0.7, filter: 'blur(4px)' }}
                exit={{ opacity: 0 }}
                transition={LETTER_OUT}
              >
                {g.ch}
              </motion.span>
            ))}
          </AnimatePresence>
        </span>
      ) : null}
    </span>
  );
}

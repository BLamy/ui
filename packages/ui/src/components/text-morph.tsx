import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { springs } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ══ TextMorph — a label that morphs into the next one, Family-style ══
   "Continue" → "Confirm": the letters the two words share ("C", "o", "n", "i") slide to their new places, the
   rest blur out and in, and the box springs to the new width. At rest it is one plain text run (kerning,
   selection and screen readers see ordinary text); the per-letter layer exists only while a morph runs.
   Letters are matched by character and occurrence (the 2nd "o" pairs with the 2nd "o"), which is what reads
   as "shared letters" for labels. */

interface Glyph { key: string; ch: string }
interface Layout { text: string; glyphs: Glyph[]; xs: number[]; w: number }

function glyphsOf(text: string): Glyph[] {
  const seen: Record<string, number> = {};
  return Array.from(text).map((ch) => {
    seen[ch] = (seen[ch] ?? -1) + 1;
    return { key: `${ch}\u0000${seen[ch]}`, ch };
  });
}

/** Per-glyph x offsets from the start of the run, in the element's own (unscaled) pixels. */
function measure(el: HTMLElement | null, text: string): Layout | null {
  const node = el?.firstChild;
  if (!el || !node || node.nodeType !== Node.TEXT_NODE) return null;
  const r = document.createRange();
  r.selectNodeContents(node);
  const run = r.getBoundingClientRect();
  const scale = el.offsetWidth ? run.width / el.offsetWidth || 1 : 1;
  const glyphs = glyphsOf(text);
  const xs: number[] = [];
  let off = 0;
  for (const g of glyphs) {
    r.setStart(node, off);
    r.setEnd(node, off + g.ch.length);
    xs.push((r.getBoundingClientRect().left - run.left) / scale);
    off += g.ch.length;
  }
  return { text, glyphs, xs, w: run.width / scale };
}

interface Morph { from: Layout; to: Layout }

/* Letters cross a little slower than a plain fade so the eye can follow them; leaving is still quicker. */
const LETTER_IN = { duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: 0.05 } as const;
const LETTER_OUT = { duration: 0.18, ease: [0.4, 0, 1, 1] } as const;

export interface TextMorphProps {
  children: string;
  className?: string;
  style?: CSSProperties;
}

export function TextMorph({ children, className, style }: TextMorphProps) {
  const text = String(children ?? '');
  const reduced = useReducedMotion();
  const runRef = useRef<HTMLSpanElement | null>(null);
  const last = useRef<Layout | null>(null);
  const [morph, setMorph] = useState<Morph | null>(null);
  const width = useMotionValue<number | 'auto'>('auto');
  const done = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useLayoutEffect(() => {
    const now = measure(runRef.current, text);
    const prev = last.current;
    last.current = now;
    if (!now || !prev || prev.text === text || reduced || /\n/.test(text + prev.text)) return;
    if (morph == null) width.set(prev.w);
    animate(width, now.w, springs.snappy as never);
    setMorph({ from: prev, to: now });
    clearTimeout(done.current);
    done.current = setTimeout(() => { setMorph(null); width.set('auto'); }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  // Web fonts can land after the first measure; keep the resting layout current.
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => { if (live && !morph) last.current = measure(runRef.current, text); });
    return () => { live = false; };
  }, [text, morph]);
  useEffect(() => () => clearTimeout(done.current), []);

  const fromX = new Map(morph?.from.glyphs.map((g, i) => [g.key, morph.from.xs[i]]) ?? []);
  const toKeys = new Set(morph?.to.glyphs.map((g) => g.key) ?? []);
  return (
    <motion.span
      data-slot="text-morph"
      data-morphing={morph ? '' : undefined}
      className={cn(morph ? 'relative inline-block text-start whitespace-pre' : 'contents', className)}
      style={morph ? { ...style, width } : style}
    >
      <span ref={runRef} style={morph ? { visibility: 'hidden' } : undefined}>{text}</span>
      {morph ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
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
    </motion.span>
  );
}

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { fades, springs } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ══ NumberMorph — a formatted number whose digits roll and whose separators slide (NumberFlow-style) ══
   The value is formatted with Intl.NumberFormat and every part keeps its identity by place: the units digit
   stays the units digit, the thousands comma stays the thousands comma. So typing 1234 → 12345 slides the
   comma one digit left instead of re-rendering the string, and 19 → 20 rolls the tens digit up one notch
   (and the units digit up through 0) instead of swapping glyphs. Digits roll up when the value rises and
   down when it falls. */

type Part = { key: string; type: string; value: string };

function partsOf(value: number, fmt: Intl.NumberFormat): Part[] {
  const raw = fmt.formatToParts(value);
  const intDigits = raw.filter((p) => p.type === 'integer').reduce((n, p) => n + p.value.length, 0);
  let seenInt = 0, seenFrac = 0;
  const counts: Record<string, number> = {};
  const out: Part[] = [];
  for (const p of raw) {
    if (p.type === 'integer') {
      for (const ch of p.value) { out.push({ key: `i${intDigits - 1 - seenInt}`, type: 'digit', value: ch }); seenInt++; }
    } else if (p.type === 'fraction') {
      for (const ch of p.value) { out.push({ key: `f${seenFrac}`, type: 'digit', value: ch }); seenFrac++; }
    } else if (p.type === 'group') {
      // Named for the digits to its right, so the thousands separator is the same element at 1,234 and 12,345.
      out.push({ key: `g${intDigits - seenInt}`, type: 'sep', value: p.value });
    } else {
      counts[p.type] = (counts[p.type] ?? -1) + 1;
      out.push({ key: `${p.type}${counts[p.type]}`, type: p.type === 'decimal' ? 'sep' : 'sym', value: p.value });
    }
  }
  return out;
}

/** One rolling digit: a 0–9–0 reel behind a soft mask. `pos` is continuous, so wrapping 9 → 0 keeps rolling. */
function Digit({ value, trend }: { value: string; trend: number }) {
  const d = Number(value);
  const reduced = useReducedMotion();
  const pos = useMotionValue(d);
  const y = useTransform(pos, (p) => `${-(((p % 10) + 10) % 10) * (100 / 11)}%`);
  const lastD = useRef(d);
  useEffect(() => {
    const prev = lastD.current; lastD.current = d;
    if (prev === d) return;
    const cur = pos.get();
    const step = trend >= 0 ? (d - prev + 10) % 10 : -((prev - d + 10) % 10);
    if (reduced) { pos.set(cur + step); return; }
    animate(pos, Math.round(cur) + step, springs.smooth as never);
  }, [d, trend, reduced, pos]);
  return (
    <span className="relative inline-block [mask-image:linear-gradient(to_bottom,transparent,#000_.12em,#000_calc(100%_-_.12em),transparent)] py-[.12em] -my-[.12em]">
      <span className="invisible">{value}</span>
      <motion.span aria-hidden="true" className="absolute inset-x-0 top-[.12em] flex flex-col items-center" style={{ y }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, i) => <span key={i}>{n}</span>)}
      </motion.span>
    </span>
  );
}

export interface NumberMorphProps {
  value: number;
  /** Intl.NumberFormat options (currency, percent, fraction digits, compact notation, …). */
  format?: Intl.NumberFormatOptions;
  locales?: string | string[];
  className?: string;
  style?: CSSProperties;
}

export function NumberMorph({ value, format, locales, className, style }: NumberMorphProps) {
  const fmtKey = JSON.stringify([locales, format]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fmt = useMemo(() => new Intl.NumberFormat(locales, format), [fmtKey]);
  const parts = partsOf(value, fmt);
  const prev = useRef(value);
  const trend = value === prev.current ? 0 : value > prev.current ? 1 : -1;
  useEffect(() => { prev.current = value; }, [value]);
  const reduced = useReducedMotion();
  const layoutT = reduced ? { duration: 0 } : springs.snappy;
  return (
    <span data-slot="number-morph" className={cn('inline-flex items-baseline whitespace-pre tabular-nums', className)} style={style}
      role="img" aria-label={fmt.format(value)}>
      <AnimatePresence initial={false} mode="popLayout">
        {parts.map((p) => (
          <motion.span
            key={p.key}
            layout="position"
            className="inline-block"
            initial={{ opacity: 0, scale: 0.6, filter: 'blur(3px)', y: trend > 0 ? '.35em' : '-.35em' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
            exit={{ opacity: 0, scale: 0.6, filter: 'blur(3px)', transition: fades.out }}
            transition={{ layout: layoutT, y: layoutT, scale: layoutT, default: fades.in }}
          >
            {p.type === 'digit' ? <Digit value={p.value} trend={trend} /> : p.value}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

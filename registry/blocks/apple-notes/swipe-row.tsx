/* A list row with iOS swipe actions. Drag right to reveal the leading actions, left for the trailing ones;
   past 55% of the row the outermost action stretches across and fires on release (a medium tick when it arms,
   a light one if you pull back). The row follows the finger 1:1 and settles on the snappy spring, keeping the
   release velocity. Opening a row closes any other; so does touching anywhere outside it. */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Haptics, cn, springCss, springs, useMotion, useReducedMotion } from '@brett_lamy/ui';

export interface SwipeAction {
  label: string;
  icon: ReactNode;
  /** Background color (any CSS color). */
  color: string;
  onAction: () => void;
}

const ACTION_W = 74;
const closers = new Set<() => void>();

export function SwipeRow({ leading = [], trailing = [], disabled, children, className }: {
  /** Left to right; the first one is the full-swipe action. */
  leading?: SwipeAction[];
  /** Left to right; the last one is the full-swipe action. */
  trailing?: SwipeAction[];
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { motion, animate, useMotionValue, useTransform } = useMotion();
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const leadW = useTransform(x, (v) => Math.max(0, v));
  const trailW = useTransform(x, (v) => Math.max(0, -v));
  const el = useRef<HTMLDivElement | null>(null);
  const g = useRef<{ x0: number; y0: number; base: number; on: boolean; last: number; t: number; v: number } | null>(null);
  const moved = useRef(false);
  const open = useRef(false);
  const [armed, setArmed] = useState<'lead' | 'trail' | null>(null);
  const armedRef = useRef(armed); armedRef.current = armed;

  const root = useRef<HTMLDivElement | null>(null);
  const settle = (to: number, velocity = 0) => {
    open.current = to !== 0;
    if (reduce) x.set(to);
    else animate(x, to, { ...springs.snappy, velocity });
  };
  useEffect(() => {
    const close = () => settle(0);
    closers.add(close);
    // Touching anywhere outside an open row closes it.
    const outside = (e: PointerEvent) => { if (open.current && !root.current?.contains(e.target as Node)) settle(0); };
    document.addEventListener('pointerdown', outside, true);
    return () => { closers.delete(close); document.removeEventListener('pointerdown', outside, true); };
  });

  const down = (e: ReactPointerEvent) => {
    if (disabled || e.button || (!leading.length && !trailing.length)) return;
    g.current = { x0: e.clientX, y0: e.clientY, base: x.get(), on: false, last: e.clientX, t: performance.now(), v: 0 };
    moved.current = false;
  };
  const move = (e: ReactPointerEvent) => {
    const d = g.current; if (!d) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.on) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        d.on = true; moved.current = true;
        closers.forEach((c) => c());
        try { el.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
      } else { if (Math.abs(dy) > 12) g.current = null; return; }
    }
    const w = el.current?.offsetWidth ?? 360;
    let nx = d.base + dx;
    // No actions on a side: rubber-band a little, then stop.
    if (nx > 0 && !leading.length) nx = Math.min(nx * 0.15, 24);
    if (nx < 0 && !trailing.length) nx = Math.max(nx * 0.15, -24);
    x.stop(); x.set(nx);
    const now = performance.now();
    d.v = ((e.clientX - d.last) / Math.max(1, now - d.t)) * 1000; d.last = e.clientX; d.t = now;
    const arm = nx > w * 0.55 && leading.length ? 'lead' : nx < -w * 0.55 && trailing.length ? 'trail' : null;
    if (arm !== armedRef.current) { Haptics.impact(arm ? 'medium' : 'light'); setArmed(arm); }
  };
  const up = () => {
    const d = g.current; g.current = null;
    if (!d || !d.on) return;
    const w = el.current?.offsetWidth ?? 360;
    const v = x.get();
    const fire = armedRef.current;
    setArmed(null);
    if (fire === 'lead') { settle(0, d.v); leading[0].onAction(); return; }
    if (fire === 'trail') { settle(-w, d.v); trailing[trailing.length - 1].onAction(); return; }
    const openLead = leading.length * ACTION_W, openTrail = trailing.length * ACTION_W;
    if (v > openLead / 2 || (d.v > 600 && v > 0)) settle(openLead, d.v);
    else if (v < -openTrail / 2 || (d.v < -600 && v < 0)) settle(-openTrail, d.v);
    else settle(0, d.v);
  };

  const strip = (actions: SwipeAction[], side: 'lead' | 'trail') => (
    <motion.div aria-hidden="true" className={cn('absolute inset-y-0 flex overflow-hidden', side === 'lead' ? 'left-0' : 'right-0')}
      style={{ width: side === 'lead' ? leadW : trailW }}>
      {actions.map((a, i) => {
        const full = armed === side && (side === 'lead' ? i === 0 : i === actions.length - 1);
        const hidden = armed === side && !full;
        return (
          <button key={a.label} type="button" tabIndex={-1}
            onClick={() => { settle(0); a.onAction(); }}
            className="bl-btn flex min-w-0 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden border-0 text-[13px] font-medium text-white [font-family:inherit]"
            style={{
              background: a.color, flex: hidden ? '0 0 0px' : full ? '1 0 100%' : '1 1 0px',
              transition: springCss(['flex-basis', 'flex-grow'], 'snappy'),
            }}>
            {a.icon}
            <span className="truncate">{a.label}</span>
          </button>
        );
      })}
    </motion.div>
  );

  return (
    <div ref={root} data-slot="swipe-row" className={cn('relative overflow-hidden', className)}>
      {leading.length ? strip(leading, 'lead') : null}
      {trailing.length ? strip(trailing, 'trail') : null}
      <motion.div ref={el} style={{ x }} className="relative touch-pan-y"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        // A drag isn't a tap; a tap on an open row closes it.
        onClickCapture={(e) => {
          if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false; }
          else if (Math.abs(x.get()) > 2) { e.stopPropagation(); e.preventDefault(); settle(0); }
        }}>
        {children}
      </motion.div>
    </div>
  );
}

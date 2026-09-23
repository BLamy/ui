import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Haptics } from '../lib/haptics';
import { cn } from '../lib/utils';

/* ══ IndexBar — generic jump rail (haptic tick per stop) ══
   Give it jump points of your own:
     <IndexBar items={[{key:'m4', label:'●', preview:'Why is the build slow?'}]} onJump={key => …}/>
   …or give it nothing but `avail` and it falls back to the UIKit A–Z form:
     <IndexBar avail={new Set(['A','B'])} onLetter={L => …}/>
   Hover peeks the stop under the cursor (no tick, no jump); drag commits it. */

export const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export type IndexBarKey = string | number;

export interface IndexBarItem<K extends IndexBarKey = IndexBarKey> {
  key?: K;
  label?: string;
  preview?: ReactNode;
  caption?: string | null;
  dim?: boolean;
}

interface IBPoint<K extends IndexBarKey = IndexBarKey> { key: K; label: string; preview: ReactNode | null; caption: string | null; dim: boolean }
interface IndexBarGeometry { rTop: number; tTop: number; tH: number }

function ibPoints<K extends IndexBarKey>(items: Array<IndexBarItem<K> | K> | undefined, avail: Set<string> | undefined): Array<IBPoint<K | string>> {
  if (items && items.length) return items.map((it, i) => (it && typeof it === 'object')
    ? {
        key: it.key != null ? it.key : String(i), label: it.label != null ? String(it.label) : '',
        preview: it.preview != null ? it.preview : null, caption: it.caption || null, dim: !!it.dim,
      }
    : { key: it, label: String(it), preview: null, caption: null, dim: false });
  const av = avail || new Set<string>();
  return AL.map((L) => ({ key: L, label: L, preview: null, caption: null, dim: !av.has(L) }));
}

export interface IndexBarProps<K extends IndexBarKey = string> {
  items?: Array<IndexBarItem<K> | K>;
  avail?: Set<string>;
  onJump?: (key: K, point: IndexBarItem<K>, index: number) => void;
  onLetter?: (key: string) => void;
  top?: number | string;
  bottom?: number | string;
  width?: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export function IndexBar<K extends IndexBarKey = string>({ items, avail, onJump, onLetter, top, bottom, width = 22, label = 'Jump to section', className, style }: IndexBarProps<K>) {
  const pts = ibPoints(items, avail);
  const optionId = useId();
  const rail = useRef<HTMLDivElement>(null); const track = useRef<HTMLDivElement>(null); const geo = useRef<IndexBarGeometry | null>(null);
  const act = useRef(-1); const ptsRef = useRef(pts); ptsRef.current = pts;
  const [cur, setCur] = useState(-1); const [hov, setHov] = useState(-1); const [on, setOn] = useState(false);
  const [focused, setFocused] = useState(false); const [keyboardIndex, setKeyboardIndex] = useState(-1);
  const measure = () => {
    const r = rail.current, t = track.current; if (!r || !t) return null;
    const rb = r.getBoundingClientRect(), tb = t.getBoundingClientRect();
    return (geo.current = { rTop: rb.top, tTop: tb.top, tH: tb.height });
  };
  const at = (y: number) => {
    const g = geo.current || measure(); if (!g || !g.tH) return -1;
    const n = ptsRef.current.length;
    return Math.max(0, Math.min(n - 1, Math.floor((y - g.tTop) / g.tH * n)));
  };
  const fire = (i: number) => {
    const p = ptsRef.current[i];
    if (!p || i === act.current) return;
    act.current = i; setCur(i); Haptics.selection();
    if (onJump) onJump(p.key as K, p as IndexBarItem<K>, i); else if (onLetter) onLetter(String(p.key));
  };
  const down = (e: React.PointerEvent) => {
    if (e.button) return;
    measure(); setOn(true); setHov(-1); fire(at(e.clientY));
    // No pointer capture here: the vibrator polyfill slides a native <input switch> under the finger during
    // drags, and capture would starve it of events. Window listeners track the scrub instead.
    const mm = (ev: PointerEvent) => fire(at(ev.clientY));
    const uu = () => {
      window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', uu);
      window.removeEventListener('pointercancel', uu); setOn(false); setCur(-1); act.current = -1;
    };
    window.addEventListener('pointermove', mm); window.addEventListener('pointerup', uu); window.addEventListener('pointercancel', uu);
  };
  const hover = (e: React.PointerEvent) => {
    if (on || e.pointerType === 'touch') return;
    if (!geo.current) measure();
    const i = at(e.clientY); if (i !== hov) setHov(i);
  };
  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!pts.length || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const from = keyboardIndex >= 0 ? keyboardIndex : e.key === 'ArrowUp' ? pts.length : -1;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? pts.length - 1
      : Math.max(0, Math.min(pts.length - 1, from + (e.key === 'ArrowUp' ? -1 : 1)));
    setKeyboardIndex(next);
    act.current = -1;
    fire(next);
  };
  const idx = on ? cur : hov >= 0 ? hov : focused ? keyboardIndex : -1;
  const p = idx >= 0 ? pts[idx] : null;
  const g = geo.current;
  const cy = g && p ? (g.tTop - g.rTop) + (idx + 0.5) * (g.tH / pts.length) : 0;
  // Bubble floats beside the rail at the active stop; both come from measured geometry.
  const bub = cn(
    'pointer-events-none absolute [transform:translateY(-50%)] bg-card shadow-[0_8px_28px_rgba(0,0,0,.28),0_0_0_1px_var(--bl-sep)] animate-[blBub_.16s_cubic-bezier(.32,.72,0,1)]',
    on ? 'opacity-100' : 'opacity-93',
  );
  const bubPos: CSSProperties = { right: width + 10, top: cy };
  return (
    <div ref={rail} data-slot="index-bar" data-haptic-drag onPointerDown={down} onPointerMove={hover} onPointerLeave={() => setHov(-1)}
      role="listbox" aria-orientation="vertical" aria-label={label} aria-activedescendant={idx >= 0 ? `${optionId}-${idx}` : undefined}
      tabIndex={0} onKeyDown={keyDown} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setKeyboardIndex(-1); }}
      className={cn(
        'absolute right-0 z-80 flex cursor-pointer touch-none flex-col items-center justify-center rounded-[8px] outline-offset-2 select-none',
        focused ? '[outline:2px_solid_var(--bl-tint)]' : '[outline:2px_solid_transparent]',
        className,
      )}
      style={{ top, bottom, width, ...style }}
      >
      <div ref={track} className="flex w-full flex-col items-center">
        {pts.map((q, i) => {
          const hot = idx === i;
          return (
            <div key={String(q.key) + i} id={`${optionId}-${i}`} role="option" aria-selected={idx === i}
              aria-label={q.caption || q.label || `Stop ${i + 1}`}
              className={cn('flex h-[13.5px] w-full items-center justify-center transition-[transform] duration-120', hot && '[transform:scale(1.5)]')}>
              {q.label
                ? <span className={cn('text-[10.5px] leading-[13.5px] font-bold', q.dim ? 'text-bl-label3' : 'text-primary')}>{q.label}</span>
                : <span className={cn('rounded-full', hot ? 'size-1.5' : 'size-[5px]', q.dim ? 'bg-bl-label3 opacity-55' : 'bg-primary')} />}
            </div>
          );
        })}
      </div>
      {p && (p.preview != null)
        ? <div className={cn(bub, 'box-border max-w-[250px] min-w-[120px] rounded-[14px] px-[13px] py-[9px]')} style={bubPos}>
            {p.caption ? <div className="mb-[3px] text-[9.5px] font-extrabold tracking-[.6px] text-primary uppercase">{p.caption}</div> : null}
            <div className="line-clamp-3 text-[13px] leading-[1.35] font-[550] text-pretty text-foreground">{p.preview}</div>
          </div>
        : p ? <div className={cn(bub, 'grid size-[54px] place-items-center rounded-[27px] text-[25px] font-extrabold text-primary')} style={bubPos}>{p.label}</div> : null}
    </div>
  );
}

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Haptics } from '../lib/haptics';
import { cn, EASE } from '../lib/utils';

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
  const bub: CSSProperties = {
    position: 'absolute', right: width + 10, top: cy, transform: 'translateY(-50%)', background: 'var(--tk-card)',
    boxShadow: '0 8px 28px rgba(0,0,0,.28), 0 0 0 1px var(--tk-sep)', animation: 'tkBub .16s ' + EASE,
    pointerEvents: 'none', opacity: on ? 1 : .93,
  };
  return (
    <div ref={rail} data-slot="index-bar" className={cn(className)} onPointerDown={down} onPointerMove={hover} onPointerLeave={() => setHov(-1)}
      role="listbox" aria-orientation="vertical" aria-label={label} aria-activedescendant={idx >= 0 ? `${optionId}-${idx}` : undefined}
      tabIndex={0} onKeyDown={keyDown} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setKeyboardIndex(-1); }}
      style={{
        position: 'absolute', right: 0, top, bottom, width, zIndex: 80, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', touchAction: 'none', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none',
        outline: focused ? '2px solid var(--tk-tint)' : '2px solid transparent', outlineOffset: 2, borderRadius: 8, ...style,
      }}
      >
      <div ref={track} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {pts.map((q, i) => {
          const hot = idx === i;
          return (
            <div key={String(q.key) + i} id={`${optionId}-${i}`} role="option" aria-selected={idx === i}
              aria-label={q.caption || q.label || `Stop ${i + 1}`} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', height: 13.5, width: '100%',
              transform: hot ? 'scale(1.5)' : 'none', transition: 'transform .12s',
            }}>
              {q.label
                ? <span style={{ fontSize: 10.5, fontWeight: 700, lineHeight: '13.5px', color: q.dim ? 'var(--tk-label3)' : 'var(--tk-tint)' }}>{q.label}</span>
                : <span style={{
                    width: hot ? 6 : 5, height: hot ? 6 : 5, borderRadius: '50%', background: q.dim ? 'var(--tk-label3)' : 'var(--tk-tint)',
                    opacity: q.dim ? .55 : 1,
                  }} />}
            </div>
          );
        })}
      </div>
      {p && (p.preview != null)
        ? <div style={{ ...bub, maxWidth: 250, minWidth: 120, borderRadius: 14, padding: '9px 13px', boxSizing: 'border-box' }}>
            {p.caption ? <div style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase',
              color: 'var(--tk-tint)', marginBottom: 3,
            }}>{p.caption}</div> : null}
            <div style={{
              fontSize: 13, lineHeight: 1.35, color: 'var(--tk-label)', fontWeight: 550, display: '-webkit-box',
              WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textWrap: 'pretty',
            } as CSSProperties}>{p.preview}</div>
          </div>
        : p ? <div style={{
            ...bub, width: 54, height: 54, borderRadius: 27, display: 'grid', placeItems: 'center',
            fontSize: 25, fontWeight: 800, color: 'var(--tk-tint)',
          }}>{p.label}</div> : null}
    </div>
  );
}

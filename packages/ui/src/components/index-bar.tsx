import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { Haptics } from '../lib/haptics';
import { cn } from '../lib/utils';

/* ══ IndexBar — generic jump rail (haptic tick per stop) ══
   Give it jump points of your own:
     <IndexBar items={[{key:'m4', label:'●', preview:'Why is the build slow?'}]} onJump={key => …}/>
   …or give it nothing but `avail` and it falls back to the UIKit A–Z form:
     <IndexBar avail={new Set(['A','B'])} onLetter={L => …}/>
   Hover peeks the stop under the cursor (no tick, no jump); drag commits it.
   variant="wave" draws one dash per stop that swells around the pointer like the macOS Dock, with a
   title + preview card beside the rail: <IndexBar variant="wave" side="left" value={current} items={…}/> */

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

export const indexBarVariants = cva(
  'absolute z-80 flex cursor-pointer touch-none flex-col justify-center rounded-[8px] outline-offset-2 select-none',
  {
    variants: {
      variant: { default: 'items-center', wave: 'items-stretch' },
      side: { right: 'right-0', left: 'left-0' },
    },
    defaultVariants: { variant: 'default', side: 'right' },
  },
);

/* Wave geometry, in px and stops: rest/peak dash length, and how many stops the swell reaches either side. */
const WAVE_REST = 9, WAVE_PEAK = 28, WAVE_REACH = 3.2;
/** Raised-cosine falloff: 1 at the pointer, 0 at WAVE_REACH stops away. */
const swell = (d: number) => (d >= WAVE_REACH ? 0 : (1 + Math.cos(Math.PI * d / WAVE_REACH)) / 2);

export interface IndexBarProps<K extends IndexBarKey = string> {
  items?: Array<IndexBarItem<K> | K>;
  avail?: Set<string>;
  onJump?: (key: K, point: IndexBarItem<K>, index: number) => void;
  onLetter?: (key: string) => void;
  top?: number | string;
  bottom?: number | string;
  width?: number;
  label?: string;
  /** `default` renders letters/dots with a bubble; `wave` renders dashes that swell around the pointer. */
  variant?: 'default' | 'wave';
  /** Edge the rail sits on; the preview appears on the inner side. */
  side?: 'left' | 'right';
  /** Key of the current item (e.g. the turn in view); the wave draws it full length in the tint. */
  value?: K;
  className?: string;
  style?: CSSProperties;
}

export function IndexBar<K extends IndexBarKey = string>({
  items, avail, onJump, onLetter, top, bottom, width: widthProp, label = 'Jump to section',
  variant = 'default', side = 'right', value, className, style,
}: IndexBarProps<K>) {
  const wave = variant === 'wave';
  const width = widthProp ?? (wave ? 40 : 22);
  const pts = ibPoints(items, avail);
  const optionId = useId();
  const rail = useRef<HTMLDivElement>(null); const track = useRef<HTMLDivElement>(null); const geo = useRef<IndexBarGeometry | null>(null);
  const act = useRef(-1); const ptsRef = useRef(pts); ptsRef.current = pts;
  const [cur, setCur] = useState(-1); const [hov, setHov] = useState(-1); const [on, setOn] = useState(false);
  const [focused, setFocused] = useState(false); const [keyboardIndex, setKeyboardIndex] = useState(-1);
  // Continuous pointer position along the track, in stops (0 = top edge, n = bottom edge); drives the wave.
  const [pu, setPu] = useState<number | null>(null);
  const measure = () => {
    const r = rail.current, t = track.current; if (!r || !t) return null;
    const rb = r.getBoundingClientRect(), tb = t.getBoundingClientRect();
    return (geo.current = { rTop: rb.top, tTop: tb.top, tH: tb.height });
  };
  const along = (y: number) => {
    const g = geo.current; if (!wave || !g || !g.tH) return;
    const n = ptsRef.current.length;
    setPu(Math.max(0, Math.min(n, (y - g.tTop) / g.tH * n)));
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
    measure(); setOn(true); setHov(-1); fire(at(e.clientY)); along(e.clientY);
    // Window listeners track the scrub (they keep working if the finger leaves the rail). Ticks from pointermove
    // play on Android; iOS Safari has no user gesture mid-drag, so the scrub is silent there.
    const mm = (ev: PointerEvent) => { fire(at(ev.clientY)); along(ev.clientY); };
    const uu = () => {
      window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', uu);
      window.removeEventListener('pointercancel', uu); setOn(false); setCur(-1); setPu(null); act.current = -1;
    };
    window.addEventListener('pointermove', mm); window.addEventListener('pointerup', uu); window.addEventListener('pointercancel', uu);
  };
  const hover = (e: React.PointerEvent) => {
    if (on || e.pointerType === 'touch') return;
    if (!geo.current) measure();
    const i = at(e.clientY); if (i !== hov) setHov(i);
    along(e.clientY);
  };
  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!pts.length || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    if (!geo.current) measure();
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
    'pointer-events-none absolute [transform:translateY(-50%)] bg-card shadow-[0_8px_28px_rgba(0,0,0,.28),0_0_0_1px_var(--bl-sep)] animate-[blBub_var(--duration-spring-snappy)_var(--ease-spring-bouncy)] transition-[top] duration-spring-snappy ease-spring-snappy motion-reduce:animate-none motion-reduce:transition-none',
    on ? 'opacity-100' : 'opacity-93',
  );
  const bubPos: CSSProperties = side === 'left' ? { left: width + 10, top: cy } : { right: width + 10, top: cy };
  const curIdx = value != null ? pts.findIndex((q) => q.key === value) : -1;
  // The wave centres on the pointer while it's on the rail, else on the keyboard-active stop.
  const focal = pu != null ? pu : idx >= 0 ? idx + 0.5 : null;
  return (
    <div ref={rail} data-slot="index-bar" data-variant={variant} data-side={side}
      onPointerDown={down} onPointerEnter={() => { if (!on) measure(); }} onPointerMove={hover}
      onPointerLeave={() => { setHov(-1); if (!on) setPu(null); }}
      role="listbox" aria-orientation="vertical" aria-label={label} aria-activedescendant={idx >= 0 ? `${optionId}-${idx}` : undefined}
      tabIndex={0} onKeyDown={keyDown} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setKeyboardIndex(-1); }}
      className={cn(
        indexBarVariants({ variant, side }),
        focused ? '[outline:2px_solid_var(--bl-tint)]' : '[outline:2px_solid_transparent]',
        className,
      )}
      style={{ top, bottom, width, ...style }}
      >
      <div ref={track} className={cn('flex w-full flex-col', !wave && 'items-center')}>
        {pts.map((q, i) => {
          if (wave) {
            const full = idx === i || curIdx === i;
            const f = full ? 1 : focal == null ? 0 : swell(Math.abs(i + 0.5 - focal));
            const len = WAVE_REST + (WAVE_PEAK - WAVE_REST) * f;
            return (
              <div key={String(q.key) + i} id={`${optionId}-${i}`} role="option" aria-selected={idx === i}
                aria-current={curIdx === i ? 'true' : undefined} aria-label={q.caption || q.label || `Stop ${i + 1}`}
                className={cn('box-border flex h-[10px] w-full items-center px-2', side === 'left' ? 'justify-start' : 'justify-end')}>
                <span style={{ '--len': `${len}px`, '--f': f } as CSSProperties}
                  className={cn(
                    'h-[2px] w-(--len) shrink-0 rounded-full transition-[width,background-color] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
                    idx === i ? 'bg-foreground' : curIdx === i ? 'bg-primary'
                      : 'bg-[color:color-mix(in_oklab,var(--bl-label)_calc(var(--f)*75%),var(--bl-label3))]',
                    q.dim && idx !== i && 'opacity-55',
                  )} />
              </div>
            );
          }
          const hot = idx === i;
          return (
            <div key={String(q.key) + i} id={`${optionId}-${i}`} role="option" aria-selected={idx === i}
              aria-label={q.caption || q.label || `Stop ${i + 1}`}
              className={cn('flex h-[13.5px] w-full items-center justify-center transition-[scale] duration-spring-snappy ease-spring-bouncy motion-reduce:transition-none', hot && 'scale-150')}>
              {q.label
                ? <span className={cn('text-[10.5px] leading-[13.5px] font-bold', q.dim ? 'text-bl-label3' : 'text-primary')}>{q.label}</span>
                : <span className={cn('rounded-full', hot ? 'size-1.5' : 'size-[5px]', q.dim ? 'bg-bl-label3 opacity-55' : 'bg-primary')} />}
            </div>
          );
        })}
      </div>
      {wave
        ? p && <div className={cn(
              'pointer-events-none absolute box-border w-max max-w-[260px] min-w-[160px] -translate-y-1/2 rounded-[14px] bg-card px-[13px] py-[9px]',
              'shadow-[0_8px_28px_rgba(0,0,0,.28),0_0_0_1px_var(--bl-sep)] transition-[top] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
              'animate-[blWaveCard_var(--duration-spring-snappy)_var(--ease-spring-snappy)] motion-reduce:animate-none',
              side === 'left' ? 'origin-left' : 'origin-right',
            )} style={side === 'left' ? { left: width + 4, top: cy } : { right: width + 4, top: cy }}>
            <div className="truncate text-[13px] leading-[18px] font-semibold text-foreground">{p.caption || p.label || `Stop ${idx + 1}`}</div>
            {p.preview != null
              ? <div className="mt-[2px] line-clamp-2 text-[12px] leading-[16px] text-pretty text-muted-foreground">{p.preview}</div>
              : null}
          </div>
        : p && (p.preview != null)
        ? <div className={cn(bub, 'box-border max-w-[250px] min-w-[120px] rounded-[14px] px-[13px] py-[9px]')} style={bubPos}>
            {p.caption ? <div className="mb-[3px] text-[9.5px] font-extrabold tracking-[.6px] text-primary uppercase">{p.caption}</div> : null}
            <div className="line-clamp-3 text-[13px] leading-[1.35] font-[550] text-pretty text-foreground">{p.preview}</div>
          </div>
        : p ? <div className={cn(bub, 'grid size-[54px] place-items-center rounded-[27px] text-[25px] font-extrabold text-primary')} style={bubPos}>{p.label}</div> : null}
    </div>
  );
}

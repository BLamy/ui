'use client';
import type { CSSProperties, ReactNode } from 'react';
import { createParts, usePart, usePrimitive } from '@ui-sdk/react/primitive';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { indexBar, type IndexBarJumpReason, type IndexBarState } from '@/lib/index-bar-primitive';

export type { IndexBarJumpReason };

/* ══ IndexBar — generic jump rail ══
   Give it jump points of your own:
     <IndexBar items={[{key:'m4', label:'●', preview:'Why is the build slow?'}]} onJump={key => …}/>
   …or give it nothing but `avail` and it falls back to the UIKit A–Z form:
     <IndexBar avail={new Set(['A','B'])} onLetter={L => …}/>
   Hover peeks the stop under the cursor (no jump); a press or drag jumps. The rail is a listbox that keeps focus
   (the arrows, PageUp/PageDown, Home and End move through the stops and jump), built on lib/index-bar-primitive.
   variant="wave" draws one dash per stop that swells around the pointer like the macOS Dock, with a
   title + preview card beside the rail: <IndexBar variant="wave" side="left" value={current} items={…}/>
   Add `panel` and hovering the rail opens a card listing every stop instead (an outline: `panelTitle` on top,
   `level` indenting nested stops, the current one marked); picking a row jumps there like a dash does.
   A right-side rail publishes how far list rows run under it as --bl-index-bar-inset on its parent (the element
   it overlays), and ListRows under that parent widen their trailing inset by it, so chevrons and accessories
   stay clear of the letters. Opt out with insetContent={false}. */

export const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export type IndexBarKey = string | number;

export interface IndexBarItem<K extends IndexBarKey = IndexBarKey> {
  key?: K;
  label?: string;
  preview?: ReactNode;
  caption?: string | null;
  dim?: boolean;
  /** Nesting depth, 1 (default) and up: indents the stop in the wave's `panel` and shortens its dash. */
  level?: number;
  /** Wave preview card: something at the end of the title line (a bookmark glyph, a badge). */
  trailing?: ReactNode;
}

interface IBPoint<K extends IndexBarKey = IndexBarKey> { key: K; label: string; preview: ReactNode | null; caption: string | null; dim: boolean; level: number; trailing: ReactNode | null }

function ibPoints<K extends IndexBarKey>(items: Array<IndexBarItem<K> | K> | undefined, avail: Set<string> | undefined): Array<IBPoint<K | string>> {
  if (items && items.length) return items.map((it, i) => (it && typeof it === 'object')
    ? {
        key: it.key != null ? it.key : String(i), label: it.label != null ? String(it.label) : '',
        preview: it.preview != null ? it.preview : null, caption: it.caption || null, dim: !!it.dim, level: it.level ?? 1, trailing: it.trailing ?? null,
      }
    : { key: it, label: String(it), preview: null, caption: null, dim: false, level: 1, trailing: null });
  const av = avail || new Set<string>();
  return AL.map((L) => ({ key: L, label: L, preview: null, caption: null, dim: !av.has(L), level: 1, trailing: null }));
}

export const indexBarVariants = cva(
  'absolute z-80 flex cursor-pointer touch-none flex-col justify-center rounded-lg outline-offset-2 select-none',
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
  /** Each time the rail lands on another stop: a press or scrub (`drag`), a key (`list-navigation`), a click on a
   *  stop or a `panel` row (`item-press`), or the agent bridge (`imperative`). */
  onJump?: (key: K, point: IndexBarItem<K>, index: number, details: { reason: IndexBarJumpReason; event?: Event }) => void;
  onLetter?: (key: string, details: { reason: IndexBarJumpReason; event?: Event }) => void;
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
  /** `wave` only: hovering (or focusing) the rail opens a card listing every stop — an outline — in place of the
   * single-stop preview card. Rows jump like the dashes do. The rail stays the accessible path (arrow keys,
   * listbox); the card is a pointer convenience. */
  panel?: boolean;
  /** Heading of the `panel`, above its rows. */
  panelTitle?: ReactNode;
  /** `wave` preview card: lines of `preview` shown (default 2), and a wider card for more (`previewWidth`, px, default 260). */
  previewLines?: number;
  previewWidth?: number;
  /** Publish how far list rows run under the rail as `--bl-index-bar-inset` on the parent element so ListRows
   * beside it keep their trailing accessories clear of it (right side only). Default true. */
  insetContent?: boolean;
  className?: string;
  style?: CSSProperties;
}

const parts = createParts(indexBar, { root: 'div', track: 'div', option: 'div' });

export function IndexBar<K extends IndexBarKey = string>({
  items, avail, onJump, onLetter, top, bottom, width: widthProp, label = 'Jump to section',
  variant = 'default', side = 'right', value, panel = false, panelTitle, previewLines = 2, previewWidth = 260, insetContent = true, className, style,
}: IndexBarProps<K>) {
  const wave = variant === 'wave';
  const width = widthProp ?? (wave ? 40 : 22);
  const pts = ibPoints(items, avail);
  const jump = (i: number, details: { reason: IndexBarJumpReason; event?: Event }) => {
    const p = pts[i];
    if (!p) return;
    if (onJump) onJump(p.key as K, p as IndexBarItem<K>, i, details); else onLetter?.(String(p.key), details);
  };
  const handle = usePrimitive(indexBar, { count: pts.length, side, width, insetContent, onJump: jump });
  const len = (v: number | string | undefined) => (typeof v === 'number' ? v + 'px' : v);
  const curIdx = value != null ? pts.findIndex((q) => q.key === value) : -1;

  /** The stop being shown (a scrub's, else the one a mouse rests on, else the keyboard's) and its offset. */
  const view = (s: IndexBarState) => {
    const keyboardIndex = s.highlighted != null ? Number(s.highlighted) : -1;
    const idx = s.scrubbing ? s.scrub : s.peek >= 0 ? s.peek : s.focused ? keyboardIndex : -1;
    const p = idx >= 0 ? pts[idx] : null;
    const g = s.geometry;
    const cy = g && p ? (g.tTop - g.rTop) + (idx + 0.5) * (g.tH / pts.length) : 0;
    return { idx, p, cy };
  };

  const body = (s: IndexBarState) => {
    const { idx, p } = view(s);
    // Bubble floats beside the rail at the active stop; both come from measured geometry.
    const bub = cn(
      'pointer-events-none absolute [transform:translateY(-50%)] bg-card shadow-[0_8px_28px_--alpha(black/28%),0_0_0_1px_var(--border)] animate-[blBub_var(--duration-spring-snappy)_var(--ease-spring-bouncy)] transition-[top] duration-spring-snappy ease-spring-snappy motion-reduce:animate-none motion-reduce:transition-none',
      s.scrubbing ? 'opacity-100' : 'opacity-93',
    );
    // Bubble / card position beside the rail: its side comes from `side`, the offset from the measured stop.
    const bubPos = cn('top-(--ib-y)', side === 'left' ? 'left-[calc(var(--ib-w)+10px)]' : 'right-[calc(var(--ib-w)+10px)]');
    // The wave centres on the pointer while it's on the rail, else on the keyboard-active stop.
    const focal = s.pointer != null ? s.pointer : idx >= 0 ? idx + 0.5 : null;
    return (
      <>
        <parts.Track className={cn('flex w-full flex-col', !wave && 'items-center')}>
          {pts.map((q, i) => {
            const name = q.caption || q.label || `Stop ${i + 1}`;
            if (wave) {
              const full = idx === i || curIdx === i;
              const f = full ? 1 : focal == null ? 0 : swell(Math.abs(i + 0.5 - focal));
              const rest = q.level > 1 ? WAVE_REST - 3 : WAVE_REST;
              const dash = rest + (WAVE_PEAK - rest) * f;
              return (
                <parts.Option key={String(q.key) + i} value={String(i)} aria-label={name}
                  aria-current={curIdx === i ? 'true' : undefined}
                  className={cn('box-border flex h-[10px] w-full items-center px-2', side === 'left' ? 'justify-start' : 'justify-end')}>
                  <span style={{ '--len': `${dash}px`, '--f': f } as CSSProperties}
                    className={cn(
                      'h-[2px] w-(--len) shrink-0 rounded-full transition-[width,background-color] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
                      idx === i ? 'bg-foreground' : curIdx === i ? 'bg-primary'
                        : 'bg-[color:color-mix(in_oklab,var(--foreground)_calc(var(--f)*75%),var(--tertiary-foreground,color-mix(in_oklab,var(--muted-foreground)_60%,transparent)))]',
                      q.dim && idx !== i && 'opacity-55',
                    )} />
                </parts.Option>
              );
            }
            const hot = idx === i;
            return (
              <parts.Option key={String(q.key) + i} value={String(i)} aria-label={name}
                className={cn('flex h-[13.5px] w-full items-center justify-center transition-[scale] duration-spring-snappy ease-spring-bouncy motion-reduce:transition-none', hot && 'scale-150')}>
                {q.label
                  ? <span className={cn('text-[10.5px] leading-[13.5px] font-bold', q.dim ? 'text-tertiary-foreground' : 'text-primary')}>{q.label}</span>
                  : <span className={cn('rounded-full', hot ? 'size-1.5' : 'size-[5px]', q.dim ? 'bg-tertiary-foreground opacity-55' : 'bg-primary')} />}
              </parts.Option>
            );
          })}
        </parts.Track>
        {wave && panel
          ? (s.inside || s.focused) && (
            // A pointer convenience over the rail, which stays the accessible path. A transparent bridge (the padding)
            // keeps the pointer "inside" while it crosses from the rail to the card. The card is never taller than the
            // rail (the box the bar overlays), and scrolls inside that.
            <div data-slot="index-bar-panel" aria-hidden="true"
              className={cn('absolute top-1/2 flex max-h-full -translate-y-1/2 cursor-default flex-col', side === 'left' ? 'left-(--ib-w) pl-1' : 'right-(--ib-w) pr-1')}>
              <div className={cn(
                'bl-scroll box-border min-h-0 w-max max-w-[300px] min-w-[220px] overflow-y-auto rounded-card bg-card p-1.5',
                'shadow-[0_8px_28px_--alpha(black/28%),0_0_0_1px_var(--border)]',
                'animate-[blWaveCard_var(--duration-spring-snappy)_var(--ease-spring-snappy)] motion-reduce:animate-none',
                side === 'left' ? 'origin-left' : 'origin-right',
              )}>
                {panelTitle != null ? <div className="truncate px-3 pt-1.5 pb-1 text-footnote text-muted-foreground">{panelTitle}</div> : null}
                {pts.map((q, i) => (
                  <div key={String(q.key) + i}
                    onClick={(e) => handle.api.internal.press(i, e.nativeEvent)}
                    style={{ '--lvl': q.level - 1 } as CSSProperties}
                    className={cn(
                      'cursor-pointer truncate rounded-lg py-1.5 pr-3 pl-[calc(12px+var(--lvl)*12px)] text-footnote transition-colors duration-100 hover:bg-secondary',
                      curIdx === i ? 'bg-secondary text-foreground' : 'text-muted-foreground',
                      idx === i && 'bg-accent',
                    )}>
                    {q.caption || q.label || `Stop ${i + 1}`}
                  </div>
                ))}
              </div>
            </div>
          )
          : wave
          ? p && <div className={cn(
                'pointer-events-none absolute box-border w-max max-w-(--ib-card-w) min-w-[160px] -translate-y-1/2 rounded-card bg-card px-[13px] py-[9px]',
                'shadow-[0_8px_28px_--alpha(black/28%),0_0_0_1px_var(--border)] transition-[top] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
                'animate-[blWaveCard_var(--duration-spring-snappy)_var(--ease-spring-snappy)] motion-reduce:animate-none',
                side === 'left' ? 'origin-left left-[calc(var(--ib-w)+4px)]' : 'origin-right right-[calc(var(--ib-w)+4px)]', 'top-(--ib-y)',
              )}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 truncate text-footnote leading-[18px] font-semibold text-foreground">{p.caption || p.label || `Stop ${idx + 1}`}</div>
                {p.trailing}
              </div>
              {p.preview != null
                ? <div className="mt-[2px] line-clamp-(--ib-lines) text-caption leading-[16px] text-pretty text-muted-foreground">{p.preview}</div>
                : null}
            </div>
          : p && (p.preview != null)
          ? <div className={cn(bub, bubPos, 'box-border max-w-[250px] min-w-[120px] rounded-card px-[13px] py-[9px]')}>
              {p.caption ? <div className="mb-[3px] text-[9.5px] font-extrabold tracking-[.6px] text-primary uppercase">{p.caption}</div> : null}
              <div className="line-clamp-3 text-footnote leading-[1.35] font-[550] text-pretty text-foreground">{p.preview}</div>
            </div>
          : p ? <div className={cn(bub, bubPos, 'grid size-[54px] place-items-center rounded-[27px] text-[25px] font-extrabold text-primary')}>{p.label}</div> : null}
      </>
    );
  };

  return usePart(handle, 'root', {}, {
    'aria-label': label,
    'data-variant': variant,
    'data-side': side,
    className: cn(
      indexBarVariants({ variant, side }),
      '[outline:2px_solid_transparent] focus-visible:[outline:2px_solid_var(--primary)]',
      'w-(--ib-w)', top != null && 'top-(--ib-top)', bottom != null && 'bottom-(--ib-bottom)',
      className,
    ),
    // Rail geometry (props) and the active stop's measured offset, as variables.
    style: (s: IndexBarState) => ({
      '--ib-w': width + 'px', '--ib-y': view(s).cy + 'px', '--ib-lines': previewLines, '--ib-card-w': previewWidth + 'px',
      ...(top != null ? { '--ib-top': len(top) } : null), ...(bottom != null ? { '--ib-bottom': len(bottom) } : null),
      ...style,
    }) as CSSProperties,
    children: body,
  } as never);
}

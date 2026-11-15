'use client';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { usePart, usePrimitive, createParts } from '@ui-sdk/react/primitive';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { indexBar, type IndexBarJumpReason, type IndexBarState } from '@/lib/index-bar-primitive';
import { waveCard, waveDash, waveDashLength, waveDashTone, waveSwell } from '@/lib/wave-rail';

export type { IndexBarJumpReason };

/* ══ IndexBar — a jump rail for a long scroller ══
   The UIKit A–Z index, custom stops with previews, or a Dock-style `wave` of dashes:
     <IndexBar items={alphabetItems(lettersInUse)} onJump={(letter) => scrollTo(letter)} />
     <IndexBar variant="wave" side="start" current={turn} items={turns} onJump={(id) => scrollToTurn(id)} />
   Hover peeks the stop under the cursor (no jump); a press or drag jumps. The rail is a listbox that keeps focus (the
   arrows, PageUp/PageDown, Home and End move through the stops and jump), built on lib/index-bar-primitive.
   The wave (lib/wave-rail, shared with TraceTimeline's rail) draws one dash per stop that swells around the pointer
   like the macOS Dock, with a title + preview card beside the rail. Add `panel` and hovering the rail opens a card
   listing every stop instead (an outline: `panelTitle` on top, `level` indenting nested stops, the current one
   marked); picking a row jumps there like a dash does.
   The rail fills the height of the element it overlays (`top-0 bottom-0`; move it with classes, `top-14 bottom-2`). A
   rail on the end side publishes how far list rows run under it as --bl-index-bar-inset on its parent, and ListRows
   under that parent widen their trailing inset by it, so chevrons and accessories stay clear of the letters. Opt out
   with insetContent={false}. ══ */

export type IndexBarValue = string | number;

export interface IndexBarItem<K extends IndexBarValue = IndexBarValue> {
  /** The stop's identity, passed to `onJump` and matched by `current`. Default: its index, as a string. */
  value?: K;
  /** What the rail shows: a letter, or nothing for a dot (a dash in the wave). */
  label?: string;
  /** The stop's name: the card's title and the option's accessible name (default `label`, else "Stop n"). */
  caption?: string | null;
  /** The card's body under the caption (a message, a heading's first line). */
  preview?: ReactNode;
  /** Nothing to jump to here: drawn dim, still in the arrow order (a letter with no contacts). */
  disabled?: boolean;
  /** Nesting depth, 1 (default) and up: indents the stop in the wave's `panel` and shortens its dash. */
  level?: number;
  /** Wave preview card: something at the end of the title line (a bookmark glyph, a badge). */
  trailing?: ReactNode;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** The UIKit A–Z rail's items: every letter, with the ones not in `available` disabled (all enabled when omitted). */
export function alphabetItems(available?: Iterable<string>): IndexBarItem<string>[] {
  const set = available ? new Set(Array.from(available, (l) => l.toUpperCase())) : null;
  return ALPHABET.map((letter) => ({ value: letter, label: letter, disabled: set ? !set.has(letter) : false }));
}

interface Point<K extends IndexBarValue> {
  key: K | string; label: string; preview: ReactNode | null; caption: string | null; disabled: boolean; level: number;
  trailing: ReactNode | null; item: IndexBarItem<K>;
}

function points<K extends IndexBarValue>(items: ReadonlyArray<IndexBarItem<K> | K>): Point<K>[] {
  return items.map((it, i) => (it !== null && typeof it === 'object')
    ? {
        key: it.value ?? String(i), label: it.label ?? '', preview: it.preview ?? null, caption: it.caption || null,
        disabled: !!it.disabled, level: it.level ?? 1, trailing: it.trailing ?? null, item: it,
      }
    : { key: it, label: String(it), preview: null, caption: null, disabled: false, level: 1, trailing: null, item: { value: it, label: String(it) } });
}

export const indexBarVariants = cva(
  'absolute top-0 bottom-0 z-80 flex cursor-pointer touch-none flex-col justify-center rounded-lg outline-offset-2 select-none',
  {
    variants: {
      variant: { default: 'w-[22px] items-center', wave: 'w-10 items-stretch' },
      side: { end: 'end-0', start: 'start-0' },
    },
    defaultVariants: { variant: 'default', side: 'end' },
  },
);

export interface IndexBarJumpDetails<K extends IndexBarValue = string> {
  /** The stop's position on the rail. */
  index: number;
  /** The item as you passed it. */
  item: IndexBarItem<K>;
  /** A press or scrub (`drag`), a key (`list-navigation`), a click on a stop or a `panel` row (`item-press`), or the
   *  agent bridge (`imperative`). */
  reason: IndexBarJumpReason;
  event?: Event;
}

export type IndexBarProps<K extends IndexBarValue = string> = Omit<ComponentProps<'div'>, 'children'> & {
  /** The stops, top to bottom: items, or bare values (a letter, an id). For the A–Z rail, `alphabetItems(…)`. */
  items: ReadonlyArray<IndexBarItem<K> | K>;
  /** Each time the rail lands on another stop. */
  onJump?: (value: K, details: IndexBarJumpDetails<K>) => void;
  /** `default` renders letters or dots with a bubble; `wave` renders dashes that swell around the pointer. */
  variant?: 'default' | 'wave';
  /** Edge the rail sits on (`end` by default); the bubble or card appears on the inner side. */
  side?: 'start' | 'end';
  /** Value of the stop you are at (the turn in view, the section on screen): `aria-current`, and in the wave a full-length
   *  dash in the tint. */
  current?: K;
  /** `wave` only: hovering (or focusing) the rail opens a card listing every stop (an outline) in place of the
   *  single-stop preview card. Rows jump like the dashes do. The rail stays the accessible path (arrow keys,
   *  listbox); the card is a pointer convenience. */
  panel?: boolean;
  /** Heading of the `panel`, above its rows. */
  panelTitle?: ReactNode;
  /** `wave` preview card: lines of `preview` shown (default 2), and a wider card for more (`previewWidth`, px, default 260). */
  previewLines?: number;
  previewWidth?: number;
  /** Publish how far list rows run under the rail as `--bl-index-bar-inset` on the parent element so ListRows
   *  beside it keep their trailing accessories clear of it (`end` side only). Default true. */
  insetContent?: boolean;
};

const parts = createParts(indexBar, { root: 'div', track: 'div', option: 'div' });

/** The bubble and cards beside the rail, on the inner side, `gap` px off it. */
const beside = (side: 'start' | 'end', gap: 'near' | 'far') =>
  side === 'start'
    ? cn('start-full origin-left rtl:origin-right', gap === 'far' ? 'ms-2.5' : 'ms-1')
    : cn('end-full origin-right rtl:origin-left', gap === 'far' ? 'me-2.5' : 'me-1');

export function IndexBar<K extends IndexBarValue = string>({
  items, onJump, variant = 'default', side = 'end', current, panel = false, panelTitle, previewLines = 2, previewWidth = 260,
  insetContent = true, className, style, 'aria-label': ariaLabel = 'Jump to section', ...props
}: IndexBarProps<K>) {
  const wave = variant === 'wave';
  const pts = points(items);
  const jump = (index: number, { reason, event }: { reason: IndexBarJumpReason; event?: Event }) => {
    const p = pts[index];
    if (p) onJump?.(p.key as K, { index, item: p.item, reason, event });
  };
  const handle = usePrimitive(indexBar, { count: pts.length, side, insetContent, onJump: jump });
  const curIdx = current != null ? pts.findIndex((q) => q.key === current) : -1;

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
    // The bubble floats beside the rail at the active stop; its offset comes from measured geometry.
    const bub = cn(
      'pointer-events-none absolute top-(--ib-y) [transform:translateY(-50%)] bg-card shadow-popover animate-[blBub_var(--duration-spring-snappy)_var(--ease-spring-bouncy)] transition-[top] duration-spring-snappy ease-spring-snappy motion-reduce:animate-none motion-reduce:transition-none',
      s.scrubbing ? 'opacity-100' : 'opacity-93',
      beside(side, 'far'),
    );
    // The wave centres on the pointer while it's on the rail, else on the keyboard-active stop.
    const focal = s.pointer != null ? s.pointer : idx >= 0 ? idx + 0.5 : null;
    return (
      <>
        <parts.Track className={cn('flex w-full flex-col', !wave && 'items-center')}>
          {pts.map((q, i) => {
            const name = q.caption || q.label || `Stop ${i + 1}`;
            const common = {
              value: String(i),
              'aria-label': name,
              'aria-current': curIdx === i ? ('true' as const) : undefined,
              'aria-disabled': q.disabled || undefined,
              'data-disabled': q.disabled ? '' : undefined,
            };
            if (wave) {
              const hot = idx === i;
              const f = hot || curIdx === i ? 1 : focal == null ? 0 : waveSwell(i + 0.5 - focal);
              return (
                <parts.Option key={String(q.key) + i} {...common}
                  className={cn('box-border flex h-2.5 w-full items-center px-2', side === 'start' ? 'justify-start' : 'justify-end')}>
                  <span style={{ '--len': `${waveDashLength(f, q.level)}px`, '--f': f } as CSSProperties}
                    className={cn(waveDash, waveDashTone({ hot, current: curIdx === i }), q.disabled && !hot && 'opacity-55')} />
                </parts.Option>
              );
            }
            const hot = idx === i;
            return (
              <parts.Option key={String(q.key) + i} {...common}
                className={cn('flex h-[13.5px] w-full items-center justify-center transition-[scale] duration-spring-snappy ease-spring-bouncy motion-reduce:transition-none', hot && 'scale-150')}>
                {q.label
                  ? <span className={cn('text-caption2 leading-[13.5px] font-bold', q.disabled ? 'text-tertiary-foreground' : 'text-primary')}>{q.label}</span>
                  : <span className={cn('rounded-full', hot ? 'size-1.5' : 'size-[5px]', q.disabled ? 'bg-tertiary-foreground opacity-55' : 'bg-primary')} />}
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
              className={cn('absolute top-1/2 flex max-h-full -translate-y-1/2 cursor-default flex-col', side === 'start' ? 'start-full ps-1' : 'end-full pe-1')}>
              <div className={cn(
                'bl-scroll box-border min-h-0 w-max max-w-[300px] min-w-[220px] overflow-y-auto p-1.5',
                waveCard,
                side === 'start' ? 'origin-left rtl:origin-right' : 'origin-right rtl:origin-left',
              )}>
                {panelTitle != null ? <div className="truncate px-3 pt-1.5 pb-1 text-footnote text-muted-foreground">{panelTitle}</div> : null}
                {pts.map((q, i) => (
                  <div key={String(q.key) + i}
                    onClick={(e) => handle.api.internal.press(i, e.nativeEvent)}
                    style={{ '--lvl': q.level - 1 } as CSSProperties}
                    className={cn(
                      'cursor-pointer truncate rounded-lg py-1.5 pe-3 ps-[calc(12px+var(--lvl)*12px)] text-footnote transition-colors duration-100 hover:bg-secondary',
                      curIdx === i ? 'bg-secondary text-foreground' : 'text-muted-foreground',
                      idx === i && 'bg-accent',
                      q.disabled && 'opacity-55',
                    )}>
                    {q.caption || q.label || `Stop ${i + 1}`}
                  </div>
                ))}
              </div>
            </div>
          )
          : wave
          ? p && <div className={cn(
                'pointer-events-none absolute top-(--ib-y) box-border w-max max-w-(--ib-card-w) min-w-40 -translate-y-1/2 px-[13px] py-[9px]',
                waveCard, 'transition-[top] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
                beside(side, 'near'),
              )}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 truncate text-footnote leading-[18px] font-semibold text-foreground">{p.caption || p.label || `Stop ${idx + 1}`}</div>
                {p.trailing}
              </div>
              {p.preview != null
                ? <div className="mt-0.5 line-clamp-(--ib-lines) text-caption leading-4 text-pretty text-muted-foreground">{p.preview}</div>
                : null}
            </div>
          : p && (p.preview != null)
          ? <div className={cn(bub, 'box-border max-w-[250px] min-w-30 rounded-card px-[13px] py-[9px]')}>
              {p.caption ? <div className="mb-[3px] text-caption2 font-extrabold tracking-[.6px] text-primary uppercase">{p.caption}</div> : null}
              <div className="line-clamp-3 text-footnote leading-[1.35] font-[550] text-pretty text-foreground">{p.preview}</div>
            </div>
          : p ? <div className={cn(bub, 'grid size-[54px] place-items-center rounded-full text-[25px] font-extrabold text-primary')}>{p.label}</div> : null}
      </>
    );
  };

  return usePart(handle, 'root', {}, {
    ...props,
    'aria-label': ariaLabel,
    'data-variant': variant,
    'data-side': side,
    className: cn(
      indexBarVariants({ variant, side }),
      '[outline:2px_solid_transparent] focus-visible:[outline:2px_solid_var(--primary)]',
      className,
    ),
    // The active stop's measured offset and the card's size, as variables.
    style: (s: IndexBarState) => ({
      '--ib-y': view(s).cy + 'px', '--ib-lines': previewLines, '--ib-card-w': previewWidth + 'px',
      ...style,
    }) as CSSProperties,
    children: body,
  } as never);
}

'use client';
import { useRef, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { useEnterExit, usePresenceList, type PresenceEntry } from '@/lib/presence';
import { cn } from '@/lib/utils';

/* ══ Swap — content that changes in place instead of cutting ══
   When `value` changes, the old content leaves and the new one arrives. Two effects:
   - `slide` (the default): the views travel in the `direction` of the change (forward → from the right), blurred
     through the middle; with `direction={0}` they cross-fade with a small scale. Family's tray step:
     `<AnimatedHeight><Swap value={step} direction={dir}>`. A dialog title morphing between views is the same
     effect with a shorter `distance` and a stronger `blur`.
   - `pop`: the old content shrinks and blurs out while the new one grows in on the bouncy spring. For glyphs:
     copy → check, play → pause.
   Layout: a block swap (`<div>`) lifts the leaving view out of the flow, so the arriving one takes its place and
   an `AnimatedHeight` around it follows the new height at once. An `inline` swap (`<span>`, the default for
   `pop`) stacks both in one grid cell, so nothing around it moves.
   The views come and go with UI SDK's presence (`data-starting-style` / `data-ending-style`); the motion is CSS on
   the kit's tokens, and every distance is a variable on the root (`--swap-enter`, `--swap-exit`, `--swap-scale`,
   `--swap-blur`). Reduced motion keeps only a short fade. While a view leaves it is `aria-hidden` and `inert`: only
   the arriving content is announced and focusable. */

export type SwapEffect = 'slide' | 'pop';

export interface SwapProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Identity of the current content: changing it swaps. */
  value: string | number;
  /** `slide` travels in `direction` (default); `pop` scales the old content out and the new one in. */
  effect?: SwapEffect;
  /** Stack the views in one inline grid cell (a `<span>`) instead of a block (a `<div>`). Default: `true` for `pop`. */
  inline?: boolean;
  /** `slide` only. -1 back / 1 forward slides horizontally; 0 swaps in place with a small scale. See `useDirection`. */
  direction?: -1 | 0 | 1;
  /** `slide` only. Travel distance in px for a directional swap (default 36). */
  distance?: number;
  /** Blur in px at the middle of the swap (default 4). */
  blur?: number;
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

const reduced = cn(
  'motion-reduce:[transition:opacity_120ms] motion-reduce:data-ending-style:[transition:opacity_100ms]',
  'motion-reduce:data-starting-style:translate-x-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none',
  'motion-reduce:data-ending-style:translate-x-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-ending-style:blur-none',
);

/* Both effects: opacity and blur on the entry fade, the exit fade when leaving. The start and end frames read the
   root's variables, so the direction a view leaves in is the one of the change that replaced it.
   slide: travel and scale on the smooth spring, both ways. pop: scale on the bouncy spring in, the snappy one out. */
const viewClass = {
  slide: cn(
    '[transition:opacity_var(--duration-enter)_var(--ease-enter),filter_var(--duration-enter)_var(--ease-enter),translate_var(--duration-spring-smooth)_var(--ease-spring-smooth),scale_var(--duration-spring-smooth)_var(--ease-spring-smooth)]',
    'data-ending-style:[transition:opacity_var(--duration-exit)_var(--ease-exit),filter_var(--duration-exit)_var(--ease-exit),translate_var(--duration-spring-smooth)_var(--ease-spring-smooth),scale_var(--duration-spring-smooth)_var(--ease-spring-smooth)]',
    'data-starting-style:translate-x-(--swap-enter) data-ending-style:translate-x-(--swap-exit)',
  ),
  pop: cn(
    '[transition:opacity_var(--duration-enter)_var(--ease-enter),filter_var(--duration-enter)_var(--ease-enter),scale_var(--duration-spring-bouncy)_var(--ease-spring-bouncy)]',
    'data-ending-style:[transition:opacity_var(--duration-exit)_var(--ease-exit),filter_var(--duration-exit)_var(--ease-exit),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)]',
  ),
};
const frames = cn(
  'data-starting-style:opacity-0 data-starting-style:blur-(--swap-blur) data-starting-style:scale-(--swap-scale)',
  'data-ending-style:opacity-0 data-ending-style:blur-(--swap-blur) data-ending-style:scale-(--swap-scale)',
);
const layout = {
  // The leaving view is lifted out of the flow at the top, so the arriving one takes its place at once.
  block: 'w-full data-ending-style:absolute data-ending-style:inset-x-0 data-ending-style:top-0',
  inline: 'relative grid place-items-center',
};

type Item = { id: string; node: ReactNode };

function View({ entry, inline, className }: { entry: PresenceEntry<Item>; inline: boolean; className: string }) {
  const ref = useRef<HTMLElement>(null);
  useEnterExit(ref, entry.present, { appear: entry.appear, exited: entry.exited });
  const Tag = inline ? 'span' : 'div';
  return (
    <Tag
      ref={ref as Ref<HTMLDivElement & HTMLSpanElement>}
      data-slot="swap-view"
      // The leaving view is only a picture of what was there: out of the accessibility tree (a dialog's name is the
      // arriving title alone) and out of the tab order (its controls can't be reached while it fades).
      aria-hidden={entry.present ? undefined : true}
      inert={!entry.present}
      className={className}
    >
      {entry.item.node}
    </Tag>
  );
}

export function Swap({
  value,
  effect = 'slide',
  inline = effect === 'pop',
  direction = 0,
  distance = 36,
  blur = 4,
  children,
  className,
  style,
  ref,
  ...props
}: SwapProps) {
  const views = usePresenceList<Item>([{ id: String(value), node: children }], (v) => v.id);
  const travel = effect === 'slide' ? direction * distance : 0;
  const vars = {
    '--swap-enter': `${travel}px`,
    '--swap-exit': `${-travel}px`,
    '--swap-scale': effect === 'pop' ? 0.4 : direction ? 1 : 0.96,
    '--swap-blur': `${blur}px`,
  } as CSSProperties;
  const viewClassName = cn(viewClass[effect], frames, inline ? layout.inline : layout.block, reduced);
  const Tag = inline ? 'span' : 'div';
  return (
    <Tag
      {...props}
      ref={ref as Ref<HTMLDivElement & HTMLSpanElement>}
      data-slot="swap"
      data-effect={effect}
      data-direction={effect === 'slide' ? direction : undefined}
      className={cn(inline ? 'inline-grid *:[grid-area:1/1]' : 'relative', className)}
      style={{ ...vars, ...style }}
    >
      {views.map((entry) => (
        <View key={entry.key} entry={entry} inline={inline} className={viewClassName} />
      ))}
    </Tag>
  );
}

'use client';
import {
  Children, createContext, isValidElement, use, useId, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactElement, type ReactNode, type Ref,
} from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { createParts } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { PlainButton, type PlainButtonProps } from '@/components/ui/plain-button';
import { Icon, IC } from '@/lib/icon';
import { springs } from '@/lib/motion';
import { usePresenceList } from '@/lib/presence';
import { chromeOffset, BLStickyCtx, useChromeHidden } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { RowLabelContext } from '@/lib/row-label';
import {
  listRow, listSection,
  type ListRowAction as ListRowActionOf, type ListRowController, type ListRowFullSwipe, type ListSectionOrderChangeDetails,
} from '@/lib/list-primitive';

export { createListRowController } from '@/lib/list-primitive';
export type {
  ListRowActionDetails, ListRowActionReason, ListRowController, ListRowFullSwipe,
  ListSectionOrderChangeDetails, ListSectionOrderChangeReason,
} from '@/lib/list-primitive';

/* ══ List — iOS table views: List, List.Section, List.Row ══
   A list works out its own sticky offset: whatever chrome sits above it (nav bar, none, …) plus its own
   header if it has one. `stickyTop` overrides both. A section is a `list` of its rows; a row is a press target
   (`onClick`), a container for controls, or both, with swipe actions, an edit-mode gutter and a hover preview.
   Behavior lives in lib/list-primitive.ts; a list whose rows are chosen from (one or many) is a Listbox. */

/** A swipe action. In `leadingActions` / `trailingActions`, index 0 is the outermost button (nearest the screen
 *  edge): the one a full swipe runs. */
export type ListRowAction = ListRowActionOf<string | ReactNode>;

const RowParts = createParts(listRow, {
  root: 'div', content: 'div', leading: 'span', body: 'div', control: 'div', actions: 'div', action: 'button',
});
const SectionParts = createParts(listSection, { root: 'div', rows: 'div', item: 'div', handle: 'button' });

export interface ListProps {
  children?: ReactNode;
  inset?: boolean;
  header?: ReactNode;
  stickyTop?: number;
  className?: string;
  style?: CSSProperties;
}

function ListBase({ children, inset, header, stickyTop, className, style }: ListProps) {
  const hRef = useRef<HTMLDivElement | null>(null);
  const [hh, setHh] = useState(0);
  const above = use(BLStickyCtx);
  const chromeHid = useChromeHidden();
  useLayoutEffect(() => {
    const el = hRef.current;
    if (!el) { setHh(0); return; }
    const m = () => setHh(el.offsetHeight); m();
    if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect(); }
    return undefined;
  }, [header]);
  const top = stickyTop != null ? stickyTop : above + (header ? hh : 0);
  return (
    <BLStickyCtx.Provider value={top}>
      <div data-slot="list" className={cn(inset ? 'px-4 py-0' : 'p-0', className)} style={style}>
        {header ? (
          <div ref={hRef} className="sticky top-(--list-header-top) z-24 bg-sticky backdrop-blur-[10px] transition-[top] duration-spring-smooth ease-spring-smooth"
            style={{ '--list-header-top': chromeOffset(above, chromeHid) + 'px' } as CSSProperties}>{header}</div>
        ) : null}
        {children}
      </div>
    </BLStickyCtx.Provider>
  );
}

/* ── Section ── */

/** What a section tells each row it holds: its place, and whether it has a grip. */
interface RowSlot { value: string; index: number; count: number; reorderable: boolean }
const RowSlotCtx = createContext<RowSlot | null>(null);

export interface ListSectionProps {
  title?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  sticky?: boolean;
  ref?: Ref<HTMLDivElement>;
  stickyTop?: number;
  /** Rows spring in on insert, collapse out on remove, and slide to their new place on reorder. Children must
   *  be keyed. Implied by `onOrderChange`. */
  animate?: boolean;
  /** Reordering: every row shows a grip (drag it, or focus it, press Space, move it with ↑/↓ and press Space to
   *  drop). Called once per drop with the rows' keys in their new order, and `details.from` / `details.to`, the
   *  moved row's old and new index; reorder your data to match. Pass it only while reordering is allowed (say,
   *  in edit mode). */
  onOrderChange?: (order: string[], details: ListSectionOrderChangeDetails) => void;
  className?: string;
  style?: CSSProperties;
}

/** The key a row was given, without the prefix `Children.toArray` adds. */
const ownKey = (key: string) => key.replace(/^\.\$/, '');
const keyOf = (c: ReactElement) => String(c.key);
const labelOf = (c: ReactElement) => {
  const t = (c.props as { title?: unknown }).title;
  return typeof t === 'string' ? t : undefined;
};

export function ListSection({
  title, footer, children, sticky, ref, stickyTop, animate: anim, onOrderChange, className, style,
}: ListSectionProps) {
  const ctxTop = use(BLStickyCtx);
  const top = chromeOffset(stickyTop != null ? stickyTop : ctxTop, useChromeHidden());
  const animated = !!(anim || onOrderChange);
  const items = Children.toArray(children).filter(isValidElement) as ReactElement[];
  // Rows that left keep rendering where they were (from their last element) until they have collapsed.
  const entries = usePresenceList(items, keyOf);
  const present = new Map(entries.filter((e) => e.present).map((e) => [e.key, e]));
  const leaving = animated ? entries.filter((e) => !e.present) : [];
  // A section that doesn't animate lets removed rows go at once.
  useLayoutEffect(() => {
    if (!animated) entries.forEach((e) => { if (!e.present) e.exited(); });
  });
  const exited = (key: string) => entries.find((e) => e.key === key && !e.present)?.exited();

  return (
    <SectionParts.Root ref={ref} className={cn(className)} style={style}
      order={[...present.keys()]} reorderable={!!onOrderChange} leaving={leaving.map((e) => e.key)} onExited={exited}
      onOrderChange={onOrderChange ? (order, details) => onOrderChange(order.map(ownKey), details) : undefined}>
      {({ order }) => {
        // While a row moves, the draft's order shows; the rows collapsing out keep their place.
        const moved = order.map((k) => present.get(k)).filter((e) => e != null);
        let next = 0;
        const rows = animated ? entries.map((e) => (e.present ? (moved[next++] ?? e) : e)) : moved;
        return (
          <>
            {title != null ? (sticky
              ? <div className="sticky top-(--list-section-top) z-20 bg-sticky px-4 py-[3px] text-[13.5px] font-semibold text-foreground backdrop-blur-[10px] transition-[top] duration-spring-smooth ease-spring-smooth"
                  style={{ '--list-section-top': top + 'px' } as CSSProperties}>{title}</div>
              : <div className="px-4 pt-1 pb-[7px] text-[12.5px] font-medium tracking-[.4px] text-muted-foreground uppercase">{title}</div>) : null}
            <SectionParts.Rows className={cn('overflow-hidden', sticky ? 'rounded-none' : 'rounded-panel')}>
              <MotionConfig reducedMotion="user">
                {rows.map((e, i) => (
                  <SectionItem key={e.key} value={e.key} label={labelOf(e.item)} animated={animated}
                    entering={e.present && e.appear} slot={{ value: e.key, index: i, count: rows.length, reorderable: !!onOrderChange }}>
                    {e.item}
                  </SectionItem>
                ))}
              </MotionConfig>
            </SectionParts.Rows>
            {footer ? <div className="px-4 pt-[7px] pb-0 text-[12.8px] leading-[1.45] text-muted-foreground">{footer}</div> : null}
            <div className={sticky ? 'h-0' : 'h-[22px]'} />
          </>
        );
      }}
    </SectionParts.Root>
  );
}

function SectionItem({ value, label, animated, entering, slot, children }: {
  value: string; label?: string; animated: boolean; entering: boolean; slot: RowSlot; children: ReactNode;
}) {
  if (!animated) {
    return <SectionParts.Item value={value} label={label}><RowSlotCtx value={slot}>{children}</RowSlotCtx></SectionParts.Item>;
  }
  return (
    <SectionParts.Item value={value} label={label} entering={entering}
      className={cn(
        // Insert grows from nothing, remove collapses to nothing (UI SDK's starting / ending styles on the item).
        'relative grid grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity,scale,box-shadow] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
        'data-starting-style:grid-rows-[0fr] data-starting-style:opacity-0 data-ending-style:grid-rows-[0fr] data-ending-style:opacity-0',
        // The picked-up row lifts above its neighbours and follows the pointer (`--drag-x` / `--drag-y`, from UI SDK).
        'shadow-[0_8px_24px_black] shadow-transparent data-grabbed:z-5 data-grabbed:scale-[1.02] data-grabbed:shadow-black/18',
        'data-dragging:translate-x-(--drag-x) data-dragging:translate-y-(--drag-y) data-dragging:transition-[scale,box-shadow]',
      )}>
      {({ grabbed }) => (
        // Neighbours slide to their new place on reorder: a visual layout morph only.
        <motion.div layout={grabbed ? false : 'position'} transition={springs.smooth} className="min-h-0 overflow-hidden">
          <RowSlotCtx value={slot}>{children}</RowSlotCtx>
        </motion.div>
      )}
    </SectionParts.Item>
  );
}

/* ── Row ── */

/** The row surface (`list-row-content`): layout, selection wash, destructive text, and where the leading slot sits. */
export const listRowVariants = cva(
  [
    // Type metrics a <button> would reset, so a host's body line-height or tracking doesn't reach the row.
    'relative z-1 box-border flex min-h-row w-full touch-pan-y items-center gap-3 py-0 pl-4 text-left text-body leading-[normal] tracking-[normal] outline-none',
    'focus-visible:[box-shadow:inset_0_0_0_2px_var(--primary)]',
    // Trailing inset clears an IndexBar overlaying the list (it publishes --bl-index-bar-inset on its parent).
    'pr-[max(16px,calc(var(--bl-index-bar-inset,0px)+6px))]',
    // The swipe offset (`--swipe-x`, from UI SDK) moves the surface; it springs back unless a finger holds it.
    'translate-x-(--swipe-x) transition-[translate] duration-spring-snappy ease-spring-snappy group-data-swiping/row:transition-none motion-reduce:transition-none',
  ],
  {
    variants: {
      /** `center` (default): the leading slot is centered on the row. `top`: it sits on the first line of a
       *  multi-line row (a checkbox beside a wrapping title, an avatar beside a message preview). */
      align: { center: '', top: '[&>[data-slot=list-row-leading]]:self-start [&>[data-slot=list-row-leading]]:pt-[7px]' },
      selected: { true: 'bg-accent', false: 'bg-card' },
      destructive: { true: 'text-destructive', false: 'text-foreground' },
      interactive: { true: 'cursor-pointer', false: 'cursor-default' },
    },
    defaultVariants: { align: 'center', selected: false, destructive: false, interactive: false },
  },
);

export interface ListRowProps extends Pick<VariantProps<typeof listRowVariants>, 'align'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  /** Display content before the accessory (a value, a badge). Controls placed here work too. */
  trailing?: ReactNode;
  /** `chevron` / `check`, or a control (Switch, Slider, Button). A control makes the row a plain container. */
  accessory?: 'chevron' | 'check' | ReactNode;
  checked?: boolean;
  selected?: boolean;
  /** When defined (true/false), the row is in edit mode and reserves/animates the checkmark gutter. */
  edit?: boolean;
  /** Makes the row a button. Without it the row is a plain container. */
  onClick?: PlainButtonProps['onClick'];
  /** Shorthand for a destructive trailing "Delete" action (kept outermost). */
  onDelete?: () => void;
  /** Revealed by swiping right (or → from the keyboard). */
  leadingActions?: ListRowAction[];
  /** Revealed by swiping left (or ← from the keyboard). */
  trailingActions?: ListRowAction[];
  /** A long swipe runs the outermost action. Default `true` (both sides). */
  fullSwipe?: ListRowFullSwipe;
  /** Without `onClick`, pressing the row toggles the switch/checkbox inside it. Default true. */
  labelToggles?: boolean;
  divider?: boolean;
  center?: boolean;
  destructive?: boolean;
  /** Return true to ignore swipe starts near an edge (e.g. under a back-gesture zone). */
  isEdge?: (clientX: number) => boolean;
  /** Opens or closes the swipe actions from outside (`createListRowController()`). */
  controller?: ListRowController;
  /** Content that spans the row instead of the title (a slider between two icons, a segmented control). It is a
   *  live control area: presses reach it and swipes don't start on it. */
  children?: ReactNode;
  /** A HoverCard's content about what the row stands for (a person, a file): beside the row while the pointer rests
   *  on it or keyboard focus is in it. Touch never shows it, so it previews what pressing the row opens. */
  preview?: ReactNode;
  /** Classes for the row surface (`list-row-content`: padding, gap, min height, background). `className` goes on
   *  the outer wrapper, which also holds the swipe actions. */
  contentClassName?: string;
  className?: string;
  style?: CSSProperties;
}

const actionW = (a: ListRowAction) => (a.icon ? 74 : 88);

function ActionIcon({ icon }: { icon: ListRowAction['icon'] }) {
  if (typeof icon === 'string') return IC[icon] ? <Icon name={icon} size={20} sw={2.2} /> : null;
  return <>{icon}</>;
}

/** One side's actions: measured at their full width (where the row stops when open), drawn as a strip that grows
 *  with the swipe; a full swipe hands the whole strip to the outermost action. */
function RowActions({ side, actions }: { side: 'start' | 'end'; actions: ListRowAction[] }) {
  // DOM order follows the screen (left → right), so Tab walks the buttons as they appear.
  const shown = actions.map((a, i) => ({ a, i }));
  if (side === 'end') shown.reverse();
  return (
    <RowParts.Actions value={side}
      className={cn('absolute inset-y-0 w-(--list-row-actions-w)', side === 'start' ? 'left-0' : 'right-0')}
      style={{ '--list-row-actions-w': actions.reduce((w, a) => w + actionW(a), 0) + 'px' } as CSSProperties}>
      <div className={cn(
        'absolute inset-y-0 flex w-(--list-row-reveal) overflow-hidden transition-[width] duration-spring-snappy ease-spring-snappy group-data-swiping/row:transition-none motion-reduce:transition-none',
        side === 'start' ? 'left-0' : 'right-0',
      )}>
        {shown.map(({ a, i }) => (
          <RowParts.Action key={a.label + i} value={`${side}-${i}`} side={side} index={i} aria-label={a.label}
            className={cn(
              'bl-btn relative flex min-w-0 shrink basis-0 cursor-pointer overflow-hidden border-0 p-0 [font-family:inherit] text-white outline-none focus-visible:[box-shadow:inset_0_0_0_2px_white]',
              'grow-(--action-grow) bg-(--action-bg) transition-[flex-grow] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
              i !== 0 && 'group-data-full/row:grow-0',
              side === 'start' ? 'justify-end' : 'justify-start',
            )}
            // The action's color and its share of the strip are per-action values.
            style={{
              '--action-bg': a.tint || (a.destructive ? 'var(--destructive)' : 'var(--primary)'),
              '--action-grow': actionW(a),
              '--action-w': actionW(a) + 'px',
            } as CSSProperties}>
            {/* Content keeps its slot width, pinned to the row's edge, so it slides out from under the row. */}
            <span className="flex h-full w-(--action-w) shrink-0 flex-col items-center justify-center gap-[3px] px-2">
              {a.icon ? <ActionIcon icon={a.icon} /> : null}
              <span className={cn('truncate font-semibold', a.icon ? 'text-caption' : 'text-subhead')}>{a.label}</span>
            </span>
          </RowParts.Action>
        ))}
      </div>
    </RowParts.Actions>
  );
}

function Grip({ title, value, index, count }: { title: ReactNode; value: string; index: number; count: number }) {
  const id = useId();
  return (
    <SectionParts.Handle value={value} aria-label={`Reorder ${typeof title === 'string' ? title : 'row'}`} aria-describedby={id}
      className="bl-btn pointer-events-auto -mr-2 grid h-[44px] w-[40px] shrink-0 cursor-grab touch-none place-items-center rounded-lg border-0 bg-transparent p-0 text-tertiary-foreground outline-none select-none focus-visible:[box-shadow:inset_0_0_0_2px_var(--primary)] data-grabbed:cursor-grabbing">
      <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
        <path d="M2 2h16M2 7h16M2 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span id={id} className="sr-only">Drag, or press Space and then the up and down arrows, to move. Position {index + 1} of {count}.</span>
    </SectionParts.Handle>
  );
}

export function ListRow(p: ListRowProps) {
  const slot = use(RowSlotCtx);
  const id = useId();
  const titleId = id + '-t', subId = id + '-s', hintId = id + '-h';

  const trailing: ListRowAction[] = [
    ...(p.onDelete ? [{ label: 'Delete', destructive: true, onAction: () => p.onDelete?.() }] : []),
    ...(p.trailingActions || []),
  ];
  const leading = p.leadingActions || [];
  const inEdit = p.edit !== undefined && p.edit !== null;
  const swipeable = !p.edit && (leading.length > 0 || trailing.length > 0);
  const control = p.accessory != null && p.accessory !== 'chevron' && p.accessory !== 'check' ? p.accessory : null;
  const pressable = !!p.onClick;
  /** Full-width content replaces the title. */
  const fullWidth = p.children != null && p.children !== false;
  const hasTitle = !fullWidth && p.title != null;
  const allActs = [...leading, ...trailing];
  const group = !pressable && swipeable;
  const hint = swipeable
    ? `Actions: ${allActs.map((a) => a.label).join(', ')}. ${[trailing.length && 'Left arrow', leading.length && 'right arrow'].filter(Boolean).join(' or ')} to reveal.`
    : null;
  const current = p.selected || (p.accessory === 'check' && p.checked) ? 'true' : undefined;

  const body = (
    <>
      {swipeable && leading.length ? <RowActions side="start" actions={leading} /> : null}
      {swipeable && trailing.length ? <RowActions side="end" actions={trailing} /> : null}
      <RowParts.Content
        aria-labelledby={group ? titleId : undefined}
        aria-describedby={group && hint ? hintId : undefined}
        aria-keyshortcuts={group && hint ? 'ArrowLeft ArrowRight Delete' : undefined}
        aria-current={group ? current : undefined}
        className={cn(
          listRowVariants({
            align: p.align, selected: !!p.selected, destructive: !!p.destructive,
            interactive: pressable || swipeable || (!!control && p.labelToggles !== false),
          }),
          p.contentClassName,
        )}>
        {pressable ? (
          // The press target spans the row beneath its content, so controls in the row are siblings of the button,
          // never nested inside it. Its name is the row's title and subtitle.
          <PlainButton data-list-row-focus="" data-list-row-press="" data-tkrow=""
            aria-current={current}
            aria-labelledby={p.subtitle ? `${titleId} ${subId}` : titleId}
            aria-describedby={hint ? hintId : undefined}
            aria-keyshortcuts={hint ? 'ArrowLeft ArrowRight Delete' : undefined}
            onClick={p.onClick}
            className="bl-btn bl-hl absolute inset-0 cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:[box-shadow:inset_0_0_0_2px_var(--primary)]" />
        ) : null}
        {inEdit ? (
          <span aria-hidden="true" className={cn(
            'pointer-events-none relative flex shrink-0 items-center overflow-hidden transition-[width,opacity,margin-right] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
            p.edit ? 'mr-0 w-[30px] opacity-100' : '-mr-3 w-0 opacity-0',
          )}>
            <span className={cn(
              'box-border grid size-[22px] shrink-0 place-items-center rounded-[50%] transition-[background-color,scale] duration-spring-snappy ease-spring-bouncy',
              p.checked ? 'border-none bg-primary' : '[border:1.6px_solid_var(--tertiary-foreground,color-mix(in_oklab,var(--muted-foreground)_60%,transparent))] bg-transparent',
            )}>
              {p.checked ? <Icon name="check" size={13} sw={3} className="text-primary-foreground transition-[scale,opacity] duration-spring-snappy ease-spring-bouncy starting:scale-50 starting:opacity-0" /> : null}
            </span>
          </span>
        ) : null}
        {p.leading ? <RowParts.Leading className="pointer-events-none relative flex shrink-0 items-center">{p.leading}</RowParts.Leading> : null}
        <RowParts.Body className={cn(
          'pointer-events-none relative flex min-h-row min-w-0 flex-1 items-center gap-2.5 px-0',
          fullWidth ? 'py-3' : 'py-[7px]',
          p.divider !== false && '[box-shadow:inset_0_-1px_0_var(--border)]',
          p.center ? 'justify-center' : 'justify-start',
        )}>
          {/* Switches and sliders anywhere in the row (even wrapped in the caller's own component) are named by the title. */}
          <RowLabelContext value={hasTitle ? titleId : undefined}>
            {fullWidth ? (
              <RowParts.Control data-row-control="" className="pointer-events-auto min-w-0 flex-1">{p.children}</RowParts.Control>
            ) : (
              <div className={cn('min-w-0', p.center ? 'flex-none' : 'flex-1')}>
                <div id={titleId} className="truncate leading-[1.3]">{p.title}</div>
                {p.subtitle ? <div id={subId} className="mt-px truncate text-footnote text-muted-foreground">{p.subtitle}</div> : null}
              </div>
            )}
            {p.trailing ? (
              <span data-row-control="" className="flex shrink-0 items-center">{p.trailing}</span>
            ) : null}
            {p.accessory === 'chevron' ? <Icon name="chev" size={15} sw={2.6} className="text-tertiary-foreground" />
              : p.accessory === 'check' ? <span className="w-[22px] shrink-0">{p.checked ? <Icon name="check" size={20} sw={2.4} className="text-primary" /> : null}</span>
              : control ? <RowParts.Control data-row-control="" className="pointer-events-auto flex min-w-0 shrink-0 items-center">{control}</RowParts.Control>
              : null}
          </RowLabelContext>
          {slot?.reorderable ? <Grip title={p.title} value={slot.value} index={slot.index} count={slot.count} /> : null}
        </RowParts.Body>
        {hint ? <span id={hintId} className="sr-only">{hint}</span> : null}
      </RowParts.Content>
    </>
  );

  const root = (
    <RowParts.Root
      leadingActions={leading} trailingActions={trailing} fullSwipe={p.fullSwipe} edit={!!p.edit}
      labelToggles={p.labelToggles} isEdge={p.isEdge} group={group} controller={p.controller}
      className={cn(
        'group/row relative overflow-hidden opacity-100 outline-none transition-[height,opacity] duration-spring-tray ease-spring-tray motion-reduce:transition-none',
        // Removal (its exit) collapses from the measured height to 0 on the tray spring.
        'data-removing:h-(--list-row-h) data-ending-style:h-0 data-ending-style:opacity-0',
        p.className,
      )}
      style={p.style} />
  );
  if (p.preview == null) return <RowParts.Root {...root.props}>{body}</RowParts.Root>;
  return (
    <HoverCard>
      <HoverCardTrigger render={root}>{body}</HoverCardTrigger>
      <HoverCardContent side="right" align="start">{p.preview}</HoverCardContent>
    </HoverCard>
  );
}

/** Compound list API: `List`, `List.Section`, `List.Row` (also exported flat as ListSection / ListRow). */
export const List = Object.assign(ListBase, { Section: ListSection, Row: ListRow });

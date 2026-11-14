'use client';
import {
  Children, createContext, Fragment, isValidElement, use, useId, useLayoutEffect, useRef, useState,
  type ComponentProps, type CSSProperties, type ReactElement, type ReactNode,
} from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { createParts } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { checkboxVariants } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Icon, IC } from '@/lib/icon';
import { springs } from '@/lib/motion';
import { usePresenceList } from '@/lib/presence';
import { sectionLabelVariants } from '@/lib/primitives';
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

/* ══ List — iOS table views: List, ListSection, ListRow ══
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

/** The list itself: `plain` rows run edge to edge (Contacts, Mail); `inset` floats each section as a rounded card
 *  with a margin (Settings, iOS's inset-grouped style). */
// Rows are card-filled in both looks, so an Avatar's ring (its gap in an AvatarGroup, its presence dot) is the card's.
export const listVariants = cva('[--avatar-ring:var(--card)]', {
  variants: {
    variant: { plain: 'p-0', inset: 'px-4 py-0' },
  },
  defaultVariants: { variant: 'plain' },
});

export type ListDensity = 'compact' | 'default' | 'comfortable';

interface ListContextValue { density: ListDensity }
const ListCtx = createContext<ListContextValue>({ density: 'default' });

export interface ListProps extends Omit<ComponentProps<'div'>, 'children'>, VariantProps<typeof listVariants> {
  /** `ListSection`s (or anything else: a list may hold a banner between sections). */
  children?: ReactNode;
  /** Row height: `compact` 36px, `default` 46px (iOS's 44pt plus a hairline's room), `comfortable` 56px. */
  density?: ListDensity;
  /** Sticks to the top of the list (a search field, a scope bar); sticky section headers stop below it. */
  header?: ReactNode;
  /** Where sticky section headers stop, in px. By default the chrome above the list plus `header`'s height. */
  stickyTop?: number;
  /** Shown when the list has no rows: no children, or only `ListSection`s with no rows. A string is the title of a
   *  small `EmptyState` (default "No items"), any other node is drawn as is, and `null` shows nothing. */
  emptyState?: ReactNode;
}

/** No rows to show: nothing but `ListSection`s (or fragments of them) without row children. */
function isEmpty(children: ReactNode): boolean {
  return Children.toArray(children).every((c) => {
    if (!isValidElement(c)) return false;
    const props = c.props as { children?: ReactNode };
    if (c.type === Fragment) return isEmpty(props.children);
    if (c.type === ListSection) return Children.toArray(props.children).filter(isValidElement).length === 0;
    return false;
  });
}

const defaultEmpty = <EmptyState size="sm" title="No items" />;

export function List({
  children, variant, density = 'default', header, stickyTop, emptyState = defaultEmpty, className, ...props
}: ListProps) {
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
  const empty = isEmpty(children);
  return (
    <ListCtx value={{ density }}>
      <BLStickyCtx.Provider value={top}>
        <div data-slot="list" data-variant={variant ?? 'plain'} data-density={density} data-empty={empty ? '' : undefined}
          {...props} className={cn(listVariants({ variant }), className)}>
          {header ? (
            <div ref={hRef} className="sticky top-(--list-header-top) z-24 bg-sticky backdrop-blur-[10px] transition-[top] duration-spring-smooth ease-spring-smooth"
              style={{ '--list-header-top': chromeOffset(above, chromeHid) + 'px' } as CSSProperties}>{header}</div>
          ) : null}
          {empty ? (typeof emptyState === 'string' ? <EmptyState size="sm" title={emptyState} /> : emptyState) : children}
        </div>
      </BLStickyCtx.Provider>
    </ListCtx>
  );
}

/* ── Section ── */

/** What a section tells each row it holds: its place, and whether it has a grip. */
interface RowSlot { value: string; index: number; count: number; reorderable: boolean }
const RowSlotCtx = createContext<RowSlot | null>(null);

export interface ListSectionProps extends Omit<ComponentProps<'div'>, 'title' | 'children'> {
  /** The header over the rows: an uppercase grouped label, or with `sticky` the bold letter header of a plain list.
   *  It names the section's list for screen readers. */
  title?: ReactNode;
  /** Explanatory text under the rows ("Allow apps to request to track."). */
  footer?: ReactNode;
  /** The rows: keyed `ListRow`s. */
  children?: ReactNode;
  /** The title sticks below the chrome above it while the section scrolls (Contacts' letter headers). */
  sticky?: boolean;
  /** Where the sticky title stops, in px; by default the list's own offset. */
  stickyTop?: number;
  /** Rows spring in on insert, collapse out on remove, and slide to their new place on reorder. Children must
   *  be keyed. Implied by `onOrderChange`. */
  animate?: boolean;
  /** Reordering: every row shows a grip (drag it, or focus it, press Space, move it with ↑/↓ and press Space to
   *  drop). Called once per drop with the rows' keys in their new order, and `details.from` / `details.to`, the
   *  moved row's old and new index; reorder your data to match. Pass it only while reordering is allowed (say,
   *  in edit mode). */
  onOrderChange?: (order: string[], details: ListSectionOrderChangeDetails) => void;
}

/** The key a row was given, without the prefix `Children.toArray` adds. */
const ownKey = (key: string) => key.replace(/^\.\$/, '');
const keyOf = (c: ReactElement) => String(c.key);
const labelOf = (c: ReactElement) => {
  const t = (c.props as { title?: unknown }).title;
  return typeof t === 'string' ? t : undefined;
};

export function ListSection({
  title, footer, children, sticky, stickyTop, animate: anim, onOrderChange, className, ...props
}: ListSectionProps) {
  const ctxTop = use(BLStickyCtx);
  const top = chromeOffset(stickyTop != null ? stickyTop : ctxTop, useChromeHidden());
  const titleId = useId();
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
    <SectionParts.Root {...props} className={cn(className)}
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
              ? <div id={titleId} data-slot="list-section-title" className="sticky top-(--list-section-top) z-20 bg-sticky px-4 py-[3px] text-footnote font-semibold text-foreground backdrop-blur-[10px] transition-[top] duration-spring-smooth ease-spring-smooth"
                  style={{ '--list-section-top': top + 'px' } as CSSProperties}>{title}</div>
              : <div id={titleId} data-slot="list-section-title" className={cn(sectionLabelVariants({ variant: 'grouped' }), 'px-4 pt-1 pb-[7px]')}>{title}</div>) : null}
            <SectionParts.Rows aria-labelledby={title != null ? titleId : undefined}
              className={cn('overflow-hidden', sticky ? 'rounded-none' : 'rounded-panel')}>
              <MotionConfig reducedMotion="user">
                {rows.map((e, i) => (
                  <SectionItem key={e.key} value={e.key} label={labelOf(e.item)} animated={animated}
                    entering={e.present && e.appear} slot={{ value: e.key, index: i, count: rows.length, reorderable: !!onOrderChange }}>
                    {e.item}
                  </SectionItem>
                ))}
              </MotionConfig>
            </SectionParts.Rows>
            {footer ? <div data-slot="list-section-footer" className="px-4 pt-[7px] pb-0 text-footnote leading-[18px] text-muted-foreground">{footer}</div> : null}
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

/** The row surface (`list-row-content`): layout, wash, text tone, height, and where the icon sits. */
export const listRowVariants = cva(
  [
    // Type metrics a <button> would reset, so a host's body line-height or tracking doesn't reach the row.
    'relative z-1 box-border flex w-full touch-pan-y items-center gap-3 py-0 pl-4 text-left text-body leading-[normal] tracking-[normal] outline-none',
    'focus-visible:[box-shadow:inset_0_0_0_2px_var(--primary)]',
    // Trailing inset clears an IndexBar overlaying the list (it publishes --bl-index-bar-inset on its parent).
    'pr-[max(16px,calc(var(--bl-index-bar-inset,0px)+6px))]',
    // The swipe offset (`--swipe-x`, from UI SDK) moves the surface; it springs back unless a finger holds it.
    'translate-x-(--swipe-x) transition-[translate] duration-spring-snappy ease-spring-snappy group-data-swiping/row:transition-none motion-reduce:transition-none',
  ],
  {
    variants: {
      /** Cross axis: `center` (default) centers the icon on the row; `top` pins it to the first line of a
       *  multi-line row (a checkbox beside a wrapping title, an avatar beside a message preview). */
      align: { center: '', top: '[&>[data-slot=list-row-leading]]:self-start [&>[data-slot=list-row-leading]]:pt-[7px]' },
      /** Main axis: `start` (default), or `center` for a lone button row ("Sign Out", "Add Account"). */
      justify: { start: '', center: '' },
      density: { compact: 'min-h-9', default: 'min-h-row', comfortable: 'min-h-14' },
      // The wash lies over the card (a translucent fill alone would vanish into a dark grouped background).
      current: { true: 'bg-card bg-linear-to-r from-secondary-strong to-secondary-strong', false: 'bg-card' },
      tone: {
        default: 'text-foreground',
        success: 'text-success',
        warning: 'text-warning',
        destructive: 'text-destructive',
      },
      interactive: { true: 'cursor-pointer', false: 'cursor-default' },
      disabled: { true: 'cursor-default *:opacity-45', false: '' },
    },
    defaultVariants: { align: 'center', justify: 'start', density: 'default', current: false, tone: 'default', interactive: false, disabled: false },
  },
);

type RowVariants = VariantProps<typeof listRowVariants>;

export interface ListRowProps extends Omit<ComponentProps<'div'>, 'title' | 'children' | 'onClick'> {
  /** The row's label. Without `children` it is the row's name (and its press target's). */
  title?: ReactNode;
  /** A second line under the title, in the secondary color. */
  description?: ReactNode;
  /** Before the title: an icon tile, an avatar, a status glyph. */
  icon?: ReactNode;
  /** After the title, before the accessory: a value ("Wi-Fi name"), a badge. Controls placed here work too. */
  trailing?: ReactNode;
  /** `chevron` (drills in) / `check` (with `checked`), or a control (Switch, Slider, Button). A control makes the
   *  row a plain container. */
  accessory?: 'chevron' | 'check' | ReactNode;
  /** With `accessory="check"`, shows the checkmark; while `editing`, fills the edit-mode check. */
  checked?: boolean;
  /** The row stands for what is open now (the message in the reading pane): a grey wash and `aria-current`. */
  current?: boolean;
  /** Edit mode: slides in the selection check (filled by `checked`) and turns swipes off. */
  editing?: boolean;
  /** The row can't be pressed or swiped, and dims. Disable the controls inside it yourself. */
  disabled?: boolean;
  /** Makes the row a button. Without it the row is a plain container. */
  onClick?: ComponentProps<typeof SdkButton>['onClick'];
  /** Revealed by swiping right (or → from the keyboard). */
  leadingActions?: ListRowAction[];
  /** Revealed by swiping left (or ← from the keyboard). A `destructive` action also runs on Delete. */
  trailingActions?: ListRowAction[];
  /** A long swipe runs the outermost action. Default `true` (both sides). */
  fullSwipe?: ListRowFullSwipe;
  /** Without `onClick`, pressing the row toggles the switch/checkbox inside it. Default true. */
  labelToggles?: boolean;
  /** The hairline under the row. Default true; turn it off on the last row of a custom group. */
  divider?: boolean;
  align?: RowVariants['align'];
  justify?: RowVariants['justify'];
  /** Text color: `destructive` for "Delete Account", `success` / `warning` for status rows. */
  tone?: RowVariants['tone'];
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
      <Icon name="menu" size={22} sw={1.8} />
      <span id={id} className="sr-only">Drag, or press Space and then the up and down arrows, to move. Position {index + 1} of {count}.</span>
    </SectionParts.Handle>
  );
}

export function ListRow({
  title, description, icon, trailing, accessory, checked, current: isCurrent, editing, disabled, onClick,
  leadingActions, trailingActions, fullSwipe, labelToggles, divider, align, justify, tone, isEdge, controller,
  children, preview, contentClassName, className, ...props
}: ListRowProps) {
  const slot = use(RowSlotCtx);
  const { density } = use(ListCtx);
  const id = useId();
  const titleId = id + '-t', subId = id + '-s', hintId = id + '-h';

  const trailingActs = disabled ? [] : trailingActions ?? [];
  const leadingActs = disabled ? [] : leadingActions ?? [];
  const swipeable = !editing && (leadingActs.length > 0 || trailingActs.length > 0);
  const control = accessory != null && accessory !== 'chevron' && accessory !== 'check' ? accessory : null;
  const pressable = !!onClick;
  /** Full-width content replaces the title. */
  const fullWidth = children != null && children !== false;
  const hasTitle = !fullWidth && title != null;
  const allActs = [...leadingActs, ...trailingActs];
  const group = !pressable && swipeable;
  const hasDelete = trailingActs.some((a) => a.destructive);
  const shortcuts = `ArrowLeft ArrowRight${hasDelete ? ' Delete' : ''}`;
  const hint = swipeable
    ? `Actions: ${allActs.map((a) => a.label).join(', ')}. ${[trailingActs.length && 'Left arrow', leadingActs.length && 'right arrow'].filter(Boolean).join(' or ')} to reveal.`
    : null;
  const ariaCurrent = isCurrent || (accessory === 'check' && checked) ? 'true' : undefined;

  const body = (
    <>
      {swipeable && leadingActs.length ? <RowActions side="start" actions={leadingActs} /> : null}
      {swipeable && trailingActs.length ? <RowActions side="end" actions={trailingActs} /> : null}
      <RowParts.Content
        aria-labelledby={group ? titleId : undefined}
        aria-describedby={group && hint ? hintId : undefined}
        aria-keyshortcuts={group && hint ? shortcuts : undefined}
        aria-current={group ? ariaCurrent : undefined}
        className={cn(
          listRowVariants({
            align, justify, density, current: !!isCurrent, tone, disabled: !!disabled,
            interactive: !disabled && (pressable || swipeable || (!!control && labelToggles !== false)),
          }),
          contentClassName,
        )}>
        {pressable ? (
          // The press target spans the row beneath its content, so controls in the row are siblings of the button,
          // never nested inside it. Its name is the row's title and description.
          <SdkButton data-list-row-focus="" data-list-row-press="" data-tkrow=""
            disabled={disabled}
            aria-current={ariaCurrent}
            aria-pressed={editing ? !!checked : undefined}
            aria-labelledby={description ? `${titleId} ${subId}` : titleId}
            aria-describedby={hint ? hintId : undefined}
            aria-keyshortcuts={hint ? shortcuts : undefined}
            onClick={onClick}
            className="bl-btn bl-hl absolute inset-0 cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:[box-shadow:inset_0_0_0_2px_var(--primary)] disabled:cursor-default" />
        ) : null}
        {/* The edit-mode check: always present, 0 wide (its negative margin cancels the gap) until `editing`. */}
        <span aria-hidden="true" data-slot="list-row-edit" className={cn(
          'pointer-events-none relative flex shrink-0 items-center overflow-hidden transition-[width,opacity,margin-right] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
          editing ? 'mr-0 w-[30px] opacity-100' : '-mr-3 w-0 opacity-0',
        )}>
          <span data-checked={checked ? '' : undefined}
            className={cn(checkboxVariants({ shape: 'circle' }), 'pointer-events-none cursor-default ease-spring-bouncy')}>
            {checked ? <Icon name="check" size={13} sw={3} className="text-primary-foreground transition-[scale,opacity] duration-spring-snappy ease-spring-bouncy starting:scale-50 starting:opacity-0" /> : null}
          </span>
        </span>
        {icon ? <RowParts.Leading className="pointer-events-none relative flex shrink-0 items-center">{icon}</RowParts.Leading> : null}
        <RowParts.Body className={cn(
          'pointer-events-none relative flex min-h-[inherit] min-w-0 flex-1 items-center gap-2.5 px-0',
          fullWidth ? 'py-3' : density === 'compact' ? 'py-1' : 'py-[7px]',
          divider !== false && '[box-shadow:inset_0_-1px_0_var(--border)]',
          justify === 'center' ? 'justify-center' : 'justify-start',
        )}>
          {/* Switches and sliders anywhere in the row (even wrapped in the caller's own component) are named by the title. */}
          <RowLabelContext value={hasTitle ? titleId : undefined}>
            {fullWidth ? (
              <RowParts.Control data-row-control="" className="pointer-events-auto min-w-0 flex-1">{children}</RowParts.Control>
            ) : (
              <div className={cn('min-w-0', justify === 'center' ? 'flex-none' : 'flex-1')}>
                <div id={titleId} className="truncate leading-[1.3]">{title}</div>
                {description ? <div id={subId} className="mt-px truncate text-footnote text-muted-foreground">{description}</div> : null}
              </div>
            )}
            {trailing ? (
              <span data-row-control="" className="flex shrink-0 items-center">{trailing}</span>
            ) : null}
            {accessory === 'chevron' ? <Icon name="chev" size={15} sw={2.6} className="text-tertiary-foreground" />
              : accessory === 'check' ? <span className="w-[22px] shrink-0">{checked ? <Icon name="check" size={20} sw={2.4} className="text-primary" /> : null}</span>
              : control ? <RowParts.Control data-row-control="" className="pointer-events-auto flex min-w-0 shrink-0 items-center">{control}</RowParts.Control>
              : null}
          </RowLabelContext>
          {slot?.reorderable ? <Grip title={title} value={slot.value} index={slot.index} count={slot.count} /> : null}
        </RowParts.Body>
        {hint ? <span id={hintId} className="sr-only">{hint}</span> : null}
      </RowParts.Content>
    </>
  );

  const root = (
    <RowParts.Root {...props}
      leadingActions={leadingActs} trailingActions={trailingActs} fullSwipe={fullSwipe} editing={!!editing} disabled={!!disabled}
      labelToggles={labelToggles} isEdge={isEdge} group={group} controller={controller}
      data-disabled={disabled ? '' : undefined}
      className={cn(
        'group/row relative overflow-hidden opacity-100 outline-none transition-[height,opacity] duration-spring-tray ease-spring-tray motion-reduce:transition-none',
        // Removal (its exit) collapses from the measured height to 0 on the tray spring.
        'data-removing:h-(--list-row-h) data-ending-style:h-0 data-ending-style:opacity-0',
        className,
      )} />
  );
  if (preview == null) return <RowParts.Root {...root.props}>{body}</RowParts.Root>;
  return (
    <HoverCard>
      <HoverCardTrigger render={root}>{body}</HoverCardTrigger>
      <HoverCardContent side="right" align="start">{preview}</HoverCardContent>
    </HoverCard>
  );
}

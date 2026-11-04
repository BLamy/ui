'use client';
import {
  memo, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type ComponentProps, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode, type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { useFocusRing } from 'react-aria';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { Icon, type IconShape } from '@/lib/icon';
import {
  RowTimes, followTop, formatLogTime, logRowText, normalizeLogLevel, rowKeyTarget, rowsChange,
  type LogLevel, type LogRow, type RowId, type RowRange,
} from '@/lib/log-list-model';
import { RowWindow, isRowPress, tabThroughGrid, tabbablesIn, type RowAlign, type RowFlush } from '@/lib/log-list-window';
import { selectableText } from '@/lib/primitives';
import { useControllableState } from '@/lib/controllable-state';
import { cn } from '@/lib/utils';

/* ══ LogList — a console for a recording: 100,000 rows, and a marker that moves through them ══
   <LogList rows={rows} currentTime={t} onRowPress={(row) => seek(row.time)} />

   Rows are plain data (`message` can be any node). `currentId` or `currentTime` draws a "you are here" line: the rows
   after it are dimmed as the future, and it stays in view as it moves until the user scrolls away from it, when a
   button offers the way back. Moving it writes one transform and a few attributes and renders nothing, so it can
   follow a playhead on every frame (`currentTime` re-renders only LogList's own shell; the `setCurrentTime` handle
   doesn't even do that).

   Rows are as tall as they need to be (long messages wrap, or with `overflow="expand"` open on press) and are measured
   as they mount, so the scroll position holds still while heights are learned (lib/log-list-window). Under 480 px of
   the list's own width, time and source drop under the message.

   It's an ARIA grid with one tab stop, like Spreadsheet: ↑ ↓ Home End and Page Up/Down move the active row, Enter or
   Space presses it, → and ← open and close it, ⌘C or Ctrl+C copies it, and Tab goes into the active row's own controls
   and then on out of the list. Rows aren't react-aria elements: a press on one is the grid's own click, as giving
   each row react-aria's hooks costs too much for a list scrolled at this size. Copy is a real Button, a single one
   that moves to the row under the pointer or with focus. */

export const logListVariants = cva(
  // The hairline is drawn over the content, so a row's tint and the marker don't hide it.
  "@container relative flex h-full max-h-dvh w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground after:pointer-events-none after:absolute after:inset-0 after:z-3 after:rounded-[inherit] after:shadow-hairline after:content-['']",
  {
    variants: {
      /** Row height: `compact` (default, 24 px a line) packs the most in; `comfortable` (32 px) suits touch. */
      density: {
        compact: '[--log-pad:3px]',
        comfortable: '[--log-pad:7px]',
      },
    },
    defaultVariants: { density: 'compact' },
  },
);

const ROW_ESTIMATE = { compact: 24, comfortable: 32 } as const;

/** A plain log's mark: quiet, so warnings and errors stand out, and not a chevron, which would read as "opens". */
const LOG_ICON: readonly IconShape[] = [{ c: [12, 12, 3.4], f: 1 }];

const DEBUG_ICON: readonly IconShape[] = [
  { r: [8, 7.5, 8, 12.5, 4] },
  { d: 'M12 11.5V20' },
  { d: 'M8 13H4.5M16 13h3.5M8.4 17.5l-3 2M15.6 17.5l3 2M8.4 9.5l-3-2M15.6 9.5l3-2' },
  { d: 'M9.5 7.5a2.5 2.5 0 0 1 5 0' },
];

const LEVEL_ICONS: Record<LogLevel, ReactNode> = {
  log: <Icon shapes={LOG_ICON} size={12} className="text-tertiary-foreground" />,
  info: <Icon name="info-fill" size={14} className="text-primary" />,
  warn: <Icon name="warning-fill" size={14} className="text-warning" />,
  error: <Icon name="xmark-circle-fill" size={14} className="text-destructive" />,
  debug: <Icon shapes={DEBUG_ICON} size={13} sw={2} className="text-muted-foreground" />,
};

const CHEVRON = <Icon name="chevron-right" size={10} sw={2.6} className="transition-transform duration-spring-snappy ease-spring-snappy group-data-expanded/row:rotate-90 motion-reduce:transition-none" />;

/** A row's look. Its tint is its own background, and hover, press, current and selected share a layer over that, so
 *  a selected warning still reads as a warning. The line under a row is lighter than a list's hairline: at this density
 *  a full one rules the whole list like paper. */
const ROW_CLASS = [
  'group/row absolute inset-x-0 top-0 isolate flex min-w-0 cursor-default items-start gap-1.5 ps-2 pe-(--log-end) py-(--log-pad) text-caption leading-[18px] outline-none',
  "before:absolute before:inset-0 before:-z-1 before:content-[''] hover:before:bg-foreground/4 active:before:bg-foreground/8",
  "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border/60 after:content-['']",
  'data-[level=warn]:bg-warning/10 data-[level=error]:bg-destructive/8 data-[level=debug]:text-muted-foreground',
  'data-current:before:bg-primary/10 data-selected:before:bg-primary/16',
  'data-future:opacity-45',
  'group-data-focus-visible/grid:data-active:ring-2 group-data-focus-visible/grid:data-active:ring-ring group-data-focus-visible/grid:data-active:ring-inset',
].join(' ');

const CELL_CLASS = 'flex min-w-0 flex-1 items-start';
const MESSAGE_CLASS = cn('min-w-0 flex-1 font-mono whitespace-pre-wrap [overflow-wrap:anywhere]', selectableText);
const MESSAGE_CUT_CLASS = cn('min-w-0 flex-1 truncate font-mono', selectableText);
const META_CLASS = 'flex max-w-full min-w-0 shrink-0 items-baseline gap-2 text-caption2 text-muted-foreground @[480px]:max-w-[40%] @[480px]:justify-end';
const COUNT_CLASS = 'me-1.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-secondary-strong px-1 align-[1px] font-sans text-caption2 leading-none font-semibold tabular-nums';
// The chevron's column reaches out into the row's padding, and is 0 wide in a list with nothing to open.
const TOGGLE_CLASS = 'invisible ms-[calc(var(--log-toggle)*-0.5)] flex h-[18px] w-(--log-toggle) shrink-0 items-center justify-center text-muted-foreground group-data-clipped/row:visible group-data-expanded/row:visible group-data-has-detail/row:visible';
const ICON_CLASS = 'me-1.5 flex h-[18px] w-3.5 shrink-0 items-center justify-center';

export interface LogRowContentProps {
  row: LogRow;
  /** Shows `row.detail`, and the whole message. */
  expanded?: boolean;
  /** Cuts the message to one line. */
  cut?: boolean;
  /** Draws the disclosure chevron, which the row reveals when it has more to show. */
  disclosure?: boolean;
  formatTime?: (ms: number) => string;
}

/** A row's usual content: disclosure, level icon, count, message, source and time. A `renderRow` can use it to add to a
 *  row rather than replace it. */
export function LogRowContent({ row, expanded = false, cut = false, disclosure = false, formatTime = formatLogTime }: LogRowContentProps) {
  const time = row.time === undefined ? null : formatTime(row.time);
  return (
    <>
      <span data-slot="log-list-toggle" data-row-toggle="" className={TOGGLE_CLASS}>{disclosure ? CHEVRON : null}</span>
      <span data-slot="log-list-icon" className={ICON_CLASS}>{LEVEL_ICONS[normalizeLogLevel(row.level)]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-col @[480px]:flex-row @[480px]:gap-3">
          <div data-slot="log-list-message" className={cut && !expanded ? MESSAGE_CUT_CLASS : MESSAGE_CLASS}>
            {row.count !== undefined && row.count > 1 ? <span data-slot="log-list-count" className={COUNT_CLASS}>{row.count.toLocaleString('en-US')}</span> : null}
            {row.message}
          </div>
          {time !== null || row.source != null ? (
            <div data-slot="log-list-meta" className={META_CLASS}>
              {row.source != null ? <span data-slot="log-list-source" className="min-w-0 truncate">{row.source}</span> : null}
              {time !== null ? <span data-slot="log-list-time" className="shrink-0 text-end tabular-nums">{time}</span> : null}
            </div>
          ) : null}
        </div>
        {expanded && row.detail != null ? (
          <div data-slot="log-list-detail" className={cn('mt-0.5 font-mono text-caption2 whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]', selectableText)}>{row.detail}</div>
        ) : null}
      </div>
    </>
  );
}

/** What a `renderRow` is told. */
export interface LogRowState {
  index: number;
  selected: boolean;
  expanded: boolean;
  /** The list's `overflow="expand"`, while the row isn't open. */
  cut: boolean;
  /** Whether rows draw a disclosure chevron: pass it on to `LogRowContent`. */
  disclosure: boolean;
  formatTime: (ms: number) => string;
}

export interface LogListHandle {
  /** Focuses the list. */
  focus: () => void;
  /** Scrolls to a row by id. `center` by default; `nearest` moves only if it's out of view. */
  scrollToId: (id: RowId, align?: RowAlign) => void;
  /** Takes the view back to the marker (or the newest row, with `followTail`) and follows it again. */
  followPosition: () => void;
  /** Moves the marker to a time with no React at all, for a clock's every tick. The `currentId` and `currentTime` props
   *  take over again when they next change. */
  setCurrentTime: (time: number | null) => void;
}

export interface LogListProps<T extends LogRow = LogRow>
  extends Omit<ComponentProps<'div'>, 'children' | 'ref'>, VariantProps<typeof logListVariants> {
  rows: readonly T[];
  /** The row that's "now": the marker goes right after it, and it's tinted. If it's filtered out of `rows`,
   *  `currentTime` decides, when given. */
  currentId?: RowId | null;
  /** The time that's "now": the marker goes before the first row logged later. */
  currentTime?: number | null;
  /** A small label on the marker, like "Paused here". */
  markerLabel?: ReactNode;
  /** Keep the marker in view as it moves (default true), until the user scrolls it out of view. */
  follow?: boolean;
  /** With no marker: stay on the newest row as rows arrive, until the user scrolls up. */
  followTail?: boolean;
  /** The way-back button's text. Default "Back to current" (or "Back to latest", with `followTail`). */
  jumpLabel?: ReactNode;
  /** Whether the view is following the marker or the newest row. */
  onFollowChange?: (following: boolean) => void;
  /** `wrap` (default) wraps long messages. `expand` cuts them to one line until the row is opened. */
  overflow?: 'wrap' | 'expand';
  /** A press also opens or closes the row, if it has more to show. Default: on with `overflow="expand"`. */
  expandOnPress?: boolean;
  /** The open rows, controlled. They're held by id, as rows unmount when they scroll away. */
  expandedIds?: ReadonlySet<RowId>;
  defaultExpandedIds?: Iterable<RowId>;
  onExpandedChange?: (ids: ReadonlySet<RowId>) => void;
  /** The selected row, controlled; `null` for none. A new value that's out of view is scrolled to. */
  selectedId?: RowId | null;
  defaultSelectedId?: RowId | null;
  onSelectionChange?: (id: RowId | null) => void;
  /** A press on a row (or Enter or Space on the active one). Not called for presses on a control inside it. */
  onRowPress?: (row: T, index: number) => void;
  /** Show the Copy button, and take ⌘C on the active row (default true). */
  copyable?: boolean;
  /** A row's text for copying. Default `logRowText`. */
  getRowText?: (row: T) => string;
  /** Called with a row's text when it's copied. Hosts with a clipboard of their own can write it there. */
  onRowCopy?: (row: T, text: string) => void;
  /** Draws a row's content yourself, inside its row element. Must be stable (`useCallback`): a new function re-renders
   *  every mounted row. */
  renderRow?: (row: T, state: LogRowState) => ReactNode;
  /** Must be stable too. Default `formatLogTime`. */
  formatTime?: (ms: number) => string;
  /** A row's height until it's measured. Default: one line at the list's density. */
  estimatedRowHeight?: number;
  /** Shown when there are no rows. */
  emptyState?: ReactNode;
  /** Shown after the last row, like "12 more later in the recording". */
  footer?: ReactNode;
  'aria-label'?: string;
  ref?: Ref<LogListHandle>;
}

/** What LogList does outside React: where the marker is, what's dimmed, and whether the view follows. */
class LogPosition<T extends LogRow> {
  readonly win: RowWindow<T>;
  readonly times = new RowTimes();
  marker: HTMLElement | null = null;
  follow = true;
  tail = false;
  onFollowChange: ((following: boolean) => void) | undefined;
  boundary: number | null = null;
  current = -1;
  private id: RowId | null = null;
  private time: number | null = null;
  private following = true;
  private away: 'above' | 'below' | null = null;
  private drawnY: number | null | undefined;
  private listeners = new Set<() => void>();

  constructor(estimate: number) {
    this.win = new RowWindow<T>({ estimate });
    this.win.decorate = this.decorate;
    this.win.onLayout = () => this.paint();
    this.win.onScroll = (byUser) => { if (byUser) this.keepInView('sync', true); };
  }

  setMarker = (el: HTMLElement | null) => {
    this.marker = el;
  };

  setRows(rows: readonly T[]): void {
    const change = rowsChange(this.win.rows, rows);
    this.times.update(rows, change);
    this.win.setRows(rows);
    this.moved('effect');
  }

  setPosition(id: RowId | null, time: number | null, flush: RowFlush): void {
    this.id = id;
    this.time = time;
    this.moved(flush);
  }

  private moved(flush: RowFlush): void {
    const { boundary, current } = this;
    this.resolve();
    if (this.boundary !== boundary || this.current !== current) this.win.decorateAll();
    this.paint();
    this.keepInView(flush);
  }

  private resolve(): void {
    const { win, id, time } = this;
    this.boundary = null;
    this.current = -1;
    if (id !== null) {
      const at = win.ids.indexOf(id);
      if (at >= 0) {
        this.boundary = at + 1;
        this.current = at;
        return;
      }
    }
    if (time !== null) {
      this.boundary = this.times.firstAfter(time);
      if (this.boundary > 0 && win.rows[this.boundary - 1].time === time) this.current = this.boundary - 1;
    }
  }

  private decorate = (el: HTMLElement, index: number) => {
    el.toggleAttribute('data-future', this.boundary !== null && index >= this.boundary);
    if (index === this.current) {
      el.setAttribute('data-current', '');
      el.setAttribute('aria-current', 'true');
    } else if (el.hasAttribute('data-current')) {
      el.removeAttribute('data-current');
      el.removeAttribute('aria-current');
    }
  };

  private paint(): void {
    const { marker, boundary, win } = this;
    if (!marker) return;
    const y = boundary === null || !win.rows.length ? null : win.heights.offsetOf(boundary);
    if (y === this.drawnY) return;
    if (y === null) marker.style.display = 'none';
    else {
      if (this.drawnY === null || this.drawnY === undefined) marker.style.display = '';
      marker.style.transform = `translateY(${y}px)`;
    }
    this.drawnY = y;
  }

  /** Where the view should stay: the marker, or the end of the list when following the newest row. */
  private target(): number | null {
    if (this.boundary !== null) return this.win.heights.offsetOf(this.boundary);
    return this.tail ? this.win.heights.total : null;
  }

  /** Follows the marker, unless the user has scrolled it out of view (`byUser`, when that's what just happened). It
   *  picks up again when the marker comes back into view, whichever of them moved. */
  keepInView(flush: RowFlush, byUser = false): void {
    const { win } = this;
    const y = this.target();
    if (y === null || !win.rows.length) { this.setAway(null); return; }
    const inView = y >= win.scrollTop - 1 && y <= win.scrollTop + win.view + (this.boundary === null ? 24 : 1);
    if (byUser || inView) this.setFollowing(inView);
    if (this.following && !byUser && this.follow) {
      win.scrollWith(() => (this.boundary === null ? win.endTop : followTop({ y: this.target() ?? 0, top: win.scrollTop, view: win.view, total: win.heights.total })), flush);
    }
    const now = this.target() ?? 0;
    const seen = now >= win.scrollTop - 1 && now <= win.scrollTop + win.view + (this.boundary === null ? 24 : 1);
    this.setAway(seen ? null : now < win.scrollTop ? 'above' : 'below');
  }

  /** The way back: to the marker, and following again. */
  jump = () => {
    const { win } = this;
    const y = this.target();
    if (y === null) return;
    this.setFollowing(true);
    win.scrollWith(() => (this.boundary === null ? win.endTop : (this.target() ?? 0) - win.view / 2), 'micro');
    this.setAway(null);
  };

  private setFollowing(following: boolean): void {
    if (following === this.following) return;
    this.following = following;
    this.onFollowChange?.(following);
  }

  private setAway(away: 'above' | 'below' | null): void {
    if (away === this.away) return;
    this.away = away;
    this.listeners.forEach((listener) => listener());
  }

  getAway = () => this.away;

  subscribeAway = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
}

/** Callbacks that change on every render of a host, read when they're needed so they don't re-render anything. */
interface LogHandlers<T extends LogRow> {
  onRowPress: LogListProps<T>['onRowPress'];
  onRowCopy: LogListProps<T>['onRowCopy'];
  getRowText: LogListProps<T>['getRowText'];
  onExpandedChange: LogListProps<T>['onExpandedChange'];
  onSelectionChange: LogListProps<T>['onSelectionChange'];
}

interface LogRowViewProps {
  row: LogRow;
  index: number;
  domId: string;
  selected: boolean;
  active: boolean;
  expanded: boolean;
  cut: boolean;
  disclosure: boolean;
  formatTime: (ms: number) => string;
  renderRow: ((row: never, state: LogRowState) => ReactNode) | undefined;
}

const LogRowView = memo(function LogRowView({ row, index, domId, selected, active, expanded, cut, disclosure, formatTime, renderRow }: LogRowViewProps) {
  const hasDetail = row.detail != null;
  return (
    <div
      role="row"
      id={domId}
      aria-rowindex={index + 1}
      aria-selected={selected}
      aria-expanded={hasDetail ? expanded : undefined}
      data-slot="log-list-row"
      data-index={index}
      data-level={normalizeLogLevel(row.level)}
      data-selected={selected || undefined}
      data-active={active || undefined}
      data-expanded={expanded || undefined}
      data-has-detail={hasDetail || undefined}
      className={ROW_CLASS}
    >
      <div role="gridcell" className={CELL_CLASS}>
        {renderRow
          ? renderRow(row as never, { index, selected, expanded, cut, disclosure, formatTime })
          : <LogRowContent row={row} expanded={expanded} cut={cut} disclosure={disclosure} formatTime={formatTime} />}
      </div>
    </div>
  );
});

const EMPTY_RANGE: RowRange = { start: 0, end: 0 };

interface LogActionsControl {
  hover: (index: number) => void;
  refresh: () => void;
}

/** The Copy button, one for the whole list. It's portalled into whichever row has the pointer, or else the active row,
 *  which is how touch and keys reach it, and shows while the pointer's on that row or focus is in the list. It holds the
 *  hovered row itself, so moving the pointer renders only this. */
function LogRowActions<T extends LogRow>({ win, rows, activeIndex, control, handlers, formatTime }: {
  win: RowWindow<T>; rows: readonly T[]; activeIndex: number; control: { current: LogActionsControl };
  handlers: { current: LogHandlers<T> }; formatTime: (ms: number) => string;
}) {
  const [hovered, setHovered] = useState(-1);
  const [copied, setCopied] = useState<RowId | null>(null);
  const [rowEl, setRowEl] = useState<HTMLElement | undefined>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const index = hovered >= 0 ? hovered : activeIndex;
  // The row's element is only known once RowWindow has seen the commit that mounted it, which is after this component's
  // own effects, so the list asks for it again then.
  useLayoutEffect(() => {
    const refresh = () => setRowEl(index >= 0 ? win.elementAt(index) : undefined);
    control.current = { hover: setHovered, refresh };
    refresh();
  }, [win, index, control]);
  const row = rows[index];
  if (!row || !rowEl || !rowEl.isConnected) return null;
  const done = copied === row.id;
  return createPortal(
    <div role="gridcell" data-slot="log-list-actions" data-no-row-press="" className="invisible absolute end-1 bottom-[calc(var(--log-pad)-2px)] z-1 group-focus-within/grid:visible group-hover/row:visible @[480px]:top-[calc(var(--log-pad)-2px)] @[480px]:bottom-auto">
      <Button
        variant="quiet"
        size="icon-sm"
        aria-label={done ? 'Copied' : 'Copy this row'}
        title={done ? 'Copied' : 'Copy'}
        onPress={() => {
          void copyRow(row, handlers.current, formatTime).then((ok) => {
            if (!ok) return;
            setCopied(row.id);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(null), 1200);
          });
        }}
        className="bg-card shadow-hairline data-hovered:bg-card data-pressed:bg-secondary"
      >
        <Icon name={done ? 'check' : 'copy'} size={12} sw={2.2} className={done ? 'text-success' : undefined} />
      </Button>
    </div>,
    rowEl,
  );
}

/** Puts a row's text on the clipboard, and tells the host either way, as a host may have a clipboard of its own. */
function copyRow<T extends LogRow>(row: T, handlers: LogHandlers<T>, formatTime: (ms: number) => string): Promise<boolean> {
  const text = handlers.getRowText?.(row) ?? logRowText(row, formatTime);
  handlers.onRowCopy?.(row, text);
  if (!navigator.clipboard) return Promise.resolve(false);
  return navigator.clipboard.writeText(text).then(() => true, () => false);
}

function LogListJump<T extends LogRow>({ position, label }: { position: LogPosition<T>; label?: ReactNode }) {
  const away = useSyncExternalStore(position.subscribeAway, position.getAway, () => null);
  if (!away) return null;
  return (
    <div data-side={away} className="pointer-events-none absolute inset-x-0 z-4 flex justify-center data-[side=above]:top-2 data-[side=below]:bottom-2">
      <Button data-slot="log-list-jump" size="sm" onPress={() => position.jump()} className="pointer-events-auto h-7 gap-1 rounded-full px-3 text-caption shadow-hairline">
        <Icon name={away === 'above' ? 'arrow-up' : 'arrow-down'} size={12} sw={2.4} />
        {label ?? (position.boundary === null ? 'Back to latest' : 'Back to current')}
      </Button>
    </div>
  );
}

interface LogListBodyProps<T extends LogRow> extends Omit<LogListProps<T>, 'currentId' | 'currentTime' | 'follow' | 'followTail' | 'onFollowChange' | 'onRowPress' | 'onRowCopy' | 'getRowText' | 'onExpandedChange' | 'onSelectionChange' | 'estimatedRowHeight' | 'ref'> {
  position: LogPosition<T>;
  handlers: { current: LogHandlers<T> };
  gridRef: { current: HTMLDivElement | null };
}

function LogListBodyInner<T extends LogRow>({
  position, handlers, gridRef, rows, markerLabel, jumpLabel, overflow = 'wrap', expandOnPress = overflow === 'expand',
  expandedIds, defaultExpandedIds, selectedId, defaultSelectedId, copyable = true, renderRow, formatTime = formatLogTime,
  emptyState, footer, density, className, onKeyDown, onFocus, 'aria-label': ariaLabel = 'Log', ...props
}: LogListBodyProps<T>) {
  const { win } = position;
  const [range, setRange] = useState(EMPTY_RANGE);
  const sizer = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const domId = (index: number) => `${baseId}-${index}`;
  const { isFocusVisible, focusProps } = useFocusRing();

  const [selected, setSelected] = useControllableState<RowId | null>(selectedId, defaultSelectedId ?? null, (id) => handlers.current.onSelectionChange?.(id));
  const [expanded, setExpanded] = useControllableState<ReadonlySet<RowId>>(expandedIds, useMemo(() => new Set(defaultExpandedIds), []), (ids) => handlers.current.onExpandedChange?.(ids)); // eslint-disable-line react-hooks/exhaustive-deps
  const [activeId, setActiveId] = useState<RowId | null>(null);
  const actions = useRef<LogActionsControl>({ hover: () => {}, refresh: () => {} });
  const hovered = useRef(-1);

  const cutting = overflow === 'expand';
  const disclosure = useMemo(() => cutting || rows.some((row) => row.detail != null), [cutting, rows]);

  // Connect first, then the rows, then measure what this commit mounted.
  useLayoutEffect(() => {
    win.onRange = setRange;
    const scroller = gridRef.current;
    if (!scroller || !sizer.current) return undefined;
    return win.attach(scroller, sizer.current);
  }, [win, gridRef]);
  useLayoutEffect(() => { position.setRows(rows); }, [position, rows]);
  useLayoutEffect(() => {
    win.sync();
    actions.current.refresh();
    if (cutting) markClipped(win);
  });
  useLayoutEffect(() => {
    if (!cutting) for (const el of win.elements.values()) el.removeAttribute('data-clipped');
  }, [win, cutting]);

  // The layout flips at 480 px, so what was measured on the other side of it no longer holds.
  useLayoutEffect(() => {
    win.onWidth = (width, before) => {
      if (before && width < 480 !== before < 480) win.invalidate();
      if (cutting) markClipped(win);
    };
  }, [win, cutting]);

  const activeIndex = activeId === null ? -1 : win.indexIn(rows, activeId);
  const selectedIndex = selected === null ? -1 : win.indexIn(rows, selected);
  const mounted = (index: number) => index >= range.start && index < Math.min(range.end, rows.length);

  // A selection from outside (a link from another row, an inspection) comes into view. A press's row is in view already.
  const lastSelected = useRef<RowId | null>(null);
  useLayoutEffect(() => {
    if (selected === lastSelected.current) return;
    lastSelected.current = selected;
    if (selected === null) return;
    const index = win.ids.indexOf(selected);
    if (index < 0 || win.isVisible(index)) return;
    win.scrollToIndex(index, 'center', 'effect');
    position.keepInView('effect', true);
  }, [selected, win, position]);

  const reveal = (index: number) => {
    win.scrollToIndex(index, 'nearest');
    position.keepInView('sync', true);
  };

  const canExpand = (index: number) => {
    const row = rows[index];
    return row.detail != null || expanded.has(row.id) || !!win.elementAt(index)?.hasAttribute('data-clipped');
  };
  const toggle = (id: RowId) => {
    const next = new Set(expanded);
    if (!next.delete(id)) next.add(id);
    setExpanded(next);
  };
  const press = (index: number) => {
    const row = rows[index];
    setActiveId(row.id);
    setSelected(row.id);
    if (expandOnPress && canExpand(index)) toggle(row.id);
    handlers.current.onRowPress?.(row, index);
  };

  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const index = win.indexFrom(e.target);
    if (index < 0) return;
    const target = e.target as Element;
    if (target.closest('[data-row-toggle]')) {
      setActiveId(rows[index].id);
      toggle(rows[index].id);
      return;
    }
    if (isRowPress(e)) press(index);
  };

  const startRow = () => {
    if (selectedIndex >= 0 && win.isVisible(selectedIndex)) return selectedIndex;
    if (position.current >= 0 && win.isVisible(position.current)) return position.current;
    return win.heights.indexAt(win.scrollTop);
  };

  const onGridKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'Tab') { tabThroughGrid(e, activeIndex >= 0 ? win.elementAt(activeIndex) : undefined); return; }
    const grid = e.currentTarget;
    if (e.target !== grid) {
      // In a row's own control, which keeps its keys. Esc comes back to the list.
      if (e.key === 'Escape') { grid.focus(); e.preventDefault(); }
      return;
    }
    if (!rows.length) return;
    const from = activeIndex >= 0 ? activeIndex : startRow();
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
      if (!copyable || !window.getSelection()?.isCollapsed) return;
      void copyRow(rows[from], handlers.current, formatTime);
      e.preventDefault();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
        press(from);
        e.preventDefault();
        return;
      case 'ArrowRight':
        if (!expanded.has(rows[from].id) && canExpand(from)) toggle(rows[from].id);
        else if (win.elementAt(from)) tabbablesIn(win.elementAt(from) as HTMLElement)[0]?.focus();
        e.preventDefault();
        return;
      case 'ArrowLeft':
        if (expanded.has(rows[from].id)) toggle(rows[from].id);
        e.preventDefault();
        return;
      default:
    }
    // With nothing active yet, the first press lands on the row it would start from.
    const to = activeIndex < 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')
      ? from
      : rowKeyTarget(e.key, from, rows.length, (direction) => win.heights.indexAt(win.heights.offsetOf(from) + direction * win.view));
    if (to === null) return;
    e.preventDefault();
    setActiveId(rows[to].id);
    reveal(to);
  };

  const onGridFocus = (e: ReactFocusEvent<HTMLDivElement>) => {
    focusProps.onFocus?.(e);
    onFocus?.(e);
    if (e.target === e.currentTarget && activeId === null && rows.length) setActiveId(rows[startRow()].id);
  };

  const hover = (index: number) => {
    if (index === hovered.current) return;
    hovered.current = index;
    actions.current.hover(index);
  };
  const onPointerOver = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') hover(win.indexFrom(e.target));
  };

  const rowEls: ReactElement[] = [];
  for (let i = range.start; i < Math.min(range.end, rows.length); i++) {
    const row = rows[i];
    rowEls.push(
      <LogRowView
        key={row.id}
        row={row}
        index={i}
        domId={domId(i)}
        selected={row.id === selected}
        active={row.id === activeId}
        expanded={expanded.has(row.id)}
        cut={cutting}
        disclosure={cutting || row.detail != null}
        formatTime={formatTime}
        renderRow={renderRow as LogRowViewProps['renderRow']}
      />,
    );
  }

  return (
    <div data-slot="log-list" data-rows={rows.length} className={cn(logListVariants({ density }), className)} {...props}>
      <div
        ref={gridRef}
        // A row can open to show more, and aria-expanded on a row is only allowed in a treegrid.
        role="treegrid"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-rowcount={rows.length}
        aria-activedescendant={activeIndex >= 0 && mounted(activeIndex) ? domId(activeIndex) : undefined}
        data-slot="log-list-grid"
        data-focus-visible={isFocusVisible || undefined}
        onClick={onClick}
        onKeyDown={onGridKeyDown}
        onFocus={onGridFocus}
        onBlur={focusProps.onBlur}
        onPointerOver={onPointerOver}
        onPointerLeave={() => hover(-1)}
        className="group/grid bl-scroll relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain outline-none [overflow-anchor:none]"
      >
        <div
          ref={sizer}
          role="rowgroup"
          data-slot="log-list-rows"
          className={cn(
            'relative w-full',
            disclosure ? '[--log-toggle:10px]' : '[--log-toggle:0px]',
            // Beside the message there's a column kept for Copy, so it never covers a row's time. Under it, Copy sits at the
            // end of the line of time and source, which rarely reaches that far.
            copyable ? '[--log-end:8px] @[480px]:[--log-end:28px]' : '[--log-end:8px]',
          )}
        >
          {rowEls}
          <div
            ref={position.setMarker}
            aria-hidden="true"
            data-slot="log-list-marker"
            className="pointer-events-none absolute inset-x-0 top-0 z-3 h-0"
          >
            <div className="absolute inset-x-0 -top-px h-0.5 bg-primary" />
            <div className="absolute start-0.5 -top-1 size-2 rounded-full bg-primary" />
            {markerLabel != null ? (
              <div data-slot="log-list-marker-label" className="absolute end-2 -top-[7px] flex h-3.5 items-center rounded-full bg-primary px-1.5 text-caption2 leading-none font-semibold whitespace-nowrap text-primary-foreground @[480px]:end-1/2 @[480px]:translate-x-1/2">{markerLabel}</div>
            ) : null}
          </div>
          {copyable ? <LogRowActions win={win} rows={rows} activeIndex={activeIndex} control={actions} handlers={handlers} formatTime={formatTime} /> : null}
        </div>
        {!rows.length ? <div data-slot="log-list-empty" className="px-3 py-6 text-center text-footnote text-muted-foreground">{emptyState ?? 'No messages'}</div> : null}
        {footer != null ? <div data-slot="log-list-footer" className="px-3 py-2 text-center text-caption text-muted-foreground">{footer}</div> : null}
      </div>
      <LogListJump position={position} label={jumpLabel} />
    </div>
  );
}

/** With `overflow="expand"`: marks the rows whose message is cut, reading them all before writing any. */
function markClipped(win: { elements: ReadonlyMap<number, HTMLElement> }) {
  const results: [HTMLElement, boolean][] = [];
  for (const el of win.elements.values()) {
    const message = el.querySelector('[data-slot=log-list-message]');
    results.push([el, !!message && message.scrollWidth > message.clientWidth]);
  }
  for (const [el, clipped] of results) {
    el.toggleAttribute('data-clipped', clipped);
    if (!el.hasAttribute('data-has-detail')) {
      if (clipped || el.hasAttribute('data-expanded')) el.setAttribute('aria-expanded', String(el.hasAttribute('data-expanded')));
      else el.removeAttribute('aria-expanded');
    }
  }
}

const LogListBody = memo(LogListBodyInner) as typeof LogListBodyInner;

export function LogList<T extends LogRow = LogRow>({
  currentId = null, currentTime = null, follow = true, followTail = false, onFollowChange, onRowPress, onRowCopy, getRowText,
  onExpandedChange, onSelectionChange, estimatedRowHeight, ref, ...props
}: LogListProps<T>) {
  const [position] = useState(() => new LogPosition<T>(estimatedRowHeight ?? ROW_ESTIMATE[props.density ?? 'compact']));
  const grid = useRef<HTMLDivElement | null>(null);
  const handlers = useRef<LogHandlers<T>>({ onRowPress, onRowCopy, getRowText, onExpandedChange, onSelectionChange });
  useLayoutEffect(() => {
    handlers.current = { onRowPress, onRowCopy, getRowText, onExpandedChange, onSelectionChange };
    position.onFollowChange = onFollowChange;
  });
  useLayoutEffect(() => {
    position.follow = follow;
    position.tail = followTail;
    position.keepInView('effect');
  }, [position, follow, followTail]);
  // This is why a moving marker costs no rows: the props it moves on stop here, in the shell. The body below only
  // renders for what its own props change, and the marker is moved by writing to the DOM.
  useLayoutEffect(() => { position.setPosition(currentId, currentTime, 'effect'); }, [position, currentId, currentTime]);
  useImperativeHandle(ref, () => ({
    focus: () => grid.current?.focus(),
    scrollToId: (id, align = 'center') => {
      position.win.scrollToIndex(position.win.ids.indexOf(id), align, 'micro');
      position.keepInView('micro', true);
    },
    followPosition: () => position.jump(),
    setCurrentTime: (time) => position.setPosition(null, time, 'micro'),
  }), [position]);
  return <LogListBody<T> position={position} handlers={handlers} gridRef={grid} {...props} />;
}

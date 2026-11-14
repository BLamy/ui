'use client';
import {
  createContext, memo, useContext, useMemo, useSyncExternalStore,
  type KeyboardEventHandler, type ReactNode,
} from 'react';
import type { ChangeDetails } from '@ui-sdk/core';
import { createParts, usePart, usePrimitive, type PartProps, type PrimitiveHandle } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon, type IconShape } from '@/lib/icon';
import { formatLogTime, normalizeLogLevel, type LogLevel, type LogRow, type RowId } from '@/lib/log-list-model';
import {
  logList, type LogListActionDetails, type LogListController, type LogListExpandedChangeReason, type LogListFollowingChangeReason,
  type LogListOptions, type LogListValueChangeReason,
} from '@/lib/log-list-primitive';
import { dataRowLayers, selectableText } from '@/lib/primitives';
import { useCopy } from '@/lib/use-copy';
import { cn, cx } from '@/lib/utils';

/* ══ LogList — a console for a recording: 100,000 rows, and a marker that moves through them ══
   <LogList rows={rows} currentTime={t} onAction={(id, { row }) => seek(row.time)} />

   Rows are plain data (`message` can be any node). `currentId` or `currentTime` draws a "you are here" line: the rows
   after it are dimmed as the future, and it stays in view as it moves until the user scrolls away from it, when a
   button offers the way back. Moving it writes one transform and a few attributes and renders nothing, so it can
   follow a playhead on every frame (`currentTime` re-renders only LogList's own shell; the controller's
   `setCurrentTime` doesn't even do that).

   Rows are as tall as they need to be (long messages wrap, or with `overflow="expand"` open on press) and are measured
   as they mount, and the view holds still while the rows above it are learned. Under 480 px of the list's own width,
   time and source drop under the message.

   It's the log-list primitive (lib/log-list-primitive), built from UI SDK's virtualizer, grid focus and stick to
   bottom: a treegrid with one tab stop, where ↑ ↓ Home End and Page Up/Down move between rows, Enter or Space presses
   one, → and ← open and close it, ⌘C or Ctrl+C copies it, and Tab goes into the row's own controls and then on out of
   the list. Copy is a single Button, in the row under the pointer or with focus. */

export const logListVariants = cva(
  // The hairline is drawn over the content, so a row's tint and the marker don't hide it.
  "@container relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground after:pointer-events-none after:absolute after:inset-0 after:z-3 after:rounded-[inherit] after:shadow-hairline after:content-['']",
  {
    variants: {
      /** Row height for one line: `compact` (the default, 24px) packs the most in; `default` is 28px; `comfortable`
       *  (32px) suits touch. */
      density: {
        compact: '[--log-pad:3px]',
        default: '[--log-pad:5px]',
        comfortable: '[--log-pad:7px]',
      },
    },
    defaultVariants: { density: 'compact' },
  },
);

const ROW_ESTIMATE = { compact: 24, default: 28, comfortable: 32 } as const;

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

/** A row's look: the shared data-row layers (`dataRowLayers`), with its level's tint as its own background. */
const ROW_CLASS = [
  'group/row absolute inset-x-0 top-0 flex min-w-0 cursor-default items-start gap-1.5 ps-2 pe-(--log-end) py-(--log-pad) text-caption leading-[18px]',
  dataRowLayers,
  'data-[level=warn]:bg-warning/10 data-[level=error]:bg-destructive/8 data-[level=debug]:text-muted-foreground',
  'data-current:before:bg-primary/10 data-selected:before:bg-primary/16',
  'data-future:opacity-45',
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

export interface LogListProps<T extends LogRow = LogRow>
  extends Omit<PartProps<'div'>, 'children' | 'defaultValue'>, VariantProps<typeof logListVariants> {
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
  onFollowingChange?: (following: boolean, details: ChangeDetails<LogListFollowingChangeReason>) => void;
  /** `wrap` (default) wraps long messages. `expand` cuts them to one line until the row is opened. */
  overflow?: 'wrap' | 'expand';
  /** A press also opens or closes the row, if it has more to show. Default: on with `overflow="expand"`. */
  expandOnPress?: boolean;
  /** The open rows' ids, controlled. They're held by id, as rows unmount when they scroll away. */
  expanded?: RowId[];
  defaultExpanded?: RowId[];
  onExpandedChange?: (expanded: RowId[], details: ChangeDetails<LogListExpandedChangeReason>) => void;
  /** The selected row's id, controlled; `null` for none. A new value that's out of view is scrolled to. */
  value?: RowId | null;
  defaultValue?: RowId | null;
  onValueChange?: (value: RowId | null, details: ChangeDetails<LogListValueChangeReason>) => void;
  /** A press on a row (or Enter or Space on it), with the row in `details.row`. Not called for presses on a control
   *  inside it. */
  onAction?: (value: RowId, details: LogListActionDetails<T>) => void;
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
  /** Shown when there are no rows: a string is the title of a small `EmptyState` (default "No messages"), any other
   *  node is drawn as is, and `null` shows nothing. */
  emptyState?: ReactNode;
  /** Shown after the last row, like "12 more later in the recording". */
  footer?: ReactNode;
  /** Scrolls, follows and moves the marker from outside: `createLogListController()`. */
  controller?: LogListController;
  'aria-label'?: string;
}

type LogListHandle = PrimitiveHandle<typeof logList>;

const parts = createParts(logList, {
  grid: 'div', rows: 'div', cell: 'div', actions: 'div', marker: 'div', 'marker-label': 'div', jump: 'div', empty: 'div', footer: 'div',
});

const HandleContext = createContext<LogListHandle | null>(null);

function useLogList(): LogListHandle {
  const handle = useContext(HandleContext);
  if (!handle) throw new Error('LogList parts must be inside a LogList');
  return handle;
}

/** The Copy button, in the one row that has it: the row under a mouse, or else the active row, which is how touch and
 *  keys reach it. It shows while the pointer's on that row or focus is in the list. */
function LogListCopy({ index }: { index: number }) {
  const { api } = useLogList();
  // The primitive writes the row (its text, `onRowCopy`, the clipboard) and announces it, as ⌘C does; useCopy keeps the
  // check showing for a moment.
  const { copy, copied } = useCopy({
    write: () => api.internal.copy(index).then((ok) => { if (!ok) throw new Error('not copied'); }),
    announcement: '',
  });
  const done = copied !== null;
  return (
    <parts.Actions className="invisible absolute end-1 bottom-[calc(var(--log-pad)-2px)] z-1 group-focus-within/grid:visible group-hover/row:visible @[480px]:top-[calc(var(--log-pad)-2px)] @[480px]:bottom-auto">
      <Button
        variant="quiet"
        size="icon-sm"
        aria-label={done ? 'Copied' : 'Copy this row'}
        title={done ? 'Copied' : 'Copy'}
        onClick={() => void copy('')}
        className="bg-card shadow-hairline hover:not-data-disabled:bg-card active:not-data-disabled:bg-secondary"
      >
        <Icon name={done ? 'check' : 'copy'} size={12} sw={2.2} className={done ? 'text-success' : undefined} />
      </Button>
    </parts.Actions>
  );
}

interface RowContentProps {
  row: LogRow;
  index: number;
  selected: boolean;
  expanded: boolean;
  cut: boolean;
  disclosure: boolean;
  formatTime: (ms: number) => string;
  renderRow: ((row: never, state: LogRowState) => ReactNode) | undefined;
}

/** A row's content, on its own so that what only its row element shows (where it is, the Copy button) renders none of it. */
const RowContent = memo(function RowContent({ row, index, selected, expanded, cut, disclosure, formatTime, renderRow }: RowContentProps) {
  return (
    <parts.Cell className={CELL_CLASS}>
      {renderRow
        ? renderRow(row as never, { index, selected, expanded, cut, disclosure, formatTime })
        : <LogRowContent row={row} expanded={expanded} cut={cut} disclosure={disclosure} formatTime={formatTime} />}
    </parts.Cell>
  );
});

interface LogListRowProps extends Omit<RowContentProps, 'selected' | 'expanded'> {
  /** The row's top among the rows, in px. */
  start: number;
  copyable: boolean;
}

const LogListRow = memo(function LogListRow({ row, index, start, copyable, ...content }: LogListRowProps) {
  return usePart(logList, 'row', { id: String(index), index, value: row.id, level: normalizeLogLevel(row.level), detail: row.detail != null }, {
    className: ROW_CLASS,
    style: { transform: `translateY(${start}px)` },
    children: (state) => (
      <>
        <RowContent row={row} index={index} selected={state.selected} expanded={state.expanded} {...content} />
        {copyable && state.actions ? <LogListCopy index={index} /> : null}
      </>
    ),
  }, 'div');
});

interface LogListBodyProps extends Omit<PartProps<'div'>, 'children'>, VariantProps<typeof logListVariants> {
  handle: LogListHandle;
  rows: readonly LogRow[];
  cut: boolean;
  copyable: boolean;
  markerLabel: ReactNode;
  jumpLabel: ReactNode;
  renderRow: RowContentProps['renderRow'];
  formatTime: (ms: number) => string;
  emptyState: ReactNode;
  footer: ReactNode;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  'aria-label'?: string;
}

const LogListBody = memo(function LogListBody({
  handle, rows, cut, copyable, markerLabel, jumpLabel, renderRow, formatTime, emptyState, footer, density, className, onKeyDown,
  'aria-label': ariaLabel = 'Log', ...props
}: LogListBodyProps) {
  const { api } = handle;
  const { virtual } = api.internal.rows;
  const items = useSyncExternalStore(virtual.subscribe, virtual.items, virtual.items);
  const disclosure = useMemo(() => cut || rows.some((row) => row.detail != null), [cut, rows]);

  return usePart(handle, 'root', {}, {
    ...({ 'data-rows': rows.length } as object),
    className: cx(logListVariants({ density }), className),
    ...props,
    children: (
      <HandleContext.Provider value={handle}>
        <parts.Grid
          aria-label={ariaLabel}
          onKeyDown={onKeyDown}
          className="group/grid bl-scroll relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain outline-none [overflow-anchor:none]"
        >
          <parts.Rows
            className={cn(
              'relative w-full',
              disclosure ? '[--log-toggle:10px]' : '[--log-toggle:0px]',
              // Beside the message there's a column kept for Copy, so it never covers a row's time. Under it, Copy sits at the
              // end of the line of time and source, which rarely reaches that far.
              copyable ? '[--log-end:8px] @[480px]:[--log-end:28px]' : '[--log-end:8px]',
            )}
          >
            {items.map((item) => {
              const row = rows[item.index];
              return row ? (
                <LogListRow
                  key={item.index}
                  row={row}
                  index={item.index}
                  start={item.start}
                  copyable={copyable}
                  cut={cut}
                  disclosure={cut || row.detail != null}
                  formatTime={formatTime}
                  renderRow={renderRow}
                />
              ) : null;
            })}
            <parts.Marker className="pointer-events-none absolute inset-x-0 top-0 z-3 h-0">
              <div className="absolute inset-x-0 -top-px h-0.5 bg-primary" />
              <div className="absolute start-0.5 -top-1 size-2 rounded-full bg-primary" />
              {markerLabel != null ? (
                <parts.MarkerLabel className="absolute end-2 -top-[7px] flex h-3.5 items-center rounded-full bg-primary px-1.5 text-caption2 leading-none font-semibold whitespace-nowrap text-primary-foreground @[480px]:end-1/2 @[480px]:translate-x-1/2">{markerLabel}</parts.MarkerLabel>
              ) : null}
            </parts.Marker>
          </parts.Rows>
          <parts.Empty>{emptyState === undefined || typeof emptyState === 'string'
            ? <EmptyState size="sm" title={emptyState ?? 'No messages'} />
            : emptyState}</parts.Empty>
          {footer != null ? <parts.Footer className="px-3 py-2 text-center text-caption text-muted-foreground">{footer}</parts.Footer> : null}
        </parts.Grid>
        <parts.Jump className="pointer-events-none absolute inset-x-0 z-4 flex justify-center data-[side=above]:top-2 data-[side=below]:bottom-2">
          {(state) => (
            <Button size="sm" onClick={(event) => api.followPosition(event.nativeEvent)} className="pointer-events-auto h-7 gap-1 rounded-full px-3 text-caption shadow-hairline">
              <Icon name={state.away === 'above' ? 'arrow-up' : 'arrow-down'} size={12} sw={2.4} />
              {jumpLabel ?? (state.marker ? 'Back to current' : 'Back to latest')}
            </Button>
          )}
        </parts.Jump>
      </HandleContext.Provider>
    ),
  }, 'div');
});

export function LogList<T extends LogRow = LogRow>({
  rows, currentId = null, currentTime = null, value, defaultValue, onValueChange, expanded, defaultExpanded, onExpandedChange, onAction,
  follow = true, followTail = false, onFollowingChange, overflow = 'wrap', expandOnPress, copyable = true, getRowText, onRowCopy,
  renderRow, formatTime = formatLogTime, estimatedRowHeight, markerLabel, jumpLabel, emptyState, footer, controller, ...props
}: LogListProps<T>) {
  // This is why a moving marker costs no rows: `currentId` and `currentTime` stop here, in the shell. The body below
  // only renders for what its own props change, and the marker is live state, written to the page with no render.
  const options: LogListOptions<T> = {
    rows, currentId, currentTime, value, defaultValue, onValueChange, expanded, defaultExpanded, onExpandedChange, onAction, follow, followTail, onFollowingChange,
    overflow, expandOnPress, copyable, getRowText, onRowCopy, formatTime, controller,
    rowHeight: estimatedRowHeight ?? ROW_ESTIMATE[props.density ?? 'compact'],
  };
  const handle = usePrimitive(logList, options as unknown as LogListOptions);
  return (
    <LogListBody
      handle={handle}
      rows={rows}
      cut={overflow === 'expand'}
      copyable={copyable}
      markerLabel={markerLabel}
      jumpLabel={jumpLabel}
      renderRow={renderRow as RowContentProps['renderRow']}
      formatTime={formatTime}
      emptyState={emptyState}
      footer={footer}
      {...props}
    />
  );
}

export {
  createLogListController, type LogListActionDetails, type LogListController, type LogListExpandedChangeReason,
  type LogListFollowingChangeReason, type LogListValueChangeReason,
} from '@/lib/log-list-primitive';

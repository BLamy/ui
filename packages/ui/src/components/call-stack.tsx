'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import {
  Tree, TreeItem, TreeItemIndicator, TreeItemLabel, visibleTreeRows, type TreeItemData, type TreeValueChangeReason,
} from '@ui-sdk/react/tree';
import type { ChangeDetails } from '@ui-sdk/core';
import { cva } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger, createPopoverController, type PopoverController } from '@/components/ui/popover';
import {
  buildCallStackRows, frameText, fullLocation, reuseCallStackRows, shortLocation,
  type CallStackFrame, type CallStackLocation, type CallStackRow, type CallStackSection,
} from '@/lib/call-stack-model';
import { Icon } from '@/lib/icon';
import { useVirtualRows } from '@/lib/use-virtual-rows';
import { cn } from '@/lib/utils';

/* ══ CallStack — frames as a debugger lists them, on UI SDK's Tree over its virtualizer: arrow keys move and select,
   typing finds a frame, and a stack of thousands of frames only has the rows on screen in the DOM. A run of framework
   and library frames is a branch that folds into one row (Right and Left open and close it), an async boundary is a
   labelled row the keyboard steps over, and a location shows short with all of it a press (or Return) away.
   <CallStack frames={frames} value={frameId} onValueChange={(id) => setFrameId(id)} /> ══ */

/** What `onValueChange` gets after the frame's id: UI SDK's change details, with the frame itself. */
export type CallStackValueChangeDetails = ChangeDetails<TreeValueChangeReason> & {
  frame: CallStackFrame;
  /** Where the frame is in `frames`. */
  index: number;
};

export interface CallStackProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue' | 'onChange'> {
  frames: readonly CallStackFrame[];
  /** The selected frame's id. Leave it out for a list that remembers its own. */
  value?: string | null;
  /** Selected when the list mounts, when `value` is left out. */
  defaultValue?: string | null;
  /** A frame was pressed, or the arrow keys reached it. `details.reason` says which, and `details.cancel()` refuses it. */
  onValueChange?: (value: string, details: CallStackValueChangeDetails) => void;
  /** Fold runs of framework and library frames. Default `true`. */
  collapseRuns?: boolean;
  /** Runs open when the list mounts, each named by its first frame's id. */
  defaultExpandedRuns?: Iterable<string>;
  /** Row height in px. Default 26. */
  rowHeight?: number;
  /** Shown when there are no frames. */
  emptyMessage?: ReactNode;
  'aria-label'?: string;
}

/** A row's label, inside its item. Keyboard focus is on the item around it (`group/row`). */
export const callStackRowVariants = cva(
  [
    'flex h-full w-full cursor-default items-center gap-1.5 pr-2 text-caption leading-none text-foreground',
    'hover:bg-accent/50 data-selected:bg-accent group-focus-visible/row:[box-shadow:inset_0_0_0_2px_var(--ring)]',
  ],
  {
    variants: {
      kind: { app: '', framework: 'text-muted-foreground data-selected:text-foreground', run: 'font-sans text-muted-foreground' },
      inRun: { true: 'pl-5', false: 'pl-1' },
    },
    defaultVariants: { inRun: false },
  },
);

/** A row holds a button of its own: pressing it, or a key on it, isn't a press on the row. */
const stop = (e: MouseEvent | KeyboardEvent) => e.stopPropagation();

/** The file and line, cut from the left when they don't fit, so the line number stays. A press shows the whole path. */
function LocationButton({ location, controller }: { location: CallStackLocation; controller: PopoverController<CallStackLocation> }) {
  const full = fullLocation(location);
  return (
    <PopoverTrigger
      controller={controller}
      payload={location}
      title={full}
      aria-label={`Location: ${full}`}
      tabIndex={-1}
      onClick={stop}
      onDoubleClick={stop}
      onKeyDown={stop}
      className="max-w-[55%] min-w-0 shrink-0 cursor-default overflow-hidden rounded-md border-0 bg-transparent px-1 py-0.5 text-right font-mono text-caption2 text-muted-foreground outline-none hover:bg-secondary-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span dir="rtl" className="block truncate"><bdi>{shortLocation(location)}</bdi></span>
    </PopoverTrigger>
  );
}

/** The whole path of the location that was pressed, with a button to copy it. One popover serves every row. */
function LocationPopover({ controller }: { controller: PopoverController<CallStackLocation> }) {
  const [location, setLocation] = useState<CallStackLocation | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  const full = location ? fullLocation(location) : '';
  return (
    <Popover controller={controller} onPayloadChange={(payload) => { setLocation((payload as CallStackLocation | undefined) ?? null); clearTimeout(copiedTimer.current); setCopied(false); }}>
      <PopoverContent variant="surface" side="bottom" align="end" className="flex max-h-[min(24rem,var(--available-height,24rem))] w-[min(26rem,var(--available-width,26rem))] overflow-auto min-w-0 items-start gap-2 p-3">
        <PopoverTitle className="sr-only">Location</PopoverTitle>
        <span className="min-w-0 flex-1 font-mono text-caption break-all text-foreground select-text">{full}</span>
        <Button
          size="sm"
          variant="ghost"
          className="-my-1 h-6 shrink-0 px-2 text-caption"
          onClick={() => {
            void navigator.clipboard?.writeText(full).then(() => {
              setCopied(true);
              clearTimeout(copiedTimer.current);
              copiedTimer.current = setTimeout(() => setCopied(false), 1200);
            }, () => {});
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/** What a row of the list draws: a frame, a folded run, or the labelled line at an async boundary. */
type Line = CallStackRow | { kind: 'separator'; key: string; label: string };

/** The sections as the Tree's data, so it knows every row, in the DOM or not: a run is a branch with the frames it
 *  shows inside it, and an async boundary is a disabled item, which the keyboard steps over. */
function treeOf(sections: readonly CallStackSection[]) {
  const items: TreeItemData[] = [];
  const lines = new Map<string, Line>();
  const expanded: string[] = [];
  for (const section of sections) {
    if (section.label !== undefined) {
      items.push({ value: section.key, label: section.label, disabled: true });
      lines.set(section.key, { kind: 'separator', key: section.key, label: section.label });
    }
    let run: TreeItemData[] | null = null;
    for (const row of section.rows) {
      lines.set(row.key, row);
      if (row.kind === 'run') {
        run = row.expanded ? [] : null;
        if (row.expanded) expanded.push(row.key);
        items.push({ value: row.key, label: row.label, children: run ?? [] });
        continue;
      }
      const item = { value: row.key, label: row.isTop ? `${frameText(row.frame)}, stopped here` : frameText(row.frame) };
      if (row.inRun && run) run.push(item);
      else {
        run = null;
        items.push(item);
      }
    }
  }
  return { items, lines, expanded };
}

const headerClass = 'flex h-full items-center gap-2 pr-2 pl-1 font-sans text-caption2 font-medium text-muted-foreground';
const itemClass = 'group/row absolute inset-x-0 outline-none';

function Row({ line, top, height, locations }: { line: Line; top: number; height: number; locations: PopoverController<CallStackLocation> }) {
  const style = { top, height };
  if (line.kind === 'separator') {
    return (
      <TreeItem value={line.key} disabled data-key={line.key} data-row="separator" className={itemClass} style={style}>
        <TreeItemLabel className={headerClass}>
          <span className="h-px w-3 shrink-0 bg-border" />
          <span className="min-w-0 truncate">{line.label}</span>
          <span className="h-px min-w-3 flex-1 bg-border" />
        </TreeItemLabel>
      </TreeItem>
    );
  }
  if (line.kind === 'run') {
    return (
      <TreeItem value={line.key} data-key={line.key} data-row="run" className={itemClass} style={style}>
        <TreeItemLabel className={callStackRowVariants({ kind: 'run' })}>
          <TreeItemIndicator className="grid size-4 shrink-0 place-items-center">
            <Icon name="chevron-right" size={10} sw={3} className="transition-transform duration-100 group-data-expanded/row:rotate-90 motion-reduce:transition-none" />
          </TreeItemIndicator>
          <span className="min-w-0 flex-1 truncate">{line.label}</span>
        </TreeItemLabel>
      </TreeItem>
    );
  }
  const { frame } = line;
  const kind = frame.kind === 'framework' || frame.kind === 'library' ? 'framework' : 'app';
  return (
    <TreeItem value={line.key} data-key={line.key} data-row="frame" data-kind={frame.kind ?? 'app'} data-top={line.isTop || undefined} className={itemClass} style={style}>
      <TreeItemLabel className={callStackRowVariants({ kind, inRun: line.inRun })}>
        {/* The row's text starts with the frame's name, which is what typing finds it by. */}
        <span className="grid size-4 shrink-0 place-items-center" title={line.isTop ? 'Stopped here' : undefined}>
          {line.isTop ? <Icon name="play" size={10} className="text-warning" /> : null}
        </span>
        <span className={cn('min-w-0 flex-1 truncate font-sans text-footnote', line.isTop && 'font-semibold', !frame.functionName && 'italic')}>
          {frame.functionName || '(anonymous)'}
          {line.isTop ? <span className="sr-only">, stopped here</span> : null}
        </span>
        {frame.location ? <LocationButton location={frame.location} controller={locations} /> : null}
      </TreeItemLabel>
    </TreeItem>
  );
}

/** How long to wait, after one lot of new data has finished going in, before taking the next. */
const PACE_MS = 16;

/** The latest value: at once when things are quiet, and while new ones keep coming (a playhead dragged through thousands
 *  of steps) the newest every so often, skipping those in between. The wait starts after the last one has committed, so
 *  a slow render makes it take fewer. Without this, new rows every frame hit React's limit on nested updates. */
function usePaced<T>(value: T): T {
  const [paced, setPaced] = useState({ value, quiet: true });
  const latest = useRef(value);
  latest.current = value;
  let current = paced;
  if (current.quiet && !Object.is(current.value, value)) {
    current = { value, quiet: false };
    setPaced(current);
  }
  useEffect(() => {
    if (current.quiet) return undefined;
    const timer = setTimeout(() => {
      setPaced((p) => (Object.is(p.value, latest.current) ? { value: p.value, quiet: true } : { value: latest.current, quiet: false }));
    }, PACE_MS);
    return () => clearTimeout(timer);
  }, [current]);
  return current.value;
}

export function CallStack({
  frames: framesProp, value, defaultValue, onValueChange, collapseRuns = true, defaultExpandedRuns, rowHeight = 26, emptyMessage = 'No frames', className, style,
  'aria-label': ariaLabel = 'Call stack', ...props
}: CallStackProps) {
  const [ownValue, setOwnValue] = useState(defaultValue ?? null);
  // Frames and the selection move together: the selected frame is usually one of the new ones.
  const { frames, selected } = usePaced(useMemo(
    () => ({ frames: framesProp, selected: value === undefined ? ownValue : value }),
    [framesProp, value, ownValue],
  ));
  const [expandedRuns, setExpandedRuns] = useState<ReadonlySet<string>>(() => new Set(defaultExpandedRuns));

  const lastSections = useRef<CallStackSection[] | null>(null);
  const sections = useMemo(() => {
    const next = buildCallStackRows(frames, { selectedId: selected, expandedRuns, collapse: collapseRuns });
    lastSections.current = reuseCallStackRows(lastSections.current, next);
    return lastSections.current;
  }, [frames, selected, expandedRuns, collapseRuns]);

  /* The Tree gets every row as data, and draws the ones in view. */
  const { items, lines, expanded } = useMemo(() => treeOf(sections), [sections]);
  const flat = useMemo(() => visibleTreeRows(items, expanded), [items, expanded]);
  const indexOf = useMemo(() => new Map(flat.map((r, i) => [r.item.value, i])), [flat]);
  /** The row with keyboard focus stays in the DOM while it is scrolled away. */
  const focusedKey = useRef<string | null>(null);
  const virtual = useVirtualRows({
    rows: flat,
    count: flat.length,
    rowHeight,
    keyOf: (index) => flat[index]?.item.value ?? String(index),
    keep: () => {
      const index = focusedKey.current == null ? undefined : indexOf.get(focusedKey.current);
      return index === undefined ? [] : [index];
    },
  });
  const locations = useMemo(() => createPopoverController<CallStackLocation>(), []);

  const scroller = useRef<HTMLDivElement | null>(null);
  const { scrollerRef } = virtual;
  const setScroller = useCallback((el: HTMLDivElement | null) => {
    scroller.current = el;
    return scrollerRef(el);
  }, [scrollerRef]);

  /* Selected from outside (a step into another frame, say): bring it into view. A step lands at the nearest edge; a
     jump lands mid-list, with the frames around it on show. */
  const live = useRef({ indexOf, rowHeight, scrollToIndex: virtual.scrollToIndex });
  live.current = { indexOf, rowHeight, scrollToIndex: virtual.scrollToIndex };
  useEffect(() => {
    const list = scroller.current;
    const index = selected == null ? undefined : live.current.indexOf.get(selected);
    if (!list || index === undefined) return;
    const top = index * live.current.rowHeight;
    const view = list.clientHeight;
    const away = Math.max(list.scrollTop - top, top + live.current.rowHeight - (list.scrollTop + view));
    live.current.scrollToIndex(index, { align: away > view ? 'center' : 'auto' });
  // Only when the selection moves: scrolling away from it afterward is the user's to do.
  }, [selected]);

  return (
    <div data-slot="call-stack" className={cn('flex h-full min-h-0 w-full min-w-0 flex-col', className)} style={style} {...props}>
      <div
        ref={setScroller}
        data-slot="call-stack-scroller"
        className="bl-scroll min-h-0 flex-1 overflow-auto"
        onFocusCapture={(e) => { focusedKey.current = (e.target as Element).closest?.('[data-key]')?.getAttribute('data-key') ?? null; }}
        onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) focusedKey.current = null; }}
      >
        {flat.length ? (
          <Tree
            aria-label={ariaLabel}
            items={items}
            // Selection follows the arrow keys, as a debugger's stack does.
            activation="automatic"
            focusableWhenDisabled={false}
            value={selected != null && indexOf.has(selected) ? selected : null}
            onValueChange={(key, details) => {
              const line = key == null ? undefined : lines.get(key);
              // Only a frame is ever selected, and one always is: a run opens, and a second press on a frame keeps it.
              if (line?.kind !== 'frame') return details.cancel();
              onValueChange?.(line.frame.id, Object.assign(details, { frame: line.frame, index: line.index }));
              if (!details.canceled) setOwnValue(line.frame.id);
            }}
            expanded={expanded}
            onExpandedChange={(next) => {
              const open = new Set(next);
              // A run may show as two rows, around the selected frame: they open and close as one.
              const changed = new Set<string>();
              for (const [key, line] of lines) if (line.kind === 'run' && line.expanded !== open.has(key)) changed.add(line.runId);
              if (!changed.size) return;
              setExpandedRuns((runs) => {
                const result = new Set(runs);
                for (const runId of changed) if (!result.delete(runId)) result.add(runId);
                return result;
              });
            }}
            // The location's own button is out of the tab order: Return on a frame shows the whole path.
            onAction={(key, details) => {
              const line = lines.get(key);
              if (details.event?.type !== 'keydown' || line?.kind !== 'frame' || !line.frame.location) return;
              const anchor = scroller.current?.querySelector(`[data-key="${CSS.escape(key)}"] button`);
              void locations.open({ payload: line.frame.location, ...(anchor ? { anchor } : {}) });
            }}
            onHighlight={(_key, { index }) => virtual.scrollToIndex(index)}
            className="relative w-full outline-none"
            style={{ height: virtual.size }}
          >
            {virtual.items.map(({ index, start }) => {
              const line = lines.get(flat[index]?.item.value ?? '');
              return line ? <Row key={line.key} line={line} top={start} height={rowHeight} locations={locations} /> : null;
            })}
          </Tree>
        ) : (
          <div className="px-3 py-6 text-center text-footnote text-muted-foreground">{emptyMessage}</div>
        )}
      </div>
      <LocationPopover controller={locations} />
    </div>
  );
}

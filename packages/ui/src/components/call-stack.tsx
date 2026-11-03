'use client';
import { useEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import {
  Collection, Dialog as AriaDialog, DialogTrigger, GridList, GridListHeader, GridListItem, GridListSection, ListLayout, Virtualizer, type Selection,
} from 'react-aria-components';
import { cva } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { PlainButton } from '@/components/ui/plain-button';
import { Popover } from '@/components/ui/popover';
import {
  buildCallStackRows, callStackRowOffset, frameText, fullLocation, reuseCallStackRows, shortLocation,
  type CallStackFrame, type CallStackLocation, type CallStackRow, type CallStackSection,
} from '@/lib/call-stack';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* ══ CallStack — frames as a debugger lists them, on react-aria's GridList under its Virtualizer: arrow keys move and
   select, and a stack of thousands of frames only has the rows on screen in the DOM. Runs of framework and library
   frames fold into one row, async boundaries are labelled separators, and a location shows short with all of it a press
   away.
   <CallStack frames={frames} selectedId={frameId} onSelect={(frame) => setFrameId(frame.id)} /> ══ */

export interface CallStackProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> {
  frames: readonly CallStackFrame[];
  /** The selected frame. Leave it out for a list that remembers its own. */
  selectedId?: string | null;
  /** Selected when the list mounts, when `selectedId` is left out. */
  defaultSelectedId?: string | null;
  /** A frame was pressed, or the arrow keys reached it. */
  onSelect?: (frame: CallStackFrame, index: number) => void;
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

export const callStackRowVariants = cva(
  [
    'group/row flex h-full w-full cursor-default items-center gap-1.5 pr-2 text-caption leading-none text-foreground outline-none',
    'data-hovered:bg-accent/50 data-selected:bg-accent data-focus-visible:[box-shadow:inset_0_0_0_2px_var(--ring)]',
  ],
  {
    variants: {
      kind: { app: '', framework: 'text-muted-foreground data-selected:text-foreground', run: 'font-sans text-muted-foreground' },
      inRun: { true: 'pl-5', false: 'pl-1' },
    },
    defaultVariants: { inRun: false },
  },
);

/** The file and line, cut from the left when they don't fit, so the line number stays. A press shows the whole path. */
function LocationButton({ location }: { location: CallStackLocation }) {
  const [copied, setCopied] = useState(false);
  const [boundary, setBoundary] = useState<HTMLElement | undefined>(undefined);
  const full = fullLocation(location);
  return (
    <DialogTrigger>
      <PlainButton
        title={full}
        onPress={(e) => setBoundary(e.target.closest<HTMLElement>('[data-slot="bl-provider"]') ?? undefined)}
        aria-label={`Location: ${full}`}
        excludeFromTabOrder
        className="max-w-[55%] min-w-0 shrink-0 cursor-default overflow-hidden rounded-md border-0 bg-transparent px-1 py-0.5 text-right font-mono text-caption2 text-muted-foreground outline-none data-hovered:bg-secondary-strong data-hovered:text-foreground data-focus-visible:ring-2 data-focus-visible:ring-ring"
      >
        <span dir="rtl" className="block truncate"><bdi>{shortLocation(location)}</bdi></span>
      </PlainButton>
      <Popover placement="bottom end" boundaryElement={boundary} className="w-[min(26rem,calc(100vw-1.5rem))] min-w-0">
        <AriaDialog aria-label="Location" data-slot="call-stack-location" className="flex items-start gap-2 p-3 outline-none">
          <span className="min-w-0 flex-1 font-mono text-caption break-all text-foreground select-text">{full}</span>
          <Button
            size="sm"
            variant="ghost"
            className="-my-1 h-6 shrink-0 px-2 text-caption"
            onPress={() => {
              void navigator.clipboard?.writeText(full).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }, () => {});
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </AriaDialog>
      </Popover>
    </DialogTrigger>
  );
}

/** A run row can't be selected and acts on a press. A frame has no action, so touch selects it with a tap as well. */
const renderRow = (toggleRun: (runId: string) => void) => (row: CallStackRow) => {
  if (row.kind === 'run') {
    return (
      <GridListItem id={row.key} data-slot="call-stack-run" textValue={`${row.label}, ${row.expanded ? 'open' : 'closed'}`} isDisabled onAction={() => toggleRun(row.runId)} className={callStackRowVariants({ kind: 'run' })}>
        <span className="grid size-4 shrink-0 place-items-center">
          <Icon name="chevron-right" size={10} sw={3} className={cn('transition-transform duration-100 motion-reduce:transition-none', row.expanded && 'rotate-90')} />
        </span>
        <span className="min-w-0 flex-1 truncate">{row.label}</span>
      </GridListItem>
    );
  }
  const { frame } = row;
  const kind = frame.kind === 'framework' || frame.kind === 'library' ? 'framework' : 'app';
  return (
    <GridListItem id={row.key} data-slot="call-stack-frame" data-kind={frame.kind ?? 'app'} data-top={row.isTop || undefined} textValue={row.isTop ? `${frameText(frame)}, stopped here` : frameText(frame)} className={callStackRowVariants({ kind, inRun: row.inRun })}>
      <span className="grid size-4 shrink-0 place-items-center">
        {row.isTop ? <Icon name="play" size={10} className="text-warning" title="Stopped here" /> : null}
      </span>
      <span className={cn('min-w-0 flex-1 truncate font-sans text-footnote', row.isTop && 'font-semibold', !frame.functionName && 'italic')}>
        {frame.functionName || '(anonymous)'}
      </span>
      {frame.location ? <LocationButton location={frame.location} /> : null}
    </GridListItem>
  );
};

const headerClass = 'flex h-full items-center gap-2 pr-2 pl-1 font-sans text-caption2 font-medium text-muted-foreground';

const renderSection = (row: ReturnType<typeof renderRow>) => (section: CallStackSection) => {
  return (
    <GridListSection id={section.key} aria-label={section.label ?? 'Stack'} className="contents">
      {section.label !== undefined ? (
        <GridListHeader data-slot="call-stack-separator" className={headerClass}>
          <span className="h-px w-3 shrink-0 bg-border" />
          <span className="min-w-0 truncate">{section.label}</span>
          <span className="h-px min-w-3 flex-1 bg-border" />
        </GridListHeader>
      ) : null}
      <Collection items={section.rows}>{row}</Collection>
    </GridListSection>
  );
};

/** How long to wait, after one lot of new data has finished going in, before taking the next. */
const PACE_MS = 16;

/** The latest value: at once when things are quiet, and while new ones keep coming (a playhead dragged through thousands
 *  of steps) the newest every so often, skipping those in between. The wait starts after the last one has committed, so
 *  a slow render makes it take fewer. Without this, new keys every frame hit React's limit on nested updates. */
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
  frames: framesProp, selectedId, defaultSelectedId, onSelect, collapseRuns = true, defaultExpandedRuns, rowHeight = 26, emptyMessage = 'No frames', className, style,
  'aria-label': ariaLabel = 'Call stack', ...props
}: CallStackProps) {
  const [ownSelected, setOwnSelected] = useState(defaultSelectedId ?? null);
  // Frames and the selection move together: the selected frame is usually one of the new ones.
  const { frames, selected } = usePaced(useMemo(
    () => ({ frames: framesProp, selected: selectedId === undefined ? ownSelected : selectedId }),
    [framesProp, selectedId, ownSelected],
  ));
  const [expandedRuns, setExpandedRuns] = useState<ReadonlySet<string>>(() => new Set(defaultExpandedRuns));

  const lastSections = useRef<CallStackSection[] | null>(null);
  const sections = useMemo(() => {
    const next = buildCallStackRows(frames, { selectedId: selected, expandedRuns, collapse: collapseRuns });
    lastSections.current = reuseCallStackRows(lastSections.current, next);
    return lastSections.current;
  }, [frames, selected, expandedRuns, collapseRuns]);

  const rowsByKey = useMemo(() => {
    const map = new Map<string, CallStackRow>();
    for (const section of sections) for (const row of section.rows) map.set(row.key, row);
    return map;
  }, [sections]);

  const renderSections = useMemo(() => renderSection(renderRow((runId) => setExpandedRuns((runs) => {
    const next = new Set(runs);
    if (!next.delete(runId)) next.add(runId);
    return next;
  }))), []);

  /* Selected from outside (a step into another frame, say): bring it into view. Rows have one height, so this is sums. */
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (!list || selected == null) return undefined;
    const offset = callStackRowOffset(sections, selected);
    if (offset === null) return undefined;
    const top = offset * rowHeight;
    const reveal = () => {
      const view = list.clientHeight;
      const above = list.scrollTop - top;
      const below = top + rowHeight - (list.scrollTop + view);
      if (above <= 0 && below <= 0) return;
      // A step lands at the nearest edge; a jump lands mid-list, with the frames around it on show.
      if (Math.max(above, below) > view) list.scrollTop = Math.max(0, top - (view - rowHeight) / 2);
      else list.scrollTop = above > 0 ? top : top + rowHeight - view;
    };
    reveal();
    // On mount the virtualizer hasn't sized its content yet, and there's nowhere to scroll to until it has.
    if (top + rowHeight <= list.scrollHeight) return undefined;
    const frame = requestAnimationFrame(reveal);
    return () => cancelAnimationFrame(frame);
  // Only when the selection moves: scrolling away from it afterward is the user's to do.
  }, [selected]);

  const layoutOptions = useMemo(() => ({ rowSize: rowHeight, headingSize: rowHeight }), [rowHeight]);

  return (
    <div data-slot="call-stack" className={cn('flex h-full max-h-dvh min-h-0 w-full min-w-0 flex-col', className)} style={style} {...props}>
      <Virtualizer layout={ListLayout} layoutOptions={layoutOptions}>
        <GridList
          ref={listRef}
          aria-label={ariaLabel}
          items={sections}
          selectionMode="single"
          selectionBehavior="replace"
          disallowEmptySelection
          disabledBehavior="selection"
          selectedKeys={selected == null ? [] : [selected]}
          onSelectionChange={(keys: Selection) => {
            if (keys === 'all') return;
            const [key] = keys;
            const row = key == null ? undefined : rowsByKey.get(String(key));
            if (row?.kind !== 'frame') return;
            setOwnSelected(row.frame.id);
            onSelect?.(row.frame, row.index);
          }}
          renderEmptyState={() => <div className="px-3 py-6 text-center text-footnote text-muted-foreground">{emptyMessage}</div>}
          className="bl-scroll min-h-0 flex-1 overflow-auto outline-none"
        >
          {renderSections}
        </GridList>
      </Virtualizer>
    </div>
  );
}

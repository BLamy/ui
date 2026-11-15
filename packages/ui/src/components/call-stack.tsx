'use client';
import { useMemo, useRef, useState, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import type { TreeValueChangeReason } from '@ui-sdk/react/tree';
import type { ChangeDetails } from '@ui-sdk/core';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger, createPopoverController, type PopoverController } from '@/components/ui/popover';
import { Tree, TreeItemIndicator, TreeItemLabel, type TreeDensity, type TreeNode } from '@/components/ui/tree';
import {
  buildCallStackRows, frameText, fullLocation, reuseCallStackRows, shortLocation,
  type CallStackFrame, type CallStackLocation, type CallStackRow, type CallStackSection,
} from '@/lib/call-stack-model';
import { Icon } from '@/lib/icon';
import { useCopy } from '@/lib/use-copy';
import { usePaced } from '@/lib/use-paced';
import { cn } from '@/lib/utils';

/* ══ CallStack — frames as a debugger lists them ══
   Rows of its own on the kit's Tree (one row look, density scale, selection and virtualizer with Tree and
   ObjectTree): arrow keys move and select, typing finds a frame, and a stack of thousands of frames only has the rows
   on screen in the DOM. A run of framework and library frames is a branch that folds into one row (Right and Left
   open and close it), an async boundary is a labelled row the keyboard steps over, and a location shows short with
   all of it a press (or Return) away.
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
  /** Row height: Tree's scale, `compact` (24px, the default), `default` (30px) or `comfortable` (36px, for touch). */
  density?: TreeDensity;
  /** Shown when there are no frames: a node, or the title of the kit's `EmptyState`. Default "No frames". */
  emptyState?: ReactNode;
  /** The list's name. Default "Call stack". */
  'aria-label'?: string;
}

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
  const { copy, copied } = useCopy<string>();
  const full = location ? fullLocation(location) : '';
  return (
    <Popover controller={controller} onPayloadChange={(payload) => setLocation((payload as CallStackLocation | undefined) ?? null)}>
      <PopoverContent variant="plain" side="bottom" align="end" className="flex max-h-[min(24rem,var(--available-height,24rem))] w-[min(26rem,var(--available-width,26rem))] overflow-auto min-w-0 items-start gap-2 p-3">
        <PopoverTitle className="sr-only">Location</PopoverTitle>
        <span className="min-w-0 flex-1 font-mono text-caption break-all text-foreground select-text">{full}</span>
        <Button size="sm" variant="ghost" className="-my-1 h-6 shrink-0 px-2 text-caption" onClick={() => void copy(full, full)}>
          {copied === full ? 'Copied' : 'Copy'}
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
  const items: TreeNode[] = [];
  const lines = new Map<string, Line>();
  const expanded: string[] = [];
  for (const section of sections) {
    if (section.label !== undefined) {
      items.push({ value: section.key, label: section.label, disabled: true });
      lines.set(section.key, { kind: 'separator', key: section.key, label: section.label });
    }
    let run: TreeNode[] | null = null;
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

/** A frame inside a run sits one level in, also when it shows on its own beside its folded run. */
const inRunClass = 'ps-[calc(var(--tree-pad-x)+var(--tree-indent))]';

function Row({ line, locations }: { line: Line; locations: PopoverController<CallStackLocation> }) {
  if (line.kind === 'separator') {
    return (
      <TreeItemLabel data-row="separator" className="gap-2 font-sans text-caption2 font-medium text-muted-foreground data-disabled:opacity-100">
        <span className="h-px w-3 shrink-0 bg-border" />
        <span className="min-w-0 truncate">{line.label}</span>
        <span className="h-px min-w-3 flex-1 bg-border" />
      </TreeItemLabel>
    );
  }
  if (line.kind === 'run') {
    return (
      <TreeItemLabel data-row="run" className="text-caption text-muted-foreground">
        <TreeItemIndicator />
        <span className="min-w-0 flex-1 truncate">{line.label}</span>
      </TreeItemLabel>
    );
  }
  const { frame } = line;
  const framework = frame.kind === 'framework' || frame.kind === 'library';
  return (
    <TreeItemLabel
      data-row="frame"
      data-kind={frame.kind ?? 'app'}
      data-top={line.isTop || undefined}
      className={cn(framework && 'text-muted-foreground data-selected:text-foreground', line.inRun && inRunClass)}
    >
      {/* The row's text starts with the frame's name, which is what typing finds it by. */}
      <span className="grid size-4 shrink-0 place-items-center" title={line.isTop ? 'Stopped here' : undefined}>
        {line.isTop ? <Icon name="play" size={10} className="text-warning" /> : null}
      </span>
      <span className={cn('min-w-0 flex-1 truncate', line.isTop && 'font-semibold', !frame.functionName && 'italic')}>
        {frame.functionName || '(anonymous)'}
        {line.isTop ? <span className="sr-only">, stopped here</span> : null}
      </span>
      {frame.location ? <LocationButton location={frame.location} controller={locations} /> : null}
    </TreeItemLabel>
  );
}

export function CallStack({
  frames: framesProp, value, defaultValue, onValueChange, collapseRuns = true, defaultExpandedRuns, density = 'compact', emptyState = 'No frames',
  className, style, 'aria-label': ariaLabel = 'Call stack', ...props
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

  /* The Tree gets every row as data, and draws the ones in view with `renderRow`. */
  const { items, lines, expanded } = useMemo(() => treeOf(sections), [sections]);
  const locations = useMemo(() => createPopoverController<CallStackLocation>(), []);
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} data-slot="call-stack" className={cn('flex h-full min-h-0 w-full min-w-0 flex-col', className)} style={style} {...props}>
      <Tree
        aria-label={ariaLabel}
        items={items}
        icons={false}
        density={density}
        // Selection follows the arrow keys, as a debugger's stack does.
        activation="automatic"
        focusableWhenDisabled={false}
        // Selected from outside (a step into another frame, say), it comes into view: a step lands at the nearest
        // edge, a jump mid-list, with the frames around it on show.
        value={selected != null && lines.get(selected)?.kind === 'frame' ? selected : null}
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
          const anchor = rootRef.current?.querySelector(`[data-key="${CSS.escape(key)}"] button`);
          void locations.open({ payload: line.frame.location, ...(anchor ? { anchor } : {}) });
        }}
        renderRow={(node) => {
          const line = lines.get(node.value);
          return line ? <Row line={line} locations={locations} /> : null;
        }}
        emptyState={emptyState}
        className="min-h-0 flex-1"
      />
      <LocationPopover controller={locations} />
    </div>
  );
}

'use client';
import { createContext, use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { Tree, TreeItem, TreeItemIndicator, TreeItemLabel, visibleTreeRows, type TreeItemData, type TreeValueChangeReason } from '@ui-sdk/react/tree';
import { announce, type ChangeDetails } from '@ui-sdk/core';
import { cva } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { ObjectValue } from '@/components/ui/object-value';
import { PlainButton } from '@/components/ui/plain-button';
import { Popover, PopoverContent, createPopoverController, type PopoverController } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { isRowPress } from '@/lib/grid-behaviors';
import { Icon, type IconName } from '@/lib/icon';
import {
  applyExpanded, buildRows, childrenOfValue, copyTextOfNode, createTreeState, errorText, invokeGetterOfValue, isValueNode, rebaseTreeState,
  retryLoad, rowText, setRowOpen, settleGetter, settleLoad, startGetter, startLoad,
  type ObjectTreeGetterResult, type ObjectTreeNode, type ObjectTreeRoot, type ObjectTreeRow, type ObjectTreeRows, type ObjectTreeState,
} from '@/lib/object-tree-model';
import { previewText } from '@/lib/object-tree-value';
import { useVirtualRows } from '@/lib/use-virtual-rows';
import { cn } from '@/lib/utils';

/* ══ ObjectTree — values as a debugger shows them: scopes, objects opened level by level, any JSON-like data.
   UI SDK's Tree over its virtualizer: arrow keys move, open and close, typing finds a row, and only rows on screen are
   in the DOM. Children load when a row opens, and a node with thousands of them groups in ranges (`[0 … 99]`), so a
   100,000 element array is a few hundred rows.
   <ObjectTree aria-label="Scopes" root={scopes} loadChildren={(node) => readProperties(node)} />
   <ObjectTree aria-label="Response" root={nodeFromValue(json, { defaultExpanded: true })} value={key} onValueChange={(k) => setKey(k)} /> ══ */

/** What `onValueChange` gets after the row's key: UI SDK's change details, with the node itself (`null` when cleared). */
export type ObjectTreeValueChangeDetails<T = unknown> = ChangeDetails<TreeValueChangeReason> & { node: ObjectTreeNode<T> | null };

export interface ObjectTreeProps<T = unknown> extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect' | 'onCopy' | 'defaultValue'> {
  'aria-label': string;
  /** What's at the top level: one node, or several, with `section: true` for Local, Closure and Global. A new `root` is a
   *  new moment: what was loaded goes, and an answer still on its way is dropped. Keep it the same object until it changes. */
  root: ObjectTreeRoot<T>;
  /** A node's children, asked for when it opens and kept after that. `node.data` is there for your own handle. Without
   *  it, nodes from `nodeFromValue` open by themselves. */
  loadChildren?: (node: ObjectTreeNode<T>) => Promise<readonly ObjectTreeNode<T>[]> | readonly ObjectTreeNode<T>[];
  /** Calls a getter: pressing a `(...)`. Return its value, and whether it can open. */
  onInvokeGetter?: (node: ObjectTreeNode<T>) => Promise<ObjectTreeGetterResult<T>> | ObjectTreeGetterResult<T>;
  /** Whether a value's row can be selected. With `'single'` a press selects, and the chevron, a double press or Return
   *  opens. Default: `'single'` when `value`, `defaultValue` or `onValueChange` is given, otherwise `'none'`. */
  mode?: 'single' | 'none';
  /** The selected row's key (`objectTreeKey(ids)`: the node ids from the top down). Leave it out for a tree that
   *  remembers its own; `null` selects nothing. */
  value?: string | null;
  /** Selected when the tree mounts, when `value` is left out. */
  defaultValue?: string | null;
  /** A value was pressed, or cleared. `details.reason` says how, `details.node` is the node, and `details.cancel()`
   *  refuses it. Sections, ranges and notes are never selected. */
  onValueChange?: (value: string | null, details: ObjectTreeValueChangeDetails<T>) => void;
  /** The text copying a value gives. Default: a string's text, JSON for `nodeFromValue` values, otherwise the preview. */
  copyValue?: (node: ObjectTreeNode<T>) => Promise<string> | string;
  /** Indexed children to a range before they group. Default 100. */
  groupSize?: number;
  /** Row height in px. Default 24. */
  rowHeight?: number;
  /** Shown when `root` is an empty list. */
  emptyMessage?: ReactNode;
}

/* ── Rows ── */

/** A row's label, inside its item. The indent stops at a quarter of its width, so deep rows keep room for their name
 *  and value. Keyboard focus is on the item around it (`group/row`). */
export const objectTreeRowVariants = cva(
  [
    'flex h-full w-full cursor-default items-center gap-1 pr-1',
    'pl-[min(calc((var(--tree-level)-1)*var(--object-tree-indent)),25%)]',
    'text-caption leading-none text-foreground',
    'data-selected:bg-accent group-focus-visible/row:[box-shadow:inset_0_0_0_2px_var(--ring)]',
  ],
  {
    variants: {
      kind: {
        node: 'font-mono hover:bg-accent/50',
        section: 'font-sans font-semibold shadow-hairline-b hover:bg-accent/50',
        range: 'font-mono text-muted-foreground hover:bg-accent/50',
        note: 'font-sans text-muted-foreground',
      },
      stale: { true: 'opacity-60' },
    },
  },
);

type ValueRow = Extract<ObjectTreeRow, { kind: 'node' }>;

interface TreeApi {
  canInvokeGetter: (row: ValueRow) => boolean;
  invokeGetter: (row: ValueRow) => void;
  retry: (owner: string) => void;
  copy: (row: ValueRow) => void;
  showValue: (row: ValueRow, anchor: Element | null) => void;
  copiedKey: string | null;
}
const TreeApiContext = createContext<TreeApi | null>(null);

/** A row holds buttons of its own: pressing one, or a key on one, isn't a press on the row. */
const ownPress = {
  onKeyDown: (e: KeyboardEvent) => e.stopPropagation(),
  onDoubleClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
};

const rowButton = 'shrink-0 cursor-default rounded-md border-0 bg-transparent outline-none hover:bg-secondary-strong focus-visible:ring-2 focus-visible:ring-ring';

function RowButton({ icon, label, onUse, active }: { icon: IconName; label: string; onUse: (el: Element) => void; active?: boolean }) {
  return (
    <PlainButton
      aria-label={label}
      title={label}
      tabIndex={-1}
      {...ownPress}
      onClick={(e) => { e.stopPropagation(); onUse(e.currentTarget); }}
      className={cn(rowButton, 'grid size-5 place-items-center p-0 text-muted-foreground hover:text-foreground', active && 'text-success')}
    >
      <Icon name={icon} size={13} />
    </PlainButton>
  );
}

function Chevron() {
  return (
    <TreeItemIndicator className="grid h-full w-4 shrink-0 cursor-default place-items-center text-muted-foreground">
      <Icon name="chevron-right" size={10} sw={3} className="transition-transform duration-100 group-data-expanded/row:rotate-90 motion-reduce:transition-none" />
    </TreeItemIndicator>
  );
}

const noChevron = <span className="size-4 shrink-0" />;

/** A value this long is likely cut off on a narrow row, so its row offers the whole thing. */
const LONG_VALUE = 24;

function NodeRow({ row }: { row: ValueRow }) {
  const api = use(TreeApiContext)!;
  const { node, getter } = row;
  const value = node.value;
  const chevron = row.expandable ? <Chevron /> : noChevron;
  if (node.section) {
    return (
      <>
        {chevron}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
      </>
    );
  }
  const text = value ? previewText(value, { maxString: 2000 }) : '';
  const isGetter = value?.type === 'accessor';
  return (
    <>
      {chevron}
      {node.name ? (
        <span data-slot="object-tree-name" className={cn('flex max-w-[55%] min-w-0 shrink-0 leading-5', node.dim && 'text-muted-foreground')} title={node.name}>
          <span className="min-w-0 truncate">{node.name}</span>
          <span className="text-muted-foreground">:</span>
        </span>
      ) : null}
      {isGetter ? (
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {getter?.status === 'invoking' ? (
            <Spinner spin size={12} label="Calling the getter" className="text-muted-foreground" />
          ) : (
            <PlainButton
              aria-label={`Call the getter ${node.name}`}
              title="Call the getter"
              tabIndex={-1}
              disabled={!api.canInvokeGetter(row)}
              {...ownPress}
              onClick={(e) => { e.stopPropagation(); api.invokeGetter(row); }}
              className={cn(rowButton, 'px-1 py-0.5 font-mono text-caption text-muted-foreground hover:text-foreground')}
            >
              (...)
            </PlainButton>
          )}
          {getter?.status === 'failed' ? <span className="min-w-0 flex-1 truncate font-sans text-destructive" title={getter.error}>{getter.error}</span> : null}
        </span>
      ) : value ? (
        <ObjectValue value={value} expandable={false} title={text} className="min-w-0 flex-1 truncate leading-5 whitespace-pre" />
      ) : <span className="flex-1" />}
      {value && !isGetter ? (
        <span className="hidden shrink-0 items-center group-focus-within/row:flex group-hover/row:flex">
          {text.length > LONG_VALUE ? <RowButton icon="ellipsis" label="Show the whole value" onUse={(el) => api.showValue(row, el)} /> : null}
          <RowButton
            icon={api.copiedKey === row.key ? 'check' : 'copy'}
            label={api.copiedKey === row.key ? 'Copied' : 'Copy the value'}
            active={api.copiedKey === row.key}
            onUse={() => api.copy(row)}
          />
        </span>
      ) : null}
    </>
  );
}

function RowContent({ row }: { row: ObjectTreeRow }) {
  const api = use(TreeApiContext)!;
  switch (row.kind) {
    case 'node':
      return <NodeRow row={row} />;
    case 'range':
      return (
        <>
          <Chevron />
          <span className="min-w-0 flex-1 truncate">{row.label}</span>
        </>
      );
    case 'loading':
      return (
        // Quick answers don't flash: it fades in after a moment.
        <span className="flex items-center gap-1.5 pl-5 transition-opacity delay-150 duration-150 starting:opacity-0 motion-reduce:transition-none">
          <Spinner spin size={12} />
          Loading…
        </span>
      );
    case 'failed':
      return (
        <span className="flex min-w-0 flex-1 items-center gap-1.5 pl-5" title={row.error}>
          <Icon name="warning" size={13} className="text-destructive" />
          <span className="min-w-0 truncate text-destructive">{row.error}</span>
          <PlainButton
            tabIndex={-1}
            {...ownPress}
            onClick={(e) => { e.stopPropagation(); api.retry(row.owner); }}
            className={cn(rowButton, 'px-1 py-0.5 text-caption font-medium text-primary')}
          >
            Retry
          </PlainButton>
        </span>
      );
    case 'empty':
      return <span className="pl-5">No properties</span>;
  }
}

const rowKind = (row: ObjectTreeRow) => (row.kind === 'node' ? (row.node.section ? 'section' : 'node') : row.kind === 'range' ? 'range' : 'note');

/** Selected or not, only a value can be chosen: a press on a section or a range opens it. */
const isSelectable = (row: ObjectTreeRow) => row.kind === 'node' && !row.node.section;

function isBranch(row: ObjectTreeRow) {
  return row.kind === 'range' || (row.kind === 'node' && row.expandable);
}

/** The rows as the Tree's data, so it knows every row that shows, in the DOM or not. A closed row that can open is an
 *  empty branch: its children may not exist yet. Rows that didn't change keep their item. */
function treeItemsOf(rows: readonly ObjectTreeRow[], cache: WeakMap<ObjectTreeRow, TreeItemData>): TreeItemData[] {
  return rows.map((row) => {
    let item = cache.get(row);
    if (!item) {
      const children = 'children' in row && row.children ? treeItemsOf(row.children, cache) : isBranch(row) ? [] : undefined;
      item = { value: row.key, label: rowText(row), ...(children ? { children } : {}) };
      cache.set(row, item);
    }
    return item;
  });
}

function Row({ row, top, height, onOpen }: { row: ObjectTreeRow; top: number; height: number; onOpen?: (row: ObjectTreeRow) => void }) {
  return (
    <TreeItem value={row.key} data-key={row.key} data-kind={rowKind(row)} className="group/row absolute inset-x-0 outline-none" style={{ top, height }}>
      <TreeItemLabel className={objectTreeRowVariants({ kind: rowKind(row), stale: 'stale' in row && row.stale })} onDoubleClick={onOpen ? () => onOpen(row) : undefined}>
        <RowContent row={row} />
      </TreeItemLabel>
    </TreeItem>
  );
}

/* ── The whole value ── */

function ValuePopover({ controller, row, onClose, onCopy, copied }: {
  controller: PopoverController<string>;
  row: ValueRow | undefined;
  onClose: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <Popover controller={controller} onOpenChangeComplete={(open) => { if (!open) onClose(); }}>
      <PopoverContent
        variant="surface"
        side="bottom"
        align="end"
        aria-label={row?.node.name ? `The value of ${row.node.name}` : 'The whole value'}
        className="flex max-h-[min(24rem,var(--available-height,24rem))] min-h-0 w-[min(30rem,var(--available-width,30rem))] min-w-0 flex-col gap-2 p-3"
      >
        {row?.node.value ? (
          <>
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-mono text-caption font-medium">{row.node.name}</span>
              <Button size="sm" variant="ghost" className="h-6 shrink-0 px-2 text-caption" onClick={onCopy}>{copied ? 'Copied' : 'Copy'}</Button>
            </div>
            <div className="bl-scroll min-h-0 overflow-auto">
              <ObjectValue value={row.node.value} maxLength={4000} />
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/* ── The tree ── */

/** The state and the rows it makes, stepped together. */
interface Model<T> {
  state: ObjectTreeState<T>;
  rows: ObjectTreeRows<T>;
  groupSize: number | undefined;
}

function stepModel<T>(model: Model<T>, state: ObjectTreeState<T>): Model<T> {
  return state === model.state ? model : { state, groupSize: model.groupSize, rows: buildRows(state, { groupSize: model.groupSize }, model.rows) };
}

/** Calls something that may answer now, later, or by throwing. */
function settle<V>(ask: () => Promise<V> | V, done: (value: V) => void, failed: (error: unknown) => void) {
  let answer: Promise<V> | V;
  try {
    answer = ask();
  } catch (error) {
    failed(error);
    return;
  }
  if (answer && typeof (answer as Promise<V>).then === 'function') (answer as Promise<V>).then(done, failed);
  else done(answer as V);
}

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

export function ObjectTree<T = unknown>({
  'aria-label': ariaLabel, root: rootProp, loadChildren, onInvokeGetter, mode: modeProp, value, defaultValue, onValueChange, copyValue, groupSize, rowHeight = 24, emptyMessage = 'Nothing to show', className, style, ...props
}: ObjectTreeProps<T>) {
  const root = usePaced(rootProp);
  const [stored, setModel] = useState<Model<T>>(() => {
    const state = createTreeState(root);
    return { state, groupSize, rows: buildRows(state, { groupSize }) };
  });
  // A new root or group size counts at once, in this render: nothing from the old one ever shows under the new.
  let model = stored;
  if (model.state.root !== root || model.groupSize !== groupSize) {
    const state = model.state.root !== root ? rebaseTreeState(model.state, root, model.rows.expandedKeys) : model.state;
    model = { state, groupSize, rows: buildRows(state, { groupSize }, model.groupSize === groupSize ? model.rows : null) };
    setModel(model);
  }
  const { rows } = model;

  const live = useRef({ loadChildren, onInvokeGetter, onValueChange, copyValue, rows });
  live.current = { loadChildren, onInvokeGetter, onValueChange, copyValue, rows };
  const update = useCallback((change: (state: ObjectTreeState<T>) => ObjectTreeState<T>) => {
    setModel((m) => stepModel(m, change(m.state)));
  }, []);
  /** Every load and getter call gets a number: an answer counts only if it's still the one being waited for. */
  const lastToken = useRef(0);

  /* Open rows nobody has asked about yet. A layout effect, so a `loadChildren` that answers at once never shows Loading. */
  const asked = useRef(new WeakSet<object>());
  useLayoutEffect(() => {
    if (asked.current.has(rows)) return;
    asked.current.add(rows);
    const asks = rows.needsLoad.map((ask) => ({ ...ask, token: ++lastToken.current }));
    if (!asks.length) return;
    update((s) => asks.reduce((next, { key, token }) => startLoad(next, key, token), s));
    for (const { key, node, token } of asks) {
      settle(
        () => (live.current.loadChildren ?? childrenOfValue<T>)(node),
        (children) => update((s) => settleLoad(s, key, token, { children })),
        (error) => update((s) => settleLoad(s, key, token, { error: errorText(error) })),
      );
    }
  }, [rows, update]);

  const rootRef = useRef<HTMLDivElement>(null);
  const mode = modeProp ?? (value !== undefined || defaultValue !== undefined || onValueChange ? 'single' : 'none');
  const [ownValue, setOwnValue] = useState<string | null>(defaultValue ?? null);
  const selectedKey = value === undefined ? ownValue : value;
  const [shownValue, setShownValue] = useState<string | null>(null);
  const valuePopover = useMemo(() => createPopoverController<string>(), []);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const api = useMemo<TreeApi>(() => ({
    copiedKey,
    canInvokeGetter: (row) => !row.stale && (!!live.current.onInvokeGetter || isValueNode(row.source)),
    invokeGetter: (row) => {
      if (row.getter?.status === 'invoking' || row.stale || !(live.current.onInvokeGetter || isValueNode(row.source))) return;
      const token = ++lastToken.current;
      update((s) => startGetter(s, row.key, token));
      settle(
        () => (live.current.onInvokeGetter ?? invokeGetterOfValue<T>)(row.source as ObjectTreeNode<T>),
        (result) => update((s) => settleGetter(s, row.key, token, { result })),
        (error) => update((s) => settleGetter(s, row.key, token, { error: errorText(error) })),
      );
    },
    retry: (owner) => update((s) => retryLoad(s, owner)),
    copy: (row) => {
      const node = row.node as ObjectTreeNode<T>;
      settle(
        () => live.current.copyValue?.(node) ?? copyTextOfNode(node),
        (text) => {
          void navigator.clipboard?.writeText(text).then(() => {
            announce('Copied');
            setCopiedKey(row.key);
            clearTimeout(copiedTimer.current);
            copiedTimer.current = setTimeout(() => setCopiedKey(null), 1200);
          }, () => {});
        },
        () => {},
      );
    },
    showValue: (row, anchor) => {
      setShownValue(row.key);
      void valuePopover.open({ payload: row.key, ...(anchor ? { anchor } : {}) });
    },
  }), [copiedKey, update, valuePopover]);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  /** Opens or closes a row, or does what a row that can't open has to offer. */
  const act = (row: ObjectTreeRow) => {
    if (row.kind === 'failed') return api.retry(row.owner);
    if (isBranch(row)) {
      const open = live.current.rows.expandedKeys.has(row.key);
      return update((s) => setRowOpen(s, row.key, !open));
    }
    if (row.kind !== 'node' || !row.node.value) return;
    if (row.node.value.type === 'accessor') return api.invokeGetter(row);
    // Nothing to open: if the row cut the value off, show all of it.
    const shown = rootRef.current?.querySelector(`[data-key="${CSS.escape(row.key)}"] [data-slot="object-value"]`);
    if (shown && shown.scrollWidth > shown.clientWidth) api.showValue(row, shown);
  };

  /** With selection on, a press on a value selects it and no more: a double press or Return acts. */
  const selects = (row: ObjectTreeRow) => mode === 'single' && isSelectable(row);

  const onKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'c') return;
    // Text the user selected copies as usual.
    if (!window.getSelection()?.isCollapsed) return;
    const key = (e.target as Element).closest?.('[data-key]')?.getAttribute('data-key');
    const row = key == null ? undefined : live.current.rows.byKey.get(key);
    if (row?.kind !== 'node' || !row.node.value) return;
    e.preventDefault();
    api.copy(row);
  };

  /* The Tree gets every row that shows as data, and draws the ones in view. */
  const itemCache = useRef(new WeakMap<ObjectTreeRow, TreeItemData>());
  const items = useMemo(() => treeItemsOf(rows.rows as readonly ObjectTreeRow[], itemCache.current), [rows]);
  const expanded = useMemo(() => [...rows.expandedKeys], [rows]);
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

  const shownRow = shownValue == null ? undefined : rows.byKey.get(shownValue);

  return (
    <div
      ref={rootRef}
      data-slot="object-tree"
      className={cn('flex h-full min-h-0 w-full min-w-0 flex-col [--object-tree-indent:14px]', className)}
      style={style}
      onKeyDownCapture={onKeyDownCapture}
      {...props}
    >
      <TreeApiContext.Provider value={api}>
        <div
          ref={virtual.scrollerRef}
          data-slot="object-tree-scroller"
          className="bl-scroll min-h-0 flex-1 overflow-auto"
          onFocusCapture={(e) => { focusedKey.current = (e.target as Element).closest?.('[data-key]')?.getAttribute('data-key') ?? null; }}
          onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) focusedKey.current = null; }}
        >
          {flat.length ? (
            <Tree
              aria-label={ariaLabel}
              items={items}
              mode={mode}
              value={mode === 'single' ? selectedKey : null}
              onValueChange={(key, details) => {
                const row = key == null ? undefined : live.current.rows.byKey.get(key);
                // Selected or not, only a value can be chosen.
                if (row && !isSelectable(row)) return details.cancel();
                const node = row?.kind === 'node' ? (row.node as ObjectTreeNode<T>) : null;
                live.current.onValueChange?.(key, Object.assign(details, { node }));
                if (!details.canceled) setOwnValue(key);
              }}
              expanded={expanded}
              onExpandedChange={(next) => {
                const before = live.current.rows.expandedKeys;
                update((s) => applyExpanded(s, before, new Set(next)));
              }}
              // What a press does depends on the row, so the tree leaves opening to `onAction`.
              expandOnPress={false}
              onAction={(key, details) => {
                const row = live.current.rows.byKey.get(key);
                if (!row) return;
                if (details.event?.type === 'click') {
                  // A drag that selected text, or a press on a row's own button, isn't a press on the row.
                  const rowEl = (details.event.target as Element | null)?.closest?.('[data-key]');
                  if ((rowEl && !isRowPress(details.event, rowEl)) || selects(row)) return;
                }
                act(row);
              }}
              onHighlight={(_key, { index }) => virtual.scrollToIndex(index)}
              className="relative w-full outline-none"
              style={{ height: virtual.size }}
            >
              {virtual.items.map(({ index, start }) => {
                const row = rows.byKey.get(flat[index]?.item.value ?? '');
                return row ? <Row key={row.key} row={row} top={start} height={rowHeight} onOpen={selects(row) ? act : undefined} /> : null;
              })}
            </Tree>
          ) : (
            <div className="px-3 py-6 text-center text-footnote text-muted-foreground">{emptyMessage}</div>
          )}
        </div>
        <ValuePopover
          controller={valuePopover}
          row={shownRow?.kind === 'node' ? shownRow : undefined}
          onClose={() => setShownValue(null)}
          onCopy={() => { if (shownRow?.kind === 'node') api.copy(shownRow); }}
          copied={shownRow !== undefined && copiedKey === shownRow.key}
        />
      </TreeApiContext.Provider>
    </div>
  );
}

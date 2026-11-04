'use client';
import { createContext, use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import {
  Collection, Dialog as AriaDialog, ListLayout, Tree as AriaTree, TreeItem, TreeItemContent, Virtualizer, type Selection,
} from 'react-aria-components';
import { cva } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { ObjectValue } from '@/components/ui/object-value';
import { PlainButton } from '@/components/ui/plain-button';
import { Popover } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { Icon, type IconName } from '@/lib/icon';
import {
  applyExpanded, buildRows, childrenOfValue, copyTextOfNode, createTreeState, errorText, invokeGetterOfValue, isValueNode, rebaseTreeState,
  retryLoad, rowText, setRowOpen, settleGetter, settleLoad, startGetter, startLoad,
  type ObjectTreeGetterResult, type ObjectTreeNode, type ObjectTreeRoot, type ObjectTreeRow, type ObjectTreeRows, type ObjectTreeState,
} from '@/lib/object-tree-model';
import { previewText } from '@/lib/object-tree-value';
import { cn } from '@/lib/utils';

/* ══ ObjectTree — values as a debugger shows them: scopes, objects opened level by level, any JSON-like data.
   Built on react-aria's Tree under its Virtualizer: arrow keys move, open and close, and only rows on screen are in the
   DOM. Children load when a row opens, and a node with thousands of them groups in ranges (`[0 … 99]`), so a 100,000
   element array is a few hundred rows.
   <ObjectTree aria-label="Scopes" root={scopes} loadChildren={(node) => readProperties(node)} />
   <ObjectTree aria-label="Response" root={nodeFromValue(json, { defaultExpanded: true })} /> ══ */

export interface ObjectTreeProps<T = unknown> extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect' | 'onCopy'> {
  'aria-label': string;
  /** What's at the top level: one node, or several, with `section: true` for Local, Closure and Global. A new `root` is a
   *  new moment: what was loaded goes, and an answer still on its way is dropped. Keep it the same object until it changes. */
  root: ObjectTreeRoot<T>;
  /** A node's children, asked for when it opens and kept after that. `node.data` is there for your own handle. Without
   *  it, nodes from `nodeFromValue` open by themselves. */
  loadChildren?: (node: ObjectTreeNode<T>) => Promise<readonly ObjectTreeNode<T>[]> | readonly ObjectTreeNode<T>[];
  /** Calls a getter: pressing a `(...)`. Return its value, and whether it can open. */
  onInvokeGetter?: (node: ObjectTreeNode<T>) => Promise<ObjectTreeGetterResult<T>> | ObjectTreeGetterResult<T>;
  /** Rows can be selected, and this hears about it. A press then selects, and the chevron or a double press opens. */
  onSelect?: (node: ObjectTreeNode<T> | null) => void;
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

/** A row. The indent stops at a quarter of its width, so deep rows keep room for their name and value. */
export const objectTreeRowVariants = cva(
  [
    'group/row flex h-full w-full cursor-default items-center gap-1 pr-1 outline-none',
    'pl-[min(calc((var(--tree-item-level)-1)*var(--object-tree-indent)),25%)]',
    'text-caption leading-none text-foreground',
    'data-selected:bg-accent data-focus-visible:[box-shadow:inset_0_0_0_2px_var(--ring)]',
  ],
  {
    variants: {
      kind: {
        node: 'font-mono data-hovered:bg-accent/50',
        section: 'font-sans font-semibold shadow-hairline-b data-hovered:bg-accent/50',
        range: 'font-mono text-muted-foreground data-hovered:bg-accent/50',
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

function RowButton({ icon, label, onPress, active }: { icon: IconName; label: string; onPress: (el: Element) => void; active?: boolean }) {
  return (
    <PlainButton
      aria-label={label}
      title={label}
      excludeFromTabOrder
      onPress={(e) => onPress(e.target)}
      className={cn(
        'grid size-5 shrink-0 cursor-default place-items-center rounded-md border-0 bg-transparent p-0 text-muted-foreground outline-none',
        'data-hovered:bg-secondary-strong data-hovered:text-foreground data-focus-visible:ring-2 data-focus-visible:ring-ring',
        active && 'text-success',
      )}
    >
      <Icon name={icon} size={13} />
    </PlainButton>
  );
}

function Chevron() {
  return (
    <PlainButton
      slot="chevron"
      className="grid h-full w-4 shrink-0 cursor-default place-items-center border-0 bg-transparent p-0 text-muted-foreground outline-none"
    >
      <Icon name="chevron-right" size={10} sw={3} className="transition-transform duration-100 group-data-expanded/row:rotate-90 motion-reduce:transition-none" />
    </PlainButton>
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
              excludeFromTabOrder
              isDisabled={!api.canInvokeGetter(row)}
              onPress={() => api.invokeGetter(row)}
              className="shrink-0 cursor-default rounded-md border-0 bg-transparent px-1 py-0.5 font-mono text-caption text-muted-foreground outline-none data-hovered:bg-secondary-strong data-hovered:text-foreground data-focus-visible:ring-2 data-focus-visible:ring-ring"
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
        <span className="hidden shrink-0 items-center group-focus-within/row:flex group-data-focused/row:flex group-data-hovered/row:flex">
          {text.length > LONG_VALUE ? <RowButton icon="ellipsis" label="Show the whole value" onPress={(el) => api.showValue(row, el)} /> : null}
          <RowButton
            icon={api.copiedKey === row.key ? 'check' : 'copy'}
            label={api.copiedKey === row.key ? 'Copied' : 'Copy the value'}
            active={api.copiedKey === row.key}
            onPress={() => api.copy(row)}
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
            excludeFromTabOrder
            onPress={() => api.retry(row.owner)}
            className="shrink-0 cursor-default rounded-md border-0 bg-transparent px-1 py-0.5 text-caption font-medium text-primary outline-none data-hovered:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring"
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

function renderRow(row: ObjectTreeRow) {
  const branch = isBranch(row);
  // react-aria only treats a row as openable (arrow keys, aria-expanded) if it has a child in its collection, and a
  // closed row's children may not exist yet. So a closed row holds a stand-in, which never shows: its parent is closed.
  const children = 'children' in row && row.children ? row.children : branch ? [{ kind: 'empty' as const, key: `${row.key}\u001f\u0001closed` }] : null;
  return (
    <TreeItem id={row.key} data-slot="object-tree-row" data-kind={rowKind(row)} textValue={rowText(row)} hasChildItems={branch} isDisabled={!isSelectable(row)} className={objectTreeRowVariants({ kind: rowKind(row), stale: 'stale' in row && row.stale })}>
      <TreeItemContent>
        <RowContent row={row} />
      </TreeItemContent>
      {children ? <Collection items={children}>{renderRow}</Collection> : null}
    </TreeItem>
  );
}

/* ── The whole value ── */

function ValuePopover({ row, anchor, onClose, onCopy, copied }: {
  row: ValueRow;
  anchor: RefObject<Element | null>;
  onClose: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <Popover
      isOpen
      onOpenChange={(open) => { if (!open) onClose(); }}
      triggerRef={anchor}
      boundaryElement={anchor.current?.closest<HTMLElement>('[data-slot="bl-provider"]') ?? undefined}
      placement="bottom end"
      className="flex w-[min(30rem,calc(100vw-1.5rem))] min-w-0 flex-col"
    >
      <AriaDialog aria-label={row.node.name ? `The value of ${row.node.name}` : 'The whole value'} data-slot="object-tree-value" className="flex max-h-[min(60dvh,24rem)] min-h-0 flex-col gap-2 p-3 outline-none">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-mono text-caption font-medium">{row.node.name}</span>
          <Button size="sm" variant="ghost" className="h-6 shrink-0 px-2 text-caption" onPress={onCopy}>{copied ? 'Copied' : 'Copy'}</Button>
        </div>
        <div className="bl-scroll min-h-0 overflow-auto">
          <ObjectValue value={row.node.value!} maxLength={4000} />
        </div>
      </AriaDialog>
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
  'aria-label': ariaLabel, root: rootProp, loadChildren, onInvokeGetter, onSelect, copyValue, groupSize, rowHeight = 24, emptyMessage = 'Nothing to show', className, style, ...props
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

  const live = useRef({ loadChildren, onInvokeGetter, onSelect, copyValue, rows });
  live.current = { loadChildren, onInvokeGetter, onSelect, copyValue, rows };
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

  const treeRef = useRef<HTMLDivElement>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [shownValue, setShownValue] = useState<string | null>(null);
  const valueAnchor = useRef<Element | null>(null);
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
            setCopiedKey(row.key);
            clearTimeout(copiedTimer.current);
            copiedTimer.current = setTimeout(() => setCopiedKey(null), 1200);
          }, () => {});
        },
        () => {},
      );
    },
    showValue: (row, anchor) => {
      valueAnchor.current = anchor;
      setShownValue(row.key);
    },
  }), [copiedKey, update]);

  const select = (key: string | null) => {
    setSelectedKey(key);
    const row = key == null ? undefined : live.current.rows.byKey.get(key);
    live.current.onSelect?.(row?.kind === 'node' ? (row.node as ObjectTreeNode<T>) : null);
  };

  /* A drag that selected text isn't a press. (A double press selects a word too, but it hasn't moved.) */
  const pressStart = useRef({ x: 0, y: 0 });
  const dragged = useRef(false);

  const onAction = (key: string | number) => {
    const row = live.current.rows.byKey.get(String(key));
    if (!row || (dragged.current && !window.getSelection()?.isCollapsed)) return;
    if (row.kind === 'failed') return api.retry(row.owner);
    if (isBranch(row)) {
      const open = live.current.rows.expandedKeys.has(row.key);
      return update((s) => setRowOpen(s, row.key, !open));
    }
    if (row.kind !== 'node' || !row.node.value) return;
    // Touch taps act rather than select, and a leaf has nothing else to act on.
    if (live.current.onSelect && selectedKey !== row.key) select(row.key);
    if (row.node.value.type === 'accessor') return api.invokeGetter(row);
    // Nothing to open: if the row cut the value off, show all of it.
    const shown = treeRef.current?.querySelector(`[data-key="${CSS.escape(row.key)}"] [data-slot="object-value"]`);
    if (shown && shown.scrollWidth > shown.clientWidth) api.showValue(row, shown);
  };

  const onKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    dragged.current = false;
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'c') return;
    // Text the user selected copies as usual.
    if (!window.getSelection()?.isCollapsed) return;
    const key = (e.target as Element).closest?.('[data-key]')?.getAttribute('data-key');
    const row = key == null ? undefined : live.current.rows.byKey.get(key);
    if (row?.kind !== 'node' || !row.node.value) return;
    e.preventDefault();
    api.copy(row);
  };

  const shownRow = shownValue == null ? undefined : rows.byKey.get(shownValue);
  const layoutOptions = useMemo(() => ({ rowSize: rowHeight }), [rowHeight]);

  return (
    <div
      data-slot="object-tree"
      className={cn('flex h-full max-h-dvh min-h-0 w-full min-w-0 flex-col [--object-tree-indent:14px]', className)}
      style={style}
      onKeyDownCapture={onKeyDownCapture}
      onPointerDownCapture={(e) => { pressStart.current = { x: e.clientX, y: e.clientY }; dragged.current = false; }}
      onPointerUpCapture={(e) => { dragged.current = Math.hypot(e.clientX - pressStart.current.x, e.clientY - pressStart.current.y) > 4; }}
      {...props}
    >
      <span role="status" className="sr-only">{copiedKey == null ? '' : 'Copied'}</span>
      <TreeApiContext.Provider value={api}>
        <Virtualizer layout={ListLayout} layoutOptions={layoutOptions}>
          <AriaTree
            ref={treeRef}
            aria-label={ariaLabel}
            items={rows.rows as readonly ObjectTreeRow[]}
            expandedKeys={rows.expandedKeys}
            onExpandedChange={(next) => {
              const before = live.current.rows.expandedKeys;
              update((s) => applyExpanded(s, before, next as Set<string>));
            }}
            selectionMode={onSelect ? 'single' : 'none'}
            selectionBehavior="replace"
            disabledBehavior="selection"
            selectedKeys={selectedKey == null ? [] : [selectedKey]}
            onSelectionChange={(keys: Selection) => {
              if (keys === 'all') return;
              const [key] = keys;
              select(key == null ? null : String(key));
            }}
            onAction={onAction}
            renderEmptyState={() => <div className="px-3 py-6 text-center text-footnote text-muted-foreground">{emptyMessage}</div>}
            className="bl-scroll min-h-0 flex-1 overflow-auto outline-none"
          >
            {renderRow}
          </AriaTree>
        </Virtualizer>
        {shownRow?.kind === 'node' && shownRow.node.value ? (
          <ValuePopover
            row={shownRow}
            anchor={valueAnchor}
            onClose={() => setShownValue(null)}
            onCopy={() => api.copy(shownRow)}
            copied={copiedKey === shownRow.key}
          />
        ) : null}
      </TreeApiContext.Provider>
    </div>
  );
}

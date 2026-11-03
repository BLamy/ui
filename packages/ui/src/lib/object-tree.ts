/* ══ ObjectTree's logic, as plain functions: nodes, ranges for large collections, and how loaded children and open rows
   become the rows a tree draws. No React in here. Values themselves are in lib/object-tree-value. ══ */
import { copyTextOf, isTypedArray, previewFromValue, previewText, type ValuePreview } from '@/lib/object-tree-value';

/* ── Nodes ── */

/** One row of an ObjectTree: a value and its name, or a section. */
export interface ObjectTreeNode<T = unknown> {
  /** Unique among its siblings. The same object can sit at many places in a tree; each place is its own row. An id that
   *  stays the same across a new `root` (a variable's name, say) keeps that row open and selected. */
  id: string;
  /** The label: a variable, a property, an index. Empty for a bare value. */
  name: string;
  /** The value's type and preview. Sections leave it out. */
  value?: ValuePreview;
  /** It can open. Defaults to whether `children` has anything, or to `true` for a section. */
  hasChildren?: boolean;
  /** Children known up front, so nothing needs loading. */
  children?: readonly ObjectTreeNode<T>[];
  /** A top-level group, as Local, Closure and Global: a collapsible header rather than a value. */
  section?: boolean;
  /** Starts open. Default: a section does, nothing else does. */
  defaultExpanded?: boolean;
  /** Shown faded, as DevTools shows non-enumerable properties. */
  dim?: boolean;
  /** Anything of yours, to find the real thing in `loadChildren`: an object id, a path. */
  data?: T;
}

/** What comes back from `onInvokeGetter`. A whole node works too; its `id` and `name` are ignored. */
export type ObjectTreeGetterResult<T = unknown> = Pick<ObjectTreeNode<T>, 'value'> & Partial<Pick<ObjectTreeNode<T>, 'hasChildren' | 'children' | 'data'>>;

/** What a tree shows at its top level. */
export type ObjectTreeRoot<T = unknown> = ObjectTreeNode<T> | readonly ObjectTreeNode<T>[];

export function isNodeExpandable<T>(node: ObjectTreeNode<T>): boolean {
  if (node.hasChildren !== undefined) return node.hasChildren;
  return node.children ? node.children.length > 0 : !!node.section;
}

/* ── Live JavaScript values ── */

/** Where a node made by `nodeFromValue` came from. Private, so hosts' nodes stay plain data. */
interface ValueSource {
  /** The value itself; absent for an accessor nobody has called. */
  value?: unknown;
  /** An accessor's owner and key. */
  owner?: object;
  key?: PropertyKey;
}
const sources = new WeakMap<object, ValueSource>();

function hasOwnChildren(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (value instanceof Date || value instanceof RegExp) return false;
  if (value instanceof Error) return true;
  if (Array.isArray(value)) return value.length > 0;
  if (isTypedArray(value)) return value.length > 0;
  if (value instanceof Map || value instanceof Set) return value.size > 0;
  for (const key in value) if (Object.prototype.hasOwnProperty.call(value, key)) return true;
  return false;
}

function valueNode<T>(id: string, name: string, source: ValueSource, dim?: boolean): ObjectTreeNode<T> {
  // A 100,000 element array makes 100,000 of these; only the rows on screen ever look inside their value.
  let preview: ValuePreview | undefined;
  const isAccessor = 'owner' in source;
  const node: ObjectTreeNode<T> = {
    id,
    name,
    get value() {
      return (preview ??= isAccessor ? { type: 'accessor' } : previewFromValue(source.value));
    },
    get hasChildren() {
      return !isAccessor && hasOwnChildren(source.value);
    },
    ...(dim ? { dim } : {}),
  };
  sources.set(node, source);
  return node;
}

/** Makes a node for ObjectTree's `root` from any live value; its children are worked out when it opens, so a value can
 *  be huge or point back at itself. */
export function nodeFromValue<T = unknown>(value: unknown, options: { id?: string; name?: string; defaultExpanded?: boolean } = {}): ObjectTreeNode<T> {
  const node = valueNode<T>(options.id ?? options.name ?? 'value', options.name ?? '', { value });
  if (options.defaultExpanded !== undefined) node.defaultExpanded = options.defaultExpanded;
  return node;
}

/** A node's children, when it was made by `nodeFromValue`. ObjectTree's default `loadChildren`. */
export function childrenOfValue<T = unknown>(node: ObjectTreeNode<T>): ObjectTreeNode<T>[] {
  const source = sources.get(node);
  if (!source || !source.value || typeof source.value !== 'object') return [];
  const value: object = source.value;
  const out: ObjectTreeNode<T>[] = [];
  const index = (i: number, v: unknown, name = String(i)) => out.push(valueNode<T>(name, name, { value: v }));
  if (Array.isArray(value)) {
    value.forEach((v, i) => index(i, v));
  } else if (isTypedArray(value)) {
    for (let i = 0; i < value.length; i++) index(i, value[i]);
  } else if (value instanceof Set) {
    let i = 0;
    for (const v of value) index(i++, v);
  } else if (value instanceof Map) {
    let i = 0;
    for (const [k, v] of value) {
      const name = String(i++);
      out.push({
        id: name,
        name,
        value: { type: 'entry', key: previewFromValue(k, 1), value: previewFromValue(v, 1) },
        children: [valueNode<T>('key', 'key', { value: k }), valueNode<T>('value', 'value', { value: v })],
      });
    }
  }
  if (value instanceof Error) {
    out.push(valueNode<T>('message', 'message', { value: value.message }, true));
    if (value.stack) out.push(valueNode<T>('stack', 'stack', { value: value.stack }, true));
  }
  const skip = Array.isArray(value) || isTypedArray(value);
  for (const key of Object.keys(value)) {
    if (skip && /^\d+$/.test(key)) continue;
    const held = Object.getOwnPropertyDescriptor(value, key);
    out.push(valueNode<T>(key, key, held?.get || held?.set ? { owner: value, key } : { value: held?.value }));
  }
  if (Array.isArray(value)) out.push(valueNode<T>('length', 'length', { value: value.length }, true));
  if (value instanceof Map || value instanceof Set) out.push(valueNode<T>('size', 'size', { value: value.size }, true));
  return out;
}

/** Whether `nodeFromValue` made this node, so it can call its own getter and work out its own children. */
export function isValueNode<T>(node: ObjectTreeNode<T>): boolean {
  return sources.has(node);
}

/** Calls an accessor on a node made by `nodeFromValue`. ObjectTree's default `onInvokeGetter`. */
export function invokeGetterOfValue<T = unknown>(node: ObjectTreeNode<T>): ObjectTreeGetterResult<T> {
  const source = sources.get(node);
  if (!source?.owner) throw new Error('This getter has nothing to call it with');
  return valueNode<T>(node.id, node.name, { value: Reflect.get(source.owner, source.key as PropertyKey) });
}

/** JSON for a node made by `nodeFromValue` (undefined for any other). Things JSON has no form for are their previews. */
export function jsonOfValue<T = unknown>(node: ObjectTreeNode<T>): string | undefined {
  const source = sources.get(node);
  if (!source || 'owner' in source) return undefined;
  const ancestors: unknown[] = [];
  return JSON.stringify(source.value, function replacer(this: unknown, _: string, v: unknown) {
    while (ancestors.length && ancestors[ancestors.length - 1] !== this) ancestors.pop();
    if (typeof v === 'bigint' || typeof v === 'symbol' || typeof v === 'function') return previewText(previewFromValue(v));
    if (v instanceof RegExp) return String(v);
    if (v instanceof Error) return v.stack ?? String(v);
    if (v === null || typeof v !== 'object') return v;
    if (ancestors.includes(v)) return '[Circular]';
    const shown = v instanceof Map || v instanceof Set ? [...v] : v;
    ancestors.push(shown);
    return shown;
  }, 2) as string | undefined;
}

/** What copying a node gives you: a string's text, JSON for a live value, otherwise what its preview says. */
export function copyTextOfNode<T>(node: ObjectTreeNode<T>): string {
  const value = node.value;
  if (!value) return node.name;
  if (value.type === 'string' || value.type === 'error') return copyTextOf(value);
  return jsonOfValue(node) ?? copyTextOf(value);
}

/* ── Ranges ── */

/** Rows to a range. Above this a node's indexed children group in ranges, as DevTools does. */
export const RANGE_SIZE = 100;
/** Named children stay a flat list up to here: a thousand names (a global object) are easier to find unbroken. */
const NAMED_CHILDREN_LIMIT = 1000;

/** How many items each range holds so that `count` items make at most `size` ranges: 100, then 10,000, and so on. */
export function rangeBucketSize(count: number, size = RANGE_SIZE): number {
  let bucket = size;
  while (count / bucket > size) bucket *= size;
  return bucket;
}

/** Where a range of positions splits: `[0, 99], [100, 199], …`. Nothing when it is small enough to list. */
export function rangeBuckets(from: number, to: number, size = RANGE_SIZE): (readonly [number, number])[] {
  const count = to - from + 1;
  if (count <= size) return [];
  const bucket = rangeBucketSize(count, size);
  const out: [number, number][] = [];
  for (let start = from; start <= to; start += bucket) out.push([start, Math.min(start + bucket - 1, to)]);
  return out;
}

function isIndexName(name: string): boolean {
  if (!name || name.length > 16) return false;
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return true;
}

/** What a list of children shows: plain positions, and spans that became ranges. */
export type RangePlanItem = number | readonly [number, number];

const plans = new WeakMap<readonly unknown[], { size: number; plan: readonly RangePlanItem[] }>();

/** Groups a node's children. Indexed children at the start (an array's items, a map's entries) group above `size`, with
 *  named ones after them left alone (`length`, `[[Prototype]]`). Named children group only above `NAMED_CHILDREN_LIMIT`. */
export function planRanges(nodes: readonly { name: string }[], size = RANGE_SIZE): readonly RangePlanItem[] {
  const known = plans.get(nodes);
  if (known?.size === size) return known.plan;
  let indexed = 0;
  while (indexed < nodes.length && isIndexName(nodes[indexed]!.name)) indexed++;
  const plan: RangePlanItem[] = [];
  const span = (from: number, to: number, limit: number) => {
    const count = to - from + 1;
    if (count <= 0) return;
    if (count > limit) plan.push(...rangeBuckets(from, to, size));
    else for (let i = from; i <= to; i++) plan.push(i);
  };
  span(0, indexed - 1, size);
  span(indexed, nodes.length - 1, Math.max(NAMED_CHILDREN_LIMIT, size));
  plans.set(nodes, { size, plan });
  return plan;
}

/** `[0 … 99]`, from the names themselves, so a sparse array shows its real indices. */
export function rangeLabel(nodes: readonly { name: string }[], from: number, to: number): string {
  return `[${nodes[from]!.name} … ${nodes[to]!.name}]`;
}

/* ── State ── */

export interface ObjectTreeLoad<T = unknown> {
  status: 'loading' | 'loaded' | 'failed';
  token: number;
  children?: readonly ObjectTreeNode<T>[];
  error?: string;
}

export interface ObjectTreeGetter<T = unknown> {
  status: 'invoking' | 'done' | 'failed';
  token: number;
  result?: ObjectTreeGetterResult<T>;
  error?: string;
}

/** All an ObjectTree remembers. `loads` and `getters` belong to `root`; `open` outlives it. */
export interface ObjectTreeState<T = unknown> {
  root: ObjectTreeRoot<T>;
  /** Rows opened or closed by hand. Anything else is at its default. */
  open: ReadonlyMap<string, boolean>;
  loads: ReadonlyMap<string, ObjectTreeLoad<T>>;
  /** The last root's children of each open row, shown faded until the new ones arrive, so stepping doesn't flicker. */
  previous: ReadonlyMap<string, readonly ObjectTreeNode<T>[]>;
  getters: ReadonlyMap<string, ObjectTreeGetter<T>>;
}

export function createTreeState<T>(root: ObjectTreeRoot<T>): ObjectTreeState<T> {
  return { root, open: new Map(), loads: new Map(), previous: new Map(), getters: new Map() };
}

/** A new `root`: what was loaded goes, so an answer still on its way finds nothing to land on and is dropped. Open rows
 *  stay open, and keep what they showed until their new children come. */
export function rebaseTreeState<T>(state: ObjectTreeState<T>, root: ObjectTreeRoot<T>, expandedKeys: ReadonlySet<string>): ObjectTreeState<T> {
  const previous = new Map<string, readonly ObjectTreeNode<T>[]>();
  for (const key of expandedKeys) {
    const load = state.loads.get(key);
    const children = load?.status === 'loaded' ? load.children : state.previous.get(key);
    if (children) previous.set(key, children);
  }
  return { root, open: state.open, loads: new Map(), previous, getters: new Map() };
}

function withEntry<V>(map: ReadonlyMap<string, V>, key: string, value: V | undefined): Map<string, V> {
  const next = new Map(map);
  if (value === undefined) next.delete(key);
  else next.set(key, value);
  return next;
}

export function startLoad<T>(state: ObjectTreeState<T>, key: string, token: number): ObjectTreeState<T> {
  return { ...state, loads: withEntry(state.loads, key, { status: 'loading', token }) };
}

/** An answer lands only if it is the one being waited for: not one from before a new `root`, or a retry. */
export function settleLoad<T>(state: ObjectTreeState<T>, key: string, token: number, outcome: { children: readonly ObjectTreeNode<T>[] } | { error: string }): ObjectTreeState<T> {
  if (state.loads.get(key)?.token !== token) return state;
  const entry: ObjectTreeLoad<T> = 'children' in outcome ? { status: 'loaded', token, children: outcome.children } : { status: 'failed', token, error: outcome.error };
  return { ...state, loads: withEntry(state.loads, key, entry), previous: withEntry(state.previous, key, undefined) };
}

/** Forget a failed load, so the row asks again. */
export function retryLoad<T>(state: ObjectTreeState<T>, key: string): ObjectTreeState<T> {
  return { ...state, loads: withEntry(state.loads, key, undefined) };
}

export function startGetter<T>(state: ObjectTreeState<T>, key: string, token: number): ObjectTreeState<T> {
  return { ...state, getters: withEntry(state.getters, key, { status: 'invoking', token }) };
}

export function settleGetter<T>(state: ObjectTreeState<T>, key: string, token: number, outcome: { result: ObjectTreeGetterResult<T> } | { error: string }): ObjectTreeState<T> {
  if (state.getters.get(key)?.token !== token) return state;
  const entry: ObjectTreeGetter<T> = 'result' in outcome ? { status: 'done', token, result: outcome.result } : { status: 'failed', token, error: outcome.error };
  return { ...state, getters: withEntry(state.getters, key, entry) };
}

export function setRowOpen<T>(state: ObjectTreeState<T>, key: string, open: boolean): ObjectTreeState<T> {
  return { ...state, open: withEntry(state.open, key, open) };
}

/** react-aria reports the whole set of open rows after a toggle: note what changed. */
export function applyExpanded<T>(state: ObjectTreeState<T>, before: ReadonlySet<string>, after: ReadonlySet<string>): ObjectTreeState<T> {
  const open = new Map(state.open);
  for (const key of after) if (!before.has(key)) open.set(key, true);
  for (const key of before) if (!after.has(key)) open.set(key, false);
  return { ...state, open };
}

/* ── Rows ── */

export type ObjectTreeRow<T = unknown> =
  | {
      kind: 'node';
      key: string;
      /** The node as it is now: with what its getter returned, if it was called. */
      node: ObjectTreeNode<T>;
      /** The node as the host gave it. */
      source: ObjectTreeNode<T>;
      expandable: boolean;
      expanded: boolean;
      getter?: ObjectTreeGetter<T>;
      /** From the last `root`, waiting on new children. */
      stale: boolean;
      children?: readonly ObjectTreeRow<T>[];
    }
  | { kind: 'range'; key: string; label: string; from: number; to: number; expanded: boolean; stale: boolean; children?: readonly ObjectTreeRow<T>[] }
  | { kind: 'loading'; key: string; owner: string }
  | { kind: 'failed'; key: string; owner: string; error: string }
  | { kind: 'empty'; key: string };

function withGetterResult<T>(source: ObjectTreeNode<T>, result: ObjectTreeGetterResult<T> | undefined): ObjectTreeNode<T> {
  const node = { ...source, ...result, id: source.id, name: source.name };
  const from = result && sources.get(result);
  if (from) sources.set(node, from);
  return node;
}

/** Keeps a row's path unique: ids only have to be unique among siblings. */
const SEPARATOR = '\u001f';
const joinKey = (parent: string, id: string) => (parent ? `${parent}${SEPARATOR}${id}` : id);

export interface ObjectTreeRows<T = unknown> {
  rows: readonly ObjectTreeRow<T>[];
  /** Every row in `rows`, at any depth. */
  byKey: ReadonlyMap<string, ObjectTreeRow<T>>;
  expandedKeys: ReadonlySet<string>;
  /** Open rows whose children nobody has asked for yet. */
  needsLoad: readonly { key: string; node: ObjectTreeNode<T> }[];
}

function sameList<V>(a: readonly V[] | undefined, b: readonly V[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Works out the rows on show: only open rows are walked, however many children sit behind closed ones. A row that
 *  didn't change is the same object as last time (from `last`), which is what keeps react-aria from rebuilding it. */
export function buildRows<T>(state: ObjectTreeState<T>, options: { groupSize?: number } = {}, last?: ObjectTreeRows<T> | null): ObjectTreeRows<T> {
  const size = options.groupSize ?? RANGE_SIZE;
  const byKey = new Map<string, ObjectTreeRow<T>>();
  const expandedKeys = new Set<string>();
  const needsLoad: { key: string; node: ObjectTreeNode<T> }[] = [];

  const keep = <R extends ObjectTreeRow<T>>(row: R, same: (was: R) => boolean): R => {
    const was = last?.byKey.get(row.key) as R | undefined;
    const kept = was && was.kind === row.kind && same(was) ? was : row;
    byKey.set(row.key, kept);
    return kept;
  };

  const nodeRow = (source: ObjectTreeNode<T>, parent: string, stale: boolean) => {
    const key = joinKey(parent, source.id);
    const getter = state.getters.get(key);
    const was = last?.byKey.get(key);
    let node = source;
    if (getter?.status === 'done') {
      node = was?.kind === 'node' && was.source === source && was.getter === getter ? was.node : withGetterResult(source, getter.result);
    }
    const expandable = isNodeExpandable(node);
    const expanded = expandable && (state.open.get(key) ?? node.defaultExpanded ?? !!node.section);
    if (expanded) expandedKeys.add(key);
    const children = expanded ? childRows(node, key, stale) : undefined;
    return keep(
      { kind: 'node' as const, key, node, source, expandable, expanded, getter, stale, children },
      (w) => w.source === source && w.node === node && w.getter === getter && w.expanded === expanded && w.expandable === expandable && w.stale === stale && sameList(w.children, children),
    );
  };

  const placeholder = (owner: string) => keep({ kind: 'loading' as const, key: `${owner}${SEPARATOR}\u0001loading`, owner }, () => true);

  const childRows = (node: ObjectTreeNode<T>, key: string, stale: boolean): readonly ObjectTreeRow<T>[] => {
    if (node.children) return listRows(node.children, key, stale);
    const load = state.loads.get(key);
    if (load?.status === 'loaded') return listRows(load.children ?? [], key, stale);
    if (load?.status === 'failed') {
      const error = load.error ?? '';
      return [keep({ kind: 'failed' as const, key: `${key}${SEPARATOR}\u0001failed`, owner: key, error }, (w) => w.error === error)];
    }
    // From a stale row, wait: its fresh parent has to answer first, and it may no longer exist.
    if (!load && !stale) needsLoad.push({ key, node });
    const prior = state.previous.get(key);
    return prior?.length ? listRows(prior, key, true) : [placeholder(key)];
  };

  const rangeRow = (nodes: readonly ObjectTreeNode<T>[], owner: string, from: number, to: number, stale: boolean) => {
    const key = `${owner}${SEPARATOR}\u0001[${from}-${to}]`;
    const label = rangeLabel(nodes, from, to);
    const expanded = state.open.get(key) ?? false;
    if (expanded) expandedKeys.add(key);
    const children = expanded ? rangeChildren(nodes, owner, from, to, stale) : undefined;
    return keep(
      { kind: 'range' as const, key, label, from, to, expanded, stale, children },
      (w) => w.label === label && w.expanded === expanded && w.stale === stale && sameList(w.children, children),
    );
  };

  const rangeChildren = (nodes: readonly ObjectTreeNode<T>[], owner: string, from: number, to: number, stale: boolean): ObjectTreeRow<T>[] => {
    const buckets = rangeBuckets(from, to, size);
    if (buckets.length) return buckets.map(([a, b]) => rangeRow(nodes, owner, a, b, stale));
    const out: ObjectTreeRow<T>[] = [];
    for (let i = from; i <= to; i++) out.push(nodeRow(nodes[i]!, owner, stale));
    return out;
  };

  const listRows = (nodes: readonly ObjectTreeNode<T>[], owner: string, stale: boolean): readonly ObjectTreeRow<T>[] => {
    if (!nodes.length) return [keep({ kind: 'empty' as const, key: `${owner}${SEPARATOR}\u0001empty` }, () => true)];
    return planRanges(nodes, size).map((item) => (typeof item === 'number' ? nodeRow(nodes[item]!, owner, stale) : rangeRow(nodes, owner, item[0], item[1], stale)));
  };

  const top = Array.isArray(state.root) ? (state.root as readonly ObjectTreeNode<T>[]) : [state.root as ObjectTreeNode<T>];
  const rows = planRanges(top, size).map((item) => (typeof item === 'number' ? nodeRow(top[item]!, '', false) : rangeRow(top, '', item[0], item[1], false)));
  return { rows: last && sameList(last.rows, rows) ? last.rows : rows, byKey, expandedKeys, needsLoad };
}

/** The text a row answers to, for type-to-select and screen readers. */
export function rowText<T>(row: ObjectTreeRow<T>): string {
  switch (row.kind) {
    case 'node': {
      const { name, value } = row.node;
      if (!value) return name;
      const text = previewText(value, { maxString: 80 });
      return name ? `${name}: ${text}` : text;
    }
    case 'range':
      return row.label;
    case 'loading':
      return 'Loading';
    case 'failed':
      return `Couldn't load: ${row.error}`;
    case 'empty':
      return 'No properties';
  }
}

/** A failure as one line of text. */
export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return typeof error === 'string' && error ? error : 'Something went wrong';
}

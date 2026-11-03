import { describe, expect, it } from 'vitest';
import {
  RANGE_SIZE, applyExpanded, buildRows, childrenOfValue, copyTextOfNode, createTreeState, errorText,
  invokeGetterOfValue, isNodeExpandable, isValueNode, jsonOfValue, nodeFromValue, planRanges, rangeBucketSize, rangeBuckets, rangeLabel,
  rebaseTreeState, retryLoad, rowText, setRowOpen, settleGetter, settleLoad, startGetter, startLoad,
  type ObjectTreeNode, type ObjectTreeRow, type ObjectTreeState,
} from '@/lib/object-tree';
import { previewText, type ValuePreview } from '@/lib/object-tree-value';

const str = (value: string): ValuePreview => ({ type: 'string', value });
const num = (value: number | string): ValuePreview => ({ type: 'number', value });

describe('live values', () => {
  it('opens objects, arrays, maps and sets', () => {
    const names = (value: unknown) => childrenOfValue(nodeFromValue(value)).map((n) => `${n.name}: ${previewText(n.value!)}`);
    expect(names({ a: 1, b: 'x' })).toEqual(['a: 1', 'b: "x"']);
    expect(names(['p', 'q'])).toEqual(['0: "p"', '1: "q"', 'length: 2']);
    expect(names(new Set(['p']))).toEqual(['0: "p"', 'size: 1']);
    expect(names(new Map([['k', 1]]))).toEqual(['0: "k" => 1', 'size: 1']);
    expect(names(5)).toEqual([]);
    expect(childrenOfValue({ id: 'host', name: 'n' })).toEqual([]);
  });

  it('opens a map entry into its key and value', () => {
    const [entry] = childrenOfValue(nodeFromValue(new Map([['k', { v: 1 }]])));
    expect(entry!.children!.map((n) => n.name)).toEqual(['key', 'value']);
    expect(previewText(entry!.children![1]!.value!)).toBe('{v: 1}');
  });

  it('knows what can open', () => {
    const can = (value: unknown) => isNodeExpandable(nodeFromValue(value));
    expect([can({ a: 1 }), can({}), can([1]), can([]), can(new Map()), can(new Set([1])), can(1), can('x'), can(new Date(0)), can(/a/), can(new Error('e'))])
      .toEqual([true, false, true, false, false, true, false, false, false, false, true]);
  });

  it('follows a value that points back at itself, a level at a time', () => {
    const loop: Record<string, unknown> = { name: 'loop' };
    loop.self = loop;
    const self = childrenOfValue(nodeFromValue(loop)).find((n) => n.name === 'self')!;
    const again = childrenOfValue(self).find((n) => n.name === 'self')!;
    expect(previewText(again.value!)).toBe('{name: "loop", self: {…}}');
    expect(jsonOfValue(nodeFromValue(loop))).toContain('"self": "[Circular]"');
  });

  it('says a shared reference is not a loop', () => {
    const shared = { v: 1 };
    expect(JSON.parse(jsonOfValue(nodeFromValue({ a: shared, b: shared }))!)).toEqual({ a: { v: 1 }, b: { v: 1 } });
  });

  it('works out previews only when a row asks', () => {
    let read = 0;
    const big = Array.from({ length: 1000 }, () => new Proxy({}, { ownKeys() { read++; return []; } }));
    const children = childrenOfValue(nodeFromValue(big));
    expect(children).toHaveLength(1001);
    expect(read).toBe(0);
    expect(previewText(children[3]!.value!)).toBe('{}');
    expect(read).toBeGreaterThan(0);
  });

  it('calls a getter when asked, and what it returns can open', () => {
    let called = 0;
    const owner = { get a() { called++; return { deep: true }; } };
    const [getter] = childrenOfValue(nodeFromValue(owner));
    expect(getter!.value).toEqual({ type: 'accessor' });
    expect(called).toBe(0);
    const result = invokeGetterOfValue(getter!);
    expect(called).toBe(1);
    expect(previewText(result.value!)).toBe('{deep: true}');
    expect(result.hasChildren).toBe(true);

    // Through the tree's rows the answer stays connected to what it came from.
    const state = createTreeState([getter!]);
    const key = getter!.id;
    const done = settleGetter(startGetter(state, key, 1), key, 1, { result });
    const row = buildRows(done).rows[0] as Extract<ObjectTreeRow, { kind: 'node' }>;
    expect(childrenOfValue(row.node).map((n) => n.name)).toEqual(['deep']);
  });

  it('refuses to call what it did not make', () => {
    const host: ObjectTreeNode = { id: 'a', name: 'a', value: { type: 'accessor' } };
    expect(isValueNode(host)).toBe(false);
    expect(isValueNode(nodeFromValue(1))).toBe(true);
    expect(() => invokeGetterOfValue(host)).toThrow();
  });

  it('copies a live value as JSON, and a string as its text', () => {
    expect(copyTextOfNode(nodeFromValue({ a: [1, 'b'], m: new Map([['k', 1n]]) }))).toBe(JSON.stringify({ a: [1, 'b'], m: [['k', '1n']] }, null, 2));
    expect(copyTextOfNode(nodeFromValue('plain'))).toBe('plain');
    expect(copyTextOfNode({ id: 'a', name: 'a', value: num(3) })).toBe('3');
    expect(copyTextOfNode({ id: 's', name: 'Local', section: true })).toBe('Local');
  });

  it('has an id even for a bare value', () => {
    expect(nodeFromValue(1).id).toBe('value');
    expect(nodeFromValue(1, { name: 'x' }).id).toBe('x');
    expect(nodeFromValue(1, { id: 'i', name: 'x', defaultExpanded: true })).toMatchObject({ id: 'i', name: 'x', defaultExpanded: true });
  });
});

describe('ranges', () => {
  it('sizes buckets as DevTools does', () => {
    expect(rangeBucketSize(101)).toBe(100);
    expect(rangeBucketSize(10_000)).toBe(100);
    expect(rangeBucketSize(10_001)).toBe(10_000);
    expect(rangeBucketSize(100_000)).toBe(10_000);
    expect(rangeBucketSize(1_000_001)).toBe(1_000_000);
  });

  it('splits a span into ranges', () => {
    expect(rangeBuckets(0, 99)).toEqual([]);
    expect(rangeBuckets(0, 249)).toEqual([[0, 99], [100, 199], [200, 249]]);
    const big = rangeBuckets(0, 99_999);
    expect(big).toHaveLength(10);
    expect(big[0]).toEqual([0, 9999]);
    expect(big[9]).toEqual([90_000, 99_999]);
    expect(rangeBuckets(10_000, 19_999)).toHaveLength(100);
    expect(rangeBuckets(10_000, 19_999)[1]).toEqual([10_100, 10_199]);
  });

  const indexed = (count: number) => Array.from({ length: count }, (_, i) => ({ name: String(i) }));
  const named = (count: number) => Array.from({ length: count }, (_, i) => ({ name: `key${i}` }));

  it('leaves a short list alone', () => {
    expect(planRanges(indexed(100))).toEqual(Array.from({ length: 100 }, (_, i) => i));
    expect(planRanges(named(1000))).toHaveLength(1000);
  });

  it('groups an array\'s items and leaves its named properties after them', () => {
    const plan = planRanges([...indexed(250), { name: 'length' }, { name: '[[Prototype]]' }]);
    expect(plan).toEqual([[0, 99], [100, 199], [200, 249], 250, 251]);
  });

  it('groups thousands of names too', () => {
    const plan = planRanges(named(2500));
    expect(plan).toHaveLength(25);
    expect(plan[0]).toEqual([0, 99]);
  });

  it('remembers its answer for the same list', () => {
    const list = indexed(500);
    expect(planRanges(list)).toBe(planRanges(list));
    expect(planRanges(list, 50)).not.toBe(planRanges(list));
  });

  it('labels a range from its names, so a sparse array shows real indices', () => {
    expect(rangeLabel([{ name: '5' }, { name: '1027' }], 0, 1)).toBe('[5 … 1027]');
    expect(rangeLabel(indexed(100), 0, 99)).toBe('[0 … 99]');
  });

  it('uses the group size it is given', () => {
    expect(planRanges(indexed(25), 10)).toEqual([[0, 9], [10, 19], [20, 24]]);
    expect(RANGE_SIZE).toBe(100);
  });
});

/* ── Rows ── */

const node = (id: string, extra: Partial<ObjectTreeNode> = {}): ObjectTreeNode => ({ id, name: id, value: num(1), ...extra });
const describeRows = (rows: readonly ObjectTreeRow[], depth = 0): string[] => rows.flatMap((row) => [
  `${'  '.repeat(depth)}${row.kind === 'node' ? row.node.name : row.kind === 'range' ? row.label : row.kind}${row.kind === 'node' && row.stale ? ' (stale)' : ''}`,
  ...('children' in row && row.children ? describeRows(row.children, depth + 1) : []),
]);
const shown = (state: ObjectTreeState) => describeRows(buildRows(state).rows);

describe('buildRows', () => {
  it('opens sections by default and nothing else', () => {
    const state = createTreeState<unknown>([
      node('this', { hasChildren: true }),
      { id: 'local', name: 'Local', section: true, children: [node('a'), node('b', { children: [node('c')] })] },
      { id: 'global', name: 'Global', section: true, defaultExpanded: false, children: [node('window')] },
    ]);
    expect(shown(state)).toEqual(['this', 'Local', '  a', '  b', 'Global']);
  });

  it('asks only for open rows with nothing to show yet', () => {
    const asks = node('asks', { hasChildren: true, defaultExpanded: true });
    const closed = node('closed', { hasChildren: true });
    const known = node('known', { defaultExpanded: true, children: [node('kid')] });
    const built = buildRows(createTreeState([asks, closed, known]));
    expect(built.needsLoad.map((n) => n.key)).toEqual(['asks']);
    expect(describeRows(built.rows)).toEqual(['asks', '  loading', 'closed', 'known', '  kid']);
    expect([...built.expandedKeys]).toEqual(['asks', 'known']);
  });

  it('shows loading, then the answer, and keeps it when closed and reopened', () => {
    const a = node('a', { hasChildren: true, defaultExpanded: true });
    let state: ObjectTreeState = startLoad(createTreeState([a]), 'a', 1);
    let built = buildRows(state);
    expect(built.needsLoad).toEqual([]);
    expect(describeRows(built.rows)).toEqual(['a', '  loading']);
    state = settleLoad(state, 'a', 1, { children: [node('x')] });
    expect(shown(state)).toEqual(['a', '  x']);
    state = setRowOpen(state, 'a', false);
    built = buildRows(state);
    expect(describeRows(built.rows)).toEqual(['a']);
    state = setRowOpen(state, 'a', true);
    built = buildRows(state);
    expect(describeRows(built.rows)).toEqual(['a', '  x']);
    expect(built.needsLoad).toEqual([]);
  });

  it('shows a failure on the node that failed, and retries', () => {
    const a = node('a', { hasChildren: true, defaultExpanded: true });
    const b = node('b', { hasChildren: true, defaultExpanded: true });
    let state: ObjectTreeState = startLoad(startLoad(createTreeState([a, b]), 'a', 1), 'b', 2);
    state = settleLoad(state, 'a', 1, { error: 'no object 8' });
    const built = buildRows(state);
    expect(describeRows(built.rows)).toEqual(['a', '  failed', 'b', '  loading']);
    const failed = built.byKey.get((built.rows[0] as Extract<ObjectTreeRow, { kind: 'node' }>).children![0]!.key);
    expect(failed).toMatchObject({ kind: 'failed', owner: 'a', error: 'no object 8' });
    state = retryLoad(state, 'a');
    expect(buildRows(state).needsLoad.map((n) => n.key)).toEqual(['a']);
  });

  it('says so when there is nothing inside', () => {
    const a = node('a', { hasChildren: true, defaultExpanded: true });
    const state = settleLoad(startLoad(createTreeState([a]), 'a', 1), 'a', 1, { children: [] });
    expect(shown(state)).toEqual(['a', '  empty']);
  });

  it('keeps the same object in two places apart', () => {
    const shared = node('shared', { hasChildren: true });
    const state = createTreeState<unknown>([
      node('p', { defaultExpanded: true, children: [shared] }),
      node('q', { defaultExpanded: true, children: [shared] }),
    ]);
    const built = buildRows(setRowOpen(state, 'p\u001fshared', true));
    expect([...built.expandedKeys]).toContain('p\u001fshared');
    expect([...built.expandedKeys]).not.toContain('q\u001fshared');
    expect(built.needsLoad).toHaveLength(1);
  });

  it('lists a hundred thousand children as ten rows, and walks only what is open', () => {
    const many = Array.from({ length: 100_000 }, (_, i) => node(String(i)));
    const owner = node('list', { defaultExpanded: true, children: many });
    let state: ObjectTreeState = createTreeState([owner]);
    let built = buildRows(state);
    expect(built.byKey.size).toBe(11);
    const bucket = (built.rows[0] as Extract<ObjectTreeRow, { kind: 'node' }>).children![0] as Extract<ObjectTreeRow, { kind: 'range' }>;
    expect(bucket.label).toBe('[0 … 9999]');
    state = setRowOpen(state, bucket.key, true);
    built = buildRows(state);
    expect(built.byKey.size).toBe(111);
    const range = (built.byKey.get(bucket.key) as Extract<ObjectTreeRow, { kind: 'range' }>).children![0] as Extract<ObjectTreeRow, { kind: 'range' }>;
    expect(range.label).toBe('[0 … 99]');
    state = setRowOpen(state, range.key, true);
    built = buildRows(state);
    expect(built.byKey.size).toBe(211);
    const first = (built.byKey.get(range.key) as Extract<ObjectTreeRow, { kind: 'range' }>).children![0]!;
    // A child's key doesn't depend on which ranges it's under.
    expect(first.key).toBe('list\u001f0');
  });

  it('returns the same objects for rows that did not change', () => {
    const a = node('a', { defaultExpanded: true, children: [node('x'), node('y', { hasChildren: true })] });
    const b = node('b');
    const state = createTreeState([a, b]);
    const one = buildRows(state);
    const two = buildRows({ ...state }, {}, one);
    expect(two.rows).toBe(one.rows);
    const three = buildRows(setRowOpen(state, 'a\u001fy', true), {}, one);
    expect(three.rows).not.toBe(one.rows);
    expect(three.rows[1]).toBe(one.rows[1]);
    const firstKid = (rows: readonly ObjectTreeRow[]) => (rows[0] as Extract<ObjectTreeRow, { kind: 'node' }>).children?.[0];
    expect(firstKid(three.rows)).toBe(firstKid(one.rows));
  });

  it('notes what react-aria toggled', () => {
    const state = createTreeState<unknown>([node('a', { hasChildren: true }), node('b', { hasChildren: true, defaultExpanded: true })]);
    const next = applyExpanded(state, new Set(['b']), new Set(['a']));
    expect(next.open.get('a')).toBe(true);
    expect(next.open.get('b')).toBe(false);
    expect([...buildRows(next).expandedKeys]).toEqual(['a']);
  });

  it('answers to its name and value', () => {
    const texts = buildRows(createTreeState<unknown>([{ id: 'a', name: 'a', value: str('x') }, { id: 'b', name: '', value: num(1) }, { id: 's', name: 'Local', section: true, children: [] }])).rows.map(rowText);
    expect(texts).toEqual(['a: "x"', '1', 'Local']);
  });
});

describe('a new root', () => {
  const a = node('a', { hasChildren: true, defaultExpanded: true });
  const a2 = node('a', { hasChildren: true, defaultExpanded: true, value: num(2) });

  it('drops an answer that was still on its way', () => {
    const asked = startLoad(createTreeState([a]), 'a', 1);
    const moved = rebaseTreeState(asked, [a2], new Set(['a']));
    expect(settleLoad(moved, 'a', 1, { children: [node('old')] })).toBe(moved);
    const again = startLoad(moved, 'a', 2);
    expect(settleLoad(again, 'a', 1, { children: [node('old')] })).toBe(again);
    expect(shown(settleLoad(again, 'a', 2, { children: [node('new')] }))).toEqual(['a', '  new']);
  });

  it('drops a failure from before it too', () => {
    const asked = startLoad(createTreeState([a]), 'a', 1);
    const moved = rebaseTreeState(asked, [a2], new Set(['a']));
    expect(settleLoad(moved, 'a', 1, { error: 'late' })).toBe(moved);
  });

  it('keeps open rows open and asks for them again', () => {
    const closed = node('closed', { hasChildren: true, defaultExpanded: true });
    let state: ObjectTreeState = createTreeState([a, closed]);
    state = setRowOpen(state, 'closed', false);
    const moved = rebaseTreeState(state, [a2, closed], buildRows(state).expandedKeys);
    const built = buildRows(moved);
    expect([...built.expandedKeys]).toEqual(['a']);
    expect(built.needsLoad.map((n) => n.node)).toEqual([a2]);
  });

  it('shows the last children, faded, until the new ones land', () => {
    const open = settleLoad(startLoad(createTreeState([a]), 'a', 1), 'a', 1, { children: [node('kid', { hasChildren: true, defaultExpanded: true })] });
    const withKid = settleLoad(startLoad(open, 'a\u001fkid', 2), 'a\u001fkid', 2, { children: [node('grandkid')] });
    const moved = rebaseTreeState(withKid, [a2], buildRows(withKid).expandedKeys);
    const built = buildRows(moved);
    expect(describeRows(built.rows)).toEqual(['a', '  kid (stale)', '    grandkid (stale)']);
    // Only the fresh row asks: a stale one waits to see if it still exists.
    expect(built.needsLoad.map((n) => n.key)).toEqual(['a']);
    const answered = settleLoad(startLoad(moved, 'a', 3), 'a', 3, { children: [node('kid', { hasChildren: true, defaultExpanded: true })] });
    const next = buildRows(answered);
    expect(describeRows(next.rows)).toEqual(['a', '  kid', '    grandkid (stale)']);
    expect(next.needsLoad.map((n) => n.key)).toEqual(['a\u001fkid']);
  });

  it('forgets the last children of rows nobody has open, and when the new ones fail', () => {
    const open = settleLoad(startLoad(createTreeState([a]), 'a', 1), 'a', 1, { children: [node('kid')] });
    expect(rebaseTreeState(open, [a2], new Set()).previous.size).toBe(0);
    const moved = rebaseTreeState(open, [a2], new Set(['a']));
    expect(moved.previous.size).toBe(1);
    const failed = settleLoad(startLoad(moved, 'a', 2), 'a', 2, { error: 'gone' });
    expect(failed.previous.size).toBe(0);
    expect(shown(failed)).toEqual(['a', '  failed']);
  });

  it('forgets a getter\'s answer, and drops one on its way', () => {
    const g = node('g', { value: { type: 'accessor' } });
    const asked = startGetter(createTreeState([g]), 'g', 1);
    const moved = rebaseTreeState(asked, [g], new Set());
    expect(settleGetter(moved, 'g', 1, { result: { value: num(1) } })).toBe(moved);
    const answered = settleGetter(startGetter(moved, 'g', 2), 'g', 2, { result: { value: num(9) } });
    const row = buildRows(answered).rows[0] as Extract<ObjectTreeRow, { kind: 'node' }>;
    expect(row.node.value).toEqual(num(9));
    expect(row.source).toBe(g);
    expect(buildRows(rebaseTreeState(answered, [g], new Set())).rows[0]).toMatchObject({ node: g });
  });
});

describe('getters', () => {
  it('shows what comes back, under the same name, and it can open', () => {
    const g = node('g', { value: { type: 'accessor' }, data: 'handle' });
    const result = { value: { type: 'object', className: 'User' } as ValuePreview, hasChildren: true };
    const state = settleGetter(startGetter(createTreeState([g]), 'g', 1), 'g', 1, { result });
    const row = buildRows(state).rows[0] as Extract<ObjectTreeRow, { kind: 'node' }>;
    expect(row).toMatchObject({ expandable: true, expanded: false });
    expect(row.node).toMatchObject({ id: 'g', name: 'g', value: result.value, data: 'handle' });
  });

  it('keeps the failure beside the row', () => {
    const g = node('g', { value: { type: 'accessor' } });
    const state = settleGetter(startGetter(createTreeState([g]), 'g', 1), 'g', 1, { error: 'threw' });
    expect(buildRows(state).rows[0]).toMatchObject({ getter: { status: 'failed', error: 'threw' }, expandable: false });
  });

  it('returns the same row object while nothing changes', () => {
    const g = node('g', { value: { type: 'accessor' } });
    const state = settleGetter(startGetter(createTreeState([g]), 'g', 1), 'g', 1, { result: { value: num(1) } });
    const one = buildRows(state);
    expect(buildRows({ ...state }, {}, one).rows[0]).toBe(one.rows[0]);
  });
});

describe('errorText', () => {
  it('finds words in what was thrown', () => {
    expect(errorText(new Error('boom'))).toBe('boom');
    expect(errorText(new TypeError(''))).toBe('TypeError');
    expect(errorText('plain')).toBe('plain');
    expect(errorText(undefined)).toBe('Something went wrong');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildCallStackRows, callStackRowOffset, fileBaseName, frameText, fullLocation, reuseCallStackRows, runLabel, shortLocation,
  type CallStackFrame, type CallStackRow, type CallStackSection,
} from '@/lib/call-stack';

const app = (id: string): CallStackFrame => ({ id, functionName: id, location: { file: `/src/${id}.ts`, line: 1 } });
const fw = (id: string, label?: string): CallStackFrame => ({ id, functionName: id, kind: 'framework', ...(label ? { label } : {}) });
const lib = (id: string): CallStackFrame => ({ id, functionName: id, kind: 'library' });
const boundary = (id: string, label?: string): CallStackFrame => ({ id, kind: 'async', ...(label ? { label } : {}) });

const line = (row: CallStackRow) => (row.kind === 'frame' ? `${row.isTop ? '>' : ''}${row.inRun ? '  ' : ''}${row.frame.id}` : `[${row.label}${row.expanded ? ', open' : ''}]`);
const lines = (sections: readonly CallStackSection[]) => sections.flatMap((s) => [...(s.label !== undefined ? [`--- ${s.label}`] : []), ...s.rows.map(line)]);

describe('buildCallStackRows', () => {
  it('lists plain frames, the first as the top', () => {
    expect(lines(buildCallStackRows([app('a'), app('b')]))).toEqual(['>a', 'b']);
  });

  it('folds a run of framework frames', () => {
    expect(lines(buildCallStackRows([app('a'), fw('r1'), fw('r2'), fw('r3'), app('b')]))).toEqual(['>a', '[3 framework frames]', 'b']);
  });

  it('folds library frames and mixed runs', () => {
    expect(lines(buildCallStackRows([app('a'), lib('l1'), lib('l2')]))).toEqual(['>a', '[2 library frames]']);
    expect(lines(buildCallStackRows([app('a'), fw('f1'), lib('l1')]))).toEqual(['>a', '[2 framework and library frames]']);
  });

  it('names a run by its label when they share one', () => {
    expect(lines(buildCallStackRows([app('a'), fw('r1', 'React'), fw('r2', 'React')]))).toEqual(['>a', '[2 React frames]']);
    expect(lines(buildCallStackRows([app('a'), fw('r1', 'React'), fw('r2', 'Next')]))).toEqual(['>a', '[2 framework frames]']);
  });

  it('leaves a lone framework frame as it is', () => {
    expect(lines(buildCallStackRows([app('a'), fw('r1'), app('b')]))).toEqual(['>a', 'r1', 'b']);
  });

  it('honors a smaller or larger least run', () => {
    expect(lines(buildCallStackRows([app('a'), fw('r1'), app('b')], { minRun: 1 }))).toEqual(['>a', '[1 framework frame]', 'b']);
    expect(lines(buildCallStackRows([app('a'), fw('r1'), fw('r2'), app('b')], { minRun: 3 }))).toEqual(['>a', 'r1', 'r2', 'b']);
  });

  it('can leave runs unfolded', () => {
    expect(lines(buildCallStackRows([app('a'), fw('r1'), fw('r2')], { collapse: false }))).toEqual(['>a', 'r1', 'r2']);
  });

  it('opens a run under its row, set in', () => {
    const rows = buildCallStackRows([app('a'), fw('r1'), fw('r2')], { expandedRuns: new Set(['r1']) });
    expect(lines(rows)).toEqual(['>a', '[2 framework frames, open]', '  r1', '  r2']);
  });

  it('keeps the top frame on show when the stack stops inside a run', () => {
    expect(lines(buildCallStackRows([fw('r1'), fw('r2'), fw('r3'), app('a')]))).toEqual(['>r1', '[2 framework frames]', 'a']);
  });

  it('keeps the selected frame on show, folding either side of it', () => {
    const frames = [app('a'), fw('r1'), fw('r2'), fw('r3'), fw('r4'), fw('r5'), app('b')];
    expect(lines(buildCallStackRows(frames, { selectedId: 'r3' }))).toEqual(['>a', '[2 framework frames]', 'r3', '[2 framework frames]', 'b']);
    expect(lines(buildCallStackRows(frames, { selectedId: 'r2' }))).toEqual(['>a', 'r1', 'r2', '[3 framework frames]', 'b']);
    expect(lines(buildCallStackRows(frames, { selectedId: 'a' }))).toEqual(['>a', '[5 framework frames]', 'b']);
  });

  it('gives every fold of a split run the same run to open', () => {
    const frames = [fw('r1'), fw('r2'), fw('r3'), fw('r4'), fw('r5'), fw('r6')];
    const [section] = buildCallStackRows(frames, { selectedId: 'r4' });
    const runs = section!.rows.filter((r) => r.kind === 'run');
    expect(runs).toHaveLength(2);
    expect(runs.map((r) => r.kind === 'run' && r.runId)).toEqual(['r1', 'r1']);
    expect(new Set(runs.map((r) => r.key)).size).toBe(2);
    expect(lines(buildCallStackRows(frames, { selectedId: 'r4', expandedRuns: new Set(['r1']) }))).toEqual(['[6 framework frames, open]', '>  r1', '  r2', '  r3', '  r4', '  r5', '  r6']);
  });

  it('keeps a run\'s row the same row, open or closed, so the keyboard stays on it', () => {
    const frames = [app('a'), fw('r1'), fw('r2')];
    const closed = buildCallStackRows(frames)[0]!.rows.find((r) => r.kind === 'run')!;
    const open = buildCallStackRows(frames, { expandedRuns: new Set(['r1']) })[0]!.rows.find((r) => r.kind === 'run')!;
    expect(closed.key).toBe(open.key);
  });

  it('starts a new section at an async boundary', () => {
    const sections = buildCallStackRows([app('a'), boundary('x', 'await load'), app('b'), boundary('y'), app('c')]);
    expect(lines(sections)).toEqual(['>a', '--- await load', 'b', '--- async', 'c']);
  });

  it('never folds across a boundary', () => {
    expect(lines(buildCallStackRows([fw('r1'), fw('r2'), fw('r3'), boundary('x'), fw('r4'), fw('r5')]))).toEqual(['>r1', '[2 framework frames]', '--- async', '[2 framework frames]']);
  });

  it('finds the top past a boundary at the very start, and skips an empty section', () => {
    expect(lines(buildCallStackRows([boundary('x', 'first'), app('a')]))).toEqual(['--- first', '>a']);
    expect(lines(buildCallStackRows([app('a'), boundary('x'), boundary('y', 'second'), app('b')]))).toEqual(['>a', '--- second', 'b']);
    expect(lines(buildCallStackRows([app('a'), boundary('x')]))).toEqual(['>a']);
  });

  it('gives sections keys no frame id can collide with', () => {
    const sections = buildCallStackRows([app('top'), boundary('await'), app('await-frame')]);
    const keys = sections.flatMap((s) => [s.key, ...s.rows.map((r) => r.key)]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('top');
    expect(sections[0]!.key).not.toBe('top');
  });

  it('remembers where a frame is in the list', () => {
    const [section] = buildCallStackRows([app('a'), fw('r1'), app('b')]);
    expect(section!.rows.map((r) => r.kind === 'frame' && r.index)).toEqual([0, 1, 2]);
  });

  it('copes with nothing', () => {
    expect(buildCallStackRows([])).toEqual([]);
  });
});

describe('runLabel', () => {
  it('reads as a count', () => {
    expect(runLabel([fw('a')])).toBe('1 framework frame');
    expect(runLabel([lib('a'), lib('b')])).toBe('2 library frames');
    expect(runLabel([fw('a', 'React'), fw('b', 'React'), fw('c', 'React')])).toBe('3 React frames');
  });
});

describe('reuseCallStackRows', () => {
  const frames = [app('a'), fw('r1'), fw('r2'), boundary('x', 'await'), app('b'), app('c')];

  it('reuses every row and section that did not change', () => {
    const one = buildCallStackRows(frames);
    const two = reuseCallStackRows(one, buildCallStackRows(frames, { selectedId: 'b' }));
    expect(two).toEqual(one);
    expect(two[0]).toBe(one[0]);
    expect(two[1]).toBe(one[1]);
  });

  it('changes only what changed', () => {
    const one = buildCallStackRows(frames);
    const two = reuseCallStackRows(one, buildCallStackRows(frames, { expandedRuns: new Set(['r1']) }));
    expect(two[0]).not.toBe(one[0]);
    expect(two[0]!.rows[0]).toBe(one[0]!.rows[0]);
    expect(two[1]).toBe(one[1]);
  });

  it('notices a new frame object', () => {
    const one = buildCallStackRows(frames);
    const next = [{ ...frames[0]! }, ...frames.slice(1)];
    const two = reuseCallStackRows(one, buildCallStackRows(next));
    expect(two[0]!.rows[0]).not.toBe(one[0]!.rows[0]);
  });

  it('starts from nothing', () => {
    const next = buildCallStackRows(frames);
    expect(reuseCallStackRows(null, next)).toBe(next);
  });
});

describe('callStackRowOffset', () => {
  it('counts rows and separators above a frame', () => {
    const sections = buildCallStackRows([app('a'), fw('r1'), fw('r2'), boundary('x'), app('b')]);
    expect(callStackRowOffset(sections, 'a')).toBe(0);
    expect(callStackRowOffset(sections, 'b')).toBe(3);
    expect(callStackRowOffset(sections, 'r1')).toBeNull();
    expect(callStackRowOffset(sections, 'nope')).toBeNull();
  });
});

describe('locations', () => {
  it.each([
    ['/Users/ada/src/app.tsx', 'app.tsx'],
    ['src\\win\\app.tsx', 'app.tsx'],
    ['app.tsx', 'app.tsx'],
    ['https://x.dev/a/b.js?v=1#top', 'b.js'],
    ['webpack-internal:///./src/page.tsx', 'page.tsx'],
    ['https://x.dev/a/', 'a'],
    ['', ''],
  ])('%s is %s', (file, base) => {
    expect(fileBaseName(file)).toBe(base);
  });

  it('reads short and in full', () => {
    expect(shortLocation({ file: '/a/b.ts', line: 12, column: 5 })).toBe('b.ts:12');
    expect(fullLocation({ file: '/a/b.ts', line: 12, column: 5 })).toBe('/a/b.ts:12:5');
    expect(fullLocation({ file: '/a/b.ts', line: 12 })).toBe('/a/b.ts:12');
    expect(fullLocation({ file: '/a/b.ts', line: 12, column: 0 })).toBe('/a/b.ts:12:0');
  });

  it('answers to its name and file', () => {
    expect(frameText({ id: 'x', functionName: 'f', location: { file: '/a/b.ts', line: 1 } })).toBe('f b.ts:1');
    expect(frameText({ id: 'x' })).toBe('(anonymous)');
  });
});

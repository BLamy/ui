import { beforeAll, describe, expect, it } from 'vitest';
import type { Filter, FilterField, FilterOperator, FilterValue } from '@/lib/filter';
import { buildQuerySchema, clausesToFilters, interpretQuery, matchOption, parseDateText } from '@/lib/filter-query';
import { loadModel, type Clause, type Weights } from '@/lib/gpu-query';

const fields: FilterField[] = [
  { id: 'status', label: 'Status', kind: 'select', options: [
    { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'done', label: 'Done' }, { value: 'canceled', label: 'Canceled' },
  ] },
  { id: 'priority', label: 'Priority', kind: 'select', options: [
    { value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
  ] },
  { id: 'assignee', label: 'Assignee', kind: 'select', options: [
    { value: 'alice', label: 'Alice' }, { value: 'bob', label: 'Bob' }, { value: 'carol', label: 'Carol' },
  ] },
  { id: 'labels', label: 'Labels', kind: 'multiselect', options: [
    { value: 'bug', label: 'Bug' }, { value: 'feature', label: 'Feature' }, { value: 'docs', label: 'Docs' }, { value: 'design', label: 'Design' },
  ] },
  { id: 'created', label: 'Created', kind: 'date' },
  { id: 'points', label: 'Points', kind: 'number' },
  { id: 'title', label: 'Title', kind: 'text' },
  { id: 'blocked', label: 'Blocked', kind: 'boolean' },
];
const NOW = new Date(2026, 0, 14, 15, 30);
const shape = (list: Filter[]) => list.map(({ field, operator, value }) => ({ field, operator, value }));
const byName = buildQuerySchema(fields).byName;
const clause = (field: string, value: string | true, cmp: Clause['cmp'] = 'eq', neg = false): Clause => ({ field, cmp, value, neg });

describe('buildQuerySchema', () => {
  const { schema } = buildQuerySchema(fields);
  it('maps kinds and ids', () => {
    expect(schema.map((f) => [f.name, f.kind])).toEqual([
      ['status', 'enum'], ['priority', 'enum'], ['assignee', 'enum'], ['labels', 'enum'], ['created', 'date'], ['points', 'number'], ['title', 'text'], ['blocked', 'bool'],
    ]);
  });
  it('takes enum values from the options: one-word labels and values, and the significant words of longer ones', () => {
    expect(schema[0].values).toEqual(expect.arrayContaining(['open', 'done', 'canceled', 'in_progress', 'progress']));
    expect(schema[0].values).not.toContain('in'); // a stop word would flag every "in"
    expect(schema[3].values).toEqual(['bug', 'feature', 'docs', 'design']);
    expect(schema[4].values).toEqual([]);
  });
  it('derives aliases from labels, ids and `aliases`, and drops words two fields share', () => {
    const built = buildQuerySchema([
      { id: 'created_at', label: 'Created at', kind: 'date', aliases: ['opened'] },
      { id: 'due_at', label: 'Due at', kind: 'date' },
      { id: 'sev', label: 'Severity level', kind: 'select', options: [{ value: 'a', label: 'A' }], aliases: ['level'] },
      { id: 'lvl', label: 'Level', kind: 'number' },
    ]).schema;
    expect(built[0].name).toBe('created_at');
    expect(built[0].aliases).toEqual(expect.arrayContaining(['created', 'opened']));
    expect(built[1].aliases).toEqual(['due']);
    expect(built[2].aliases).toContain('severity');
    expect(built[2].aliases).not.toContain('level'); // shared with the Level field
  });
  it('keeps names tokenizable', () => {
    expect(buildQuerySchema([{ id: '2fa enabled', label: '2FA', kind: 'boolean' }]).schema[0].name).toBe('f_2fa_enabled');
  });
});

describe('matchOption', () => {
  const options = fields[0].options ?? [];
  it('matches a label or a value exactly, ignoring case, punctuation and spacing', () => {
    expect(matchOption('open', options).option?.value).toBe('open');
    expect(matchOption('IN PROGRESS', options).option?.value).toBe('in_progress');
    expect(matchOption('in_progress', options).option?.value).toBe('in_progress');
    expect(matchOption('inprogress', options).option?.value).toBe('in_progress');
  });
  it('matches fuzzily: a word of a longer label, a prefix, a plural, a typo', () => {
    expect(matchOption('progress', options).option?.value).toBe('in_progress');
    expect(matchOption('in prog', options).option?.value).toBe('in_progress');
    expect(matchOption('cancelled', options).option?.value).toBe('canceled');
    expect(matchOption('opens', options).option?.value).toBe('open');
    expect(matchOption('dnoe', options).option).toBeUndefined();
  });
  it('refuses a value it cannot place, and one it cannot choose between', () => {
    expect(matchOption('banana', options)).toEqual({});
    expect(matchOption('', options)).toEqual({});
    expect(matchOption('in', [{ value: 'a', label: 'In review' }, { value: 'b', label: 'In progress' }])).toEqual({ ambiguous: true });
  });
});

describe('parseDateText', () => {
  it('reads presets, relative spans, "ago", ISO days and month names', () => {
    expect(parseDateText('today', NOW)).toEqual({ type: 'preset', preset: 'today' });
    expect(parseDateText('Last   Week', NOW)).toEqual({ type: 'preset', preset: 'last_week' });
    expect(parseDateText('the last 3 days', NOW)).toEqual({ type: 'relative', amount: 3, unit: 'day' });
    expect(parseDateText('past 2 months', NOW)).toEqual({ type: 'relative', amount: 2, unit: 'month' });
    expect(parseDateText('3 days ago', NOW)).toEqual({ type: 'date', date: '2026-01-11' });
    expect(parseDateText('2026 - 01 - 05', NOW)).toEqual({ type: 'date', date: '2026-01-05' });
    expect(parseDateText('jan 5', NOW)).toEqual({ type: 'date', date: '2026-01-05' });
    expect(parseDateText('5th March 2025', NOW)).toEqual({ type: 'date', date: '2025-03-05' });
    expect(parseDateText('December 20, 2025', NOW)).toEqual({ type: 'date', date: '2025-12-20' });
  });
  it('returns null for what it does not know', () => {
    for (const bad of ['', 'soon', '2026-02-30', 'feb 30', 'blursday 3', 'last 0 days']) expect(parseDateText(bad, NOW)).toBeNull();
  });
});

describe('clausesToFilters', () => {
  const map = (clauses: Clause[]) => clausesToFilters(clauses, byName, { now: NOW });
  it('maps a value to its option and cmp + neg to an operator', () => {
    expect(shape(map([clause('status', 'open')]).filters)).toEqual([{ field: 'status', operator: 'is', value: ['open'] }]);
    expect(shape(map([clause('status', 'done', 'eq', true)]).filters)).toEqual([{ field: 'status', operator: 'is_not', value: ['done'] }]);
    expect(shape(map([clause('labels', 'bug')]).filters)).toEqual([{ field: 'labels', operator: 'includes_any', value: ['bug'] }]);
    expect(shape(map([clause('labels', 'bug', 'contains', true)]).filters)).toEqual([{ field: 'labels', operator: 'includes_none', value: ['bug'] }]);
  });
  it('merges same-field values into "any of", says so, and keeps negations as "none of"', () => {
    const merged = map([clause('priority', 'urgent'), clause('assignee', 'bob'), clause('priority', 'high')]);
    expect(shape(merged.filters)).toEqual([
      { field: 'priority', operator: 'is_any_of', value: ['urgent', 'high'] },
      { field: 'assignee', operator: 'is', value: ['bob'] },
    ]);
    expect(merged.notes).toEqual(['Read “Urgent” and “High” as any of Priority']);
    expect(shape(map([clause('status', 'done', 'eq', true), clause('status', 'canceled', 'eq', true)]).filters)).toEqual([{ field: 'status', operator: 'is_none_of', value: ['done', 'canceled'] }]);
    expect(map([clause('status', 'open'), clause('status', 'Open')]).filters).toHaveLength(1);
  });
  it('ignores a comparison on a select field (the model tags "to" and "not" as <), and splits a clause that holds several values', () => {
    expect(shape(map([clause('assignee', 'alice', 'lt')]).filters)).toEqual([{ field: 'assignee', operator: 'is', value: ['alice'] }]);
    const split = map([clause('assignee', 'urgent bob issues')]);
    expect(shape(split.filters)).toEqual([
      { field: 'priority', operator: 'is', value: ['urgent'] },
      { field: 'assignee', operator: 'is', value: ['bob'] },
    ]);
    expect(split.unresolved).toEqual([{ text: 'issues', reason: 'Not a value of any field' }]);
  });
  it('reads a negation word inside the clause even when the model called it something else', () => {
    const trace = { tokens: ['status', 'not', 'done'], roles: ['FIELD', 'OP_LT', 'VALUE'], spans: [[0, 3] as [number, number]], resolved: [null, null, null] };
    const r = clausesToFilters([clause('status', 'done', 'lt')], byName, { now: NOW, trace });
    expect(shape(r.filters)).toEqual([{ field: 'status', operator: 'is_not', value: ['done'] }]);
  });
  it('maps numbers, flipping a negated comparison', () => {
    expect(shape(map([clause('points', '5', 'gt')]).filters)).toEqual([{ field: 'points', operator: 'gt', value: 5 }]);
    expect(shape(map([clause('points', '5', 'lt', true)]).filters)).toEqual([{ field: 'points', operator: 'gte', value: 5 }]);
    expect(shape(map([clause('points', '5', 'gt', true)]).filters)).toEqual([{ field: 'points', operator: 'lte', value: 5 }]);
    expect(shape(map([clause('points', '5', 'eq', true)]).filters)).toEqual([{ field: 'points', operator: 'neq', value: 5 }]);
    expect(shape(map([clause('points', '2 k', 'gt')]).filters)).toEqual([{ field: 'points', operator: 'gt', value: 2000 }]);
  });
  it('maps dates, and text as "contains"', () => {
    expect(shape(map([clause('created', 'last week')]).filters)).toEqual([{ field: 'created', operator: 'is', value: { type: 'preset', preset: 'last_week' } }]);
    expect(shape(map([clause('created', 'jan 5', 'lt')]).filters)).toEqual([{ field: 'created', operator: 'before', value: { type: 'date', date: '2026-01-05' } }]);
    expect(shape(map([clause('created', 'last 3 days')]).filters)).toEqual([{ field: 'created', operator: 'in_the_last', value: { type: 'relative', amount: 3, unit: 'day' } }]);
    expect(shape(map([clause('title', 'crash')]).filters)).toEqual([{ field: 'title', operator: 'contains', value: 'crash' }]);
    expect(shape(map([clause('title', 'crash', 'contains', true)]).filters)).toEqual([{ field: 'title', operator: 'not_contains', value: 'crash' }]);
  });
  it('maps booleans, with negation as "no"', () => {
    expect(shape(map([clause('blocked', true, 'is')]).filters)).toEqual([{ field: 'blocked', operator: 'is', value: true }]);
    expect(shape(map([clause('blocked', true, 'is', true)]).filters)).toEqual([{ field: 'blocked', operator: 'is', value: false }]);
    expect(shape(map([clause('blocked', 'no')]).filters)).toEqual([{ field: 'blocked', operator: 'is', value: false }]);
  });
  it('reports what it cannot map instead of guessing', () => {
    const r = map([
      clause('status', 'banana'), clause('points', 'lots'), clause('created', 'someday'),
      clause('created', 'jan 5', 'lt', true), clause('created', 'last 3 days', 'eq', true), clause('blocked', 'perhaps'), clause('ghost', 'x'),
    ]);
    expect(r.filters).toEqual([]);
    expect(r.unresolved.map((u) => u.reason)).toEqual([
      'No Status called “banana”',
      '“lots” is not a number',
      '“someday” is not a date I know (try “last week”, “3 days ago” or “2026-01-05”)',
      'A negated date comparison is not supported',
      'A negated “in the last” is not supported',
      '“perhaps” is not yes or no',
      'Unknown field “ghost”',
    ]);
  });
});

/* ── The golden set: real phrases through the real model ──
   Twenty-two phrases an issue-tracker user might type, each with the filters a person would expect. They were written
   before looking at what the model returns and are not tuned to it: the hit rate below is what the vendored
   checkpoint + this mapping actually achieve on them. (The 98.9% in gpu-query's README is on its own generated corpus.) */
type Expect = Array<{ field: string; operator: FilterOperator; value: FilterValue }>;
const golden: Array<[string, Expect]> = [
  ['status open', [{ field: 'status', operator: 'is', value: ['open'] }]],
  ['open issues', [{ field: 'status', operator: 'is', value: ['open'] }]],
  ['priority high', [{ field: 'priority', operator: 'is', value: ['high'] }]],
  ['high priority', [{ field: 'priority', operator: 'is', value: ['high'] }]],
  ['assigned to alice', [{ field: 'assignee', operator: 'is', value: ['alice'] }]],
  ['alice or bob', [{ field: 'assignee', operator: 'is_any_of', value: ['alice', 'bob'] }]],
  ['not done', [{ field: 'status', operator: 'is_not', value: ['done'] }]],
  ['status is not canceled', [{ field: 'status', operator: 'is_not', value: ['canceled'] }]],
  ['label bug', [{ field: 'labels', operator: 'includes_any', value: ['bug'] }]],
  ['labels design and docs', [{ field: 'labels', operator: 'includes_any', value: ['design', 'docs'] }]],
  ['blocked', [{ field: 'blocked', operator: 'is', value: true }]],
  ['not blocked', [{ field: 'blocked', operator: 'is', value: false }]],
  ['points greater than 5', [{ field: 'points', operator: 'gt', value: 5 }]],
  ['points under 3', [{ field: 'points', operator: 'lt', value: 3 }]],
  ['title containing crash', [{ field: 'title', operator: 'contains', value: 'crash' }]],
  ['created last week', [{ field: 'created', operator: 'is', value: { type: 'preset', preset: 'last_week' } }]],
  ['created before 2026-01-05', [{ field: 'created', operator: 'before', value: { type: 'date', date: '2026-01-05' } }]],
  ['created in the last 3 days', [{ field: 'created', operator: 'in_the_last', value: { type: 'relative', amount: 3, unit: 'day' } }]],
  ['urgent bugs assigned to bob', [
    { field: 'priority', operator: 'is', value: ['urgent'] }, { field: 'labels', operator: 'includes_any', value: ['bug'] }, { field: 'assignee', operator: 'is', value: ['bob'] },
  ]],
  ['high priority open issues created after jan 5', [
    { field: 'priority', operator: 'is', value: ['high'] }, { field: 'status', operator: 'is', value: ['open'] },
    { field: 'created', operator: 'after', value: { type: 'date', date: '2026-01-05' } },
  ]],
  ['show me all the done tasks please', [{ field: 'status', operator: 'is', value: ['done'] }]],
  ['in progress', [{ field: 'status', operator: 'is', value: ['in_progress'] }]],
];

const HELD_OUT_FLOOR = 26; // observed on the first run: 26 of 32

/* The held-out set: thirty-two more phrases, written AFTER the mapping's repairs (negation words, comparisons on
   selects, split values, dates from the whole clause) had been tuned against the golden set above, and run once before
   anything was changed in response. It is the fairer estimate of how the whole thing does on phrasing it was not
   fitted to. Several are deliberately hard (possessives, "at least", plurals, typos). */
const heldOut: Array<[string, Expect]> = [
  ['issues assigned to carol', [{ field: 'assignee', operator: 'is', value: ['carol'] }]],
  ['show me urgent issues', [{ field: 'priority', operator: 'is', value: ['urgent'] }]],
  ['everything that is not canceled', [{ field: 'status', operator: 'is_not', value: ['canceled'] }]],
  ['low priority', [{ field: 'priority', operator: 'is', value: ['low'] }]],
  ['medium or high priority', [{ field: 'priority', operator: 'is_any_of', value: ['medium', 'high'] }]],
  ['status is in progress', [{ field: 'status', operator: 'is', value: ['in_progress'] }]],
  ['open and blocked', [{ field: 'status', operator: 'is', value: ['open'] }, { field: 'blocked', operator: 'is', value: true }]],
  ['feature requests', [{ field: 'labels', operator: 'includes_any', value: ['feature'] }]],
  ['tagged design', [{ field: 'labels', operator: 'includes_any', value: ['design'] }]],
  ['points at least 8', [{ field: 'points', operator: 'gte', value: 8 }]],
  ['points over 13', [{ field: 'points', operator: 'gt', value: 13 }]],
  ['points equal to 5', [{ field: 'points', operator: 'eq', value: 5 }]],
  ['title mentions login', [{ field: 'title', operator: 'contains', value: 'login' }]],
  ['created yesterday', [{ field: 'created', operator: 'is', value: { type: 'preset', preset: 'yesterday' } }]],
  ['created today', [{ field: 'created', operator: 'is', value: { type: 'preset', preset: 'today' } }]],
  ['created this month', [{ field: 'created', operator: 'is', value: { type: 'preset', preset: 'this_month' } }]],
  ['created after 2025-12-31', [{ field: 'created', operator: 'after', value: { type: 'date', date: '2025-12-31' } }]],
  ['created 3 days ago', [{ field: 'created', operator: 'is', value: { type: 'date', date: '2026-01-11' } }]],
  ['created in the last 2 weeks', [{ field: 'created', operator: 'in_the_last', value: { type: 'relative', amount: 2, unit: 'week' } }]],
  ["bob's open tasks", [{ field: 'assignee', operator: 'is', value: ['bob'] }, { field: 'status', operator: 'is', value: ['open'] }]],
  ['done tasks assigned to alice', [{ field: 'status', operator: 'is', value: ['done'] }, { field: 'assignee', operator: 'is', value: ['alice'] }]],
  ['high priority bugs', [{ field: 'priority', operator: 'is', value: ['high'] }, { field: 'labels', operator: 'includes_any', value: ['bug'] }]],
  ['urgent bug', [{ field: 'priority', operator: 'is', value: ['urgent'] }, { field: 'labels', operator: 'includes_any', value: ['bug'] }]],
  ['not assigned to bob', [{ field: 'assignee', operator: 'is_not', value: ['bob'] }]],
  ['blocked and urgent', [{ field: 'blocked', operator: 'is', value: true }, { field: 'priority', operator: 'is', value: ['urgent'] }]],
  ['priority is not low', [{ field: 'priority', operator: 'is_not', value: ['low'] }]],
  ['status cancelled', [{ field: 'status', operator: 'is', value: ['canceled'] }]],
  ['label designn', [{ field: 'labels', operator: 'includes_any', value: ['design'] }]],
  ['title contains crash and priority urgent', [{ field: 'title', operator: 'contains', value: 'crash' }, { field: 'priority', operator: 'is', value: ['urgent'] }]],
  ['created before jan 10 2026', [{ field: 'created', operator: 'before', value: { type: 'date', date: '2026-01-10' } }]],
  ['assignee alice, bob', [{ field: 'assignee', operator: 'is_any_of', value: ['alice', 'bob'] }]],
  ['open issues assigned to bob with points over 3', [
    { field: 'status', operator: 'is', value: ['open'] }, { field: 'assignee', operator: 'is', value: ['bob'] }, { field: 'points', operator: 'gt', value: 3 },
  ]],
];

describe('the golden set (gpu-query checkpoint + the mapping)', () => {
  let model: Weights;
  beforeAll(async () => { model = await loadModel(); });
  const key = (e: Expect[number]) => `${e.field}|${e.operator}|${JSON.stringify(e.value)}`;
  const sorted = (list: Expect) => [...list].sort((a, b) => key(a).localeCompare(key(b)));
  const run = (text: string) => sorted(shape(interpretQuery(model, text, fields, { now: NOW }).filters));
  const score = (name: string, set: Array<[string, Expect]>) => {
    const rows = set.map(([text, want]) => {
      const got = run(text);
      return { text, hit: JSON.stringify(got) === JSON.stringify(sorted(want)), got };
    });
    const hits = rows.filter((r) => r.hit).length;
    if (process.env.GOLDEN_VERBOSE) {
      for (const r of rows) console.info(`${r.hit ? 'PASS' : 'FAIL'}  ${r.text}${r.hit ? '' : `\n        got ${JSON.stringify(r.got)}`}`);
      console.info(`${name}: ${hits}/${set.length} = ${((hits / set.length) * 100).toFixed(1)}%`);
    }
    return hits;
  };

  // Ratchets: raise a floor when the mapping improves, never lower it.
  it('reports the real hit rate on the golden set (fitted to: before any repairs it was 16/22, 72.7%)', () => {
    expect(score('golden set', golden)).toBeGreaterThanOrEqual(21);
  });
  it('reports the real hit rate on the held-out set (not fitted to)', () => {
    expect(score('held-out set', heldOut)).toBeGreaterThanOrEqual(HELD_OUT_FLOOR);
  });

  it('never throws, whatever the phrase', () => {
    const phrases = ['', '   ', '???', 'and or not', '€€€ 123 !!!', 'a'.repeat(500), 'status ' + 'open '.repeat(60), '"; DROP TABLE issues;--'];
    const attempts = phrases.map((text) => () => interpretQuery(model, text, fields, { now: NOW }));
    for (const attempt of attempts) expect(attempt).not.toThrow();
  });

  it('reports a dropped fragment', () => {
    const r = interpretQuery(model, 'status open and priority banana', fields, { now: NOW });
    expect(shape(r.filters)).toEqual([{ field: 'status', operator: 'is', value: ['open'] }]);
    expect(r.unresolved.length).toBeGreaterThan(0);
  });
});

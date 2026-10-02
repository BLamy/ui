import { describe, expect, it } from 'vitest';
import {
  FILTER_OPERATORS, coerceFilter, createFilter, dateRange, defaultOperator, describeFilter, matchFilters, matchesFilters,
  operatorLabel, operatorsFor, parseFilters, serializeFilters, toTime, withOperator, withValue,
  type DateValue, type Filter, type FilterField, type FilterOperator, type FilterValue,
} from '@/lib/filter';

const fields: FilterField[] = [
  { id: 'status', label: 'Status', kind: 'select', options: [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }, { value: 'wip', label: 'In progress' }] },
  { id: 'labels', label: 'Labels', kind: 'multiselect', options: [{ value: 'bug', label: 'Bug' }, { value: 'ui', label: 'UI' }, { value: 'docs', label: 'Docs' }] },
  { id: 'urgent', label: 'Urgent', kind: 'boolean' },
  { id: 'created', label: 'Created', kind: 'date' },
  { id: 'points', label: 'Points', kind: 'number' },
  { id: 'title', label: 'Title', kind: 'text' },
];

// Wed 14 Jan 2026, 15:30 local. Every date below is built from local parts, so the suite holds in any time zone.
const NOW = new Date(2026, 0, 14, 15, 30).getTime();
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

interface Item { id: number; status: string; labels: string[]; urgent: boolean; created: number | string; points: number | null; title: string }
const items: Item[] = [
  { id: 1, status: 'open', labels: ['bug', 'ui'], urgent: true, created: local(2026, 1, 14, 9), points: 3, title: 'Crash on save' },
  { id: 2, status: 'closed', labels: ['docs'], urgent: false, created: local(2026, 1, 13), points: 5, title: 'Update the README' },
  { id: 3, status: 'wip', labels: [], urgent: false, created: local(2026, 1, 9), points: 8, title: 'Dark mode polish' },
  { id: 4, status: 'open', labels: ['ui'], urgent: true, created: local(2025, 12, 20), points: null, title: 'Crash in Safari' },
  { id: 5, status: 'closed', labels: ['bug'], urgent: false, created: '2025-11-30', points: 1, title: 'Typo in docs' },
];
const get = (item: Item, field: string) => (item as unknown as Record<string, unknown>)[field];
const f = (field: string, operator: FilterOperator, value: FilterValue): Filter => ({ id: `t-${field}-${operator}`, field, operator, value });
const ids = (filters: Filter[], match: 'all' | 'any' = 'all') => matchFilters(items, filters, fields, get, { match, now: NOW }).map((i) => i.id);

describe('operator tables', () => {
  it('lists operators per kind, with the default first', () => {
    expect(operatorsFor('select')).toEqual(['is', 'is_not', 'is_any_of', 'is_none_of']);
    expect(operatorsFor('multiselect')).toEqual(['includes_any', 'includes_all', 'includes_none']);
    expect(operatorsFor('date')).toEqual(['is', 'before', 'after', 'in_the_last']);
    expect(operatorsFor('number')).toEqual(['eq', 'neq', 'lt', 'lte', 'gt', 'gte']);
    expect(operatorsFor('text')).toContain('not_contains');
    for (const kind of Object.keys(FILTER_OPERATORS) as Array<keyof typeof FILTER_OPERATORS>) expect(defaultOperator(kind)).toBe(operatorsFor(kind)[0]);
  });
  it('words them, reading "any of" as "is" for one value', () => {
    expect(operatorLabel('is_any_of')).toBe('is any of');
    expect(operatorLabel('is_any_of', 1)).toBe('is');
    expect(operatorLabel('includes_none', 1)).toBe('does not include');
    expect(operatorLabel('not_contains')).toBe("doesn't contain");
    expect(operatorLabel('lte')).toBe('≤');
  });
  it('coerces a filter so operator and value agree', () => {
    const [status, , , created] = fields;
    expect(coerceFilter(status, 'is', ['a', 'b'])).toEqual({ operator: 'is_any_of', value: ['a', 'b'] });
    expect(coerceFilter(status, 'is_none_of', ['a'])).toEqual({ operator: 'is_not', value: ['a'] });
    expect(coerceFilter(status, 'contains', ['a']).operator).toBe('is');
    expect(coerceFilter(created, 'in_the_last', { type: 'preset', preset: 'today' }).value).toEqual({ type: 'relative', amount: 7, unit: 'day' });
    expect(coerceFilter(created, 'before', { type: 'relative', amount: 3, unit: 'day' }).value).toEqual({ type: 'preset', preset: 'last_7_days' });
    expect(createFilter(status, ['open']).operator).toBe('is');
  });
  it('changes a value or an operator on an existing filter', () => {
    const [status, , , created] = fields;
    const one = f('status', 'is', ['open']);
    expect(withValue(status, one, ['open', 'closed'])).toMatchObject({ operator: 'is_any_of', value: ['open', 'closed'] });
    expect(withValue(status, f('status', 'is_any_of', ['open', 'closed']), ['open'])).toMatchObject({ operator: 'is', value: ['open'] });
    expect(withOperator(status, f('status', 'is_any_of', ['open', 'closed']), 'is_none_of')).toMatchObject({ operator: 'is_none_of', value: ['open', 'closed'] });
    // "is any of" with one value stays what the user chose; "is" keeps only the first of several
    expect(withOperator(status, one, 'is_any_of')).toMatchObject({ operator: 'is_any_of', value: ['open'] });
    expect(withOperator(status, f('status', 'is_any_of', ['open', 'closed']), 'is')).toMatchObject({ operator: 'is', value: ['open'] });
    expect(withOperator(status, one, 'contains')).toBe(one);
    expect(withOperator(created, f('created', 'is', { type: 'preset', preset: 'today' }), 'in_the_last').value).toEqual({ type: 'relative', amount: 7, unit: 'day' });
    expect(withOperator(created, f('created', 'in_the_last', { type: 'relative', amount: 7, unit: 'day' }), 'after').value).toEqual({ type: 'preset', preset: 'last_7_days' });
  });
});

describe('matchFilters: select', () => {
  it('is / is any of', () => {
    expect(ids([f('status', 'is', ['open'])])).toEqual([1, 4]);
    expect(ids([f('status', 'is_any_of', ['open', 'wip'])])).toEqual([1, 3, 4]);
  });
  it('is not / is none of (an item without a value passes)', () => {
    expect(ids([f('status', 'is_not', ['open'])])).toEqual([2, 3, 5]);
    expect(ids([f('status', 'is_none_of', ['open', 'closed'])])).toEqual([3]);
  });
});

describe('matchFilters: multiselect', () => {
  it('includes any / all / none', () => {
    expect(ids([f('labels', 'includes_any', ['bug', 'docs'])])).toEqual([1, 2, 5]);
    expect(ids([f('labels', 'includes_all', ['bug', 'ui'])])).toEqual([1]);
    expect(ids([f('labels', 'includes_none', ['ui'])])).toEqual([2, 3, 5]);
  });
});

describe('matchFilters: boolean', () => {
  it('is / is not', () => {
    expect(ids([f('urgent', 'is', true)])).toEqual([1, 4]);
    expect(ids([f('urgent', 'is', false)])).toEqual([2, 3, 5]);
    expect(ids([f('urgent', 'is_not', true)])).toEqual([2, 3, 5]);
  });
});

describe('matchFilters: number', () => {
  it('compares, and a missing number only satisfies ≠', () => {
    expect(ids([f('points', 'eq', 5)])).toEqual([2]);
    expect(ids([f('points', 'neq', 5)])).toEqual([1, 3, 4, 5]);
    expect(ids([f('points', 'lt', 5)])).toEqual([1, 5]);
    expect(ids([f('points', 'lte', 5)])).toEqual([1, 2, 5]);
    expect(ids([f('points', 'gt', 3)])).toEqual([2, 3]);
    expect(ids([f('points', 'gte', 3)])).toEqual([1, 2, 3]);
  });
});

describe('matchFilters: text', () => {
  it('contains / does not contain / is / is not, ignoring case', () => {
    expect(ids([f('title', 'contains', 'crash')])).toEqual([1, 4]);
    expect(ids([f('title', 'not_contains', 'CRASH')])).toEqual([2, 3, 5]);
    expect(ids([f('title', 'is', 'typo in docs')])).toEqual([5]);
    expect(ids([f('title', 'is_not', 'Typo in docs')])).toEqual([1, 2, 3, 4]);
  });
});

describe('matchFilters: date', () => {
  const day = (preset: DateValue) => preset;
  it('presets', () => {
    expect(ids([f('created', 'is', day({ type: 'preset', preset: 'today' }))])).toEqual([1]);
    expect(ids([f('created', 'is', day({ type: 'preset', preset: 'yesterday' }))])).toEqual([2]);
    expect(ids([f('created', 'is', day({ type: 'preset', preset: 'this_week' }))])).toEqual([1, 2]); // Mon 12 – Sun 18
    expect(ids([f('created', 'is', day({ type: 'preset', preset: 'last_week' }))])).toEqual([3]); // Mon 5 – Sun 11
    expect(ids([f('created', 'is', day({ type: 'preset', preset: 'last_7_days' }))])).toEqual([1, 2, 3]);
    expect(ids([f('created', 'is', day({ type: 'preset', preset: 'last_30_days' }))])).toEqual([1, 2, 3, 4]);
    expect(ids([f('created', 'is', day({ type: 'preset', preset: 'this_month' }))])).toEqual([1, 2, 3]);
    expect(ids([f('created', 'is', day({ type: 'preset', preset: 'last_month' }))])).toEqual([4]);
    expect(ids([f('created', 'is', day({ type: 'preset', preset: 'this_year' }))])).toEqual([1, 2, 3]);
  });
  it('weeks can start on Sunday', () => {
    const range = dateRange({ type: 'preset', preset: 'this_week' }, { now: NOW, weekStart: 0 });
    if (!range) throw new Error('no range');
    expect(new Date(range.start).getDate()).toBe(11);
  });
  it('is / before / after a calendar day', () => {
    expect(ids([f('created', 'is', { type: 'date', date: '2026-01-13' })])).toEqual([2]);
    expect(ids([f('created', 'before', { type: 'date', date: '2026-01-09' })])).toEqual([4, 5]);
    expect(ids([f('created', 'after', { type: 'date', date: '2026-01-09' })])).toEqual([1, 2]);
    expect(ids([f('created', 'after', { type: 'date', date: '2025-11-30' })])).toEqual([1, 2, 3, 4]);
  });
  it('before / after a preset', () => {
    expect(ids([f('created', 'before', { type: 'preset', preset: 'this_week' })])).toEqual([3, 4, 5]);
    expect(ids([f('created', 'after', { type: 'preset', preset: 'last_week' })])).toEqual([1, 2]);
  });
  it('in the last N units, up to now', () => {
    expect(ids([f('created', 'in_the_last', { type: 'relative', amount: 2, unit: 'day' })])).toEqual([1, 2]);
    expect(ids([f('created', 'in_the_last', { type: 'relative', amount: 1, unit: 'week' })])).toEqual([1, 2, 3]);
    expect(ids([f('created', 'in_the_last', { type: 'relative', amount: 1, unit: 'month' })])).toEqual([1, 2, 3, 4]);
    expect(ids([f('created', 'in_the_last', { type: 'relative', amount: 2, unit: 'month' })])).toEqual([1, 2, 3, 4, 5]);
    expect(ids([f('created', 'in_the_last', { type: 'relative', amount: 1, unit: 'year' })])).toEqual([1, 2, 3, 4, 5]);
  });
  it('reads Date, epoch and ISO values, and skips what is not a date', () => {
    expect(toTime(new Date(2026, 0, 1))).toBe(new Date(2026, 0, 1).getTime());
    expect(toTime('2026-01-01')).toBe(new Date(2026, 0, 1).getTime());
    expect(toTime('2026-01-01T10:00:00Z')).toBe(Date.parse('2026-01-01T10:00:00Z'));
    expect(toTime('soon')).toBeNull();
    expect(toTime(null)).toBeNull();
    expect(ids([f('created', 'is', { type: 'preset', preset: 'today' })])).not.toContain(0);
  });
});

describe('matchFilters: combining', () => {
  const both = [f('status', 'is', ['open']), f('labels', 'includes_any', ['bug'])];
  it('all: every filter holds', () => expect(ids(both, 'all')).toEqual([1]));
  it('any: at least one holds', () => expect(ids(both, 'any')).toEqual([1, 4, 5])); // open: 1, 4 · bug: 1, 5
  it('no filters keeps everything, in order', () => expect(ids([])).toEqual([1, 2, 3, 4, 5]));
  it('ignores a filter with no value yet and one on an unknown field', () => {
    expect(ids([f('status', 'is', []), f('nope', 'is', ['x']), f('title', 'contains', '  ')])).toEqual([1, 2, 3, 4, 5]);
    expect(matchesFilters(items[0], [f('status', 'is', [])], fields, get)).toBe(true);
  });
  it('does not mutate its input', () => {
    const copy = [...items];
    ids([f('status', 'is', ['open'])]);
    expect(items).toEqual(copy);
  });
});

describe('describeFilter', () => {
  it('reads as a sentence', () => {
    expect(describeFilter(f('status', 'is_any_of', ['open', 'wip']), fields)).toBe('Status is any of Open, In progress');
    expect(describeFilter(f('status', 'is_any_of', ['open']), fields)).toBe('Status is Open');
    expect(describeFilter(f('urgent', 'is', true), fields)).toBe('Urgent is Yes');
    expect(describeFilter(f('created', 'in_the_last', { type: 'relative', amount: 1, unit: 'week' }), fields)).toBe('Created in the last 1 week');
    expect(describeFilter(f('created', 'after', { type: 'date', date: '2026-01-09' }), fields)).toBe('Created after Jan 9, 2026');
    expect(describeFilter(f('created', 'is', { type: 'preset', preset: 'last_7_days' }), fields)).toBe('Created is Last 7 days');
    expect(describeFilter(f('points', 'gte', 3), fields)).toBe('Points ≥ 3');
    expect(describeFilter(f('mystery', 'is', ['x']), fields)).toBe('mystery is x');
  });
});

describe('serializeFilters / parseFilters', () => {
  const strip = (list: Filter[]) => list.map(({ field, operator, value }) => ({ field, operator, value }));
  const sample: Filter[] = [
    f('status', 'is_any_of', ['open', 'wip']),
    f('labels', 'includes_all', ['bug', 'ui']),
    f('urgent', 'is', false),
    f('created', 'after', { type: 'date', date: '2026-01-09' }),
    f('created', 'is', { type: 'preset', preset: 'last_7_days' }),
    f('created', 'in_the_last', { type: 'relative', amount: 3, unit: 'month' }),
    f('points', 'gte', 2.5),
    f('title', 'not_contains', 'a:b;c,d%e é 日本'),
  ];
  it('round-trips every kind', () => {
    const text = serializeFilters(sample);
    expect(strip(parseFilters(text, fields))).toEqual(strip(sample));
  });
  it('is URL-safe as written', () => {
    const text = serializeFilters(sample);
    expect(text).toMatch(/^[A-Za-z0-9\-_.!~*'()%:;,]+$/);
    expect(strip(parseFilters(new URLSearchParams({ f: text }).get('f') ?? '', fields))).toEqual(strip(sample));
    expect(strip(parseFilters(decodeURIComponent(encodeURIComponent(text)), fields))).toEqual(strip(sample));
  });
  it('writes the documented grammar', () => {
    expect(serializeFilters([f('status', 'is_any_of', ['open', 'closed']), f('created', 'in_the_last', { type: 'relative', amount: 7, unit: 'day' })]))
      .toBe('status:is_any_of:open,closed;created:in_the_last:7d');
  });
  it('leaves out incomplete filters and gives parsed filters fresh ids', () => {
    expect(serializeFilters([f('status', 'is', []), f('title', 'contains', '')])).toBe('');
    const [a, b] = [parseFilters('status:is:open', fields)[0], parseFilters('status:is:open', fields)[0]];
    expect(a.id).not.toBe(b.id);
  });
  it('drops what the schema does not allow instead of throwing', () => {
    expect(parseFilters('', fields)).toEqual([]);
    expect(parseFilters('nope:is:x;status:contains:x;status:is;points:eq:abc;urgent:is:maybe;created:in_the_last:today;created:after:7d;created:is:2026-02-30;title:contains:%E0%A4%A', fields)).toEqual([]);
    expect(strip(parseFilters('garbage;status:is:open;;::', fields))).toEqual([{ field: 'status', operator: 'is', value: ['open'] }]);
  });
});

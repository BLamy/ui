import type { ReactNode } from 'react';

/* ══ Filters — a UI-independent, serializable model ══
   A `FilterField` describes something you can filter by; a `Filter` is one condition on a field
   (`status is any of open, confirmed`). Everything here is a plain function over plain data, so the same filters can
   drive a list, a URL, a database query or a test:

     const fields: FilterField[] = [
       { id: 'status', label: 'Status', kind: 'select', options: [{ value: 'open', label: 'Open' }, …] },
       { id: 'created', label: 'Created', kind: 'date' },
     ];
     const shown = matchFilters(issues, filters, fields, (issue, field) => issue[field], { match: 'all' });
     const url = serializeFilters(filters);          // 'status:is_any_of:open,closed;created:after:2026-01-31'
     const back = parseFilters(url, fields);

   `FilterBar`, `FilterMenu` and `FilterChip` (components/filter) are one view of this model. */

/* ── fields ── */

export type FilterKind = 'select' | 'multiselect' | 'boolean' | 'date' | 'number' | 'text';

export interface FilterOption {
  /** Stored in the filter and compared with the item's value. */
  value: string;
  label: string;
  /** An Icon name or any node. */
  icon?: ReactNode;
  /** A CSS color: draws a dot before the label (a status, a severity). */
  color?: string;
  /** Shown trailing in the picker. */
  count?: number;
  /** Extra words the picker's search matches. */
  keywords?: string[];
}

export interface FilterField {
  id: string;
  label: string;
  /** An Icon name or any node. */
  icon?: ReactNode;
  /**
   * `select` — an item has one value (status); `multiselect` — it has several (labels, assignees);
   * `boolean`, `date`, `number`, `text`.
   */
  kind: FilterKind;
  /** The values of a `select` / `multiselect` (and what the natural-language input can name). */
  options?: FilterOption[];
  /** Other words for the field in a typed phrase ("sev" for Severity). */
  aliases?: string[];
}

/* ── operators ── */

export type FilterOperator =
  | 'is' | 'is_not' | 'is_any_of' | 'is_none_of'
  | 'includes_any' | 'includes_all' | 'includes_none'
  | 'contains' | 'not_contains'
  | 'before' | 'after' | 'in_the_last'
  | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte';

/** Operators each kind offers, in menu order. The first is the default. */
export const FILTER_OPERATORS: Record<FilterKind, readonly FilterOperator[]> = {
  select: ['is', 'is_not', 'is_any_of', 'is_none_of'],
  multiselect: ['includes_any', 'includes_all', 'includes_none'],
  boolean: ['is'],
  date: ['is', 'before', 'after', 'in_the_last'],
  number: ['eq', 'neq', 'lt', 'lte', 'gt', 'gte'],
  text: ['contains', 'not_contains', 'is', 'is_not'],
};

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  is: 'is', is_not: 'is not', is_any_of: 'is any of', is_none_of: 'is none of',
  includes_any: 'includes any of', includes_all: 'includes all of', includes_none: 'includes none of',
  contains: 'contains', not_contains: "doesn't contain",
  before: 'before', after: 'after', in_the_last: 'in the last',
  eq: '=', neq: '≠', lt: '<', lte: '≤', gt: '>', gte: '≥',
};

/** The operators a kind offers. */
export function operatorsFor(kind: FilterKind): readonly FilterOperator[] {
  return FILTER_OPERATORS[kind];
}

/** The operator a new filter of this kind starts with. */
export function defaultOperator(kind: FilterKind): FilterOperator {
  return FILTER_OPERATORS[kind][0];
}

/** An operator as words. With one value selected the "any of" forms read naturally as "is" / "includes". */
export function operatorLabel(operator: FilterOperator, valueCount = 2): string {
  if (valueCount === 1) {
    if (operator === 'is_any_of') return 'is';
    if (operator === 'is_none_of') return 'is not';
    if (operator === 'includes_any') return 'includes';
    if (operator === 'includes_none') return 'does not include';
  }
  return OPERATOR_LABELS[operator];
}

/* ── values ── */

export type DatePreset =
  | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'last_7_days' | 'last_30_days' | 'this_month' | 'last_month' | 'this_year';
export type RelativeUnit = 'day' | 'week' | 'month' | 'year';

/** A date filter's value: a named range, one calendar day (`YYYY-MM-DD`), or "N units back from now". */
export type DateValue =
  | { type: 'preset'; preset: DatePreset }
  | { type: 'date'; date: string }
  | { type: 'relative'; amount: number; unit: RelativeUnit };

/** `string[]` for select / multiselect (option values), `boolean`, `number`, `string` (text) or a `DateValue`. */
export type FilterValue = string[] | boolean | number | string | DateValue;

export const DATE_PRESETS: ReadonlyArray<{ id: DatePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'last_30_days', label: 'Last 30 days' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_year', label: 'This year' },
];
export const RELATIVE_UNITS: readonly RelativeUnit[] = ['day', 'week', 'month', 'year'];

/** One condition on one field. */
export interface Filter {
  /** Identity for keys and edits — not part of the serialized form. */
  id: string;
  /** A `FilterField.id`. */
  field: string;
  operator: FilterOperator;
  value: FilterValue;
}

let counter = 0;
/** A new filter id (`flt_1`, `flt_2`, …): unique within the page, stable within a session. */
export function createFilterId(): string {
  counter += 1;
  return `flt_${counter.toString(36)}`;
}

/** The empty value a kind starts from. */
export function emptyValue(kind: FilterKind): FilterValue {
  switch (kind) {
    case 'select':
    case 'multiselect': return [];
    case 'boolean': return true;
    case 'date': return { type: 'preset', preset: 'today' };
    case 'number': return 0;
    default: return '';
  }
}

export const isDateValue = (v: unknown): v is DateValue => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const d = v as Record<string, unknown>;
  if (d.type === 'preset') return DATE_PRESETS.some((p) => p.id === d.preset);
  if (d.type === 'date') return typeof d.date === 'string' && parseDay(d.date) !== null;
  if (d.type === 'relative') return typeof d.amount === 'number' && Number.isFinite(d.amount) && d.amount > 0 && RELATIVE_UNITS.includes(d.unit as RelativeUnit);
  return false;
};

/** Does the value say anything yet? An incomplete filter (no values picked, an empty text box) matches everything. */
export function isFilterComplete(filter: Filter): boolean {
  const v = filter.value;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.trim().length > 0;
  return isDateValue(v);
}

/** Make the operator and value agree: a `select` with two values is "any of", a date switched to "in the last" gets a span. */
export function coerceFilter(field: FilterField, operator: FilterOperator, value: FilterValue): { operator: FilterOperator; value: FilterValue } {
  const offered = FILTER_OPERATORS[field.kind];
  let op = offered.includes(operator) ? operator : offered[0];
  let next = value;
  if (field.kind === 'select') {
    const count = Array.isArray(value) ? value.length : 0;
    if (count > 1 && op === 'is') op = 'is_any_of';
    else if (count > 1 && op === 'is_not') op = 'is_none_of';
    else if (count === 1 && op === 'is_any_of') op = 'is';
    else if (count === 1 && op === 'is_none_of') op = 'is_not';
  }
  if (field.kind === 'date') {
    if (op === 'in_the_last' && !(isDateValue(value) && value.type === 'relative')) next = { type: 'relative', amount: 7, unit: 'day' };
    else if (op !== 'in_the_last' && isDateValue(value) && value.type === 'relative') next = { type: 'preset', preset: 'last_7_days' };
  }
  return { operator: op, value: next };
}

/** `filter` with a new value (the operator follows: "is" becomes "is any of" when a second value is picked, and back). */
export function withValue(field: FilterField, filter: Filter, value: FilterValue): Filter {
  return { ...filter, ...coerceFilter(field, filter.operator, value) };
}

/** `filter` with the operator the user chose, taken literally: "is" keeps one value, a date gets the value shape the operator needs. */
export function withOperator(field: FilterField, filter: Filter, operator: FilterOperator): Filter {
  if (!FILTER_OPERATORS[field.kind].includes(operator)) return filter;
  let value = filter.value;
  if (field.kind === 'select' && (operator === 'is' || operator === 'is_not') && Array.isArray(value) && value.length > 1) value = value.slice(0, 1);
  if (field.kind === 'date') ({ value } = coerceFilter(field, operator, value));
  return { ...filter, operator, value };
}

/** A new filter for `field` (operator and value coerced to agree). */
export function createFilter(field: FilterField, value: FilterValue = emptyValue(field.kind), operator: FilterOperator = defaultOperator(field.kind)): Filter {
  return { id: createFilterId(), field: field.id, ...coerceFilter(field, operator, value) };
}

/* ── dates ── */

function startOfDay(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
const addDays = (t: number, n: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()).getTime();
};

/** `YYYY-MM-DD` → local midnight (ms), or null. */
function parseDay(text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date.getTime() : null;
}

export interface DateOptions {
  /** "Now" for presets and "in the last" (default: the current time). Pass a fixed instant in tests and stories. */
  now?: Date | number;
  /** First day of the week for `this_week` / `last_week`: 0 Sunday … 6 (default 1, Monday). */
  weekStart?: number;
}

/** The half-open range `[start, end)` (ms) a date value covers, or null when it is invalid. */
export function dateRange(value: DateValue, { now = Date.now(), weekStart = 1 }: DateOptions = {}): { start: number; end: number } | null {
  const at = typeof now === 'number' ? now : now.getTime();
  const today = startOfDay(at);
  const dayOfWeek = (new Date(today).getDay() - weekStart + 7) % 7;
  const week = addDays(today, -dayOfWeek);
  const nowDate = new Date(at);
  if (value.type === 'date') {
    const start = parseDay(value.date);
    return start === null ? null : { start, end: addDays(start, 1) };
  }
  if (value.type === 'relative') {
    const back = new Date(at);
    if (value.unit === 'day') back.setDate(back.getDate() - value.amount);
    else if (value.unit === 'week') back.setDate(back.getDate() - 7 * value.amount);
    else if (value.unit === 'month') back.setMonth(back.getMonth() - value.amount);
    else back.setFullYear(back.getFullYear() - value.amount);
    return { start: back.getTime(), end: at + 1 };
  }
  switch (value.preset) {
    case 'today': return { start: today, end: addDays(today, 1) };
    case 'yesterday': return { start: addDays(today, -1), end: today };
    case 'this_week': return { start: week, end: addDays(week, 7) };
    case 'last_week': return { start: addDays(week, -7), end: week };
    case 'last_7_days': return { start: addDays(today, -6), end: addDays(today, 1) };
    case 'last_30_days': return { start: addDays(today, -29), end: addDays(today, 1) };
    case 'this_month': return { start: new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime(), end: new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 1).getTime() };
    case 'last_month': return { start: new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1).getTime(), end: new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime() };
    case 'this_year': return { start: new Date(nowDate.getFullYear(), 0, 1).getTime(), end: new Date(nowDate.getFullYear() + 1, 0, 1).getTime() };
  }
}

/** An item's raw date (a Date, epoch ms, or an ISO string — a bare `YYYY-MM-DD` is the local day) as epoch ms. */
export function toTime(raw: unknown): number | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.getTime();
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    const day = parseDay(raw);
    if (day !== null) return day;
    const t = Date.parse(raw);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/* ── matching ── */

export interface MatchOptions extends DateOptions {
  /** `all` (default): every filter must hold; `any`: at least one. */
  match?: 'all' | 'any';
}

const toList = (raw: unknown): string[] => (raw == null ? [] : Array.isArray(raw) ? raw.map(String) : [String(raw)]);
const toBool = (raw: unknown): boolean => (typeof raw === 'string' ? !['', 'false', '0', 'no'].includes(raw.toLowerCase()) : Boolean(raw));
const toNumber = (raw: unknown): number | null => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) return Number(raw);
  return null;
};

function matchOne(raw: unknown, filter: Filter, field: FilterField, options: MatchOptions): boolean {
  const { operator, value } = filter;
  switch (field.kind) {
    case 'select':
    case 'multiselect': {
      const have = toList(raw);
      const want = Array.isArray(value) ? value : [];
      if (operator === 'includes_all') return want.every((w) => have.includes(w));
      const overlap = want.some((w) => have.includes(w));
      return operator === 'is_not' || operator === 'is_none_of' || operator === 'includes_none' ? !overlap : overlap;
    }
    case 'boolean': {
      const same = toBool(raw) === value;
      return operator === 'is_not' ? !same : same;
    }
    case 'number': {
      const n = toNumber(raw);
      const target = typeof value === 'number' ? value : Number(value);
      if (n === null) return operator === 'neq';
      switch (operator) {
        case 'neq': return n !== target;
        case 'lt': return n < target;
        case 'lte': return n <= target;
        case 'gt': return n > target;
        case 'gte': return n >= target;
        default: return n === target;
      }
    }
    case 'text': {
      const have = raw == null ? '' : String(raw).toLowerCase();
      const want = String(value).trim().toLowerCase();
      if (operator === 'is') return have === want;
      if (operator === 'is_not') return have !== want;
      return operator === 'not_contains' ? !have.includes(want) : have.includes(want);
    }
    case 'date': {
      const t = toTime(raw);
      if (t === null || !isDateValue(value)) return false;
      const range = dateRange(value, options);
      if (!range) return false;
      if (operator === 'before') return t < range.start;
      if (operator === 'after') return t >= range.end;
      return t >= range.start && t < range.end; // is / in_the_last
    }
  }
}

/** Does one item satisfy the filters? Filters that are incomplete or name an unknown field are ignored; no filters means yes. */
export function matchesFilters<T>(
  item: T,
  filters: readonly Filter[],
  schema: readonly FilterField[],
  getValue: (item: T, fieldId: string) => unknown,
  options: MatchOptions = {},
): boolean {
  const byId = new Map(schema.map((f) => [f.id, f]));
  const active = filters.flatMap((f): Array<[Filter, FilterField]> => {
    const field = byId.get(f.field);
    return field && isFilterComplete(f) ? [[f, field]] : [];
  });
  if (!active.length) return true;
  const test = ([f, field]: [Filter, FilterField]) => matchOne(getValue(item, f.field), f, field, options);
  return options.match === 'any' ? active.some(test) : active.every(test);
}

/** The items that satisfy the filters (see `matchesFilters`), in their original order. */
export function matchFilters<T>(
  items: readonly T[],
  filters: readonly Filter[],
  schema: readonly FilterField[],
  getValue: (item: T, fieldId: string) => unknown,
  options: MatchOptions = {},
): T[] {
  return items.filter((item) => matchesFilters(item, filters, schema, getValue, options));
}

/* ── words ── */

function formatDay(day: string, locale: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
}

/** A filter's value as words: option labels, "Last 7 days", "Jan 5, 2026", "3 days". */
export function describeValue(filter: Filter, field?: FilterField, locale = 'en-US'): string {
  const v = filter.value;
  if (Array.isArray(v)) {
    const label = (x: string) => field?.options?.find((o) => o.value === x)?.label ?? x;
    return v.map(label).join(', ');
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  if (v.type === 'preset') return DATE_PRESETS.find((p) => p.id === v.preset)?.label ?? v.preset;
  if (v.type === 'date') return formatDay(v.date, locale);
  return `${v.amount} ${v.unit}${v.amount === 1 ? '' : 's'}`;
}

/** A filter as a sentence: "Status is any of Open, Confirmed". */
export function describeFilter(filter: Filter, schema: readonly FilterField[], locale = 'en-US'): string {
  const field = schema.find((f) => f.id === filter.field);
  const count = Array.isArray(filter.value) ? filter.value.length : 2;
  return `${field?.label ?? filter.field} ${operatorLabel(filter.operator, count)} ${describeValue(filter, field, locale)}`.trim();
}

/* ── serialization ──
   `field:operator:value;field:operator:value`. Each part is percent-encoded, so ids and values may hold any
   character; a list is comma-separated; dates are `today` / `last_7_days`, `2026-01-31`, or `7d` (`d` `w` `m` `y`).
   Safe in a query string or a path segment as is. */

const UNIT_LETTER: Record<RelativeUnit, string> = { day: 'd', week: 'w', month: 'm', year: 'y' };
const LETTER_UNIT = Object.fromEntries(Object.entries(UNIT_LETTER).map(([unit, letter]) => [letter, unit])) as Record<string, RelativeUnit>;

function encodeValue(value: FilterValue): string {
  if (Array.isArray(value)) return value.map(encodeURIComponent).join(',');
  if (typeof value === 'object') {
    if (value.type === 'preset') return value.preset;
    if (value.type === 'date') return value.date;
    return `${value.amount}${UNIT_LETTER[value.unit]}`;
  }
  return encodeURIComponent(String(value));
}

/** The filters as a URL-safe string. Incomplete filters are left out; ids are not written. */
export function serializeFilters(filters: readonly Filter[]): string {
  return filters
    .filter((f) => isFilterComplete(f))
    .map((f) => `${encodeURIComponent(f.field)}:${f.operator}:${encodeValue(f.value)}`)
    .join(';');
}

function decodeDate(text: string): DateValue | null {
  const preset = DATE_PRESETS.find((p) => p.id === text);
  if (preset) return { type: 'preset', preset: preset.id };
  if (parseDay(text) !== null) return { type: 'date', date: text };
  const rel = /^(\d+)([dwmy])$/.exec(text);
  if (rel && Number(rel[1]) > 0) return { type: 'relative', amount: Number(rel[1]), unit: LETTER_UNIT[rel[2]] };
  return null;
}

function safeDecode(text: string): string | null {
  try { return decodeURIComponent(text); } catch { return null; }
}

/**
 * The inverse of `serializeFilters`, checked against the schema: a part that names an unknown field, an operator the
 * field's kind does not offer, or a value of the wrong shape is dropped (never thrown). New ids are generated.
 */
export function parseFilters(text: string, schema: readonly FilterField[]): Filter[] {
  const out: Filter[] = [];
  for (const part of text.split(';')) {
    const [rawField, operator, rawValue, ...rest] = part.split(':');
    if (!rawField || !operator || rawValue === undefined || rest.length) continue;
    const id = safeDecode(rawField);
    const field = schema.find((f) => f.id === id);
    if (!field || !FILTER_OPERATORS[field.kind].includes(operator as FilterOperator)) continue;
    let value: FilterValue | null;
    if (field.kind === 'select' || field.kind === 'multiselect') {
      const list = rawValue.split(',').map(safeDecode);
      value = list.every((x): x is string => x !== null) && rawValue !== '' ? list : null;
    } else if (field.kind === 'boolean') {
      value = rawValue === 'true' ? true : rawValue === 'false' ? false : null;
    } else if (field.kind === 'number') {
      value = rawValue.trim() !== '' && Number.isFinite(Number(rawValue)) ? Number(rawValue) : null;
    } else if (field.kind === 'date') {
      value = decodeDate(rawValue);
      if (value && (operator === 'in_the_last') !== (value.type === 'relative')) value = null;
    } else {
      const decoded = safeDecode(rawValue);
      value = decoded && decoded.trim() ? decoded : null;
    }
    if (value === null) continue;
    out.push({ id: createFilterId(), field: field.id, operator: operator as FilterOperator, value });
  }
  return out;
}

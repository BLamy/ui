'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFilter, type DateValue, type Filter, type FilterField, type FilterOperator, type FilterOption, type RelativeUnit } from '@/lib/filter';
import { loadModel, parseWith, type Clause, type Field, type Schema, type Weights } from '@/lib/gpu-query';
import { stem, withinOneEdit } from '@/lib/gpu-query/schema';

/* ══ Natural-language filters ══
   `useFilterQuery("critical bugs in production", fields)` turns a phrase into `Filter[]` through gpu-query, a 29,597-
   parameter tagger that runs in the browser (see lib/gpu-query/README.md). The model never sees your field names:
   `buildQuerySchema` hands it the field labels, aliases and option words as a schema, and `clausesToFilters` maps its
   clauses (`{ field, cmp, value, neg }`) back onto your fields — raw strings resolved to option values by exact then
   fuzzy match, `cmp` + `neg` to an operator, dates and numbers parsed.

   What to expect — this is a feasibility-spike model, not a parser you can trust blindly:
   - "and" and "or" both separate clauses, so everything is ANDed. Two values for one single-valued field ("critical or
     high") are read as "any of" (and a note says so); there is no other OR.
   - A fragment that cannot form a legal clause is dropped, and one whose value matches no option is reported, both in
     `unresolved`. Show them: the result is only worth applying if the user can see what was understood.
   - The 98.9% the model's author reports is on its own generated corpus, not on real phrasing.

   SSR-safe: nothing runs on the server, and the model's weights (~40 KB) are fetched on first use only. */

/* ── schema ── */

const TOKEN = /^[A-Za-z_][A-Za-z0-9_'-]*$/;
const STOP = new Set(['a', 'an', 'and', 'are', 'at', 'be', 'by', 'for', 'has', 'have', 'in', 'is', 'of', 'on', 'or', 'not', 'no', 'the', 'to', 'was', 'with']);

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
const significant = (text: string, min = 3) => words(text).filter((w) => w.length >= min && !STOP.has(w));
const norm = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

const GPU_KIND = { select: 'enum', multiselect: 'enum', boolean: 'bool', date: 'date', number: 'number', text: 'text' } as const;

/** The gpu-query schema for a set of fields, and the way back from a schema name to the field. */
export interface QuerySchema {
  schema: Schema;
  byName: Map<string, FilterField>;
}

function schemaName(id: string): string {
  const name = id.replace(/[^A-Za-z0-9_'-]/g, '_');
  return TOKEN.test(name) ? name : `f_${name}`;
}

/** Words an option can be named by: its value and label when each is one token, plus each significant word of a longer label. */
function optionWords(option: FilterOption): string[] {
  const out = new Set<string>();
  for (const candidate of [option.value, option.label, ...(option.keywords ?? [])]) {
    if (TOKEN.test(candidate)) out.add(candidate.toLowerCase());
    for (const w of significant(candidate)) if (TOKEN.test(w)) out.add(w);
  }
  return [...out];
}

/** Derives the schema the model is asked about: aliases from each field's label, id and `aliases`; enum values from its options. */
export function buildQuerySchema(fields: readonly FilterField[]): QuerySchema {
  const byName = new Map<string, FilterField>();
  const raw = fields.map((field) => {
    const name = schemaName(field.id);
    byName.set(name, field);
    const own = new Set<string>();
    if (TOKEN.test(field.label)) own.add(field.label.toLowerCase());
    for (const w of [...significant(field.label), ...significant(field.id.replace(/[_-]+/g, ' ')), ...(field.aliases ?? []).flatMap((a) => words(a))]) {
      if (TOKEN.test(w)) own.add(w);
    }
    own.delete(name.toLowerCase());
    return { field, name, own };
  });
  // A word that two fields share ("date" for Created and Due) would silently pick the first: leave it out.
  const uses = new Map<string, number>();
  for (const { own } of raw) for (const a of own) uses.set(a, (uses.get(a) ?? 0) + 1);
  const taken = new Set(raw.map((r) => r.name.toLowerCase()));
  const schema: Schema = raw.map(({ field, name, own }): Field => ({
    name,
    kind: GPU_KIND[field.kind],
    aliases: [...own].filter((a) => uses.get(a) === 1 && !taken.has(a)),
    values: field.kind === 'select' || field.kind === 'multiselect' ? [...new Set((field.options ?? []).flatMap(optionWords))] : [],
  }));
  return { schema, byName };
}

/* ── values ── */

function wordScore(a: string, b: string): number {
  if (a === b) return 1;
  if (stem(a) === stem(b)) return 0.9;
  if (a.length >= 3 && b.startsWith(a)) return 0.8;
  if (a.length >= 5 && withinOneEdit(a, b)) return 0.7;
  return 0;
}

/** The option a typed value names: its label or value exactly, else the one option every typed word fuzzily matches. */
export function matchOption(raw: string, options: readonly FilterOption[]): { option?: FilterOption; ambiguous?: boolean } {
  const target = norm(raw);
  if (!target) return {};
  const compact = target.replace(/ /g, '');
  const exact = options.filter((o) => norm(o.label) === target || norm(o.value) === target || norm(o.label).replace(/ /g, '') === compact);
  if (exact.length) return exact.length === 1 ? { option: exact[0] } : { ambiguous: true };
  const typed = target.split(' ');
  const scored: Array<{ option: FilterOption; score: number }> = [];
  for (const option of options) {
    const labelWords = norm(option.label).split(' ').filter(Boolean);
    const known = [...new Set([...labelWords, ...norm(option.value).split(' '), ...(option.keywords ?? []).flatMap((k) => norm(k).split(' '))])].filter(Boolean);
    const scores = typed.map((w) => Math.max(0, ...known.map((k) => wordScore(w, k))));
    if (scores.some((s) => s === 0)) continue;
    const coverage = Math.min(1, typed.length / Math.max(1, labelWords.length));
    scored.push({ option, score: (scores.reduce((a, b) => a + b, 0) / scores.length) * (0.5 + 0.5 * coverage) });
  }
  scored.sort((a, b) => b.score - a.score);
  if (!scored.length) return {};
  return scored.length > 1 && scored[1].score >= scored[0].score - 1e-9 ? { ambiguous: true } : { option: scored[0].option };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const UNITS: Record<string, RelativeUnit> = { day: 'day', week: 'week', month: 'month', year: 'year' };
const PRESETS: Record<string, DateValue> = {
  today: { type: 'preset', preset: 'today' },
  yesterday: { type: 'preset', preset: 'yesterday' },
  'this week': { type: 'preset', preset: 'this_week' },
  'last week': { type: 'preset', preset: 'last_week' },
  'this month': { type: 'preset', preset: 'this_month' },
  'last month': { type: 'preset', preset: 'last_month' },
  'this year': { type: 'preset', preset: 'this_year' },
};

const pad = (n: number) => String(n).padStart(2, '0');
const dayText = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function validDay(y: number, m: number, d: number): string | null {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/** A typed date: "today", "last week", "last 3 days", "3 weeks ago", "2026-01-05", "jan 5", "5 January 2026". */
export function parseDateText(raw: string, now: number | Date = Date.now()): DateValue | null {
  const text = raw.toLowerCase().replace(/\s*([-/])\s*/g, '$1').replace(/\s+/g, ' ').replace(/^(?:(?:in|within|over|during|for|from|on) )?(?:the )?/, '').trim();
  const today = new Date(now);
  if (PRESETS[text]) return PRESETS[text];
  let m = /^(?:last|past|previous) (\d+) (day|week|month|year)s?$/.exec(text);
  if (m && Number(m[1]) > 0) return { type: 'relative', amount: Number(m[1]), unit: UNITS[m[2]] };
  m = /^(\d+) (day|week|month|year)s? ago$/.exec(text);
  if (m) {
    const back = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const n = Number(m[1]);
    if (m[2] === 'day') back.setDate(back.getDate() - n);
    else if (m[2] === 'week') back.setDate(back.getDate() - 7 * n);
    else if (m[2] === 'month') back.setMonth(back.getMonth() - n);
    else back.setFullYear(back.getFullYear() - n);
    return { type: 'date', date: dayText(back) };
  }
  m = /^(\d{4})[- ](\d{1,2})[- ](\d{1,2})$/.exec(text);
  if (m) {
    const day = validDay(Number(m[1]), Number(m[2]), Number(m[3]));
    return day ? { type: 'date', date: day } : null;
  }
  const monthFirst = /^([a-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/.exec(text);
  const dayFirst = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,9})\.?(?:,? (\d{4}))?$/.exec(text);
  const parts = monthFirst ? { month: monthFirst[1], day: monthFirst[2], year: monthFirst[3] } : dayFirst ? { month: dayFirst[2], day: dayFirst[1], year: dayFirst[3] } : null;
  if (parts) {
    const month = MONTHS.findIndex((name) => parts.month.startsWith(name)) + 1;
    if (month) {
      const day = validDay(parts.year ? Number(parts.year) : today.getFullYear(), month, Number(parts.day));
      return day ? { type: 'date', date: day } : null;
    }
  }
  return null;
}

function parseNumber(raw: string): number | null {
  const m = /^(-?\d+(?:\.\d+)?)\s*([km])?$/.exec(raw.toLowerCase().replace(/\s*\.\s*/g, '.').trim());
  if (!m) return null;
  return Number(m[1]) * (m[2] === 'k' ? 1000 : m[2] === 'm' ? 1_000_000 : 1);
}

/* ── clauses → filters ── */

/** A fragment the phrase contained that did not become a filter, and why. */
export interface Unresolved {
  text: string;
  reason: string;
}

export interface Interpretation {
  filters: Filter[];
  unresolved: Unresolved[];
  /** Things the mapping assumed that the user should know ("read as any of"). */
  notes: string[];
  /** The raw gpu-query clauses, for diagnostics. */
  clauses: Clause[];
}

/** The model's view of the phrase, so the mapping can look at the words around a clause (`ParseResult` has all of it). */
export interface Trace {
  tokens: string[];
  roles: string[];
  /** Token range `[start, end)` of each clause, parallel to the clauses. */
  spans: Array<[number, number]>;
  resolved: Array<{ field: string } | null>;
}

const quote = (text: string) => `“${text}”`;
const NEG_WORDS = new Set(['not', 'no', 'without', 'excluding', 'exclude', 'except', "isn't", "aren't", "wasn't", "doesn't", "don't", 'non', 'never']);
const BEFORE_WORDS = new Set(['before', 'earlier', 'prior', 'until', 'older']);
const AFTER_WORDS = new Set(['after', 'since', 'later', 'newer']);
const isSelect = (f: FilterField) => f.kind === 'select' || f.kind === 'multiselect';

/**
 * Maps gpu-query clauses onto fields: raw option text → option values (exact, then fuzzy), `cmp` + `neg` → operator,
 * dates and numbers parsed. Clauses on one single-valued field with the same polarity merge into "any of".
 *
 * Given the `trace`, it also repairs what the model is known to get wrong, deterministically and visibly:
 * - a negation word ("not", "without") inside a clause makes it negative, whatever role the model gave it;
 * - a comparison on a select field means nothing, so it is ignored (the model often tags "to" and "not" as `<`);
 * - one clause that holds several values ("urgent bob") is split, each word placed on the field that has it;
 * - a date is parsed from the whole clause ("in the last 3 days"), not only the words the model called values.
 */
export function clausesToFilters(
  clauses: readonly Clause[], byName: ReadonlyMap<string, FilterField>,
  { now = Date.now(), trace }: { now?: number | Date; trace?: Trace } = {},
): Interpretation {
  const unresolved: Unresolved[] = [];
  const notes: string[] = [];
  const selectFields = [...byName.values()].filter(isSelect);
  // Select-like clauses collect per field and polarity first, so "critical or high" becomes one "is any of".
  type Group = { field: FilterField; neg: boolean; options: FilterOption[] };
  const order: Array<Group | Filter> = [];
  const groups = new Map<string, Group>();
  const seen = new Set<string>();
  const keyOf = (f: Pick<Filter, 'field' | 'operator' | 'value'>) => `${f.field}|${f.operator}|${JSON.stringify(f.value)}`;

  const push = (filter: Filter) => {
    if (seen.has(keyOf(filter))) return;
    seen.add(keyOf(filter));
    order.push(filter);
  };
  const place = (field: FilterField, neg: boolean, option: FilterOption) => {
    const key = `${field.id}|${neg}`;
    let group = groups.get(key);
    if (!group) {
      group = { field, neg, options: [] };
      groups.set(key, group);
      order.push(group);
    }
    if (!group.options.includes(option)) group.options.push(option);
  };

  clauses.forEach((clause, index) => {
    const field = byName.get(clause.field);
    if (!field) { unresolved.push({ text: String(clause.value), reason: `Unknown field ${quote(clause.field)}` }); return; }
    const rawValue = clause.value === true ? '' : clause.value;
    const span = trace?.spans[index];
    const inside = span && trace ? trace.tokens.slice(span[0], span[1]) : [];
    const lowered = inside.map((t) => t.toLowerCase());
    const neg = clause.neg || lowered.some((t) => NEG_WORDS.has(t));
    const said = `${field.label} ${neg ? 'not ' : ''}${rawValue}`.trim();

    if (isSelect(field)) {
      const hit = matchOption(rawValue, field.options ?? []);
      if (hit.option) { place(field, neg, hit.option); return; }
      // No single option: the clause may hold several values, or a value and a filler noun. Place each word.
      const leftover: string[] = [];
      let placed = 0;
      for (const word of rawValue.split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()))) {
        const own = matchOption(word, field.options ?? []);
        if (own.option) { place(field, neg, own.option); placed++; continue; }
        const elsewhere = selectFields.flatMap((f) => { const m = matchOption(word, f.options ?? []); return m.option ? [{ f, option: m.option }] : []; });
        if (elsewhere.length === 1) { place(elsewhere[0].f, neg, elsewhere[0].option); placed++; } else leftover.push(word);
      }
      if (!placed) unresolved.push({ text: rawValue, reason: hit.ambiguous ? `${quote(rawValue)} could mean more than one ${field.label}` : `No ${field.label} called ${quote(rawValue)}` });
      else if (leftover.length) unresolved.push({ text: leftover.join(' '), reason: 'Not a value of any field' });
    } else if (field.kind === 'boolean') {
      const word = rawValue.trim().toLowerCase();
      const yes = clause.value === true || ['yes', 'true', '1'].includes(word);
      if (!yes && !['no', 'false', '0'].includes(word)) { unresolved.push({ text: said, reason: `${quote(rawValue)} is not yes or no` }); return; }
      push(createFilter(field, yes !== neg));
    } else if (field.kind === 'number') {
      const n = parseNumber(rawValue);
      if (n === null) { unresolved.push({ text: said, reason: `${quote(rawValue)} is not a number` }); return; }
      // "not less than 3" is "at least 3".
      const op: FilterOperator = clause.cmp === 'lt' ? (neg ? 'gte' : 'lt') : clause.cmp === 'gt' ? (neg ? 'lte' : 'gt') : neg ? 'neq' : 'eq';
      push(createFilter(field, n, op));
    } else if (field.kind === 'date') {
      // Try what the model called the value, then the whole clause minus its field and operator words.
      const rest = span && trace ? inside.filter((t, i) => {
        const at = span[0] + i;
        return !FIELD_LIKE.has(trace.roles[at]) && trace.resolved[at]?.field !== clause.field && !BEFORE_WORDS.has(t.toLowerCase()) && !AFTER_WORDS.has(t.toLowerCase()) && !NEG_WORDS.has(t.toLowerCase());
      }).join(' ') : '';
      const value = parseDateText(rawValue, now) ?? (rest ? parseDateText(rest, now) : null);
      if (!value) { unresolved.push({ text: said, reason: `${quote(rawValue || rest)} is not a date I know (try “last week”, “3 days ago” or “2026-01-05”)` }); return; }
      const cmp = lowered.some((t) => BEFORE_WORDS.has(t)) ? 'lt' : lowered.some((t) => AFTER_WORDS.has(t)) ? 'gt' : clause.cmp;
      if (value.type === 'relative') {
        if (neg) unresolved.push({ text: said, reason: 'A negated “in the last” is not supported' });
        else push(createFilter(field, value, 'in_the_last'));
      } else if (neg) {
        unresolved.push({ text: said, reason: 'A negated date comparison is not supported' });
      } else {
        push(createFilter(field, value, cmp === 'lt' ? 'before' : cmp === 'gt' ? 'after' : 'is'));
      }
    } else {
      // Text: both "title crash" and "title containing crash" read as contains — the forgiving reading.
      if (!rawValue.trim()) { unresolved.push({ text: said, reason: `Nothing to look for in ${field.label}` }); return; }
      push(createFilter(field, rawValue, neg ? 'not_contains' : 'contains'));
    }
  });

  const filters: Filter[] = [];
  for (const entry of order) {
    if (!('options' in entry)) { filters.push(entry); continue; }
    const { field, neg, options } = entry;
    const op: FilterOperator = field.kind === 'multiselect' ? (neg ? 'includes_none' : 'includes_any') : neg ? 'is_not' : 'is';
    const filter = createFilter(field, options.map((o) => o.value), op);
    if (options.length > 1 && !neg) notes.push(`Read ${options.map((o) => quote(o.label)).join(' and ')} as any of ${field.label}`);
    if (!seen.has(keyOf(filter))) { seen.add(keyOf(filter)); filters.push(filter); }
  }
  return { filters, unresolved, notes, clauses: [...clauses] };
}

const FIELD_LIKE = new Set(['FIELD', 'FIELD_CONT']);

/** Words that are filler in any phrase: the ones the model may call "nothing" without the user missing them. */
const FILLER = new Set((
  'a an the and or but of to for in on at by with from into as is are was were be been am it its this that these those there here ' +
  'show me my us you your i we they them list find get give see display fetch want need please all any every some only just also then than ' +
  'issue issues task tasks ticket tickets item items thing things result results record records entry entries'
).split(' '));

/** Run one phrase against the fields with weights from `loadModel()`: the synchronous core of `useFilterQuery`. */
export function interpretQuery(
  model: Weights, text: string, fields: readonly FilterField[],
  options: { now?: number | Date; query?: QuerySchema } = {},
): Interpretation {
  const query = options.query ?? buildQuerySchema(fields);
  const parsed = parseWith(model, text, query.schema, { segment: true });
  const mapped = clausesToFilters(parsed.clauses, query.byName, { now: options.now, trace: parsed });
  // Words the model called filler but that are not obviously so ("bugs" when no value is called that): say they were not used.
  const unused = [...new Set(parsed.tokens.filter((t, i) => parsed.roles[i] === 'O' && /[a-z0-9]/i.test(t) && !FILLER.has(t.toLowerCase())))]
    .map((t) => ({ text: t, reason: 'Not used' }));
  return { ...mapped, unresolved: [...parsed.dropped.map((t) => ({ text: t, reason: 'Not understood' })), ...mapped.unresolved, ...unused] };
}

/* ── hook ── */

interface FilterQueryState extends Omit<Interpretation, 'clauses'> {
  /** `idle` no text · `loading` the model is still downloading · `ready` · `error` it could not load. */
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** The (trimmed) phrase these results are for. */
  text: string;
  /** Typing has moved on and the results are for an earlier phrase (or are about to be computed). */
  pending: boolean;
  error?: Error;
}

export interface FilterQueryResult extends FilterQueryState {
  /** Skip the debounce: interpret the current phrase now (the results arrive on the next render). */
  refresh: () => void;
}

const IDLE: FilterQueryState = { status: 'idle', text: '', pending: false, filters: [], unresolved: [], notes: [] };

export interface UseFilterQueryOptions {
  /** Wait this long (ms) after the last keystroke (default 160). */
  debounce?: number;
  /** `false` keeps the hook idle and never loads the model. */
  enabled?: boolean;
  /** Longest phrase parsed, in characters (default 240). */
  maxLength?: number;
  /** "Now" for relative dates (default: the current time). */
  now?: number | Date;
}

/** Fetches the model ahead of the first phrase (call it on focus). Resolves either way; errors surface in the hook. */
export function warmFilterQuery(): Promise<void> {
  return loadModel().then(() => undefined, () => undefined);
}

/**
 * A typed phrase as `Filter[]`: debounced, stale-guarded (an old phrase never overwrites a newer one's result), the
 * weights fetched on first use. Check `unresolved` and `notes` before applying anything.
 */
export function useFilterQuery(text: string, fields: readonly FilterField[], options: UseFilterQueryOptions = {}): FilterQueryResult {
  const { debounce = 160, enabled = true, maxLength = 240, now } = options;
  const trimmed = text.trim().slice(0, maxLength);
  const nowMs = now === undefined ? undefined : typeof now === 'number' ? now : now.getTime();
  // `fields` is usually an inline array: key the schema on its content, so a re-render does not re-run the query.
  const signature = JSON.stringify(fields.map((f) => [f.id, f.label, f.kind, f.aliases, f.options?.map((o) => [o.value, o.label, o.keywords])]));
  const query = useMemo(() => buildQuerySchema(fields), [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  const [result, setResult] = useState<FilterQueryState>(IDLE);
  const run = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!enabled || !trimmed) {
      run.current = () => undefined;
      return undefined;
    }
    let stale = false;
    const execute = () => {
      loadModel().then(
        (model) => {
          if (stale) return;
          const found = interpretQuery(model, trimmed, fields, { now: nowMs, query });
          setResult({ status: 'ready', text: trimmed, pending: false, filters: found.filters, unresolved: found.unresolved, notes: found.notes });
        },
        (error: unknown) => {
          if (stale) return;
          setResult({ ...IDLE, status: 'error', text: trimmed, error: error instanceof Error ? error : new Error(String(error)) });
        },
      );
    };
    const timer = setTimeout(execute, debounce);
    run.current = () => {
      clearTimeout(timer);
      execute();
    };
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [trimmed, enabled, debounce, query, nowMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => run.current(), []);
  if (!enabled || !trimmed) return { ...IDLE, refresh };
  if (result.text !== trimmed) {
    // The results on hand are for an earlier phrase (or none yet): hand them back marked pending.
    return { ...result, status: result.status === 'ready' ? 'ready' : 'loading', text: trimmed, pending: true, refresh };
  }
  return { ...result, refresh };
}

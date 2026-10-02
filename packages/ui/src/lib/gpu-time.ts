'use client';
import { useEffect, useRef, useState } from 'react';
import type { Diagnostic, ParseContext, ParseResult, ParserOptions, TimeRange, TimeSpan } from 'gpu-time';

/* Natural-language times and recurrences, parsed by gpu-time: a ~50 KB model for English schedules ("every weekday at
   9am", "Sat Sun 1pm-8pm", "3rd friday of the month") that returns resolved occurrences, RFC 5545 RRULEs and the
   character spans it recognised. It runs on the CPU by default (in `auto` mode it uses the GPU only for large
   batches) and falls back to the CPU by itself, so it works with or without WebGPU.

   The package is loaded with a dynamic `import()` the first time something parses, so an app that never mounts a
   TimeInput never downloads it, and nothing here touches `window` at module scope (safe for SSR). One parser is kept
   per (backend, dateOrder) pair.

   gpu-time is a small model, not a calendar engine: it can pick a wrong date without any diagnostic (for example it
   reads "at 1930" as a year). Show the resolved dates to the person who typed them and do not schedule anything
   consequential from them unreviewed. */

export type { Diagnostic as TimeDiagnostic, ParseResult as TimeParseResult, TimeRange as TimeOccurrence, TimeSpan };

/* ── Loading and parsing ── */

type GpuTimeModule = typeof import('gpu-time');
type Parser = Awaited<ReturnType<GpuTimeModule['defineParser']>>;

let modulePromise: Promise<GpuTimeModule> | null = null;
const parsers = new Map<string, Promise<Parser>>();

/** Loads gpu-time (once; the promise is cached, and a failed load is retried by the next call). */
export function loadGpuTime(): Promise<GpuTimeModule> {
  return (modulePromise ??= import('gpu-time').catch((error: unknown) => {
    modulePromise = null;
    throw error;
  }));
}

export interface TimeParseOptions extends Pick<ParserOptions, 'backend' | 'dateOrder'>, Partial<Omit<ParseContext, 'reference' | 'timeZone'>> {
  /** "Now" for words like "tomorrow": a Date, epoch milliseconds, or an ISO instant with `Z` or an offset.
      Default: the moment of the call. */
  reference?: string | number | Date;
  /** IANA zone the text is read in. Default: the browser's zone. An unknown zone makes the parse reject. */
  timeZone?: string;
}

/** An ISO instant (with `Z` or an offset) for a `reference` value, defaulting to now. Throws RangeError for an
    invalid Date or number; a string is passed through for gpu-time to check. */
export function toReference(reference?: string | number | Date): string {
  if (typeof reference === 'string') return reference;
  return (reference === undefined ? new Date() : new Date(reference)).toISOString();
}

/** The browser's IANA zone ('UTC' where it cannot say). */
export function browserTimeZone(): string {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function parserFor(backend: ParserOptions['backend'] = 'auto', dateOrder: ParserOptions['dateOrder'] = 'MDY'): Promise<Parser> {
  const key = `${backend}:${dateOrder}`;
  let parser = parsers.get(key);
  if (!parser) {
    parser = loadGpuTime().then((m) => m.defineParser({ backend, dateOrder }));
    parser.catch(() => parsers.delete(key));
    parsers.set(key, parser);
  }
  return parser;
}

/** Parses `text`. Resolves a result with no occurrences (not an error) when nothing was recognised; rejects for a
    bad time zone or reference, or when `backend: 'webgpu'` is forced where WebGPU is missing. */
export async function parseTime(text: string, { backend, dateOrder, reference, timeZone, ...rest }: TimeParseOptions = {}): Promise<ParseResult> {
  const parser = await parserFor(backend, dateOrder);
  const context: ParseContext = { ...rest, reference: toReference(reference), timeZone: timeZone ?? browserTimeZone() };
  return parser.parse(text, context);
}

/** Disposes every parser and forgets the loaded module. For tests and hot reload; apps have no need for it. */
export function resetGpuTime(): void {
  for (const parser of parsers.values()) void parser.then((p) => p.dispose(), () => undefined);
  parsers.clear();
  modulePromise = null;
}

/* ── The hook ── */

export interface UseTimeParseOptions extends TimeParseOptions {
  /** Pause parsing (the state is cleared). Default: true. */
  enabled?: boolean;
  /** Milliseconds to wait after the last change before parsing. Default: 120. */
  debounceMs?: number;
}

export interface TimeParseState {
  /** The latest settled result. While `pending` it is the result for the *previous* text: compare `parsedText`. */
  result: ParseResult | null;
  /** The reason the latest parse failed (an unknown zone, say), or null. */
  error: Error | null;
  /** True from a change of text or options until the parse for it settles. */
  pending: boolean;
  /** The backend that produced `result` ('cpu' or 'webgpu'), or null before the first result. */
  backend: ParseResult['backend'] | null;
  /** The text `result` / `error` belong to, or null when nothing has been parsed. */
  parsedText: string | null;
}

interface Settled {
  text: string;
  key: string;
  result: ParseResult | null;
  error: Error | null;
}

/** A stable key for everything in the options that changes a parse (the identity of `dayParts` does not matter). */
const optionsKey = (o: UseTimeParseOptions) =>
  JSON.stringify([o.backend, o.dateOrder, o.timeZone, o.weekStart, o.bareWeekday, o.bareWeekdays, o.nextWeekday, o.dayParts, o.until, o.limit, o.reference instanceof Date ? o.reference.toISOString() : o.reference]);

/** Parses `text` as you type: debounced, with out-of-order answers dropped, and cleaned up on unmount. Empty text is
    "nothing to parse" (no result, not pending). Without a `reference`, "now" is read at each parse.

    const { result, error, pending } = useTimeParse(text, { timeZone: 'Europe/Paris' }) */
export function useTimeParse(text: string, options: UseTimeParseOptions = {}): TimeParseState {
  const { enabled = true, debounceMs = 120 } = options;
  const key = optionsKey(options);
  const latest = useRef(options);
  latest.current = options;
  const active = enabled && text.trim() !== '';
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    if (!active) {
      setSettled(null);
      return;
    }
    // Each run of the effect is its own generation: its cleanup (a newer text, new options, unmount) silences it, so
    // a slow answer to old input can never overwrite a newer one.
    let live = true;
    const timer = setTimeout(() => {
      parseTime(text, latest.current).then(
        (result) => {
          if (live) setSettled({ text, key, result, error: null });
        },
        (reason: unknown) => {
          if (live) setSettled({ text, key, result: null, error: reason instanceof Error ? reason : new Error(String(reason)) });
        },
      );
    }, debounceMs);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [active, text, key, debounceMs]);

  if (!active) return { result: null, error: null, pending: false, backend: null, parsedText: null };
  return {
    result: settled?.result ?? null,
    error: settled?.error ?? null,
    pending: !settled || settled.text !== text || settled.key !== key,
    backend: settled?.result?.backend ?? null,
    parsedText: settled?.text ?? null,
  };
}

/* ── Formatting helpers ── */

export interface FormatOccurrenceOptions {
  /** IANA zone to show the times in (use the one the text was parsed in). */
  timeZone: string;
  /** BCP 47 locale for the date and time formats. Default: the browser's. */
  locale?: string | string[];
}

type RangeFormatter = Intl.DateTimeFormat & { formatRange?: (a: Date, b: Date) => string };

/** One occurrence as text: "Thu, Sep 10, 2026" for an all-day one, "Sat, Sep 12, 2026, 1:00 – 8:00 PM" for a timed
    range, "From Fri, Sep 11, 2026, 6:00 PM" when only the start is bounded ("after 6pm"). The end of an all-day
    range is exclusive in gpu-time ("next week" ends at the next Monday 00:00), so it is shown as the day before. */
export function formatOccurrence(occurrence: TimeRange, { timeZone, locale }: FormatOccurrenceOptions): string {
  const start = new Date(occurrence.start);
  const end = occurrence.end ? new Date(occurrence.end) : null;
  const base: Intl.DateTimeFormatOptions = { timeZone, weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  const fmt: RangeFormatter = new Intl.DateTimeFormat(locale, occurrence.allDay ? base : { ...base, hour: 'numeric', minute: '2-digit' });
  const range = (a: Date, b: Date) => (typeof fmt.formatRange === 'function' ? fmt.formatRange(a, b) : `${fmt.format(a)} – ${fmt.format(b)}`);
  if (occurrence.allDay) {
    const last = end && new Date(end.getTime() - 1);
    return last && fmt.format(last) !== fmt.format(start) ? range(start, last) : fmt.format(start);
  }
  if (occurrence.open === 'end') return `From ${fmt.format(start)}`;
  if (occurrence.open === 'start') return `Until ${fmt.format(start)}`;
  return end ? range(start, end) : fmt.format(start);
}

/** A piece of the typed text: either inside a span gpu-time recognised (`matched`) or not. */
export interface TimeTextSegment {
  text: string;
  start: number;
  end: number;
  matched: boolean;
  /** The model's confidence (0–1) in the recognised span; the lowest of the spans merged into this segment. */
  confidence?: number;
}

/** Cuts `text` into consecutive segments along the recognised `spans` (character offsets). Spans are clamped to the
    text, sorted, and merged where they touch or overlap, so the segments always join back to exactly `text`. */
export function timeTextSegments(text: string, spans: readonly TimeSpan[]): TimeTextSegment[] {
  const sorted = spans
    .map((s) => ({ start: Math.max(0, Math.min(text.length, s.start)), end: Math.max(0, Math.min(text.length, s.end)), confidence: s.confidence }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: { start: number; end: number; confidence: number }[] = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
      last.confidence = Math.min(last.confidence, s.confidence);
    } else merged.push({ ...s });
  }
  const out: TimeTextSegment[] = [];
  let at = 0;
  const plain = (to: number) => {
    if (to > at) out.push({ text: text.slice(at, to), start: at, end: to, matched: false });
    at = to;
  };
  for (const m of merged) {
    plain(m.start);
    out.push({ text: text.slice(m.start, m.end), start: m.start, end: m.end, matched: true, confidence: m.confidence });
    at = m.end;
  }
  plain(text.length);
  return out;
}

/* ── RRULEs in words ── */

const WEEKDAYS: Record<string, string> = { MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday', SU: 'Sunday' };
const WEEKDAY_ORDER = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const SETPOS: Record<number, string> = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', [-1]: 'last' };
const KNOWN_PARTS = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'BYSETPOS', 'COUNT', 'UNTIL', 'WKST']);

const ordinal = (n: number) => {
  const mod100 = n % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
};
const list = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const numbers = (value: string | undefined) => (value ? value.split(',').map(Number) : []);

/** The raw rule line of a gpu-time RRULE string (`RRULE:FREQ=…`), without the DTSTART line. */
export function rruleLine(rrule: string): string {
  return rrule.split(/\r?\n/).find((l) => l.startsWith('RRULE:')) ?? rrule;
}

/** Humanises the simple RRULEs gpu-time writes ("Every weekday at 9:00 AM", "Every 2 weeks on Tuesday", "Every month
    on the 3rd", "Every month on the first Monday", "Every year on March 3", a COUNT or an UNTIL). Returns null for
    anything else (BYHOUR, BYYEARDAY, …): show `rruleLine(rrule)` then. `locale` formats the clock time and dates. */
export function describeRecurrence(rrule: string, { locale, timeZone }: { locale?: string | string[]; timeZone?: string } = {}): string | null {
  const dtstart = /^DTSTART[^:\r\n]*:(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/m.exec(rrule);
  const ruleZone = /^DTSTART;[^:\r\n]*TZID=([^;:\r\n]+)/m.exec(rrule)?.[1] ?? timeZone ?? 'UTC';
  const rule = /^RRULE:(.*)$/m.exec(rrule);
  if (!rule) return null;
  const parts: Record<string, string> = {};
  for (const piece of rule[1].trim().split(';')) {
    const [name, value] = piece.split('=');
    if (!name || value === undefined || !KNOWN_PARTS.has(name)) return null;
    parts[name] = value;
  }
  const interval = parts.INTERVAL ? Number(parts.INTERVAL) : 1;
  if (!Number.isInteger(interval) || interval < 1) return null;
  const every = (unit: string) => (interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`);

  const byDay = parts.BYDAY?.split(',') ?? [];
  if (byDay.some((d) => !(d in WEEKDAYS))) return null;
  const byMonthDay = numbers(parts.BYMONTHDAY);
  const byMonth = numbers(parts.BYMONTH);
  const bySetPos = numbers(parts.BYSETPOS);
  const monthName = (m: number) => new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2000, m - 1, 15));
  if (byMonth.some((m) => !(m >= 1 && m <= 12)) || bySetPos.some((p) => !(p in SETPOS))) return null;

  let text: string;
  switch (parts.FREQ) {
    case 'HOURLY':
      if (byDay.length || byMonthDay.length || byMonth.length) return null;
      text = every('hour');
      break;
    case 'DAILY':
      if (byDay.length || byMonthDay.length || byMonth.length) return null;
      text = every('day');
      break;
    case 'WEEKLY': {
      if (byMonthDay.length || byMonth.length) return null;
      const days = WEEKDAY_ORDER.filter((d) => byDay.includes(d));
      if (interval === 1 && days.join() === 'MO,TU,WE,TH,FR') text = 'Every weekday';
      else if (interval === 1 && days.join() === 'SA,SU') text = 'Every weekend';
      else if (interval === 1 && days.length === 1) text = `Every ${WEEKDAYS[days[0]]}`;
      else text = days.length ? `${every('week')} on ${list(days.map((d) => WEEKDAYS[d]))}` : every('week');
      break;
    }
    case 'MONTHLY': {
      if (byMonth.length) return null;
      let on: string;
      if (byDay.length && bySetPos.length === 1) on = `the ${SETPOS[bySetPos[0]]} ${list(byDay.map((d) => WEEKDAYS[d]))}`;
      else if (byDay.length) on = list(byDay.map((d) => WEEKDAYS[d]));
      else if (byMonthDay.length) on = `the ${list(byMonthDay.map((d) => (d < 0 ? 'last day' : ordinal(d))))}`;
      else if (dtstart) on = `the ${ordinal(Number(dtstart[3]))}`;
      else return null;
      text = `${every('month')} on ${on}`;
      break;
    }
    case 'YEARLY': {
      if (byDay.length || bySetPos.length) return null;
      const months = byMonth.length ? byMonth : dtstart ? [Number(dtstart[2])] : [];
      const days = byMonthDay.length ? byMonthDay : byMonth.length ? [] : dtstart ? [Number(dtstart[3])] : [];
      if (!months.length) return null;
      const where = days.length ? `${list(months.map(monthName))} ${list(days.map(String))}` : list(months.map(monthName));
      text = interval === 1 && !days.length ? `Every ${where}` : `${every('year')} on ${where}`;
      break;
    }
    default:
      return null;
  }

  if (dtstart?.[4] !== undefined && parts.FREQ !== 'HOURLY') {
    const clock = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(Date.UTC(2000, 0, 1, Number(dtstart[4]), Number(dtstart[5])));
    text += ` at ${clock}`;
  }
  if (parts.COUNT) text += `, ${parts.COUNT} ${parts.COUNT === '1' ? 'time' : 'times'}`;
  if (parts.UNTIL) {
    const u = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/.exec(parts.UNTIL);
    if (!u) return null;
    // A UTC instant (what gpu-time writes: the end of the last day, in the rule's zone) is shown in that zone.
    const at = Date.UTC(Number(u[1]), Number(u[2]) - 1, Number(u[3]), Number(u[4] ?? 0), Number(u[5] ?? 0), Number(u[6] ?? 0));
    text += `, until ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: u[7] ? ruleZone : 'UTC' }).format(at)}`;
  }
  return text;
}

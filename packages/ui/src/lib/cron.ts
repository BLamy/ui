/* Cron expressions, locally: validate a 5-field expression field by field, compute its next runs in any IANA time
   zone, and describe it in English. Pure functions with no React and no GPU, so a raw cron editor works everywhere
   (and the functions run in server components). The natural-language side (gpu-cron) lives in `lib/gpu-cron`.

   Grammar (the portable subset every cron accepts):
     minute 0–59 · hour 0–23 · day-of-month 1–31 · month 1–12 (or JAN–DEC) · day-of-week 0–7 (or SUN–SAT; 0 and 7 are Sunday)
     each field is a comma list of `*`, `n` or `a-b`, with an optional step after `*` or a range; the macros @hourly @daily @midnight @weekly
     @monthly @yearly @annually expand to their 5-field forms. No `L`, `W`, `#`, `?` or seconds.

   Semantics follow POSIX / Vixie cron:
     · when both day-of-month and day-of-week are restricted (neither starts with `*`) a day matches if EITHER does;
       when one starts with `*` the other alone decides;
     · a wall-clock time that falls in a spring-forward gap is moved forward by the gap when the job names a fixed time
       (`30 2 * * *` runs at 03:30), and skipped when the minute or hour field starts with `*` (those jobs follow
       the clock: a job on every 15th minute just has no 02:xx);
     · a wall-clock time that happens twice (fall back) runs once, at the first pass, for a fixed-time job, and on both
       passes when the minute or hour field starts with `*`. */

export type CronFieldName = 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek';

export interface CronFieldInfo {
  name: CronFieldName;
  /** Human label: "minute", "day of month". */
  label: string;
  min: number;
  max: number;
}

export const CRON_FIELDS: readonly CronFieldInfo[] = [
  { name: 'minute', label: 'minute', min: 0, max: 59 },
  { name: 'hour', label: 'hour', min: 0, max: 23 },
  { name: 'dayOfMonth', label: 'day of month', min: 1, max: 31 },
  { name: 'month', label: 'month', min: 1, max: 12 },
  { name: 'dayOfWeek', label: 'day of week', min: 0, max: 7 },
];

const MACROS: Record<string, string> = {
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@weekly': '0 0 * * 0',
  '@monthly': '0 0 1 * *',
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
};
const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Splits an expression into its whitespace-separated parts, expanding a macro (`@daily`) to five fields. */
export function splitCron(expression: string): string[] {
  const text = expression.trim();
  if (!text) return [];
  const macro = MACROS[text.toLowerCase()];
  return (macro ?? text).split(/\s+/);
}

/* ── Validation ── */

export interface CronValidation {
  /** True when the expression has five fields and every one is valid. */
  valid: boolean;
  /** The whitespace-separated parts (a macro is expanded). */
  parts: string[];
  /** The error for each field (null when it is fine or missing). */
  fields: Record<CronFieldName, string | null>;
  /** A problem with the expression as a whole: the wrong number of fields. Null when it has five. */
  message: string | null;
}

/** One parsed field: the allowed values, and whether the text began with `*` (which decides day-of-month /
    day-of-week semantics). */
interface ParsedField {
  values: ReadonlySet<number>;
  star: boolean;
}

type FieldResult = { ok: true; field: ParsedField } | { ok: false; error: string };

const fail = (error: string): FieldResult => ({ ok: false, error });

/** The number in `text` (digits, or a month / weekday name in those fields), or null. */
function numberOf(text: string, name: CronFieldName): number | null {
  if (/^\d+$/.test(text)) return Number(text);
  if (name === 'month') {
    const i = MONTH_NAMES.indexOf(text.toLowerCase());
    return i < 0 ? null : i + 1;
  }
  if (name === 'dayOfWeek') {
    const i = DAY_NAMES.indexOf(text.toLowerCase());
    return i < 0 ? null : i;
  }
  return null;
}

function parseField(text: string, info: CronFieldInfo): FieldResult {
  const { name, min, max } = info;
  if (!text) return fail('Empty');
  const values = new Set<number>();
  for (const item of text.split(',')) {
    if (!item) return fail('Empty item in a list (a stray comma)');
    const [rangePart, stepPart, ...extra] = item.split('/');
    if (extra.length) return fail(`"${item}" has more than one step`);
    let step = 1;
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart)) return fail(`The step in "${item}" must be a number`);
      step = Number(stepPart);
      if (step < 1) return fail('A step must be at least 1');
    }
    let lo: number;
    let hi: number;
    if (rangePart === '*') {
      lo = min;
      // `*` in day-of-week stops at Saturday: 7 would only duplicate Sunday.
      hi = name === 'dayOfWeek' ? 6 : max;
    } else if (rangePart.includes('-')) {
      const [a, b, ...more] = rangePart.split('-');
      const from = numberOf(a, name);
      const to = numberOf(b, name);
      if (more.length || from === null || to === null) return fail(`"${rangePart}" is not a valid range`);
      if (from < min || from > max) return fail(`${from} is out of range (${min}–${max})`);
      if (to < min || to > max) return fail(`${to} is out of range (${min}–${max})`);
      if (from > to) return fail(`The range ${rangePart} runs backwards`);
      lo = from;
      hi = to;
    } else {
      if (rangePart === '') return fail(`"${item}" is missing a value before the slash`);
      const n = numberOf(rangePart, name);
      if (n === null) return fail(`"${rangePart}" is not a number${name === 'month' ? ' or month name' : name === 'dayOfWeek' ? ' or weekday name' : ''}`);
      if (n < min || n > max) return fail(`${n} is out of range (${min}–${max})`);
      if (stepPart !== undefined) return fail(`"${item}": a step needs * or a range (use ${n}-${max}/${step})`);
      lo = hi = n;
    }
    for (let v = lo; v <= hi; v += step) values.add(name === 'dayOfWeek' && v === 7 ? 0 : v);
  }
  return { ok: true, field: { values, star: text.startsWith('*') } };
}

function parseAll(expression: string): { parts: string[]; parsed: (ParsedField | null)[]; validation: CronValidation } {
  const parts = splitCron(expression);
  const fields = {} as Record<CronFieldName, string | null>;
  const parsed: (ParsedField | null)[] = [];
  let message: string | null = null;
  CRON_FIELDS.forEach((info, i) => {
    const part = parts[i];
    if (part === undefined) {
      fields[info.name] = null;
      parsed.push(null);
      return;
    }
    const r = parseField(part, info);
    fields[info.name] = r.ok ? null : r.error;
    parsed.push(r.ok ? r.field : null);
  });
  if (parts.length < 5) {
    const missing = CRON_FIELDS.slice(parts.length).map((f) => f.label);
    message = parts.length
      ? `Cron needs 5 fields; ${parts.length} given. Missing: ${missing.join(', ')}.`
      : 'Enter 5 fields: minute, hour, day of month, month, day of week.';
  } else if (parts.length > 5) {
    message = `Cron needs 5 fields; ${parts.length} given. Seconds and years are not supported.`;
  }
  const valid = message === null && parsed.every(Boolean);
  return { parts, parsed, validation: { valid, parts, fields, message } };
}

/** Checks a 5-field expression: which fields are wrong and why. An empty expression is invalid with a message. */
export function validateCron(expression: string): CronValidation {
  return parseAll(expression).validation;
}

/** Every problem in a validation as one list: `{ field, message }`, the whole-expression message first (field null). */
export function cronProblems(v: CronValidation): { field: CronFieldName | null; message: string }[] {
  const out: { field: CronFieldName | null; message: string }[] = [];
  if (v.message) out.push({ field: null, message: v.message });
  for (const info of CRON_FIELDS) {
    const m = v.fields[info.name];
    if (m) out.push({ field: info.name, message: `${capitalize(info.label)}: ${m}` });
  }
  return out;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ── Time zones ── */

const DAY = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The wall-clock fields of an instant in `timeZone`, as the UTC milliseconds of the same fields (so the difference
    from the instant is the zone's offset). Throws RangeError for an unknown zone. */
function wallClockMs(instant: number, timeZone: string): number {
  const parts = formatterFor(timeZone).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Years below 100 would be read as 19xx by Date.UTC; none of this library's dates are that old.
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
}

/** `timeZone`'s UTC offset in milliseconds at `instant` (positive east of Greenwich). */
function offsetAt(instant: number, timeZone: string): number {
  const floored = Math.floor(instant / 1000) * 1000;
  return wallClockMs(floored, timeZone) - floored;
}

/** The instants at which `timeZone`'s clock reads `wall` (a wall time given as UTC milliseconds), earliest first:
    none in a spring-forward gap, two when a fall-back repeats it, otherwise one. `offsets` are the zone's offsets
    around that day. */
function instantsForWall(wall: number, offsets: readonly number[], timeZone: string): number[] {
  if (offsets.length === 1) return [wall - offsets[0]];
  const out: number[] = [];
  for (const o of offsets) {
    const instant = wall - o;
    if (offsetAt(instant, timeZone) === o && !out.includes(instant)) out.push(instant);
  }
  return out.sort((a, b) => a - b);
}

/** Whether `timeZone` is an IANA zone this runtime knows. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The runtime's own zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`), or 'UTC' where it cannot say. */
export function localTimeZone(): string {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/* ── Next runs ── */

export interface NextCronRunsOptions {
  /** Runs strictly after this instant. Default: now. */
  from?: Date | number | string;
  /** How many runs to return. Default 5. */
  count?: number;
  /** IANA zone the expression is read in. Default: the runtime's local zone. */
  timeZone?: string;
  /** How many days ahead to look before giving up (an expression such as `0 0 30 2 *` never runs). Default 3,000
      (just over eight years: the longest gap between 29 Februaries is eight years). */
  horizonDays?: number;
}

/** The next `count` instants (ascending) at which a 5-field cron expression runs after `from`, read in `timeZone`.
    Returns [] for an invalid expression (see `validateCron`) and when nothing matches within the horizon. Throws
    RangeError for an unknown time zone. */
export function nextCronRuns(expression: string, options: NextCronRunsOptions = {}): Date[] {
  const { count = 5, timeZone = localTimeZone(), horizonDays = 3000 } = options;
  const from = options.from === undefined ? Date.now() : new Date(options.from).getTime();
  if (!Number.isFinite(from)) throw new RangeError('`from` is not a valid date');
  const { parsed, parts, validation } = parseAll(expression);
  if (!validation.valid || count < 1) return [];
  const [minutes, hours, doms, months, dows] = parsed as ParsedField[];
  const followsClock = parts[0].startsWith('*') || parts[1].startsWith('*');
  const sortedMinutes = [...minutes.values].sort((a, b) => a - b);
  const sortedHours = [...hours.values].sort((a, b) => a - b);
  formatterFor(timeZone); // throws for an unknown zone, before any work

  const out: number[] = [];
  const start = wallClockMs(from, timeZone);
  const startDay = start - (((start % DAY) + DAY) % DAY);
  for (let i = -1; i <= horizonDays && out.length < count; i++) {
    const day = new Date(startDay + i * DAY);
    const month = day.getUTCMonth() + 1;
    if (!months.values.has(month)) continue;
    const domHit = doms.values.has(day.getUTCDate());
    const dowHit = dows.values.has(day.getUTCDay());
    // POSIX: with both restricted a day matches on either; if one is `*`, the other decides.
    const dayHit = doms.star || dows.star ? domHit && dowHit : domHit || dowHit;
    if (!dayHit) continue;
    // The zone's offsets around this day (one value unless a transition is near).
    const base = day.getTime();
    const offsets = [...new Set([offsetAt(base - 14 * 3_600_000, timeZone), offsetAt(base + 12 * 3_600_000, timeZone), offsetAt(base + 38 * 3_600_000, timeZone)])];
    const today: number[] = [];
    for (const h of sortedHours) {
      for (const m of sortedMinutes) {
        const wall = base + h * 3_600_000 + m * 60_000;
        const instants = instantsForWall(wall, offsets, timeZone);
        if (instants.length === 0) {
          // In a spring-forward gap: a fixed-time job runs just after it, a clock-following one does not run.
          if (!followsClock) today.push(wall - Math.min(...offsets));
        } else if (followsClock) today.push(...instants);
        else today.push(instants[0]);
      }
    }
    today.sort((a, b) => a - b);
    for (const t of today) {
      if (t > from && out[out.length - 1] !== t) out.push(t);
      if (out.length >= count) break;
    }
  }
  return out.map((t) => new Date(t));
}

/* ── Describing ── */

export interface DescribeCronOptions {
  /** 24-hour clock ("09:00") instead of "9:00 AM". Default: false. */
  use24HourTime?: boolean;
}

type Describer = (expression: string, options?: { use24HourTimeFormat?: boolean; throwExceptionOnParseError?: boolean }) => string;
let describerPromise: Promise<Describer> | null = null;

/** Loads cronstrue on first use (it is only needed once an expression is shown), picking its `toString` out of
    whichever module shape the bundler hands back (ESM namespace, CJS default or nested default). */
function loadDescriber(): Promise<Describer> {
  return (describerPromise ??= import('cronstrue').then((m) => {
    const mod = m as unknown as Record<string, unknown>;
    const candidates = [(mod.default as Record<string, unknown> | undefined)?.default, mod.default, mod];
    for (const c of candidates) {
      const fn = (c as { toString?: unknown } | undefined)?.toString;
      if (typeof fn === 'function' && fn !== Object.prototype.toString) return fn.bind(c) as Describer;
    }
    throw new Error('cronstrue has no toString');
  }).catch((error: unknown) => {
    describerPromise = null; // let a later call retry
    throw error;
  }));
}

/** An English description of a valid 5-field expression ("At 09:00 AM, Monday through Friday"), by cronstrue,
    loaded on first call. Resolves null for an invalid expression. Macros are expanded first. */
export async function describeCron(expression: string, { use24HourTime = false }: DescribeCronOptions = {}): Promise<string | null> {
  const v = validateCron(expression);
  if (!v.valid) return null;
  const describe = await loadDescriber();
  try {
    return describe(v.parts.join(' '), { use24HourTimeFormat: use24HourTime, throwExceptionOnParseError: true });
  } catch {
    return null;
  }
}

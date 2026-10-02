/* Showing query results: PostgreSQL type names, type-aware cell formatting (NULL, booleans, numbers, dates, JSON,
   bytea, arrays) and CSV / JSON serialisation. Pure functions — no DOM, no React — shared by ResultTable, SqlConsole
   and anything that wants to print a row.

   Values arrive already parsed by PGlite: int8 as number (a bigint beyond 2^53), json/jsonb as objects, dates as
   `Date`, bytea as `Uint8Array`, arrays as arrays, numeric and everything else as strings. */

/** Type OIDs worth special treatment (the stable ones from pg_type.dat). */
export const PG_TYPE = {
  bool: 16,
  bytea: 17,
  char: 18,
  int8: 20,
  int2: 21,
  int4: 23,
  text: 25,
  oid: 26,
  json: 114,
  xml: 142,
  float4: 700,
  float8: 701,
  money: 790,
  bpchar: 1042,
  varchar: 1043,
  date: 1082,
  time: 1083,
  timestamp: 1114,
  timestamptz: 1184,
  interval: 1186,
  numeric: 1700,
  uuid: 2950,
  jsonb: 3802,
} as const;

const NAMES: Record<number, string> = {
  16: 'bool', 17: 'bytea', 18: 'char', 19: 'name', 20: 'int8', 21: 'int2', 23: 'int4', 25: 'text', 26: 'oid', 114: 'json',
  142: 'xml', 700: 'float4', 701: 'float8', 790: 'money', 829: 'macaddr', 869: 'inet', 650: 'cidr', 1042: 'bpchar',
  1043: 'varchar', 1082: 'date', 1083: 'time', 1114: 'timestamp', 1184: 'timestamptz', 1186: 'interval', 1266: 'timetz',
  1560: 'bit', 1562: 'varbit', 1700: 'numeric', 2950: 'uuid', 3614: 'tsvector', 3615: 'tsquery', 3802: 'jsonb',
  1000: 'bool[]', 1001: 'bytea[]', 1005: 'int2[]', 1007: 'int4[]', 1009: 'text[]', 1016: 'int8[]', 1021: 'float4[]',
  1022: 'float8[]', 1015: 'varchar[]', 1115: 'timestamp[]', 1185: 'timestamptz[]', 1231: 'numeric[]', 2951: 'uuid[]',
  199: 'json[]', 3807: 'jsonb[]',
};

/** A short name for a type OID (`int4`, `timestamptz`, `jsonb[]`), or `oid:<n>` for one we don't know. */
export function pgTypeName(oid: number | undefined): string {
  if (oid === undefined) return 'unknown';
  return NAMES[oid] ?? `oid:${oid}`;
}

export type CellKind = 'null' | 'boolean' | 'number' | 'text' | 'date' | 'json' | 'bytea';

export interface FormattedCell {
  kind: CellKind;
  /** Compact text for a table cell (single line, not truncated). */
  text: string;
  /** The whole value, for an expanded view or a copy — pretty-printed for JSON. */
  full: string;
  /** Numbers right-align. */
  align: 'start' | 'end';
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** `YYYY-MM-DD HH:MM:SS[.mmm]` from local-time components (what a `timestamp` — no zone — means). */
function localTimestamp(d: Date): string {
  const base = `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return d.getMilliseconds() ? `${base}.${pad(d.getMilliseconds(), 3)}` : base;
}

function formatDate(d: Date, oid: number | undefined): string {
  if (Number.isNaN(d.getTime())) return 'Invalid Date';
  if (oid === PG_TYPE.date) return d.toISOString().slice(0, 10);
  if (oid === PG_TYPE.timestamp) return localTimestamp(d);
  return d.toISOString();
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '\\x';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** JSON.stringify that survives bigint, bytea and Dates (neither of which JSON can carry). */
export function safeStringify(value: unknown, space?: number): string {
  return JSON.stringify(
    value,
    (_key, v: unknown) => {
      if (typeof v === 'bigint') return v.toString();
      if (v instanceof Uint8Array) return bytesToHex(v);
      return v;
    },
    space,
  ) ?? 'null';
}

/** Formats one value of a result column. `oid` (the field's dataTypeID) refines dates and JSON-in-text columns. */
export function formatCell(value: unknown, oid?: number): FormattedCell {
  if (value === null || value === undefined) return { kind: 'null', text: 'NULL', full: 'NULL', align: 'start' };
  if (typeof value === 'boolean') return { kind: 'boolean', text: String(value), full: String(value), align: 'start' };
  if (typeof value === 'number' || typeof value === 'bigint') {
    const s = String(value);
    return { kind: 'number', text: s, full: s, align: 'end' };
  }
  if (value instanceof Date) {
    const s = formatDate(value, oid);
    return { kind: 'date', text: s, full: s, align: 'start' };
  }
  if (value instanceof Uint8Array) {
    const hex = bytesToHex(value);
    return { kind: 'bytea', text: hex.length > 34 ? `${hex.slice(0, 34)}…` : hex, full: hex, align: 'start' };
  }
  if (typeof value === 'object') {
    const compact = safeStringify(value);
    return { kind: 'json', text: compact, full: safeStringify(value, 2), align: 'start' };
  }
  const s = String(value);
  // numeric / money arrive as strings but are still numbers to the reader.
  if (oid === PG_TYPE.numeric) return { kind: 'number', text: s, full: s, align: 'end' };
  return { kind: 'text', text: s.replace(/\r?\n/g, '↵'), full: s, align: 'start' };
}

/** A value as plain text for CSV and clipboard: NULL is empty, dates ISO, objects JSON, bytea hex. */
function plainValue(value: unknown, oid?: number): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDate(value, oid);
  if (value instanceof Uint8Array) return bytesToHex(value);
  if (typeof value === 'object') return safeStringify(value);
  return String(value);
}

export interface TabularResult {
  fields: readonly { name: string; dataTypeID?: number }[];
  rows: readonly Record<string, unknown>[];
}

/** RFC 4180 CSV: a header row, CRLF line ends, fields quoted when they hold a delimiter, quote, newline or edge space. */
export function toCsv(result: TabularResult, { delimiter = ',', header = true }: { delimiter?: string; header?: boolean } = {}): string {
  const quote = (s: string) => (s === '' || !(s.includes(delimiter) || /["\r\n]/.test(s) || s !== s.trim()) ? s : `"${s.replace(/"/g, '""')}"`);
  const lines: string[] = [];
  if (header) lines.push(result.fields.map((f) => quote(f.name)).join(delimiter));
  for (const row of result.rows) lines.push(result.fields.map((f) => quote(plainValue(row[f.name], f.dataTypeID))).join(delimiter));
  return lines.join('\r\n');
}

/** The rows as a pretty-printed JSON array of objects (bigint as strings, dates ISO, bytea hex). */
export function toJson(result: TabularResult): string {
  const rows = result.rows.map((row) =>
    Object.fromEntries(
      result.fields.map((f) => {
        const v = row[f.name];
        return [f.name, v instanceof Date ? formatDate(v, f.dataTypeID) : v];
      }),
    ),
  );
  return safeStringify(rows, 2);
}

/** `1,234 rows`, `1 row`. */
export function pluralRows(n: number): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'row' : 'rows'}`;
}

/** `12 ms`, `1.4 s`. */
export function formatDuration(ms: number): string {
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}


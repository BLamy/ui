/* CSV and TSV as rows of strings (RFC 4180): quoted fields with "" escapes and line breaks inside quotes, CRLF or LF
   lines, a leading byte-order mark. `parseCsv` remembers how the text was written (delimiter, line ending, BOM, a
   final newline) so `stringifyCsv` can write an edited table back the same way, and a file that wasn't touched round-trips
   byte for byte unless its quoting was unusual (quotes around a field that didn't need them are dropped). */

export type CsvDelimiter = ',' | '\t' | ';' | '|';

export interface CsvFormat {
  delimiter: CsvDelimiter;
  newline: '\n' | '\r\n';
  /** The text started with a byte-order mark. */
  bom: boolean;
  /** The text ended with a line break. */
  trailingNewline: boolean;
}

export interface CsvParseResult extends CsvFormat {
  rows: string[][];
}

export interface CsvParseOptions {
  /** `auto` (default) picks the delimiter that splits the first lines most consistently. */
  delimiter?: CsvDelimiter | 'auto';
}

const CANDIDATES: readonly CsvDelimiter[] = [',', '\t', ';', '|'];

/** The delimiter that splits the first lines (outside quotes) into the same, largest number of fields. Comma when
    nothing splits. */
export function detectDelimiter(text: string): CsvDelimiter {
  const sample = text.slice(0, 64 * 1024);
  let best: CsvDelimiter = ',';
  let bestScore = 0;
  for (const d of CANDIDATES) {
    const counts: number[] = [];
    let count = 0;
    let quoted = false;
    for (let i = 0; i < sample.length && counts.length < 20; i++) {
      const ch = sample[i];
      if (ch === '"') quoted = !quoted;
      else if (!quoted && ch === d) count++;
      else if (!quoted && ch === '\n') { counts.push(count); count = 0; }
    }
    if (count) counts.push(count);
    if (!counts.length || !counts[0]) continue;
    // Lines that agree with the first line, weighted by how many fields they make.
    const agree = counts.filter((c) => c === counts[0]).length / counts.length;
    const score = agree * counts[0];
    if (score > bestScore) { best = d; bestScore = score; }
  }
  return best;
}

/** The delimiter a file's name suggests: tab for `.tsv` / `.tab`, else `auto`. */
export const delimiterForPath = (path: string): CsvDelimiter | 'auto' => /\.(tsv|tab)$/i.test(path) ? '\t' : 'auto';

/** Rows of fields. Every row keeps its own length (a short line is not padded). */
export function parseCsv(input: string, { delimiter = 'auto' }: CsvParseOptions = {}): CsvParseResult {
  const bom = input.charCodeAt(0) === 0xfeff;
  const text = bom ? input.slice(1) : input;
  const d = delimiter === 'auto' ? detectDelimiter(text) : delimiter;
  const firstBreak = text.indexOf('\n');
  const newline = firstBreak > 0 && text[firstBreak - 1] === '\r' ? '\r\n' : '\n';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let quotedAtEnd = false;
  const n = text.length;
  const dc = d.charCodeAt(0);
  while (i < n) {
    const c = text.charCodeAt(i);
    if (c === 34 /* " */ && field === '') {
      // A quoted field: runs to the next lone quote; "" is a quote.
      let j = i + 1;
      let out = '';
      for (;;) {
        const q = text.indexOf('"', j);
        if (q < 0) { out += text.slice(j); j = n; break; }
        out += text.slice(j, q);
        if (text.charCodeAt(q + 1) === 34) { out += '"'; j = q + 2; continue; }
        j = q + 1;
        break;
      }
      // Anything between the closing quote and the delimiter is kept, as spreadsheets do.
      let k = j;
      while (k < n) {
        const ch = text.charCodeAt(k);
        if (ch === dc || ch === 10 || ch === 13) break;
        k++;
      }
      field = out + text.slice(j, k);
      i = k;
      if (i >= n) { quotedAtEnd = true; break; }
      continue;
    }
    if (c === dc) { row.push(field); field = ''; i++; continue; }
    if (c === 10 || c === 13) {
      row.push(field); field = '';
      rows.push(row); row = [];
      i += c === 13 && text.charCodeAt(i + 1) === 10 ? 2 : 1;
      continue;
    }
    // A run of plain characters up to the next delimiter, quote-free break or line break.
    let k = i + 1;
    while (k < n) {
      const ch = text.charCodeAt(k);
      if (ch === dc || ch === 10 || ch === 13) break;
      k++;
    }
    field += text.slice(i, k);
    i = k;
  }
  const last = text.charCodeAt(n - 1);
  const trailingNewline = last === 10 || last === 13;
  if (!trailingNewline && (field !== '' || row.length || quotedAtEnd)) { row.push(field); rows.push(row); }
  return { rows, delimiter: d, newline, bom, trailingNewline };
}

const needsQuotes = (field: string, d: string) =>
  field.includes(d) || field.includes('"') || field.includes('\n') || field.includes('\r');

/** One field, quoted when it holds the delimiter, a quote or a line break. */
export const csvField = (field: string, delimiter: CsvDelimiter = ',') =>
  needsQuotes(field, delimiter) ? `"${field.replaceAll('"', '""')}"` : field;

/** Rows back to text, in `format` (defaults: comma, LF, no BOM, a final newline). */
export function stringifyCsv(rows: readonly (readonly string[])[], format: Partial<CsvFormat> = {}): string {
  const { delimiter = ',', newline = '\n', bom = false, trailingNewline = true } = format;
  const lines = new Array<string>(rows.length);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let line = '';
    for (let c = 0; c < row.length; c++) line += (c ? delimiter : '') + csvField(row[c] ?? '', delimiter);
    lines[r] = line;
  }
  return (bom ? '﻿' : '') + lines.join(newline) + (trailingNewline && rows.length ? newline : '');
}

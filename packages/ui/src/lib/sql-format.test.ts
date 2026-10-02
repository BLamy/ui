import { describe, expect, it } from 'vitest';
import { PG_TYPE, formatCell, formatDuration, pgTypeName, pluralRows, toCsv, toJson } from '@/lib/sql-format';

describe('formatCell', () => {
  it('formats each kind of value', () => {
    expect(formatCell(null)).toMatchObject({ kind: 'null', text: 'NULL' });
    expect(formatCell(undefined)).toMatchObject({ kind: 'null' });
    expect(formatCell(true)).toMatchObject({ kind: 'boolean', text: 'true' });
    expect(formatCell(42)).toMatchObject({ kind: 'number', text: '42', align: 'end' });
    expect(formatCell(9007199254740993n)).toMatchObject({ kind: 'number', text: '9007199254740993' });
    expect(formatCell('12.50', PG_TYPE.numeric)).toMatchObject({ kind: 'number', align: 'end' });
    expect(formatCell('hello')).toMatchObject({ kind: 'text', text: 'hello', align: 'start' });
    expect(formatCell('a\nb').text).toBe('a↵b');
    expect(formatCell('a\nb').full).toBe('a\nb');
  });
  it('shows dates by their type', () => {
    const d = new Date('2026-10-02T13:03:11.363Z');
    expect(formatCell(d, PG_TYPE.timestamptz).text).toBe('2026-10-02T13:03:11.363Z');
    expect(formatCell(d, PG_TYPE.date).text).toBe('2026-10-02');
    expect(formatCell(new Date(2026, 0, 2, 3, 4, 5), PG_TYPE.timestamp).text).toBe('2026-01-02 03:04:05');
    expect(formatCell(new Date('nope')).text).toBe('Invalid Date');
  });
  it('shows json compactly and in full, and survives bigint', () => {
    const c = formatCell({ a: [1, 2], n: 10n });
    expect(c).toMatchObject({ kind: 'json', text: '{"a":[1,2],"n":"10"}' });
    expect(c.full).toBe('{\n  "a": [\n    1,\n    2\n  ],\n  "n": "10"\n}');
    expect(formatCell([1, 2]).kind).toBe('json');
  });
  it('shows bytea as hex, truncated in the cell but whole in full', () => {
    expect(formatCell(new Uint8Array([0xde, 0xad]))).toMatchObject({ kind: 'bytea', text: '\\xdead', full: '\\xdead' });
    const big = formatCell(new Uint8Array(100));
    expect(big.text.endsWith('…')).toBe(true);
    expect(big.full.length).toBe(2 + 200);
  });
});

describe('toCsv / toJson', () => {
  const result = {
    fields: [{ name: 'id' }, { name: 'note' }, { name: 'meta' }, { name: 'at', dataTypeID: PG_TYPE.timestamptz }, { name: 'raw' }],
    rows: [
      { id: 1, note: 'plain', meta: { a: 1 }, at: new Date('2026-01-02T03:04:05Z'), raw: new Uint8Array([1, 255]) },
      { id: 2, note: 'has, comma "and quotes"\nand a newline', meta: null, at: null, raw: null },
      { id: 3, note: ' padded ', meta: [1], at: null, raw: null },
    ],
  };
  it('writes RFC 4180 CSV', () => {
    expect(toCsv(result)).toBe(
      ['id,note,meta,at,raw', '1,plain,"{""a"":1}",2026-01-02T03:04:05.000Z,\\x01ff', '2,"has, comma ""and quotes""\nand a newline",,,', '3," padded ",[1],,'].join('\r\n'),
    );
  });
  it('supports another delimiter and no header', () => {
    expect(toCsv({ fields: [{ name: 'a' }, { name: 'b' }], rows: [{ a: 'x;y', b: 1 }] }, { delimiter: ';', header: false })).toBe('"x;y";1');
  });
  it('writes JSON with dates, bytea and bigint as strings', () => {
    const parsed = JSON.parse(toJson({ fields: [{ name: 'at', dataTypeID: PG_TYPE.timestamptz }, { name: 'n' }, { name: 'b' }], rows: [{ at: new Date('2026-01-02T03:04:05Z'), n: 5n, b: new Uint8Array([1]) }] }));
    expect(parsed).toEqual([{ at: '2026-01-02T03:04:05.000Z', n: '5', b: '\\x01' }]);
  });
});

describe('labels', () => {
  it('names types', () => {
    expect(pgTypeName(23)).toBe('int4');
    expect(pgTypeName(3802)).toBe('jsonb');
    expect(pgTypeName(1009)).toBe('text[]');
    expect(pgTypeName(99999)).toBe('oid:99999');
  });
  it('formats counts, durations and sizes', () => {
    expect(pluralRows(1)).toBe('1 row');
    expect(pluralRows(1234)).toBe('1,234 rows');
    expect(formatDuration(0.2)).toBe('<1 ms');
    expect(formatDuration(12.4)).toBe('12 ms');
    expect(formatDuration(1400)).toBe('1.4 s');
  });
});

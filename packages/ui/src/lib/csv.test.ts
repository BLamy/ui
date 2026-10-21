import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv, stringifyCsv } from '@/lib/csv';

describe('parseCsv', () => {
  it('reads quoted fields, escaped quotes and line breaks inside quotes', () => {
    const { rows } = parseCsv('name,note\n"Lamy, Brett","said ""hi""\nthen left"\n');
    expect(rows).toEqual([['name', 'note'], ['Lamy, Brett', 'said "hi"\nthen left']]);
  });

  it('keeps empty fields and ragged rows', () => {
    expect(parseCsv('a,,c\n,\nlast').rows).toEqual([['a', '', 'c'], ['', ''], ['last']]);
  });

  it('remembers CRLF, a BOM and the missing final newline', () => {
    const r = parseCsv('﻿a,b\r\n1,2');
    expect(r.rows).toEqual([['a', 'b'], ['1', '2']]);
    expect(r).toMatchObject({ newline: '\r\n', bom: true, trailingNewline: false, delimiter: ',' });
  });

  it('reads an empty quoted field at the very end', () => {
    expect(parseCsv('a,""').rows).toEqual([['a', '']]);
    expect(parseCsv('""').rows).toEqual([['']]);
  });

  it('detects tabs, semicolons and pipes', () => {
    expect(detectDelimiter('a\tb\tc\n1\t2\t3\n')).toBe('\t');
    expect(detectDelimiter('a;b\n1,5;2\n')).toBe(';');
    expect(detectDelimiter('a|b|c\n1|2|3')).toBe('|');
    expect(detectDelimiter('just one column\nno delimiters')).toBe(',');
  });

  it('ignores delimiters inside quotes when detecting', () => {
    expect(detectDelimiter('"a,b";c\n"d,e";f\n')).toBe(';');
  });
});

describe('stringifyCsv', () => {
  it('quotes only what needs it and round-trips the format', () => {
    const text = '﻿id;label\r\n1;"semi;colon"\r\n2;"quote "" here"\r\n';
    const parsed = parseCsv(text);
    expect(stringifyCsv(parsed.rows, parsed)).toBe(text);
  });

  it('writes no final newline when the source had none', () => {
    const parsed = parseCsv('a,b\n1,2');
    expect(stringifyCsv(parsed.rows, parsed)).toBe('a,b\n1,2');
  });
});

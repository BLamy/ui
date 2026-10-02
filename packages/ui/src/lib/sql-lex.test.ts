import { describe, expect, it } from 'vitest';
import { positionToLineColumn, splitStatements, sqlSpans } from '@/lib/sql-lex';

const spansOf = (src: string) => sqlSpans(src).map((s) => [s.type, src.slice(s.start, s.end)]);

describe('sqlSpans', () => {
  it('labels keywords, types, functions, constants, numbers and operators', () => {
    expect(spansOf("select id, count(*) from t where n > 1.5e3 and ok = true and x::int4 is null")).toEqual([
      ['keyword', 'select'], ['function', 'count'], ['operator', '*'], ['keyword', 'from'], ['keyword', 'where'], ['operator', '>'], ['number', '1.5e3'],
      ['keyword', 'and'], ['operator', '='], ['constant', 'true'], ['keyword', 'and'], ['operator', '::'], ['type', 'int4'],
      ['keyword', 'is'], ['constant', 'null'],
    ]);
  });
  it('reads -- and nested block comments, which the generic fallback lexer gets wrong', () => {
    expect(spansOf('select 1 -- why\n/* a /* nested */ still */ from t')).toEqual([
      ['keyword', 'select'], ['number', '1'], ['comment', '-- why'], ['comment', '/* a /* nested */ still */'], ['keyword', 'from'],
    ]);
  });
  it('reads quoted strings, E strings, dollar quoting and quoted identifiers', () => {
    expect(spansOf("select 'it''s', E'a\\'b', $fn$ select 'x' $fn$, \"My Col\"")).toEqual([
      ['keyword', 'select'], ['string', "'it''s'"], ['string', "E'a\\'b'"], ['string', "$fn$ select 'x' $fn$"],
    ]);
  });
  it('treats left( as a call and left join as a keyword', () => {
    expect(spansOf('left(a, 2)')).toEqual([['function', 'left'], ['number', '2']]);
    expect(spansOf('a left join b')).toEqual([['keyword', 'left'], ['keyword', 'join']]);
  });
  it('survives unterminated strings and comments', () => {
    expect(spansOf("select 'oops")).toEqual([['keyword', 'select'], ['string', "'oops"]]);
    expect(spansOf('select /* oops')).toEqual([['keyword', 'select'], ['comment', '/* oops']]);
  });
  it('returns sorted, non-overlapping spans', () => {
    const src = "create table t (a int default 1, b text); -- done\ninsert into t values (1, 'x');";
    const spans = sqlSpans(src);
    for (let i = 1; i < spans.length; i++) expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].end);
  });
});

describe('splitStatements', () => {
  it('splits at top-level semicolons and trims', () => {
    expect(splitStatements('select 1; \n select 2;\n').map((s) => s.text)).toEqual(['select 1', 'select 2']);
  });
  it('ignores semicolons in strings, comments, dollar quotes and parentheses', () => {
    const sql = "select ';'; -- a; b\nselect $$ x; y $$; /* ; */ select (1;2)";
    expect(splitStatements(sql).map((s) => s.text)).toEqual(["select ';'", 'select $$ x; y $$', 'select (1;2)']);
  });
  it('drops statements that hold only comments or whitespace', () => {
    expect(splitStatements('-- nothing\n;;  ; /* x */').map((s) => s.text)).toEqual([]);
    expect(splitStatements('-- lead\nselect 1').map((s) => s.text)).toEqual(['select 1']);
  });
  it('reports offsets into the source', () => {
    const src = 'select 1;  select 2';
    const [a, b] = splitStatements(src);
    expect(src.slice(a.start, a.end)).toBe('select 1');
    expect(src.slice(b.start, b.end)).toBe('select 2');
  });
});

describe('positionToLineColumn', () => {
  it('converts a 1-based position', () => {
    expect(positionToLineColumn('ab\ncd\nef', 1)).toEqual({ line: 1, column: 1 });
    expect(positionToLineColumn('ab\ncd\nef', 5)).toEqual({ line: 2, column: 2 });
    expect(positionToLineColumn('ab\ncd\nef', 7)).toEqual({ line: 3, column: 1 });
    expect(positionToLineColumn('ab', 99)).toEqual({ line: 1, column: 3 });
  });
});

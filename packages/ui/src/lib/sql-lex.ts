/* A small PostgreSQL lexer: highlight spans for the SQL editor, a statement splitter and offset → line/column.
   Pure functions — no DOM, no React, no dependencies.

   Why not the page's shared highlighter (lib/syntax.ts)? Its no-WebGPU fallback is C-family shaped: `--` comments
   read as two operators and `select` / `where` / `insert` are not keywords. This one understands what SQL needs
   (`--` and nested block comments, `'it''s'`, E'…' escapes, $tag$…$tag$ bodies, "quoted identifiers") and answers
   synchronously, so the editor never shows plain text first. Its spans have the shape of `SyntaxSpan` (lib/syntax),
   so `tokenizeLines` and the `bl-tok-*` colors render them. */

export type SqlSpanType = 'comment' | 'string' | 'number' | 'keyword' | 'type' | 'function' | 'constant' | 'operator';

export interface SqlSpan {
  type: SqlSpanType;
  /** Half-open UTF-16 offsets into the source. */
  start: number;
  end: number;
}

const KEYWORDS = new Set(
  (
    'add all alter analyze and any as asc begin between by case cast check collate column commit constraint create cross ' +
    'cycle default delete desc distinct do drop else end except exists explain extension false fetch filter first for foreign ' +
    'from full function grant group having if ilike in index inner insert intersect into is join key lateral left like limit ' +
    'materialized natural not nothing null nulls offset on only or order outer over partition policy primary references ' +
    'replace returning returns revoke right rollback row rows schema select sequence set show similar start table temp ' +
    'temporary then to transaction trigger truncate union unique unlogged update using vacuum values view when where window ' +
    'with within without language plpgsql declare loop while return raise perform exception conflict generated always ' +
    'identity stored virtual unbounded preceding following current range groups'
  ).split(' '),
);
const TYPES = new Set(
  (
    'bigint bigserial bit boolean bool bytea char character cidr date daterange decimal double float float4 float8 ' +
    'inet int int2 int4 int8 integer interval json jsonb macaddr numeric oid real ' +
    'regclass serial serial4 serial8 smallint smallserial text time timestamp timestamptz timetz tsquery tsvector uuid ' +
    'varbit varchar xml'
  ).split(' '),
);
const CONSTANTS = new Set(['true', 'false', 'null', 'unknown']);
/** Keywords that are also function names: `left(a, 2)` is a call, `left join` is not. */
const FUNCTION_LIKE = new Set(['left', 'right', 'replace', 'truncate', 'first', 'row', 'filter', 'set', 'show']);

const isWordStart = (c: string) => /[A-Za-z_\u0080-￿]/.test(c);
const isWordChar = (c: string) => /[A-Za-z0-9_$\u0080-￿]/.test(c);
const isDigit = (c: string) => c >= '0' && c <= '9';
const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
const OPERATOR_CHARS = '+-*/<>=~!@#%^&|`?:';

/** The end offset of a block comment starting at `i` (block comments nest in PostgreSQL), or the source end. */
function blockCommentEnd(src: string, i: number): number {
  let depth = 0;
  let j = i;
  while (j < src.length) {
    if (src[j] === '/' && src[j + 1] === '*') {
      depth++;
      j += 2;
    } else if (src[j] === '*' && src[j + 1] === '/') {
      depth--;
      j += 2;
      if (depth === 0) return j;
    } else j++;
  }
  return src.length;
}

/** The end offset of a quoted run starting at `i` (the opening quote) where the quote doubles to escape it. */
function quotedEnd(src: string, i: number, quote: string, backslash: boolean): number {
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (backslash && c === '\\') j += 2;
    else if (c === quote) {
      if (src[j + 1] === quote) j += 2;
      else return j + 1;
    } else j++;
  }
  return src.length;
}

/** `$tag$` or `$$` at `i`: the end offset of the whole dollar-quoted string, or -1 when `i` doesn't start one. */
function dollarQuoteEnd(src: string, i: number): number {
  const m = /^\$([A-Za-z_\u0080-￿][A-Za-z0-9_\u0080-￿]*)?\$/.exec(src.slice(i, i + 64));
  if (!m) return -1;
  const close = src.indexOf(m[0], i + m[0].length);
  return close === -1 ? src.length : close + m[0].length;
}

type Tok = { kind: 'comment' | 'string' | 'ident' | 'word' | 'number' | 'op' | 'punct' | 'space'; start: number; end: number };

/** Every token of `src`, in order, covering it without gaps. */
function* tokens(src: string): Generator<Tok> {
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const start = i;
    let kind: Tok['kind'];
    if (isSpace(c)) {
      while (i < src.length && isSpace(src[i])) i++;
      kind = 'space';
    } else if (c === '-' && src[i + 1] === '-') {
      i = src.indexOf('\n', i);
      if (i === -1) i = src.length;
      kind = 'comment';
    } else if (c === '/' && src[i + 1] === '*') {
      i = blockCommentEnd(src, i);
      kind = 'comment';
    } else if (c === "'") {
      // E'…' strings take backslash escapes: the prefix is a word token, so look behind.
      const prev = src[i - 1];
      const escape = (prev === 'e' || prev === 'E') && !isWordChar(src[i - 2] ?? ' ');
      i = quotedEnd(src, i, "'", escape);
      kind = 'string';
    } else if (c === '"') {
      i = quotedEnd(src, i, '"', false);
      kind = 'ident';
    } else if (c === '$' && dollarQuoteEnd(src, i) !== -1) {
      i = dollarQuoteEnd(src, i);
      kind = 'string';
    } else if (isDigit(c) || (c === '.' && isDigit(src[i + 1] ?? ''))) {
      const m = /^(?:0[xX][0-9a-fA-F_]+|\d[\d_]*(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/.exec(src.slice(i, i + 80));
      i += m ? m[0].length : 1;
      kind = 'number';
    } else if (isWordStart(c)) {
      while (i < src.length && isWordChar(src[i])) i++;
      kind = 'word';
    } else if (OPERATOR_CHARS.includes(c)) {
      while (i < src.length && OPERATOR_CHARS.includes(src[i]) && !(src[i] === '-' && src[i + 1] === '-' && i > start) && !(src[i] === '/' && src[i + 1] === '*' && i > start)) i++;
      kind = 'op';
    } else {
      i++;
      kind = 'punct';
    }
    yield { kind, start, end: i };
  }
}

/** Highlight spans for `src` (plain text — identifiers, whitespace, punctuation — has no span). Sorted, non-overlapping. */
export function sqlSpans(src: string): SqlSpan[] {
  const out: SqlSpan[] = [];
  const toks = [...tokens(src)];
  const nextSignificant = (idx: number) => {
    for (let k = idx + 1; k < toks.length; k++) if (toks[k].kind !== 'space' && toks[k].kind !== 'comment') return toks[k];
    return undefined;
  };
  toks.forEach((t, idx) => {
    let type: SqlSpanType | undefined;
    if (t.kind === 'comment') type = 'comment';
    else if (t.kind === 'string') type = 'string';
    else if (t.kind === 'number') type = 'number';
    else if (t.kind === 'op') type = 'operator';
    else if (t.kind === 'word') {
      const w = src.slice(t.start, t.end).toLowerCase();
      const next = nextSignificant(idx);
      const isCall = next?.kind === 'punct' && src[next.start] === '(';
      // E'…' / B'…' / X'…' prefixes belong to the string that follows.
      if (/^[ebx]$/.test(w) && src[t.end] === "'") type = 'string';
      else if (CONSTANTS.has(w)) type = 'constant';
      else if (TYPES.has(w) && !isCall) type = 'type';
      else if (KEYWORDS.has(w) && !(isCall && FUNCTION_LIKE.has(w))) type = 'keyword';
      else if (isCall) type = 'function';
    }
    if (!type) return;
    const last = out[out.length - 1];
    if (last && last.type === type && last.end === t.start && type !== 'comment') last.end = t.end;
    else out.push({ type, start: t.start, end: t.end });
  });
  return out;
}

export interface SqlStatement {
  /** The statement's text, trimmed, without its terminating `;`. */
  text: string;
  /** Offsets of `text` in the source (half-open). */
  start: number;
  end: number;
}

/** Splits a script at top-level semicolons (not inside strings, comments, dollar-quoted bodies or parentheses).
    Statements that hold only comments or whitespace are dropped — PostgreSQL returns no result for them either. */
export function splitStatements(src: string): SqlStatement[] {
  const out: SqlStatement[] = [];
  let depth = 0;
  let from = 0;
  let meaningful = false;
  const flush = (to: number) => {
    if (meaningful) {
      let s = from;
      let e = to;
      while (s < e && isSpace(src[s])) s++;
      while (e > s && isSpace(src[e - 1])) e--;
      // Leading comments stay part of the statement's range but not its label.
      if (e > s) out.push({ text: src.slice(s, e), start: s, end: e });
    }
    meaningful = false;
  };
  for (const t of tokens(src)) {
    if (t.kind === 'space' || t.kind === 'comment') continue;
    if (!meaningful) {
      // The statement begins where its first meaningful token does; keep any comments before it out of the range.
      from = t.start;
    }
    if (t.kind === 'punct') {
      const c = src[t.start];
      if (c === '(') depth++;
      else if (c === ')') depth = Math.max(0, depth - 1);
      else if (c === ';' && depth === 0) {
        meaningful = true;
        flush(t.start);
        from = t.end;
        continue;
      }
    }
    meaningful = true;
  }
  flush(src.length);
  return out;
}

/** Line and column (both 1-based) of a 1-based character `position`, as PostgreSQL reports error positions. */
export function positionToLineColumn(src: string, position: number): { line: number; column: number } {
  const offset = Math.max(0, Math.min(src.length, position - 1));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset; i++) {
    if (src[i] === '\n') {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

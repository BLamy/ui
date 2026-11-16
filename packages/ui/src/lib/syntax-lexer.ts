/* The kit's synchronous syntax lexer: one module, no dependencies, for every place that colors code without (or before)
   gpu-lexer. CodeEditor's fallback (lib/syntax) and docstream's code fences (docs/HighlightedCode) both call it, so a
   snippet reads the same in a CodeEditor and in a MarkdownView, and both draw with the one palette (`--bl-syntax-*`,
   which docstream's `--docs-tok-*` knobs read too).

   It labels spans with gpu-lexer's token classes (`CodeTokenType`): keywords, strings, numbers, comments, punctuation
   and operators, constants, calls and types where that is cheap. Per-language rules for ts / tsx / js / jsx, json,
   css, html / xml, bash, python, sql, markdown and yaml; a C-family / script-shaped default for any other language
   (and when none is given); nothing for plain-text languages. Linear regexes only, and a size cap, so it can run
   during render and on a server. */

/** The library's token colors: each is a `bl-tok-<type>` (CodeEditor) or `docs-tok-<type>` (docstream) class that
    reads a `--bl-syntax-*` property. */
export type CodeTokenType =
  'plain' | 'comment' | 'string' | 'number' | 'keyword' | 'type' | 'function' | 'constant' | 'operator';

/** A labelled range of the source: half-open UTF-16 offsets (gpu-lexer's output shape). */
export interface SyntaxSpan {
  type: CodeTokenType;
  start: number;
  end: number;
}

type Label = Exclude<CodeTokenType, 'plain'>;

/** Sources longer than this are left plain (the GPU, where there is one, still colors them). */
export const FALLBACK_MAX_LENGTH = 64 * 1024;

/** Languages that are never colored. */
/** Languages that are never lexed. */
export const PLAIN_LANGUAGES = new Set(['text', 'txt', 'plain', 'plaintext', 'none', 'nohighlight', 'output', 'log']);

type Family = 'js' | 'json' | 'css' | 'html' | 'bash' | 'python' | 'sql' | 'md' | 'yaml' | 'generic' | 'plain';

const ALIASES: Record<string, Family> = {
  js: 'js',
  javascript: 'js',
  jsx: 'js',
  mjs: 'js',
  cjs: 'js',
  ts: 'js',
  typescript: 'js',
  tsx: 'js',
  mts: 'js',
  cts: 'js',
  react: 'js',
  node: 'js',
  json: 'json',
  jsonc: 'json',
  json5: 'json',
  jsonl: 'json',
  css: 'css',
  scss: 'css',
  less: 'css',
  postcss: 'css',
  html: 'html',
  htm: 'html',
  xml: 'html',
  svg: 'html',
  xhtml: 'html',
  vue: 'html',
  svelte: 'html',
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  shellsession: 'bash',
  fish: 'bash',
  python: 'python',
  py: 'python',
  py3: 'python',
  sql: 'sql',
  postgres: 'sql',
  postgresql: 'sql',
  psql: 'sql',
  mysql: 'sql',
  sqlite: 'sql',
  plsql: 'sql',
  md: 'md',
  markdown: 'md',
  mdx: 'md',
  gfm: 'md',
  yaml: 'yaml',
  yml: 'yaml',
};

function familyOf(language: string | null | undefined): Family {
  const id = (language ?? '').trim().toLowerCase().split(/[\s{]/)[0]!;
  if (!id) return 'generic';
  if (PLAIN_LANGUAGES.has(id)) return 'plain';
  return ALIASES[id] ?? 'generic';
}

const words = (list: string) => new Set(list.split(' '));

/* ── The engine: sticky rules tried in order at each position; a rule's kind labels its match. ── */

/* A function kind returns the label, null for plain text, or undefined to pass the match on to the next rule. */
type Kind = Label | null | ((text: string, start: number, end: number) => Label | null | undefined);
type Rule = readonly [RegExp, Kind];

const rx = (source: string, flags = '') => new RegExp(source, `y${flags}`);

function push(out: SyntaxSpan[], type: Label | null, start: number, end: number) {
  if (!type || end <= start) return;
  const last = out[out.length - 1];
  if (last && last.type === type && last.end === start) last.end = end;
  else out.push({ type, start, end });
}

function scan(code: string, rules: readonly Rule[], out: SyntaxSpan[], from = 0, to = code.length) {
  let i = from;
  outer: while (i < to) {
    for (const [re, kind] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (!m || !m[0].length) continue;
      const end = Math.min(i + m[0].length, to);
      const type = typeof kind === 'function' ? kind(m[0], i, end) : kind;
      if (type === undefined) continue;
      push(out, type, i, end);
      i = end;
      continue outer;
    }
    i++;
  }
}

const nextChar = (code: string, at: number) => {
  while (at < code.length && (code[at] === ' ' || code[at] === '\t')) at++;
  return code[at];
};

/** The index of the last character before `at` that isn't a space or a tab (-1 at the start). */
const prevIndex = (code: string, at: number) => {
  at--;
  while (at >= 0 && (code[at] === ' ' || code[at] === '\t')) at--;
  return at;
};

/** The word that ends before `at` (spaces skipped), lower-cased; "" when something else comes first. */
const prevWord = (code: string, at: number) => {
  const p = prevIndex(code, at);
  let q = p;
  while (q >= 0 && /[\w$]/.test(code[q]!)) q--;
  return code.slice(q + 1, p + 1).toLowerCase();
};

const SPACE: Rule = [rx('\\s+'), null];
const PUNCT: Rule = [rx('[()\\[\\]{};,]'), 'operator'];
const DOT: Rule = [rx('\\.'), null];
const OPERATORS: Rule = [rx('=>|\\?\\.(?!\\d)|\\.{3}|::|->|[=<>!+\\-*/%&|^~?:@]+'), 'operator'];
const NUMBER: Rule = [
  rx('(?:0[xob][\\da-f_]+n?|(?:\\d[\\d_]*(?:\\.\\d[\\d_]*)?|\\.\\d[\\d_]*)(?:e[+-]?\\d+)?n?)(?![\\w$])', 'i'),
  'number',
];
const DQ: Rule = [rx('"(?:[^"\\\\\\n]|\\\\.)*"?'), 'string'];
const SQ: Rule = [rx("'(?:[^'\\\\\\n]|\\\\.)*'?"), 'string'];
const BLOCK_COMMENT: Rule = [rx('/\\*[\\s\\S]*?(?:\\*/|$)'), 'comment'];
const LINE_COMMENT: Rule = [rx('//[^\\n]*'), 'comment'];
const HASH_COMMENT: Rule = [rx('#[^\\n]*'), 'comment'];

/* ── JavaScript / TypeScript (and JSX) ── */

const JS_KEYWORDS = words(
  'abstract as async await break case catch class const continue debugger declare default delete do else enum export ' +
    'extends finally for from function if implements import in instanceof interface keyof let namespace new of override ' +
    'package private protected public readonly return satisfies static super switch this throw try type typeof var void ' +
    'while with yield',
);
const JS_CONSTANTS = words('true false null undefined NaN Infinity');
const TS_TYPES = words('string number boolean bigint symbol unknown never any object');

function jsRules(code: string): Rule[] {
  const ident = (text: string, start: number, end: number): Label | null => {
    if (JS_KEYWORDS.has(text)) return 'keyword';
    if (JS_CONSTANTS.has(text)) return 'constant';
    if (TS_TYPES.has(text)) return 'type';
    // A JSX tag: `<div`, `</div`. Components are capitalized, so they read as types below.
    const before = code[start - 1] === '/' ? code[start - 2] : code[start - 1];
    if (before === '<' && /^[a-z]/.test(text)) return 'keyword';
    if (nextChar(code, end) === '(') return 'function';
    if (/^[A-Z]/.test(text)) return 'type';
    return null;
  };
  return [
    SPACE,
    LINE_COMMENT,
    BLOCK_COMMENT,
    DQ,
    SQ,
    [rx('`(?:[^`\\\\]|\\\\[\\s\\S])*`?'), 'string'],
    [rx('@[A-Za-z_$][\\w$.]*'), 'function'], // decorators
    NUMBER,
    [rx('#?[A-Za-z_$][\\w$]*'), ident],
    PUNCT,
    DOT,
    OPERATORS,
  ];
}

/* ── JSON (with comments) ── */

function jsonRules(code: string): Rule[] {
  return [
    SPACE,
    LINE_COMMENT,
    BLOCK_COMMENT,
    // A key reads apart from a value.
    [rx('"(?:[^"\\\\\\n]|\\\\.)*"?'), (_t, _s, end) => (nextChar(code, end) === ':' ? 'keyword' : 'string')],
    SQ,
    [rx('-?(?:\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?)(?![\\w$])', 'i'), 'number'],
    [rx('(?:true|false|null|NaN|Infinity)\\b'), 'constant'],
    [rx('[A-Za-z_$][\\w$]*'), null],
    [rx('[{}\\[\\]:,]'), 'operator'],
  ];
}

/* ── CSS: selectors, then properties and values inside blocks ── */

function cssSpans(code: string, out: SyntaxSpan[], from = 0, to = code.length) {
  let value = false;
  // In a selector (or an at-rule's prelude) when the next `{`, `;` or `}` is a `{`: `a:hover {`, `@media (x: 1) {`.
  const delimiter = /[{;}]/g;
  let cachedAt = -1;
  let cachedSelector = false;
  const selectorAhead = (at: number) => {
    if (at <= cachedAt) return cachedSelector;
    delimiter.lastIndex = at;
    const m = delimiter.exec(code);
    cachedAt = m ? m.index : code.length;
    cachedSelector = m?.[0] === '{';
    return cachedSelector;
  };
  const rules: Rule[] = [
    SPACE,
    BLOCK_COMMENT,
    LINE_COMMENT, // scss / less
    DQ,
    SQ,
    [rx('@[\\w-]+'), 'keyword'],
    [rx('!important\\b', 'i'), 'keyword'],
    [rx('#[\\da-f]{3,8}(?![\\w-])', 'i'), () => (value ? 'number' : 'type')],
    [rx('-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:%|[a-z]+)?(?![\\w-])', 'i'), 'number'],
    [rx('--[\\w-]+'), 'constant'],
    [rx('[.#][\\w-]+'), () => (value ? undefined : 'type')],
    // A pseudo-class or -element in a selector; in a declaration the colon starts the value instead.
    [rx('::?[\\w-]+'), (_t, start) => (!value && selectorAhead(start) ? 'keyword' : undefined)],
    [
      rx('-?[A-Za-z_][\\w-]*'),
      (_t, start, end) => {
        if (nextChar(code, end) === '(') return 'function';
        if (value) return null;
        if (selectorAhead(start)) return 'keyword';
        return nextChar(code, end) === ':' ? 'type' : null;
      },
    ],
    [
      rx('[{}]'),
      () => {
        value = false;
        return 'operator';
      },
    ],
    [
      rx(':'),
      (_t, start) => {
        if (!selectorAhead(start)) value = true;
        return 'operator';
      },
    ],
    [
      rx(';'),
      () => {
        value = false;
        return 'operator';
      },
    ],
    [rx('[()\\[\\],]'), 'operator'],
    [rx('[>+~*=|^$&]+'), 'operator'],
  ];
  scan(code, rules, out, from, to);
}

/* ── HTML / XML: tags and attributes; <script> and <style> bodies take the JS and CSS rules ── */

function htmlSpans(code: string, out: SyntaxSpan[], from = 0, to = code.length) {
  const tag = /<(\/?)([A-Za-z][\w:.-]*)/y;
  const attrs = /\s+|([^\s=/>"']+)|(=)|("[^"]*"?|'[^']*'?)|(\/?>)/y;
  let i = from;
  while (i < to) {
    if (code.startsWith('<!--', i)) {
      const close = code.indexOf('-->', i + 4);
      const end = close < 0 || close + 3 > to ? to : close + 3;
      push(out, 'comment', i, end);
      i = end;
      continue;
    }
    if (code.startsWith('<!', i) || code.startsWith('<?', i)) {
      const close = code.indexOf('>', i);
      const end = close < 0 || close + 1 > to ? to : close + 1;
      push(out, 'keyword', i, end);
      i = end;
      continue;
    }
    if (code[i] === '&') {
      const entity = /&(?:#x?[\da-f]+|\w+);/iy;
      entity.lastIndex = i;
      const m = entity.exec(code);
      if (m) {
        push(out, 'constant', i, i + m[0].length);
        i += m[0].length;
        continue;
      }
    }
    tag.lastIndex = i;
    const m = code[i] === '<' ? tag.exec(code) : null;
    if (!m) {
      i++;
      continue;
    }
    push(out, 'operator', i, i + 1 + m[1]!.length);
    push(out, /^[A-Z]/.test(m[2]!) ? 'type' : 'keyword', i + 1 + m[1]!.length, i + m[0].length);
    i += m[0].length;
    let closed = false;
    while (i < to) {
      attrs.lastIndex = i;
      const a = attrs.exec(code);
      if (!a || !a[0].length) break;
      if (a[1]) push(out, 'type', i, i + a[0].length);
      else if (a[2]) push(out, 'operator', i, i + 1);
      else if (a[3]) push(out, 'string', i, i + a[0].length);
      else if (a[4]) {
        push(out, 'operator', i, i + a[0].length);
        closed = true;
      }
      i += a[0].length;
      if (closed) break;
    }
    // Embedded script and style bodies.
    const name = m[2]!.toLowerCase();
    if (closed && !m[1] && (name === 'script' || name === 'style')) {
      const close = code.toLowerCase().indexOf(`</${name}`, i);
      const end = close < 0 || close > to ? to : close;
      if (name === 'script') scan(code, jsRules(code), out, i, end);
      else cssSpans(code, out, i, end);
      i = end;
    }
  }
}

/* ── Shells ── */

const BASH_KEYWORDS = words(
  'if then else elif fi for while until do done case esac in function return export local readonly declare select time ' +
    'break continue exit source alias unset shift trap eval exec set',
);

const COMMAND_AFTER = words('then do else elif if while until time sudo exec');

function bashRules(code: string): Rule[] {
  // The command: the first word of a line (after a `$ ` prompt), or after a pipe, `&&`, `||`, `;` or `(`.
  const commandAt = (start: number) => {
    const p = prevIndex(code, start);
    if (p < 0) return true;
    const c = code[p];
    if (c === '$') {
      const q = prevIndex(code, p);
      return q < 0 || code[q] === '\n';
    }
    if (c === '\n') return code[p - 1] !== '\\'; // not a continued line
    if (c === '|' || c === '&' || c === ';' || c === '(' || c === '{' || c === '!') return true;
    return COMMAND_AFTER.has(prevWord(code, start));
  };
  return [
    [rx('[ \\t]+'), null],
    [rx('\\n'), null],
    // A comment starts a word: `#` after a space or at a line start (not `$#` or `${#x}`).
    [rx('#[^\\n]*'), (_t, start) => (start === 0 || /\s/.test(code[start - 1]!) ? 'comment' : undefined)],
    [rx('"(?:[^"\\\\]|\\\\[\\s\\S])*"?'), 'string'],
    [rx("'[^']*'?"), 'string'],
    [
      rx('\\$(?:\\{[^}\\n]*\\}?|\\(\\(?|[A-Za-z_]\\w*|[@#?$!*0-9-])'),
      (t) => (t.startsWith('$(') ? 'operator' : 'constant'),
    ],
    [rx('^\\$(?=\\s)', 'm'), 'operator'], // a prompt
    [rx('\\d+(?![\\w.-])'), 'number'],
    [
      rx('[A-Za-z_./~][\\w./~:+@%-]*'),
      (t, start, end) => {
        if (BASH_KEYWORDS.has(t)) return 'keyword';
        if (t === 'true' || t === 'false') return 'constant';
        if (/^[A-Za-z_]\w*$/.test(t) && code[end] === '=') return 'constant'; // NAME=value
        return commandAt(start) ? 'function' : null;
      },
    ],
    [rx('--?[\\w-]+(?==)?'), null],
    [rx('&&|\\|\\||;;|[|&;<>]+|[()=]'), 'operator'],
    [rx('[{}\\[\\]]'), 'operator'],
  ];
}

/* ── Python ── */

const PY_KEYWORDS = words(
  'and as assert async await break class continue def del elif else except finally for from global if import in is ' +
    'lambda nonlocal not or pass raise return try while with yield match case',
);
const PY_CONSTANTS = words('True False None self cls NotImplemented Ellipsis');
const PY_TYPES = words('int str float bool list dict set tuple bytes bytearray object complex frozenset type');

function pythonRules(code: string): Rule[] {
  return [
    SPACE,
    HASH_COMMENT,
    [rx('[rbfuRBFU]{0,2}(?:"""[\\s\\S]*?(?:"""|$)|\'\'\'[\\s\\S]*?(?:\'\'\'|$))'), 'string'],
    [rx('[rbfuRBFU]{0,2}(?:"(?:[^"\\\\\\n]|\\\\.)*"?|\'(?:[^\'\\\\\\n]|\\\\.)*\'?)'), 'string'],
    [rx('@[A-Za-z_][\\w.]*'), 'function'],
    NUMBER,
    [
      rx('[A-Za-z_]\\w*'),
      (t, start, end) => {
        if (PY_KEYWORDS.has(t)) return 'keyword';
        if (PY_CONSTANTS.has(t)) return 'constant';
        if (PY_TYPES.has(t)) return 'type';
        const before = prevWord(code, start);
        if (before === 'class') return 'type';
        if (before === 'def' || nextChar(code, end) === '(') return 'function';
        return /^[A-Z][a-z]/.test(t) ? 'type' : null;
      },
    ],
    PUNCT,
    DOT,
    [rx('->|:=|\\*\\*=?|//=?|[=<>!+\\-*/%&|^~:@]+'), 'operator'],
  ];
}

/* ── SQL ── */

const SQL_KEYWORDS = words(
  'add all alter and any as asc begin between by cascade case check column commit constraint create cross database ' +
    'default delete desc distinct drop else end exists explain foreign from full grant group having if in index inner ' +
    'insert intersect into is join key left like limit not offset on or order outer over partition primary references ' +
    'replace returning revoke right rollback schema select set table then to transaction trigger truncate union unique ' +
    'update using values view when where window with recursive conflict do nothing lateral ilike materialized sequence',
);
const SQL_TYPES = words(
  'int integer smallint bigint serial bigserial decimal numeric real float double precision boolean bool char varchar ' +
    'text date time timestamp timestamptz interval uuid json jsonb blob bytea money',
);

const TABLE_AFTER = words('table from join into update references exists');

function sqlRules(code: string): Rule[] {
  return [
    SPACE,
    [rx('--[^\\n]*'), 'comment'],
    BLOCK_COMMENT,
    [rx("'(?:[^']|'')*'?"), 'string'],
    [rx('"[^"\\n]*"?'), 'string'],
    [rx('`[^`\\n]*`?'), 'string'],
    NUMBER,
    [rx('[:@$]\\w+|\\$\\d+|\\?'), 'constant'], // parameters
    [
      rx('[A-Za-z_]\\w*'),
      (t, start, end) => {
        const lower = t.toLowerCase();
        if (lower === 'null' || lower === 'true' || lower === 'false') return 'constant';
        if (SQL_TYPES.has(lower)) return 'type';
        if (SQL_KEYWORDS.has(lower)) return 'keyword';
        if (TABLE_AFTER.has(prevWord(code, start))) return 'type'; // a table's name
        if (nextChar(code, end) === '(') return 'function';
        return null;
      },
    ],
    PUNCT,
    DOT,
    [rx('::|\\|\\||[=<>!+\\-*/%&|^~]+'), 'operator'],
  ];
}

/* ── YAML ── */

function yamlRules(code: string): Rule[] {
  return [
    SPACE,
    [rx('#[^\\n]*'), (_t, start) => (start === 0 || /\s/.test(code[start - 1]!) ? 'comment' : undefined)],
    [rx('^(?:---|\\.\\.\\.)$', 'm'), 'comment'],
    // A key opens its line, or follows a list item's dash.
    [
      rx('[\\w.$/][^:\\n#]*?(?=:(?:\\s|$))', 'm'),
      (_t, start) => {
        const p = prevIndex(code, start);
        return p < 0 ||
          code[p] === '\n' ||
          (code[p] === '-' && (prevIndex(code, p) < 0 || code[prevIndex(code, p)] === '\n'))
          ? 'keyword'
          : undefined;
      },
    ],
    DQ,
    SQ,
    [rx('(?:true|false|null|yes|no|on|off|~)(?=\\s*(?:#|$|,|\\]|\\}))', 'im'), 'constant'],
    [rx('-?\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?(?=\\s*(?:#|$|,|\\]|\\}))', 'im'), 'number'],
    [rx('[&*][\\w-]+|![\\w!/-]*'), 'constant'], // anchors, aliases, tags
    [rx('[-:?|>]|[{}\\[\\],]'), 'operator'],
    [rx('[^\\s#:,\\[\\]{}]+'), null],
  ];
}

/* ── Markdown: block markers and inline spans; fenced code takes its own language's rules ── */

function markdownSpans(code: string, out: SyntaxSpan[]) {
  const line = /[^\n]*\n?/y;
  let i = 0;
  let fence: { marker: string; lang: string; bodyStart: number } | null = null;
  let frontmatter = code.startsWith('---\n');
  while (i < code.length) {
    line.lastIndex = i;
    const text = line.exec(code)![0];
    const end = i + text.length;
    const body = text.replace(/\n$/, '');
    if (fence) {
      if (body.trim().startsWith(fence.marker) && body.trim().replace(/[`~]/g, '') === '') {
        lexInto(code.slice(fence.bodyStart, i), fence.lang, out, fence.bodyStart);
        push(out, 'comment', i, i + body.length);
        fence = null;
      }
      i = end;
      continue;
    }
    if (frontmatter) {
      push(out, 'comment', i, i + body.length);
      if (i > 0 && body === '---') frontmatter = false;
      i = end;
      continue;
    }
    const open = /^\s*(`{3,}|~{3,})\s*([^\s`{]*)/.exec(body);
    if (open) {
      push(out, 'comment', i, i + body.length);
      fence = { marker: open[1]!, lang: open[2]!, bodyStart: end };
      i = end;
      continue;
    }
    const heading = /^#{1,6}\s/.exec(body);
    if (heading) {
      push(out, 'keyword', i, i + body.length);
      i = end;
      continue;
    }
    if (/^\s*(?:[-*_]\s*){3,}$/.test(body)) {
      push(out, 'operator', i, i + body.length);
      i = end;
      continue;
    }
    const marker = /^\s*(?:>\s?)*(?:[-*+]|\d+[.)])(?=\s)/.exec(body) ?? /^\s*(?:>\s?)+/.exec(body);
    let at = i;
    if (marker) {
      push(out, 'operator', i, i + marker[0].length);
      at = i + marker[0].length;
    }
    inlineMarkdown(code, at, i + body.length, out);
    i = end;
  }
  if (fence) lexInto(code.slice(fence.bodyStart), fence.lang, out, fence.bodyStart);
}

function inlineMarkdown(code: string, from: number, to: number, out: SyntaxSpan[]) {
  scan(
    code,
    [
      [rx('<!--[\\s\\S]*?(?:-->|$)'), 'comment'],
      [rx('(`+)[^`]*?\\1'), 'string'],
      [rx('\\{%[^%\\n]*%\\}'), 'keyword'], // GitBook tags
      [rx('!?\\[(?=[^\\]\\n]*\\]\\()'), 'operator'],
      [rx('\\]\\([^)\\s]*(?:\\s+"[^"]*")?\\)'), 'function'], // a link's target
      [rx('(\\*\\*|__)(?=\\S)[^\\n]*?\\S\\1'), 'constant'],
      [rx('(\\*|_)(?=[^\\s*_])[^\\n*_]*?[^\\s*_]\\1(?![\\w*])'), 'type'],
      [rx('~~[^~\\n]+~~'), 'comment'],
      [rx('</?[A-Za-z][^>\\n]*>'), 'keyword'],
      [rx('https?://[^\\s)>\\]]+'), 'function'],
      [rx('[\\w\\s]+'), null],
    ],
    out,
    from,
    to,
  );
}

/* ── The C-family / script default (any other language, or none) ── `//`, `#` and block comments, quoted strings,
   numbers, a shared keyword list, `true` / `null`-style constants, calls, capitalized types, operators (`=>`, `?.`, `??`,
   `...`, `::`, `->`) and punctuation. */

const GENERIC_KEYWORDS = words(
  'as async await break case catch class const continue def default delete do elif else enum export extends fn for ' +
    'from func function go if impl implements import in instanceof interface let match mod module mut new package pass ' +
    'private protected pub public raise readonly return static struct super switch then this throw trait try type ' +
    'typeof use var void where while with yield fi done esac local echo',
);
const GENERIC_CONSTANTS = words('true false null undefined nil None True False NaN Infinity self');
/** Built-in type names: types, as gpu-lexer labels them (and so does CodeEditor's windowed lexer, lib/code-editor-model). */
export const BUILTIN_TYPES = words('string number boolean bigint symbol unknown never any');
const GENERIC_RX =
  /(\/\/[^\n]*|#(?=[ \t!]|$)[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|<!--[\s\S]*?(?:-->|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b(?:0[xob][\da-f_]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?)\b)|([A-Za-z_$][\w$]*)|(\?\.(?!\d)|\.{2,3}|::|[=<>!+\-*/%&|^~?:]*[=<>!+\-*/%&|^~?][=<>!+\-*/%&|^~?:]*)|([()[\]{};,])/gim;

function genericSpans(code: string, out: SyntaxSpan[]) {
  GENERIC_RX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GENERIC_RX.exec(code))) {
    const start = m.index;
    const end = start + m[0].length;
    let type: Label | null = null;
    if (m[1]) type = 'comment';
    else if (m[2]) type = 'string';
    else if (m[3]) type = 'number';
    else if (m[4]) {
      const w = m[4];
      type = GENERIC_KEYWORDS.has(w)
        ? 'keyword'
        : GENERIC_CONSTANTS.has(w)
          ? 'constant'
          : /^\s*\(/.test(code.slice(end, end + 8))
            ? 'function'
            : /^[A-Z]([a-z]|$)/.test(w) || BUILTIN_TYPES.has(w)
              ? 'type'
              : null;
    } else if (m[5] || m[6]) type = 'operator';
    push(out, type, start, end);
  }
}

function lexInto(code: string, language: string | null | undefined, out: SyntaxSpan[], offset: number) {
  const spans = fallbackSpans(code, language);
  for (const s of spans) out.push({ type: s.type, start: s.start + offset, end: s.end + offset });
}

/**
 * Spans for `code` in `language` (a fence's info string or a file's language id: `ts`, `python`, …; none for the
 * C-family default), synchronously. Sorted and non-overlapping; gaps are plain; never a `plain` span. Empty for
 * plain-text languages and for sources over `maxLength` (default `FALLBACK_MAX_LENGTH`).
 */
export function fallbackSpans(code: string, language?: string | null, maxLength = FALLBACK_MAX_LENGTH): SyntaxSpan[] {
  if (!code || code.length > maxLength) return [];
  const out: SyntaxSpan[] = [];
  switch (familyOf(language)) {
    case 'plain':
      return [];
    case 'js':
      scan(code, jsRules(code), out);
      break;
    case 'json':
      scan(code, jsonRules(code), out);
      break;
    case 'css':
      cssSpans(code, out);
      break;
    case 'html':
      htmlSpans(code, out);
      break;
    case 'bash':
      scan(code, bashRules(code), out);
      break;
    case 'python':
      scan(code, pythonRules(code), out);
      break;
    case 'sql':
      scan(code, sqlRules(code), out);
      break;
    case 'yaml':
      scan(code, yamlRules(code), out);
      break;
    case 'md':
      markdownSpans(code, out);
      break;
    default:
      genericSpans(code, out);
  }
  return out;
}

/* Expressions: the small, safe subset of JavaScript that bindings, conditions and action values are written in:
     count > 0 ? 'Remove' : 'Add'        `Hi, ${session.user}`        plants.filter((p) => !p.done).length
     [...todos, { id: Date.now(), title: draft }]                    todos.map((t) => t.id === item.id ? { ...t, done: !t.done } : t)
   A precedence-climbing parser builds a tree, and evaluation walks it with a scope of names. Nothing is eval'd:
   there is no assignment and no `new`, the only globals are a few pure ones (Math, Date.now, JSON.stringify, String,
   Number, Boolean, Object.keys…), and only allowlisted, non-mutating methods can be called. The same source text
   goes into the generated code unchanged, which is the point: what you bind is what React runs. */

export type Expr =
  | { t: 'lit'; v: string | number | boolean | null | undefined }
  | { t: 'tpl'; parts: (string | Expr)[] }
  | { t: 'id'; name: string; at: number }
  | { t: 'member'; obj: Expr; prop: string; optional: boolean }
  | { t: 'index'; obj: Expr; index: Expr; optional: boolean }
  | { t: 'call'; callee: Expr; args: Expr[] }
  | { t: 'unary'; op: '!' | '-' | '+' | 'typeof'; arg: Expr }
  | { t: 'binary'; op: string; left: Expr; right: Expr }
  | { t: 'cond'; test: Expr; then: Expr; else: Expr }
  | { t: 'array'; items: { spread: boolean; value: Expr }[] }
  | { t: 'object'; entries: ({ spread: true; value: Expr } | { spread: false; key: string; value: Expr; shorthand: boolean })[] }
  | { t: 'arrow'; params: string[]; body: Expr };

export class ExprError extends Error {
  /** Where in the source it went wrong, when known. */
  at: number | undefined;
  constructor(message: string, at?: number) {
    super(message);
    this.at = at;
  }
}

/* ── Tokens ── */

type Tok =
  | { k: 'num'; v: number; at: number }
  | { k: 'str'; v: string; at: number }
  | { k: 'tpl'; parts: (string | Expr)[]; at: number }
  | { k: 'id'; v: string; at: number }
  | { k: 'op'; v: string; at: number }
  | { k: 'eof'; at: number };

const OPS = ['...', '===', '!==', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '(', ')', '[', ']', '{', '}', ',', ':', '?', '.', '+', '-', '*', '/', '%', '!', '<', '>', '='];
const ID_START = /[A-Za-z_$]/;
const ID_PART = /[A-Za-z0-9_$]/;
const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', b: '\b', f: '\f', v: '\v' };

function tokenize(src: string, base = 0): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const at = base + i;
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      const text = m ? m[0] : c;
      out.push({ k: 'num', v: Number(text.replace(/_/g, '')), at });
      i += text.length;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, v = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\' && j + 1 < src.length) { v += ESCAPES[src[j + 1]] ?? src[j + 1]; j += 2; } else v += src[j++];
      }
      if (j >= src.length) throw new ExprError('Unterminated string', at);
      out.push({ k: 'str', v, at });
      i = j + 1;
      continue;
    }
    if (c === '`') {
      const { parts, end } = scanTemplate(src, i, base);
      out.push({ k: 'tpl', parts, at });
      i = end;
      continue;
    }
    if (ID_START.test(c)) {
      let j = i + 1;
      while (j < src.length && ID_PART.test(src[j])) j++;
      out.push({ k: 'id', v: src.slice(i, j), at });
      i = j;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i) && !(o === '?.' && /[0-9]/.test(src[i + 2] ?? '')));
    if (!op) throw new ExprError(`Unexpected '${c}'`, at);
    out.push({ k: 'op', v: op, at });
    i += op.length;
  }
  out.push({ k: 'eof', at: base + src.length });
  return out;
}

/** A template literal from the backtick at `start`: its text and `${…}` parts, and the index after it. */
function scanTemplate(src: string, start: number, base: number): { parts: (string | Expr)[]; end: number } {
  const parts: (string | Expr)[] = [];
  let i = start + 1, text = '';
  while (i < src.length && src[i] !== '`') {
    if (src[i] === '\\' && i + 1 < src.length) { text += ESCAPES[src[i + 1]] ?? src[i + 1]; i += 2; continue; }
    if (src[i] === '$' && src[i + 1] === '{') {
      if (text) parts.push(text);
      text = '';
      // Find the matching brace, skipping strings and nested templates.
      let depth = 1, j = i + 2;
      while (j < src.length && depth > 0) {
        const ch = src[j];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        else if (ch === '"' || ch === "'") { j++; while (j < src.length && src[j] !== ch) j += src[j] === '\\' ? 2 : 1; }
        else if (ch === '`') { j = scanTemplate(src, j, base).end - 1; }
        if (depth > 0) j++;
      }
      if (depth > 0) throw new ExprError('Unterminated ${ in template', base + i);
      parts.push(new Parser(tokenize(src.slice(i + 2, j), base + i + 2)).parseAll());
      i = j + 1;
      continue;
    }
    text += src[i++];
  }
  if (i >= src.length) throw new ExprError('Unterminated template', base + start);
  if (text) parts.push(text);
  return { parts, end: i + 1 };
}

/* ── Parser ── */

const PREC: Record<string, number> = {
  '??': 1, '||': 2, '&&': 3,
  '==': 4, '!=': 4, '===': 4, '!==': 4,
  '<': 5, '>': 5, '<=': 5, '>=': 5,
  '+': 6, '-': 6,
  '*': 7, '/': 7, '%': 7,
};

class Parser {
  private i = 0;
  constructor(private toks: Tok[]) {}

  private peek(o = 0): Tok { return this.toks[Math.min(this.i + o, this.toks.length - 1)]; }
  private next(): Tok { return this.toks[this.i++]; }
  private isOp(v: string, o = 0) { const t = this.peek(o); return t.k === 'op' && t.v === v; }
  private expect(v: string) {
    const t = this.next();
    if (t.k !== 'op' || t.v !== v) throw new ExprError(t.k === 'eof' ? `Expected '${v}'` : `Expected '${v}' but found ${show(t)}`, t.at);
  }

  parseAll(): Expr {
    if (this.peek().k === 'eof') throw new ExprError('Empty expression', this.peek().at);
    const e = this.expression();
    const t = this.peek();
    if (t.k !== 'eof') throw new ExprError(t.k === 'op' && t.v === '=' ? 'Assignment isn\'t allowed here: use a Set action' : `Unexpected ${show(t)}`, t.at);
    return e;
  }

  private expression(): Expr {
    // Arrow functions, for array methods: `x => …`, `(a, b) => …`, `() => …`.
    if (this.peek().k === 'id' && this.isOp('=>', 1)) {
      const p = (this.next() as { v: string }).v;
      this.next();
      return { t: 'arrow', params: [p], body: this.expression() };
    }
    if (this.isOp('(') && this.arrowAhead()) {
      this.next();
      const params: string[] = [];
      while (!this.isOp(')')) {
        const t = this.next();
        if (t.k !== 'id') throw new ExprError('Expected a parameter name', t.at);
        params.push(t.v);
        if (!this.isOp(')')) this.expect(',');
      }
      this.expect(')');
      this.expect('=>');
      return { t: 'arrow', params, body: this.expression() };
    }
    return this.conditional();
  }

  /** At `(`: is this an arrow's parameter list? */
  private arrowAhead(): boolean {
    let j = 1;
    while (this.peek(j).k === 'id' || this.isOp(',', j)) j++;
    return this.isOp(')', j) && this.isOp('=>', j + 1);
  }

  private conditional(): Expr {
    const test = this.binary(1);
    if (!this.isOp('?')) return test;
    this.next();
    const then = this.expression();
    this.expect(':');
    return { t: 'cond', test, then, else: this.expression() };
  }

  private binary(min: number): Expr {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      const prec = t.k === 'op' ? PREC[t.v] : undefined;
      if (!prec || prec < min) return left;
      this.next();
      left = { t: 'binary', op: (t as { v: string }).v, left, right: this.binary(prec + 1) };
    }
  }

  private unary(): Expr {
    const t = this.peek();
    if (t.k === 'op' && (t.v === '!' || t.v === '-' || t.v === '+')) { this.next(); return { t: 'unary', op: t.v, arg: this.unary() }; }
    if (t.k === 'id' && t.v === 'typeof') { this.next(); return { t: 'unary', op: 'typeof', arg: this.unary() }; }
    return this.postfix(this.primary());
  }

  private postfix(e: Expr): Expr {
    for (;;) {
      if (this.isOp('.') || this.isOp('?.')) {
        const optional = (this.next() as { v: string }).v === '?.';
        if (optional && this.isOp('[')) { this.next(); const index = this.expression(); this.expect(']'); e = { t: 'index', obj: e, index, optional }; continue; }
        if (optional && this.isOp('(')) throw new ExprError('Optional calls aren\'t supported', this.peek().at);
        const p = this.next();
        if (p.k !== 'id') throw new ExprError('Expected a property name', p.at);
        e = { t: 'member', obj: e, prop: p.v, optional };
      } else if (this.isOp('[')) {
        this.next();
        const index = this.expression();
        this.expect(']');
        e = { t: 'index', obj: e, index, optional: false };
      } else if (this.isOp('(')) {
        this.next();
        const args: Expr[] = [];
        while (!this.isOp(')')) {
          args.push(this.expression());
          if (!this.isOp(')')) this.expect(',');
        }
        this.expect(')');
        e = { t: 'call', callee: e, args };
      } else return e;
    }
  }

  private primary(): Expr {
    const t = this.next();
    switch (t.k) {
      case 'num': return { t: 'lit', v: t.v };
      case 'str': return { t: 'lit', v: t.v };
      case 'tpl': return { t: 'tpl', parts: t.parts };
      case 'id':
        if (t.v === 'true' || t.v === 'false') return { t: 'lit', v: t.v === 'true' };
        if (t.v === 'null') return { t: 'lit', v: null };
        if (t.v === 'undefined') return { t: 'lit', v: undefined };
        if (t.v === 'new' || t.v === 'function' || t.v === 'class') throw new ExprError(`'${t.v}' isn't allowed in an expression`, t.at);
        return { t: 'id', name: t.v, at: t.at };
      case 'eof': throw new ExprError('Unexpected end of expression', t.at);
      case 'op':
        if (t.v === '(') { const e = this.expression(); this.expect(')'); return e; }
        if (t.v === '[') {
          const items: { spread: boolean; value: Expr }[] = [];
          while (!this.isOp(']')) {
            const spread = this.isOp('...');
            if (spread) this.next();
            items.push({ spread, value: this.expression() });
            if (!this.isOp(']')) this.expect(',');
          }
          this.expect(']');
          return { t: 'array', items };
        }
        if (t.v === '{') {
          const entries: Extract<Expr, { t: 'object' }>['entries'] = [];
          while (!this.isOp('}')) {
            if (this.isOp('...')) { this.next(); entries.push({ spread: true, value: this.expression() }); }
            else {
              const k = this.next();
              if (k.k !== 'id' && k.k !== 'str' && k.k !== 'num') throw new ExprError('Expected a key', k.at);
              const key = String(k.v);
              if (this.isOp(':')) { this.next(); entries.push({ spread: false, key, value: this.expression(), shorthand: false }); }
              else if (k.k === 'id') entries.push({ spread: false, key, value: { t: 'id', name: key, at: k.at }, shorthand: true });
              else throw new ExprError(`Expected ':' after ${key}`, k.at);
            }
            if (!this.isOp('}')) this.expect(',');
          }
          this.expect('}');
          return { t: 'object', entries };
        }
        throw new ExprError(`Unexpected '${t.v}'`, t.at);
      default: throw new ExprError('Unexpected token', (t as Tok).at);
    }
  }
}

function show(t: Tok): string {
  switch (t.k) {
    case 'eof': return 'end of expression';
    case 'id': return `'${t.v}'`;
    case 'op': return `'${t.v}'`;
    case 'num': return String(t.v);
    case 'str': return JSON.stringify(t.v);
    default: return 'template';
  }
}

export type Parsed = { ok: true; expr: Expr } | { ok: false; error: string; at?: number };

const cache = new Map<string, Parsed>();

/** Parses `src` (cached, since every render re-reads its bindings). */
export function parse(src: string): Parsed {
  const hit = cache.get(src);
  if (hit) return hit;
  let out: Parsed;
  try {
    out = { ok: true, expr: new Parser(tokenize(src)).parseAll() };
  } catch (e) {
    out = { ok: false, error: e instanceof Error ? e.message : String(e), at: e instanceof ExprError ? e.at : undefined };
  }
  if (cache.size > 4000) cache.clear();
  cache.set(src, out);
  return out;
}

/* ── Evaluation ── */

export type Scope = Record<string, unknown>;

/** Functions an expression may call: the globals below and arrow functions written in the expression. */
const SAFE = new WeakSet<object>();
const safe = <T extends object>(f: T): T => { SAFE.add(f); return f; };

const ns = (o: Record<string, unknown>) => {
  for (const v of Object.values(o)) if (typeof v === 'function') safe(v);
  return Object.freeze(o);
};

/** The names every expression can read. */
export const GLOBALS: Readonly<Record<string, unknown>> = Object.freeze({
  Math: ns({
    min: Math.min, max: Math.max, round: Math.round, floor: Math.floor, ceil: Math.ceil, abs: Math.abs, pow: Math.pow,
    sqrt: Math.sqrt, sign: Math.sign, trunc: Math.trunc, random: Math.random, PI: Math.PI, E: Math.E,
  }),
  Date: ns({ now: () => Date.now() }),
  JSON: ns({ stringify: (v: unknown) => JSON.stringify(v) }),
  Object: ns({ keys: Object.keys, values: Object.values, entries: Object.entries }),
  Array: ns({ isArray: Array.isArray }),
  String: safe((v: unknown) => String(v)),
  Number: safe((v: unknown) => Number(v)),
  Boolean: safe((v: unknown) => Boolean(v)),
  parseInt: safe((v: string, r?: number) => parseInt(v, r)),
  parseFloat: safe((v: string) => parseFloat(v)),
  isNaN: safe((v: number) => Number.isNaN(v)),
  NaN,
  Infinity,
});

const BLOCKED = new Set(['__proto__', 'prototype', 'constructor', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__']);

const STRING_METHODS = new Set([
  'toUpperCase', 'toLowerCase', 'trim', 'trimStart', 'trimEnd', 'includes', 'startsWith', 'endsWith', 'slice', 'substring',
  'padStart', 'padEnd', 'split', 'replace', 'replaceAll', 'indexOf', 'lastIndexOf', 'charAt', 'at', 'repeat', 'concat',
  'localeCompare', 'toString',
]);
const NUMBER_METHODS = new Set(['toFixed', 'toPrecision', 'toString', 'toLocaleString']);
const ARRAY_METHODS = new Set([
  'map', 'filter', 'find', 'findIndex', 'findLast', 'findLastIndex', 'some', 'every', 'includes', 'indexOf', 'join', 'slice',
  'concat', 'at', 'reduce', 'flat', 'flatMap', 'toReversed', 'toSorted', 'with',
]);
const MUTATING = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']);

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function member(obj: unknown, prop: string, optional: boolean): unknown {
  if (obj == null) {
    if (optional) return undefined;
    throw new ExprError(`Cannot read '${prop}' of ${obj === null ? 'null' : 'undefined'}`);
  }
  if (BLOCKED.has(prop)) throw new ExprError(`'${prop}' can't be read`);
  if (typeof obj === 'string' || Array.isArray(obj)) {
    if (prop === 'length') return obj.length;
    return /^\d+$/.test(prop) ? obj[Number(prop)] : undefined;
  }
  if (typeof obj === 'object') return has(obj as object, prop) ? (obj as Record<string, unknown>)[prop] : undefined;
  return undefined;
}

function call(e: Extract<Expr, { t: 'call' }>, s: Scope): unknown {
  const args = e.args.map((a) => ev(a, s));
  const c = e.callee;
  if (c.t === 'member') {
    const recv = ev(c.obj, s);
    if (recv == null) {
      if (c.optional) return undefined;
      throw new ExprError(`Cannot call '${c.prop}' on ${recv === null ? 'null' : 'undefined'}`);
    }
    const m = c.prop;
    if (typeof recv === 'string') {
      if (!STRING_METHODS.has(m)) throw new ExprError(`'${m}' isn't an allowed string method`);
      return (String.prototype as unknown as Record<string, (...a: unknown[]) => unknown>)[m].apply(recv, args);
    }
    if (typeof recv === 'number') {
      if (!NUMBER_METHODS.has(m)) throw new ExprError(`'${m}' isn't an allowed number method`);
      return (Number.prototype as unknown as Record<string, (...a: unknown[]) => unknown>)[m].apply(recv, args);
    }
    if (Array.isArray(recv)) {
      if (MUTATING.has(m)) throw new ExprError(`'${m}' changes the array: build a new one, like [...list, item]`);
      if (!ARRAY_METHODS.has(m)) throw new ExprError(`'${m}' isn't an allowed array method`);
      return (Array.prototype as unknown as Record<string, (...a: unknown[]) => unknown>)[m].apply(recv, args);
    }
    const f = member(recv, m, false);
    if (typeof f === 'function' && SAFE.has(f)) return (f as (...a: unknown[]) => unknown)(...args);
    throw new ExprError(`'${m}' isn't a function you can call here`);
  }
  const f = ev(c, s);
  if (typeof f === 'function' && SAFE.has(f)) return (f as (...a: unknown[]) => unknown)(...args);
  throw new ExprError(c.t === 'id' ? `'${c.name}' can't be called in an expression (use a Call action for a delegate)` : 'Not a function');
}

function ev(e: Expr, s: Scope): unknown {
  switch (e.t) {
    case 'lit': return e.v;
    case 'tpl': return e.parts.map((p) => (typeof p === 'string' ? p : String(ev(p, s)))).join('');
    case 'id':
      if (has(s, e.name)) return s[e.name];
      if (has(GLOBALS, e.name)) return GLOBALS[e.name];
      throw new ExprError(`Cannot find name '${e.name}'`, e.at);
    case 'member': return member(ev(e.obj, s), e.prop, e.optional);
    case 'index': {
      const obj = ev(e.obj, s);
      const k = ev(e.index, s);
      return member(obj, String(k), e.optional);
    }
    case 'call': return call(e, s);
    case 'unary': {
      const v = ev(e.arg, s);
      if (e.op === '!') return !v;
      if (e.op === '-') return -(v as number);
      if (e.op === '+') return +(v as number);
      return typeof v;
    }
    case 'binary': {
      if (e.op === '&&') { const l = ev(e.left, s); return l ? ev(e.right, s) : l; }
      if (e.op === '||') { const l = ev(e.left, s); return l ? l : ev(e.right, s); }
      if (e.op === '??') { const l = ev(e.left, s); return l ?? ev(e.right, s); }
      const l = ev(e.left, s) as never, r = ev(e.right, s) as never;
      switch (e.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return l / r;
        case '%': return l % r;
        case '<': return l < r;
        case '>': return l > r;
        case '<=': return l <= r;
        case '>=': return l >= r;
        case '===': return l === r;
        case '!==': return l !== r;
        // eslint-disable-next-line eqeqeq
        case '==': return l == r;
        // eslint-disable-next-line eqeqeq
        case '!=': return l != r;
      }
      throw new ExprError(`Unknown operator '${e.op}'`);
    }
    case 'cond': return ev(e.test, s) ? ev(e.then, s) : ev(e.else, s);
    case 'array': {
      const out: unknown[] = [];
      for (const it of e.items) {
        const v = ev(it.value, s);
        if (!it.spread) out.push(v);
        else if (Array.isArray(v) || typeof v === 'string') out.push(...v);
        else throw new ExprError('Only an array can be spread into an array');
      }
      return out;
    }
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const en of e.entries) {
        if (en.spread) {
          const v = ev(en.value, s);
          if (v != null && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!BLOCKED.has(k)) out[k] = x;
        } else if (!BLOCKED.has(en.key)) out[en.key] = ev(en.value, s);
      }
      return out;
    }
    case 'arrow':
      return safe((...args: unknown[]) => {
        const inner: Scope = { ...s };
        e.params.forEach((p, i) => { inner[p] = args[i]; });
        return ev(e.body, inner);
      });
  }
}

export type Evaluated = { ok: true; value: unknown } | { ok: false; error: string; at?: number };

/** Evaluates `src` in `scope`. Never throws. */
export function evaluate(src: string, scope: Scope): Evaluated {
  const p = parse(src);
  if (!p.ok) return p;
  try {
    return { ok: true, value: ev(p.expr, scope) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), at: e instanceof ExprError ? e.at : undefined };
  }
}

/** The value of `src`, or `fallback` when it doesn't evaluate. */
export function valueOf<T = unknown>(src: string, scope: Scope, fallback?: T): T {
  const r = evaluate(src, scope);
  return (r.ok ? r.value : fallback) as T;
}

/* ── Analysis ── */

/** An expression's direct sub-expressions. */
function kids(e: Expr): Expr[] {
  switch (e.t) {
    case 'tpl': return e.parts.filter((x): x is Expr => typeof x !== 'string');
    case 'member': return [e.obj];
    case 'index': return [e.obj, e.index];
    case 'call': return [e.callee, ...e.args];
    case 'unary': return [e.arg];
    case 'binary': return [e.left, e.right];
    case 'cond': return [e.test, e.then, e.else];
    case 'array': return e.items.map((x) => x.value);
    case 'object': return e.entries.map((x) => x.value);
    case 'arrow': return [e.body];
    default: return [];
  }
}

/** Visits every free name (`id` not bound by an arrow parameter, not a global), with whether it's an object shorthand. */
function eachFree(e: Expr, fn: (id: Extract<Expr, { t: 'id' }>, shorthand: boolean) => void, bound = new Set<string>()): void {
  if (e.t === 'id') {
    if (!bound.has(e.name) && !has(GLOBALS, e.name)) fn(e, false);
    return;
  }
  if (e.t === 'object') {
    for (const x of e.entries) {
      if (!x.spread && x.shorthand && x.value.t === 'id') { if (!bound.has(x.value.name) && !has(GLOBALS, x.value.name)) fn(x.value, true); }
      else eachFree(x.value, fn, bound);
    }
    return;
  }
  const inner = e.t === 'arrow' ? new Set([...bound, ...e.params]) : bound;
  for (const k of kids(e)) eachFree(k, fn, inner);
}

/** The names an expression reads from its scope (not globals, not arrow parameters), with where each appears. */
export function freeNames(src: string): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const p = parse(src);
  if (p.ok) eachFree(p.expr, (id) => out.set(id.name, [...(out.get(id.name) ?? []), id.at]));
  return out;
}

/** Every `root.field` an expression reads (which fields of a context it uses). */
export function memberPaths(src: string, root: string): string[] {
  const out = new Set<string>();
  const p = parse(src);
  const walk = (e: Expr): void => {
    if (e.t === 'member' && e.obj.t === 'id' && e.obj.name === root) out.add(e.prop);
    kids(e).forEach(walk);
  };
  if (p.ok) walk(p.expr);
  return [...out];
}

/** Renames a free name (`count` → `total`) everywhere it's read, leaving property names and parameters alone. */
export function renameIn(src: string, from: string, to: string): string {
  const p = parse(src);
  if (!p.ok || from === to) return src;
  const spots: { at: number; shorthand: boolean }[] = [];
  eachFree(p.expr, (id, shorthand) => { if (id.name === from) spots.push({ at: id.at, shorthand }); });
  let out = src;
  for (const s of spots.sort((a, b) => b.at - a.at)) {
    out = out.slice(0, s.at) + (s.shorthand ? `${from}: ${to}` : to) + out.slice(s.at + from.length);
  }
  return out;
}

/** A plain reference: a name, or `name.field`. Two-way bindings write back through one. */
export function refPath(src: string): string[] | null {
  const m = /^\s*([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?\s*$/.exec(src);
  return m ? (m[2] ? [m[1], m[2]] : [m[1]]) : null;
}

/** A literal as expression source: `'Hi'`, `42`, `true`. */
export function literalSource(v: unknown): string {
  if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
  if (v === undefined) return 'undefined';
  return JSON.stringify(v);
}

/** A value, short, for previews: `"Ada"`, `3`, `[4 items]`. */
export function preview(v: unknown, max = 40): string {
  if (typeof v === 'string') return JSON.stringify(v.length > max ? `${v.slice(0, max)}…` : v);
  if (typeof v === 'function') return 'ƒ()';
  if (Array.isArray(v)) return `[${v.length} item${v.length === 1 ? '' : 's'}]`;
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    return `{ ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', …' : ''} }`;
  }
  return String(v);
}

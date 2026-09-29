/* A small, safe calculator: a recursive-descent parser over a token list — no eval, no Function.
   Grammar:  expr   := term (('+' | '-') term)*
             term   := unary (('*' | '/' | '%' | implicit) unary)*       2(3+4), 2pi
             unary  := ('-' | '+') unary | power                        -3^2 = -9
             power  := postfix ('^' unary)?                             right-associative
             postfix:= primary '!'*
             primary:= number | constant | fn '(' expr ')' | fn primary | '(' expr ')'
   Accepts ×, ÷, −, "x" between numbers, thousands separators ("1,200"), and a leading "=". */

const FNS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  ln: Math.log, log: Math.log10, log2: Math.log2, exp: Math.exp,
};
const CONSTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 };

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function lex(src: string): Tok[] | null {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\*\*/g, '^');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i));
    if (num && num[0] && /[\d.]/.test(c) && (num[1] || num[3])) {
      out.push({ t: 'num', v: parseFloat(num[0].replace(/,/g, '')) });
      i += num[0].length;
      continue;
    }
    // "x" not followed by a letter is multiplication (3x4, 3 x 4).
    if ((c === 'x' || c === 'X') && !/[a-z]/i.test(s[i + 1] ?? '')) { out.push({ t: 'op', v: '*' }); i++; continue; }
    const id = /^[a-zπ][a-z0-9]*/i.exec(s.slice(i));
    if (id) {
      out.push({ t: 'id', v: id[0].toLowerCase() });
      i += id[0].length;
      continue;
    }
    if ('+-*/^%()!'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    return null;
  }
  return out;
}

function parse(toks: Tok[]): number {
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => { const k = peek(); return k?.t === 'op' && k.v === v; };
  const fail = (): never => { throw new Error('syntax'); };

  function expr(): number {
    let v = term();
    while (isOp('+') || isOp('-')) { const o = toks[p++].v; const r = term(); v = o === '+' ? v + r : v - r; }
    return v;
  }
  function startsOperand() {
    const k = peek();
    return !!k && (k.t === 'num' || k.t === 'id' || (k.t === 'op' && k.v === '('));
  }
  function term(): number {
    let v = unary();
    for (;;) {
      if (isOp('*')) { p++; v *= unary(); }
      else if (isOp('/')) { p++; v /= unary(); }
      else if (isOp('%')) {
        p++;
        // "50%" alone is 0.5; "7 % 3" is a remainder.
        if (startsOperand()) v %= unary(); else v /= 100;
      } else if (startsOperand()) v *= unary();
      else return v;
    }
  }
  // Unary minus binds looser than ^, so -3^2 is -9.
  function unary(): number {
    if (isOp('-')) { p++; return -unary(); }
    if (isOp('+')) { p++; return unary(); }
    return power();
  }
  function power(): number {
    const b = postfix();
    if (isOp('^')) { p++; return Math.pow(b, unary()); }
    return b;
  }
  function postfix(): number {
    let v = primary();
    while (isOp('!')) { p++; v = factorial(v); }
    return v;
  }
  function primary(): number {
    const k = toks[p++] ?? fail();
    if (k.t === 'num') return k.v;
    if (k.t === 'op' && k.v === '(') { const v = expr(); if (isOp(')')) p++; return v; } // a missing ")" closes at the end
    if (k.t === 'id') {
      if (k.v in FNS) return FNS[k.v](isOp('(') ? primary() : power());
      if (k.v in CONSTS) return CONSTS[k.v];
    }
    return fail();
  }
  const v = expr();
  if (p !== toks.length) fail();
  return v;
}

function factorial(n: number) {
  if (n < 0 || !Number.isInteger(n) || n > 170) return NaN;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Evaluates `input` as arithmetic; null when it isn't a (finite) expression. */
export function evaluate(input: string): number | null {
  const src = input.trim().replace(/^=/, '').trim();
  if (!src) return null;
  const toks = lex(src);
  if (!toks || !toks.length) return null;
  try {
    const v = parse(toks);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** Does a root query look like math worth answering inline? ("=" anything, or numbers with an operator or
 *  function — not a lone number, not a word that happens to be a constant.) */
export function looksLikeMath(input: string): boolean {
  const s = input.trim();
  if (s.startsWith('=')) return s.length > 1;
  if (!/\d/.test(s)) return /^(sqrt|pi|π|tau|sin|cos|tan|ln|log)\b/i.test(s) && /[\d(]/.test(s);
  return /[-+*/^%×÷−!()x]|sqrt|sin|cos|tan|log|ln|pi|π/i.test(s.replace(/^-/, ''));
}

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 10 });
const sci = new Intl.NumberFormat('en-US', { notation: 'scientific', maximumFractionDigits: 6 });

/** A result for display: grouped digits, up to 10 decimals, scientific past 1e15. */
export function formatResult(v: number): string {
  const r = Math.abs(v) >= 1e15 || (v !== 0 && Math.abs(v) < 1e-9) ? sci.format(v) : fmt.format(Number(v.toPrecision(14)));
  return r;
}

/** The same result without grouping, as it's copied. */
export function plainResult(v: number): string {
  return formatResult(v).replace(/,/g, '');
}

/** The expression as it's shown back (operators spaced, × and ÷). */
export function prettyExpression(input: string): string {
  return input.trim().replace(/^=\s*/, '')
    .replace(/(\d)\s*x\s*(?=[\d(])/gi, '$1 × ').replace(/\s*\*\s*/g, ' × ').replace(/\s*\/\s*/g, ' ÷ ').replace(/\s*\+\s*/g, ' + ')
    .replace(/(\d|\))\s*-\s*/g, '$1 − ').replace(/\s+/g, ' ');
}

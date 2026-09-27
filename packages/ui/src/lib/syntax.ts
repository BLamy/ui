/* Syntax lexing for SyntaxHighlighting: gpu-lexer (a tiny WebGPU model that labels spans in any language) is the
   highlighter. One device and one lexer are shared by every instance on the page: parse calls go through a single
   FIFO queue, identical sources share one in-flight call, and results are cached by source text.

   When WebGPU is truly unavailable (no `navigator.gpu`, no adapter, insecure context) a deliberately small
   fallback — comments, strings, numbers, keywords, calls — labels the code instead, and the element says so with
   `data-highlighter="fallback"`. It is a degraded mode, not a second highlighter. */

export type SyntaxTokenType =
  | 'plain'
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'type'
  | 'function'
  | 'constant'
  | 'operator';

/** A labelled range of the source: half-open UTF-16 offsets (gpu-lexer's output shape). */
export interface SyntaxSpan {
  type: SyntaxTokenType;
  start: number;
  end: number;
}

/** A labelled piece of one line. */
export interface SyntaxToken {
  type: SyntaxTokenType;
  text: string;
}

/** What produced the tokens: `gpu` (gpu-lexer on WebGPU), `fallback` (no WebGPU), `pending` (plain text shown while
    the GPU works), `none` (plain-text language or highlighting disabled). */
export type SyntaxHighlighter = 'gpu' | 'fallback' | 'pending' | 'none';

export interface SyntaxResult {
  spans: SyntaxSpan[];
  highlighter: 'gpu' | 'fallback';
}

/* ── WebGPU state ── */

type GpuState = 'unknown' | 'ready' | 'unavailable';
let gpuState: GpuState = 'unknown';

/** False when WebGPU can't run here: no `navigator.gpu` (Firefox/Safari without it, insecure contexts, SSR) or
    a previous attempt found no adapter. `true` means "worth trying" until the first parse settles it. */
export function webgpuSupported(): boolean {
  if (gpuState === 'unavailable') return false;
  return typeof navigator !== 'undefined' && !!(navigator as Navigator & { gpu?: unknown }).gpu;
}

/* ── Caches (LRU by source text): GPU results, and fallback results kept apart so one never evicts the other ── */

const CACHE_MAX = 256;
const cache = new Map<string, SyntaxResult>();
const fallbackCache = new Map<string, SyntaxResult>();

function lruGet(map: Map<string, SyntaxResult>, code: string): SyntaxResult | undefined {
  const hit = map.get(code);
  if (hit) {
    map.delete(code);
    map.set(code, hit);
  }
  return hit;
}

function lruSet(map: Map<string, SyntaxResult>, code: string, result: SyntaxResult) {
  map.set(code, result);
  if (map.size > CACHE_MAX) map.delete(map.keys().next().value as string);
}

/** A finished result for this source, if one is cached: the GPU's, or the fallback's once WebGPU is known to be
    unavailable. */
export function peekSyntax(code: string): SyntaxResult | undefined {
  return lruGet(cache, code) ?? (webgpuSupported() ? undefined : lruGet(fallbackCache, code));
}

/* ── The shared GPU queue ── */

type Parse = (code: string) => Promise<SyntaxSpan[]>;
let parsePromise: Promise<Parse> | null = null;
const loadParse = () => (parsePromise ??= import('gpu-lexer').then((m) => m.parse as Parse));

let queue: Promise<unknown> = Promise.resolve();
const inflight = new Map<string, Promise<SyntaxResult>>();

/* gpu-lexer reuses its GPU buffers between calls, so calls run one at a time. Large sources are lexed in
   line-aligned pieces that stay well under WebGPU's buffer limits. */
const PIECE = 64 * 1024;

async function gpuSpans(code: string): Promise<SyntaxSpan[]> {
  const parse = await loadParse();
  if (code.length <= PIECE) return parse(code);
  const out: SyntaxSpan[] = [];
  let at = 0;
  while (at < code.length) {
    let end = Math.min(code.length, at + PIECE);
    if (end < code.length) {
      const nl = code.lastIndexOf('\n', end);
      if (nl > at) end = nl + 1;
    }
    for (const s of await parse(code.slice(at, end))) out.push({ type: s.type, start: s.start + at, end: s.end + at });
    at = end;
  }
  return out;
}

/** Lex `code`: gpu-lexer when WebGPU is available, else the small fallback. Cached and de-duplicated. */
export function lexSyntax(code: string): Promise<SyntaxResult> {
  const hit = peekSyntax(code);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(code);
  if (pending) return pending;
  const run: Promise<SyntaxResult> = !webgpuSupported()
    ? Promise.resolve(fallbackResult(code))
    : (queue = queue.then(
        () => gpuSpans(code).then(
          (spans): SyntaxResult => {
            gpuState = 'ready';
            return { spans, highlighter: 'gpu' };
          },
          (error: unknown): SyntaxResult => {
            // "WebGPU unavailable" means no adapter: stop trying. Anything else (a buffer limit) only fails this source.
            if (gpuState !== 'ready' && /unavailable/i.test(String(error))) gpuState = 'unavailable';
            return fallbackResult(code);
          },
        ),
      )) as Promise<SyntaxResult>;
  inflight.set(code, run);
  return run.then((result) => {
    inflight.delete(code);
    if (result.highlighter === 'gpu') lruSet(cache, code, result);
    return result;
  });
}

/** The fallback result, synchronously (cached). */
export function fallbackResult(code: string): SyntaxResult {
  const hit = lruGet(fallbackCache, code);
  if (hit) return hit;
  const result: SyntaxResult = { spans: fallbackSpans(code), highlighter: 'fallback' };
  lruSet(fallbackCache, code, result);
  return result;
}

/* ── Minimal fallback lexer ── C-family / script shaped: `//`, `#` and block comments, quoted strings, numbers,
   a shared keyword list, `true`/`null`-style constants, calls, capitalized types and operators. */

const KEYWORDS = new Set(
  ('as async await break case catch class const continue def default delete do elif else enum export extends ' +
    'fn for from func function go if impl implements import in instanceof interface let match mod module mut new ' +
    'package pass private protected pub public raise readonly return static struct super switch then this throw ' +
    'trait try type typeof use var void where while with yield fi done esac local echo').split(' '),
);
const CONSTANTS = new Set('true false null undefined nil None True False NaN Infinity self'.split(' '));
const RX =
  /(\/\/[^\n]*|#(?=[ \t!]|$)[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|<!--[\s\S]*?(?:-->|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b(?:0[xob][\da-f_]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?)\b)|([A-Za-z_$][\w$]*)|([=<>!+\-*/%&|^~?]+)/gi;

export function fallbackSpans(code: string): SyntaxSpan[] {
  const out: SyntaxSpan[] = [];
  RX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RX.exec(code))) {
    const start = m.index;
    const end = start + m[0].length;
    let type: SyntaxTokenType = 'plain';
    if (m[1]) type = 'comment';
    else if (m[2]) type = 'string';
    else if (m[3]) type = 'number';
    else if (m[4]) {
      const w = m[4];
      type = KEYWORDS.has(w)
        ? 'keyword'
        : CONSTANTS.has(w)
          ? 'constant'
          : /^\s*\(/.test(code.slice(end, end + 8))
            ? 'function'
            : /^[A-Z][a-z]/.test(w)
              ? 'type'
              : 'plain';
    } else if (m[5]) type = 'operator';
    if (type !== 'plain') out.push({ type, start, end });
  }
  return out;
}

/* ── Spans → lines ── */

/** Split `code` into lines of tokens (spans cut at newlines; gaps are plain). A single trailing newline is dropped,
    so a file ending in `\n` doesn't show an empty last line. */
export function tokenizeLines(code: string, spans: readonly SyntaxSpan[] | null): SyntaxToken[][] {
  const src = code.endsWith('\n') ? code.slice(0, -1) : code;
  const lines: SyntaxToken[][] = [[]];
  const emit = (type: SyntaxTokenType, text: string) => {
    let from = 0;
    for (let nl = text.indexOf('\n'); nl !== -1; nl = text.indexOf('\n', from)) {
      if (nl > from) lines[lines.length - 1].push({ type, text: text.slice(from, nl) });
      lines.push([]);
      from = nl + 1;
    }
    if (from < text.length) lines[lines.length - 1].push({ type, text: text.slice(from) });
  };
  let at = 0;
  for (const s of spans ?? []) {
    if (s.start >= src.length) break;
    if (s.start > at) emit('plain', src.slice(at, s.start));
    const start = Math.max(s.start, at);
    const end = Math.min(s.end, src.length);
    if (end > start) emit(s.type, src.slice(start, end));
    at = Math.max(at, end);
  }
  if (at < src.length) emit('plain', src.slice(at));
  return lines;
}

/** File extension or name → a language id (for labels and `data-language`; gpu-lexer itself needs none). */
export function languageFromPath(path: string): string {
  const name = path.split('/').pop() ?? path;
  const lower = name.toLowerCase();
  if (lower === 'dockerfile') return 'dockerfile';
  if (lower === 'makefile') return 'makefile';
  const ext = lower.includes('.') ? lower.split('.').pop()! : '';
  const map: Record<string, string> = {
    mjs: 'js', cjs: 'js', mts: 'ts', cts: 'ts', yml: 'yaml', markdown: 'md', mdx: 'mdx', sh: 'bash', zsh: 'bash',
    py: 'python', rb: 'ruby', rs: 'rust', kt: 'kotlin', htm: 'html', txt: 'text', patch: 'diff',
  };
  return map[ext] ?? (ext || 'text');
}

/** Languages that are never lexed. */
export const PLAIN_LANGUAGES = new Set(['text', 'txt', 'plaintext', 'plain', 'none']);

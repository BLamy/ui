/* Syntax lexing for SyntaxHighlighting: gpu-lexer (a tiny WebGPU model that labels spans in any language) is the
   highlighter. One device and one lexer are shared by every instance on the page: parse calls go through a single
   FIFO queue, identical sources share one in-flight call, and results are cached by source text.

   A one-time adapter probe decides first. When WebGPU is unavailable (no `navigator.gpu`, no adapter, insecure
   context) or — in the default `auto` engine — the only adapter is a software one (SwiftShader in headless CI,
   llvmpipe), a deliberately small fallback — comments, strings, numbers, keywords, calls — labels the code at once,
   and the element says so with `data-highlighter="fallback"`. It is a degraded mode, not a second highlighter. */

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

/** What produced the tokens: `gpu` (gpu-lexer on WebGPU), `fallback` (no hardware WebGPU, or forced), `pending`
    (plain text shown while the adapter probe or the GPU works), `none` (plain-text language or highlighting
    disabled). */
export type SyntaxHighlighter = 'gpu' | 'fallback' | 'pending' | 'none';

export interface SyntaxResult {
  spans: SyntaxSpan[];
  highlighter: 'gpu' | 'fallback';
}

/** Which lexer to use. `auto` (default): gpu-lexer on a hardware WebGPU adapter, the fallback at once when the
    only adapter is a software one (SwiftShader, llvmpipe, …), there is none, or the probe times out. `gpu`:
    gpu-lexer whenever WebGPU has any adapter, software included. `fallback`: always the fallback. */
export type SyntaxEngine = 'auto' | 'gpu' | 'fallback';

/* ── WebGPU state ── */

/** What the one-time adapter probe found: a `hardware` adapter, only a `software`/fallback one (or the probe timed
    out), or `none` (no `navigator.gpu`, no adapter, insecure context, SSR). */
export type WebGPUProbe = 'hardware' | 'software' | 'none';

type GpuState = 'unknown' | 'ready' | 'unavailable';
let gpuState: GpuState = 'unknown';
let probeState: WebGPUProbe | null = null;
let probePromise: Promise<WebGPUProbe> | null = null;

/** How long the probe waits for an adapter before `auto` settles on the fallback. */
const PROBE_TIMEOUT = 2500;
const SOFTWARE_ADAPTER = /swiftshader|llvmpipe|lavapipe|software|microsoft basic/i;

interface ProbeAdapterInfo {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
  isFallbackAdapter?: boolean;
}
interface ProbeAdapter {
  isFallbackAdapter?: boolean;
  info?: ProbeAdapterInfo;
  requestAdapterInfo?: () => Promise<ProbeAdapterInfo>;
}
interface ProbeGpu {
  requestAdapter(): Promise<ProbeAdapter | null>;
}

const navigatorGpu = (): ProbeGpu | undefined =>
  typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { gpu?: ProbeGpu }).gpu;

async function classifyAdapter(adapter: ProbeAdapter | null): Promise<WebGPUProbe> {
  if (!adapter) return 'none';
  let info = adapter.info;
  if (!info && typeof adapter.requestAdapterInfo === 'function') info = await adapter.requestAdapterInfo().catch(() => undefined);
  if (adapter.isFallbackAdapter || info?.isFallbackAdapter) return 'software';
  const text = [info?.vendor, info?.architecture, info?.device, info?.description].filter(Boolean).join(' ');
  return SOFTWARE_ADAPTER.test(text) ? 'software' : 'hardware';
}

/** Probe WebGPU once per page (cached): is there an adapter, and is it real hardware? Settles within ~2.5 s; a probe
    that takes longer counts as `software` (so `auto` falls back), and a late answer still updates later lexes. */
export function probeWebGPU(): Promise<WebGPUProbe> {
  if (probePromise) return probePromise;
  const gpu = navigatorGpu();
  if (!gpu) {
    probeState = 'none';
    return (probePromise = Promise.resolve<WebGPUProbe>('none'));
  }
  const request = Promise.resolve()
    .then(() => gpu.requestAdapter())
    .then(classifyAdapter, (): WebGPUProbe => 'none');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<WebGPUProbe>((resolve) => {
    timer = setTimeout(() => resolve('software'), PROBE_TIMEOUT);
  });
  void request.then((r) => {
    clearTimeout(timer);
    probeState = r;
  });
  probePromise = Promise.race([request, timeout]).then((r) => (probeState ??= r));
  return probePromise;
}

/** Whether `engine` (default `auto`) should use gpu-lexer here. `false` when there is no `navigator.gpu`
    (Firefox/Safari without it, insecure contexts, SSR), the probe found no adapter, or a lex found WebGPU
    unavailable — and, for `auto`, when the probe found only a software adapter. `true` means "worth trying" while
    the probe is still pending. */
export function webgpuSupported(engine: SyntaxEngine = 'auto'): boolean {
  if (engine === 'fallback' || gpuState === 'unavailable' || probeState === 'none') return false;
  if (engine === 'auto' && probeState === 'software') return false;
  return !!navigatorGpu();
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

/** A finished result for this source, if one is cached: the GPU's, or the fallback's once `engine` is known not to
    use the GPU here. */
export function peekSyntax(code: string, engine: SyntaxEngine = 'auto'): SyntaxResult | undefined {
  if (engine === 'fallback') return lruGet(fallbackCache, code);
  return lruGet(cache, code) ?? (webgpuSupported(engine) ? undefined : lruGet(fallbackCache, code));
}

/* ── Span normalisation ── gpu-lexer sometimes labels operators (`=>`, `?.`, `??`) and punctuation as a keyword,
   type, function or constant. Such spans are re-cut: operator runs become `operator`, punctuation, a lone `.` or `:`
   and whitespace become plain, and word runs keep their label. */

const RELABEL = new Set<SyntaxTokenType>(['keyword', 'type', 'function', 'constant']);
const OP_CHARS = '=<>!+-*/%&|^~?:.';
const PUNCT_CHARS = '()[]{};,';
const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v';
const isWordChar = (c: string | undefined) => !!c && !isSpace(c) && !OP_CHARS.includes(c) && !PUNCT_CHARS.includes(c);

type RunKind = 'word' | 'op' | 'punct' | 'space';

function charKind(text: string, i: number): RunKind {
  const c = text[i];
  if (isSpace(c)) return 'space';
  if (PUNCT_CHARS.includes(c)) return 'punct';
  if (!OP_CHARS.includes(c)) return 'word'; // letters, digits, and identifier/decorator/directive chars (@ # $ _ …)
  if (c === '-') {
    // `font-size`, `--custom-prop`, `--flag`: a hyphen inside a word, or leading dashes that start one.
    if (isWordChar(text[i - 1]) && isWordChar(text[i + 1])) return 'word';
    let first = i;
    while (text[first - 1] === '-') first--;
    let after = i;
    while (text[after] === '-') after++;
    if (first === 0 && isWordChar(text[after])) return 'word';
  }
  return 'op';
}

/** Re-cut keyword/type/function/constant spans so operators read as `operator` and punctuation and whitespace as
    plain (dropped); comment, string, number and operator spans pass through. Output is sorted and non-overlapping. */
export function normalizeSpans(code: string, spans: readonly SyntaxSpan[]): SyntaxSpan[] {
  const out: SyntaxSpan[] = [];
  let at = 0;
  const push = (type: SyntaxTokenType, start: number, end: number) => {
    start = Math.max(start, at);
    if (end <= start) return;
    at = end;
    if (type === 'plain') return;
    const last = out[out.length - 1];
    if (last && last.type === type && last.end === start) last.end = end;
    else out.push({ type, start, end });
  };
  const ordered = spans.every((s, i) => i === 0 || spans[i - 1].start <= s.start)
    ? spans
    : [...spans].sort((a, b) => a.start - b.start);
  for (const s of ordered) {
    if (!RELABEL.has(s.type)) {
      push(s.type, s.start, s.end);
      continue;
    }
    const text = code.slice(s.start, s.end);
    let i = 0;
    while (i < text.length) {
      const kind = charKind(text, i);
      let j = i + 1;
      while (j < text.length && charKind(text, j) === kind) j++;
      const run = text.slice(i, j);
      // A tag's angle brackets labelled with its name (`<div`, `</p>`, `/>`) are punctuation, not operators.
      const tagBracket = /^(<\/?|\/?>)$/.test(run) && /[A-Za-z]/.test(text);
      const type: SyntaxTokenType =
        kind === 'word' ? s.type : kind === 'op' && run !== '.' && run !== ':' && !tagBracket ? 'operator' : 'plain';
      push(type, s.start + i, s.start + j);
      i = j;
    }
  }
  return out;
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
  if (code.length <= PIECE) return normalizeSpans(code, await parse(code));
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
  return normalizeSpans(code, out);
}

function gpuResult(code: string): Promise<SyntaxResult> {
  return (queue = queue.then(() =>
    gpuSpans(code).then(
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
}

/** Lex `code` with `engine` (default `auto`): gpu-lexer when the engine and the one-time adapter probe allow it,
    else the small fallback. Cached and de-duplicated. */
export function lexSyntax(code: string, engine: SyntaxEngine = 'auto'): Promise<SyntaxResult> {
  const hit = peekSyntax(code, engine);
  if (hit) return Promise.resolve(hit);
  if (!webgpuSupported(engine)) return Promise.resolve(fallbackResult(code));
  const key = engine + '\0' + code;
  const pending = inflight.get(key);
  if (pending) return pending;
  const run = probeWebGPU()
    .then(() => (webgpuSupported(engine) ? gpuResult(code) : fallbackResult(code)))
    .then((result) => {
      inflight.delete(key);
      if (result.highlighter === 'gpu') lruSet(cache, code, result);
      return result;
    });
  inflight.set(key, run);
  return run;
}

/** The fallback result, synchronously (cached). */
export function fallbackResult(code: string): SyntaxResult {
  const hit = lruGet(fallbackCache, code);
  if (hit) return hit;
  const result: SyntaxResult = { spans: normalizeSpans(code, fallbackSpans(code)), highlighter: 'fallback' };
  lruSet(fallbackCache, code, result);
  return result;
}

/* ── Minimal fallback lexer ── C-family / script shaped: `//`, `#` and block comments, quoted strings, numbers,
   a shared keyword list, `true`/`null`-style constants, calls, capitalized types and operators (`=>`, `?.`, `??`,
   `...`, `::`, `->`; a lone `.` or `:` and brackets stay plain). */

const KEYWORDS = new Set(
  ('as async await break case catch class const continue def default delete do elif else enum export extends ' +
    'fn for from func function go if impl implements import in instanceof interface let match mod module mut new ' +
    'package pass private protected pub public raise readonly return static struct super switch then this throw ' +
    'trait try type typeof use var void where while with yield fi done esac local echo').split(' '),
);
const CONSTANTS = new Set('true false null undefined nil None True False NaN Infinity self'.split(' '));
const RX =
  /(\/\/[^\n]*|#(?=[ \t!]|$)[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|<!--[\s\S]*?(?:-->|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b(?:0[xob][\da-f_]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?)\b)|([A-Za-z_$][\w$]*)|(\?\.(?!\d)|\.{2,3}|::|[=<>!+\-*/%&|^~?:]*[=<>!+\-*/%&|^~?][=<>!+\-*/%&|^~?:]*)/gi;

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

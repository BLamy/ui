'use client';
import {
  createContext, memo, useContext, useEffect, useMemo, useRef, useState,
  type CSSProperties, type ComponentProps, type HTMLAttributes, type ReactNode,
} from 'react';
import { Button as AriaButton, type ButtonProps as AriaButtonProps, composeRenderProps } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useAppearance } from '@/lib/theme';
import {
  PLAIN_LANGUAGES, lexSyntax, peekSyntax, fallbackResult, tokenizeLines, webgpuSupported,
  type SyntaxEngine, type SyntaxHighlighter, type SyntaxResult, type SyntaxToken,
} from '@/lib/syntax';

/* ══ SyntaxHighlighting — code highlighted by gpu-lexer on WebGPU ══
   Plain text renders first and keeps its exact layout; token colors swap in when the shared GPU lexer returns
   (usually one frame for a cached or small source). Without a hardware WebGPU adapter the small fallback answers at
   once (`engine`, default `auto`). Token colors are classes (`bl-tok-*`) reading `--bl-syntax-*`,
   with light and dark defaults that follow the color scheme (BLProvider / AppearanceProvider). */

/* ── Hook ── */

export interface UseSyntaxTokensOptions {
  /** A plain-text language (`text`, `plaintext`, `none`) skips lexing. Other values are informational: gpu-lexer
      recognizes the language itself. */
  language?: string;
  /** `false` renders plain lines and never lexes. */
  enabled?: boolean;
  /** `auto` (default): gpu-lexer on a hardware WebGPU adapter; where the only adapter is a software one
      (SwiftShader in headless CI, llvmpipe), there is none, or the one-time adapter probe takes over 2.5 s, the
      small fallback at once. `gpu`: gpu-lexer on any adapter, software included (slow on software; the fallback
      only where WebGPU is missing). `fallback`: always the fallback (tests, or pages that must not touch the GPU). */
  engine?: SyntaxEngine;
}

export interface SyntaxTokensState {
  /** One token array per line (a single trailing newline is dropped). Plain until the lexer answers. */
  lines: SyntaxToken[][];
  /** `gpu`, `fallback` (no WebGPU), `pending` (plain text shown) or `none` (not lexed). */
  highlighter: SyntaxHighlighter;
}

/** Lines of tokens for `code`, lexed on the GPU through the page's shared gpu-lexer. Returns plain lines at once
    and highlighted lines when ready; results are cached by source, so remounts and repeats are instant. While a
    source grows (streaming), the tokens of its unchanged lines are kept until the new result lands. */
export function useSyntaxTokens(code: string, { language, enabled = true, engine = 'auto' }: UseSyntaxTokensOptions = {}): SyntaxTokensState {
  const off = !enabled || (!!language && PLAIN_LANGUAGES.has(language.toLowerCase()));
  const forced = engine === 'fallback';
  const ready = (src: string): SyntaxResult | null =>
    off ? null : forced ? fallbackResult(src) : peekSyntax(src, engine) ?? (webgpuSupported(engine) ? null : fallbackResult(src));
  const [state, setState] = useState<{ code: string; engine: SyntaxEngine; result: SyntaxResult | null }>(() => ({ code, engine, result: ready(code) }));

  const same = state.code === code && state.engine === engine;
  let result: SyntaxResult | null = same ? state.result : ready(code);
  let partial = false;
  if (!result && state.result && !off && state.engine === engine && code.startsWith(state.code)) {
    // Streaming: keep the tokens of the lines that haven't changed.
    const cut = state.code.lastIndexOf('\n') + 1;
    result = { highlighter: state.result.highlighter, spans: state.result.spans.filter((s) => s.end <= cut) };
    partial = true;
  }

  useEffect(() => {
    if (off) return;
    const keep = (r: SyntaxResult) =>
      setState((s) => (s.code === code && s.engine === engine && s.result === r ? s : { code, engine, result: r }));
    if (forced) {
      keep(fallbackResult(code));
      return;
    }
    let live = true;
    const hit = peekSyntax(code, engine);
    if (hit) keep(hit);
    else void lexSyntax(code, engine).then((r) => { if (live) keep(r); });
    return () => { live = false; };
  }, [code, off, forced, engine]);

  const spans = result?.spans ?? null;
  const lines = useMemo(() => tokenizeLines(code, spans), [code, spans]);
  return { lines, highlighter: off ? 'none' : result && !partial ? result.highlighter : 'pending' };
}

/* ── Tokens ── */

/** One line's tokens as spans with `bl-tok-<type>` classes (plain text stays a text node). */
export function SyntaxTokens({ tokens }: { tokens: readonly SyntaxToken[] }) {
  return (
    <>
      {tokens.map((t, i) => (t.type === 'plain' ? t.text : <span key={i} className={'bl-tok bl-tok-' + t.type}>{t.text}</span>))}
    </>
  );
}

/* ── Line ranges ── */

/** A line number, an inclusive `[from, to]` pair, or a string like `"3-5"` / `"3"`. */
export type SyntaxLineRange = number | readonly [number, number] | string;

function lineSet(ranges: readonly SyntaxLineRange[] | null | undefined): Set<number> {
  const out = new Set<number>();
  for (const r of ranges ?? []) {
    let from: number;
    let to: number;
    if (typeof r === 'number') from = to = r;
    else if (typeof r === 'string') {
      const [a, b] = r.split(/\s*[-–:]\s*/).map(Number);
      from = a;
      to = Number.isFinite(b) ? b : a;
    } else [from, to] = r;
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    const lo = Math.min(from, to);
    const hi = Math.min(Math.max(from, to), lo + 100000);
    for (let n = lo; n <= hi; n++) out.add(n);
  }
  return out;
}

/* ── Variants ── */

export const syntaxHighlightingVariants = cva('bl-syntax', {
  variants: {
    variant: {
      /** A card: hairline border, rounded, its own surface. */
      default: 'bl-syntax-card',
      /** No chrome: sits on whatever surface it's placed on. */
      ghost: 'bl-syntax-ghost',
      /** A `<code>` span in running text. */
      inline: 'bl-syntax-inline',
    },
  },
  defaultVariants: { variant: 'default' },
});

type Variant = NonNullable<VariantProps<typeof syntaxHighlightingVariants>['variant']>;

/* ── Context ── */

interface SyntaxHighlightingContextValue {
  code: string;
  language?: string;
  variant: Variant;
  title?: ReactNode;
  engine?: SyntaxEngine;
}
const SyntaxHighlightingContext = createContext<SyntaxHighlightingContextValue | null>(null);
/** The enclosing SyntaxHighlighting's `code`, `language`, `variant` and `title`. */
export const useSyntaxHighlighting = () => useContext(SyntaxHighlightingContext);

/* ── Content ── */

export interface SyntaxHighlightingContentProps extends Omit<ComponentProps<'pre'>, 'children'> {
  /** Defaults to the enclosing SyntaxHighlighting's `code`. */
  code?: string;
  language?: string;
  /** Show a line-number gutter (numbers are drawn with CSS, so they aren't copied). */
  lineNumbers?: boolean;
  /** Number of the first line. Line ranges use these displayed numbers. */
  startLine?: number;
  /** Lines to highlight: `[3, [7, 9], '12-14']`. */
  highlightLines?: readonly SyntaxLineRange[];
  /** Lines shown as added (green, `+`) … */
  addedLines?: readonly SyntaxLineRange[];
  /** … and removed (red, `−`). Either one adds a diff-sign column. */
  removedLines?: readonly SyntaxLineRange[];
  /** Soft-wrap long lines instead of scrolling sideways. */
  wrap?: boolean;
  /** Cap the height; the block scrolls past it. */
  maxHeight?: number | string;
  /** Extra attributes per line (e.g. `id` anchors, `onClick`, `data-*`). */
  lineProps?: (line: number) => HTMLAttributes<HTMLSpanElement> | undefined;
  /** `false` renders plain text and never lexes. */
  highlight?: boolean;
  /** `auto` (default: GPU on a hardware adapter, else the fallback at once), `gpu` (gpu-lexer even on a software
      adapter) or `fallback` — see `useSyntaxTokens`. */
  engine?: SyntaxEngine;
}

// Long files render in blocks the browser can skip while off screen (content-visibility), so layout and paint
// scale with what is visible rather than with the file.
const CHUNK = 200;

export function SyntaxHighlightingContent({
  code: codeProp, language: languageProp, lineNumbers = false, startLine = 1, highlightLines, addedLines, removedLines,
  wrap = false, maxHeight, lineProps, highlight = true, engine, className, style, tabIndex, ...props
}: SyntaxHighlightingContentProps) {
  const ctx = useContext(SyntaxHighlightingContext);
  const code = codeProp ?? ctx?.code ?? '';
  const language = languageProp ?? ctx?.language;
  const eng = engine ?? ctx?.engine;
  const { lines, highlighter } = useSyntaxTokens(code, { language, enabled: highlight, engine: eng });

  const hlKey = JSON.stringify([highlightLines ?? null, addedLines ?? null, removedLines ?? null]);
  const marks = useMemo(() => {
    const [h, a, r] = JSON.parse(hlKey) as (SyntaxLineRange[] | null)[];
    return { hl: lineSet(h), add: lineSet(a), del: lineSet(r) };
  }, [hlKey]);
  const diff = marks.add.size > 0 || marks.del.size > 0;
  const lastLine = startLine + lines.length - 1;

  const chunks: [number, number][] = [];
  if (lines.length > CHUNK * 2) for (let i = 0; i < lines.length; i += CHUNK) chunks.push([i, Math.min(lines.length, i + CHUNK)]);

  return (
    <pre
      data-slot="syntax-highlighting-content"
      data-highlighter={highlighter}
      data-engine={eng && eng !== 'auto' ? eng : undefined}
      data-language={language}
      data-wrap={wrap || undefined}
      data-line-numbers={lineNumbers || undefined}
      data-diff={diff || undefined}
      // A scrollable region must be reachable by keyboard.
      tabIndex={tabIndex ?? 0}
      aria-label={props['aria-label'] ?? (typeof ctx?.title === 'string' ? ctx.title : language ? `${language} code` : 'Code')}
      className={cn('bl-syntax-pre bl-scroll', className)}
      style={{
        maxHeight,
        '--bl-syntax-gutter-digits': String(String(lastLine).length),
        ...style,
      } as CSSProperties}
      {...props}
    >
      <code className="bl-syntax-code">
        {chunks.length ? (
          chunks.map(([from, to]) => (
            <span key={from} className="bl-syntax-chunk" style={{ containIntrinsicBlockSize: `auto calc(${to - from} * 1lh)` }}>
              <Lines lines={lines} from={from} to={to} startLine={startLine} lineNumbers={lineNumbers} marks={marks} lineProps={lineProps} />
            </span>
          ))
        ) : (
          <Lines lines={lines} from={0} to={lines.length} startLine={startLine} lineNumbers={lineNumbers} marks={marks} lineProps={lineProps} />
        )}
      </code>
    </pre>
  );
}

const Lines = memo(function Lines({ lines, from, to, startLine, lineNumbers, marks, lineProps }: {
  lines: SyntaxToken[][]; from: number; to: number; startLine: number; lineNumbers: boolean;
  marks: { hl: Set<number>; add: Set<number>; del: Set<number> };
  lineProps?: (line: number) => HTMLAttributes<HTMLSpanElement> | undefined;
}) {
  const out: ReactNode[] = [];
  for (let i = from; i < to; i++) {
    const n = startLine + i;
    const extra = lineProps?.(n);
    out.push(
      <span
        key={i}
        {...extra}
        className={cn('bl-syntax-line', extra?.className)}
        data-line={n}
        data-highlighted={marks.hl.has(n) || undefined}
        data-diff={marks.add.has(n) ? 'add' : marks.del.has(n) ? 'del' : undefined}
      >
        {lineNumbers ? <span className="bl-syntax-ln" data-n={n} aria-hidden="true" /> : null}
        <span className="bl-syntax-lc">
          <SyntaxTokens tokens={lines[i]} />
          {i < lines.length - 1 ? '\n' : null}
        </span>
      </span>,
    );
  }
  return <>{out}</>;
});

/* ── Header, title, copy ── */

export function SyntaxHighlightingHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="syntax-highlighting-header" className={cn('bl-syntax-header', className)} {...props} />;
}

export function SyntaxHighlightingTitle({ className, children, ...props }: ComponentProps<'span'>) {
  const ctx = useContext(SyntaxHighlightingContext);
  return (
    <span data-slot="syntax-highlighting-title" className={cn('bl-syntax-title', className)} {...props}>
      {children ?? ctx?.title}
    </span>
  );
}

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export interface SyntaxHighlightingCopyButtonProps extends Omit<AriaButtonProps, 'children'> {
  /** Text to copy. Defaults to the enclosing SyntaxHighlighting's `code`. */
  value?: string;
  /** Accessible name. */
  label?: string;
  onCopy?: (value: string) => void;
  children?: ReactNode;
}

export function SyntaxHighlightingCopyButton({ value, label = 'Copy code', onCopy, className, children, ...props }: SyntaxHighlightingCopyButtonProps) {
  const ctx = useContext(SyntaxHighlightingContext);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const text = value ?? ctx?.code ?? '';
  return (
    <>
      <AriaButton
        data-slot="syntax-highlighting-copy"
        data-copied={copied || undefined}
        aria-label={copied ? 'Copied' : label}
        {...props}
        className={composeRenderProps(className, (c) => cn('bl-syntax-copy', c))}
        onPress={async (e) => {
          props.onPress?.(e);
          if (await writeClipboard(text)) {
            onCopy?.(text);
            setCopied(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 1600);
          }
        }}
      >
        {children ?? (
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {copied ? (
              <path d="m3 8.5 3.2 3.2L13 4.8" />
            ) : (
              <>
                <rect x="5.2" y="5.2" width="8.6" height="8.6" rx="1.6" />
                <path d="M10.8 5.2V3.6c0-1-.8-1.8-1.8-1.8H3.6c-1 0-1.8.8-1.8 1.8V9c0 1 .8 1.8 1.8 1.8h1.6" />
              </>
            )}
          </svg>
        )}
      </AriaButton>
      <span role="status" className="bl-syntax-sr">{copied ? 'Copied to clipboard' : ''}</span>
    </>
  );
}

/* ── Root ── */

export interface SyntaxHighlightingProps
  extends Omit<ComponentProps<'div'>, 'title'>,
    Omit<SyntaxHighlightingContentProps, 'className' | 'style' | 'code' | 'title' | keyof ComponentProps<'pre'>>,
    VariantProps<typeof syntaxHighlightingVariants> {
  code: string;
  /** Language id (`ts`, `tsx`, `json`, `css`, `bash`, `diff`, …). Shown in the header; `text` disables lexing.
      gpu-lexer detects the language on its own. */
  language?: string;
  /** Header title, usually a filename. */
  title?: ReactNode;
  /** Show a copy button (in the header, or floating top-right when there is no title). */
  showCopy?: boolean;
  /** Force the token palette to light or dark. Defaults to the ambient AppearanceProvider, else the color scheme. */
  appearance?: 'light' | 'dark';
  /** Class for the inner `<pre>`. */
  contentClassName?: string;
}

/** A highlighted code block (or inline `<code>` span). With children it is a root for the parts:
    `SyntaxHighlightingHeader`, `SyntaxHighlightingTitle`, `SyntaxHighlightingCopyButton`, `SyntaxHighlightingContent`. */
export function SyntaxHighlighting({
  code, language, title, showCopy = false, variant, appearance, className, contentClassName, style, children,
  lineNumbers, startLine, highlightLines, addedLines, removedLines, wrap, maxHeight, lineProps, highlight, engine,
  ...props
}: SyntaxHighlightingProps) {
  const ambient = useAppearance();
  const scheme = appearance ?? ambient;
  const v: Variant = variant ?? 'default';
  const ctx = useMemo(() => ({ code, language, variant: v, title, engine }), [code, language, v, title, engine]);

  if (v === 'inline') return <InlineCode code={code} language={language} scheme={scheme} className={className} style={style} highlight={highlight} engine={engine} {...props} />;

  return (
    <SyntaxHighlightingContext.Provider value={ctx}>
      <div
        data-slot="syntax-highlighting"
        data-variant={v}
        data-language={language}
        className={cn(syntaxHighlightingVariants({ variant: v }), scheme === 'dark' ? 'scheme-dark' : scheme === 'light' ? 'scheme-light' : null, className)}
        style={style}
        {...props}
      >
        {children ?? (
          <>
            {title != null ? (
              <SyntaxHighlightingHeader>
                <SyntaxHighlightingTitle />
                {showCopy ? <SyntaxHighlightingCopyButton /> : null}
              </SyntaxHighlightingHeader>
            ) : showCopy ? (
              <SyntaxHighlightingCopyButton className="bl-syntax-copy-float" />
            ) : null}
            <SyntaxHighlightingContent
              className={contentClassName}
              lineNumbers={lineNumbers} startLine={startLine} highlightLines={highlightLines} addedLines={addedLines}
              removedLines={removedLines} wrap={wrap} maxHeight={maxHeight} lineProps={lineProps} highlight={highlight}
              engine={engine}
            />
          </>
        )}
      </div>
    </SyntaxHighlightingContext.Provider>
  );
}

function InlineCode({ code, language, scheme, className, highlight, engine, ...props }: ComponentProps<'code'> & {
  code: string; language?: string; scheme?: string; highlight?: boolean; engine?: SyntaxEngine;
}) {
  const { lines, highlighter } = useSyntaxTokens(code, { language, enabled: highlight, engine });
  return (
    <code
      data-slot="syntax-highlighting"
      data-variant="inline"
      data-language={language}
      data-highlighter={highlighter}
      data-engine={engine && engine !== 'auto' ? engine : undefined}
      className={cn(syntaxHighlightingVariants({ variant: 'inline' }), scheme === 'dark' ? 'scheme-dark' : scheme === 'light' ? 'scheme-light' : null, className)}
      {...props}
    >
      {lines.map((l, i) => (
        <span key={i}>
          {i ? '\n' : null}
          <SyntaxTokens tokens={l} />
        </span>
      ))}
    </code>
  );
}

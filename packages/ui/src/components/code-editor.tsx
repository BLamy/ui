'use client';
import {
  createContext, memo, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState,
  type CSSProperties, type ComponentProps, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode, type Ref, type RefObject,
} from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  CodeEditorWindow, codeEditorGutterCellVariants, codeEditorLineVariants,
  type CodeEditorCopy, type CodeEditorGutter, type CodeEditorGutterClickDetails, type CodeEditorHandle, type CodeEditorLineDecoration, type CodeEditorMarker,
  type CodeEditorPosition, type CodeEditorScrollOptions, type CodeEditorScrollTarget, type CodeEditorSelection, type CodeEditorSelectionChangeDetails,
  type CodeEditorValueChangeDetails,
} from '@/lib/code-editor-window';
import { CodeDocument, CodeHistory, caretAt } from '@/lib/code-document';
import { clipTokens, lineSet, tooBigForPage, type CodeHighlight, type CodeLineRange, type CodeSelection } from '@/lib/code-editor-model';
import {
  codeTokenClass, lexSyntax, peekSyntax, fallbackResult, tokenizeLines, webgpuSupported,
  type CodeToken, type SyntaxEngine, type SyntaxHighlighter, type SyntaxResult,
} from '@/lib/syntax';
import { PLAIN_LANGUAGES } from '@/lib/syntax-lexer';
import { prefersReducedMotion } from '@/lib/reduced-motion';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';
import { useAppearance } from '@/lib/theme';
import { useCopy } from '@/lib/use-copy';
import { cn, cx } from '@/lib/utils';

/* ══ CodeEditor — one component and one API, with two renderers, because two things need opposite things from the DOM ══
   In the page: every character is really there. Inline in a sentence, as tall as its content, the browser's own selection and
   find, and rendered on a server. Plain text first in its exact layout; token colors swap in when the shared GPU lexer answers.
   Docs, Markdown and chat are this.

   Windowed (lib/code-editor-window.tsx): only what's on screen is there, so it stays smooth on a megabyte line or half a million
   lines, with gutters, a current line, markers, and editing. It has its own selection, and find only sees what's rendered.

   Windowed when it's editable, when a prop only that renderer can honor is used, or when the text is too big for the page
   (`tooBigForPage`, whose limits come from timing it). In the page otherwise. `windowed` overrides that where it can. Both draw
   tokens with the same `bl-tok-*` classes, reading `--bl-syntax-*`. ══ */

export type {
  CodeEditorChangeReason, CodeEditorCopy, CodeEditorEdit, CodeEditorGutter, CodeEditorGutterClickDetails, CodeEditorHandle, CodeEditorLineDecoration,
  CodeEditorMarker, CodeEditorMarkerClickDetails, CodeEditorPosition, CodeEditorScrollOptions, CodeEditorScrollTarget, CodeEditorSelection,
  CodeEditorSelectionChangeDetails, CodeEditorSelectionChangeReason, CodeEditorValueChangeDetails,
} from '@/lib/code-editor-window';
export { codeEditorGutterCellVariants, codeEditorLineVariants };
export type { CodeEditorAlign, CodeHighlight, CodeHighlightContext, CodeLineRange } from '@/lib/code-editor-model';

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
  lines: CodeToken[][];
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
    off ? null : forced ? fallbackResult(src, language) : peekSyntax(src, engine, language) ?? (webgpuSupported(engine) ? null : fallbackResult(src, language));
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
      keep(fallbackResult(code, language));
      return;
    }
    let live = true;
    const hit = peekSyntax(code, engine, language);
    if (hit) keep(hit);
    else void lexSyntax(code, engine, language).then((r) => { if (live) keep(r); });
    return () => { live = false; };
  }, [code, off, forced, engine, language]);

  const spans = result?.spans ?? null;
  const lines = useMemo(() => tokenizeLines(code, spans), [code, spans]);
  return { lines, highlighter: off ? 'none' : result && !partial ? result.highlighter : 'pending' };
}

/* ── Tokens ── */

/** One line's tokens as spans with `bl-tok-<type>` classes (plain text stays a text node). */
export function SyntaxTokens({ tokens }: { tokens: readonly CodeToken[] }) {
  return (
    <>
      {tokens.map((t, i) => {
        const className = codeTokenClass(t);
        return className ? <span key={i} className={className}>{t.text}</span> : t.text;
      })}
    </>
  );
}

/* ── Variants ── */

export const codeEditorVariants = cva('bl-syntax', {
  variants: {
    variant: {
      /** A card: hairline border, rounded, its own surface. */
      default: 'bl-syntax-card',
      /** No chrome: sits on whatever surface it's placed on. */
      plain: 'bl-syntax-plain',
      /** A `<code>` span in running text. */
      inline: 'bl-syntax-inline',
    },
  },
  defaultVariants: { variant: 'default' },
});

type Variant = NonNullable<VariantProps<typeof codeEditorVariants>['variant']>;

const schemeClass = (scheme: string | undefined) => (scheme === 'dark' ? 'scheme-dark' : scheme === 'light' ? 'scheme-light' : null);

/* ── Context ── */

/** What the display parts take: the same on `CodeEditor` and `CodeEditorContent`. */
export interface CodeEditorDisplayProps {
  /** A line-number gutter. Windowed, it can go next to the code (`true`, `end`) or first (`start`). Shown by default in an editor and
      for `lines` or `getLine`, and not for a read-only text. */
  lineNumbers?: boolean | 'start' | 'end';
  /** Number of the first line. Line numbers everywhere (`highlightLines`, `currentLine`, the ref…) use these displayed numbers. */
  startLine?: number;
  /** Lines to highlight: `[3, [7, 9], '12-14']`. */
  highlightLines?: readonly CodeLineRange[];
  /** Lines shown as added (green, `+`) … */
  addedLines?: readonly CodeLineRange[];
  /** … and removed (red, `−`). Either one adds a diff-sign column. */
  removedLines?: readonly CodeLineRange[];
  /** Soft-wrap long lines instead of scrolling sideways. */
  wrap?: boolean;
  /** Cap the height; it scrolls past it. */
  maxHeight?: number | string;
  /** Extra attributes per line (e.g. `id` anchors, `onClick`, `data-*`). Windowed, for the lines on screen. */
  lineProps?: (line: number) => HTMLAttributes<HTMLElement> | undefined;
  /** `false` or `null` renders plain text and never lexes. A function labels the text itself, and means windowed. */
  highlight?: boolean | CodeHighlight | null;
  /** `auto` (default: GPU on a hardware adapter, else the fallback at once), `gpu` (gpu-lexer even on a software adapter) or
      `fallback`: see `useSyntaxTokens`. Windowed, the labels come from a small lexer that can resume anywhere, unless this is `gpu`. */
  engine?: SyntaxEngine;
  /** Cells between tab stops (default 2). */
  tabSize?: number;
  /** Height of a line in px (default 20 windowed, 1.6 times the font in the page). */
  lineHeight?: number;
}

interface CodeEditorContextValue {
  /** The text right now. On a huge document this takes a while. */
  getValue: () => string;
  language?: string;
  variant: Variant;
  title?: ReactNode;
  engine?: SyntaxEngine;
  /** The renderer `CodeEditor` chose, and what it needs. */
  windowed: boolean;
  handle: RefObject<CodeEditorHandle | null>;
  display: CodeEditorDisplayProps;
  windowProps: Partial<ComponentProps<typeof CodeEditorWindow>>;
  pageLabel?: string;
}
const CodeEditorContext = createContext<CodeEditorContextValue | null>(null);

/** The enclosing CodeEditor: `getValue()`, `language`, `variant`, `title` and `engine`. `null` outside one. */
export function useCodeEditor() {
  const ctx = useContext(CodeEditorContext);
  return useMemo(() => (ctx ? { getValue: ctx.getValue, language: ctx.language, variant: ctx.variant, title: ctx.title, engine: ctx.engine } : null), [ctx]);
}

/* ── In the page ── */

// Long files render in blocks the browser can skip while off screen (content-visibility), so layout and paint
// scale with what is visible rather than with the file.
const CHUNK = 200;

/** The ref's answers for text in the page, which is all the browser's: positions are worked out from its own selection. */
function usePageHandle(handleRef: Ref<CodeEditorHandle | null> | undefined, preRef: RefObject<HTMLPreElement | null>, text: string) {
  useImperativeHandle(handleRef, () => {
    const pointOf = (node: Node | null, offset: number): CodeEditorPosition | null => {
      const element = node instanceof Element ? node : node?.parentElement;
      const line = element?.closest<HTMLElement>('.bl-syntax-line');
      const content = line?.querySelector('.bl-syntax-lc');
      if (!node || !line || !content || !preRef.current?.contains(line)) return null;
      const range = document.createRange();
      range.selectNodeContents(content);
      range.setEnd(node, offset);
      return { line: Number(line.dataset.line), column: range.toString().length };
    };
    const nodeAt = ({ line, column }: CodeEditorPosition): [Node, number] | null => {
      const content = preRef.current?.querySelector(`.bl-syntax-line[data-line="${line}"] .bl-syntax-lc`);
      if (!content) return null;
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
      let left = column;
      let last: Node = content;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        last = node;
        const length = node.textContent?.length ?? 0;
        if (left <= length) return [node, left];
        left -= length;
      }
      return [last, last === content ? 0 : last.textContent?.length ?? 0];
    };
    return {
      scrollToLine: (line, { align = 'center', smooth }: CodeEditorScrollOptions = {}) => {
        const element = preRef.current?.querySelector(`.bl-syntax-line[data-line="${line}"]`);
        element?.scrollIntoView({ block: align, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
      },
      getSelection: () => {
        const native = window.getSelection();
        if (!native || native.isCollapsed) return null;
        const anchor = pointOf(native.anchorNode, native.anchorOffset);
        const focus = pointOf(native.focusNode, native.focusOffset);
        return anchor && focus ? { anchor, focus } : null;
      },
      getSelectionText: () => {
        const native = window.getSelection();
        if (!native || !preRef.current?.contains(native.anchorNode) || !preRef.current.contains(native.focusNode)) return '';
        return native.toString();
      },
      setSelection: (selection) => {
        const native = window.getSelection();
        if (!native) return;
        native.removeAllRanges();
        const anchor = selection && nodeAt(selection.anchor);
        const focus = selection && nodeAt(selection.focus);
        if (!anchor || !focus) return;
        native.setBaseAndExtent(anchor[0], anchor[1], focus[0], focus[1]);
      },
      selectAll: () => {
        const native = window.getSelection();
        if (!native || !preRef.current) return;
        const range = document.createRange();
        range.selectNodeContents(preRef.current);
        native.removeAllRanges();
        native.addRange(range);
      },
      focus: () => preRef.current?.focus({ preventScroll: true }),
      getValue: () => text,
    };
  }, [preRef, text]);
}

function PageContent({
  text, language, display, engine, label, handleRef, className, style, tabIndex, ...props
}: Omit<ComponentProps<'pre'>, 'children'> & {
  text: string; language?: string; display: CodeEditorDisplayProps; engine?: SyntaxEngine; label: string; handleRef?: Ref<CodeEditorHandle | null>;
}) {
  const { lineNumbers = false, startLine = 1, highlightLines, addedLines, removedLines, wrap = false, maxHeight, lineProps, highlight = true, tabSize, lineHeight } = display;
  const preRef = useRef<HTMLPreElement>(null);
  usePageHandle(handleRef, preRef, text);
  const { lines, highlighter } = useSyntaxTokens(text, { language, enabled: highlight !== false && highlight !== null, engine });

  const hlKey = JSON.stringify([highlightLines ?? null, addedLines ?? null, removedLines ?? null]);
  const marks = useMemo(() => {
    const [h, a, r] = JSON.parse(hlKey) as (CodeLineRange[] | null)[];
    return { hl: lineSet(h), add: lineSet(a), del: lineSet(r) };
  }, [hlKey]);
  const diff = marks.add.size > 0 || marks.del.size > 0;
  const lastLine = startLine + lines.length - 1;

  const chunks: [number, number][] = [];
  if (lines.length > CHUNK * 2) for (let i = 0; i < lines.length; i += CHUNK) chunks.push([i, Math.min(lines.length, i + CHUNK)]);

  return (
    <pre
      ref={preRef}
      data-slot="code-editor-content"
      data-highlighter={highlighter}
      data-engine={engine && engine !== 'auto' ? engine : undefined}
      data-language={language}
      data-wrap={wrap || undefined}
      data-line-numbers={!!lineNumbers || undefined}
      data-diff={diff || undefined}
      // A scrollable region must be reachable by keyboard, and what it reaches is named: the editor's name.
      role="region"
      tabIndex={tabIndex ?? 0}
      aria-label={label}
      className={cn('bl-syntax-pre bl-scroll', className)}
      style={{
        maxHeight,
        '--bl-syntax-gutter-digits': String(String(lastLine).length),
        ...(tabSize === undefined ? null : { '--bl-syntax-tab-size': String(tabSize) }),
        ...(lineHeight === undefined ? null : { '--bl-syntax-line-height': `${lineHeight}px` }),
        ...style,
      } as CSSProperties}
      {...props}
    >
      <code className="bl-syntax-code">
        {chunks.length ? (
          chunks.map(([from, to]) => (
            <span key={from} className="bl-syntax-chunk" style={{ containIntrinsicBlockSize: `auto calc(${to - from} * 1lh)` }}>
              <Lines lines={lines} from={from} to={to} startLine={startLine} lineNumbers={!!lineNumbers} marks={marks} lineProps={lineProps} />
            </span>
          ))
        ) : (
          <Lines lines={lines} from={0} to={lines.length} startLine={startLine} lineNumbers={!!lineNumbers} marks={marks} lineProps={lineProps} />
        )}
      </code>
    </pre>
  );
}

const Lines = memo(function Lines({ lines, from, to, startLine, lineNumbers, marks, lineProps }: {
  lines: CodeToken[][]; from: number; to: number; startLine: number; lineNumbers: boolean;
  marks: { hl: Set<number>; add: Set<number>; del: Set<number> };
  lineProps?: (line: number) => HTMLAttributes<HTMLElement> | undefined;
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

/* ── Content ── */

export interface CodeEditorContentProps extends CodeEditorDisplayProps, Omit<ComponentProps<'pre'>, 'children'> {
  /** Outside a CodeEditor, or in place of its text in the page. */
  value?: string;
  language?: string;
}

/** The code itself: the `<pre>`, or the windowed view. With children, `CodeEditor` is a root for this and the other parts. */
export function CodeEditorContent({
  value, language: languageProp, lineNumbers, startLine, highlightLines, addedLines, removedLines, wrap, maxHeight, lineProps, highlight, engine, tabSize, lineHeight,
  className, style, 'aria-label': ariaLabel, ...props
}: CodeEditorContentProps) {
  const ctx = useContext(CodeEditorContext);
  const inherited = ctx?.display;
  const display: CodeEditorDisplayProps = {
    lineNumbers: lineNumbers ?? inherited?.lineNumbers,
    startLine: startLine ?? inherited?.startLine,
    highlightLines: highlightLines ?? inherited?.highlightLines,
    addedLines: addedLines ?? inherited?.addedLines,
    removedLines: removedLines ?? inherited?.removedLines,
    wrap: wrap ?? inherited?.wrap,
    maxHeight: maxHeight ?? inherited?.maxHeight,
    lineProps: lineProps ?? inherited?.lineProps,
    highlight: highlight ?? inherited?.highlight,
    tabSize: tabSize ?? inherited?.tabSize,
    lineHeight: lineHeight ?? inherited?.lineHeight,
    engine: engine ?? inherited?.engine,
  };
  const language = languageProp ?? ctx?.language;
  const eng = engine ?? ctx?.engine;
  if (ctx?.windowed) {
    return (
      <CodeEditorWindow
        {...ctx.windowProps}
        {...(display as Partial<ComponentProps<typeof CodeEditorWindow>>)}
        language={language}
        engine={eng}
        handleRef={ctx.handle}
        className={className}
        style={style}
        aria-label={ariaLabel ?? ctx.windowProps['aria-label']}
      />
    );
  }
  return (
    <PageContent
      text={value ?? ctx?.getValue() ?? ''}
      language={language}
      display={display}
      engine={eng}
      label={ariaLabel ?? ctx?.windowProps['aria-label'] ?? (language ? `${language} code` : 'Code')}
      handleRef={ctx?.handle}
      className={className}
      style={style}
      {...props}
    />
  );
}

/* ── Header, title, copy ── */

export function CodeEditorHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="code-editor-header" className={cn('bl-syntax-header', className)} {...props} />;
}

export function CodeEditorTitle({ className, children, ...props }: ComponentProps<'span'>) {
  const ctx = useContext(CodeEditorContext);
  return (
    <span data-slot="code-editor-title" className={cn('bl-syntax-title', className)} {...props}>
      {children ?? ctx?.title}
    </span>
  );
}

/** The clipboard, with the old `execCommand('copy')` way where the async API is missing or refused (an insecure origin,
    some embedded frames). Throws when neither worked, so `useCopy` reports it as not copied. */
async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) throw new Error('Copy was blocked');
  }
}

export interface CodeEditorCopyButtonProps extends Omit<ComponentProps<typeof Button>, 'children' | 'onCopy'> {
  /** Text to copy. Defaults to the enclosing CodeEditor's text, as it is when it's pressed. */
  value?: string;
  /** The text went to the clipboard. */
  onValueCopy?: (value: string) => void;
  /** In place of the copy / check glyph. */
  children?: ReactNode;
}

/** The kit's quiet 28px icon Button (44px to a finger) that copies the editor's text with `useCopy`, and says so: a check,
    "Copied", and the announcer. Named "Copy code" unless you pass an `aria-label`. */
export function CodeEditorCopyButton({ value, onValueCopy, variant = 'quiet', size = 'icon-sm', className, children, 'aria-label': ariaLabel = 'Copy code', ...props }: CodeEditorCopyButtonProps) {
  const ctx = useContext(CodeEditorContext);
  const { copy, copied } = useCopy({ write: writeClipboard, announcement: 'Copied to clipboard' });
  return (
    <Button
      data-slot="code-editor-copy-button"
      data-copied={copied ? '' : undefined}
      aria-label={copied ? 'Copied' : ariaLabel}
      variant={variant}
      size={size}
      {...props}
      className={cx(
        "relative flex-none data-copied:text-success pointer-coarse:after:absolute pointer-coarse:after:-inset-2 pointer-coarse:after:content-['']",
        className,
      )}
      onClick={async (e, details) => {
        props.onClick?.(e, details);
        const text = value ?? ctx?.getValue() ?? '';
        if (await copy(text)) onValueCopy?.(text);
      }}
    >
      {children ?? <Icon name={copied ? 'check' : 'copy'} size={15} />}
    </Button>
  );
}

/* ── Root ── */

/** Line numbers you can press, like a debugger's "run to here". */
export interface CodeEditorLineNumbers {
  /** Which side of the code the gutter is on (windowed). Default `end`: next to the code. */
  side?: 'start' | 'end';
  /** Makes the numbers buttons. `details.line` is the line pressed. */
  onClick?: (event: MouseEvent<HTMLElement>, details: CodeEditorGutterClickDetails) => void;
  /** The lines whose number can be pressed (default: all, once `onClick` is set). */
  clickable?: (lineNumber: number) => boolean;
  /** A number's accessible name (default `Line N`). */
  label?: (lineNumber: number) => string;
  /** A number's tooltip. */
  title?: (lineNumber: number) => string | undefined;
}

interface CodeEditorCommonProps extends Omit<CodeEditorDisplayProps, 'lineNumbers'>, Omit<ComponentProps<'div'>, 'children' | 'ref' | 'onChange' | 'defaultValue' | 'title' | 'onCopy' | 'onSelect'> {
  ref?: Ref<CodeEditorHandle>;
  /** With children it is a root for the parts: `CodeEditorHeader`, `CodeEditorTitle`, `CodeEditorCopyButton`, `CodeEditorContent`. */
  children?: ReactNode;
  /** Language id (`ts`, `tsx`, `json`, `css`, `bash`, `diff`, …). Shown in `data-language`; `text` turns highlighting off.
      gpu-lexer detects the language on its own. */
  language?: string;
  /** Header title, usually a filename. */
  title?: ReactNode;
  /** The one shorthand for a part: a `CodeEditorCopyButton` in the header, or floating top-right when there is no title. Compose
      the parts yourself for anything else. */
  showCopy?: boolean;
  /** The token palette's color scheme. `auto` (default) follows the ambient AppearanceProvider, else the page's color
      scheme; `light` or `dark` forces one. */
  appearance?: 'auto' | 'light' | 'dark';
  /** A line-number gutter: `true`, a side (`start` / `end`, windowed), or an object whose `onClick` makes the numbers buttons
      (windowed). Shown by default in an editor and for `lines` or `getLine`, and not for a read-only text. */
  lineNumbers?: boolean | 'start' | 'end' | CodeEditorLineNumbers;
  /** Beside the code, in this order. They stay put when the code scrolls sideways. */
  gutters?: readonly CodeEditorGutter[];
  /** The line execution is on: a band, and with `currentColumn`, a mark in the line. */
  currentLine?: number | null;
  currentColumn?: number | null;
  /** Keep `currentLine` in view when it changes (default). `{ smooth: true }` animates it. */
  revealCurrentLine?: boolean | { smooth?: boolean };
  /** Tints and classes by line. Called for rows on screen, so it can be a lookup; it can return a new object every time. */
  lineDecoration?: (lineNumber: number) => CodeEditorLineDecoration | null | undefined;
  /** Things to press at a column of a line, like a column-level breakpoint. An array, or a function for a line's markers
      when there are many of them. Only those in the part of the line that's rendered are in the DOM. */
  markers?: readonly CodeEditorMarker[] | ((lineNumber: number) => readonly CodeEditorMarker[] | null | undefined);
  /** Brings this line into view when it changes: a line, or a line with options. (The ref's `scrollToLine()` does it once.) */
  revealLine?: number | CodeEditorScrollTarget | null;
  /** The widest line in cells, if you know it: saves a pass over the file to find the scrollable width. */
  maxLineLength?: number;
  /** Copying a selection, with the text that's going on the clipboard. */
  onCopyText?: (copy: CodeEditorCopy) => void;
  /** The selection as it changes, with why. In an editor, the caret is a selection with both ends at the same place. */
  onSelectionChange?: (selection: CodeEditorSelection | null, details: CodeEditorSelectionChangeDetails) => void;
}

/** A change is reported as `onValueChange(value, details)`, which joins the whole text, or as `onEdit(details)`, which doesn't,
    for a document too big to join on every key. */
type EditableProps = {
  readOnly?: false;
  variant?: 'default' | 'plain';
  /** Editing needs the windowed renderer. */
  windowed?: true;
  lines?: never;
  lineCount?: never;
  getLine?: never;
  contentKey?: never;
  onEdit?: (details: CodeEditorValueChangeDetails) => void;
} & (
  | { value: string; defaultValue?: never; onValueChange: (value: string, details: CodeEditorValueChangeDetails) => void }
  | { value?: never; defaultValue?: string; onValueChange?: (value: string, details: CodeEditorValueChangeDetails) => void }
);

interface ReadOnlyBase {
  onValueChange?: never;
  onEdit?: never;
}

/** A read-only text, in the page if it fits. */
type ReadOnlyTextProps = ReadOnlyBase & {
  readOnly: true;
  value?: string;
  defaultValue?: string;
  variant?: Variant;
  /** `true` for the windowed renderer whatever the size, `false` for in the page whatever the size (it can't do what's only windowed). */
  windowed?: boolean;
  lines?: never;
  lineCount?: never;
  getLine?: never;
  contentKey?: never;
};

/** Inline code: always read-only. */
type InlineProps = ReadOnlyBase & {
  variant: 'inline';
  readOnly?: boolean;
  value?: string;
  defaultValue?: string;
  windowed?: false;
  lines?: never;
  lineCount?: never;
  getLine?: never;
  contentKey?: never;
};

/** Read-only lines: always windowed. */
type ReadOnlyLinesProps = ReadOnlyBase & {
  readOnly: true;
  variant?: 'default' | 'plain';
  windowed?: true;
  value?: never;
  defaultValue?: never;
} & (
  | {
    /** The source, a line to an entry. */
    lines: readonly string[];
    lineCount?: never;
    getLine?: never;
    contentKey?: never;
  }
  | {
    lines?: never;
    lineCount: number;
    /** A line by index, from 0. Only called for what's on screen, and by a pass over the file in the background. */
    getLine: (index: number) => string;
    /** Changes when what `getLine` returns does. Without it a new `getLine` function means new content, so keep it stable. */
    contentKey?: unknown;
  }
);

export type CodeEditorProps = CodeEditorCommonProps & (EditableProps | ReadOnlyTextProps | ReadOnlyLinesProps | InlineProps);

/** Everything `CodeEditorProps` allows, without the rules about what goes with what: those are for the caller. */
type LooseProps = CodeEditorCommonProps & {
  value?: string;
  defaultValue?: string;
  readOnly?: boolean;
  variant?: Variant;
  windowed?: boolean;
  onValueChange?: (value: string, details: CodeEditorValueChangeDetails) => void;
  onEdit?: (details: CodeEditorValueChangeDetails) => void;
  lines?: readonly string[];
  lineCount?: number;
  getLine?: (index: number) => string;
  contentKey?: unknown;
};

/** The space a card leaves above and below the code, as in the page. */
const CARD_PADDING = 12;

function InlineCode({ code, language, scheme, className, highlight, engine, handleRef, ...props }: ComponentProps<'code'> & {
  code: string; language?: string; scheme?: string; highlight?: boolean; engine?: SyntaxEngine; handleRef?: Ref<CodeEditorHandle>;
}) {
  const { lines, highlighter } = useSyntaxTokens(code, { language, enabled: highlight, engine });
  const element = useRef<HTMLElement>(null);
  useImperativeHandle(handleRef, () => ({
    scrollToLine: () => element.current?.scrollIntoView({ block: 'nearest' }),
    getSelection: () => null,
    getSelectionText: () => '',
    setSelection: () => {},
    selectAll: () => {
      const native = window.getSelection();
      if (!native || !element.current) return;
      const range = document.createRange();
      range.selectNodeContents(element.current);
      native.removeAllRanges();
      native.addRange(range);
    },
    focus: () => element.current?.focus({ preventScroll: true }),
    getValue: () => code,
  }), [code]);
  return (
    <code
      ref={element}
      data-slot="code-editor"
      data-variant="inline"
      data-language={language}
      data-highlighter={highlighter}
      data-engine={engine && engine !== 'auto' ? engine : undefined}
      className={cn(codeEditorVariants({ variant: 'inline' }), schemeClass(scheme), className)}
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

/** A file is written in the editor with its last line end in place, and a read-only view leaves it off, as a snippet does. */
const withoutLastLineEnd = (text: string) => (text.endsWith('\r\n') ? text.slice(0, -2) : text.endsWith('\n') ? text.slice(0, -1) : text);

/** Code you can edit by default, and read-only code of any shape: a snippet in the page, inline in a sentence, or a source view for
    a debugger with gutters and markers. See the file's header for which renderer you get. */
export function CodeEditor(props: CodeEditorProps) {
  const {
    ref, value, defaultValue, readOnly: readOnlyProp, onValueChange, onEdit, variant, windowed, children, language, title, showCopy = false, appearance,
    className, style, lineNumbers: lineNumbersProp, startLine, highlightLines, addedLines, removedLines, wrap, maxHeight, lineProps, highlight, engine, tabSize, lineHeight,
    lines, lineCount, getLine, contentKey, gutters, currentLine, currentColumn, revealCurrentLine,
    lineDecoration, markers, revealLine, maxLineLength, onCopyText, onSelectionChange, onKeyDown, onContextMenu, 'aria-label': ariaLabel,
    ...rest
  } = props as LooseProps;
  const pressable = typeof lineNumbersProp === 'object' && lineNumbersProp ? lineNumbersProp : null;
  const lineNumbers = pressable ? (pressable.side ?? true) : (lineNumbersProp as Exclude<typeof lineNumbersProp, CodeEditorLineNumbers>);
  const onLineNumberClick = pressable?.onClick;

  const ambient = useAppearance();
  const scheme = appearance === undefined || appearance === 'auto' ? ambient : appearance;
  const v: Variant = variant ?? 'default';
  const lineSource = !!lines || !!getLine;
  const readOnly = !!readOnlyProp || v === 'inline' || lineSource;

  /* An editor keeps its text, its undo history and its caret here, across a remount of what draws them. */
  const session = useRef<{ document: CodeDocument; history: CodeHistory; selection: { current: CodeSelection } } | null>(null);
  if (!readOnly && !session.current) {
    session.current = {
      document: new CodeDocument(value ?? defaultValue ?? ''),
      history: new CodeHistory(),
      selection: { current: caretAt({ line: 0, offset: 0 }) },
    };
  }
  const firstDefault = useRef(defaultValue);
  const text = readOnly
    ? (value ?? (session.current ? session.current.document.getText() : firstDefault.current ?? ''))
    : '';

  const viewerOnly = lineSource || !!gutters || currentLine != null || !!markers || !!lineDecoration || revealLine != null || typeof highlight === 'function'
    || !!onLineNumberClick || !!onCopyText || !!onSelectionChange || maxLineLength !== undefined;
  const tooBig = useMemo(() => readOnly && !lineSource && v !== 'inline' && windowed === undefined && !viewerOnly && tooBigForPage(text), [readOnly, lineSource, v, windowed, viewerOnly, text]);
  const useWindow = v !== 'inline' && (!readOnly || lineSource || (windowed ?? (viewerOnly || tooBig)));

  /* A read-only text that fits the page, drawn windowed (a source view, `windowed`), takes its colors from the page's own
     lexing of the whole text, so the same source looks the same in either renderer. An editor keeps the resumable lexer:
     its text changes on every key, and a whole-text pass per key is what that lexer exists to avoid. */
  const shareTokens = useWindow && readOnly && !lineSource && (highlight === undefined || highlight === true) && engine !== 'gpu';
  const fitsPage = useMemo(() => shareTokens && !tooBigForPage(text), [shareTokens, text]);
  const { lines: pageLines, highlighter: pageHighlighter } = useSyntaxTokens(fitsPage ? withoutLastLineEnd(text) : '', { language, enabled: fitsPage, engine });
  // Until the page's lexing answers (a GPU round trip), the resumable lexer colors it, so it is never plain.
  const sharing = fitsPage && pageHighlighter !== 'pending';
  const sharedHighlight = useMemo<CodeHighlight | undefined>(
    () => (sharing ? (piece, lineIndex, { offset }) => clipTokens(pageLines[lineIndex] ?? [], 0, offset, offset + piece.length) : undefined),
    [sharing, pageLines],
  );

  // A read-only text in the windowed renderer is a document that's replaced when the text changes, not edited.
  const readOnlyDocument = useMemo(
    () => (useWindow && readOnly && !lineSource ? new CodeDocument(withoutLastLineEnd(text)) : null),
    [useWindow, readOnly, lineSource, text],
  );

  const handle = useRef<CodeEditorHandle | null>(null);

  // A read-only text is what the host gave it, whichever renderer has it, down to a last line end neither of them shows.
  const getValue = useCallback(() => {
    if (readOnly && !lineSource) return text;
    return handle.current?.getValue() ?? session.current?.document.getText() ?? '';
  }, [readOnly, lineSource, text]);
  const getValueRef = useRef(getValue);
  getValueRef.current = getValue;

  useImperativeHandle(ref, () => ({
    scrollToLine: (line, options) => handle.current?.scrollToLine(line, options),
    getSelection: () => handle.current?.getSelection() ?? null,
    getSelectionText: () => handle.current?.getSelectionText() ?? '',
    setSelection: (selection) => handle.current?.setSelection(selection),
    selectAll: () => handle.current?.selectAll(),
    focus: () => handle.current?.focus(),
    getValue: () => getValueRef.current(),
  }), []);

  const editorSession = !readOnly ? session.current : null;

  const defaultLineNumbers = !readOnly || lineSource;
  const ctx: CodeEditorContextValue = {
    getValue,
    language,
    variant: v,
    title,
    engine,
    windowed: useWindow,
    handle,
    display: {
      lineNumbers: lineNumbers ?? defaultLineNumbers, startLine, highlightLines, addedLines, removedLines, wrap, maxHeight, lineProps,
      highlight: sharedHighlight ?? highlight, engine, tabSize, lineHeight,
    },
    windowProps: {
      lines, lineCount, getLine, contentKey,
      document: editorSession?.document ?? readOnlyDocument,
      editable: !readOnly,
      history: editorSession?.history ?? null,
      selectionStore: editorSession?.selection,
      value: readOnly ? undefined : value,
      onValueChange: readOnly ? undefined : onValueChange,
      onEdit: readOnly ? undefined : onEdit,
      gutters, onLineNumberClick, lineNumberClickable: pressable?.clickable, lineNumberLabel: pressable?.label, lineNumberTitle: pressable?.title,
      currentLine, currentColumn, revealCurrentLine,
      lineDecoration, markers, scrollToLine: revealLine, maxLineLength, onCopyText, onSelectionChange,
      paddingY: v === 'plain' ? 0 : CARD_PADDING,
      onKeyDown: onKeyDown as ((event: KeyboardEvent<HTMLDivElement>) => void) | undefined,
      onContextMenu: onContextMenu as ((event: MouseEvent<HTMLDivElement>) => void) | undefined,
      'aria-label': ariaLabel ?? (typeof title === 'string' ? title : undefined),
    },
  };

  if (v === 'inline') {
    return (
      <InlineCode
        code={text} language={language} scheme={scheme} className={className} style={style} engine={engine} handleRef={handle}
        highlight={highlight !== false && highlight !== null} aria-label={ariaLabel} {...(rest as ComponentProps<'code'>)}
      />
    );
  }

  return (
    <CodeEditorContext.Provider value={ctx}>
      <div
        data-slot="code-editor"
        data-variant={v}
        data-language={language}
        data-windowed={useWindow || undefined}
        className={cn(
          codeEditorVariants({ variant: v }),
          // A cap means as tall as the text, up to the cap, not as tall as the parent.
          useWindow && 'flex min-h-0 w-full flex-col',
          useWindow && maxHeight === undefined && 'h-full',
          // An editor's ring is its hidden input's focus.
          useWindow && v === 'default' && 'has-[[data-slot=code-editor-input]:focus]:ring-2 has-[[data-slot=code-editor-input]:focus]:ring-ring',
          schemeClass(scheme),
          className,
        )}
        style={style}
        onKeyDown={useWindow ? undefined : onKeyDown}
        onContextMenu={useWindow ? undefined : onContextMenu}
        {...rest}
      >
        {children ?? (
          <>
            {title != null ? (
              <CodeEditorHeader>
                <CodeEditorTitle />
                {showCopy ? <CodeEditorCopyButton /> : null}
              </CodeEditorHeader>
            ) : showCopy ? (
              <CodeEditorCopyButton className="bl-syntax-copy-float" />
            ) : null}
            <CodeEditorContent />
          </>
        )}
      </div>
    </CodeEditorContext.Provider>
  );
}

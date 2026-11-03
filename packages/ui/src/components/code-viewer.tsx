'use client';
import {
  Fragment, memo, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore,
  type ClipboardEvent, type ComponentProps, type CSSProperties, type KeyboardEvent, type MouseEvent,
  type PointerEvent as ReactPointerEvent, type ReactNode, type Ref,
} from 'react';
import { flushSync } from 'react-dom';
import { Button as AriaButton } from 'react-aria-components';
import { cva } from 'class-variance-authority';
import {
  CodeLexer, CodeTokenStore, DEFAULT_TAB_SIZE, LineCache, LineScanner, alignedScroll, comparePositions, displayPieces,
  extendSelection, hostProducer, identityRowMap, isCollapsed, lexerProducer, markersInRange, movePosition, nextCellWindow, nextRowWindow,
  orderedSelection, originOf, physicalSize, revealScroll, selectionCells, selectionText, toPhysicalScroll, toVirtualScroll,
  visibleCells, visibleRows, wordAt, wrapRowMap, wrappedSpan,
  type CodeHighlight, type CodePosition, type CodeSelection, type CodeToken, type CodeViewerAlign, type DisplayPiece, type LineMetrics,
  type LineSource, type RowMap, type SelectionGranularity, type SelectionKey, type Span,
} from '@/lib/code-viewer';
import { cn } from '@/lib/utils';

/* ══ CodeViewer — a read-only source view for files of any shape ══
   A megabyte on one line and half a million lines both scroll like twenty lines do, because neither is ever in the DOM:
   a monospace line is a grid of cells (lib/code-viewer.ts), so what's on screen is arithmetic, and only that is rendered.

   The element that scrolls holds an empty box the size of the whole file, and a viewport stuck to its corner. Rows and
   their text sit in layers inside the viewport with small coordinates; scrolling writes one transform per layer. So the
   gutters don't move sideways, because they're not in the layer that does, and there are no huge numbers for a browser
   to lose precision in.

   Selection is the viewer's own: two positions in the document, drawn on the rows and copied from the source. The browser's
   can't work here, since most of what you'd select doesn't exist. ══ */

export type { CodeHighlight, CodeHighlightContext, CodeToken, CodeTokenType, CodeViewerAlign } from '@/lib/code-viewer';

const PROBE = '0'.repeat(128);
/** Space between the gutter and the first character. */
const CODE_PADDING = 10;
/** Room past the end of the longest line. */
const END_PADDING = 24;
/** Rows and cells in the DOM are placed relative to a multiple of these. */
const ORIGIN_ROWS = 4096;
const ORIGIN_CELLS = 8192;
/** A viewer with no height of its own, in a parent with none, must not render every line. */
const MAX_VIEW_HEIGHT = 8192;
const COPY_PROXY_LENGTH = 4096;
const LONG_PRESS_MS = 450;
const TOUCH_SLOP = 8;
const DOUBLE_CLICK_MS = 450;
const REVEAL_MARGIN = 30;

const SELECTION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
const FOCUSABLE = ':is(button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex])';
const CONTROL_SELECTOR = `[data-code-viewer-cell]${FOCUSABLE},[data-code-viewer-cell] ${FOCUSABLE}`;

/* ── Variants ── */

/** The band behind a line, across gutters and code. */
export const codeViewerLineVariants = cva('pointer-events-none absolute inset-x-0 h-(--code-viewer-line)', {
  variants: {
    tint: {
      none: '',
      /** The line a debugger is stopped on. */
      current: 'bg-primary/15 shadow-[inset_3px_0_var(--primary)]',
      /** A line that matters without being current: a selected frame, the last line to run. */
      info: 'bg-primary/10 shadow-[inset_3px_0_color-mix(in_srgb,var(--primary)_45%,transparent)]',
      success: 'bg-success/15',
      warning: 'bg-warning/15',
      danger: 'bg-destructive/15',
      muted: 'bg-secondary',
    },
  },
  defaultVariants: { tint: 'none' },
});

export const codeViewerGutterCellVariants = cva('box-border flex h-full shrink-0 items-center overflow-hidden', {
  variants: {
    align: { start: 'justify-start', center: 'justify-center', end: 'justify-end' },
  },
  defaultVariants: { align: 'center' },
});

const MARKER_CLASS =
  'absolute top-0 z-10 flex h-full w-3.5 -translate-x-1/2 cursor-pointer items-start justify-center border-0 bg-transparent p-0 outline-none data-focus-visible:rounded-sm data-focus-visible:ring-2 data-focus-visible:ring-ring';

/* ── Types ── */

export interface CodeViewerGutter {
  id: string;
  /** Width in px. */
  width: number;
  /** A cell's contents: anything. Interactive things in it take part in the gutter's keyboard navigation. */
  render: (lineNumber: number) => ReactNode;
  /** Makes the cell a button. */
  onPress?: (lineNumber: number) => void;
  /** Whether this line's cell can be pressed (default: all of them, given `onPress`). */
  isPressable?: (lineNumber: number) => boolean;
  /** The button's accessible name (default: the gutter's id and the line). */
  label?: (lineNumber: number) => string;
  title?: (lineNumber: number) => string | undefined;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export interface CodeViewerLineDecoration {
  /** A band behind the line, across gutters and code. */
  tint?: 'current' | 'info' | 'success' | 'warning' | 'danger' | 'muted';
  /** On the band: a tint of your own. */
  className?: string;
  /** On the row of code: dim a line that never ran. */
  textClassName?: string;
  /** On the line's gutter cells. */
  gutterClassName?: string;
}

export interface CodeViewerMarker {
  /** Only used in the flat form of `markers`. */
  line?: number;
  /** UTF-16 code units from the start of the line, from 0. */
  column: number;
  /** Its accessible name. */
  label: string;
  /** Makes it a button. */
  onPress?: (marker: CodeViewerMarker) => void;
  /** Filled in, and announced as pressed. */
  isActive?: boolean;
  title?: string;
  className?: string;
  /** Replaces the default dot. */
  children?: ReactNode;
}

export interface CodeViewerScrollOptions {
  /** Where the line ends up in the view (default `center`). */
  align?: CodeViewerAlign;
  /** Scroll sideways to this column too. */
  column?: number;
  /** Animate. Reduced motion wins. */
  smooth?: boolean;
}

export interface CodeViewerScrollTarget extends CodeViewerScrollOptions {
  line: number;
}

/** A position in the viewer's API: `line` from 1, `column` in UTF-16 code units from 0. */
export interface CodeViewerPosition {
  line: number;
  column: number;
}

export interface CodeViewerSelection {
  anchor: CodeViewerPosition;
  focus: CodeViewerPosition;
}

export interface CodeViewerCopy {
  text: string;
  /** The selection was longer than a clipboard should be asked to take, and this is the start of it. */
  truncated: boolean;
}

export interface CodeViewerHandle {
  /** Brings a line into view. `line` is from 1. */
  scrollToLine: (line: number, options?: CodeViewerScrollOptions) => void;
  getSelection: () => CodeViewerSelection | null;
  /** The selected text, from the source, however much of it is on screen. */
  getSelectionText: () => string;
  setSelection: (selection: CodeViewerSelection | null) => void;
  selectAll: () => void;
  focus: () => void;
}

export interface CodeViewerProps extends Omit<ComponentProps<'div'>, 'children' | 'ref' | 'onCopy' | 'onSelect'> {
  ref?: Ref<CodeViewerHandle>;
  /** The source, a line to an entry. Or use `lineCount` and `getLine`. */
  lines?: readonly string[];
  lineCount?: number;
  /** A line by index, from 0. Only called for what's on screen, and by a pass over the file in the background (see
      `maxLineLength`). */
  getLine?: (index: number) => string;
  /** Changes when what `getLine` returns does. Without it a new `getLine` function means new content, so keep it stable. */
  contentKey?: unknown;
  /** Beside the code, in this order. They stay put when the code scrolls sideways. */
  gutters?: readonly CodeViewerGutter[];
  /** The built-in line number gutter: next to the code (`true`, `end`), first (`start`), or none. */
  lineNumbers?: boolean | 'start' | 'end';
  onLineNumberPress?: (lineNumber: number) => void;
  isLineNumberPressable?: (lineNumber: number) => boolean;
  lineNumberLabel?: (lineNumber: number) => string;
  lineNumberTitle?: (lineNumber: number) => string | undefined;
  /** The line execution is on, from 1: a band, and with `currentColumn`, a mark in the line. */
  currentLine?: number | null;
  currentColumn?: number | null;
  /** Keep `currentLine` in view when it changes (default). `{ smooth: true }` animates it. */
  revealCurrentLine?: boolean | { smooth?: boolean };
  /** Tints and classes by line. Called for rows on screen, so it can be a lookup; it can return a new object every time. */
  lineDecoration?: (lineNumber: number) => CodeViewerLineDecoration | null | undefined;
  /** Things to press at a column of a line, like a column-level breakpoint. An array, or a function for a line's markers
      when there are many of them. Only those in the part of the line that's rendered are in the DOM. */
  markers?: readonly CodeViewerMarker[] | ((lineNumber: number) => readonly CodeViewerMarker[] | null | undefined);
  /** Scrolls here when this changes. A line, or a line with options. */
  scrollToLine?: number | CodeViewerScrollTarget | null;
  /** Labels the text. By default a small lexer for C-family and script languages labels it here, at once. `null` turns
      highlighting off. See the docs for gpu-lexer. */
  highlight?: CodeHighlight | null;
  /** Soft-wrap at the width of the view, breaking at the last column that fits, not between words. */
  wrap?: boolean;
  /** Cells between tab stops (default 2). */
  tabSize?: number;
  /** Height of a row in px (default 20). */
  lineHeight?: number;
  /** The widest line in cells, if you know it: saves a pass over the file to find the scrollable width. */
  maxLineLength?: number;
  /** Copying a selection, with the text that's going on the clipboard. */
  onCopyText?: (copy: CodeViewerCopy) => void;
  onSelectionChange?: (selection: CodeViewerSelection | null) => void;
}

/* ── Rows ── */

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

const noStore = { subscribe: () => () => {}, version: () => 0 };

function renderPieces(pieces: readonly DisplayPiece[]): ReactNode {
  return pieces.map((piece, i) => {
    if (typeof piece === 'string') return piece;
    const style = { width: `calc(var(--code-viewer-cell) * ${piece.cells})` };
    if (piece.rtl) return <span key={i} dir="rtl" className="inline-block text-center [unicode-bidi:isolate]" style={style}>{piece.text}</span>;
    return <span key={i} className={cn('inline-block text-center', piece.control && 'text-tertiary-foreground')} style={style}>{piece.text}</span>;
  });
}

const tokenClass = (token: CodeToken) => {
  const type = token.type && token.type !== 'plain' ? `bl-tok bl-tok-${token.type}` : '';
  return token.className ? (type ? `${type} ${token.className}` : token.className) : type;
};

/** A window of a line, labelled. The text always comes from the line: a token only says how far it reaches. */
function renderTokens(metrics: LineMetrics, tokens: readonly CodeToken[], start: number, end: number): ReactNode {
  const { text, plain } = metrics;
  const out: ReactNode[] = [];
  let at = start;
  const cut = (offset: number) => {
    if (plain || offset >= end) return Math.min(offset, end);
    // A token ending inside a cluster takes the rest of it: the grid has no way to draw half of one.
    const boundary = metrics.offsetAt(metrics.cellAt(offset));
    return boundary === offset ? offset : metrics.after(boundary);
  };
  for (let i = 0; i < tokens.length && at < end; i++) {
    const next = cut(at + tokens[i].text.length);
    if (next <= at) continue;
    const content = plain ? text.slice(at, next) : renderPieces(displayPieces(metrics, at, next));
    const className = tokenClass(tokens[i]);
    out.push(className ? <span key={i} className={className}>{content}</span> : plain ? content : <Fragment key={i}>{content}</Fragment>);
    at = next;
  }
  if (at < end) out.push(plain ? text.slice(at, end) : renderPieces(displayPieces(metrics, at, end)));
  return out;
}

const CodeRowText = memo(function CodeRowText({ cache, store, line, start, end, left }: {
  cache: LineCache;
  store: CodeTokenStore | null;
  line: number;
  start: number;
  end: number;
  left: number;
}) {
  const source = store ?? noStore;
  useSyncExternalStore(source.subscribe, () => source.version(line), () => 0);
  if (start >= end) return null;
  const metrics = cache.get(line);
  const tokens = store ? store.read(line, metrics.text, start, end) : null;
  return (
    <span data-slot="code-viewer-text" className="absolute top-0 whitespace-pre" style={{ left }}>
      {tokens
        ? renderTokens(metrics, tokens, start, end)
        : metrics.plain
          ? metrics.text.slice(start, end)
          : renderPieces(displayPieces(metrics, start, end))}
    </span>
  );
});

interface CodeRowProps {
  cache: LineCache;
  store: CodeTokenStore | null;
  row: number;
  rowCount: number;
  line: number;
  top: number;
  start: number;
  end: number;
  left: number;
  selectionLeft: number;
  selectionWidth: number;
  columnLeft: number;
  textClassName?: string;
  markers: readonly (CodeViewerMarker & { left: number })[] | null;
  onFocusLine: (line: number) => void;
  onBlurLine: (line: number) => void;
}

const CodeRow = memo(function CodeRow({
  cache, store, row, rowCount, line, top, start, end, left, selectionLeft, selectionWidth, columnLeft, textClassName, markers,
  onFocusLine, onBlurLine,
}: CodeRowProps) {
  return (
    <div
      role="listitem"
      aria-posinset={row + 1}
      aria-setsize={rowCount}
      data-slot="code-viewer-line"
      data-row={row}
      data-line={line + 1}
      className={cn('absolute left-0 h-(--code-viewer-line) w-full [contain:layout_style]', textClassName)}
      style={{ top }}
      onFocus={markers ? () => onFocusLine(line) : undefined}
      onBlur={markers ? () => onBlurLine(line) : undefined}
    >
      {selectionWidth > 0 ? (
        <div
          data-slot="code-viewer-selection"
          className="absolute top-0 h-full bg-muted-foreground/25 group-focus-within/code-viewer:bg-primary/25"
          style={{ left: selectionLeft, width: selectionWidth }}
        />
      ) : null}
      <CodeRowText cache={cache} store={store} line={line} start={start} end={end} left={left} />
      {columnLeft >= 0 ? (
        <div data-slot="code-viewer-column" className="absolute top-0.5 bottom-0.5 w-0.5 -translate-x-1/2 rounded-full bg-primary" style={{ left: columnLeft }} />
      ) : null}
      {markers?.map((marker, i) => <Marker key={`${marker.column}:${i}`} marker={marker} />)}
    </div>
  );
}, (a, b) => {
  for (const key of Object.keys(a) as (keyof CodeRowProps)[]) {
    if (key !== 'markers' && !Object.is(a[key], b[key])) return false;
  }
  const m = a.markers;
  const n = b.markers;
  if (m === n) return true;
  if (!m || !n || m.length !== n.length) return false;
  return m.every((marker, i) => marker === n[i] || (
    marker.column === n[i].column && marker.left === n[i].left && marker.label === n[i].label && marker.isActive === n[i].isActive &&
    marker.onPress === n[i].onPress && marker.className === n[i].className && marker.children === n[i].children && marker.title === n[i].title
  ));
});

/** react-aria's Button drops `title`, so it goes on through `render`. */
const titled = (title: string | undefined) =>
  title ? { render: (props: ComponentProps<'button'>) => <button {...props} title={title} /> } : null;

function Marker({ marker }: { marker: CodeViewerMarker & { left: number } }) {
  // A notch over the column, in the space above the letters, so it doesn't cover what it points at.
  const dot = marker.children ?? (
    <svg
      aria-hidden="true"
      viewBox="0 0 8 5"
      className={cn(
        'mt-0.5 block h-[5px] w-2 fill-current',
        marker.isActive ? 'text-primary' : 'text-muted-foreground/50 group-data-hovered/marker:text-primary/70',
      )}
    >
      <path d="M0 0h8L4 5z" />
    </svg>
  );
  if (!marker.onPress) {
    return (
      <span
        data-code-viewer-cell="marker"
        data-slot="code-viewer-marker"
        data-active={marker.isActive || undefined}
        role="img"
        aria-label={marker.label}
        title={marker.title}
        className={cn(MARKER_CLASS, 'pointer-events-none', marker.className)}
        style={{ left: marker.left }}
      >
        {dot}
      </span>
    );
  }
  return (
    <AriaButton
      data-code-viewer-cell="marker"
      data-slot="code-viewer-marker"
      data-active={marker.isActive || undefined}
      aria-label={marker.label}
      aria-pressed={marker.isActive === undefined ? undefined : marker.isActive}
      onPress={() => marker.onPress?.(marker)}
      className={cn('group/marker', MARKER_CLASS, marker.className)}
      style={{ left: marker.left }}
      {...titled(marker.title)}
    >
      {dot}
    </AriaButton>
  );
}

function GutterCell({ gutter, lineNumber, gutterClassName }: { gutter: CodeViewerGutter; lineNumber: number; gutterClassName?: string }) {
  const pressable = !!gutter.onPress && (gutter.isPressable?.(lineNumber) ?? true);
  const content = gutter.render(lineNumber);
  const className = cn(codeViewerGutterCellVariants({ align: gutter.align }), gutter.className, gutterClassName);
  const style = { width: gutter.width } satisfies CSSProperties;
  const title = gutter.title?.(lineNumber);
  if (!pressable) {
    return (
      <div data-code-viewer-cell={gutter.id} data-slot="code-viewer-gutter-cell" data-gutter={gutter.id} title={title} className={className} style={style}>
        {content}
      </div>
    );
  }
  return (
    <AriaButton
      data-code-viewer-cell={gutter.id}
      data-slot="code-viewer-gutter-cell"
      data-gutter={gutter.id}
      aria-label={gutter.label?.(lineNumber) ?? `${gutter.id}, line ${lineNumber}`}
      onPress={() => gutter.onPress?.(lineNumber)}
      className={cn('cursor-pointer border-0 bg-transparent p-0 [font-family:inherit] outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-inset data-hovered:bg-secondary data-pressed:bg-secondary-strong', className)}
      style={style}
      {...titled(title)}
    >
      {content}
    </AriaButton>
  );
}

const GutterRow = memo(function GutterRow({ row, line, top, gutters, current, gutterClassName, onFocusLine, onBlurLine }: {
  row: number;
  line: number;
  top: number;
  gutters: readonly CodeViewerGutter[];
  current: boolean;
  gutterClassName?: string;
  onFocusLine: (line: number) => void;
  onBlurLine: (line: number) => void;
}) {
  return (
    <div
      data-slot="code-viewer-gutter-row"
      data-row={row}
      data-line={line + 1}
      data-current={current || undefined}
      className="group/gutter absolute left-0 flex h-(--code-viewer-line)"
      style={{ top }}
      onFocus={() => onFocusLine(line)}
      onBlur={() => onBlurLine(line)}
    >
      {gutters.map((gutter) => <GutterCell key={gutter.id} gutter={gutter} lineNumber={line + 1} gutterClassName={gutterClassName} />)}
    </div>
  );
});

/* ── Selection helpers ── */

const isMac = () => typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

const toPublic = (p: CodePosition): CodeViewerPosition => ({ line: p.line + 1, column: p.offset });

function isEditable(el: Element) {
  const name = el.tagName;
  return name === 'INPUT' || name === 'TEXTAREA' || name === 'SELECT' || (el as HTMLElement).isContentEditable;
}

/* ── CodeViewer ── */

interface ViewWindow {
  rows: Span;
  cells: Span;
  originRow: number;
  originCell: number;
}

interface Geometry {
  width: number;
  height: number;
  codeWidth: number;
  gutterWidth: number;
  cellWidth: number;
  lineHeight: number;
  map: RowMap;
  wrap: boolean;
  cols: number;
  /** Scrollable size, as if browsers had no limit on an element's size. */
  virtualWidth: number;
  virtualHeight: number;
}

interface Drag {
  pointerId: number;
  /** What was selected when the drag started: a point, a word or a line. */
  base: CodeSelection;
  granularity: SelectionGranularity;
  x: number;
  y: number;
  frame: number;
  touch: boolean;
}

export function CodeViewer({
  ref, lines, lineCount, getLine, contentKey, gutters: gutterProp, lineNumbers = true, onLineNumberPress, isLineNumberPressable,
  lineNumberLabel, lineNumberTitle, currentLine, currentColumn, revealCurrentLine = true, lineDecoration, markers, scrollToLine, highlight, wrap = false,
  tabSize = DEFAULT_TAB_SIZE, lineHeight = 20, maxLineLength, onCopyText, onSelectionChange, className, style, onKeyDown, onContextMenu,
  'aria-label': ariaLabel, ...props
}: CodeViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const yLayerRef = useRef<HTMLDivElement>(null);
  const xyLayerRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const proxyRef = useRef<HTMLSpanElement>(null);

  /* The source. A new `getLine` isn't new content when `contentKey` says otherwise. */
  const getLineRef = useRef(getLine);
  getLineRef.current = getLine;
  const contentIdentity = lines ?? (contentKey !== undefined ? contentKey : getLine);
  const source = useMemo<LineSource>(() => {
    if (lines) return { count: lines.length, get: (i) => lines[i] ?? '' };
    return { count: lineCount ?? 0, get: (i) => getLineRef.current?.(i) ?? '' };
    // `contentIdentity` is what says the content changed.
  }, [contentIdentity, lines, lineCount]);
  const cache = useMemo(() => new LineCache(source, tabSize), [source, tabSize]);

  /* Highlighting. */
  const storeRef = useRef<CodeTokenStore | null>(null);
  const lexing = useRef(false);
  const usesLexer = highlight === undefined;
  const lexer = useMemo(
    () => (usesLexer ? new CodeLexer({ lineCount: source.count, getLine: source.get, onInvalidate: (from, to) => storeRef.current?.invalidate(from, to) }) : null),
    [source, usesLexer],
  );
  const store = useMemo(() => {
    const produce = lexer ? lexerProducer(lexer) : highlight ? hostProducer(highlight) : null;
    if (!produce) return null;
    return new CodeTokenStore({
      produce,
      getText: (line) => cache.text(line),
      schedule: (run) => { requestAnimationFrame(run); },
    });
  }, [lexer, highlight, cache]);
  storeRef.current = store;

  // `data-highlighter` is `pending` while what's on screen may still change color, as on SyntaxHighlighting: visual
  // regression waits on it.
  const showHighlighter = useCallback(() => {
    const root = rootRef.current;
    const current = storeRef.current;
    if (root) root.dataset.highlighter = !current ? 'none' : current.pending || lexing.current ? 'pending' : usesLexer ? 'lexer' : 'custom';
  }, [usesLexer]);
  useLayoutEffect(() => store?.subscribe(showHighlighter), [store, showHighlighter]);

  /* Measurements. */
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [cellWidth, setCellWidth] = useState(7.8);

  useLayoutEffect(() => {
    const root = rootRef.current as HTMLDivElement;
    const probe = probeRef.current as HTMLSpanElement;
    const read = () => {
      const width = root.clientWidth;
      const height = root.clientHeight;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
      const cell = probe.getBoundingClientRect().width / PROBE.length;
      if (cell > 0) setCellWidth(cell);
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(root);
    observer.observe(probe);
    return () => observer.disconnect();
  }, []);

  /* The widest line, and with wrapping on, how many rows each line takes: a pass over the file, in slices. */
  const [, render] = useReducer((n: number) => n + 1, 0);
  const seenCells = useRef(0);
  const scannerRef = useRef<LineScanner | null>(null);
  const [scanVersion, setScanVersion] = useState(0);

  useLayoutEffect(() => {
    seenCells.current = maxLineLength ?? 0;
    render();
    const scanner = wrap || maxLineLength === undefined ? new LineScanner(source, tabSize, wrap) : null;
    scannerRef.current = scanner;
    let timer: ReturnType<typeof setTimeout> | undefined;
    lexing.current = !!lexer;
    const step = (budget: number) => {
      const end = performance.now() + budget;
      const deadline = () => performance.now() > end;
      lexing.current = lexer ? lexer.scan(deadline) : false;
      const scanning = scanner ? scanner.run(deadline) : false;
      if (scanner) {
        const grew = scanner.maxCells > seenCells.current;
        if (grew) seenCells.current = scanner.maxCells;
        // With wrapping on, every slice can move rows. Off, only the scrollbar's size can change.
        if (wrap || grew) setScanVersion((v) => v + 1);
      }
      if (lexing.current || scanning) timer = setTimeout(() => step(4), 16);
      showHighlighter();
    };
    step(8);
    return () => clearTimeout(timer);
  }, [source, tabSize, wrap, maxLineLength, lexer]);

  /* Gutters, with the line numbers in their place. */
  const digits = String(Math.max(1, source.count)).length;
  const lineNumberWidth = Math.ceil(digits * cellWidth) + 16;
  const lineNumberGutter = useMemo<CodeViewerGutter | null>(() => {
    if (lineNumbers === false) return null;
    return {
      id: 'line-number',
      width: lineNumberWidth,
      align: 'end',
      className: 'pr-2 pl-1 text-caption text-tertiary-foreground group-data-current/gutter:text-foreground data-rac:text-muted-foreground data-hovered:text-foreground',
      render: (lineNumber) => <span aria-hidden="true">{lineNumber}</span>,
      onPress: onLineNumberPress,
      isPressable: isLineNumberPressable,
      label: lineNumberLabel ?? ((lineNumber) => `Line ${lineNumber}`),
      title: lineNumberTitle,
    };
  }, [lineNumbers, lineNumberWidth, onLineNumberPress, isLineNumberPressable, lineNumberLabel, lineNumberTitle]);
  const gutters = useMemo<readonly CodeViewerGutter[]>(() => {
    const list = gutterProp ?? [];
    if (!lineNumberGutter) return list;
    return lineNumbers === 'start' ? [lineNumberGutter, ...list] : [...list, lineNumberGutter];
  }, [gutterProp, lineNumberGutter, lineNumbers]);
  const gutterWidth = useMemo(() => gutters.reduce((sum, g) => sum + g.width, 0), [gutters]);

  /* Rows. */
  const codeWidth = Math.max(0, size.width - gutterWidth);
  // A cell of slack, for a wide character that starts in the last column.
  const cols = wrap ? Math.max(8, Math.floor((codeWidth - CODE_PADDING - END_PADDING) / cellWidth)) : 0;
  const rowMap = useMemo(
    () => (wrap && scannerRef.current?.cellCounts ? wrapRowMap(scannerRef.current.cellCounts, cols) : identityRowMap(source.count)),
    // `scanVersion` is what says the counts changed.
    [wrap, cols, source, scanVersion],
  );

  /* The window: what's in the DOM. Everything that scrolling touches goes through refs, so that a frame which doesn't
     change what's rendered doesn't go through React at all. */
  const height = Math.min(size.height, MAX_VIEW_HEIGHT);
  const scrollRef = useRef({ x: 0, y: 0 });
  const scrolledDuringDrag = useRef<(() => void) | null>(null);
  const [view, setView] = useState<ViewWindow>(() => ({ rows: { start: 0, end: 0 }, cells: { start: 0, end: 0 }, originRow: 0, originCell: 0 }));
  const viewRef = useRef(view);
  viewRef.current = view;

  const rowCount = rowMap.rowCount;
  const pinnedRef = useRef<number | null>(null);
  const [pinnedLine, setPinnedLine] = useState<number | null>(null);

  // The rows and cells to render. Their widths feed the scrollable width, so that comes after.
  const rows: { row: number; line: number; part: number; metrics: LineMetrics }[] = [];
  const addRow = (row: number) => {
    const { line, part } = rowMap.locate(row);
    const metrics = cache.get(line);
    if (metrics.cells > seenCells.current) seenCells.current = metrics.cells;
    rows.push({ row, line, part, metrics });
  };
  const windowRows = view.rows;
  const pinnedRow = pinnedLine !== null && pinnedLine < source.count ? rowMap.rowOfLine(pinnedLine) : null;
  if (pinnedRow !== null && pinnedRow < windowRows.start) addRow(pinnedRow);
  for (let row = windowRows.start; row < Math.min(windowRows.end, rowCount); row++) addRow(row);
  if (pinnedRow !== null && pinnedRow >= windowRows.end && pinnedRow < rowCount) addRow(pinnedRow);

  const virtualWidth = wrap ? codeWidth : Math.ceil(seenCells.current * cellWidth) + CODE_PADDING + END_PADDING;
  const virtualHeight = rowCount * lineHeight;
  const geometry: Geometry = {
    width: size.width, height, codeWidth, gutterWidth, cellWidth, lineHeight, map: rowMap, wrap, cols, virtualWidth, virtualHeight,
  };
  const geometryRef = useRef(geometry);

  const transforms = useRef({ x: NaN, y: NaN });
  const writeTransforms = useCallback(() => {
    const g = geometryRef.current;
    const { x, y } = scrollRef.current;
    const v = viewRef.current;
    const ratio = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
    const snap = (n: number) => Math.round(n * ratio) / ratio;
    const ty = snap(v.originRow * g.lineHeight - y);
    const tx = snap(v.originCell * g.cellWidth - x);
    const last = transforms.current;
    if (ty === last.y && tx === last.x) return;
    if (ty !== last.y && yLayerRef.current) yLayerRef.current.style.transform = `translate3d(0,${ty}px,0)`;
    if (xyLayerRef.current) xyLayerRef.current.style.transform = `translate3d(${tx}px,${ty}px,0)`;
    last.x = tx;
    last.y = ty;
  }, []);

  /** Reads the scroll position; renders if that changes what's in the DOM. */
  const sync = useCallback((urgent: boolean) => {
    const root = rootRef.current;
    if (!root) return;
    const g = geometryRef.current;
    const y = toVirtualScroll(root.scrollTop, g.virtualHeight, g.height);
    const x = g.wrap ? 0 : toVirtualScroll(root.scrollLeft, g.virtualWidth + g.gutterWidth, g.width);
    scrollRef.current = { x, y };
    const current = viewRef.current;
    const rowsNext = nextRowWindow(current.rows, visibleRows(y, g.height, g.lineHeight, g.map.rowCount), g.map.rowCount);
    const cellsNext = g.wrap
      ? { start: 0, end: 0 }
      : nextCellWindow(current.cells, visibleCells(Math.max(0, x - CODE_PADDING), g.codeWidth, g.cellWidth));
    const sameCells = cellsNext === current.cells || (cellsNext.start === current.cells.start && cellsNext.end === current.cells.end);
    if (rowsNext !== current.rows || !sameCells) {
      const next: ViewWindow = {
        rows: rowsNext,
        cells: sameCells ? current.cells : cellsNext,
        originRow: originOf(rowsNext.start, ORIGIN_ROWS),
        originCell: sameCells ? current.originCell : originOf(cellsNext.start, ORIGIN_CELLS),
      };
      viewRef.current = next;
      if (urgent) flushSync(() => setView(next));
      else setView(next);
    }
    writeTransforms();
  }, [writeTransforms]);

  useLayoutEffect(() => {
    const root = rootRef.current as HTMLDivElement;
    const onScroll = () => {
      sync(true);
      scrolledDuringDrag.current?.();
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [sync]);

  /* Scrolling, by anything that isn't the user. */
  const pendingScroll = useRef<{ x?: number; y?: number; smooth?: boolean } | null>(null);
  const applyPendingScroll = useCallback(() => {
    const target = pendingScroll.current;
    const root = rootRef.current;
    if (!target || !root) return;
    pendingScroll.current = null;
    const g = geometryRef.current;
    const totalWidth = g.virtualWidth + g.gutterWidth;
    const top = target.y === undefined ? undefined : toPhysicalScroll(clamp(target.y, 0, Math.max(0, g.virtualHeight - g.height)), g.virtualHeight, g.height);
    const left = target.x === undefined ? undefined : toPhysicalScroll(clamp(target.x, 0, Math.max(0, totalWidth - g.width)), totalWidth, g.width);
    if (target.smooth && !reducedMotion()) {
      root.scrollTo({ ...(top === undefined ? null : { top }), ...(left === undefined ? null : { left }), behavior: 'smooth' });
    } else {
      if (top !== undefined) root.scrollTop = top;
      if (left !== undefined) root.scrollLeft = left;
      // Not left to the scroll event: from inside a frame, that would be a frame late.
      sync(false);
    }
  }, [sync]);

  const scrollLineIntoView = useCallback((lineNumber: number, options: CodeViewerScrollOptions & { reveal?: boolean } = {}) => {
    const g = geometryRef.current;
    if (!g.height || !source.count) return;
    const line = clamp(lineNumber - 1, 0, source.count - 1);
    const metrics = cache.get(line);
    const { column, align = 'center', smooth, reveal } = options;
    const cell = column == null ? null : metrics.cellAt(column);
    const part = g.wrap && cell !== null ? Math.floor(cell / g.cols) : 0;
    const row = g.map.rowOfLine(line) + part;
    const now = scrollRef.current;
    const position = row * g.lineHeight;
    const y = reveal ? revealScroll(position, g.lineHeight, g.height, now.y, REVEAL_MARGIN) : alignedScroll(position, g.lineHeight, g.height, now.y, align);
    let x: number | undefined;
    if (!g.wrap) {
      if (cell !== null) x = revealScroll(cell * g.cellWidth + CODE_PADDING, g.cellWidth, g.codeWidth, now.x, 24);
      // Scrolled past the end of this line, it would look empty.
      else if (now.x > metrics.cells * g.cellWidth) x = 0;
      if (metrics.cells > seenCells.current) {
        seenCells.current = metrics.cells;
        pendingScroll.current = { x, y, smooth };
        render();
        return;
      }
    }
    if (x === now.x) x = undefined;
    pendingScroll.current = { x, y: y === now.y ? undefined : y, smooth };
    applyPendingScroll();
  }, [source, cache, applyPendingScroll]);

  /* Selection. */
  const [selection, setSelectionState] = useState<CodeSelection | null>(null);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  /** Where the last plain click landed: a shift-click extends from here when nothing is selected. */
  const caretRef = useRef<CodePosition | null>(null);

  const select = useCallback((next: CodeSelection | null) => {
    const value = next && isCollapsed(next) ? null : next;
    const prev = selectionRef.current;
    if (prev === value) return;
    if (prev && value && comparePositions(prev.anchor, value.anchor) === 0 && comparePositions(prev.focus, value.focus) === 0) return;
    selectionRef.current = value;
    setSelectionState(value);
    onSelectionChangeRef.current?.(value ? { anchor: toPublic(value.anchor), focus: toPublic(value.focus) } : null);
  }, []);

  const readLine = useCallback((line: number) => source.get(line) ?? '', [source]);

  // Positions in the old content mean nothing in the new.
  const selectedIn = useRef(source);
  useLayoutEffect(() => {
    if (selectedIn.current === source) return;
    selectedIn.current = source;
    caretRef.current = null;
    select(null);
  }, [source, select]);

  // The browser's own selection has to be somewhere for its copy command to be on offer, in a context menu above all.
  // So it's on a stand-in that holds the start of the text; the copy handler puts the real thing on the clipboard.
  const syncProxy = useCallback(() => {
    const proxy = proxyRef.current;
    const value = selectionRef.current;
    if (!proxy || typeof getSelection === 'undefined') return;
    const native = getSelection();
    if (!native) return;
    if (!value) {
      if (proxy.firstChild && native.anchorNode && proxy.contains(native.anchorNode)) native.removeAllRanges();
      proxy.textContent = '';
      return;
    }
    proxy.textContent = selectionText(value, readLine, COPY_PROXY_LENGTH).text || ' ';
    const range = document.createRange();
    range.selectNodeContents(proxy);
    native.removeAllRanges();
    native.addRange(range);
  }, [readLine]);

  const positionAt = useCallback((clientX: number, clientY: number): CodePosition => {
    const clip = clipRef.current as HTMLDivElement;
    const rect = clip.getBoundingClientRect();
    const g = geometryRef.current;
    const { x, y } = scrollRef.current;
    const row = clamp(Math.floor((clientY - rect.top + y) / g.lineHeight), 0, Math.max(0, g.map.rowCount - 1));
    const { line, part } = g.map.locate(row);
    const metrics = cache.get(line);
    const cell = (clientX - rect.left + x - CODE_PADDING) / g.cellWidth;
    return { line, offset: g.wrap ? metrics.nearest(part * g.cols + clamp(cell, 0, g.cols)) : metrics.nearest(cell) };
  }, [cache]);

  const dragRef = useRef<Drag | null>(null);
  const clicks = useRef({ count: 0, time: 0, x: 0, y: 0 });
  const longPress = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number; pointerId: number } | null>(null);

  const updateDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    select(extendSelection(drag.base, positionAt(drag.x, drag.y), drag.granularity, readLine, source.count));
  }, [positionAt, readLine, select, source]);
  scrolledDuringDrag.current = updateDrag;

  // Dragging past an edge scrolls, faster the further past it the pointer is.
  const autoScroll = useCallback(() => {
    const drag = dragRef.current;
    const clip = clipRef.current;
    const root = rootRef.current;
    if (!drag || !clip || !root) return;
    const rect = clip.getBoundingClientRect();
    const speed = (past: number) => Math.min(4000, past * past / 8 + past / 2 + 1);
    let dy = 0;
    let dx = 0;
    if (drag.y < rect.top) dy = -speed(rect.top - drag.y);
    else if (drag.y > rect.bottom) dy = speed(drag.y - rect.bottom);
    if (drag.x < rect.left) dx = -speed(rect.left - drag.x);
    else if (drag.x > rect.right) dx = speed(drag.x - rect.right);
    if (dy || dx) {
      if (dy) root.scrollTop += dy;
      if (dx) root.scrollLeft += dx;
      sync(true);
      updateDrag();
    }
    drag.frame = requestAnimationFrame(autoScroll);
  }, [sync, updateDrag]);

  const startDrag = useCallback((pointerId: number, x: number, y: number, base: CodeSelection, granularity: SelectionGranularity, touch: boolean) => {
    dragRef.current = { pointerId, base, granularity, x, y, frame: requestAnimationFrame(autoScroll), touch };
    clipRef.current?.setPointerCapture?.(pointerId);
  }, [autoScroll]);

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    cancelAnimationFrame(drag.frame);
    dragRef.current = null;
    syncProxy();
  }, [syncProxy]);

  const selectFrom = (position: CodePosition, granularity: SelectionGranularity): CodeSelection => {
    if (granularity === 'word') {
      const span = wordAt(readLine(position.line), position.offset);
      return { anchor: { line: position.line, offset: span.start }, focus: { line: position.line, offset: span.end } };
    }
    if (granularity === 'line') {
      const last = position.line >= source.count - 1;
      return {
        anchor: { line: position.line, offset: 0 },
        focus: last ? { line: position.line, offset: readLine(position.line).length } : { line: position.line + 1, offset: 0 },
      };
    }
    return { anchor: position, focus: position };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('[data-code-viewer-cell]')) return;
    if (e.pointerType === 'touch') {
      const { pointerId, clientX: x, clientY: y } = e;
      if (longPress.current) clearTimeout(longPress.current.timer);
      longPress.current = {
        pointerId, x, y,
        timer: setTimeout(() => {
          longPress.current = null;
          rootRef.current?.focus({ preventScroll: true });
          const base = selectFrom(positionAt(x, y), 'word');
          select(base);
          startDrag(pointerId, x, y, base, 'word', true);
        }, LONG_PRESS_MS),
      };
      return;
    }
    if (e.button !== 0 || (e.ctrlKey && isMac())) {
      // A right click inside the selection keeps it, for the context menu's Copy.
      const position = positionAt(e.clientX, e.clientY);
      const current = selectionRef.current;
      if (current) {
        const { from, to } = orderedSelection(current);
        if (comparePositions(position, from) < 0 || comparePositions(position, to) > 0) select(null);
      }
      return;
    }
    rootRef.current?.focus({ preventScroll: true });
    const now = performance.now();
    const c = clicks.current;
    const near = Math.abs(e.clientX - c.x) < 4 && Math.abs(e.clientY - c.y) < 4 && now - c.time < DOUBLE_CLICK_MS;
    c.count = near ? c.count % 3 + 1 : 1;
    c.time = now;
    c.x = e.clientX;
    c.y = e.clientY;
    const position = positionAt(e.clientX, e.clientY);
    const current = selectionRef.current;
    const granularity: SelectionGranularity = c.count === 2 ? 'word' : c.count === 3 ? 'line' : 'char';
    const anchor = e.shiftKey ? current?.anchor ?? caretRef.current : null;
    if (anchor) {
      const base = { anchor, focus: anchor };
      select(extendSelection(base, position, 'char', readLine, source.count));
      startDrag(e.pointerId, e.clientX, e.clientY, base, 'char', false);
      return;
    }
    caretRef.current = position;
    const base = selectFrom(position, granularity);
    select(base);
    startDrag(e.pointerId, e.clientX, e.clientY, base, granularity, false);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const press = longPress.current;
    if (press && (Math.abs(e.clientX - press.x) > TOUCH_SLOP || Math.abs(e.clientY - press.y) > TOUCH_SLOP)) {
      clearTimeout(press.timer);
      longPress.current = null;
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    updateDrag();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const press = longPress.current;
    if (press) {
      // A tap: not a long press, and no pan took it over.
      clearTimeout(press.timer);
      longPress.current = null;
      select(null);
      syncProxy();
    }
    if (dragRef.current?.pointerId === e.pointerId) endDrag();
  };

  const onPointerCancel = () => {
    if (longPress.current) clearTimeout(longPress.current.timer);
    longPress.current = null;
    endDrag();
  };

  // While a touch is selecting, moving it mustn't pan. A listener that can cancel has to be attached by hand.
  useLayoutEffect(() => {
    const root = rootRef.current as HTMLDivElement;
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current?.touch && e.cancelable) e.preventDefault();
    };
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => root.removeEventListener('touchmove', onTouchMove);
  }, []);

  const handleCopy = (e: ClipboardEvent<HTMLDivElement>) => {
    const current = selectionRef.current;
    if (!current || !(rootRef.current as HTMLDivElement).contains(e.target as Node) || isEditable(e.target as Element)) return;
    const copied = selectionText(current, readLine);
    e.clipboardData.setData('text/plain', copied.text);
    e.preventDefault();
    onCopyText?.(copied);
  };

  const selectAll = useCallback(() => {
    if (!source.count) return;
    const last = source.count - 1;
    select({ anchor: { line: 0, offset: 0 }, focus: { line: last, offset: readLine(last).length } });
    syncProxy();
  }, [readLine, select, source, syncProxy]);

  /* Keyboard: one tab stop among gutter buttons and markers, arrow keys between them. */
  const activeControl = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef<{ key: string; from: number; direction: 1 | -1; tries: number } | null>(null);

  const rowElements = useCallback((row: number) => {
    const root = rootRef.current as HTMLDivElement;
    return root.querySelectorAll<HTMLElement>(`[data-slot="code-viewer-gutter-row"][data-row="${row}"],[data-slot="code-viewer-line"][data-row="${row}"]`);
  }, []);

  /** The next control with the same key (a gutter's id, or `marker`) going up or down; scrolls if it's past what's rendered. */
  const moveVertically = useCallback((key: string, from: number, direction: 1 | -1, tries: number) => {
    const g = geometryRef.current;
    const v = viewRef.current;
    const selector = `[data-code-viewer-cell="${CSS.escape(key)}"]`;
    const inRow = (row: number) => {
      for (const el of rowElements(row)) {
        const cell = el.querySelector<HTMLElement>(selector);
        const control = cell && (cell.matches(CONTROL_SELECTOR) ? cell : cell.querySelector<HTMLElement>(CONTROL_SELECTOR));
        if (control) return control;
      }
      return null;
    };
    for (let row = from + direction; row >= v.rows.start && row < v.rows.end; row += direction) {
      const control = inRow(row);
      if (control) {
        pendingFocus.current = null;
        control.focus({ preventScroll: true });
        return;
      }
    }
    const edge = direction > 0 ? v.rows.end : v.rows.start - 1;
    const inWindow = from >= v.rows.start && from < v.rows.end;
    if (tries > 64 || (inWindow && (edge < 0 || edge >= g.map.rowCount))) {
      pendingFocus.current = null;
      return;
    }
    // Nothing rendered has one: bring in more rows, and look again when they're there. Focus on a row kept out of view
    // goes back to that row first.
    pendingFocus.current = { key, from: inWindow ? (direction > 0 ? v.rows.end - 1 : v.rows.start) : from, direction, tries: tries + 1 };
    const span = Math.max(1, v.rows.end - v.rows.start) * g.lineHeight;
    pendingScroll.current = { y: inWindow ? scrollRef.current.y + direction * span : alignedScroll(from * g.lineHeight, g.lineHeight, g.height, 0, 'center') };
    applyPendingScroll();
  }, [applyPendingScroll, rowElements]);

  const moveFocus = (target: HTMLElement, key: string) => {
    const owner = target.closest<HTMLElement>('[data-row]');
    if (!owner) return false;
    const row = Number(owner.dataset.row);
    const cellKey = target.closest<HTMLElement>('[data-code-viewer-cell]')?.dataset.codeViewerCell;
    if (!cellKey) return false;
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      moveVertically(cellKey, row, key === 'ArrowDown' ? 1 : -1, 0);
      return true;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const controls: HTMLElement[] = [];
      for (const el of rowElements(row)) controls.push(...el.querySelectorAll<HTMLElement>(CONTROL_SELECTOR));
      const next = controls[controls.indexOf(target) + (key === 'ArrowRight' ? 1 : -1)];
      next?.focus({ preventScroll: true });
      return true;
    }
    return false;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const root = rootRef.current as HTMLDivElement;
    const target = e.target as HTMLElement;
    // Keys from a popover in a gutter cell come through React's tree, not the DOM's.
    if (!root.contains(target) || isEditable(target)) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.altKey && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      selectAll();
    } else if (mod && !e.altKey && e.key.toLowerCase() === 'c') {
      // The browser's copy command follows this keydown, and needs a selection to be there.
      syncProxy();
    } else if (e.key === 'Escape' && selectionRef.current) {
      select(null);
      syncProxy();
    } else if (target !== root && !mod && !e.altKey && target.matches(CONTROL_SELECTOR) && moveFocus(target, e.key)) {
      e.preventDefault();
    } else if (target === root && e.shiftKey && !mod && !e.altKey && SELECTION_KEYS.has(e.key) && source.count) {
      // From the moving end of the selection; or where the last click landed; or the top of the view.
      e.preventDefault();
      const g = geometryRef.current;
      const current = selectionRef.current;
      const from = current?.focus ?? caretRef.current ?? { line: g.map.locate(Math.floor(scrollRef.current.y / g.lineHeight)).line, offset: 0 };
      const anchor = current?.anchor ?? from;
      const focus = movePosition(from, e.key as SelectionKey, (line) => cache.get(line), source.count);
      caretRef.current = anchor;
      select({ anchor, focus });
      syncProxy();
      scrollLineIntoView(focus.line + 1, { column: focus.offset, reveal: true });
    }
  };

  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    onContextMenu?.(e);
    if (selectionRef.current && (rootRef.current as HTMLDivElement).contains(e.target as Node)) syncProxy();
    if (dragRef.current?.touch) e.preventDefault();
    // Once a menu is open, no pointerup is coming.
    else if (dragRef.current) endDrag();
  };

  /* A row with focus stays in the DOM wherever the view goes, or the focus would be lost; focus inside a popover opened
     from a gutter cell counts, since React's focus events reach it through the portal. */
  const unpin = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onFocusLine = useCallback((line: number) => {
    clearTimeout(unpin.current);
    pinnedRef.current = line;
    setPinnedLine(line);
    // A keyboard focus on a row that's out of view brings it in.
    const g = geometryRef.current;
    const row = g.map.rowOfLine(line);
    const position = row * g.lineHeight;
    const { y } = scrollRef.current;
    const active = document.activeElement;
    if ((position < y || position + g.lineHeight > y + g.height) && active?.matches(':focus-visible') && (rootRef.current as HTMLDivElement).contains(active)) {
      pendingScroll.current = { y: alignedScroll(position, g.lineHeight, g.height, y, 'nearest', g.lineHeight) };
      applyPendingScroll();
    }
    // The tab stop goes where the focus went.
    const control = active as HTMLElement | null;
    if (control && control !== activeControl.current && (rootRef.current as HTMLDivElement).contains(control) && control.matches(CONTROL_SELECTOR)) {
      activeControl.current?.setAttribute('tabindex', '-1');
      control.setAttribute('tabindex', '0');
      activeControl.current = control;
    }
  }, [applyPendingScroll]);
  const onBlurLine = useCallback((line: number) => {
    clearTimeout(unpin.current);
    unpin.current = setTimeout(() => {
      if (pinnedRef.current !== line) return;
      pinnedRef.current = null;
      setPinnedLine(null);
    }, 0);
  }, []);

  /* Every commit. */
  const lastRowMap = useRef(rowMap);
  useLayoutEffect(() => {
    if (lastRowMap.current !== rowMap) {
      // Rows moved under the view (the width changed with wrapping on, or the pass over the file got further): whatever
      // was at the top stays at the top.
      const before = geometryRef.current;
      const topRow = Math.floor(scrollRef.current.y / before.lineHeight);
      const within = scrollRef.current.y - topRow * before.lineHeight;
      const { line, part } = lastRowMap.current.locate(topRow);
      lastRowMap.current = rowMap;
      const newPart = geometry.wrap && before.wrap && geometry.cols ? Math.floor((part * before.cols) / geometry.cols) : 0;
      const y = (rowMap.rowOfLine(line) + newPart) * geometry.lineHeight + within;
      if (y !== scrollRef.current.y) pendingScroll.current = { y, ...pendingScroll.current };
    }
    geometryRef.current = geometry;
    sync(false);
    if (pendingScroll.current) applyPendingScroll();

    // Roving tab stop.
    const root = rootRef.current as HTMLDivElement;
    const controls = root.querySelectorAll<HTMLElement>(CONTROL_SELECTOR);
    const first = visibleRows(scrollRef.current.y, geometry.height, geometry.lineHeight, geometry.map.rowCount);
    const inView = (el: HTMLElement) => {
      const row = Number(el.closest<HTMLElement>('[data-row]')?.dataset.row);
      return row >= first.start && row < first.end;
    };
    let active = activeControl.current;
    if (!active || !active.isConnected || (document.activeElement !== active && !inView(active))) {
      active = null;
      for (const el of controls) {
        if (inView(el)) {
          active = el;
          break;
        }
      }
      activeControl.current = active;
    }
    for (const el of controls) {
      const want = el === active ? '0' : '-1';
      if (el.getAttribute('tabindex') !== want) el.setAttribute('tabindex', want);
    }

    const focus = pendingFocus.current;
    if (focus) moveVertically(focus.key, focus.from, focus.direction, focus.tries);

    showHighlighter();
  });

  /* Following along. */
  const revealed = useRef<string | null>(null);
  const revealOptions = typeof revealCurrentLine === 'object' ? revealCurrentLine : null;
  useLayoutEffect(() => {
    if (!height) return;
    const key = currentLine == null ? null : `${currentLine}:${currentColumn ?? ''}`;
    if (key === revealed.current) return;
    revealed.current = key;
    if (currentLine == null || revealCurrentLine === false) return;
    scrollLineIntoView(currentLine, { column: currentColumn ?? undefined, reveal: true, smooth: revealOptions?.smooth });
  }, [currentLine, currentColumn, revealCurrentLine, revealOptions?.smooth, height, scrollLineIntoView]);

  const scrollTarget = scrollToLine == null ? null : typeof scrollToLine === 'number' ? { line: scrollToLine } : scrollToLine;
  const scrolledTo = useRef<string | null>(null);
  const scrollKey = scrollTarget && `${scrollTarget.line}:${scrollTarget.column ?? ''}:${scrollTarget.align ?? ''}:${scrollTarget.smooth ?? ''}`;
  useLayoutEffect(() => {
    if (!height) return;
    if (scrollKey === scrolledTo.current) return;
    scrolledTo.current = scrollKey;
    if (scrollTarget) scrollLineIntoView(scrollTarget.line, scrollTarget);
    // `scrollKey` is the target's value.
  }, [scrollKey, height, scrollLineIntoView]);

  useImperativeHandle(ref, () => ({
    scrollToLine: (line, options) => scrollLineIntoView(line, options),
    getSelection: () => {
      const value = selectionRef.current;
      return value ? { anchor: toPublic(value.anchor), focus: toPublic(value.focus) } : null;
    },
    getSelectionText: () => {
      const value = selectionRef.current;
      return value ? selectionText(value, readLine).text : '';
    },
    setSelection: (value) => {
      const at = (p: CodeViewerPosition): CodePosition => ({ line: clamp(p.line - 1, 0, Math.max(0, source.count - 1)), offset: Math.max(0, p.column) });
      select(value ? { anchor: at(value.anchor), focus: at(value.focus) } : null);
      syncProxy();
    },
    selectAll,
    focus: () => rootRef.current?.focus({ preventScroll: true }),
  }), [readLine, scrollLineIntoView, select, selectAll, source, syncProxy]);

  /* Rendering. */
  store?.beginFrame(rows.length ? rows[0].line : 0, rows.length ? rows[rows.length - 1].line + 1 : 0);

  const markerLookup = useMemo(() => {
    if (!markers) return null;
    if (typeof markers === 'function') return markers;
    const byLine = new Map<number, CodeViewerMarker[]>();
    for (const marker of markers) {
      if (marker.line === undefined) continue;
      const list = byLine.get(marker.line);
      if (list) list.push(marker);
      else byLine.set(marker.line, [marker]);
    }
    return (lineNumber: number) => byLine.get(lineNumber);
  }, [markers]);

  const ordered = selection ? orderedSelection(selection) : null;
  const bands: ReactNode[] = [];
  const gutterRows: ReactNode[] = [];
  const codeRows: ReactNode[] = [];
  for (const { row, line, part, metrics } of rows) {
    const lineNumber = line + 1;
    // A row kept only for its focus is out of view anyway: it needn't stretch the layers by millions of px.
    const top = (clamp(row, windowRows.start - 1, windowRows.end) - view.originRow) * lineHeight;
    const decoration = lineDecoration?.(lineNumber) ?? null;
    const current = currentLine === lineNumber;
    const tint = decoration?.tint ?? (current ? 'current' : null);
    if (tint || decoration?.className) {
      bands.push(<div key={row} data-slot="code-viewer-band" data-tint={tint ?? undefined} className={cn(codeViewerLineVariants({ tint: tint ?? 'none' }), decoration?.className)} style={{ top }} />);
    }
    if (part === 0 && gutters.length) {
      gutterRows.push(
        <GutterRow key={row} row={row} line={line} top={top} gutters={gutters} current={current} gutterClassName={decoration?.gutterClassName}
          onFocusLine={onFocusLine} onBlurLine={onBlurLine} />,
      );
    }

    // Which part of the line, and where it goes. On a line that's all in the window, none of this changes as you scroll.
    let span: Span;
    let firstCell: number;
    if (wrap) {
      span = wrappedSpan(metrics, part, cols);
      firstCell = part * cols;
    } else {
      span = { start: metrics.offsetAt(view.cells.start), end: metrics.offsetAt(view.cells.end) };
      firstCell = view.originCell;
    }
    const lastRowOfLine = span.end >= metrics.text.length;
    // On the last row of a wrapped line, a selection's newline and a mark at the line's end get a cell past it.
    const lastCell = wrap ? (part + 1) * cols + (lastRowOfLine ? 1 : 0) : view.cells.end;
    const left = CODE_PADDING + (metrics.cellAt(span.start) - firstCell) * cellWidth;

    let selectionLeft = 0;
    let selectionWidth = 0;
    if (ordered) {
      const cells = selectionCells(ordered, line, metrics);
      if (cells) {
        const from = Math.max(cells.start, wrap ? firstCell : view.cells.start);
        const to = Math.min(cells.end, lastCell);
        if (to > from) {
          selectionLeft = CODE_PADDING + (from - firstCell) * cellWidth;
          selectionWidth = (to - from) * cellWidth;
        }
      }
    }

    let columnLeft = -1;
    if (current && currentColumn != null) {
      const cell = metrics.cellAt(currentColumn);
      if (cell >= (wrap ? firstCell : view.cells.start) && cell < lastCell) columnLeft = CODE_PADDING + (cell - firstCell) * cellWidth;
    }

    let rowMarkers: (CodeViewerMarker & { left: number })[] | null = null;
    const lineMarkers = markerLookup?.(lineNumber);
    if (lineMarkers?.length) {
      // Markers past the end of the line are shown at its end.
      const inRange = markersInRange(lineMarkers, span.start, lastRowOfLine ? Infinity : span.end);
      if (inRange.length) {
        rowMarkers = inRange.map((marker) => ({ ...marker, left: CODE_PADDING + (metrics.cellAt(marker.column) - firstCell) * cellWidth }));
      }
    }

    codeRows.push(
      <CodeRow key={row} cache={cache} store={store} row={row} rowCount={rowCount} line={line} top={top} start={span.start} end={span.end} left={left}
        selectionLeft={selectionLeft} selectionWidth={selectionWidth} columnLeft={columnLeft}
        textClassName={decoration?.textClassName} markers={rowMarkers} onFocusLine={onFocusLine} onBlurLine={onBlurLine} />,
    );
  }

  const extentWidth = physicalSize(virtualWidth + gutterWidth);
  const extentHeight = physicalSize(virtualHeight);

  return (
    <div
      ref={rootRef}
      data-slot="code-viewer"
      data-wrap={wrap || undefined}
      dir="ltr"
      role="region"
      aria-label={ariaLabel ?? 'Source code'}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onCopy={handleCopy}
      onContextMenu={handleContextMenu}
      {...props}
      className={cn(
        'group/code-viewer bl-scroll relative h-full min-h-0 w-full min-w-0 overflow-auto overscroll-x-contain bg-card font-mono text-footnote leading-(--code-viewer-line) text-foreground outline-none [font-kerning:none] [font-variant-ligatures:none] [overflow-anchor:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        wrap && 'overflow-x-hidden',
        className,
      )}
      style={{ '--code-viewer-line': `${lineHeight}px`, '--code-viewer-cell': `${cellWidth}px`, ...style } as CSSProperties}
    >
      <div data-slot="code-viewer-extent" className="relative" style={{ width: Math.max(size.width, extentWidth), height: extentHeight }}>
        <div
          data-slot="code-viewer-viewport"
          className="sticky top-0 left-0 overflow-clip select-none [contain:strict]"
          style={{ width: size.width, height }}
        >
          <span ref={probeRef} aria-hidden="true" className="invisible absolute top-0 left-0 whitespace-pre">{PROBE}</span>
          <span ref={proxyRef} aria-hidden="true" data-slot="code-viewer-copy-proxy" className="sr-only whitespace-pre select-text" />
          {gutterWidth > 0 ? <div className="absolute inset-y-0 left-0 border-r border-border" style={{ width: gutterWidth }} /> : null}
          <div ref={yLayerRef} data-slot="code-viewer-gutter" className="absolute top-0 left-0 w-full will-change-transform">
            {bands}
            {gutterRows}
          </div>
          <div
            ref={clipRef}
            data-slot="code-viewer-code"
            className="absolute inset-y-0 right-0 cursor-text overflow-clip [-webkit-touch-callout:none]"
            style={{ left: gutterWidth }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <div ref={xyLayerRef} role="list" className="absolute top-0 left-0 w-full will-change-transform [unicode-bidi:bidi-override]">
              {codeRows}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

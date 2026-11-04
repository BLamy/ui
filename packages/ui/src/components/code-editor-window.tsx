'use client';
import {
  Fragment, memo, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore,
  type ClipboardEvent, type ComponentProps, type CompositionEvent as ReactCompositionEvent, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type MouseEvent,
  type PointerEvent as ReactPointerEvent, type ReactNode, type Ref,
} from 'react';
import { flushSync } from 'react-dom';
import { Button as AriaButton } from 'react-aria-components';
import { cva } from 'class-variance-authority';
import {
  CodeLexer, CodeTokenStore, DEFAULT_TAB_SIZE, LineCache, LineScanner, alignedScroll, comparePositions, displayPieces,
  extendSelection, hostProducer, identityRowMap, isCollapsed, lexerProducer, lineSet, markersInRange, movePosition, nextCellWindow, nextRowWindow,
  orderedSelection, originOf, physicalSize, revealScroll, selectionCells, selectionText, toPhysicalScroll, toVirtualScroll,
  visibleCells, visibleRows, wordAt, wrapRowMap, wrappedSpan,
  type CodeHighlight, type CodeLineRange, type CodePosition, type CodeSelection, type CodeToken, type CodeEditorAlign, type DisplayPiece, type LineMetrics,
  type LineSource, type RowMap, type SelectionGranularity, type SelectionKey, type Span,
} from '@/lib/code-editor';
import {
  caretAt, deleteBackwardCommand, deleteForwardCommand, detectIndent, editBetween, editorKeyAction, indentCommand, insertCommand, lineEditOf, mapSelection, moveCaret,
  newlineCommand, redoEdit, rowOfPosition, rowsOfCells, tabCommand, undoEdit,
  type AppliedEdit, type CaretMove, type CodeDocument, type CodeEditOrigin, type CodeHistory, type DeleteUnit, type EditCommand, type MoveContext,
} from '@/lib/code-document';
import { createGpuCodeHighlight } from '@/lib/code-editor-gpu';
import { PLAIN_LANGUAGES, codeTokenClass, type SyntaxEngine } from '@/lib/syntax';
import { cn } from '@/lib/utils';

/* ══ CodeEditor's windowed renderer — source of any shape, read-only or editable ══
   A megabyte on one line and half a million lines both scroll and type like twenty lines do, because neither is ever in the
   DOM: a monospace line is a grid of cells (lib/code-editor.ts), so what's on screen is arithmetic, and only that is rendered.

   The element that scrolls holds an empty box the size of the whole file, and a viewport stuck to its corner. Rows and
   their text sit in layers inside the viewport with small coordinates; scrolling writes one transform per layer. So the
   gutters don't move sideways, because they're not in the layer that does, and there are no huge numbers for a browser
   to lose precision in.

   Selection is its own: two positions in the document, drawn on the rows and copied from the source. The browser's can't work
   here, since most of what you'd select doesn't exist.

   Editing goes through a hidden <textarea>, as in CodeMirror and Monaco. It has the focus, so typing, paste, input methods and
   a phone's keyboard all arrive as what they did, and it's kept under the caret so an input method's window opens in the right
   place. What it holds is a stand-in: the selected text, so the browser offers Copy and Cut, or the caret's line, for screen
   readers and keyboards that correct what's near the caret. The text itself is in the document (lib/code-document.ts). Every
   edit goes through `followEdit`, which brings everything held per line up to date without starting over. ══ */

const PROBE = '0'.repeat(128);
/** Space between the gutter and the first character. */
const CODE_PADDING = 10;
/** Room past the end of the longest line. */
const END_PADDING = 24;
/** Rows and cells in the DOM are placed relative to a multiple of these. */
const ORIGIN_ROWS = 4096;
const ORIGIN_CELLS = 8192;
/** An editor with no height of its own, in a parent with none, follows its content up to here, and scrolls from there: it must not
    render every line. */
const MAX_VIEW_HEIGHT = 8192;
/** The same sideways, whatever a host's layout does: it must not render every character of a long line. */
const MAX_VIEW_WIDTH = 16384;
const COPY_PROXY_LENGTH = 4096;
/** How much of the caret's line the hidden input holds on each side of it. */
const STAND_IN_RADIUS = 256;
/** How much of a selection it holds. Copy gets all of it from the source. */
const STAND_IN_SELECTION = 4096;
/** Something for Backspace to delete at the start of the stand-in, for keyboards that only speak in what they did. */
const STAND_IN_MARK = '\u200b';
/** Time for the lexer to catch up with an edit before the frame is drawn. More than this carries on in slices. */
const EDIT_LEX_BUDGET = 2;
/** How long after the widest line gets narrower to look for the next widest. */
const WIDTH_RESCAN_MS = 300;
/** Room kept around the caret as it reaches the side of the view. */
const CARET_MARGIN_X = 24;
const LONG_PRESS_MS = 450;
const TOUCH_SLOP = 8;
const DOUBLE_CLICK_MS = 450;
const REVEAL_MARGIN = 30;

const SELECTION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
const FOCUSABLE = ':is(button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex])';
const CONTROL_SELECTOR = `[data-code-editor-cell]${FOCUSABLE},[data-code-editor-cell] ${FOCUSABLE}`;

/* ── Variants ── */

/** The band behind a line, across gutters and code. */
export const codeEditorLineVariants = cva('pointer-events-none absolute inset-x-0 h-(--code-editor-line)', {
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

export const codeEditorGutterCellVariants = cva('box-border flex h-full shrink-0 items-center overflow-hidden', {
  variants: {
    align: { start: 'justify-start', center: 'justify-center', end: 'justify-end' },
  },
  defaultVariants: { align: 'center' },
});

const MARKER_CLASS =
  'absolute top-0 z-10 flex h-full w-3.5 -translate-x-1/2 cursor-pointer items-start justify-center border-0 bg-transparent p-0 outline-none data-focus-visible:rounded-sm data-focus-visible:ring-2 data-focus-visible:ring-ring';

/* ── Types ── */

export interface CodeEditorGutter {
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

export interface CodeEditorLineDecoration {
  /** A band behind the line, across gutters and code. */
  tint?: 'current' | 'info' | 'success' | 'warning' | 'danger' | 'muted';
  /** On the band: a tint of your own. */
  className?: string;
  /** On the row of code: dim a line that never ran. */
  textClassName?: string;
  /** On the line's gutter cells. */
  gutterClassName?: string;
}

export interface CodeEditorMarker {
  /** Only used in the flat form of `markers`. */
  line?: number;
  /** UTF-16 code units from the start of the line, from 0. */
  column: number;
  /** Its accessible name. */
  label: string;
  /** Makes it a button. */
  onPress?: (marker: CodeEditorMarker) => void;
  /** Filled in, and announced as pressed. */
  isActive?: boolean;
  title?: string;
  className?: string;
  /** Replaces the default dot. */
  children?: ReactNode;
}

export interface CodeEditorScrollOptions {
  /** Where the line ends up in the view (default `center`). */
  align?: CodeEditorAlign;
  /** Scroll sideways to this column too. */
  column?: number;
  /** Animate. Reduced motion wins. */
  smooth?: boolean;
}

export interface CodeEditorScrollTarget extends CodeEditorScrollOptions {
  line: number;
}

/** A position in the editor's API: `line` from 1, `column` in UTF-16 code units from 0. */
export interface CodeEditorPosition {
  line: number;
  column: number;
}

export interface CodeEditorSelection {
  anchor: CodeEditorPosition;
  focus: CodeEditorPosition;
}

export interface CodeEditorCopy {
  text: string;
  /** The selection was longer than a clipboard should be asked to take, and this is the start of it. */
  truncated: boolean;
}

export interface CodeEditorHandle {
  /** Brings a line into view. `line` is from 1. */
  scrollToLine: (line: number, options?: CodeEditorScrollOptions) => void;
  /** With nothing selected: in an editor, the caret, as a selection with both ends at the same place; otherwise `null`. */
  getSelection: () => CodeEditorSelection | null;
  /** The selected text, from the source, however much of it is on screen. */
  getSelectionText: () => string;
  setSelection: (selection: CodeEditorSelection | null) => void;
  selectAll: () => void;
  focus: () => void;
  /** The whole text. On a huge document this takes a while, so ask when you need it rather than on every key. */
  getValue: () => string;
}

/** An edit, as `onChange` and `onEdit` report it. */
export interface CodeEditorChange {
  /** Where the replaced range starts and ends, in the text before the change. */
  from: CodeEditorPosition;
  to: CodeEditorPosition;
  /** Where the new text ends, in the text after the change. */
  newTo: CodeEditorPosition;
  /** What went in, with `\n` for line ends. */
  text: string;
  /** What came out, with `\n` for line ends. */
  removed: string;
  /** What made it: typing (`input`), a delete key, `newline`, `indent`, `paste`, `cut`, an input method (`composition`), `undo`, or `redo`. */
  origin: Exclude<CodeEditOrigin, 'value'>;
}

/** What the windowed renderer takes: the parts of `CodeEditorProps` that reach it, worked out by `CodeEditor`. */
export interface CodeEditorWindowProps {
  handleRef?: Ref<CodeEditorHandle>;
  /** The source, a line to an entry. Or use `lineCount` and `getLine`, or `document`. */
  lines?: readonly string[];
  lineCount?: number;
  /** A line by index, from 0. Only called for what's on screen, and by a pass over the file in the background (see
      `maxLineLength`). */
  getLine?: (index: number) => string;
  /** Changes when what `getLine` returns does. Without it a new `getLine` function means new content, so keep it stable. */
  contentKey?: unknown;
  /** A text as lines. A document that stays the same with `editable` is edited in place. */
  document?: CodeDocument | null;
  /** Editing is on. Needs `document` and `history`. */
  editable?: boolean;
  history?: CodeHistory | null;
  /** Where the caret starts, and where it's kept between mounts. */
  selectionStore?: { current: CodeSelection };
  /** What the host says the text is, if it's controlled. */
  value?: string;
  onChange?: (value: string, change: CodeEditorChange) => void;
  onEdit?: (change: CodeEditorChange) => void;
  language?: string;
  /** Beside the code, in this order. They stay put when the code scrolls sideways. */
  gutters?: readonly CodeEditorGutter[];
  /** The built-in line number gutter: next to the code (`true`, `end`), first (`start`), or none. */
  lineNumbers?: boolean | 'start' | 'end';
  onLineNumberPress?: (lineNumber: number) => void;
  isLineNumberPressable?: (lineNumber: number) => boolean;
  lineNumberLabel?: (lineNumber: number) => string;
  lineNumberTitle?: (lineNumber: number) => string | undefined;
  /** The number of the first line. Every line number in the props and the ref counts from it. */
  startLine?: number;
  /** Lines to highlight: `[3, [7, 9], '12-14']`. */
  highlightLines?: readonly CodeLineRange[];
  /** Lines shown as added (green, `+`) … */
  addedLines?: readonly CodeLineRange[];
  /** … and removed (red, `−`). Either one adds a column for the sign. */
  removedLines?: readonly CodeLineRange[];
  /** Extra attributes per line (`id` anchors, `data-*`, handlers), on the line's first row, for lines on screen. */
  lineProps?: (line: number) => HTMLAttributes<HTMLElement> | undefined;
  /** The line execution is on, from 1: a band, and with `currentColumn`, a mark in the line. */
  currentLine?: number | null;
  currentColumn?: number | null;
  /** Keep `currentLine` in view when it changes (default). `{ smooth: true }` animates it. */
  revealCurrentLine?: boolean | { smooth?: boolean };
  /** Tints and classes by line. Called for rows on screen, so it can be a lookup; it can return a new object every time. */
  lineDecoration?: (lineNumber: number) => CodeEditorLineDecoration | null | undefined;
  /** Things to press at a column of a line, like a column-level breakpoint. An array, or a function for a line's markers
      when there are many of them. Only those in the part of the line that's rendered are in the DOM. */
  markers?: readonly CodeEditorMarker[] | ((lineNumber: number) => readonly CodeEditorMarker[] | null | undefined);
  /** Scrolls here when this changes. A line, or a line with options. */
  scrollToLine?: number | CodeEditorScrollTarget | null;
  /** Labels the text. By default a small lexer for C-family and script languages labels it here, at once. `null` or `false`
      turns highlighting off. See the docs for gpu-lexer. */
  highlight?: boolean | CodeHighlight | null;
  /** `gpu` labels with gpu-lexer instead of the small lexer. */
  engine?: SyntaxEngine;
  /** Soft-wrap at the width of the view, breaking at the last column that fits, not between words. */
  wrap?: boolean;
  /** Cap the height; it scrolls past it. */
  maxHeight?: number | string;
  /** Cells between tab stops (default 2). */
  tabSize?: number;
  /** Height of a row in px (default 20). */
  lineHeight?: number;
  /** The widest line in cells, if you know it: saves a pass over the file to find the scrollable width. */
  maxLineLength?: number;
  /** Space above the first line and below the last, in px. */
  paddingY?: number;
  /** Copying a selection, with the text that's going on the clipboard. */
  onCopyText?: (copy: CodeEditorCopy) => void;
  onSelectionChange?: (selection: CodeEditorSelection | null) => void;
  onFocusChange?: (focused: boolean) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

/* ── Rows ── */

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

const noStore = { subscribe: () => () => {}, version: () => 0 };

function renderPieces(pieces: readonly DisplayPiece[]): ReactNode {
  return pieces.map((piece, i) => {
    if (typeof piece === 'string') return piece;
    const style = { width: `calc(var(--code-editor-cell) * ${piece.cells})` };
    if (piece.rtl) return <span key={i} dir="rtl" className="inline-block text-center [unicode-bidi:isolate]" style={style}>{piece.text}</span>;
    return <span key={i} className={cn('inline-block text-center', piece.control && 'text-tertiary-foreground')} style={style}>{piece.text}</span>;
  });
}

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
    const className = codeTokenClass(tokens[i]);
    out.push(className ? <span key={i} className={className}>{content}</span> : plain ? content : <Fragment key={i}>{content}</Fragment>);
    at = next;
  }
  if (at < end) out.push(plain ? text.slice(at, end) : renderPieces(displayPieces(metrics, at, end)));
  return out;
}

const CodeRowText = memo(function CodeRowText({ metrics, store, line, start, end, left }: {
  metrics: LineMetrics;
  store: CodeTokenStore | null;
  line: number;
  start: number;
  end: number;
  left: number;
}) {
  const source = store ?? noStore;
  useSyncExternalStore(source.subscribe, () => source.version(line), () => 0);
  if (start >= end) return null;
  const tokens = store ? store.read(line, metrics.text, start, end) : null;
  return (
    <span data-slot="code-editor-text" className="absolute top-0 whitespace-pre" style={{ left }}>
      {tokens
        ? renderTokens(metrics, tokens, start, end)
        : metrics.plain
          ? metrics.text.slice(start, end)
          : renderPieces(displayPieces(metrics, start, end))}
    </span>
  );
});

interface CodeRowProps {
  /** The line's text and grid: a new one when its text changes. */
  metrics: LineMetrics;
  store: CodeTokenStore | null;
  row: number;
  rowCount: number;
  line: number;
  lineNumber: number;
  top: number;
  start: number;
  end: number;
  left: number;
  selectionLeft: number;
  selectionWidth: number;
  /** Text an input method hasn't finished with yet. */
  composingLeft: number;
  composingWidth: number;
  columnLeft: number;
  textClassName?: string;
  extra?: HTMLAttributes<HTMLElement>;
  markers: readonly (CodeEditorMarker & { left: number })[] | null;
  onFocusLine: (line: number) => void;
  onBlurLine: (line: number) => void;
}

const CodeRow = memo(function CodeRow({
  metrics, store, row, rowCount, line, lineNumber, top, start, end, left, selectionLeft, selectionWidth, composingLeft, composingWidth, columnLeft, textClassName, extra, markers,
  onFocusLine, onBlurLine,
}: CodeRowProps) {
  return (
    <div
      role="listitem"
      aria-posinset={row + 1}
      aria-setsize={rowCount}
      {...extra}
      data-slot="code-editor-line"
      data-row={row}
      data-line={lineNumber}
      className={cn('absolute left-0 h-(--code-editor-line) w-full [contain:layout_style]', textClassName, extra?.className)}
      style={extra?.style ? { ...extra.style, top } : { top }}
      onFocus={markers ? () => onFocusLine(line) : extra?.onFocus}
      onBlur={markers ? () => onBlurLine(line) : extra?.onBlur}
    >
      {selectionWidth > 0 ? (
        <div
          data-slot="code-editor-selection"
          className="absolute top-0 h-full bg-muted-foreground/25 group-focus-within/code-editor:bg-primary/25"
          style={{ left: selectionLeft, width: selectionWidth }}
        />
      ) : null}
      <CodeRowText metrics={metrics} store={store} line={line} start={start} end={end} left={left} />
      {composingWidth > 0 ? (
        <div data-slot="code-editor-composing" className="absolute bottom-0.5 h-px bg-foreground" style={{ left: composingLeft, width: composingWidth }} />
      ) : null}
      {columnLeft >= 0 ? (
        <div data-slot="code-editor-column" className="absolute top-0.5 bottom-0.5 w-0.5 -translate-x-1/2 rounded-full bg-primary" style={{ left: columnLeft }} />
      ) : null}
      {markers?.map((marker, i) => <Marker key={`${marker.column}:${i}`} marker={marker} />)}
    </div>
  );
}, (a, b) => {
  for (const key of Object.keys(a) as (keyof CodeRowProps)[]) {
    if (key !== 'markers' && key !== 'extra' && !Object.is(a[key], b[key])) return false;
  }
  if (a.extra !== b.extra) {
    // `lineProps` can return a new object every time, so what matters is what's in it.
    const x = (a.extra ?? {}) as Record<string, unknown>;
    const y = (b.extra ?? {}) as Record<string, unknown>;
    const keys = Object.keys(x);
    if (keys.length !== Object.keys(y).length || keys.some((key) => !Object.is(x[key], y[key]))) return false;
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

function Marker({ marker }: { marker: CodeEditorMarker & { left: number } }) {
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
        data-code-editor-cell="marker"
        data-slot="code-editor-marker"
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
      data-code-editor-cell="marker"
      data-slot="code-editor-marker"
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

function GutterCell({ gutter, lineNumber, gutterClassName }: { gutter: CodeEditorGutter; lineNumber: number; gutterClassName?: string }) {
  const pressable = !!gutter.onPress && (gutter.isPressable?.(lineNumber) ?? true);
  const content = gutter.render(lineNumber);
  const className = cn(codeEditorGutterCellVariants({ align: gutter.align }), gutter.className, gutterClassName);
  const style = { width: gutter.width } satisfies CSSProperties;
  const title = gutter.title?.(lineNumber);
  if (!pressable) {
    return (
      <div data-code-editor-cell={gutter.id} data-slot="code-editor-gutter-cell" data-gutter={gutter.id} title={title} className={className} style={style}>
        {content}
      </div>
    );
  }
  return (
    <AriaButton
      data-code-editor-cell={gutter.id}
      data-slot="code-editor-gutter-cell"
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

const GutterRow = memo(function GutterRow({ row, line, lineNumber, top, gutters, current, gutterClassName, onFocusLine, onBlurLine }: {
  row: number;
  line: number;
  lineNumber: number;
  top: number;
  gutters: readonly CodeEditorGutter[];
  current: boolean;
  gutterClassName?: string;
  onFocusLine: (line: number) => void;
  onBlurLine: (line: number) => void;
}) {
  return (
    <div
      data-slot="code-editor-gutter-row"
      data-row={row}
      data-line={lineNumber}
      data-current={current || undefined}
      className="group/gutter absolute left-0 flex h-(--code-editor-line)"
      style={{ top }}
      onFocus={() => onFocusLine(line)}
      onBlur={() => onBlurLine(line)}
    >
      {gutters.map((gutter) => <GutterCell key={gutter.id} gutter={gutter} lineNumber={lineNumber} gutterClassName={gutterClassName} />)}
    </div>
  );
});

/* ── Selection helpers ── */

const isMac = () => typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

function isEditable(el: Element) {
  const name = el.tagName;
  return name === 'INPUT' || name === 'TEXTAREA' || name === 'SELECT' || (el as HTMLElement).isContentEditable;
}

/** What the hidden input holds right now. */
interface StandIn {
  text: string;
  /** It's the selection, not the caret's line. */
  selection: boolean;
  line: number;
  /** Where on the line its text starts, past the mark at its very start. */
  start: number;
}

interface Composition {
  from: CodePosition;
  /** Where its text ends so far. */
  end: CodePosition;
  /** What it replaced, to put back before the final text goes in as one edit. */
  original: string;
  before: CodeSelection;
}

/** An edit waiting to hear whether a controlled host took it. */
interface Unconfirmed {
  applied: AppliedEdit;
  origin: CodeEditOrigin;
  before: CodeSelection;
  after: CodeSelection;
  parentLength: number;
  valueBefore: string | undefined;
  /** It's undo or redo, which has already gone through the history. */
  isUndo: boolean;
}

/* ── The renderer ── */

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
  /** Space above the first row and below the last. */
  padY: number;
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

export function CodeEditorWindow({
  handleRef, lines, lineCount, getLine, contentKey, document: textDocument, editable = false, history, selectionStore, value, onChange, onEdit, language,
  gutters: gutterProp, lineNumbers = true, onLineNumberPress, isLineNumberPressable, lineNumberLabel, lineNumberTitle, startLine = 1, highlightLines, addedLines, removedLines,
  lineProps, currentLine, currentColumn, revealCurrentLine = true, lineDecoration, markers, scrollToLine, highlight: highlightProp, engine, wrap = false, maxHeight,
  tabSize = DEFAULT_TAB_SIZE, lineHeight = 20, maxLineLength, paddingY = 0, onCopyText, onSelectionChange, onFocusChange, className, style, onKeyDown, onContextMenu,
  'aria-label': ariaLabel,
}: CodeEditorWindowProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const yLayerRef = useRef<HTMLDivElement>(null);
  const xyLayerRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const proxyRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* The source. A new `getLine` isn't new content when `contentKey` says otherwise. A document is the same source through any
     number of edits: what's derived from it follows them. */
  const getLineRef = useRef(getLine);
  getLineRef.current = getLine;
  const contentIdentity = textDocument ?? lines ?? (contentKey !== undefined ? contentKey : getLine);
  const source = useMemo<LineSource>(() => {
    if (textDocument) return textDocument;
    if (lines) return { count: lines.length, get: (i) => lines[i] ?? '' };
    return { count: lineCount ?? 0, get: (i) => getLineRef.current?.(i) ?? '' };
    // `contentIdentity` is what says the content changed.
  }, [contentIdentity, textDocument, lines, lineCount]);
  const cache = useMemo(() => new LineCache(source, tabSize), [source, tabSize]);

  /* What the host calls the first line. */
  const startLineRef = useRef(startLine);
  startLineRef.current = startLine;
  const toPublic = useCallback((p: CodePosition): CodeEditorPosition => ({ line: p.line + startLineRef.current, column: p.offset }), []);

  /* Highlighting. */
  const plainLanguage = !!language && PLAIN_LANGUAGES.has(language.toLowerCase());
  const highlight = useMemo<CodeHighlight | null | undefined>(() => {
    if (typeof highlightProp === 'function') return highlightProp;
    if (highlightProp === false || highlightProp === null || plainLanguage) return null;
    return engine === 'gpu' ? createGpuCodeHighlight({ engine: 'gpu' }) : undefined;
  }, [highlightProp, plainLanguage, engine]);
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
  const lexerRef = useRef(lexer);
  lexerRef.current = lexer;

  // `data-highlighter` is `pending` while what's on screen may still change color, as in the page: visual
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
  const passTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** Runs what's left of the passes over the file for a while, and comes back for more. */
  const runPass = useCallback((budget: number) => {
    clearTimeout(passTimer.current);
    const end = performance.now() + budget;
    const deadline = () => performance.now() > end;
    const currentLexer = lexerRef.current;
    const scanner = scannerRef.current;
    lexing.current = currentLexer ? currentLexer.scan(deadline) : false;
    const reachedBefore = scanner ? scanner.reached : 0;
    const scanning = scanner ? scanner.run(deadline) : false;
    if (scanner) {
      const grew = scanner.maxCells > seenCells.current;
      if (grew) seenCells.current = scanner.maxCells;
      // With wrapping on, every slice can move rows. Off, only the scrollbar's size can change.
      if ((scanner.cellCounts && scanner.reached !== reachedBefore) || grew) setScanVersion((v) => v + 1);
    }
    if (lexing.current || scanning) passTimer.current = setTimeout(() => runPass(4), 16);
    showHighlighter();
  }, [showHighlighter]);

  useLayoutEffect(() => {
    seenCells.current = maxLineLength ?? 0;
    render();
    scannerRef.current = wrap || maxLineLength === undefined ? new LineScanner(source, tabSize, wrap) : null;
    lexing.current = !!lexer;
    runPass(8);
    return () => clearTimeout(passTimer.current);
  }, [source, tabSize, wrap, maxLineLength, lexer, runPass]);

  /* Which lines are marked, by the numbers they show. */
  const markKey = JSON.stringify([highlightLines ?? null, addedLines ?? null, removedLines ?? null]);
  const lineMarks = useMemo(() => {
    const [marked, added, removed] = JSON.parse(markKey) as (CodeLineRange[] | null)[];
    return { marked: lineSet(marked), added: lineSet(added), removed: lineSet(removed) };
  }, [markKey]);
  const hasDiff = lineMarks.added.size > 0 || lineMarks.removed.size > 0;

  /* Gutters, with the line numbers in their place. */
  const digits = String(Math.max(1, startLine + Math.max(1, source.count) - 1)).length;
  const lineNumberWidth = Math.ceil(digits * cellWidth) + 16;
  const lineNumberGutter = useMemo<CodeEditorGutter | null>(() => {
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
  const diffGutter = useMemo<CodeEditorGutter | null>(() => {
    if (!hasDiff) return null;
    return {
      id: 'diff-sign',
      width: Math.ceil(cellWidth * 2),
      className: 'text-muted-foreground',
      render: (lineNumber) => <span aria-hidden="true">{lineMarks.added.has(lineNumber) ? '+' : lineMarks.removed.has(lineNumber) ? '\u2212' : null}</span>,
    };
  }, [hasDiff, cellWidth, lineMarks]);
  const gutters = useMemo<readonly CodeEditorGutter[]>(() => {
    const list = diffGutter ? [...(gutterProp ?? []), diffGutter] : gutterProp ?? [];
    if (!lineNumberGutter) return list;
    if (lineNumbers === 'start') return [lineNumberGutter, ...list];
    return diffGutter ? [...(gutterProp ?? []), lineNumberGutter, diffGutter] : [...list, lineNumberGutter];
  }, [gutterProp, lineNumberGutter, lineNumbers, diffGutter]);
  const gutterWidth = useMemo(() => gutters.reduce((sum, g) => sum + g.width, 0), [gutters]);

  /* Rows. */
  const codeWidth = Math.max(0, size.width - gutterWidth);
  // A cell of slack, for a wide character that starts in the last column.
  const cols = wrap ? Math.max(8, Math.floor((codeWidth - CODE_PADDING - END_PADDING) / cellWidth)) : 0;
  const unwrappedLines = wrap ? 0 : source.count;
  const rowMap = useMemo(
    () => (wrap && scannerRef.current?.cellCounts ? wrapRowMap(scannerRef.current.cellCounts, cols) : identityRowMap(source.count)),
    // `scanVersion` is what says the counts changed, and with no wrapping, the number of lines.
    [wrap, cols, source, scanVersion, unwrappedLines],
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
  const padY = paddingY;
  const virtualHeight = rowCount * lineHeight + padY * 2;
  const geometry: Geometry = {
    width: size.width, height, codeWidth, gutterWidth, cellWidth, lineHeight, map: rowMap, wrap, cols, virtualWidth, virtualHeight, padY,
  };
  const geometryRef = useRef(geometry);

  const transforms = useRef({ x: NaN, y: NaN });
  const placeInputRef = useRef<() => void>(() => {});
  const writeTransforms = useCallback(() => {
    const g = geometryRef.current;
    const { x, y } = scrollRef.current;
    const v = viewRef.current;
    const ratio = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
    const snap = (n: number) => Math.round(n * ratio) / ratio;
    const ty = snap(v.originRow * g.lineHeight + g.padY - y);
    const tx = snap(v.originCell * g.cellWidth - x);
    const last = transforms.current;
    if (ty === last.y && tx === last.x) return;
    if (ty !== last.y && yLayerRef.current) yLayerRef.current.style.transform = `translate3d(0,${ty}px,0)`;
    if (xyLayerRef.current) xyLayerRef.current.style.transform = `translate3d(${tx}px,${ty}px,0)`;
    last.x = tx;
    last.y = ty;
    placeInputRef.current();
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
    const rowsNext = nextRowWindow(current.rows, visibleRows(y - g.padY, g.height, g.lineHeight, g.map.rowCount), g.map.rowCount);
    const cellsNext = g.wrap
      ? { start: 0, end: 0 }
      : nextCellWindow(current.cells, visibleCells(Math.max(0, x - CODE_PADDING), Math.min(g.codeWidth, MAX_VIEW_WIDTH), g.cellWidth));
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

  const scrollLineIntoView = useCallback((lineNumber: number, options: CodeEditorScrollOptions & { reveal?: boolean } = {}) => {
    const g = geometryRef.current;
    if (!g.height || !source.count) return;
    const line = clamp(lineNumber - startLineRef.current, 0, source.count - 1);
    const metrics = cache.get(line);
    const { column, align = 'center', smooth, reveal } = options;
    const cell = column == null ? null : metrics.cellAt(column);
    const part = g.wrap && cell !== null ? Math.floor(cell / g.cols) : 0;
    const row = g.map.rowOfLine(line) + part;
    const now = scrollRef.current;
    const position = row * g.lineHeight + g.padY;
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
  const [selection, setSelectionState] = useState<CodeSelection | null>(() => (editable && selectionStore ? selectionStore.current : null));
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const editableRef = useRef(editable);
  editableRef.current = editable;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  /** Where the last plain click landed: a shift-click extends from here when nothing is selected. */
  const caretRef = useRef<CodePosition | null>(null);
  /** The hidden input doesn't hold what it should any more. */
  const inputDirty = useRef(true);

  /* A caret is a selection with both ends at the same place, and only an editor has one. */
  const select = useCallback((next: CodeSelection | null) => {
    const value = next && isCollapsed(next) && !editableRef.current ? null : next;
    const prev = selectionRef.current;
    if (prev === value) return;
    if (prev && value && comparePositions(prev.anchor, value.anchor) === 0 && comparePositions(prev.focus, value.focus) === 0) return;
    selectionRef.current = value;
    if (value && selectionStore) selectionStore.current = value;
    inputDirty.current = true;
    setSelectionState(value);
    onSelectionChangeRef.current?.(value ? { anchor: toPublic(value.anchor), focus: toPublic(value.focus) } : null);
  }, [selectionStore, toPublic]);

  const readLine = useCallback((line: number) => source.get(line) ?? '', [source]);

  // Positions in the old content mean nothing in the new.
  const selectedIn = useRef(source);
  useLayoutEffect(() => {
    if (selectedIn.current === source) return;
    selectedIn.current = source;
    caretRef.current = null;
    select(editableRef.current ? caretAt({ line: 0, offset: 0 }) : null);
  }, [source, select]);

  // The browser's own selection has to be somewhere for its copy command to be on offer, in a context menu above all.
  // So it's on a stand-in that holds the start of the text; the copy handler puts the real thing on the clipboard.
  const syncProxy = useCallback(() => {
    if (editableRef.current) return;
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
    const row = clamp(Math.floor((clientY - rect.top + y - g.padY) / g.lineHeight), 0, Math.max(0, g.map.rowCount - 1));
    const { line, part } = g.map.locate(row);
    const metrics = cache.get(line);
    const cell = (clientX - rect.left + x - CODE_PADDING) / g.cellWidth;
    return { line, offset: g.wrap ? metrics.nearest(part * g.cols + clamp(cell, 0, g.cols)) : metrics.nearest(cell) };
  }, [cache]);

  const dragRef = useRef<Drag | null>(null);
  const syncInputRef = useRef<() => void>(() => {});
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
    syncInputRef.current();
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
    if ((e.target as Element).closest('[data-code-editor-cell]')) return;
    if (e.pointerType === 'touch') {
      const { pointerId, clientX: x, clientY: y } = e;
      if (longPress.current) clearTimeout(longPress.current.timer);
      longPress.current = {
        pointerId, x, y,
        timer: setTimeout(() => {
          longPress.current = null;
          focusEditor();
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
        if (comparePositions(position, from) < 0 || comparePositions(position, to) > 0) select(editable ? caretAt(position) : null);
      }
      if (editable) {
        focusEditor();
        syncInputRef.current();
        offerInputAt(e.clientX, e.clientY);
      }
      return;
    }
    focusEditor();
    if (editable) {
      history?.seal();
      goalRef.current = null;
      escaped.current = false;
      menuOffered.current = false;
      restartBlink();
    }
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
      if (editable) {
        // In the gesture, or a phone won't bring up its keyboard.
        focusEditor();
        history?.seal();
        goalRef.current = null;
        select(caretAt(positionAt(press.x, press.y)));
      } else select(null);
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
    if (!current || isCollapsed(current) || !(rootRef.current as HTMLDivElement).contains(e.target as Node)) return;
    if (e.target !== inputRef.current && isEditable(e.target as Element)) return;
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
    syncInputRef.current();
  }, [readLine, select, source, syncProxy]);

  /* Editing. Everything that holds something per line follows each edit here, in one place. */
  const needsReveal = useRef(false);
  const goalRef = useRef<number | null>(null);
  const escaped = useRef(false);
  const composing = useRef<Composition | null>(null);
  const standIn = useRef<StandIn>({ text: '', selection: false, line: 0, start: 0 });
  const offered = useRef(false);
  /** A context menu was offered since the last key or press, so a Select All from it could be on its way. */
  const menuOffered = useRef(false);
  const widthTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [focused, setFocused] = useState(false);
  /** A new caret element restarts the blink, so it's solid while keys are going in. */
  const [blink, restartBlink] = useReducer((n: number) => n + 1, 0);
  const [, afterEdit] = useReducer((n: number) => n + 1, 0);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;
  const valueRef = useRef(value);
  valueRef.current = value;

  const focusEditor = useCallback(() => {
    if (editableRef.current) inputRef.current?.focus({ preventScroll: true });
    else rootRef.current?.focus({ preventScroll: true });
  }, []);

  /** Puts the hidden input under the caret, as near as the view allows: an input method opens its window there. */
  const placeInput = useCallback(() => {
    const input = inputRef.current;
    const current = selectionRef.current;
    if (!input || !current || offered.current) return;
    const g = geometryRef.current;
    const { x, y } = scrollRef.current;
    const place = rowOfPosition(current.focus, cache.get(current.focus.line), g.map, g.wrap ? g.cols : 0);
    const left = clamp(g.gutterWidth + CODE_PADDING + place.cell * g.cellWidth - x, 0, Math.max(0, g.width - 1));
    const top = clamp(place.row * g.lineHeight + g.padY - y, 0, Math.max(0, g.height - g.lineHeight));
    input.style.transform = `translate(${left}px,${top}px)`;
  }, [cache]);
  placeInputRef.current = placeInput;

  /** Fills the hidden input with what it stands in for. */
  const syncInput = useCallback(() => {
    const input = inputRef.current;
    const current = selectionRef.current;
    if (!input || !current || composing.current) return;
    inputDirty.current = false;
    let text: string;
    let start: number;
    let end: number;
    if (!isCollapsed(current)) {
      // All of it selected, so typing replaces it and the browser offers Copy and Cut.
      text = selectionText(current, readLine, STAND_IN_SELECTION).text;
      standIn.current = { text, selection: true, line: 0, start: 0 };
      start = 0;
      end = text.length;
    } else {
      const { line, offset } = current.focus;
      const full = readLine(line);
      let from = Math.max(0, offset - STAND_IN_RADIUS);
      let to = Math.min(full.length, offset + STAND_IN_RADIUS);
      const low = (c: number) => c >= 0xdc00 && c <= 0xdfff;
      if (from > 0 && low(full.charCodeAt(from))) from--;
      if (to < full.length && low(full.charCodeAt(to))) to++;
      text = STAND_IN_MARK + full.slice(from, to);
      standIn.current = { text, selection: false, line, start: from };
      start = end = offset - from + STAND_IN_MARK.length;
    }
    if (input.value !== text) input.value = text;
    if (input.selectionStart !== start || input.selectionEnd !== end) input.setSelectionRange(start, end);
  }, [readLine]);
  syncInputRef.current = syncInput;

  /** Keeps the caret in view: it moves the view as little as it can. */
  const revealCaret = useCallback(() => {
    const current = selectionRef.current;
    const g = geometryRef.current;
    if (!current || !g.height) return;
    const place = rowOfPosition(current.focus, cache.get(current.focus.line), g.map, g.wrap ? g.cols : 0);
    const now = scrollRef.current;
    const y = alignedScroll(place.row * g.lineHeight + g.padY, g.lineHeight, g.height, now.y, 'nearest', Math.min(g.lineHeight, g.height / 3));
    const x = g.wrap ? now.x : alignedScroll(place.cell * g.cellWidth + CODE_PADDING, g.cellWidth, g.codeWidth, now.x, 'nearest', Math.min(CARET_MARGIN_X, g.codeWidth / 3));
    if (y === now.y && x === now.x) return;
    pendingScroll.current = { x: x === now.x ? undefined : x, y: y === now.y ? undefined : y };
    applyPendingScroll();
  }, [applyPendingScroll, cache]);

  /** Brings everything held per line up to date with an edit that's been made. */
  const followEdit = useCallback((applied: AppliedEdit) => {
    const edit = lineEditOf(applied);
    const oneLine = edit.fromLine === edit.oldEndLine && edit.fromLine === edit.newEndLine;
    const scanner = scannerRef.current;
    const counts = scanner?.cellCounts ?? null;
    const cellsBefore = counts ? counts[edit.fromLine] : 0;
    const previous = oneLine ? cache.peek(edit.fromLine) : undefined;
    cache.edit(edit);
    scanner?.edit(edit);
    lexerRef.current?.edit(edit);
    storeRef.current?.edit(edit);

    // With wrapping on, rows only moved if a line changed how many it takes.
    if (scanner?.cellCounts) {
      const g = geometryRef.current;
      const cellsAfter = (scanner.cellCounts as Uint32Array)[edit.fromLine];
      if (!oneLine || rowsOfCells(cellsBefore, g.cols) !== rowsOfCells(cellsAfter, g.cols)) setScanVersion((v) => v + 1);
    }

    // The widest line may have just got narrower, and the scrollbar should know, once the typing stops. A line over half the
    // width gone from the middle of a big edit is worth looking at too.
    const widest = seenCells.current;
    const narrowed = previous ? previous.cells >= widest && cache.get(edit.fromLine).cells < widest : applied.removed.length >= widest / 2;
    if (narrowed && widest > 0) {
      clearTimeout(widthTimer.current);
      widthTimer.current = setTimeout(() => {
        const measure = new LineScanner(source, tabSize, false);
        const step = () => {
          const end = performance.now() + 4;
          if (measure.run(() => performance.now() > end)) widthTimer.current = setTimeout(step, 16);
          else if (measure.maxCells < seenCells.current) {
            seenCells.current = measure.maxCells;
            render();
          }
        };
        step();
      }, WIDTH_RESCAN_MS);
    }

    // Tokens below an edit that opened or closed a comment are out of date right away, not a frame from now.
    lexing.current = !!lexerRef.current;
    runPass(EDIT_LEX_BUDGET);
    storeRef.current?.flushNow();
    inputDirty.current = true;
    afterEdit();
  }, [cache, runPass, source, tabSize]);

  const changeOf = useCallback((applied: AppliedEdit, origin: CodeEditOrigin): CodeEditorChange => ({
    from: toPublic(applied.from),
    to: toPublic(applied.to),
    newTo: toPublic(applied.newTo),
    text: applied.text,
    removed: applied.removed,
    origin: origin as CodeEditorChange['origin'],
  }), [toPublic]);

  /** Tells the host, and asks only for the text if something wants the text. */
  const report = useCallback((applied: AppliedEdit, origin: CodeEditOrigin) => {
    const change = changeOf(applied, origin);
    onEditRef.current?.(change);
    onChangeRef.current?.((textDocument as CodeDocument).getText(), change);
  }, [changeOf, textDocument]);

  /** Makes the text what the host says it is. */
  const applyValue = useCallback((next: string) => {
    const doc = textDocument as CodeDocument;
    if (composing.current || next === doc.getText()) return;
    const edit = editBetween(doc, next);
    if (!edit) return;
    const before = selectionRef.current ?? caretAt({ line: 0, offset: 0 });
    const applied = doc.replace(edit);
    followEdit(applied);
    const after = mapSelection(before, applied);
    select(after);
    history?.record(applied, 'value', before, after);
    history?.seal();
  }, [followEdit, history, select, textDocument]);

  /** A controlled host had its chance to answer, inside its `onChange`: an input's rules, and an input undoes what the host
      didn't take. */
  const settleValue = useCallback(({ applied, origin, before, after, parentLength, valueBefore, isUndo }: Unconfirmed) => {
    const doc = textDocument as CodeDocument;
    const current = valueRef.current;
    if (!isUndo && current === valueBefore && current !== doc.getText()) {
      const undone = doc.replace({ from: applied.from, to: applied.newTo, text: applied.removed });
      followEdit(undone);
      select(before);
      return;
    }
    if (!isUndo) history?.record(applied, origin, before, after, parentLength);
    if (current !== undefined) applyValue(current);
  }, [applyValue, followEdit, history, select, textDocument]);

  /* React finishes updates from this event in a microtask that's queued by now, so a microtask queued next sees the host's answer. If
     it hasn't answered by then, its render may just be running on another schedule, so it gets one more turn before it counts as no.
     A new edit doesn't wait: whatever's been heard by then is the answer. */
  const unconfirmedRef = useRef<Unconfirmed | null>(null);
  const answerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settleAnswer = useCallback(() => {
    clearTimeout(answerTimer.current);
    const unconfirmed = unconfirmedRef.current;
    if (!unconfirmed) return;
    unconfirmedRef.current = null;
    settleValue(unconfirmed);
  }, [settleValue]);
  const awaitAnswer = useCallback((unconfirmed: Unconfirmed) => {
    settleAnswer();
    unconfirmedRef.current = unconfirmed;
    queueMicrotask(() => {
      if (unconfirmedRef.current !== unconfirmed) return;
      if (valueRef.current !== unconfirmed.valueBefore) settleAnswer();
      else answerTimer.current = setTimeout(settleAnswer, 0);
    });
  }, [settleAnswer]);
  useLayoutEffect(() => () => {
    clearTimeout(answerTimer.current);
    unconfirmedRef.current = null;
  }, []);

  /** Makes an edit the writer asked for. */
  const execute = useCallback((command: EditCommand | null) => {
    if (!command || !textDocument) return false;
    settleAnswer();
    const before = selectionRef.current ?? caretAt({ line: 0, offset: 0 });
    const parentLength = command.edit.from.line === command.edit.to.line ? textDocument.get(command.edit.from.line).length : 0;
    const applied = textDocument.replace(command.edit);
    const after = command.after ?? caretAt(applied.newTo);
    followEdit(applied);
    goalRef.current = null;
    select(after);
    needsReveal.current = true;
    restartBlink();
    const { origin } = command;
    if (valueRef.current !== undefined && onChangeRef.current) {
      awaitAnswer({ applied, origin, before, after, parentLength, valueBefore: valueRef.current, isUndo: false });
      report(applied, origin);
    } else {
      history?.record(applied, origin, before, after, parentLength);
      report(applied, origin);
    }
    return true;
  }, [awaitAnswer, followEdit, history, report, select, settleAnswer, textDocument]);

  const undoOrRedo = useCallback((redo: boolean) => {
    if (!history || !textDocument || composing.current) return;
    settleAnswer();
    const step = redo ? history.redo() : history.undo();
    if (!step) return;
    const before = selectionRef.current ?? caretAt({ line: 0, offset: 0 });
    const applied = textDocument.replace(redo ? redoEdit(step) : undoEdit(step));
    followEdit(applied);
    goalRef.current = null;
    const after = redo ? step.after : step.before;
    select(after);
    needsReveal.current = true;
    restartBlink();
    const origin = redo ? 'redo' : 'undo';
    if (valueRef.current !== undefined) awaitAnswer({ applied, origin, before, after, parentLength: 0, valueBefore: valueRef.current, isUndo: true });
    report(applied, origin);
  }, [awaitAnswer, followEdit, history, report, select, settleAnswer, textDocument]);

  const deleteContext = useCallback(() => ({ document: source, metricsOf: (line: number) => cache.get(line), indent: detectIndent(source) }), [cache, source]);

  const currentSelection = () => selectionRef.current ?? caretAt({ line: 0, offset: 0 });

  const removeBy = useCallback((backward: boolean, unit: DeleteUnit) => {
    const current = selectionRef.current ?? caretAt({ line: 0, offset: 0 });
    return execute(backward ? deleteBackwardCommand(deleteContext(), current, unit) : deleteForwardCommand(deleteContext(), current, unit));
  }, [deleteContext, execute]);

  const moveBy = (move: CaretMove, extend: boolean) => {
    const current = currentSelection();
    const g = geometryRef.current;
    const context: MoveContext = {
      document: source,
      metricsOf: (line) => cache.get(line),
      map: g.map,
      cols: g.wrap ? g.cols : 0,
      pageRows: Math.max(1, Math.floor(g.height / g.lineHeight) - 1),
    };
    let target: CodePosition;
    if (!extend && !isCollapsed(current) && (move === 'left' || move === 'right')) {
      // An arrow with something selected goes to that side of it.
      const { from, to } = orderedSelection(current);
      target = move === 'left' ? from : to;
      goalRef.current = null;
    } else {
      const vertical = move === 'up' || move === 'down' || move === 'pageUp' || move === 'pageDown';
      const moved = moveCaret(current.focus, move, context, vertical ? goalRef.current : null);
      target = moved.position;
      goalRef.current = moved.goal;
    }
    history?.seal();
    select(extend ? { anchor: current.anchor, focus: target } : caretAt(target));
    needsReveal.current = true;
    restartBlink();
  };

  const handleEditorKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (composing.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
    menuOffered.current = false;
    const action = editorKeyAction(e, isMac());
    const wasEscaped = escaped.current;
    if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta' && e.key !== 'Tab') escaped.current = false;
    if (!action) return;
    switch (action.type) {
      case 'move':
        e.preventDefault();
        moveBy(action.move, action.extend);
        break;
      case 'deleteBackward':
      case 'deleteForward':
        e.preventDefault();
        removeBy(action.type === 'deleteBackward', action.unit);
        break;
      case 'newline':
        e.preventDefault();
        execute(newlineCommand(source, currentSelection()));
        break;
      case 'tab': {
        // After Esc, Tab is the browser's: the keyboard always has a way out.
        if (wasEscaped) break;
        e.preventDefault();
        const current = currentSelection();
        const indent = detectIndent(source);
        if (isCollapsed(current) && !action.outdent) execute(tabCommand(current, indent, (line) => cache.get(line)));
        else execute(indentCommand(source, current, indent, action.outdent));
        break;
      }
      case 'undo':
        e.preventDefault();
        undoOrRedo(false);
        break;
      case 'redo':
        e.preventDefault();
        undoOrRedo(true);
        break;
      case 'selectAll':
        e.preventDefault();
        history?.seal();
        selectAll();
        break;
      case 'escape': {
        escaped.current = true;
        const current = currentSelection();
        if (!isCollapsed(current)) select(caretAt(current.focus));
        break;
      }
    }
  };

  const handleCut = (e: ClipboardEvent<HTMLDivElement>) => {
    const current = selectionRef.current;
    if (!editable || e.target !== inputRef.current || !current || isCollapsed(current)) return;
    const copied = selectionText(current, readLine);
    e.clipboardData.setData('text/plain', copied.text);
    e.preventDefault();
    onCopyText?.(copied);
    const { from, to } = orderedSelection(current);
    execute({ edit: { from, to, text: '' }, origin: 'cut' });
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    if (!editable || e.target !== inputRef.current) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (text) execute(insertCommand(currentSelection(), text, 'paste'));
  };

  const handleInputFocus = () => {
    setFocused(true);
    onFocusChange?.(true);
    restartBlink();
    inputDirty.current = true;
    syncInput();
  };

  const handleInputBlur = () => {
    setFocused(false);
    onFocusChange?.(false);
    escaped.current = false;
    history?.seal();
    withdrawInput();
  };

  /* An input method's text is in the document while it's being written, so it takes up room and is colored like anything else,
     but it isn't an edit yet: nothing is told about it, and undo doesn't see it. The final text goes in as one edit. */
  const handleCompositionStart = () => {
    const current = currentSelection();
    const { from, to } = orderedSelection(current);
    composing.current = { from, end: to, original: (textDocument as CodeDocument).slice(from, to), before: current };
    history?.seal();
    needsReveal.current = true;
    afterEdit();
  };

  const handleCompositionUpdate = (e: ReactCompositionEvent<HTMLTextAreaElement>) => {
    const composition = composing.current;
    if (!composition || !textDocument) return;
    const applied = textDocument.replace({ from: composition.from, to: composition.end, text: e.data });
    composition.end = applied.newTo;
    followEdit(applied);
    select(caretAt(applied.newTo));
    needsReveal.current = true;
    restartBlink();
  };

  const handleCompositionEnd = (e: ReactCompositionEvent<HTMLTextAreaElement>) => {
    const composition = composing.current;
    if (!composition || !textDocument) return;
    composing.current = null;
    const restored = textDocument.replace({ from: composition.from, to: composition.end, text: composition.original });
    followEdit(restored);
    select(composition.before);
    if (e.data) execute(insertCommand(composition.before, e.data, 'composition'));
    inputDirty.current = true;
    syncInput();
  };

  /** Keys that say what they did, rather than which key they were: a phone's keyboard above all. What a key press already
      handled never gets this far, because `preventDefault` on the key stops it. Anything not listed here is left to the browser,
      and `handleInput` works out what it did to the stand-in. */
  const handleBeforeInput = useCallback((e: InputEvent) => {
    if (composing.current || e.isComposing) return;
    const current = selectionRef.current ?? caretAt({ line: 0, offset: 0 });
    const remove = (backward: boolean, unit: DeleteUnit) => {
      e.preventDefault();
      removeBy(backward, unit);
    };
    switch (e.inputType) {
      case 'insertText':
        e.preventDefault();
        if (e.data) execute(insertCommand(current, e.data));
        break;
      case 'insertLineBreak':
      case 'insertParagraph':
        e.preventDefault();
        execute(newlineCommand(source, current));
        break;
      case 'deleteContentBackward':
        remove(true, 'char');
        break;
      case 'deleteContentForward':
        remove(false, 'char');
        break;
      case 'deleteWordBackward':
        remove(true, 'word');
        break;
      case 'deleteWordForward':
        remove(false, 'word');
        break;
      case 'deleteSoftLineBackward':
      case 'deleteHardLineBackward':
        remove(true, 'line');
        break;
      case 'deleteSoftLineForward':
      case 'deleteHardLineForward':
        remove(false, 'line');
        break;
      case 'historyUndo':
        e.preventDefault();
        undoOrRedo(false);
        break;
      case 'historyRedo':
        e.preventDefault();
        undoOrRedo(true);
        break;
      default:
    }
  }, [execute, removeBy, source, undoOrRedo]);

  /** Whatever got past `beforeinput` changed the stand-in itself: autocorrect, say. The difference is the edit. */
  const handleInput = useCallback(() => {
    const input = inputRef.current;
    if (!input || composing.current) return;
    const before = standIn.current;
    const after = input.value;
    if (after === before.text) return;
    const current = selectionRef.current ?? caretAt({ line: 0, offset: 0 });
    if (before.selection) {
      execute(insertCommand(current, after));
    } else {
      const mark = STAND_IN_MARK.length;
      const a = before.text.slice(mark);
      const b = after.startsWith(STAND_IN_MARK) ? after.slice(mark) : after;
      if (a === b) {
        // Only the mark went: a keyboard's Backspace at the very start of what the input holds.
        removeBy(true, 'char');
        inputDirty.current = true;
        syncInput();
        return;
      }
      let prefix = 0;
      while (prefix < a.length && prefix < b.length && a.charCodeAt(prefix) === b.charCodeAt(prefix)) prefix++;
      let suffix = 0;
      while (suffix < a.length - prefix && suffix < b.length - prefix && a.charCodeAt(a.length - 1 - suffix) === b.charCodeAt(b.length - 1 - suffix)) suffix++;
      execute({
        edit: {
          from: { line: before.line, offset: before.start + prefix },
          to: { line: before.line, offset: before.start + a.length - suffix },
          text: b.slice(prefix, b.length - suffix),
        },
        origin: 'input',
      });
    }
    inputDirty.current = true;
    syncInput();
  }, [execute, removeBy, syncInput]);

  /** A Select All from the input's own context menu can only select the stand-in: this makes it mean all of it. */
  const handleInputSelect = useCallback(() => {
    const input = inputRef.current;
    const current = selectionRef.current;
    if (!input || !menuOffered.current || !current || !isCollapsed(current) || composing.current) return;
    if (input.value.length > 0 && input.selectionStart === 0 && input.selectionEnd === input.value.length) selectAll();
  }, [selectAll]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.addEventListener('beforeinput', handleBeforeInput);
    input.addEventListener('input', handleInput);
    input.addEventListener('select', handleInputSelect);
    return () => {
      input.removeEventListener('beforeinput', handleBeforeInput);
      input.removeEventListener('input', handleInput);
      input.removeEventListener('select', handleInputSelect);
    };
  }, [handleBeforeInput, handleInput, handleInputSelect, editable]);

  /* A right click's menu has what the thing under the pointer offers. For it to have Paste, that has to be the input. */
  const offerInputAt = (clientX: number, clientY: number) => {
    const input = inputRef.current;
    const root = rootRef.current;
    if (!input || !root) return;
    const rect = root.getBoundingClientRect();
    offered.current = true;
    menuOffered.current = true;
    input.style.pointerEvents = 'auto';
    input.style.width = '8px';
    input.style.transform = `translate(${clientX - rect.left - 4}px,${clientY - rect.top - 4}px)`;
  };

  const withdrawInput = useCallback(() => {
    const input = inputRef.current;
    if (!input || !offered.current) return;
    offered.current = false;
    input.style.pointerEvents = '';
    input.style.width = '';
    placeInput();
  }, [placeInput]);

  /* A `value` from outside. What the host passes back from `onChange` is the very string it was given, which compares at once:
     no parsing, no joining. Anything else is worked out as the edit it amounts to, so the caret and undo carry on. */
  useLayoutEffect(() => {
    if (editable && value !== undefined) applyValue(value);
  }, [editable, value, applyValue]);

  /* Keyboard: one tab stop among gutter buttons and markers, arrow keys between them. */
  const activeControl = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef<{ key: string; from: number; direction: 1 | -1; tries: number } | null>(null);

  const rowElements = useCallback((row: number) => {
    const root = rootRef.current as HTMLDivElement;
    return root.querySelectorAll<HTMLElement>(`[data-slot="code-editor-gutter-row"][data-row="${row}"],[data-slot="code-editor-line"][data-row="${row}"]`);
  }, []);

  /** The next control with the same key (a gutter's id, or `marker`) going up or down; scrolls if it's past what's rendered. */
  const moveVertically = useCallback((key: string, from: number, direction: 1 | -1, tries: number) => {
    const g = geometryRef.current;
    const v = viewRef.current;
    const selector = `[data-code-editor-cell="${CSS.escape(key)}"]`;
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
    pendingScroll.current = { y: inWindow ? scrollRef.current.y + direction * span : alignedScroll(from * g.lineHeight + g.padY, g.lineHeight, g.height, 0, 'center') };
    applyPendingScroll();
  }, [applyPendingScroll, rowElements]);

  const moveFocus = (target: HTMLElement, key: string) => {
    const owner = target.closest<HTMLElement>('[data-row]');
    if (!owner) return false;
    const row = Number(owner.dataset.row);
    const cellKey = target.closest<HTMLElement>('[data-code-editor-cell]')?.dataset.codeEditorCell;
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
    if (target === inputRef.current) {
      handleEditorKey(e);
      return;
    }
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
    // The menu is the input's by now: it can go back to the caret, and a Select All from it will still be noticed.
    if (offered.current) setTimeout(withdrawInput, 0);
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
    const position = row * g.lineHeight + g.padY;
    const { y } = scrollRef.current;
    const active = document.activeElement;
    if ((position < y || position + g.lineHeight > y + g.height) && active?.matches(':focus-visible') && (rootRef.current as HTMLDivElement).contains(active) && active !== inputRef.current) {
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
      const topRow = Math.max(0, Math.floor((scrollRef.current.y - before.padY) / before.lineHeight));
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
    const first = visibleRows(scrollRef.current.y - geometry.padY, geometry.height, geometry.lineHeight, geometry.map.rowCount);
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

    // With no height of its own the view grows with the file, and a row added at the bottom has to be in view before it's seen.
    const measured = root.clientHeight;
    if (measured !== size.height || root.clientWidth !== size.width) setSize({ width: root.clientWidth, height: measured });
    if (needsReveal.current) {
      needsReveal.current = false;
      revealCaret();
    }
    if (inputDirty.current) syncInput();
    placeInput();
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

  useImperativeHandle(handleRef, () => ({
    scrollToLine: (line, options) => scrollLineIntoView(line, options),
    getSelection: () => {
      const current = selectionRef.current;
      return current ? { anchor: toPublic(current.anchor), focus: toPublic(current.focus) } : null;
    },
    getSelectionText: () => {
      const current = selectionRef.current;
      return current ? selectionText(current, readLine).text : '';
    },
    setSelection: (next) => {
      const at = (p: CodeEditorPosition): CodePosition => {
        const line = clamp(p.line - startLineRef.current, 0, Math.max(0, source.count - 1));
        return { line, offset: clamp(p.column, 0, readLine(line).length) };
      };
      history?.seal();
      goalRef.current = null;
      select(next ? { anchor: at(next.anchor), focus: at(next.focus) } : editable ? selectionRef.current && caretAt(selectionRef.current.focus) : null);
      syncProxy();
    },
    selectAll,
    focus: focusEditor,
    getValue: () => {
      if (textDocument) return textDocument.getText();
      return Array.from({ length: source.count }, (_, i) => readLine(i)).join('\n');
    },
  }), [readLine, scrollLineIntoView, select, selectAll, source, syncProxy, toPublic, textDocument, editable, history, focusEditor]);

  /* Rendering. */
  store?.beginFrame(rows.length ? rows[0].line : 0, rows.length ? rows[rows.length - 1].line + 1 : 0);

  const markerLookup = useMemo(() => {
    if (!markers) return null;
    if (typeof markers === 'function') return markers;
    const byLine = new Map<number, CodeEditorMarker[]>();
    for (const marker of markers) {
      if (marker.line === undefined) continue;
      const list = byLine.get(marker.line);
      if (list) list.push(marker);
      else byLine.set(marker.line, [marker]);
    }
    return (lineNumber: number) => byLine.get(lineNumber);
  }, [markers]);

  const ordered = selection ? orderedSelection(selection) : null;
  const composition = composing.current;
  const composed = composition ? { from: composition.from, to: composition.end } : null;
  const caretLine = editable && selection ? selection.focus.line : -1;
  const caretPlace = editable && focused && selection
    ? rowOfPosition(selection.focus, cache.get(selection.focus.line), rowMap, wrap ? cols : 0)
    : null;
  const bands: ReactNode[] = [];
  const gutterRows: ReactNode[] = [];
  const codeRows: ReactNode[] = [];
  for (const { row, line, part, metrics } of rows) {
    const lineNumber = line + startLine;
    // A row kept only for its focus is out of view anyway: it needn't stretch the layers by millions of px.
    const top = (clamp(row, windowRows.start - 1, windowRows.end) - view.originRow) * lineHeight;
    const decoration = lineDecoration?.(lineNumber) ?? null;
    const current = currentLine === lineNumber;
    const tint = decoration?.tint ?? (current ? 'current' : null);
    if (tint || decoration?.className) {
      bands.push(<div key={row} data-slot="code-editor-band" data-tint={tint ?? undefined} className={cn(codeEditorLineVariants({ tint: tint ?? 'none' }), decoration?.className)} style={{ top }} />);
    }
    const mark = lineMarks.added.has(lineNumber) ? 'add' : lineMarks.removed.has(lineNumber) ? 'del' : lineMarks.marked.has(lineNumber) ? 'highlight' : null;
    if (mark) {
      bands.push(<div key={`${row}:mark`} data-slot="code-editor-band" data-mark={mark} className={cn(codeEditorLineVariants(), 'bl-code-band')} style={{ top }} />);
    }
    if (part === 0 && gutters.length) {
      gutterRows.push(
        <GutterRow key={row} row={row} line={line} lineNumber={lineNumber} top={top} gutters={gutters} current={current || (focused && line === caretLine)} gutterClassName={decoration?.gutterClassName}
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

    let composingLeft = 0;
    let composingWidth = 0;
    if (composed) {
      const cells = selectionCells(composed, line, metrics);
      if (cells) {
        const from = Math.max(cells.start, wrap ? firstCell : view.cells.start);
        const to = Math.min(cells.end, lastCell);
        if (to > from) {
          composingLeft = CODE_PADDING + (from - firstCell) * cellWidth;
          composingWidth = (to - from) * cellWidth;
        }
      }
    }

    let columnLeft = -1;
    if (current && currentColumn != null) {
      const cell = metrics.cellAt(currentColumn);
      if (cell >= (wrap ? firstCell : view.cells.start) && cell < lastCell) columnLeft = CODE_PADDING + (cell - firstCell) * cellWidth;
    }

    let rowMarkers: (CodeEditorMarker & { left: number })[] | null = null;
    const lineMarkers = markerLookup?.(lineNumber);
    if (lineMarkers?.length) {
      // Markers past the end of the line are shown at its end.
      const inRange = markersInRange(lineMarkers, span.start, lastRowOfLine ? Infinity : span.end);
      if (inRange.length) {
        rowMarkers = inRange.map((marker) => ({ ...marker, left: CODE_PADDING + (metrics.cellAt(marker.column) - firstCell) * cellWidth }));
      }
    }

    codeRows.push(
      <CodeRow key={row} metrics={metrics} store={store} row={row} rowCount={rowCount} line={line} lineNumber={lineNumber} top={top} start={span.start} end={span.end} left={left}
        selectionLeft={selectionLeft} selectionWidth={selectionWidth} composingLeft={composingLeft} composingWidth={composingWidth} columnLeft={columnLeft}
        textClassName={decoration?.textClassName} extra={part === 0 ? lineProps?.(lineNumber) : undefined} markers={rowMarkers} onFocusLine={onFocusLine} onBlurLine={onBlurLine} />,
    );
  }

  const label = ariaLabel ?? 'Source code';
  let caret: ReactNode = null;
  if (caretPlace && caretPlace.row >= windowRows.start && caretPlace.row < Math.min(windowRows.end, rowCount)) {
    const cell = wrap ? caretPlace.cell : caretPlace.cell - view.originCell;
    caret = (
      <div
        key={blink}
        data-slot="code-editor-caret"
        aria-hidden="true"
        className="bl-code-caret pointer-events-none absolute w-0.5 bg-(--bl-syntax-caret,var(--foreground))"
        style={{ top: (caretPlace.row - view.originRow) * lineHeight, height: lineHeight, left: CODE_PADDING + cell * cellWidth - 1 }}
      />
    );
  }

  const extentWidth = physicalSize(virtualWidth + gutterWidth);
  const extentHeight = physicalSize(virtualHeight);

  return (
    <div
      ref={rootRef}
      data-slot="code-editor-content"
      data-wrap={wrap || undefined}
      data-editable={editable || undefined}
      dir="ltr"
      role={editable ? undefined : 'region'}
      aria-label={editable ? undefined : label}
      tabIndex={editable ? undefined : 0}
      onKeyDown={handleKeyDown}
      onCopy={handleCopy}
      onCut={handleCut}
      onPaste={handlePaste}
      onContextMenu={handleContextMenu}
      className={cn(
        // The box inside is the size of the file: `contain` keeps that from sizing this, or a grid or flex parent, to millions of px.
        'group/code-editor bl-scroll relative min-h-0 w-full min-w-0 flex-1 overflow-auto overscroll-x-contain leading-(--code-editor-line) outline-none [contain:inline-size] [font-kerning:none] [font-variant-ligatures:none] [overflow-anchor:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        wrap && 'overflow-x-hidden',
        className,
      )}
      style={{ '--code-editor-line': `${lineHeight}px`, '--code-editor-cell': `${cellWidth}px`, maxHeight: maxHeight ?? MAX_VIEW_HEIGHT, ...style } as CSSProperties}
    >
      <div data-slot="code-editor-extent" className="relative" style={{ width: Math.max(size.width, extentWidth), height: extentHeight }}>
        <div
          data-slot="code-editor-viewport"
          className="sticky top-0 left-0 overflow-clip select-none [contain:strict]"
          style={{ width: size.width, height }}
          // Without this a press moves the focus off the input, and starts the browser's own selection.
          onMouseDown={editable ? (e) => {
            const target = e.target as Element;
            // A popover from a gutter cell is in this tree as far as React's events go, wherever it is in the page.
            if (!e.currentTarget.contains(target) || target === inputRef.current || target.closest(CONTROL_SELECTOR)) return;
            e.preventDefault();
            focusEditor();
          } : undefined}
        >
          {editable ? (
            <textarea
              ref={inputRef}
              data-slot="code-editor-input"
              role="textbox"
              aria-multiline="true"
              aria-readonly="false"
              aria-label={label}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              wrap="off"
              rows={1}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onCompositionStart={handleCompositionStart}
              onCompositionUpdate={handleCompositionUpdate}
              onCompositionEnd={handleCompositionEnd}
              className="pointer-events-none absolute top-0 left-0 z-20 m-0 h-(--code-editor-line) w-px resize-none overflow-hidden border-0 bg-transparent p-0 text-body whitespace-pre text-transparent caret-transparent opacity-0 outline-none select-text"
            />
          ) : null}
          <span ref={probeRef} aria-hidden="true" className="invisible absolute top-0 left-0 whitespace-pre">{PROBE}</span>
          <span ref={proxyRef} aria-hidden="true" data-slot="code-editor-copy-proxy" className="sr-only whitespace-pre select-text" />
          {gutterWidth > 0 ? <div className="absolute inset-y-0 left-0 border-r border-border" style={{ width: gutterWidth }} /> : null}
          <div ref={yLayerRef} data-slot="code-editor-gutter" className="absolute top-0 left-0 w-full will-change-transform">
            {bands}
            {gutterRows}
          </div>
          <div
            ref={clipRef}
            data-slot="code-editor-code"
            className="absolute inset-y-0 right-0 cursor-text overflow-clip [-webkit-touch-callout:none]"
            style={{ left: gutterWidth }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <div ref={xyLayerRef} role="list" className="absolute top-0 left-0 w-full will-change-transform [unicode-bidi:bidi-override]">
              {codeRows}
              {caret}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

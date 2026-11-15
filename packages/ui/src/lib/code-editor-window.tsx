'use client';
import {
  Fragment, memo, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore,
  type ClipboardEvent, type CompositionEvent as ReactCompositionEvent, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type MouseEvent,
  type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode, type Ref,
} from 'react';
import { flushSync } from 'react-dom';
import { bindDrag, bindHold, type ChangeDetails, type ChangeSource } from '@ui-sdk/core';
import { Button as SdkButton, type ButtonActionDetails } from '@ui-sdk/react/button';
import { usePart, usePrimitive, type PartProps, type PrimitiveHandle } from '@ui-sdk/react/primitive';
import { cva } from 'class-variance-authority';
import { changeDetails } from '@/lib/change-details';
import { codeEditorControlKey, codeEditorControls, type CodeEditorControlProps } from '@/lib/code-editor-primitive';
import { prefersReducedMotion } from '@/lib/reduced-motion';
import {
  CodeLexer, CodeTokenStore, DEFAULT_TAB_SIZE, LineCache, LineScanner, alignedScroll, comparePositions, displayPieces,
  extendSelection, hostProducer, identityRowMap, isCollapsed, lexerProducer, lineSet, markersInRange, movePosition, nextCellWindow, nextRowWindow,
  orderedSelection, originOf, physicalSize, revealScroll, selectionCells, selectionText, toPhysicalScroll, toVirtualScroll,
  visibleCells, visibleRows, wordAt, wrapRowMap, wrappedSpan,
  type CodeHighlight, type CodeLineRange, type CodePosition, type CodeSelection, type CodeToken, type CodeEditorAlign, type DisplayPiece, type LineMetrics,
  type LineSource, type RowMap, type SelectionGranularity, type SelectionKey, type Span,
} from '@/lib/code-editor-model';
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
   DOM: a monospace line is a grid of cells (lib/code-editor-model.ts), so what's on screen is arithmetic, and only that is rendered.

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
/** The fastest a drag past an edge scrolls, in px a frame. */
const EDGE_SCROLL_MAX = 4000;

const SELECTION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
const FOCUSABLE = ':is(button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex])';
const CONTROL_SELECTOR = `[data-code-editor-cell]${FOCUSABLE},[data-code-editor-cell] ${FOCUSABLE}`;

type Controls = PrimitiveHandle<typeof codeEditorControls>;

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
  'absolute top-0 z-10 flex h-full w-3.5 -translate-x-1/2 cursor-pointer items-start justify-center border-0 bg-transparent p-0 outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring';

/* ── Types ── */

/** What a gutter button's `onClick` gets after the event: UI SDK's button details, and the line. */
export type CodeEditorGutterClickDetails = ButtonActionDetails & { line: number };

export interface CodeEditorGutter {
  id: string;
  /** Width in px. */
  width: number;
  /** A cell's contents: anything. A control in it (a popover's trigger, an input) takes part in the gutter's keyboard
      navigation; say which lines have one with `focusable`, so the arrow keys can reach those that aren't on screen. */
  render: (lineNumber: number) => ReactNode;
  /** Makes the cell a button. */
  onClick?: (event: MouseEvent<HTMLElement>, details: CodeEditorGutterClickDetails) => void;
  /** Whether this line's cell can be pressed (default: all of them, given `onClick`). */
  clickable?: (lineNumber: number) => boolean;
  /** Without `onClick`: the lines whose cell holds a control of its own, for the arrow keys. */
  focusable?: (lineNumber: number) => boolean;
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
  onClick?: (event: MouseEvent<HTMLElement>, details: CodeEditorMarkerClickDetails) => void;
  /** A marker that toggles (a column breakpoint that is set): filled in, and announced as pressed (`aria-pressed`). Leave it
      out for a marker that isn't a toggle. */
  pressed?: boolean;
  title?: string;
  className?: string;
  /** Replaces the default dot. */
  children?: ReactNode;
}

/** What a marker's `onClick` gets after the event: UI SDK's button details, the marker and its line. */
export type CodeEditorMarkerClickDetails = ButtonActionDetails & { marker: CodeEditorMarker; line: number };

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

/** What made an edit: typing (`input-change`), a delete key (`delete`), `newline`, `indent`, `paste`, `cut`, an input method
    (`composition`), `undo`, `redo`, or a call from code (`imperative`: an agent's `setValue`). */
export type CodeEditorChangeReason = 'input-change' | 'delete' | 'newline' | 'indent' | 'paste' | 'cut' | 'composition' | 'undo' | 'redo' | 'imperative';

/** An edit: what was replaced, and with what. */
export interface CodeEditorEdit {
  /** Where the replaced range starts and ends, in the text before the change. */
  from: CodeEditorPosition;
  to: CodeEditorPosition;
  /** Where the new text ends, in the text after the change. */
  newTo: CodeEditorPosition;
  /** What went in, with `\n` for line ends. */
  text: string;
  /** What came out, with `\n` for line ends. */
  removed: string;
}

/** What `onValueChange` and `onEdit` get: UI SDK's change details (`reason`, `event`, `source`, `cancel()`), and the edit.
    `cancel()` takes the edit back in an editor without `value`; with `value`, what you pass back decides. */
export type CodeEditorValueChangeDetails = ChangeDetails<CodeEditorChangeReason> & CodeEditorEdit;

/** Why the selection moved: an edit (its reason), a press (`press`: a click, a double or triple click, a long press),
    a drag, a key that moves the caret or extends the selection (`caret-move`), Select All (`select-all`), Escape, or code
    and new content (`imperative`). */
export type CodeEditorSelectionChangeReason = CodeEditorChangeReason | 'press' | 'drag' | 'caret-move' | 'select-all' | 'escape-key' | 'imperative';

/** What `onSelectionChange` gets. `cancel()` keeps the selection as it was, except after an edit or new content, which the
    caret has to follow. */
export type CodeEditorSelectionChangeDetails = ChangeDetails<CodeEditorSelectionChangeReason>;

const reasonOf = (origin: CodeEditOrigin): CodeEditorChangeReason => (origin === 'input' || origin === 'value' ? 'input-change' : origin);
const isEditReason = (reason: CodeEditorSelectionChangeReason) =>
  reason !== 'press' && reason !== 'drag' && reason !== 'caret-move' && reason !== 'select-all' && reason !== 'escape-key' && reason !== 'imperative';

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
  onValueChange?: (value: string, details: CodeEditorValueChangeDetails) => void;
  /** Every edit, without the whole text joined. */
  onEdit?: (details: CodeEditorValueChangeDetails) => void;
  language?: string;
  /** Beside the code, in this order. They stay put when the code scrolls sideways. */
  gutters?: readonly CodeEditorGutter[];
  /** The built-in line number gutter: next to the code (`true`, `end`), first (`start`), or none. */
  lineNumbers?: boolean | 'start' | 'end';
  onLineNumberClick?: (event: MouseEvent<HTMLElement>, details: CodeEditorGutterClickDetails) => void;
  lineNumberClickable?: (lineNumber: number) => boolean;
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
  onSelectionChange?: (selection: CodeEditorSelection | null, details: CodeEditorSelectionChangeDetails) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

/* ── Rows ── */

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
  /** With where each one goes, and its place among the line's markers. */
  markers: readonly (CodeEditorMarker & { left: number; index: number })[] | null;
  controls: Controls;
  onFocusLine: (line: number) => void;
  onBlurLine: (line: number) => void;
}

const CodeRow = memo(function CodeRow({
  metrics, store, row, rowCount, line, lineNumber, top, start, end, left, selectionLeft, selectionWidth, composingLeft, composingWidth, columnLeft, textClassName, extra, markers,
  controls, onFocusLine, onBlurLine,
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
      {markers?.map((marker) => <Marker key={marker.index} marker={marker} line={line} lineNumber={lineNumber} controls={controls} />)}
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
    marker.column === n[i].column && marker.index === n[i].index && marker.left === n[i].left && marker.label === n[i].label && marker.pressed === n[i].pressed &&
    marker.onClick === n[i].onClick && marker.className === n[i].className && marker.children === n[i].children && marker.title === n[i].title
  ));
});

function Marker({ marker, line, lineNumber, controls }: { marker: CodeEditorMarker & { left: number; index: number }; line: number; lineNumber: number; controls: Controls }) {
  // A notch over the column, in the space above the letters, so it doesn't cover what it points at.
  const dot = marker.children ?? (
    <svg
      aria-hidden="true"
      viewBox="0 0 8 5"
      className={cn(
        'mt-0.5 block h-[5px] w-2 fill-current',
        marker.pressed ? 'text-primary' : 'text-muted-foreground/50 group-hover/marker:text-primary/70',
      )}
    >
      <path d="M0 0h8L4 5z" />
    </svg>
  );
  if (!marker.onClick) {
    return (
      <span
        data-code-editor-cell="marker"
        data-slot="code-editor-marker"
        data-pressed={marker.pressed || undefined}
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
  return <MarkerButton marker={marker} line={line} lineNumber={lineNumber} controls={controls}>{dot}</MarkerButton>;
}

/** A marker that's a button: one of the editor's controls (lib/code-editor-primitive.ts), rendered as UI SDK's Button. */
function MarkerButton({ marker, line, lineNumber, controls, children }: {
  marker: CodeEditorMarker & { left: number; index: number }; line: number; lineNumber: number; controls: Controls; children: ReactNode;
}) {
  const column = `marker:${marker.index}`;
  return usePart(controls, 'control', { value: codeEditorControlKey(line, column), line, column, at: marker.column }, {
    render: (
      <SdkButton
        data-code-editor-cell="marker"
        data-pressed={marker.pressed || undefined}
        aria-label={marker.label}
        aria-pressed={marker.pressed}
        title={marker.title}
        onClick={(event, details) => marker.onClick?.(event, { ...details, marker, line: lineNumber })}
        className={cn('group/marker', MARKER_CLASS, marker.className)}
        style={{ left: marker.left }}
      />
    ),
    children,
  });
}

function GutterCell({ gutter, line, lineNumber, gutterClassName, controls }: { gutter: CodeEditorGutter; line: number; lineNumber: number; gutterClassName?: string; controls: Controls }) {
  const pressable = !!gutter.onClick && (gutter.clickable?.(lineNumber) ?? true);
  const content = gutter.render(lineNumber);
  const className = cn(codeEditorGutterCellVariants({ align: gutter.align }), gutter.className, gutterClassName);
  const style = { width: gutter.width } satisfies CSSProperties;
  const title = gutter.title?.(lineNumber);
  if (!pressable && BUILT_IN_GUTTERS.has(gutter.id)) {
    return (
      <div data-code-editor-cell={gutter.id} data-slot="code-editor-gutter-cell" data-gutter={gutter.id} title={title} className={className} style={style}>
        {content}
      </div>
    );
  }
  const slotProps = { value: codeEditorControlKey(line, gutter.id), line, column: gutter.id, at: -1 };
  if (!pressable) {
    return <GutterCellPart controls={controls} slotProps={slotProps} gutter={gutter} title={title} className={className} style={style}>{content}</GutterCellPart>;
  }
  return (
    <GutterButton controls={controls} slotProps={slotProps}>
      <SdkButton
        data-code-editor-cell={gutter.id}
        data-gutter={gutter.id}
        aria-label={gutter.label?.(lineNumber) ?? `${gutter.id}, line ${lineNumber}`}
        title={title}
        onClick={(event, details) => gutter.onClick?.(event, { ...details, line: lineNumber })}
        className={cn('cursor-pointer border-0 bg-transparent p-0 [font-family:inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset hover:bg-secondary active:bg-secondary-strong', className)}
        style={style}
      >
        {content}
      </SdkButton>
    </GutterButton>
  );
}

/** The textarea an editable editor types into: the controls' `input` part, so agents find the editor by its name. */
function EditorInput({ controls, ...props }: { controls: Controls } & PartProps<'textarea'>) {
  return usePart(controls, 'input', {}, props, 'textarea');
}

/** A gutter cell that's a button: the button joins the editor's controls. */
function GutterButton({ controls, slotProps, children }: { controls: Controls; slotProps: CodeEditorControlProps; children: ReactElement<Record<string, unknown>> }) {
  return usePart(controls, 'control', slotProps, { render: children });
}

/** A gutter cell that isn't a button: a control in it, if any, joins the editor's controls. */
function GutterCellPart({ controls, slotProps, gutter, title, className, style, children }: {
  controls: Controls; slotProps: CodeEditorControlProps; gutter: CodeEditorGutter; title?: string; className: string; style: CSSProperties; children: ReactNode;
}) {
  return usePart(controls, 'gutter-cell', slotProps, { 'data-code-editor-cell': gutter.id, 'data-gutter': gutter.id, title, className, style, children } as Record<string, unknown>, 'div');
}

/** The editor's own gutters, which hold no controls but a button of their own. */
const BUILT_IN_GUTTERS = new Set(['line-number', 'diff-sign']);

const GutterRow = memo(function GutterRow({ row, line, lineNumber, top, gutters, current, gutterClassName, controls, onFocusLine, onBlurLine }: {
  row: number;
  line: number;
  lineNumber: number;
  top: number;
  gutters: readonly CodeEditorGutter[];
  current: boolean;
  gutterClassName?: string;
  controls: Controls;
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
      {gutters.map((gutter) => <GutterCell key={gutter.id} gutter={gutter} line={line} lineNumber={lineNumber} gutterClassName={gutterClassName} controls={controls} />)}
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
  /** What was selected when the drag started: a point, a word or a line. */
  base: CodeSelection;
  granularity: SelectionGranularity;
  x: number;
  y: number;
  /** The pointer event it's at. */
  event: PointerEvent;
  /** The edge scroll's frame. */
  frame: number;
  touch: boolean;
  /** Ends `bindDrag`'s part. */
  release: () => void;
}

export function CodeEditorWindow({
  handleRef, lines, lineCount, getLine, contentKey, document: textDocument, editable = false, history, selectionStore, value, onValueChange, onEdit, language,
  gutters: gutterProp, lineNumbers = true, onLineNumberClick, lineNumberClickable, lineNumberLabel, lineNumberTitle, startLine = 1, highlightLines, addedLines, removedLines,
  lineProps, currentLine, currentColumn, revealCurrentLine = true, lineDecoration, markers, scrollToLine, highlight: highlightProp, engine, wrap = false, maxHeight,
  tabSize = DEFAULT_TAB_SIZE, lineHeight = 20, maxLineLength, paddingY = 0, onCopyText, onSelectionChange, className, style, onKeyDown, onContextMenu,
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
  // The page renderer's gutter, to the pixel: the digits, 16px before them and 12px after (`.bl-syntax-ln`).
  const lineNumberWidth = Math.ceil(digits * cellWidth) + 28;
  const lineNumberGutter = useMemo<CodeEditorGutter | null>(() => {
    if (lineNumbers === false) return null;
    return {
      id: 'line-number',
      width: lineNumberWidth,
      align: 'end',
      // The current line's number reads in full ink; a pressable one (a breakpoint target) stays muted until hovered.
      className: 'pr-3 pl-4 text-tertiary-foreground group-data-current/gutter:[&:not(button)]:text-foreground [&:is(button)]:text-muted-foreground [&:is(button)]:hover:text-foreground',
      render: (lineNumber) => <span aria-hidden="true">{lineNumber}</span>,
      onClick: onLineNumberClick,
      clickable: lineNumberClickable,
      label: lineNumberLabel ?? ((lineNumber) => `Line ${lineNumber}`),
      title: lineNumberTitle,
    };
  }, [lineNumbers, lineNumberWidth, onLineNumberClick, lineNumberClickable, lineNumberLabel, lineNumberTitle]);
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
    if (target.smooth && !prefersReducedMotion()) {
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

  /* A caret is a selection with both ends at the same place, and only an editor has one. The host hears first, and can keep the
     selection where it is, except after an edit or new content, which the caret has to follow. */
  const select = useCallback((next: CodeSelection | null, given: { reason: CodeEditorSelectionChangeReason; event?: Event }) => {
    const value = next && isCollapsed(next) && !editableRef.current ? null : next;
    const prev = selectionRef.current;
    if (prev === value) return;
    if (prev && value && comparePositions(prev.anchor, value.anchor) === 0 && comparePositions(prev.focus, value.focus) === 0) return;
    const listener = onSelectionChangeRef.current;
    if (listener) {
      const details = changeDetails(given);
      listener(value ? { anchor: toPublic(value.anchor), focus: toPublic(value.focus) } : null, details);
      if (details.canceled && given.reason !== 'imperative' && !isEditReason(given.reason)) return;
    }
    selectionRef.current = value;
    if (value && selectionStore) selectionStore.current = value;
    inputDirty.current = true;
    setSelectionState(value);
  }, [selectionStore, toPublic]);

  const readLine = useCallback((line: number) => source.get(line) ?? '', [source]);

  // Positions in the old content mean nothing in the new.
  const selectedIn = useRef(source);
  useLayoutEffect(() => {
    if (selectedIn.current === source) return;
    selectedIn.current = source;
    caretRef.current = null;
    select(editableRef.current ? caretAt({ line: 0, offset: 0 }) : null, { reason: 'imperative' });
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

  const updateDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    select(extendSelection(drag.base, positionAt(drag.x, drag.y), drag.granularity, readLine, source.count), { reason: 'drag', event: drag.event });
  }, [positionAt, readLine, select, source]);
  scrolledDuringDrag.current = updateDrag;

  /* Dragging past an edge of the view scrolls it, faster the further past the edge the pointer is, so a drag reaches the end
     of half a million lines. UI SDK's `createAutoScroll` scrolls whatever is under the pointer once it nears an edge from
     inside, at most 18 px a frame, and goes on to the page: a selection drag goes on past the view's edge, and scrolls only
     the view (gaps/r3-composites-b.md). */
  const edgeScroll = useCallback(() => {
    const drag = dragRef.current;
    const clip = clipRef.current;
    const root = rootRef.current;
    if (!drag || !clip || !root) return;
    const rect = clip.getBoundingClientRect();
    const speed = (past: number) => Math.min(EDGE_SCROLL_MAX, past * past / 8 + past / 2 + 1);
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
    drag.frame = requestAnimationFrame(edgeScroll);
  }, [sync, updateDrag]);

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    cancelAnimationFrame(drag.frame);
    drag.release();
    dragRef.current = null;
    syncProxy();
    syncInputRef.current();
  }, [syncProxy]);

  /** Follows the pointer that pressed, with UI SDK's `bindDrag`: pointer capture, a move a frame, the last one before the end. */
  const startDrag = useCallback((down: PointerEvent, base: CodeSelection, granularity: SelectionGranularity, touch: boolean) => {
    const clip = clipRef.current;
    if (!clip) return;
    const drag: Drag = { base, granularity, x: down.clientX, y: down.clientY, event: down, frame: 0, touch, release: () => {} };
    dragRef.current = drag;
    drag.frame = requestAnimationFrame(edgeScroll);
    drag.release = bindDrag(clip, down, {
      onMove: ({ x, y, event }) => {
        if (dragRef.current !== drag) return;
        drag.x = x;
        drag.y = y;
        drag.event = event;
        updateDrag();
      },
      onEnd: () => {
        if (dragRef.current === drag) endDrag();
      },
    });
  }, [edgeScroll, endDrag, updateDrag]);

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
    // A finger is UI SDK's `bindHold`'s, below: a tap places the caret, a long press selects a word and drags from it.
    if (e.pointerType === 'touch' || (e.target as Element).closest('[data-code-editor-cell]')) return;
    if (e.button !== 0 || (e.ctrlKey && isMac())) {
      // A right click inside the selection keeps it, for the context menu's Copy.
      const position = positionAt(e.clientX, e.clientY);
      const current = selectionRef.current;
      if (current) {
        const { from, to } = orderedSelection(current);
        if (comparePositions(position, from) < 0 || comparePositions(position, to) > 0) select(editable ? caretAt(position) : null, { reason: 'press', event: e.nativeEvent });
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
    const event = e.nativeEvent;
    if (anchor) {
      const base = { anchor, focus: anchor };
      select(extendSelection(base, position, 'char', readLine, source.count), { reason: 'press', event });
      startDrag(event, base, 'char', false);
      return;
    }
    caretRef.current = position;
    const base = selectFrom(position, granularity);
    select(base, { reason: 'press', event });
    startDrag(event, base, granularity, false);
  };

  // What a touch does, from the latest render's handlers.
  const touchRef = useRef<{ hold: (down: PointerEvent) => void; tap: (down: PointerEvent, up: Event) => void } | null>(null);
  touchRef.current = {
    hold: (down) => {
      focusEditor();
      const base = selectFrom(positionAt(down.clientX, down.clientY), 'word');
      select(base, { reason: 'press', event: down });
      startDrag(down, base, 'word', true);
    },
    tap: (down, up) => {
      if (editable) {
        // In the gesture, or a phone won't bring up its keyboard.
        focusEditor();
        history?.seal();
        goalRef.current = null;
        select(caretAt(positionAt(down.clientX, down.clientY)), { reason: 'press', event: up });
      } else select(null, { reason: 'press', event: up });
      syncProxy();
    },
  };

  /* A finger: UI SDK's `bindHold`. Held still, it selects the word under it and drags from there; lifted first, it's a tap;
     moved first, it's the browser's, to pan. While it's selecting, moving it mustn't pan: only a `touchmove` listener that
     can cancel stops that, and one has to be added by hand. */
  useLayoutEffect(() => {
    const clip = clipRef.current as HTMLDivElement;
    const root = rootRef.current as HTMLDivElement;
    let down: PointerEvent | null = null;
    const unbind = bindHold(clip, {
      delay: LONG_PRESS_MS,
      tolerance: TOUCH_SLOP,
      keys: [],
      onPress: ({ event, input }) => {
        if (input !== 'touch' || (event.target as Element).closest('[data-code-editor-cell]')) return false;
        down = event as PointerEvent;
        return true;
      },
      onHold: () => {
        if (down) touchRef.current?.hold(down);
      },
      onEnd: ({ event, held, canceled }) => {
        if (down && !held && !canceled) touchRef.current?.tap(down, event);
        down = null;
      },
    });
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current?.touch && e.cancelable) e.preventDefault();
    };
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      unbind();
      root.removeEventListener('touchmove', onTouchMove);
    };
  }, []);
  // A drag doesn't outlive the editor.
  useLayoutEffect(() => () => {
    const drag = dragRef.current;
    if (!drag) return;
    cancelAnimationFrame(drag.frame);
    drag.release();
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

  const selectAll = useCallback((event?: Event) => {
    if (!source.count) return;
    const last = source.count - 1;
    select({ anchor: { line: 0, offset: 0 }, focus: { line: last, offset: readLine(last).length } }, { reason: event ? 'select-all' : 'imperative', event });
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

  const onChangeRef = useRef(onValueChange);
  onChangeRef.current = onValueChange;
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

  /** Tells the host, and asks only for the text if something wants the text. Says whether the host canceled it. */
  const report = useCallback((applied: AppliedEdit, origin: CodeEditOrigin, event: Event | undefined, source?: ChangeSource) => {
    const onEdit = onEditRef.current;
    const onChange = onChangeRef.current;
    if (!onEdit && !onChange) return false;
    const details: CodeEditorValueChangeDetails = Object.assign(changeDetails({ reason: reasonOf(origin), event, source }), {
      from: toPublic(applied.from),
      to: toPublic(applied.to),
      newTo: toPublic(applied.newTo),
      text: applied.text,
      removed: applied.removed,
    });
    onEdit?.(details);
    // Canceled in `onEdit`: it's taken back, so `onValueChange` never hears of it.
    if (!details.canceled) onChange?.((textDocument as CodeDocument).getText(), details);
    return details.canceled;
  }, [toPublic, textDocument]);

  /** Takes back an edit the host canceled, or didn't take. */
  const takeBack = useCallback((applied: AppliedEdit, before: CodeSelection, origin: CodeEditOrigin) => {
    const undone = (textDocument as CodeDocument).replace({ from: applied.from, to: applied.newTo, text: applied.removed });
    followEdit(undone);
    select(before, { reason: reasonOf(origin) });
  }, [followEdit, select, textDocument]);

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
    select(after, { reason: 'imperative' });
    history?.record(applied, 'value', before, after);
    history?.seal();
  }, [followEdit, history, select, textDocument]);

  /** A controlled host had its chance to answer, inside its `onChange`: an input's rules, and an input undoes what the host
      didn't take. */
  const settleValue = useCallback(({ applied, origin, before, after, parentLength, valueBefore, isUndo }: Unconfirmed) => {
    const doc = textDocument as CodeDocument;
    const current = valueRef.current;
    if (!isUndo && current === valueBefore && current !== doc.getText()) {
      takeBack(applied, before, origin);
      return;
    }
    if (!isUndo) history?.record(applied, origin, before, after, parentLength);
    if (current !== undefined) applyValue(current);
  }, [applyValue, history, takeBack, textDocument]);

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
  const execute = useCallback((command: EditCommand | null, event?: Event, source?: ChangeSource) => {
    if (!command || !textDocument) return false;
    settleAnswer();
    const before = selectionRef.current ?? caretAt({ line: 0, offset: 0 });
    const parentLength = command.edit.from.line === command.edit.to.line ? textDocument.get(command.edit.from.line).length : 0;
    const applied = textDocument.replace(command.edit);
    const after = command.after ?? caretAt(applied.newTo);
    followEdit(applied);
    goalRef.current = null;
    const { origin } = command;
    select(after, { reason: reasonOf(origin), event });
    needsReveal.current = true;
    restartBlink();
    if (valueRef.current !== undefined && onChangeRef.current) {
      // Controlled: what the host passes back decides, as with an input.
      awaitAnswer({ applied, origin, before, after, parentLength, valueBefore: valueRef.current, isUndo: false });
      report(applied, origin, event, source);
    } else if (report(applied, origin, event, source)) {
      takeBack(applied, before, origin);
    } else {
      history?.record(applied, origin, before, after, parentLength);
    }
    return true;
  }, [awaitAnswer, followEdit, history, report, select, settleAnswer, takeBack, textDocument]);

  /** An agent's `setValue`: the whole text as one edit, through the same path as typing. Cancels `details` when the edit
      wasn't made (read-only, mid-composition, the same text, or refused in `onEdit` / an uncontrolled `onValueChange`). A
      controlled host decides by what it passes back. */
  const writeAll = useCallback((text: string, details: ChangeDetails<'imperative'>) => {
    const doc = textDocument;
    const edit = editableRef.current && doc && !composing.current ? editBetween(doc, text) : null;
    if (!edit || !execute({ edit, origin: 'imperative' }, undefined, details.source)) {
      details.cancel();
      return;
    }
    if (valueRef.current === undefined && doc?.getText() !== text) details.cancel();
  }, [execute, textDocument]);
  const readAll = useCallback(() => textDocument?.getText() ?? Array.from({ length: source.count }, (_, i) => readLine(i)).join('\n'), [readLine, source, textDocument]);

  const undoOrRedo = useCallback((redo: boolean, event?: Event) => {
    if (!history || !textDocument || composing.current) return;
    settleAnswer();
    const step = redo ? history.redo() : history.undo();
    if (!step) return;
    const before = selectionRef.current ?? caretAt({ line: 0, offset: 0 });
    const applied = textDocument.replace(redo ? redoEdit(step) : undoEdit(step));
    followEdit(applied);
    goalRef.current = null;
    const after = redo ? step.after : step.before;
    const origin = redo ? 'redo' : 'undo';
    select(after, { reason: origin, event });
    needsReveal.current = true;
    restartBlink();
    if (valueRef.current !== undefined) {
      awaitAnswer({ applied, origin, before, after, parentLength: 0, valueBefore: valueRef.current, isUndo: true });
      report(applied, origin, event);
    } else if (report(applied, origin, event)) {
      // Canceled: the text goes back, and the history to where it was.
      takeBack(applied, before, origin);
      if (redo) history.undo();
      else history.redo();
    }
  }, [awaitAnswer, followEdit, history, report, select, settleAnswer, takeBack, textDocument]);

  const deleteContext = useCallback(() => ({ document: source, metricsOf: (line: number) => cache.get(line), indent: detectIndent(source) }), [cache, source]);

  const currentSelection = () => selectionRef.current ?? caretAt({ line: 0, offset: 0 });

  const removeBy = useCallback((backward: boolean, unit: DeleteUnit, event?: Event) => {
    const current = selectionRef.current ?? caretAt({ line: 0, offset: 0 });
    return execute(backward ? deleteBackwardCommand(deleteContext(), current, unit) : deleteForwardCommand(deleteContext(), current, unit), event);
  }, [deleteContext, execute]);

  const moveBy = (move: CaretMove, extend: boolean, event: Event) => {
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
    select(extend ? { anchor: current.anchor, focus: target } : caretAt(target), { reason: 'caret-move', event });
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
    const event = e.nativeEvent;
    switch (action.type) {
      case 'move':
        e.preventDefault();
        moveBy(action.move, action.extend, event);
        break;
      case 'deleteBackward':
      case 'deleteForward':
        e.preventDefault();
        removeBy(action.type === 'deleteBackward', action.unit, event);
        break;
      case 'newline':
        e.preventDefault();
        execute(newlineCommand(source, currentSelection()), event);
        break;
      case 'tab': {
        // After Esc, Tab is the browser's: the keyboard always has a way out.
        if (wasEscaped) break;
        e.preventDefault();
        const current = currentSelection();
        const indent = detectIndent(source);
        if (isCollapsed(current) && !action.outdent) execute(tabCommand(current, indent, (line) => cache.get(line)), event);
        else execute(indentCommand(source, current, indent, action.outdent), event);
        break;
      }
      case 'undo':
        e.preventDefault();
        undoOrRedo(false, event);
        break;
      case 'redo':
        e.preventDefault();
        undoOrRedo(true, event);
        break;
      case 'selectAll':
        e.preventDefault();
        history?.seal();
        selectAll(event);
        break;
      case 'escape': {
        escaped.current = true;
        const current = currentSelection();
        if (!isCollapsed(current)) select(caretAt(current.focus), { reason: 'escape-key', event });
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
    execute({ edit: { from, to, text: '' }, origin: 'cut' }, e.nativeEvent);
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    if (!editable || e.target !== inputRef.current) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (text) execute(insertCommand(currentSelection(), text, 'paste'), e.nativeEvent);
  };

  const handleInputFocus = () => {
    setFocused(true);
    restartBlink();
    inputDirty.current = true;
    syncInput();
  };

  const handleInputBlur = () => {
    setFocused(false);
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
    select(caretAt(applied.newTo), { reason: 'composition', event: e.nativeEvent });
    needsReveal.current = true;
    restartBlink();
  };

  const handleCompositionEnd = (e: ReactCompositionEvent<HTMLTextAreaElement>) => {
    const composition = composing.current;
    if (!composition || !textDocument) return;
    composing.current = null;
    const restored = textDocument.replace({ from: composition.from, to: composition.end, text: composition.original });
    followEdit(restored);
    select(composition.before, { reason: 'composition', event: e.nativeEvent });
    if (e.data) execute(insertCommand(composition.before, e.data, 'composition'), e.nativeEvent);
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
      removeBy(backward, unit, e);
    };
    switch (e.inputType) {
      case 'insertText':
        e.preventDefault();
        if (e.data) execute(insertCommand(current, e.data), e);
        break;
      case 'insertLineBreak':
      case 'insertParagraph':
        e.preventDefault();
        execute(newlineCommand(source, current), e);
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
        undoOrRedo(false, e);
        break;
      case 'historyRedo':
        e.preventDefault();
        undoOrRedo(true, e);
        break;
      default:
    }
  }, [execute, removeBy, source, undoOrRedo]);

  /** Whatever got past `beforeinput` changed the stand-in itself: autocorrect, say. The difference is the edit. */
  const handleInput = useCallback((event: Event) => {
    const input = inputRef.current;
    if (!input || composing.current) return;
    const before = standIn.current;
    const after = input.value;
    if (after === before.text) return;
    const current = selectionRef.current ?? caretAt({ line: 0, offset: 0 });
    if (before.selection) {
      execute(insertCommand(current, after), event);
    } else {
      const mark = STAND_IN_MARK.length;
      const a = before.text.slice(mark);
      const b = after.startsWith(STAND_IN_MARK) ? after.slice(mark) : after;
      if (a === b) {
        // Only the mark went: a keyboard's Backspace at the very start of what the input holds.
        removeBy(true, 'char', event);
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
      }, event);
    }
    inputDirty.current = true;
    syncInput();
  }, [execute, removeBy, syncInput]);

  /** A Select All from the input's own context menu can only select the stand-in: this makes it mean all of it. */
  const handleInputSelect = useCallback((event: Event) => {
    const input = inputRef.current;
    const current = selectionRef.current;
    if (!input || !menuOffered.current || !current || !isCollapsed(current) || composing.current) return;
    if (input.value.length > 0 && input.selectionStart === 0 && input.selectionEnd === input.value.length) selectAll(event);
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
      selectAll(e.nativeEvent);
    } else if (mod && !e.altKey && e.key.toLowerCase() === 'c') {
      // The browser's copy command follows this keydown, and needs a selection to be there.
      syncProxy();
    } else if (e.key === 'Escape' && selectionRef.current) {
      select(null, { reason: 'escape-key', event: e.nativeEvent });
      syncProxy();
    } else if (target === root && e.shiftKey && !mod && !e.altKey && SELECTION_KEYS.has(e.key) && source.count) {
      // From the moving end of the selection; or where the last click landed; or the top of the view.
      e.preventDefault();
      const g = geometryRef.current;
      const current = selectionRef.current;
      const from = current?.focus ?? caretRef.current ?? { line: g.map.locate(Math.floor(scrollRef.current.y / g.lineHeight)).line, offset: 0 };
      const anchor = current?.anchor ?? from;
      const focus = movePosition(from, e.key as SelectionKey, (line) => cache.get(line), source.count);
      caretRef.current = anchor;
      select({ anchor, focus }, { reason: 'caret-move', event: e.nativeEvent });
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

    // With no height of its own the view grows with the file, and a row added at the bottom has to be in view before it's seen.
    const root = rootRef.current as HTMLDivElement;
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
      select(next ? { anchor: at(next.anchor), focus: at(next.focus) } : editable ? selectionRef.current && caretAt(selectionRef.current.focus) : null, { reason: 'imperative' });
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

  /* The gutter buttons and the markers that are buttons: one tab stop, and the arrow keys between them, over every line,
     shown or not (lib/code-editor-primitive.ts). */
  const controlSource = useRef({ gutters, markerLookup });
  controlSource.current = { gutters, markerLookup };
  const sortedMarkers = (lineNumber: number) => {
    const list = controlSource.current.markerLookup?.(lineNumber);
    return list?.length ? markersInRange(list, 0, Infinity) : null;
  };
  const controlAt = useCallback((line: number, column: string, near: number) => {
    const lineNumber = line + startLineRef.current;
    if (column === 'marker') {
      const sorted = sortedMarkers(lineNumber);
      let best = -1;
      sorted?.forEach((marker, i) => {
        if (marker.onClick && (best < 0 || Math.abs(marker.column - near) < Math.abs(sorted[best].column - near))) best = i;
      });
      return best < 0 ? undefined : codeEditorControlKey(line, `marker:${best}`);
    }
    const gutter = controlSource.current.gutters.find((g) => g.id === column);
    if (!gutter) return undefined;
    const has = (!!gutter.onClick && (gutter.clickable?.(lineNumber) ?? true)) || !!gutter.focusable?.(lineNumber);
    return has ? codeEditorControlKey(line, column) : undefined;
  }, []);
  const revealControl = useCallback((line: number, key: string) => {
    const index = /:marker:(\d+)$/.exec(key)?.[1];
    const lineNumber = line + startLineRef.current;
    const marker = index === undefined ? undefined : sortedMarkers(lineNumber)?.[Number(index)];
    scrollLineIntoView(lineNumber, { column: marker?.column, reveal: true });
  }, [scrollLineIntoView]);
  const controls = usePrimitive(codeEditorControls, {
    lineCount: source.count, controlAt, reveal: revealControl, read: readAll, onWrite: editable ? writeAll : undefined,
  });

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
          controls={controls} onFocusLine={onFocusLine} onBlurLine={onBlurLine} />,
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

    let rowMarkers: (CodeEditorMarker & { left: number; index: number })[] | null = null;
    const lineMarkers = markerLookup?.(lineNumber);
    if (lineMarkers?.length) {
      // Markers past the end of the line are shown at its end.
      const inRange = markersInRange(lineMarkers, span.start, lastRowOfLine ? Infinity : span.end);
      if (inRange.length) {
        // Where they are among the line's markers, which is what keys them.
        const first = markersInRange(lineMarkers, 0, Infinity).indexOf(inRange[0]);
        rowMarkers = inRange.map((marker, i) => ({ ...marker, index: first + i, left: CODE_PADDING + (metrics.cellAt(marker.column) - firstCell) * cellWidth }));
      }
    }

    codeRows.push(
      <CodeRow key={row} metrics={metrics} store={store} row={row} rowCount={rowCount} line={line} lineNumber={lineNumber} top={top} start={span.start} end={span.end} left={left}
        selectionLeft={selectionLeft} selectionWidth={selectionWidth} composingLeft={composingLeft} composingWidth={composingWidth} columnLeft={columnLeft}
        textClassName={decoration?.textClassName} extra={part === 0 ? lineProps?.(lineNumber) : undefined} markers={rowMarkers} controls={controls} onFocusLine={onFocusLine} onBlurLine={onBlurLine} />,
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
            <EditorInput
              controls={controls}
              ref={inputRef}
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
          {/* A rule after the gutters only when there are gutters of the host's (breakpoints, coverage): line numbers alone sit
              on the code's surface, as in the page renderer. */}
          {gutterWidth > 0 && gutterProp?.length ? <div className="absolute inset-y-0 left-0 border-r border-border" style={{ width: gutterWidth }} /> : null}
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

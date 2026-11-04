/* The text behind an editable CodeEditor, and what editing does to it, as plain functions: no DOM and no React.

   A document is an array of lines, on the same model as the rest of lib/code-editor-model.ts: lines from 0 and columns in UTF-16
   code units. An edit replaces one continuous range with one text, whatever made it, so a change can be reported, undone
   and followed through every cache the same way. Commands look at the document and a selection and say which edit to
   make; applying it is one call in one place. */
import {
  comparePositions, isCollapsed, isWordCode, orderedSelection,
  type CodePosition, type CodeSelection, type LineEdit, type LineMetrics, type LineSource, type RowMap,
} from '@/lib/code-editor-model';

/* ── Lines ── */

/** A text's lines, at `\n`, `\r\n` and a lone `\r`. U+2028 and U+2029 stay in the line and show as symbols: they're legal in
    a string, and treating them as line ends would turn them into `\n` the next time the text is saved. */
export function splitEditorLines(text: string): string[] {
  return text.includes('\r') ? text.split(/\r\n?|\n/) : text.split('\n');
}

/** The line ending most of a text uses. An edited text is written back with this one throughout. */
export function detectLineEnding(text: string): '\n' | '\r\n' {
  if (!text.includes('\r')) return '\n';
  let crlf = 0;
  let lf = 0;
  for (let at = text.indexOf('\n'); at >= 0; at = text.indexOf('\n', at + 1)) {
    if (text.charCodeAt(at - 1) === 13) crlf++;
    else lf++;
  }
  return crlf > lf ? '\r\n' : '\n';
}

/** Where a text ends when it's put at `from`. The text's line ends are `\n` only. */
export function endOfText(from: CodePosition, text: string): CodePosition {
  const last = text.lastIndexOf('\n');
  if (last < 0) return { line: from.line, offset: from.offset + text.length };
  let lines = 1;
  for (let at = text.indexOf('\n'); at >= 0 && at < last; at = text.indexOf('\n', at + 1)) lines++;
  return { line: from.line + lines, offset: text.length - last - 1 };
}

/* ── Edits ── */

/** Replace `[from, to)` with `text`. */
export interface CodeEdit {
  from: CodePosition;
  to: CodePosition;
  text: string;
}

/** An edit that happened: enough to report it, undo it, and bring anything keyed by line up to date. */
export interface AppliedEdit extends CodeEdit {
  /** What was in the range. */
  removed: string;
  /** Where the new text ends, in the text after the edit. */
  newTo: CodePosition;
}

/** What made an edit, which also decides how undo groups it. */
export type CodeEditOrigin = 'input' | 'delete' | 'newline' | 'indent' | 'paste' | 'cut' | 'composition' | 'undo' | 'redo' | 'value';

/** The lines an edit touched, for the caches in lib/code-editor-model.ts. */
export function lineEditOf(edit: AppliedEdit): LineEdit {
  return {
    fromLine: edit.from.line,
    oldEndLine: edit.to.line,
    newEndLine: edit.newTo.line,
    fromOffset: edit.from.offset,
    oldEndOffset: edit.to.offset,
    newEndOffset: edit.newTo.offset,
  };
}

/** Where a position ends up after an edit. One inside what was replaced goes to the end of the new text, or its start with
    `'start'`. */
export function mapPosition(position: CodePosition, edit: AppliedEdit, inside: 'start' | 'end' = 'end'): CodePosition {
  if (comparePositions(position, edit.from) < 0) return position;
  if (comparePositions(position, edit.to) < 0) return inside === 'start' ? edit.from : edit.newTo;
  // At the very place text went in, with nothing replaced: a caret stays ahead of it unless told otherwise.
  if (comparePositions(position, edit.from) === 0 && inside === 'start') return edit.from;
  return {
    line: position.line + edit.newTo.line - edit.to.line,
    offset: position.line === edit.to.line ? position.offset - edit.to.offset + edit.newTo.offset : position.offset,
  };
}

export const mapSelection = (selection: CodeSelection, edit: AppliedEdit): CodeSelection => ({
  anchor: mapPosition(selection.anchor, edit),
  focus: mapPosition(selection.focus, edit),
});

/** Where a line number ends up after an edit: the same line, moved by what was added or removed above it. A line that was
    replaced goes to where the replacement starts. For a host keeping breakpoints or marks on lines through edits. Both are
    in whatever numbering the edit's positions are. */
export function lineAfterEdit(line: number, edit: { from: { line: number }; to: { line: number }; newTo: { line: number } }): number {
  if (line <= edit.from.line) return line;
  if (line <= edit.to.line) return edit.from.line;
  return line + edit.newTo.line - edit.to.line;
}

/** A splice this big doesn't fit on the stack as arguments. */
const MAX_SPREAD = 8192;

/** An editable text, kept as lines. */
export class CodeDocument implements LineSource {
  private lines: string[];
  /** The whole text, until the next edit. */
  private text: string | null;
  /** The line ending it's written back with. */
  readonly lineEnding: '\n' | '\r\n';
  /** Goes up with every edit. */
  version = 0;

  constructor(text = '') {
    this.lines = splitEditorLines(text);
    this.lineEnding = detectLineEnding(text);
    this.text = text;
  }

  get count() {
    return this.lines.length;
  }

  get = (index: number) => this.lines[index] ?? '';

  /** The whole text. Joining half a million lines takes a while, so it's kept until the next edit, and nothing here calls
      it on its own. */
  getText(): string {
    return (this.text ??= this.lines.join(this.lineEnding));
  }

  /** A position that exists, nearest to the one given. */
  clamp(position: CodePosition): CodePosition {
    const line = Math.max(0, Math.min(this.lines.length - 1, position.line));
    return { line, offset: Math.max(0, Math.min(this.lines[line].length, position.offset)) };
  }

  /** The text of a range, with lines joined by `\n`. */
  slice(from: CodePosition, to: CodePosition): string {
    if (from.line === to.line) return this.lines[from.line].slice(from.offset, to.offset);
    const parts = [this.lines[from.line].slice(from.offset)];
    for (let line = from.line + 1; line < to.line; line++) parts.push(this.lines[line]);
    parts.push(this.lines[to.line].slice(0, to.offset));
    return parts.join('\n');
  }

  private splice(start: number, removeCount: number, fresh: string[]) {
    if (fresh.length <= MAX_SPREAD) this.lines.splice(start, removeCount, ...fresh);
    else this.lines = this.lines.slice(0, start).concat(fresh, this.lines.slice(start + removeCount));
  }

  /** Makes an edit. Any line ending in its text becomes a line break. */
  replace(edit: CodeEdit): AppliedEdit {
    const from = this.clamp(edit.from);
    const to = this.clamp(edit.to);
    const removed = this.slice(from, to);
    const head = this.lines[from.line].slice(0, from.offset);
    const tail = this.lines[to.line].slice(to.offset);
    const multiline = /[\r\n]/.test(edit.text);
    const text = multiline && edit.text.includes('\r') ? edit.text.replace(/\r\n?/g, '\n') : edit.text;
    let newTo: CodePosition;
    if (!multiline) {
      const line = head + text + tail;
      if (from.line === to.line) this.lines[from.line] = line;
      else this.lines.splice(from.line, to.line - from.line + 1, line);
      newTo = { line: from.line, offset: from.offset + text.length };
    } else {
      const fresh = text.split('\n');
      const last = fresh.length - 1;
      newTo = { line: from.line + last, offset: fresh[last].length };
      fresh[0] = head + fresh[0];
      fresh[last] += tail;
      this.splice(from.line, to.line - from.line + 1, fresh);
    }
    this.text = null;
    this.version++;
    return { from, to, text, removed, newTo };
  }
}

/** The smallest edit that turns a document into a text: for a `value` that came from outside, so the caret, the scroll and
    undo all carry on. `null` if they're the same. */
export function editBetween(document: CodeDocument, text: string): CodeEdit | null {
  const next = splitEditorLines(text);
  const oldCount = document.count;
  const newCount = next.length;
  const shorter = Math.min(oldCount, newCount);
  let top = 0;
  while (top < shorter && document.get(top) === next[top]) top++;
  if (top === oldCount && top === newCount) return null;
  let bottom = 0;
  while (bottom < shorter - top && document.get(oldCount - 1 - bottom) === next[newCount - 1 - bottom]) bottom++;
  const oldEnd = oldCount - bottom; // exclusive
  const newEnd = newCount - bottom; // exclusive

  if (top === oldEnd) {
    // Only whole lines went in.
    const inserted = next.slice(top, newEnd).join('\n');
    if (top < oldCount) return { from: { line: top, offset: 0 }, to: { line: top, offset: 0 }, text: `${inserted}\n` };
    const end = { line: oldCount - 1, offset: document.get(oldCount - 1).length };
    return { from: end, to: end, text: `\n${inserted}` };
  }
  if (top === newEnd) {
    // Only whole lines came out.
    if (oldEnd < oldCount) return { from: { line: top, offset: 0 }, to: { line: oldEnd, offset: 0 }, text: '' };
    return { from: { line: top - 1, offset: document.get(top - 1).length }, to: { line: oldCount - 1, offset: document.get(oldCount - 1).length }, text: '' };
  }

  const oldFirst = document.get(top);
  const newFirst = next[top];
  const oldLast = document.get(oldEnd - 1);
  const newLast = next[newEnd - 1];
  let prefix = 0;
  const prefixLimit = Math.min(oldFirst.length, newFirst.length);
  while (prefix < prefixLimit && oldFirst.charCodeAt(prefix) === newFirst.charCodeAt(prefix)) prefix++;
  // Not between the halves of a surrogate pair.
  if (prefix > 0 && isHighSurrogate(oldFirst.charCodeAt(prefix - 1))) prefix--;
  let suffix = 0;
  const oneOld = top === oldEnd - 1;
  const oneNew = top === newEnd - 1;
  const suffixLimit = Math.min(oneOld ? oldLast.length - prefix : oldLast.length, oneNew ? newLast.length - prefix : newLast.length);
  while (suffix < suffixLimit && oldLast.charCodeAt(oldLast.length - 1 - suffix) === newLast.charCodeAt(newLast.length - 1 - suffix)) suffix++;
  if (suffix > 0 && isHighSurrogate(oldLast.charCodeAt(oldLast.length - 1 - suffix))) suffix--;
  const inserted = next.slice(top, newEnd).join('\n');
  return {
    from: { line: top, offset: prefix },
    to: { line: oldEnd - 1, offset: oldLast.length - suffix },
    text: inserted.slice(prefix, inserted.length - suffix),
  };
}

const isHighSurrogate = (c: number) => c >= 0xd800 && c <= 0xdbff;

/* ── Undo ── */

/** Steps kept, and the text they may hold between them. A step over the limit is still kept, on its own, because it's the
    one someone is most likely to want back. */
export const UNDO_MAX_STEPS = 1000;
export const UNDO_MAX_CHARS = 32 * 1024 * 1024;
/** Typing or deleting this soon after the last key is the same step. */
export const UNDO_GROUP_MS = 800;

export interface UndoStep {
  /** Where the step's range starts. */
  from: CodePosition;
  removed: string;
  inserted: string;
  /** The selection on the way in and on the way out, to put back. */
  before: CodeSelection;
  after: CodeSelection;
  origin: CodeEditOrigin;
  time: number;
}

/** A piece cut from a long line is a window on the whole line as far as the engine's memory goes, so undo steps holding
    little pieces of a megabyte line could keep a megabyte each. A copy holds only itself. */
function detached(text: string, parentLength: number): string {
  // The engine copies anything this short anyway.
  if (text.length < 13 || text.length * 8 > parentLength) return text;
  return JSON.parse(JSON.stringify(text)) as string;
}

const isSpaceText = (text: string) => /^[ \t]+$/.test(text);
const endsInSpace = (text: string) => /[ \t]$/.test(text);

/** The undo and redo stacks, bounded. Typing groups into a step until the caret moves, the word ends, or the writer pauses;
    so does deleting. Everything else is a step of its own. */
export class CodeHistory {
  private undoStack: UndoStep[] = [];
  private redoStack: UndoStep[] = [];
  private chars = 0;
  private sealed = true;
  private readonly maxSteps: number;
  private readonly maxChars: number;
  private readonly groupMs: number;
  private readonly now: () => number;

  constructor({ maxSteps = UNDO_MAX_STEPS, maxChars = UNDO_MAX_CHARS, groupMs = UNDO_GROUP_MS, now = () => Date.now() }: { maxSteps?: number; maxChars?: number; groupMs?: number; now?: () => number } = {}) {
    this.maxSteps = maxSteps;
    this.maxChars = maxChars;
    this.groupMs = groupMs;
    this.now = now;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  /** How many steps and how much text it holds. */
  get size() {
    return { steps: this.undoStack.length + this.redoStack.length, chars: this.chars };
  }

  /** The next edit starts a new step: the caret moved, or something else happened in between. */
  seal() {
    this.sealed = true;
  }

  /** Records an edit, joining it to the last step if it belongs there. `parentLength` is the length of the line it was cut
      from, if it's a piece of one. */
  record(edit: AppliedEdit, origin: CodeEditOrigin, before: CodeSelection, after: CodeSelection, parentLength = 0) {
    const time = this.now();
    this.dropRedo();
    const removed = detached(edit.removed, parentLength);
    const last = this.undoStack[this.undoStack.length - 1];
    if (last && !this.sealed && last.origin === origin && time - last.time < this.groupMs) {
      if (origin === 'input' && !removed && comparePositions(edit.from, endOfText(last.from, last.inserted)) === 0) {
        // A space after a word starts the next step, so undo goes back a word at a time.
        if (!(isSpaceText(edit.text) && !endsInSpace(last.inserted))) {
          last.inserted += edit.text;
          last.after = after;
          last.time = time;
          this.chars += edit.text.length;
          return;
        }
      } else if (origin === 'delete' && !edit.text) {
        if (comparePositions(edit.to, last.from) === 0) {
          // Backspace: each piece comes before the last.
          last.removed = removed + last.removed;
          last.from = edit.from;
          last.after = after;
          last.time = time;
          this.chars += removed.length;
          return;
        }
        if (comparePositions(edit.from, last.from) === 0) {
          // Delete: each piece comes after the last, from the same place.
          last.removed += removed;
          last.after = after;
          last.time = time;
          this.chars += removed.length;
          return;
        }
      }
    }
    this.undoStack.push({ from: edit.from, removed, inserted: edit.text, before, after, origin, time });
    this.chars += removed.length + edit.text.length;
    this.sealed = origin !== 'input' && origin !== 'delete';
    while (this.undoStack.length > 1 && (this.undoStack.length > this.maxSteps || this.chars > this.maxChars)) {
      const oldest = this.undoStack.shift() as UndoStep;
      this.chars -= oldest.removed.length + oldest.inserted.length;
    }
  }

  private dropRedo() {
    for (const step of this.redoStack) this.chars -= step.removed.length + step.inserted.length;
    this.redoStack.length = 0;
  }

  /** The step to undo, moved to the redo stack. Make the edit `undoEdit` says. */
  undo(): UndoStep | null {
    const step = this.undoStack.pop();
    if (!step) return null;
    this.redoStack.push(step);
    this.sealed = true;
    return step;
  }

  /** The step to redo, moved back. Make the edit `redoEdit` says. */
  redo(): UndoStep | null {
    const step = this.redoStack.pop();
    if (!step) return null;
    this.undoStack.push(step);
    this.sealed = true;
    return step;
  }

  /** Forgets everything. */
  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.chars = 0;
    this.sealed = true;
  }
}

export const undoEdit = (step: UndoStep): CodeEdit => ({ from: step.from, to: endOfText(step.from, step.inserted), text: step.removed });
export const redoEdit = (step: UndoStep): CodeEdit => ({ from: step.from, to: endOfText(step.from, step.removed), text: step.inserted });

/* ── Indents ── */

/** The indent a text uses: a tab when more lines start with one, else the smallest run of leading spaces (2 or 4). */
export function detectIndent(source: LineSource, sample = 2000): string {
  let tabs = 0;
  let spaces = 0;
  let smallest = 8;
  const count = Math.min(source.count, sample);
  for (let i = 0; i < count; i++) {
    const line = source.get(i);
    if (line.charCodeAt(0) === 9) tabs++;
    else if (line.charCodeAt(0) === 32) {
      let run = 1;
      while (line.charCodeAt(run) === 32) run++;
      if (run >= 2 && run < line.length) {
        spaces++;
        smallest = Math.min(smallest, run);
      }
    }
  }
  return tabs > spaces ? '\t' : ' '.repeat(smallest >= 4 && smallest !== 8 ? 4 : 2);
}

/** How long a line's leading run of spaces and tabs is. */
export function leadingWhitespace(text: string): number {
  let at = 0;
  for (;;) {
    const c = text.charCodeAt(at);
    if (c !== 32 && c !== 9) return at;
    at++;
  }
}

/* ── Commands ── */

/** An edit to make, and where the selection goes after it (the end of the new text, if nothing's said). */
export interface EditCommand {
  edit: CodeEdit;
  after?: CodeSelection;
  origin: CodeEditOrigin;
}

const caretAt = (position: CodePosition): CodeSelection => ({ anchor: position, focus: position });

/** Replaces the selection with a text. */
export function insertCommand(selection: CodeSelection, text: string, origin: CodeEditOrigin = 'input'): EditCommand {
  const { from, to } = orderedSelection(selection);
  return { edit: { from, to, text }, origin };
}

/** A new line, starting with as much of this line's indent as is before the caret. */
export function newlineCommand(document: LineSource, selection: CodeSelection): EditCommand {
  const { from, to } = orderedSelection(selection);
  const line = document.get(from.line);
  const lead = Math.min(leadingWhitespace(line), from.offset);
  return { edit: { from, to, text: `\n${line.slice(0, lead)}` }, origin: 'newline' };
}

export type DeleteUnit = 'char' | 'word' | 'line';

const isBlank = (c: number) => c === 32 || c === 9;

/** The start of the word, or run of punctuation, before `offset`, past any spaces before that. */
export function wordStartBefore(text: string, offset: number): number {
  let at = offset;
  while (at > 0 && isBlank(text.charCodeAt(at - 1))) at--;
  if (at === 0) return 0;
  const word = isWordCode(text.charCodeAt(at - 1));
  while (at > 0) {
    const c = text.charCodeAt(at - 1);
    if (isBlank(c) || isWordCode(c) !== word) break;
    at--;
  }
  return at;
}

/** The end of the word, or run of punctuation, after `offset`, past any spaces before that. */
export function wordEndAfter(text: string, offset: number): number {
  let at = offset;
  const { length } = text;
  while (at < length && isBlank(text.charCodeAt(at))) at++;
  if (at === length) return length;
  const word = isWordCode(text.charCodeAt(at));
  while (at < length) {
    const c = text.charCodeAt(at);
    if (isBlank(c) || isWordCode(c) !== word) break;
    at++;
  }
  return at;
}

export interface DeleteContext {
  document: LineSource;
  metricsOf: (line: number) => LineMetrics;
  /** The file's indent. In the spaces at the start of a line, Backspace goes back to the last multiple of it. */
  indent?: string;
}

/** What Backspace deletes, by unit: the selection if there is one, and across the line's start at its start. `null` if
    there's nothing before the caret. */
export function deleteBackwardCommand({ document, metricsOf, indent }: DeleteContext, selection: CodeSelection, unit: DeleteUnit = 'char'): EditCommand | null {
  if (!isCollapsed(selection)) {
    const { from, to } = orderedSelection(selection);
    return { edit: { from, to, text: '' }, origin: 'delete' };
  }
  const { line, offset } = selection.focus;
  if (offset === 0) {
    if (line === 0) return null;
    return { edit: { from: { line: line - 1, offset: document.get(line - 1).length }, to: selection.focus, text: '' }, origin: 'delete' };
  }
  const text = document.get(line);
  let start: number;
  if (unit === 'line') start = 0;
  else if (unit === 'word') start = wordStartBefore(text, offset);
  else {
    start = metricsOf(line).before(offset);
    if (indent && indent !== '\t' && offset <= leadingWhitespace(text) && text.charCodeAt(offset - 1) === 32) {
      const size = indent.length;
      const stop = offset - (((offset - 1) % size) + 1);
      let at = offset;
      while (at > stop && text.charCodeAt(at - 1) === 32) at--;
      start = at;
    }
  }
  return { edit: { from: { line, offset: start }, to: selection.focus, text: '' }, origin: 'delete' };
}

/** What Delete deletes, by unit: the selection if there is one, and across the line's end at its end. `null` if there's
    nothing after the caret. */
export function deleteForwardCommand({ document, metricsOf }: DeleteContext, selection: CodeSelection, unit: DeleteUnit = 'char'): EditCommand | null {
  if (!isCollapsed(selection)) {
    const { from, to } = orderedSelection(selection);
    return { edit: { from, to, text: '' }, origin: 'delete' };
  }
  const { line, offset } = selection.focus;
  const text = document.get(line);
  if (offset >= text.length) {
    if (line >= document.count - 1) return null;
    return { edit: { from: selection.focus, to: { line: line + 1, offset: 0 }, text: '' }, origin: 'delete' };
  }
  const end = unit === 'line' ? text.length : unit === 'word' ? wordEndAfter(text, offset) : metricsOf(line).after(offset);
  return { edit: { from: selection.focus, to: { line, offset: end }, text: '' }, origin: 'delete' };
}

/** Which lines a selection touches. A selection ending at the start of a line doesn't touch that line. */
export function selectedLines(selection: CodeSelection): { first: number; last: number } {
  const { from, to } = orderedSelection(selection);
  return { first: from.line, last: to.offset === 0 && to.line > from.line ? to.line - 1 : to.line };
}

/** Tab with a caret: to the next stop with a file indented in spaces, or one tab. */
export function tabCommand(selection: CodeSelection, indent: string, metricsOf: (line: number) => LineMetrics): EditCommand {
  const { focus } = selection;
  if (indent === '\t') return insertCommand(selection, '\t', 'indent');
  const size = indent.length;
  const cell = metricsOf(focus.line).cellAt(focus.offset);
  return insertCommand(selection, ' '.repeat(size - (cell % size)), 'indent');
}

/** Tab and Shift+Tab across lines: every line the selection touches moves by one indent, as one edit, and those lines stay
    selected. Empty lines stay empty. `null` if nothing would change. */
export function indentCommand(document: LineSource, selection: CodeSelection, indent: string, outdent: boolean): EditCommand | null {
  const { first, last } = selectedLines(selection);
  const size = indent === '\t' ? 4 : indent.length;
  const moved = (text: string): string => {
    if (!outdent) return text ? indent + text : text;
    if (text.charCodeAt(0) === 9) return text.slice(1);
    let run = 0;
    while (run < size && text.charCodeAt(run) === 32) run++;
    return text.slice(run);
  };
  if (first === last) {
    // One line: the smallest edit, and the caret or selection comes along.
    const text = document.get(first);
    const next = moved(text);
    if (next === text) return null;
    const shift = next.length - text.length;
    const move = (p: CodePosition): CodePosition => (p.line === first ? { line: first, offset: Math.max(0, p.offset + shift) } : p);
    const edit: CodeEdit = shift > 0
      ? { from: { line: first, offset: 0 }, to: { line: first, offset: 0 }, text: indent }
      : { from: { line: first, offset: 0 }, to: { line: first, offset: -shift }, text: '' };
    return { edit, after: { anchor: move(selection.anchor), focus: move(selection.focus) }, origin: 'indent' };
  }
  const lines: string[] = [];
  let changed = false;
  for (let line = first; line <= last; line++) {
    const text = document.get(line);
    const next = moved(text);
    if (next !== text) changed = true;
    lines.push(next);
  }
  if (!changed) return null;
  const from = { line: first, offset: 0 };
  const newEnd = { line: last, offset: lines[lines.length - 1].length };
  const forward = comparePositions(selection.anchor, selection.focus) <= 0;
  return {
    edit: { from, to: { line: last, offset: document.get(last).length }, text: lines.join('\n') },
    after: forward ? { anchor: from, focus: newEnd } : { anchor: newEnd, focus: from },
    origin: 'indent',
  };
}

/* ── Moving ── */

/** How many rows a line takes at `cols` cells to a row (`cols` 0: no wrapping). */
export const rowsOfCells = (cells: number, cols: number) => (cols ? Math.max(1, Math.ceil(cells / cols)) : 1);

/** Where a position is on the screen's grid: a row, and how many cells along it. */
export function rowOfPosition(position: CodePosition, metrics: LineMetrics, map: RowMap, cols: number): { row: number; part: number; cell: number } {
  const cell = metrics.cellAt(position.offset);
  if (!cols) return { row: map.rowOfLine(position.line), part: 0, cell };
  const part = Math.min(Math.floor(cell / cols), rowsOfCells(metrics.cells, cols) - 1);
  return { row: map.rowOfLine(position.line) + part, part, cell: cell - part * cols };
}

/** The position at a row and a number of cells along it. On a wrapped row that isn't the line's last, the end of the row is
    the start of the next, so a place past the last cell stays before it. */
export function positionAtRow(row: number, cell: number, map: RowMap, metricsOf: (line: number) => LineMetrics, cols: number): CodePosition {
  const { line, part } = map.locate(row);
  const metrics = metricsOf(line);
  if (!cols) return { line, offset: metrics.nearest(cell) };
  const lastPart = part >= rowsOfCells(metrics.cells, cols) - 1;
  const along = lastPart ? cell : Math.min(cell, cols - 1);
  return { line, offset: metrics.nearest(part * cols + along) };
}

export interface MoveContext {
  document: LineSource;
  metricsOf: (line: number) => LineMetrics;
  map: RowMap;
  /** Cells to a row with wrapping on, otherwise 0. */
  cols: number;
  /** Rows in a page. */
  pageRows: number;
}

export type CaretMove =
  | 'left' | 'right' | 'wordLeft' | 'wordRight' | 'up' | 'down' | 'pageUp' | 'pageDown'
  | 'lineStart' | 'lineEnd' | 'documentStart' | 'documentEnd';

/** Where a caret goes. `goal` is the cell a run of up and down keeps coming back to. It says what to keep for the next one. */
export function moveCaret(position: CodePosition, move: CaretMove, { document, metricsOf, map, cols, pageRows }: MoveContext, goal: number | null = null): { position: CodePosition; goal: number | null } {
  const { line, offset } = position;
  const lastLine = document.count - 1;
  const text = document.get(line);
  const plain = (next: CodePosition) => ({ position: next, goal: null });
  switch (move) {
    case 'left':
      if (offset > 0) return plain({ line, offset: metricsOf(line).before(offset) });
      return plain(line > 0 ? { line: line - 1, offset: document.get(line - 1).length } : position);
    case 'right':
      if (offset < text.length) return plain({ line, offset: metricsOf(line).after(offset) });
      return plain(line < lastLine ? { line: line + 1, offset: 0 } : position);
    case 'wordLeft':
      if (offset > 0) return plain({ line, offset: wordStartBefore(text, offset) });
      return plain(line > 0 ? { line: line - 1, offset: document.get(line - 1).length } : position);
    case 'wordRight':
      if (offset < text.length) return plain({ line, offset: wordEndAfter(text, offset) });
      return plain(line < lastLine ? { line: line + 1, offset: 0 } : position);
    case 'lineStart': {
      // To where the code starts, and from there to the very start.
      const lead = leadingWhitespace(text);
      return plain({ line, offset: offset === lead ? 0 : lead });
    }
    case 'lineEnd':
      return plain({ line, offset: text.length });
    case 'documentStart':
      return plain({ line: 0, offset: 0 });
    case 'documentEnd':
      return plain({ line: lastLine, offset: document.get(lastLine).length });
    default: {
      const rows = move === 'up' ? -1 : move === 'down' ? 1 : move === 'pageUp' ? -pageRows : pageRows;
      const here = rowOfPosition(position, metricsOf(line), map, cols);
      const keep = goal ?? here.cell;
      const row = here.row + rows;
      if (row < 0) return { position: { line: 0, offset: 0 }, goal: keep };
      if (row >= map.rowCount) return { position: { line: lastLine, offset: document.get(lastLine).length }, goal: keep };
      return { position: positionAtRow(row, keep, map, metricsOf, cols), goal: keep };
    }
  }
}

export { caretAt };

/* ── Keys ── which key does what, by platform. */

export type EditorKeyAction =
  | { type: 'move'; move: CaretMove; extend: boolean }
  | { type: 'deleteBackward'; unit: DeleteUnit }
  | { type: 'deleteForward'; unit: DeleteUnit }
  | { type: 'newline' }
  | { type: 'tab'; outdent: boolean }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'selectAll' }
  | { type: 'escape' };

export interface EditorKey {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

const ARROWS: Record<string, CaretMove> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', PageUp: 'pageUp', PageDown: 'pageDown', Home: 'lineStart', End: 'lineEnd' };
/** The readline keys every Mac text field has. */
const MAC_CONTROL: Record<string, EditorKeyAction> = {
  a: { type: 'move', move: 'lineStart', extend: false },
  e: { type: 'move', move: 'lineEnd', extend: false },
  b: { type: 'move', move: 'left', extend: false },
  f: { type: 'move', move: 'right', extend: false },
  p: { type: 'move', move: 'up', extend: false },
  n: { type: 'move', move: 'down', extend: false },
  h: { type: 'deleteBackward', unit: 'char' },
  d: { type: 'deleteForward', unit: 'char' },
  k: { type: 'deleteForward', unit: 'line' },
};

/** What a key does in the editor, or `null` for keys it leaves alone, which include typing, copy, cut and paste: those
    arrive as what they did, from the browser, which also knows about keyboard layouts and input methods. */
export function editorKeyAction(e: EditorKey, mac: boolean): EditorKeyAction | null {
  const { key, shiftKey: shift, altKey: alt, ctrlKey: ctrl, metaKey: meta } = e;
  // The platform's command key, and on a Mac the separate word key.
  const command = mac ? meta : ctrl;
  const wordKey = mac ? alt : ctrl;
  const lower = key.length === 1 ? key.toLowerCase() : key;
  if (command && !alt) {
    if (lower === 'z') return shift ? { type: 'redo' } : { type: 'undo' };
    if (lower === 'y' && !mac && !shift) return { type: 'redo' };
    if (lower === 'a' && !shift) return { type: 'selectAll' };
  }
  if (mac && ctrl && !meta && !alt) {
    const action = MAC_CONTROL[lower];
    if (action) return action.type === 'move' ? { ...action, extend: shift } : action;
  }
  const arrow = ARROWS[key];
  if (arrow) {
    const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
    const vertical = key === 'ArrowUp' || key === 'ArrowDown';
    if (horizontal) {
      if (mac && meta && !alt && !ctrl) return { type: 'move', move: key === 'ArrowLeft' ? 'lineStart' : 'lineEnd', extend: shift };
      if (wordKey && !(mac ? meta || ctrl : alt || meta)) return { type: 'move', move: key === 'ArrowLeft' ? 'wordLeft' : 'wordRight', extend: shift };
      if (alt || ctrl || meta) return null;
    } else if (vertical) {
      if (mac && meta && !alt && !ctrl) return { type: 'move', move: key === 'ArrowUp' ? 'documentStart' : 'documentEnd', extend: shift };
      if (alt || ctrl || meta) return null;
    } else if (key === 'Home' || key === 'End') {
      if (command && !alt) return { type: 'move', move: key === 'Home' ? 'documentStart' : 'documentEnd', extend: shift };
      if (alt || ctrl || meta) return null;
    } else if (alt || ctrl || meta) return null;
    return { type: 'move', move: arrow, extend: shift };
  }
  if (key === 'Backspace' || key === 'Delete') {
    let unit: DeleteUnit = 'char';
    if (mac && meta) unit = 'line';
    else if (wordKey) unit = 'word';
    else if (alt || ctrl || meta) return null;
    return key === 'Backspace' ? { type: 'deleteBackward', unit } : { type: 'deleteForward', unit };
  }
  if (key === 'Enter') return alt || ctrl || meta ? null : { type: 'newline' };
  if (key === 'Tab') return alt || ctrl || meta ? null : { type: 'tab', outdent: shift };
  if (key === 'Escape') return { type: 'escape' };
  return null;
}

/* ══ CallStack's logic, as plain functions: which rows a list of frames shows, and how a location reads. ══ */

export interface CallStackLocation {
  /** A path or URL, as long as you like; the list shows its last part. */
  file: string;
  line: number;
  column?: number;
}

/** What a frame is. `framework` and `library` frames fold together in runs. `async` isn't a frame at all: it marks an
 *  async boundary, drawn as a separator, between the frames before and after it. */
export type CallStackFrameKind = 'app' | 'framework' | 'library' | 'async';

export interface CallStackFrame {
  /** Unique in the stack. */
  id: string;
  /** Empty shows `(anonymous)`. */
  functionName?: string;
  location?: CallStackLocation;
  /** Default `app`. */
  kind?: CallStackFrameKind;
  /** On a framework or library frame, who it belongs to: a run of them reads `3 React frames`. On an async boundary, the
   *  separator's text: `await fetchUser`. */
  label?: string;
}

export type CallStackRow =
  | {
      kind: 'frame';
      key: string;
      frame: CallStackFrame;
      /** Where it is in `frames`. */
      index: number;
      /** Where the stack is stopped: the first real frame. */
      isTop: boolean;
      /** Inside an opened run, so it's set in from the rows around it. */
      inRun: boolean;
    }
  | {
      kind: 'run';
      key: string;
      /** Names the whole run, even when the selected frame splits it into two rows. */
      runId: string;
      label: string;
      count: number;
      expanded: boolean;
    };

/** The rows between two async boundaries. */
export interface CallStackSection {
  key: string;
  /** The separator above these rows. The first section has none. */
  label?: string;
  rows: readonly CallStackRow[];
}

export interface CallStackRowsOptions {
  selectedId?: string | null;
  /** Runs opened by hand, by `runId`. */
  expandedRuns?: ReadonlySet<string>;
  /** Fewest frames that fold into a row. Default 2: one frame reads better than `1 framework frame`. */
  minRun?: number;
  /** Fold runs at all. Default `true`. */
  collapse?: boolean;
}

const foldable = (frame: CallStackFrame) => frame.kind === 'framework' || frame.kind === 'library';

const SECTION_MARK = '\u001fsection\u001f';
const RUN_MARK = '\u001frun\u001f';
const runKey = (runId: string, part: number) => `${RUN_MARK}${runId}${part ? `\u001f${part}` : ''}`;

/** `3 React frames`, `3 framework frames`, `3 framework and library frames`. */
export function runLabel(frames: readonly CallStackFrame[]): string {
  const count = frames.length;
  const noun = count === 1 ? 'frame' : 'frames';
  const first = frames[0];
  if (first?.label && frames.every((f) => f.label === first.label)) return `${count} ${first.label} ${noun}`;
  if (first && frames.every((f) => f.kind === first.kind)) return `${count} ${first.kind} ${noun}`;
  return `${count} framework and library ${noun}`;
}

/** Works out the rows: runs of framework and library frames fold into one row, async boundaries start a new section.
 *  The top frame and the selected frame always show, splitting a run around them if they're inside one. */
export function buildCallStackRows(frames: readonly CallStackFrame[], options: CallStackRowsOptions = {}): CallStackSection[] {
  const { selectedId, expandedRuns, minRun = 2, collapse = true } = options;
  const sections: CallStackSection[] = [];
  let rows: CallStackRow[] = [];
  // Sections and frames share react-aria's keys, so a frame called `top` mustn't meet a section called `top`.
  let sectionKey = SECTION_MARK;
  let sectionLabel: string | undefined;
  const flush = () => {
    if (rows.length) sections.push({ key: sectionKey, ...(sectionLabel === undefined ? {} : { label: sectionLabel }), rows });
    rows = [];
  };
  let topIndex = frames.findIndex((f) => f.kind !== 'async');
  if (topIndex < 0) topIndex = 0;
  const frameRow = (index: number, inRun: boolean): CallStackRow => {
    const frame = frames[index]!;
    return { kind: 'frame', key: frame.id, frame, index, isTop: index === topIndex, inRun };
  };

  for (let i = 0; i < frames.length; ) {
    const frame = frames[i]!;
    if (frame.kind === 'async') {
      flush();
      sectionKey = `${SECTION_MARK}${frame.id}`;
      sectionLabel = frame.label || 'async';
      i++;
      continue;
    }
    if (!collapse || !foldable(frame)) {
      rows.push(frameRow(i, false));
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < frames.length && foldable(frames[end + 1]!)) end++;
    const runId = frame.id;
    const whole = frames.slice(i, end + 1);
    if (whole.length < minRun) {
      for (let at = i; at <= end; at++) rows.push(frameRow(at, false));
    } else if (expandedRuns?.has(runId)) {
      rows.push({ kind: 'run', key: runKey(runId, 0), runId, label: runLabel(whole), count: whole.length, expanded: true });
      for (let at = i; at <= end; at++) rows.push(frameRow(at, true));
    } else {
      // Fold what's on either side of a frame that has to stay on show. The first fold has the key the open run's row
      // has, so opening and closing keep the keyboard on it.
      let start = i;
      let folds = 0;
      const part = (to: number) => {
        const piece = frames.slice(start, to);
        if (piece.length >= minRun) {
          rows.push({ kind: 'run', key: runKey(runId, folds++), runId, label: runLabel(piece), count: piece.length, expanded: false });
        } else {
          for (let at = start; at < to; at++) rows.push(frameRow(at, false));
        }
      };
      for (let at = i; at <= end; at++) {
        if (at === topIndex || frames[at]!.id === selectedId) {
          part(at);
          rows.push(frameRow(at, false));
          start = at + 1;
        }
      }
      part(end + 1);
    }
    i = end + 1;
  }
  flush();
  return sections;
}

const sameRow = (a: CallStackRow, b: CallStackRow) =>
  a.kind === 'frame' && b.kind === 'frame'
    ? a.frame === b.frame && a.index === b.index && a.isTop === b.isTop && a.inRun === b.inRun
    : a.kind === 'run' && b.kind === 'run' && a.key === b.key && a.label === b.label && a.expanded === b.expanded;

/** The same sections, reusing last time's objects wherever nothing changed. It's what keeps pressing a frame in a
 *  thousand-frame stack from rebuilding a thousand rows. */
export function reuseCallStackRows(last: readonly CallStackSection[] | null, next: CallStackSection[]): CallStackSection[] {
  if (!last) return next;
  const rowsByKey = new Map<string, CallStackRow>();
  for (const section of last) for (const row of section.rows) rowsByKey.set(row.key, row);
  const sectionsByKey = new Map(last.map((s) => [s.key, s]));
  return next.map((section) => {
    const was = sectionsByKey.get(section.key);
    const rows = section.rows.map((row) => {
      const old = rowsByKey.get(row.key);
      return old && sameRow(old, row) ? old : row;
    });
    if (was && was.label === section.label && was.rows.length === rows.length && was.rows.every((r, i) => r === rows[i])) return was;
    return { ...section, rows };
  });
}

/** Rows above a frame's row, counting separators: where to scroll to find it. */
export function callStackRowOffset(sections: readonly CallStackSection[], id: string): number | null {
  let rows = 0;
  for (const section of sections) {
    if (section.label !== undefined) rows++;
    for (const row of section.rows) {
      if (row.kind === 'frame' && row.frame.id === id) return rows;
      rows++;
    }
  }
  return null;
}

/** A path's last part, without a query or hash: `src/app.tsx?v=2#x` is `app.tsx`. */
export function fileBaseName(file: string): string {
  const bare = file.split(/[?#]/, 1)[0] ?? file;
  const trimmed = bare.replace(/[/\\]+$/, '');
  const name = trimmed.slice(Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\')) + 1);
  return name || file;
}

/** What a row shows: `app.tsx:12`. */
export function shortLocation(location: CallStackLocation): string {
  return `${fileBaseName(location.file)}:${location.line}`;
}

/** The whole thing: `/src/app.tsx:12:5`. */
export function fullLocation(location: CallStackLocation): string {
  return `${location.file}:${location.line}${location.column === undefined ? '' : `:${location.column}`}`;
}

/** The text a frame answers to, for type-to-select and screen readers. */
export function frameText(frame: CallStackFrame): string {
  const name = frame.functionName || '(anonymous)';
  return frame.location ? `${name} ${shortLocation(frame.location)}` : name;
}

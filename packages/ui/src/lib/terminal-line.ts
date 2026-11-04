/* ══ Terminal line discipline — what a shell's readline does, for a host with no PTY behind the terminal ══
   A host that takes whole command lines (a function, a request, an in-browser runtime) gets line editing, history,
   completion and Ctrl-C from here:

     const shell = createTerminalShell({
       prompt: '$ ',
       onCommand: async (line, io) => { io.write(await run(line, { signal: io.signal })); },
     });
     shell.attach({ write: (data) => term.write(data) });
     term.onData = shell.input;

   Everything below `createTerminalShell` is pure: keys in, state out, or state in, escape sequences out. The shell owns
   the prompt, the transcript and the running command, and has no DOM or React, so a host can keep it outside a component
   and re-attach it to a new terminal after a remount with the output and the half-typed line intact. ══ */

/* ── State ── */

export interface LineState {
  /** The line being edited. */
  readonly line: string;
  /** The cursor, in UTF-16 units into `line`, always on a grapheme boundary. */
  readonly cursor: number;
  /** Submitted lines, oldest first. */
  readonly history: readonly string[];
  /** The history entry being shown, or null when editing a new line. */
  readonly browsing: number | null;
  /** The unfinished line, set aside while browsing history. */
  readonly draft: string;
  /** What Ctrl-U, Ctrl-K and Ctrl-W last removed; Ctrl-Y puts it back. */
  readonly killed: string;
}

export const MAX_HISTORY = 1000;

export function createLineState(history: readonly string[] = []): LineState {
  return { line: '', cursor: 0, history: history.slice(-MAX_HISTORY), browsing: null, draft: '', killed: '' };
}

/* ── Text: graphemes and terminal cells ── */

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

function* graphemesOf(text: string): Generator<string> {
  if (segmenter) for (const { segment } of segmenter.segment(text)) yield segment;
  else yield* text;
}

function prevGrapheme(text: string, at: number) {
  if (at <= 0) return 0;
  if (!segmenter) return at - 1;
  return segmenter.segment(text).containing(at - 1)?.index ?? 0;
}

function nextGrapheme(text: string, at: number) {
  if (at >= text.length) return text.length;
  if (!segmenter) return at + 1;
  const hit = segmenter.segment(text).containing(at);
  return hit ? hit.index + hit.segment.length : text.length;
}

/* The escape sequences a prompt may carry (colors, titles), which take no cells. */
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b(?:\[[0-9;?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_])/g;

export const stripAnsi = (text: string) => text.replace(ANSI, '');

const ZERO_WIDTH = /^[\p{Mn}\p{Me}\p{Cf}]+$/u;
const DOUBLE_WIDTH = /[\p{Emoji_Presentation}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}、-〿！-｠￠-￦]/u;
const IDEOGRAPHIC_SPACE = '　';
const EMOJI_STYLE = '️';

/** How many terminal cells a grapheme takes: 0 (combining), 1 or 2 (CJK, emoji). */
export function cellWidth(grapheme: string): number {
  if (grapheme.length === 1 && grapheme >= ' ' && grapheme <= '~') return 1;
  if (!grapheme || ZERO_WIDTH.test(grapheme)) return 0;
  return grapheme === IDEOGRAPHIC_SPACE || grapheme.includes(EMOJI_STYLE) || DOUBLE_WIDTH.test(grapheme) ? 2 : 1;
}

/** How many terminal cells a string takes on one row, ignoring escape sequences. */
export function textWidth(text: string): number {
  let width = 0;
  for (const g of graphemesOf(stripAnsi(text))) width += cellWidth(g);
  return width;
}

export interface CellPosition {
  row: number;
  /** May equal the width: the terminal is holding the cursor on the last cell until the next character wraps it. */
  col: number;
}

/** Where the cursor ends up after writing `text` from `from` in a terminal `cols` wide. */
export function advance(from: CellPosition, text: string, cols: number): CellPosition {
  let { row, col } = from;
  const width = Math.max(1, cols);
  for (const g of graphemesOf(stripAnsi(text))) {
    const w = cellWidth(g);
    if (!w) continue;
    // A double-width glyph that doesn't fit on the last cell moves down whole.
    if (col + w > width) { row += 1; col = 0; }
    col += w;
  }
  return { row, col };
}

/* ── Keys ── */

/** Splits terminal input into keys: one escape sequence, one control character or one run of text each. */
export function readKeys(data: string): string[] {
  const keys: string[] = [];
  let i = 0;
  while (i < data.length) {
    const c = data[i];
    if (c === '\x1b') {
      // eslint-disable-next-line no-control-regex
      const m = /^\x1b(?:\[[0-9;?]*[ -/]*[@-~]|O.|[\s\S])?/.exec(data.slice(i));
      const seq = m ? m[0] : c;
      keys.push(seq);
      i += seq.length;
    } else if (c === '\r' && data[i + 1] === '\n') {
      keys.push('\r');
      i += 2;
    } else if (c === '\n') {
      keys.push('\r');
      i += 1;
    } else if (c < ' ' || c === '\x7f') {
      keys.push(c);
      i += 1;
    } else {
      let j = i + 1;
      while (j < data.length && data[j] >= ' ' && data[j] !== '\x7f') j += 1;
      keys.push(data.slice(i, j));
      i = j;
    }
  }
  return keys;
}

const isSpace = (c: string | undefined) => c === ' ' || c === '\t';

function wordBack(text: string, at: number) {
  let i = at;
  while (i > 0 && isSpace(text[i - 1])) i -= 1;
  while (i > 0 && !isSpace(text[i - 1])) i -= 1;
  return i;
}

function wordForward(text: string, at: number) {
  let i = at;
  while (i < text.length && isSpace(text[i])) i += 1;
  while (i < text.length && !isSpace(text[i])) i += 1;
  return i;
}

export type LineEvent =
  /** Enter: the line was accepted (and recorded in history). */
  | { type: 'submit'; line: string }
  /** Ctrl-C at the prompt, with the line it threw away. */
  | { type: 'interrupt'; line: string }
  /** Ctrl-D on an empty line. */
  | { type: 'eof' }
  /** Ctrl-L. */
  | { type: 'clear' }
  /** Tab. */
  | { type: 'complete' };

export interface LineStep {
  state: LineState;
  event?: LineEvent;
}

function edit(state: LineState, line: string, cursor: number): LineState {
  return { ...state, line, cursor, browsing: null };
}

function showHistory(state: LineState, index: number | null): LineState {
  const line = index === null ? state.draft : state.history[index];
  return { ...state, browsing: index, line, cursor: line.length };
}

/** One key: the next state, and what happened if the line is done with. Keys it doesn't know change nothing. */
export function applyKey(state: LineState, key: string): LineStep {
  const { line, cursor, history, browsing } = state;
  switch (key) {
    case '\r': {
      const repeat = history[history.length - 1] === line;
      const nextHistory = line.trim() && !repeat ? [...history, line].slice(-MAX_HISTORY) : history;
      return { state: { ...state, line: '', cursor: 0, history: nextHistory, browsing: null, draft: '' }, event: { type: 'submit', line } };
    }
    case '\x03':
      return { state: { ...state, line: '', cursor: 0, browsing: null, draft: '' }, event: { type: 'interrupt', line } };
    case '\x04':
      if (!line) return { state, event: { type: 'eof' } };
      return { state: edit(state, line.slice(0, cursor) + line.slice(nextGrapheme(line, cursor)), cursor) };
    case '\x0c':
      return { state, event: { type: 'clear' } };
    case '\t':
      return { state, event: { type: 'complete' } };
    case '\x7f':
    case '\b': {
      if (!cursor) return { state };
      const at = prevGrapheme(line, cursor);
      return { state: edit(state, line.slice(0, at) + line.slice(cursor), at) };
    }
    case '\x1b[3~':
      return { state: edit(state, line.slice(0, cursor) + line.slice(nextGrapheme(line, cursor)), cursor) };
    case '\x1b[D':
    case '\x1bOD':
    case '\x02':
      return { state: { ...state, cursor: prevGrapheme(line, cursor) } };
    case '\x1b[C':
    case '\x1bOC':
    case '\x06':
      return { state: { ...state, cursor: nextGrapheme(line, cursor) } };
    case '\x1b[H':
    case '\x1bOH':
    case '\x1b[1~':
    case '\x01':
      return { state: { ...state, cursor: 0 } };
    case '\x1b[F':
    case '\x1bOF':
    case '\x1b[4~':
    case '\x05':
      return { state: { ...state, cursor: line.length } };
    case '\x1b[1;5D':
    case '\x1b[1;3D':
    case '\x1bb':
      return { state: { ...state, cursor: wordBack(line, cursor) } };
    case '\x1b[1;5C':
    case '\x1b[1;3C':
    case '\x1bf':
      return { state: { ...state, cursor: wordForward(line, cursor) } };
    case '\x1b[A':
    case '\x1bOA':
    case '\x10': {
      if (!history.length || browsing === 0) return { state };
      const held = browsing === null ? { ...state, draft: line } : state;
      return { state: showHistory(held, browsing === null ? history.length - 1 : browsing - 1) };
    }
    case '\x1b[B':
    case '\x1bOB':
    case '\x0e': {
      if (browsing === null) return { state };
      return { state: showHistory(state, browsing + 1 < history.length ? browsing + 1 : null) };
    }
    case '\x15': {
      if (!cursor) return { state };
      return { state: { ...edit(state, line.slice(cursor), 0), killed: line.slice(0, cursor) } };
    }
    case '\x0b': {
      if (cursor === line.length) return { state };
      return { state: { ...edit(state, line.slice(0, cursor), cursor), killed: line.slice(cursor) } };
    }
    case '\x17':
    case '\x1b\x7f':
    case '\x1b\b': {
      const at = wordBack(line, cursor);
      if (at === cursor) return { state };
      return { state: { ...edit(state, line.slice(0, at) + line.slice(cursor), at), killed: line.slice(at, cursor) } };
    }
    case '\x19': {
      if (!state.killed) return { state };
      return { state: edit(state, line.slice(0, cursor) + state.killed + line.slice(cursor), cursor + state.killed.length) };
    }
    default: {
      // Text. Anything else starting with a control character is a key this line doesn't use (and the replies a terminal
      // sends to queries, such as a cursor position report).
      if (key < ' ' || key[0] === '\x7f') return { state };
      return { state: edit(state, line.slice(0, cursor) + key + line.slice(cursor), cursor + key.length) };
    }
  }
}

/* ── Drawing ── */

export interface RenderedLine {
  /** Escape sequences that replace what's on screen with the prompt and line, leaving the cursor in place. */
  output: string;
  /** The row the cursor ends on, counted from the prompt's first row. Pass it back as `fromRow` next time. */
  row: number;
}

const up = (rows: number) => (rows > 0 ? `\x1b[${rows}A` : '');
const right = (cols: number) => (cols > 0 ? `\x1b[${cols}C` : '');

/** The sequences that clear a drawn prompt and line, leaving the cursor where its first row starts. */
export const eraseLine = (fromRow: number) => `${up(fromRow)}\r\x1b[J`;

/** Redraws the whole prompt and line. Redrawing, rather than patching, is what keeps a line that wraps right: cursor
 *  movement doesn't cross rows on its own, and a narrow window wraps most lines. */
export function renderLine(prompt: string, line: string, cursor: number, cols: number, fromRow = 0): RenderedLine {
  const origin = { row: 0, col: 0 };
  const width = Math.max(1, cols);
  const end = advance(origin, prompt + line, width);
  let output = eraseLine(fromRow) + prompt + line;
  // A line that ends on the last cell leaves the cursor waiting to wrap: make it wrap, so the rows below are counted right.
  const wrapped = end.col === width;
  if (wrapped) output += '\r\n';
  const endRow = end.row + (wrapped ? 1 : 0);
  const to = advance(origin, prompt + line.slice(0, cursor), width);
  const targetRow = to.col === width ? to.row + 1 : to.row;
  const targetCol = to.col === width ? 0 : to.col;
  output += up(endRow - targetRow) + '\r' + right(targetCol);
  return { output, row: targetRow };
}

/* ── Completion ── */

/** The whitespace-separated word the cursor is at the end of. */
export function wordAtCursor(line: string, cursor: number) {
  const before = line.slice(0, cursor);
  const from = Math.max(before.lastIndexOf(' '), before.lastIndexOf('\t')) + 1;
  return { from, word: before.slice(from) };
}

const commonPrefix = (items: readonly string[]) => {
  let prefix = items[0] ?? '';
  for (const item of items) {
    let i = 0;
    while (i < prefix.length && i < item.length && prefix[i] === item[i]) i += 1;
    prefix = prefix.slice(0, i);
  }
  return prefix;
};

export interface CompletionStep {
  state: LineState;
  /** There was nothing to add and several candidates: show these. */
  list?: readonly string[];
}

/** Applies candidates for the word at the cursor: the only match in full (with a space, unless it's a folder), else as
 *  much as they share, else the list of them. */
export function applyCompletion(state: LineState, candidates: readonly string[]): CompletionStep {
  if (!candidates.length) return { state };
  const { from, word } = wordAtCursor(state.line, state.cursor);
  const only = candidates.length === 1;
  const shared = only ? candidates[0] + (candidates[0].endsWith('/') ? '' : ' ') : commonPrefix(candidates);
  if (shared.length <= word.length) return { state, list: only ? undefined : candidates };
  const line = state.line.slice(0, from) + shared + state.line.slice(state.cursor);
  return { state: edit(state, line, from + shared.length) };
}

/** Lays items out in columns that fit `cols`, down then across, the way `ls` does. */
export function formatColumns(items: readonly string[], cols: number): string {
  if (!items.length) return '';
  const width = Math.max(...items.map(textWidth)) + 2;
  const across = Math.max(1, Math.floor(Math.max(1, cols) / width));
  const down = Math.ceil(items.length / across);
  const rows: string[] = [];
  for (let r = 0; r < down; r += 1) {
    let row = '';
    for (let c = 0; c < across; c += 1) {
      const item = items[r + c * down];
      if (item === undefined) break;
      const last = r + (c + 1) * down >= items.length;
      row += last ? item : item + ' '.repeat(width - textWidth(item));
    }
    rows.push(row);
  }
  return rows.join('\r\n');
}

/* ── Writing to a terminal ── */

/** A PTY turns a program's `\n` into `\r\n`; with no PTY, something has to. */
export const toTerminalNewlines = (text: string) => text.replace(/\r?\n/g, '\r\n');

/** Drops the oldest output to stay within `max` characters, from a line start where there is one. */
export function trimTranscript(text: string, max: number): string {
  if (text.length <= max) return text;
  const start = text.length - max;
  const newline = text.indexOf('\n', start);
  return newline >= 0 && newline < text.length - 1 ? text.slice(newline + 1) : text.slice(start);
}

/* ── The shell ── */

/** What a command gets. */
export interface TerminalCommandIO {
  /** Prints to the terminal; `\n` becomes a line break. */
  write: (data: string) => void;
  /** Aborted by Ctrl-C. */
  signal: AbortSignal;
  /** Keys typed while the command runs, other than Ctrl-C. Returns a function that stops listening. Keys nobody is
   *  listening for wait, as they do in a terminal's buffer: for a listener, or else for the next prompt. */
  onInput: (listener: (data: string) => void) => () => void;
  /** Clears the screen and the scrollback. */
  clear: () => void;
  cols: number;
  rows: number;
}

export type TerminalCommandHandler = (line: string, io: TerminalCommandIO) => void | number | Promise<void | number>;

/** Candidates for the word at the cursor, each a whole replacement for it. A folder ends in `/`. */
export type TerminalCompleter = (context: { word: string; line: string; cursor: number }) => readonly string[] | Promise<readonly string[]>;

export interface TerminalShellOptions {
  /** The prompt, redrawn each time it shows. One row, and it may carry colors. Default `$ `. */
  prompt?: string | (() => string);
  onCommand: TerminalCommandHandler;
  complete?: TerminalCompleter;
  /** Ctrl-D on an empty line. */
  onEof?: () => void;
  /** Lines the up arrow starts with, oldest first. */
  history?: readonly string[];
  /** Printed once, before the first prompt. */
  greeting?: string;
  /** How much output to keep for a terminal that attaches later, in characters. Default 1,000,000. */
  maxTranscript?: number;
}

export interface TerminalSink {
  write: (data: string) => void;
}

export interface TerminalShell {
  /** Starts drawing on a terminal: the output so far, then the prompt. Returns a function that detaches it. */
  attach: (sink: TerminalSink, size?: { cols: number; rows: number }) => () => void;
  /** What the terminal's user typed. */
  input: (data: string) => void;
  /** Runs a line as if it had been typed, after whatever is running now. */
  run: (line: string) => void;
  /** Prints above the prompt, without disturbing the line being edited. */
  write: (data: string) => void;
  /** Redraws the prompt, after whatever it shows has changed. */
  refreshPrompt: () => void;
  resize: (cols: number, rows: number) => void;
  clear: () => void;
  /** Aborts what is running and stops drawing. */
  dispose: () => void;
  readonly busy: boolean;
  /** The line being edited. */
  readonly line: string;
  readonly history: readonly string[];
  /** Called when `busy` changes. Returns a function that stops listening. */
  subscribe: (listener: () => void) => () => void;
}

interface RunningCommand {
  controller: AbortController;
  listeners: Set<(data: string) => void>;
  /** Ctrl-C pressed; a second one stops waiting for the command to notice. */
  interrupted: boolean;
}

/** A prompt, a line editor and one running command at a time. See the top of this file. */
export function createTerminalShell(options: TerminalShellOptions): TerminalShell {
  const maxTranscript = options.maxTranscript ?? 1_000_000;
  let state = createLineState(options.history);
  let sink: TerminalSink | null = null;
  let cols = 80;
  let rows = 24;
  let transcript = options.greeting ? toTerminalNewlines(options.greeting.endsWith('\n') ? options.greeting : `${options.greeting}\n`) : '';
  /** The output so far ended a line. */
  let atLineStart = true;
  /** The prompt is on screen, and the cursor is `promptRow` rows below where it starts. */
  let promptShown = false;
  let promptRow = 0;
  let running: RunningCommand | null = null;
  const queue: string[] = [];
  /** Typed during a command, with nothing reading it. */
  let typeAhead = '';
  const subscribers = new Set<() => void>();
  let disposed = false;
  /** Bumped by every edit, so a slow completion can tell it's out of date. */
  let revision = 0;

  const promptText = () => {
    const { prompt = '$ ' } = options;
    return typeof prompt === 'function' ? prompt() : prompt;
  };
  const notify = () => { for (const listener of subscribers) listener(); };

  /** Output that stays: it goes in the transcript as well as on screen. */
  const commit = (data: string) => {
    if (!data) return;
    transcript = trimTranscript(transcript + data, maxTranscript);
    atLineStart = /[\r\n]$/.test(data);
    sink?.write(data);
  };

  const drawPrompt = () => {
    if (running || disposed) return;
    const { output, row } = renderLine(promptText(), state.line, state.cursor, cols, promptShown ? promptRow : 0);
    promptShown = true;
    promptRow = row;
    sink?.write(output);
  };

  const erasePrompt = () => {
    if (promptShown) sink?.write(eraseLine(promptRow));
    promptShown = false;
    promptRow = 0;
  };

  /** Leaves what's on screen as the record of the line: it stays, the cursor moves below it. */
  const commitPromptLine = (line: string) => {
    erasePrompt();
    commit(`${promptText()}${line}\r\n`);
  };

  const finish = () => {
    running = null;
    if (!atLineStart) commit('\r\n');
    notify();
    next();
    if (typeAhead && !running) {
      const held = typeAhead;
      typeAhead = '';
      input(held);
    }
  };

  function next() {
    if (disposed || running) return;
    const line = queue.shift();
    if (line === undefined) { drawPrompt(); return; }
    commitPromptLine(line);
    if (line.trim()) execute(line);
    else next();
  }

  function execute(line: string) {
    const command: RunningCommand = { controller: new AbortController(), listeners: new Set(), interrupted: false };
    running = command;
    notify();
    const io: TerminalCommandIO = {
      write: (data) => { if (running === command) commit(toTerminalNewlines(data)); },
      signal: command.controller.signal,
      onInput: (listener) => {
        command.listeners.add(listener);
        if (typeAhead && running === command) {
          const held = typeAhead;
          typeAhead = '';
          listener(held);
        }
        return () => { command.listeners.delete(listener); };
      },
      clear: () => { if (running === command) clearScreen(); },
      get cols() { return cols; },
      get rows() { return rows; },
    };
    let result: ReturnType<TerminalCommandHandler>;
    try {
      result = options.onCommand(line, io);
    } catch (error) {
      result = Promise.reject(error);
    }
    Promise.resolve(result).then(
      () => { if (running === command) finish(); },
      (error: unknown) => {
        if (running !== command) return;
        if (!command.controller.signal.aborted) commit(toTerminalNewlines(`${error instanceof Error ? error.message : String(error)}\n`));
        finish();
      },
    );
  }

  function clearScreen() {
    transcript = '';
    atLineStart = true;
    promptShown = false;
    promptRow = 0;
    sink?.write('\x1b[3J\x1b[2J\x1b[H');
  }

  const interruptCommand = (command: RunningCommand) => {
    typeAhead = '';
    commit('^C\r\n');
    if (command.interrupted) {
      // It didn't stop for the first one. Stop waiting; what it still prints goes nowhere.
      queue.length = 0;
      finish();
      return;
    }
    command.interrupted = true;
    queue.length = 0;
    command.controller.abort();
  };

  const complete = () => {
    if (!options.complete) return;
    const at = revision;
    const { word } = wordAtCursor(state.line, state.cursor);
    Promise.resolve(options.complete({ word, line: state.line, cursor: state.cursor })).then((candidates) => {
      if (at !== revision || running || disposed) return;
      const step = applyCompletion(state, candidates);
      state = step.state;
      if (step.list) {
        const names = step.list.map((c) => c.replace(/\/$/, '').split('/').pop() + (c.endsWith('/') ? '/' : ''));
        commitPromptLine(state.line);
        commit(`${formatColumns(names, cols)}\r\n`);
      }
      revision += 1;
      drawPrompt();
    }, () => {});
  };

  const applyEvent = (event: LineEvent) => {
    switch (event.type) {
      case 'submit':
        queue.push(event.line);
        next();
        return;
      case 'interrupt':
        // What was typed stays on screen, followed by the ^C.
        commitPromptLine(`${event.line}^C`);
        drawPrompt();
        return;
      case 'eof':
        options.onEof?.();
        return;
      case 'clear':
        clearScreen();
        drawPrompt();
        return;
      case 'complete':
        complete();
        return;
    }
  };

  function input(data: string) {
    if (disposed) return;
    if (running) {
      const command = running;
      const at = data.indexOf('\x03');
      if (at >= 0) {
        if (at > 0) for (const listener of command.listeners) listener(data.slice(0, at));
        interruptCommand(command);
        return;
      }
      if (command.listeners.size) for (const listener of command.listeners) listener(data);
      else typeAhead += data;
      return;
    }
    const keys = readKeys(data);
    let dirty = false;
    for (let i = 0; i < keys.length; i += 1) {
      if (running) {
        // A paste went on past a line that started a command. Its other lines wait for that command, the way a shell
        // reads them after it; what has no line break yet is left typed at the next prompt.
        const lines = keys.slice(i).join('').split('\r');
        const rest = lines.pop() ?? '';
        queue.push(...lines);
        for (const key of readKeys(rest)) state = applyKey(state, key).state;
        return;
      }
      const step = applyKey(state, keys[i]);
      if (step.state !== state) { revision += 1; dirty = true; }
      state = step.state;
      if (step.event) {
        dirty = false;
        applyEvent(step.event);
      }
    }
    if (dirty) drawPrompt();
  }

  return {
    attach(target, size) {
      sink = target;
      if (size) { cols = size.cols; rows = size.rows; }
      promptShown = false;
      promptRow = 0;
      if (transcript) target.write(transcript);
      if (!atLineStart && !running) target.write('\r\n');
      drawPrompt();
      return () => { if (sink === target) sink = null; };
    },
    input,
    run(line) {
      if (disposed) return;
      queue.push(line);
      next();
    },
    write(data) {
      const wasShown = promptShown && !running;
      if (wasShown) erasePrompt();
      commit(toTerminalNewlines(data));
      if (wasShown) {
        if (!atLineStart) commit('\r\n');
        drawPrompt();
      }
    },
    refreshPrompt() {
      if (promptShown && !running) drawPrompt();
    },
    resize(nextCols, nextRows) {
      const changed = nextCols !== cols;
      cols = nextCols;
      rows = nextRows;
      // The terminal has re-laid out the rows; the prompt may now span a different number of them.
      if (changed && promptShown && !running) {
        promptRow = advance({ row: 0, col: 0 }, promptText() + state.line.slice(0, state.cursor), cols).row;
        drawPrompt();
      }
    },
    clear() {
      clearScreen();
      drawPrompt();
    },
    dispose() {
      disposed = true;
      running?.controller.abort();
      running = null;
      sink = null;
      subscribers.clear();
    },
    get busy() { return running !== null; },
    get line() { return state.line; },
    get history() { return state.history; },
    subscribe(listener) {
      subscribers.add(listener);
      return () => { subscribers.delete(listener); };
    },
  };
}

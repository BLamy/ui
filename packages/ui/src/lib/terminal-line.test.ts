/* eslint-disable no-control-regex -- terminals are made of these. */
import { describe, expect, it, vi } from 'vitest';
import {
  advance, applyCompletion, applyKey, cellWidth, createLineState, createTerminalShell, eraseLine, formatColumns, readKeys, renderLine, stripAnsi, textWidth,
  toTerminalNewlines, trimTranscript, wordAtCursor, type LineState, type TerminalCommandIO,
} from '@/lib/terminal-line';

const typed = (keys: string[], state: LineState = createLineState()) => keys.reduce((s, key) => applyKey(s, key).state, state);
const LEFT = '\x1b[D', RIGHT = '\x1b[C', UP = '\x1b[A', DOWN = '\x1b[B', BACKSPACE = '\x7f', DELETE = '\x1b[3~', HOME = '\x1b[H', END = '\x1b[F';

describe('readKeys', () => {
  it('splits text, control characters and escape sequences', () => {
    expect(readKeys(`ab${LEFT}c\x03\x1bb\x1b[1;5D`)).toEqual(['ab', LEFT, 'c', '\x03', '\x1bb', '\x1b[1;5D']);
  });

  it('treats every line ending as Enter', () => {
    expect(readKeys('a\r\nb\nc\r')).toEqual(['a', '\r', 'b', '\r', 'c', '\r']);
  });

  it('takes SS3 and bracketed-paste markers as one key each', () => {
    expect(readKeys('\x1bOA\x1b[200~x\x1b[201~')).toEqual(['\x1bOA', '\x1b[200~', 'x', '\x1b[201~']);
  });
});

describe('applyKey: editing', () => {
  it('inserts at the cursor', () => {
    const s = typed(['hello', LEFT, LEFT, 'XY']);
    expect(s.line).toBe('helXYlo');
    expect(s.cursor).toBe(5);
  });

  it('backspace and delete remove a character either side of the cursor', () => {
    expect(typed(['abc', BACKSPACE]).line).toBe('ab');
    expect(typed(['abc', HOME, DELETE]).line).toBe('bc');
    expect(typed([BACKSPACE]).line).toBe('');
  });

  it('moves a whole grapheme at a time', () => {
    const s = typed(['a👍🏽b', LEFT, LEFT]);
    expect(s.cursor).toBe(1);
    expect(typed(['👍🏽', BACKSPACE]).line).toBe('');
  });

  it('home, end and word moves', () => {
    expect(typed(['one two', HOME]).cursor).toBe(0);
    expect(typed(['one two', HOME, END]).cursor).toBe(7);
    expect(typed(['one two', '\x1bb']).cursor).toBe(4);
    expect(typed(['one two', HOME, '\x1bf']).cursor).toBe(3);
  });

  it('Ctrl-U, Ctrl-K and Ctrl-W cut, and Ctrl-Y puts back', () => {
    expect(typed(['one two', '\x15']).line).toBe('');
    expect(typed(['one two', HOME, '\x0b']).line).toBe('');
    expect(typed(['one two', '\x17']).line).toBe('one ');
    expect(typed(['one two', '\x17', '\x19']).line).toBe('one two');
  });

  it('ignores keys it has no use for, and the replies a terminal sends to queries', () => {
    const s = typed(['ok', '\x1b[12;3R', '\x1b[?1;2c', '\x1bOP']);
    expect(s.line).toBe('ok');
  });
});

describe('applyKey: what ends a line', () => {
  it('Enter submits, records history and clears', () => {
    const { state, event } = applyKey(typed(['ls']), '\r');
    expect(event).toEqual({ type: 'submit', line: 'ls' });
    expect(state.line).toBe('');
    expect(state.history).toEqual(['ls']);
  });

  it('keeps blanks and immediate repeats out of history', () => {
    let s = createLineState();
    for (const line of ['ls', 'ls', '  ', 'pwd']) s = applyKey(typed([line], s), '\r').state;
    expect(s.history).toEqual(['ls', 'pwd']);
  });

  it('Ctrl-C discards the line and says what it was', () => {
    const { state, event } = applyKey(typed(['half']), '\x03');
    expect(event).toEqual({ type: 'interrupt', line: 'half' });
    expect(state.line).toBe('');
  });

  it('Ctrl-D is end of input only on an empty line', () => {
    expect(applyKey(createLineState(), '\x04').event).toEqual({ type: 'eof' });
    const { state, event } = applyKey(typed(['ab', HOME]), '\x04');
    expect(event).toBeUndefined();
    expect(state.line).toBe('b');
  });
});

describe('applyKey: history', () => {
  const start = createLineState(['one', 'two']);

  it('walks back and forward, and returns to the unfinished line', () => {
    expect(typed([UP], start).line).toBe('two');
    expect(typed([UP, UP], start).line).toBe('one');
    expect(typed([UP, UP, UP], start).line).toBe('one');
    const drafted = typed(['draft', UP, UP, DOWN, DOWN], start);
    expect(drafted.line).toBe('draft');
    expect(drafted.browsing).toBeNull();
  });

  it('puts the cursor at the end of what it shows', () => {
    expect(typed([UP], start).cursor).toBe(3);
  });

  it('editing what history shows starts a new line', () => {
    const s = typed([UP, '!'], start);
    expect(s.line).toBe('two!');
    expect(s.browsing).toBeNull();
  });
});

describe('cells', () => {
  it('counts wide and zero-width characters', () => {
    expect(cellWidth('a')).toBe(1);
    expect(cellWidth('中')).toBe(2);
    expect(cellWidth('😀')).toBe(2);
    expect(cellWidth('́')).toBe(0);
    expect(textWidth('a中😀')).toBe(5);
  });

  it('ignores escape sequences', () => {
    expect(textWidth('\x1b[32mproject\x1b[0m $ ')).toBe(10);
    expect(stripAnsi('\x1b]0;title\x07x')).toBe('x');
  });

  it('advance wraps, and holds a full row on its last cell', () => {
    expect(advance({ row: 0, col: 0 }, 'abcde', 5)).toEqual({ row: 0, col: 5 });
    expect(advance({ row: 0, col: 0 }, 'abcdef', 5)).toEqual({ row: 1, col: 1 });
  });

  it('a wide character that doesn\'t fit moves down whole', () => {
    expect(advance({ row: 0, col: 0 }, 'abcd中', 5)).toEqual({ row: 1, col: 2 });
  });
});

describe('renderLine', () => {
  it('draws the prompt and line and puts the cursor in place', () => {
    const { output, row } = renderLine('$ ', 'abc', 1, 80);
    expect(output).toBe('\r\x1b[J$ abc\r\x1b[3C');
    expect(row).toBe(0);
  });

  it('counts rows when the line wraps, and goes back up to the cursor', () => {
    const { output, row } = renderLine('$ ', 'abcdefghij', 2, 8);
    expect(output).toBe('\r\x1b[J$ abcdefghij\x1b[1A\r\x1b[4C');
    expect(row).toBe(0);
    expect(renderLine('$ ', 'abcdefghij', 10, 8).row).toBe(1);
  });

  it('wraps a line that ends on the last cell, so the rows below are counted right', () => {
    const { output, row } = renderLine('$ ', 'abcdef', 6, 8);
    expect(output).toBe('\r\x1b[J$ abcdef\r\n\r');
    expect(row).toBe(1);
  });

  it('starts from the row it last left the cursor on', () => {
    expect(renderLine('$ ', 'x', 1, 8, 2).output.startsWith('\x1b[2A\r\x1b[J')).toBe(true);
    expect(eraseLine(0)).toBe('\r\x1b[J');
  });
});

describe('completion', () => {
  it('finds the word at the cursor', () => {
    expect(wordAtCursor('cat src/gr', 10)).toEqual({ from: 4, word: 'src/gr' });
    expect(wordAtCursor('cat ', 4)).toEqual({ from: 4, word: '' });
  });

  it('completes the only match, with a space unless it\'s a folder', () => {
    expect(applyCompletion(typed(['cat in']), ['index.js']).state.line).toBe('cat index.js ');
    expect(applyCompletion(typed(['cd s']), ['src/']).state.line).toBe('cd src/');
  });

  it('fills in what several share, then lists them', () => {
    const first = applyCompletion(typed(['b']), ['build', 'bundle']);
    expect(first.state.line).toBe('bu');
    expect(first.list).toBeUndefined();
    const second = applyCompletion(first.state, ['build', 'bundle']);
    expect(second.state.line).toBe('bu');
    expect(second.list).toEqual(['build', 'bundle']);
  });

  it('keeps what follows the cursor', () => {
    expect(applyCompletion(typed(['b rest', HOME, RIGHT]), ['build']).state.line).toBe('build  rest');
  });

  it('lays items out in columns, down then across', () => {
    expect(formatColumns(['a', 'b', 'c', 'd'], 8)).toBe('a  c\r\nb  d');
    expect(formatColumns(['long-name', 'other'], 4)).toBe('long-name\r\nother');
    expect(formatColumns([], 80)).toBe('');
  });
});

describe('text for a terminal', () => {
  it('turns line feeds into what a terminal needs', () => {
    expect(toTerminalNewlines('a\nb\r\nc')).toBe('a\r\nb\r\nc');
  });

  it('drops the oldest output from a line start', () => {
    expect(trimTranscript('one\ntwo\nthree', 8)).toBe('three');
    expect(trimTranscript('short', 100)).toBe('short');
    expect(trimTranscript('nonewlineshere', 4)).toBe('here');
  });
});

/* ── The shell ── */

function setup(options: Partial<Parameters<typeof createTerminalShell>[0]> = {}) {
  let screen = '';
  const onCommand = vi.fn((line: string, io: TerminalCommandIO) => { io.write(`ran ${line}\n`); });
  const shell = createTerminalShell({ prompt: '$ ', onCommand, ...options });
  shell.attach({ write: (data) => { screen += data; } }, { cols: 80, rows: 24 });
  return {
    shell, onCommand,
    screen: () => screen,
    /** The screen without the redraws, near enough to read. */
    text: () => screen.replace(/\r\x1b\[J/g, '').replace(/\x1b\[\d*[A-Z]/g, ''),
    settle: () => new Promise<void>((resolve) => { setTimeout(resolve); }),
  };
}

describe('createTerminalShell', () => {
  it('draws a prompt when attached', () => {
    expect(setup().screen()).toContain('$ ');
  });

  it('runs a line, prints its output with line breaks, and comes back to the prompt', async () => {
    const { shell, onCommand, screen, settle } = setup();
    shell.input('ls');
    shell.input('\r');
    expect(onCommand).toHaveBeenCalledWith('ls', expect.anything());
    await settle();
    expect(screen()).toContain('ran ls\r\n');
    expect(screen()).toMatch(/\$ \r\x1b\[2C$/);
    expect(shell.busy).toBe(false);
  });

  it('a blank line just gives another prompt', async () => {
    const { shell, onCommand, settle } = setup();
    shell.input('\r');
    await settle();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('moves to a new line if output stops short of one', async () => {
    const { shell, screen, settle } = setup({ onCommand: (_line, io) => { io.write('no newline'); } });
    shell.input('x\r');
    await settle();
    expect(screen()).toContain('no newline\r\n');
  });

  it('prints what a failed command throws', async () => {
    const { shell, screen, settle } = setup({ onCommand: () => { throw new Error('nope'); } });
    shell.input('x\r');
    await settle();
    expect(screen()).toContain('nope\r\n');
    expect(shell.busy).toBe(false);
  });

  it('Ctrl-C aborts the signal and the prompt comes back when the command stops', async () => {
    let signal: AbortSignal | undefined;
    let stop = () => {};
    const { shell, screen, settle } = setup({
      onCommand: (_line, io) => new Promise<void>((resolve) => {
        signal = io.signal;
        stop = resolve;
      }),
    });
    shell.input('long\r');
    await settle();
    expect(shell.busy).toBe(true);
    shell.input('\x03');
    expect(signal?.aborted).toBe(true);
    expect(screen()).toContain('^C\r\n');
    expect(shell.busy).toBe(true);
    stop();
    await settle();
    expect(shell.busy).toBe(false);
  });

  it('a second Ctrl-C stops waiting for a command that ignores the first', async () => {
    const write: Array<(data: string) => void> = [];
    const { shell, screen, settle } = setup({
      onCommand: (_line, io) => {
        write.push(io.write);
        return new Promise<void>(() => {});
      },
    });
    shell.input('stuck\r');
    await settle();
    shell.input('\x03');
    shell.input('\x03');
    expect(shell.busy).toBe(false);
    write[0]('too late\n');
    expect(screen()).not.toContain('too late');
  });

  it('Ctrl-C at the prompt throws the line away, leaving it on screen', () => {
    const { shell, screen } = setup();
    shell.input('half');
    shell.input('\x03');
    expect(screen()).toContain('half^C\r\n');
    expect(shell.line).toBe('');
  });

  it('gives keys to a command that\'s listening', async () => {
    const heard: string[] = [];
    const { shell, settle } = setup({
      onCommand: (_line, io) => new Promise<void>(() => { io.onInput((data) => heard.push(data)); }),
    });
    shell.input('reader\r');
    await settle();
    shell.input('a');
    expect(heard).toEqual(['a']);
  });

  it('keys nobody is listening for wait for a listener, or for the next prompt', async () => {
    const heard: string[] = [];
    let listen = () => {};
    let finish = () => {};
    const { shell, settle } = setup({
      onCommand: (_line, io) => new Promise<void>((resolve) => {
        listen = () => { io.onInput((data) => heard.push(data)); };
        finish = resolve;
      }),
    });
    shell.input('late\r');
    await settle();
    shell.input('ab');
    expect(heard).toEqual([]);
    listen();
    expect(heard).toEqual(['ab']);
    finish();
    await settle();

    const other = setup({ onCommand: () => new Promise<void>((resolve) => { finish = resolve; }) });
    other.shell.input('slow\r');
    await other.settle();
    other.shell.input('next');
    expect(other.shell.line).toBe('');
    finish();
    await other.settle();
    expect(other.shell.line).toBe('next');
  });

  it('runs a pasted block one line at a time, leaving an unfinished last line typed', async () => {
    const { shell, onCommand, settle } = setup();
    shell.input('a\nb\nc');
    await settle();
    await settle();
    expect(onCommand.mock.calls.map(([line]) => line)).toEqual(['a', 'b']);
    expect(shell.line).toBe('c');
  });

  it('run() runs after what\'s running, and leaves a half-typed line alone', async () => {
    const { shell, onCommand, screen, settle } = setup();
    shell.input('half');
    shell.run('npm test');
    await settle();
    expect(onCommand).toHaveBeenCalledWith('npm test', expect.anything());
    expect(screen()).toContain('$ npm test\r\n');
    expect(shell.line).toBe('half');
  });

  it('write() prints above the prompt and keeps the line', () => {
    const { shell, screen } = setup();
    shell.input('half');
    shell.write('notice\n');
    expect(screen()).toContain('notice\r\n');
    expect(screen()).toMatch(/\$ half\r\x1b\[6C$/);
  });

  it('a new terminal gets the output so far and the line being typed', async () => {
    const { shell, settle } = setup();
    shell.input('ls\r');
    await settle();
    shell.input('half');
    let again = '';
    shell.attach({ write: (data) => { again += data; } }, { cols: 80, rows: 24 });
    expect(again).toContain('$ ls\r\nran ls\r\n');
    expect(again).toMatch(/\$ half\r\x1b\[6C$/);
  });

  it('keeps no more output than it was told to', async () => {
    const { shell, settle } = setup({ maxTranscript: 20 });
    shell.input('one\r');
    await settle();
    shell.input('two\r');
    await settle();
    let again = '';
    shell.attach({ write: (data) => { again += data; } });
    expect(again).not.toContain('ran one');
  });

  it('clear() empties the screen and the record', async () => {
    const { shell, screen, settle } = setup();
    shell.input('ls\r');
    await settle();
    shell.clear();
    expect(screen()).toContain('\x1b[3J\x1b[2J\x1b[H');
    let again = '';
    shell.attach({ write: (data) => { again += data; } });
    expect(again).not.toContain('ran ls');
  });

  it('completes with Tab, and lists when there are several', async () => {
    const { shell, screen, settle } = setup({ complete: ({ word }) => ['build', 'bundle', 'clean'].filter((c) => c.startsWith(word)) });
    shell.input('c');
    shell.input('\t');
    await settle();
    expect(shell.line).toBe('clean ');
    shell.input('\x15');
    shell.input('b');
    shell.input('\t');
    await settle();
    expect(shell.line).toBe('bu');
    shell.input('\t');
    await settle();
    expect(screen()).toContain('build');
    expect(screen()).toContain('bundle');
    expect(shell.line).toBe('bu');
  });

  it('a slow completion doesn\'t land on a line that has moved on', async () => {
    let answer: (candidates: string[]) => void = () => {};
    const { shell, settle } = setup({ complete: () => new Promise((resolve) => { answer = resolve; }) });
    shell.input('b');
    shell.input('\t');
    shell.input('x');
    answer(['build']);
    await settle();
    expect(shell.line).toBe('bx');
  });

  it('Ctrl-D on an empty line calls onEof', () => {
    const onEof = vi.fn();
    const { shell } = setup({ onEof });
    shell.input('\x04');
    expect(onEof).toHaveBeenCalled();
  });

  it('tells subscribers when it\'s busy', async () => {
    const seen: boolean[] = [];
    const { shell, settle } = setup();
    shell.subscribe(() => seen.push(shell.busy));
    shell.input('x\r');
    await settle();
    expect(seen).toEqual([true, false]);
  });

  it('dispose() aborts what\'s running and ends the input', async () => {
    let signal: AbortSignal | undefined;
    const onCommand = vi.fn((_line: string, io: TerminalCommandIO) => {
      signal = io.signal;
      return new Promise<void>(() => {});
    });
    const { shell, settle } = setup({ onCommand });
    shell.input('x\r');
    await settle();
    shell.dispose();
    expect(signal?.aborted).toBe(true);
    shell.input('y\r');
    expect(onCommand).toHaveBeenCalledTimes(1);
  });
});

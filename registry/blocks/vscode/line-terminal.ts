/* A raw terminal stream for an implementation with no PTY: what's typed goes through a line editor (`@/lib/terminal-line`)
   and whole lines go to a handler. A runtime on a real PTY has no use for this file. */
import { createTerminalShell, type TerminalCommandHandler, type TerminalCompleter, type TerminalShell } from '@/lib/terminal-line';
import type { RuntimeTerminal, RuntimeTerminalSize } from './runtime';

export interface TerminalStream extends Pick<RuntimeTerminal, 'onOutput' | 'onExit'> {
  emit: (data: string) => void;
  exit: (code: number | null) => void;
  readonly exited: boolean;
}

/** The output and exit half of a terminal, holding what comes before anyone is listening. */
export function createTerminalStream(): TerminalStream {
  let held: string[] = [];
  const outputs = new Set<(data: string | Uint8Array) => void>();
  const exits = new Set<(code: number | null) => void>();
  let exited = false;
  let exitCode: number | null = null;
  return {
    emit(data) {
      if (exited || !data) return;
      if (outputs.size) for (const listener of outputs) listener(data);
      else held.push(data);
    },
    exit(code) {
      if (exited) return;
      exited = true;
      exitCode = code;
      for (const listener of [...exits]) listener(code);
    },
    get exited() { return exited; },
    onOutput(listener) {
      outputs.add(listener);
      const waiting = held;
      held = [];
      for (const data of waiting) listener(data);
      return () => { outputs.delete(listener); };
    },
    onExit(listener) {
      exits.add(listener);
      if (exited) queueMicrotask(() => { if (exits.has(listener)) listener(exitCode); });
      return () => { exits.delete(listener); };
    },
  };
}

export interface LineTerminalOptions {
  size: RuntimeTerminalSize;
  prompt: () => string;
  onCommand: TerminalCommandHandler;
  complete?: TerminalCompleter;
}

export interface LineTerminal extends RuntimeTerminal {
  shell: TerminalShell;
  /** The shell is done: `exit`, or Ctrl-D. */
  exit: (code: number | null) => void;
}

/** A shell on a raw stream, one prompt at a time. */
export function createLineTerminal({ size, prompt, onCommand, complete }: LineTerminalOptions): LineTerminal {
  const stream = createTerminalStream();
  const shell = createTerminalShell({
    prompt,
    onCommand,
    complete,
    onEof: () => terminal.exit(0),
    // The window keeps what's been printed, for any implementation.
    maxTranscript: 0,
  });
  shell.attach({ write: (data) => stream.emit(data) }, size);
  const terminal: LineTerminal = {
    shell,
    write: (data) => shell.input(data),
    resize: (cols, rows) => shell.resize(cols, rows),
    kill: () => terminal.exit(null),
    exit(code) {
      if (stream.exited) return;
      shell.dispose();
      stream.exit(code);
    },
    onOutput: stream.onOutput,
    onExit: stream.onExit,
  };
  return terminal;
}

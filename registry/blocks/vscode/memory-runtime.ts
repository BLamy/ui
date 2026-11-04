/* A `VSCodeRuntime` with nothing behind it: files in memory, and a terminal that knows a handful of commands. It starts
   instantly, needs no network and does the same thing every time, which is what stories and tests want. It's also the
   whole interface in a page, for anyone writing another implementation. */
import { ancestors, basename, dirname } from './files';
import { createLineTerminal, createTerminalStream } from './line-terminal';
import type { FileContent, RuntimeEntry, RuntimeFileEvent, RuntimeScriptList, RuntimeStatus, VSCodeRuntime } from './runtime';

export interface SeededCommand {
  line: string;
  output: string;
}

export interface MemoryRuntimeOptions {
  root?: string;
  /** Path relative to the root → text. */
  files?: Record<string, string>;
  /** What each new terminal shows to begin with. */
  transcript?: readonly SeededCommand[];
  status?: Partial<RuntimeStatus>;
}

export interface MemoryRuntime extends VSCodeRuntime {
  /** Changes a file as something outside the window would. */
  writeFromOutside: (path: string, content: FileContent) => void;
  removeFromOutside: (path: string) => void;
}

const PROMPT = '\x1b[32mproject\x1b[0m \x1b[2m$\x1b[0m ';

export function createMemoryRuntime(options: MemoryRuntimeOptions = {}): MemoryRuntime {
  const root = options.root ?? '/project';
  const files = new Map<string, FileContent>();
  const dirs = new Set<string>();
  for (const [relative, text] of Object.entries(options.files ?? {})) {
    const path = `${root}/${relative}`;
    files.set(path, text);
    for (const dir of ancestors(path)) dirs.add(dir);
  }
  const watchers = new Set<(events: readonly RuntimeFileEvent[]) => void>();
  const fire = (events: RuntimeFileEvent[]) => { for (const listener of watchers) listener(events); };

  const status: RuntimeStatus = { state: 'ready', text: 'No runtime', tone: 'neutral', title: 'No runtime', details: ['Nothing runs behind this window.'], ...options.status };

  const scripts = (): RuntimeScriptList => {
    const text = files.get(`${root}/package.json`);
    if (typeof text !== 'string') return { scripts: [], note: 'There is no package.json.' };
    const parsed = JSON.parse(text) as { scripts?: Record<string, string> };
    return { scripts: Object.entries(parsed.scripts ?? {}).map(([name, command]) => ({ name, command })) };
  };

  return {
    files: {
      root,
      async list() {
        const entries: RuntimeEntry[] = [...dirs].filter((path) => path.startsWith(`${root}/`)).map((path) => ({ path, kind: 'directory' }));
        for (const path of files.keys()) entries.push({ path, kind: 'file' });
        return entries;
      },
      async read(path) {
        const content = files.get(path);
        if (content === undefined) throw new Error(`No such file: ${path}`);
        return content;
      },
      async write(path, content) {
        files.set(path, content);
        for (const dir of ancestors(path)) dirs.add(dir);
      },
      async mkdir(path) {
        dirs.add(path);
        for (const dir of ancestors(path)) dirs.add(dir);
      },
      async rename(from, to) {
        for (const [path, content] of [...files]) {
          if (path === from || path.startsWith(`${from}/`)) {
            files.delete(path);
            files.set(to + path.slice(from.length), content);
          }
        }
        for (const dir of [...dirs]) {
          if (dir === from || dir.startsWith(`${from}/`)) {
            dirs.delete(dir);
            dirs.add(to + dir.slice(from.length));
          }
        }
      },
      async delete(path) {
        for (const file of [...files.keys()]) if (file === path || file.startsWith(`${path}/`)) files.delete(file);
        for (const dir of [...dirs]) if (dir === path || dir.startsWith(`${path}/`)) dirs.delete(dir);
      },
      watch(listener) {
        watchers.add(listener);
        return () => { watchers.delete(listener); };
      },
    },
    terminals: {
      async open({ cols, rows }) {
        const terminal = createLineTerminal({
          size: { cols, rows },
          prompt: () => PROMPT,
          onCommand(line, io) {
            const [command, ...args] = line.trim().split(/\s+/);
            if (command === 'clear') return io.clear();
            if (command === 'exit') {
              setTimeout(() => terminal.exit(0));
              return undefined;
            }
            if (command === 'pwd') io.write(`${root}\n`);
            else if (command === 'echo') io.write(`${args.join(' ')}\n`);
            else if (command === 'ls') {
              const names = [...files.keys(), ...dirs].filter((path) => dirname(path) === root).map(basename).sort();
              io.write(`${names.join('  ')}\n`);
            } else if (command === 'cat' && typeof files.get(`${root}/${args[0]}`) === 'string') io.write(files.get(`${root}/${args[0]}`) as string);
            else io.write(`${command}: there's no runtime behind this terminal\n`);
            return undefined;
          },
        });
        for (const seed of options.transcript ?? []) terminal.shell.write(`${PROMPT}${seed.line}\n${seed.output}\n`);
        return terminal;
      },
    },
    scripts: {
      list: async () => scripts(),
      onChange: () => () => {},
      async run(name) {
        const stream = createTerminalStream();
        stream.emit(`\x1b[2m$ npm run ${name}\x1b[0m\r\nThere's no runtime behind this terminal.\r\n`);
        stream.exit(0);
        const nothing = () => undefined;
        return { write: nothing, resize: nothing, kill: nothing, onOutput: stream.onOutput, onExit: stream.onExit };
      },
    },
    status: { get: () => status, subscribe: () => () => {} },
    writeFromOutside(path, content) {
      files.set(path, content);
      for (const dir of ancestors(path)) dirs.add(dir);
      fire([{ type: 'change', path, kind: 'file' }]);
    },
    removeFromOutside(path) {
      files.delete(path);
      dirs.delete(path);
      fire([{ type: 'delete', path }]);
    },
  };
}

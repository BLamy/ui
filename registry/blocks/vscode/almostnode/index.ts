/* The block's default runtime: Node in a Worker on a virtual disk, which is the Sandbox library (`@/lib/sandbox`). This
   file fits it to the window: a starter project, terminals with a prompt and line editing, the Run panel's scripts, the
   status bar's words, and the tailnet. Nothing else in the block knows anything in this folder is here: it's reached
   only through the `VSCodeRuntime` it returns.

   The runtime is @agent-wasm/core, the fork of almostnode this repository already depends on. `node -e`, a script with
   no output and a script that sets timers all need what the fork adds over the npm package. */
import { createSandbox, type Sandbox, type SandboxExit, type SandboxFileEvent, type SandboxShell } from '@/lib/sandbox';
import type { TerminalCommandIO } from '@/lib/terminal-line';
import { toTerminalNewlines } from '@/lib/terminal-line';
import { basename } from '../files';
import { createLineTerminal, createTerminalStream, type LineTerminal } from '../line-terminal';
import type {
  FileContent, RuntimeEntry, RuntimeFileEvent, RuntimeScriptList, RuntimeStatus, RuntimeTerminal, RuntimeTerminalOptions, VSCodeRuntime,
} from '../runtime';
import { ROOT, STARTER_PROJECT } from './project';
import { completeCommandLine, npmScriptCommand } from './shell-line';
import { createVSCodeOpenCodeHost } from './open-code';
import { isTailnetUrl } from './tailnet-fetch';
import { toResponse, type Tailscale } from '@/lib/tailscale';

export interface AlmostnodeRuntimeOptions {
  /** The connection used by HTTP requests to tailnet names and addresses. */
  tailscale?: Pick<Tailscale, 'fetch'>;
  /** The files to start with: path relative to the root → text. Default: a small starter project. */
  project?: Record<string, string>;
  /** How to start the Worker. The default is this folder's `sandbox.worker.ts`, written as every bundler reads it. */
  worker?: () => Worker;
}

const PLACE: Record<string, string> = {
  'opaque-origin': "Commands and the packages they install run in an isolated Worker with an origin of its own. They can't read this site's storage, cookies or page, or reach what you've signed in to here.",
  'same-origin': "This host won't load the runtime in an isolated Worker, so it runs as an ordinary Worker of this site. A package you install can't touch the page, cookies or localStorage, but it can read and change this site's IndexedDB and caches. Only install packages you trust here.",
};
const NETWORK = "Either way a command can reach the network, as far as the browser's CORS rules allow. A command that won't stop can't freeze this window: Ctrl-C replaces the Worker and keeps your files.";
const SAME_ORIGIN_WARNING = "\x1b[33mThis host won't load the runtime in an isolated Worker, so what runs here can reach this site's storage.\x1b[0m\n";

/** The block's default `VSCodeRuntime`. Nothing downloads until `start()`, and then only from this site. */
export function createAlmostnodeRuntime(options: AlmostnodeRuntimeOptions = {}): VSCodeRuntime {
  const root = ROOT;
  const manifest = `${root}/package.json`;

  /* Where the host serves the Worker with CORS, as GitHub Pages does, it has an origin of its own. Where it doesn't, as
     a dev server, the window still has to work, so the block lets it run as an ordinary Worker of this site, and the
     status bar and the first terminal say so. */
  const sandbox: Sandbox = createSandbox({
    worker: options.worker ?? (() => new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module', name: 'vscode-runtime' })),
    cwd: root,
    files: options.project ?? STARTER_PROJECT,
    fallback: 'same-origin',
    // The page is signed in to the tailnet and the Worker is not to be trusted: only tailnet addresses get through.
    async onHostFetch(request, { signal }) {
      if (!isTailnetUrl(request.url)) throw new Error('Only tailnet HTTP requests are allowed.');
      if (!options.tailscale) throw new Error('Connect Tailscale from the status bar to reach your devices.');
      const response = toResponse(await options.tailscale.fetch({ ...request, signal }));
      return {
        status: response.status, statusText: response.statusText, headers: [...response.headers],
        body: response.body ? new Uint8Array(await response.arrayBuffer()) : null,
      };
    },
  });
  const { files, directories: dirs } = sandbox.mirror;

  const fileWatchers = new Set<(events: readonly RuntimeFileEvent[]) => void>();
  const scriptWatchers = new Set<() => void>();
  const statusWatchers = new Set<() => void>();
  const touchesManifest = (event: SandboxFileEvent) => (event.type === 'rename' ? event.from === manifest || event.to === manifest : event.path === manifest);

  /* What the window did itself it already knows; what commands and OpenCode did it hears from here. */
  let own = false;
  sandbox.files.watch('/', (events) => {
    if (!own) for (const listener of fileWatchers) listener(events);
    if (events.some(touchesManifest)) for (const listener of scriptWatchers) listener();
  });
  /** One of the window's own changes. The page's copy has it when this returns; the Worker gets it a moment later, and
   *  nothing waits for that. A change the disk refuses is the caller's to hear. */
  const change = async (make: () => Promise<void>) => {
    if (sandbox.status === 'disposed') return;
    own = true;
    let sent: Promise<void>;
    try {
      sent = make();
    } finally {
      own = false;
    }
    sent.catch(() => {});
    await Promise.race([sent, Promise.resolve()]);
  };

  /* ── Status ── */

  /** Commands running, across terminals. */
  let busy = 0;
  let status: RuntimeStatus | null = null;
  const statusNow = (): RuntimeStatus => {
    if (status) return status;
    const isolation = sandbox.isolation;
    const word = { idle: 'Starting…', loading: 'Starting…', restarting: 'Restarting…', failed: 'Failed', disposed: 'Stopped', ready: busy ? `Running${busy > 1 ? ` (${busy})` : ''}` : 'Ready' }[sandbox.status];
    status = {
      state: sandbox.status === 'ready' ? 'ready' : sandbox.status === 'failed' ? 'failed' : 'starting',
      text: `Node: ${word}`,
      tone: isolation === 'opaque-origin' ? 'safe' : isolation === 'same-origin' ? 'warning' : 'neutral',
      title: `Node runtime: ${word}`,
      details: [
        ...(sandbox.error ? [sandbox.error.message] : []),
        isolation ? PLACE[isolation] : 'Nothing is running yet.',
        NETWORK,
      ],
      actions: [{ label: 'Restart runtime', run: () => sandbox.restart() }],
    };
    return status;
  };
  const statusChanged = () => {
    status = null;
    for (const listener of statusWatchers) listener();
  };

  /* ── Terminals ── */

  const shells = new Set<LineTerminal>();
  let warned = false;
  const warnIfExposed = () => {
    if (warned || sandbox.isolation !== 'same-origin') return;
    const first = shells.values().next().value;
    if (!first) return;
    warned = true;
    first.shell.write(SAME_ORIGIN_WARNING);
  };
  sandbox.subscribe(() => {
    warnIfExposed();
    statusChanged();
  });

  const noticeOf = ({ interrupted }: SandboxExit) => {
    if (interrupted === 'unresponsive') return "\x1b[33mThat command wouldn't stop, so the runtime was restarted. Your files are kept.\x1b[0m\n";
    if (!interrupted) return '';
    return sandbox.status === 'failed'
      ? `\x1b[31mThe runtime didn't start: ${sandbox.error?.message ?? 'unknown error'}\x1b[0m\n`
      : '\x1b[33mThe runtime was restarted, which stopped this command.\x1b[0m\n';
  };

  /** One line, on a shell. */
  const runLine = async (shell: SandboxShell, line: string, io: TerminalCommandIO) => {
    busy += 1;
    statusChanged();
    // Keys go to a script once it's reading them. Until then the shell holds them, for it or for the next prompt.
    let stopListening = null as (() => void) | null;
    const run = shell.run(line, {
      onOutput: (data) => io.write(data),
      onReadingChange(reading) {
        stopListening?.();
        stopListening = reading ? io.onInput((data) => run.write(data)) : null;
      },
    });
    const onAbort = () => run.kill();
    io.signal.addEventListener('abort', onAbort, { once: true });
    const result = await run.exit;
    io.signal.removeEventListener('abort', onAbort);
    stopListening?.();
    busy -= 1;
    statusChanged();
    io.write(noticeOf(result));
    return result;
  };

  const openShell = ({ cols, rows, onOpenCode }: RuntimeTerminalOptions): RuntimeTerminal => {
    const shell = sandbox.shell({ cols, rows });
    let cwd = root;
    let lastExit = 0;
    const prompt = () => {
      const name = basename(root);
      const inside = cwd === root || cwd.startsWith(`${root}/`);
      return `\x1b[32m${inside ? name + cwd.slice(root.length) : cwd}\x1b[0m ${lastExit ? '\x1b[31m' : '\x1b[2m'}$\x1b[0m `;
    };
    const terminal = createLineTerminal({
      size: { cols, rows },
      prompt,
      async onCommand(line, io) {
        const command = line.trim();
        if (command === 'clear' || command === 'reset') {
          io.clear();
          return;
        }
        if (command === 'exit') {
          // On a later tick: the shell is still finishing this line.
          setTimeout(() => terminal.exit(0));
          return;
        }
        if (command === 'opencode') {
          if (!onOpenCode) throw new Error('OpenCode needs the VS Code terminal pane.');
          const bridge = createVSCodeOpenCodeHost({ root, directory: cwd, sandbox });
          try { await onOpenCode(bridge, io.signal); } finally { bridge.dispose?.(); }
          lastExit = 0;
          return;
        }
        const result = await runLine(shell, line, io);
        cwd = shell.cwd;
        lastExit = result.exitCode;
      },
      complete: ({ word, line, cursor }) => completeCommandLine({
        word, line, cursor, cwd, files: files.keys(), dirs, bin: `${root}/node_modules/.bin/`,
        scripts: () => scriptsNow().scripts.map((script) => script.name),
      }),
    });
    terminal.onExit(() => {
      shells.delete(terminal);
      shell.dispose();
    });
    const { resize } = terminal;
    terminal.resize = (nextCols, nextRows) => {
      resize(nextCols, nextRows);
      shell.resize(nextCols, nextRows);
    };
    shells.add(terminal);
    warnIfExposed();
    return terminal;
  };

  /** One command with a terminal to itself: no prompt, and it exits with the command. */
  const openCommand = (command: string, { cols, rows }: RuntimeTerminalOptions): RuntimeTerminal => {
    const stream = createTerminalStream();
    stream.emit(`\x1b[2m$ ${command}\x1b[0m\r\n`);
    busy += 1;
    statusChanged();
    let reading = false;
    const run = sandbox.run(command, { cols, rows, onOutput: (data) => stream.emit(toTerminalNewlines(data)), onReadingChange: (now) => { reading = now; } });
    void run.exit.then((result) => {
      busy -= 1;
      statusChanged();
      stream.emit(toTerminalNewlines(noticeOf(result)));
      stream.exit(result.exitCode);
    });
    return {
      write(data) {
        if (data.includes('\x03')) run.kill();
        else if (reading) run.write(data);
      },
      resize: (nextCols, nextRows) => run.resize(nextCols, nextRows),
      kill: () => run.kill(),
      onOutput: stream.onOutput,
      onExit: stream.onExit,
    };
  };

  /* ── Scripts ── */

  const scriptsNow = (): RuntimeScriptList => {
    const text = files.get(manifest);
    if (typeof text !== 'string') return { scripts: [], note: 'There is no package.json.' };
    try {
      const { scripts = {} } = JSON.parse(text) as { scripts?: Record<string, unknown> };
      const list = Object.entries(scripts).flatMap(([name, command]) => (typeof command === 'string' ? [{ name, command }] : []));
      return list.length ? { scripts: list } : { scripts: [], note: 'package.json has no scripts.' };
    } catch {
      return { scripts: [], note: "package.json doesn't parse." };
    }
  };

  return {
    // A start that fails is in the status bar, with why.
    start: () => { sandbox.start().catch(() => {}); },
    dispose() {
      for (const terminal of [...shells]) terminal.kill();
      sandbox.dispose();
    },
    files: {
      root,
      async list() {
        const entries: RuntimeEntry[] = [...dirs].filter((path) => path !== root && path.startsWith(`${root}/`)).map((path) => ({ path, kind: 'directory' }));
        for (const path of files.keys()) if (path.startsWith(`${root}/`)) entries.push({ path, kind: 'file' });
        return entries;
      },
      async read(path) {
        const data = files.get(path);
        if (data === undefined) throw new Error(`No such file: ${path}`);
        return data;
      },
      write: (path, content: FileContent) => change(() => sandbox.files.write(path, content)),
      mkdir: (path) => change(() => sandbox.files.mkdir(path)),
      async rename(from, to) {
        if (files.has(from) || dirs.has(from)) await change(() => sandbox.files.rename(from, to));
      },
      async delete(path) {
        if (files.has(path) || dirs.has(path)) await change(() => sandbox.files.remove(path, { recursive: true }));
      },
      watch(listener) {
        fileWatchers.add(listener);
        return () => { fileWatchers.delete(listener); };
      },
    },
    terminals: {
      async open(terminal) {
        return terminal.command ? openCommand(terminal.command, terminal) : openShell(terminal);
      },
    },
    scripts: {
      list: async () => scriptsNow(),
      onChange(listener) {
        scriptWatchers.add(listener);
        return () => { scriptWatchers.delete(listener); };
      },
      async run(name, size) {
        return openCommand(npmScriptCommand(name), size);
      },
    },
    status: {
      get: statusNow,
      subscribe(listener) {
        statusWatchers.add(listener);
        return () => { statusWatchers.delete(listener); };
      },
    },
  };
}

import type { OpenCodeHostBridge } from '@/lib/open-code-host';
import { ancestors, basename, dirname, resolvePath } from '../files';
import type { RuntimeFileEvent } from '../runtime';
import type { FileData } from './protocol';
import type { WorkerHost } from './worker-host';

/** OpenCode borrows the same disk and Worker as the Explorer and shell. */
export function createVSCodeOpenCodeHost({ root, directory, files, dirs, worker, changed }: {
  root: string;
  directory: string;
  files: Map<string, FileData>;
  dirs: Set<string>;
  worker: WorkerHost;
  changed: (events: RuntimeFileEvent[]) => void;
}): OpenCodeHostBridge {
  let disposed = false;
  const active = new Map<string, () => void>();
  const metadata = new Map<string, { data: FileData | undefined; time: number }>();
  const pathOf = (input: string) => {
    if (disposed) throw new Error('OpenCode has exited.');
    const path = resolvePath(directory, input);
    if (path !== root && !path.startsWith(`${root}/`)) throw new Error(`OpenCode path is outside ${root}: ${input}`);
    return path;
  };
  directory = pathOf(directory);
  if (!dirs.has(directory)) throw new Error(`No such directory: ${directory}`);
  const mkdir = (path: string) => {
    const made = [...ancestors(path).reverse(), path].filter((dir) => dir === root || dir.startsWith(`${root}/`)).filter((dir) => !dirs.has(dir));
    for (const dir of made) {
      if (files.has(dir)) throw new Error(`Not a directory: ${dir}`);
      dirs.add(dir);
      worker.mkdir(dir);
    }
    changed(made.map((dir) => ({ type: 'change', path: dir, kind: 'directory' })));
  };
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
  return {
    id: `vscode-${crypto.randomUUID()}`,
    directory,
    workspaceBridge: {
      exists: (input) => { const path = pathOf(input); return files.has(path) || dirs.has(path); },
      mkdir: (input) => mkdir(pathOf(input)),
      readFile(input) {
        const data = files.get(pathOf(input));
        return typeof data === 'string' || data === undefined ? data : new TextDecoder('utf-8', { fatal: true }).decode(data);
      },
      writeFile(input, content) {
        const path = pathOf(input);
        if (dirs.has(path)) throw new Error(`Is a directory: ${path}`);
        mkdir(dirname(path));
        files.set(path, content);
        worker.write(path, content);
        changed([{ type: 'change', path, kind: 'file' }]);
      },
      readdir(input) {
        const path = pathOf(input);
        if (!dirs.has(path)) throw new Error(`No such directory: ${path}`);
        return [...new Set([...dirs, ...files.keys()])].filter((child) => child !== path && dirname(child) === path).map((child) => ({
          name: basename(child), isDirectory: () => dirs.has(child), isFile: () => files.has(child),
        }));
      },
      stat(input) {
        const path = pathOf(input);
        if (!files.has(path) && !dirs.has(path)) return undefined;
        const data = files.get(path);
        let meta = metadata.get(path);
        if (!meta || meta.data !== data) { meta = { data, time: Date.now() }; metadata.set(path, meta); }
        return {
          isFile: () => files.has(path), isDirectory: () => dirs.has(path),
          size: typeof data === 'string' ? new TextEncoder().encode(data).length : data?.length ?? 0,
          mtime: new Date(meta.time), mtimeMs: meta.time,
        };
      },
      listFiles: (input = directory) => { const path = pathOf(input); return [...files.keys()].filter((file) => file.startsWith(`${path}/`)); },
      remove(input, options) {
        const path = pathOf(input);
        if (path === root) throw new Error('Cannot remove the workspace root.');
        const children = [...dirs, ...files.keys()].filter((child) => child.startsWith(`${path}/`));
        if (children.length && !options?.recursive) throw new Error(`Directory is not empty: ${path}`);
        for (const child of [...children, path]) { files.delete(child); dirs.delete(child); }
        worker.remove(path);
        changed([{ type: 'delete', path }]);
      },
      rename(input, target) {
        const from = pathOf(input);
        const to = pathOf(target);
        if (from === root || to === root || to.startsWith(`${from}/`)) throw new Error('Cannot move a directory into itself.');
        if (!files.has(from) && !dirs.has(from)) throw new Error(`No such file: ${from}`);
        mkdir(dirname(to));
        for (const [path, data] of [...files]) if (path === from || path.startsWith(`${from}/`)) { files.delete(path); files.set(to + path.slice(from.length), data); }
        for (const path of [...dirs]) if (path === from || path.startsWith(`${from}/`)) { dirs.delete(path); dirs.add(to + path.slice(from.length)); }
        worker.rename(from, to);
        changed([{ type: 'rename', from, to }]);
      },
    },
    processBridge: {
      async exec(input) {
        const cwd = pathOf(input.cwd ?? directory);
        input.signal?.throwIfAborted();
        const session = `opencode-${crypto.randomUUID()}`;
        worker.openSession(session, { cwd, env: input.env, cols: 100, rows: 30 });
        const shell = /(?:^|\/)(?:ba|z|da)?sh$/.test(input.command);
        const line = shell && input.args[0] === '-c'
          ? input.args[1] ?? ''
          : input.shell ? [input.command, ...input.args.map(quote)].join(' ') : [input.command, ...input.args].map(quote).join(' ');
        let stdout = '';
        let suppliedInput = false;
        const run = worker.run(session, line, (data) => { stdout += data; }, (reading) => {
          if (reading && input.stdin && !suppliedInput) { suppliedInput = true; worker.input(session, input.stdin); }
        });
        active.set(session, run.abort);
        input.signal?.addEventListener('abort', run.abort, { once: true });
        try {
          const result = await run.done;
          return { stdout, stderr: '', code: result.exitCode };
        } finally {
          active.delete(session);
          input.signal?.removeEventListener('abort', run.abort);
          worker.closeSession(session);
        }
      },
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const abort of active.values()) abort();
      active.clear();
    },
  };
}

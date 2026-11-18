import type { OpenCodeHostBridge } from '@/lib/open-code-host';
import type { Sandbox } from '@/lib/sandbox';
import { ancestors, basename, dirname, resolvePath } from '../files';

/** OpenCode borrows the same disk and Worker as the Explorer and shell: what it writes shows up in both. */
export function createVSCodeOpenCodeHost({ root, directory, sandbox }: {
  root: string;
  directory: string;
  sandbox: Pick<Sandbox, 'files' | 'mirror' | 'run'>;
}): OpenCodeHostBridge {
  let disposed = false;
  const { files, directories: dirs } = sandbox.mirror;
  const active = new Set<() => void>();
  const metadata = new Map<string, { data: unknown; time: number }>();
  const pathOf = (input: string) => {
    if (disposed) throw new Error('OpenCode has exited.');
    const path = resolvePath(directory, input);
    if (path !== root && !path.startsWith(`${root}/`)) throw new Error(`OpenCode path is outside ${root}: ${input}`);
    return path;
  };
  directory = pathOf(directory);
  if (!dirs.has(directory)) throw new Error(`No such directory: ${directory}`);
  /* The tools are synchronous and the disk's calls aren't, but each changes the page's copy before it returns: what a
     tool reads next is already there. What could be refused is checked here first, so the tool hears of it. */
  const sent = (change: Promise<void>) => { change.catch(() => {}); };
  const mkdir = (path: string) => {
    const blocking = [...ancestors(path).reverse(), path].find((dir) => files.has(dir));
    if (blocking) throw new Error(`Not a directory: ${blocking}`);
    if (!dirs.has(path)) sent(sandbox.files.mkdir(path));
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
        sent(sandbox.files.write(path, content));
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
        const occupied = [...dirs, ...files.keys()].some((child) => child.startsWith(`${path}/`));
        if (occupied && !options?.recursive) throw new Error(`Directory is not empty: ${path}`);
        if (files.has(path) || dirs.has(path)) sent(sandbox.files.remove(path, { recursive: true }));
      },
      rename(input, target) {
        const from = pathOf(input);
        const to = pathOf(target);
        if (from === root || to === root || to.startsWith(`${from}/`)) throw new Error('Cannot move a directory into itself.');
        if (!files.has(from) && !dirs.has(from)) throw new Error(`No such file: ${from}`);
        mkdir(dirname(to));
        sent(sandbox.files.rename(from, to));
      },
    },
    processBridge: {
      async exec(input) {
        const cwd = pathOf(input.cwd ?? directory);
        input.signal?.throwIfAborted();
        const shell = /(?:^|\/)(?:ba|z|da)?sh$/.test(input.command);
        const line = shell && input.args[0] === '-c'
          ? input.args[1] ?? ''
          : input.shell ? [input.command, ...input.args.map(quote)].join(' ') : [input.command, ...input.args].map(quote).join(' ');
        let stdout = '';
        const run = sandbox.run(line, { cwd, env: input.env, cols: 100, rows: 30, signal: input.signal, onOutput: (data) => { stdout += data; } });
        // Held until the script reads its input.
        if (input.stdin) run.write(input.stdin);
        active.add(run.kill);
        try {
          const result = await run.exit;
          return { stdout, stderr: '', code: result.exitCode };
        } finally {
          active.delete(run.kill);
        }
      },
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const kill of active) kill();
      active.clear();
    },
  };
}

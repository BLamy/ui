import { describe, expect, it, vi } from 'vitest';
import type { SandboxExit, SandboxFileData, SandboxFileEvent, SandboxProcess, SandboxRunOptions } from '@/lib/sandbox';
import { createVSCodeOpenCodeHost } from './almostnode/open-code';

/* The parts of a Sandbox the bridge uses: a disk that changes the page's copy at once, as the real one does, and
   commands that end when the test says. */
function setup() {
  const files = new Map<string, SandboxFileData>([['/project/index.js', 'old'], ['/project/src/a.js', 'a']]);
  const dirs = new Set(['/', '/project', '/project/src']);
  const events: SandboxFileEvent[] = [];
  const inside = (path: string, folder: string) => path === folder || path.startsWith(`${folder}/`);
  const disk = {
    write: vi.fn(async (path: string, data: SandboxFileData) => { files.set(path, data); events.push({ type: 'change', path, kind: 'file' }); }),
    mkdir: vi.fn(async (path: string) => { dirs.add(path); events.push({ type: 'change', path, kind: 'directory' }); }),
    rename: vi.fn(async (from: string, to: string) => {
      for (const [path, data] of [...files]) if (inside(path, from)) { files.delete(path); files.set(to + path.slice(from.length), data); }
      for (const path of [...dirs]) if (inside(path, from)) { dirs.delete(path); dirs.add(to + path.slice(from.length)); }
      events.push({ type: 'rename', from, to });
    }),
    remove: vi.fn(async (path: string) => {
      for (const file of [...files.keys()]) if (inside(file, path)) files.delete(file);
      for (const dir of [...dirs]) if (inside(dir, path)) dirs.delete(dir);
      events.push({ type: 'delete', path });
    }),
  };
  const kill = vi.fn();
  const commands: Array<{ line: string; options: SandboxRunOptions; written: string[]; finish: (exit: SandboxExit) => void }> = [];
  const run = (line: string, options: SandboxRunOptions = {}): SandboxProcess => {
    const written: string[] = [];
    const exit = new Promise<SandboxExit>((finish) => commands.push({ line, options, written, finish }));
    return { write: (data) => { written.push(data); }, resize: vi.fn(), kill, exit };
  };
  const sandbox = { files: disk, mirror: { files, directories: dirs }, run } as unknown as Parameters<typeof createVSCodeOpenCodeHost>[0]['sandbox'];
  const host = createVSCodeOpenCodeHost({ root: '/project', directory: '/project/src', sandbox });
  return { host, files, dirs, events, disk, commands, kill };
}

describe('VS Code OpenCode host', () => {
  it('shares live files, including writes, moves and deletes, with the Explorer and Worker', () => {
    const { host, files, events, disk } = setup();
    const tools = host.workspaceBridge;
    files.set('/project/index.js', 'edited in the Explorer');
    expect(tools.readFile('/project/index.js')).toBe('edited in the Explorer');
    tools.writeFile('nested/new.js', 'console.log(42)');
    expect(files.get('/project/src/nested/new.js')).toBe('console.log(42)');
    expect(tools.readdir('/project/src').map((entry) => entry.name).sort()).toEqual(['a.js', 'nested']);
    expect(tools.stat('/project/src/nested')?.isDirectory()).toBe(true);
    expect(tools.stat('/project/src/nested/new.js')?.size).toBe(15);
    tools.rename?.('nested', 'moved');
    expect(tools.exists('nested/new.js')).toBe(false);
    expect(tools.readFile('moved/new.js')).toBe('console.log(42)');
    tools.remove?.('moved', { recursive: true });
    expect(tools.exists('moved/new.js')).toBe(false);
    expect(disk.write).toHaveBeenCalledWith('/project/src/nested/new.js', 'console.log(42)');
    expect(events).toContainEqual({ type: 'change', path: '/project/src/nested/new.js', kind: 'file' });
    expect(events).toContainEqual({ type: 'rename', from: '/project/src/nested', to: '/project/src/moved' });
    expect(events).toContainEqual({ type: 'delete', path: '/project/src/moved' });
  });

  it('keeps file tools inside the workspace and refuses what the disk would, before asking it', () => {
    const { host, files, disk } = setup();
    expect(() => host.workspaceBridge.writeFile('../../escape', 'no')).toThrow('outside');
    expect(() => host.workspaceBridge.remove?.('/project/src')).toThrow('not empty');
    expect(() => host.workspaceBridge.remove?.('/project', { recursive: true })).toThrow('workspace root');
    expect(() => host.workspaceBridge.writeFile('/project/src', 'no')).toThrow('Is a directory');
    expect(() => host.workspaceBridge.writeFile('a.js/inside.js', 'no')).toThrow('Not a directory: /project/src/a.js');
    expect(() => host.workspaceBridge.rename?.('nope.js', 'x.js')).toThrow('No such file');
    expect(files.size).toBe(2);
    expect(disk.write).not.toHaveBeenCalled();
    expect(disk.remove).not.toHaveBeenCalled();
  });

  it('runs shell tools in the current folder and returns output and exit status', async () => {
    const { host, commands } = setup();
    const result = host.processBridge.exec({ command: 'sh', args: ['-c', 'node a.js && echo done'], env: { TEST: 'yes' }, stdin: 'typed\n' });
    expect(commands[0].line).toBe('node a.js && echo done');
    expect(commands[0].options).toMatchObject({ cwd: '/project/src', env: { TEST: 'yes' }, cols: 100, rows: 30 });
    // The Sandbox holds input until the script reads it.
    expect(commands[0].written).toEqual(['typed\n']);
    commands[0].options.onOutput?.('done\n', { stream: 'stdout' });
    commands[0].finish({ exitCode: 3 });
    await expect(result).resolves.toEqual({ stdout: 'done\n', stderr: '', code: 3 });
  });

  it('quotes the arguments of a command that is not a shell line', async () => {
    const { host, commands } = setup();
    void host.processBridge.exec({ command: 'node', args: ['-e', "console.log('hi')"] });
    expect(commands[0].line).toBe(`'node' '-e' 'console.log('\\''hi'\\'')'`);
  });

  it('aborts outstanding commands on exit without disposing the shared runtime', async () => {
    const { host, commands, kill } = setup();
    const running = host.processBridge.exec({ command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] });
    host.dispose?.();
    expect(kill).toHaveBeenCalledOnce();
    expect(() => host.workspaceBridge.readFile('a.js')).toThrow('exited');
    commands[0].finish({ exitCode: 130 });
    await expect(running).resolves.toMatchObject({ code: 130 });
  });
});

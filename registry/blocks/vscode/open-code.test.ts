import { describe, expect, it, vi } from 'vitest';
import { createVSCodeOpenCodeHost } from './almostnode/open-code';
import type { FileData } from './almostnode/protocol';
import type { WorkerHost, RunResult } from './almostnode/worker-host';
import type { RuntimeFileEvent } from './runtime';

function setup() {
  const files = new Map<string, FileData>([['/project/index.js', 'old'], ['/project/src/a.js', 'a']]);
  const dirs = new Set(['/project', '/project/src']);
  const events: RuntimeFileEvent[] = [];
  const abort = vi.fn();
  const commands: Array<{ session: string; line: string; output: (data: string) => void; finish: (result: RunResult) => void }> = [];
  const worker = {
    mkdir: vi.fn(), write: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    openSession: vi.fn(), closeSession: vi.fn(), input: vi.fn(),
    run: (session: string, line: string, output: (data: string) => void) => ({
      abort, done: new Promise<RunResult>((finish) => commands.push({ session, line, output, finish })),
    }),
  } as unknown as WorkerHost;
  const host = createVSCodeOpenCodeHost({ root: '/project', directory: '/project/src', files, dirs, worker, changed: (batch) => events.push(...batch) });
  return { host, files, dirs, events, worker, commands, abort };
}

describe('VS Code OpenCode host', () => {
  it('shares live files, including writes, moves and deletes, with the Explorer and Worker', () => {
    const { host, files, events, worker } = setup();
    const disk = host.workspaceBridge;
    files.set('/project/index.js', 'edited in the Explorer');
    expect(disk.readFile('/project/index.js')).toBe('edited in the Explorer');
    disk.writeFile('nested/new.js', 'console.log(42)');
    expect(files.get('/project/src/nested/new.js')).toBe('console.log(42)');
    expect(disk.readdir('/project/src').map((entry) => entry.name).sort()).toEqual(['a.js', 'nested']);
    expect(disk.stat('/project/src/nested')?.isDirectory()).toBe(true);
    expect(disk.stat('/project/src/nested/new.js')?.size).toBe(15);
    disk.rename?.('nested', 'moved');
    expect(disk.exists('nested/new.js')).toBe(false);
    expect(disk.readFile('moved/new.js')).toBe('console.log(42)');
    disk.remove?.('moved', { recursive: true });
    expect(disk.exists('moved/new.js')).toBe(false);
    expect(worker.write).toHaveBeenCalledWith('/project/src/nested/new.js', 'console.log(42)');
    expect(events).toContainEqual({ type: 'change', path: '/project/src/nested/new.js', kind: 'file' });
    expect(events).toContainEqual({ type: 'rename', from: '/project/src/nested', to: '/project/src/moved' });
    expect(events).toContainEqual({ type: 'delete', path: '/project/src/moved' });
  });

  it('keeps file tools inside the workspace and refuses to delete a nonempty folder without recursive', () => {
    const { host, files } = setup();
    expect(() => host.workspaceBridge.writeFile('../../escape', 'no')).toThrow('outside');
    expect(() => host.workspaceBridge.remove?.('/project/src')).toThrow('not empty');
    expect(() => host.workspaceBridge.remove?.('/project', { recursive: true })).toThrow('workspace root');
    expect(files.size).toBe(2);
  });

  it('runs shell tools in the current folder and returns output and exit status', async () => {
    const { host, worker, commands } = setup();
    const result = host.processBridge.exec({ command: 'sh', args: ['-c', 'node a.js && echo done'], env: { TEST: 'yes' } });
    expect(worker.openSession).toHaveBeenCalledWith(expect.any(String), { cwd: '/project/src', env: { TEST: 'yes' }, cols: 100, rows: 30 });
    expect(commands[0].line).toBe('node a.js && echo done');
    commands[0].output('done\n');
    commands[0].finish({ cwd: '/project/src', exitCode: 3 });
    await expect(result).resolves.toEqual({ stdout: 'done\n', stderr: '', code: 3 });
    expect(worker.closeSession).toHaveBeenCalledWith(commands[0].session);
  });

  it('aborts outstanding commands on exit without disposing the shared runtime', async () => {
    const { host, commands, abort } = setup();
    const running = host.processBridge.exec({ command: 'node', args: ['-e', 'setInterval(() => {}, 1000)'] });
    host.dispose?.();
    expect(abort).toHaveBeenCalledOnce();
    expect(() => host.workspaceBridge.readFile('a.js')).toThrow('exited');
    commands[0].finish({ cwd: '/project/src', exitCode: 130 });
    await expect(running).resolves.toMatchObject({ code: 130 });
  });
});

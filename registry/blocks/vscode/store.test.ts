import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TerminalHandle } from '@/components/ui/terminal';
import type { WorkspaceImperativeHandle } from '@/components/ui/workspace';
import { createMemoryRuntime } from './memory-runtime';
import type { RuntimeTerminal, VSCodeRuntime } from './runtime';
import { VSCodeStore, type TabData, type VSCodeModel } from './store';

const FILES = {
  'index.js': 'console.log(1)\n',
  'package.json': '{"scripts":{"start":"node index.js"}}',
  'src/a.js': 'a\n',
};

/* The little of a Workspace the store uses. */
function fakeWorkspace(store: VSCodeStore) {
  const model = structuredClone(store.model) as VSCodeModel;
  const tabsets = () => {
    const out: Array<Extract<VSCodeModel['root'], { type: 'tabset' }>> = [];
    const walk = (node: VSCodeModel['root']) => {
      if (node.type === 'tabset') out.push(node);
      else node.children.forEach(walk);
    };
    walk(model.root);
    return out;
  };
  const changed = (reason: 'add' | 'close' | 'select' | 'update') => store.onModelChanged(structuredClone(model), { reason } as never);
  const handle = {
    getModel: () => structuredClone(model),
    getActiveTabsetId: () => 'editors',
    addTab(tab: Parameters<WorkspaceImperativeHandle<TabData>['addTab']>[0], options: { tabsetId?: string } = {}) {
      const target = tabsets().find((t) => t.id === options.tabsetId) ?? tabsets()[0];
      target.tabs.push(tab);
      target.selectedId = tab.id;
      changed('add');
      return true;
    },
    closeTab(id: string) {
      for (const tabset of tabsets()) tabset.tabs = tabset.tabs.filter((tab) => tab.id !== id);
      changed('close');
    },
    selectTab(id: string) {
      for (const tabset of tabsets()) if (tabset.tabs.some((tab) => tab.id === id)) tabset.selectedId = id;
      changed('select');
    },
    updateTab(id: string, update: { title?: string; data?: TabData }) {
      for (const tabset of tabsets()) for (const tab of tabset.tabs) if (tab.id === id) Object.assign(tab, update);
      changed('update');
    },
    moveTab: vi.fn(),
    maximizeTabset: vi.fn(),
    restoreTabset: vi.fn(),
    setModel: vi.fn(),
  } as unknown as WorkspaceImperativeHandle<TabData>;
  store.attachWorkspace(handle);
  const tabs = () => tabsets().flatMap((tabset) => tabset.tabs);
  return { handle, tabs };
}

const flush = async () => {
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
};

/* A terminal stream a test can drive. */
function fakeStream() {
  let output: ((data: string | Uint8Array) => void) | null = null;
  let exit: ((code: number | null) => void) | null = null;
  const stream: RuntimeTerminal = {
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onOutput: (listener) => { output = listener; return () => { output = null; }; },
    onExit: (listener) => { exit = listener; return () => { exit = null; }; },
  };
  return { stream, print: (data: string) => output?.(data), exit: (code: number | null) => exit?.(code) };
}

const panel = () => ({ write: vi.fn(), focus: vi.fn(), clear: vi.fn(), fit: vi.fn(), resize: vi.fn(), cols: 100, rows: 30, instance: null, shell: null }) as unknown as TerminalHandle & { write: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (run: () => void) => { run(); return 0; });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function setup(runtime: VSCodeRuntime = createMemoryRuntime({ files: FILES })) {
  const store = new VSCodeStore(runtime);
  const workspace = fakeWorkspace(store);
  store.mount();
  await flush();
  return { store, workspace, runtime };
}

describe('files', () => {
  it('shows what the runtime lists, and opens a first file', async () => {
    const { store, workspace } = await setup();
    expect(store.tree().map((node) => node.name).sort()).toEqual(['index.js', 'package.json', 'src']);
    expect(store.activePath).toBe('/project/index.js');
    expect(store.text('/project/index.js')).toBe('console.log(1)\n');
    expect(workspace.tabs().map((tab) => tab.title)).toContain('index.js');
  });

  it('takes its root from the runtime', async () => {
    const { store } = await setup(createMemoryRuntime({ root: '/home/me/work', files: { 'a.js': '' } }));
    expect(store.root).toBe('/home/me/work');
    expect(store.tree()[0].id).toBe('/home/me/work/a.js');
  });

  it('saves edits after a moment, and shows them at once', async () => {
    vi.useFakeTimers();
    const runtime = createMemoryRuntime({ files: FILES });
    const write = vi.spyOn(runtime.files, 'write');
    const { store } = await setup(runtime);
    store.edit('/project/index.js', 'x');
    expect(store.text('/project/index.js')).toBe('x');
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(write).toHaveBeenCalledWith('/project/index.js', 'x');
  });

  it('an outside change reaches an open file', async () => {
    const runtime = createMemoryRuntime({ files: FILES });
    const { store } = await setup(runtime);
    runtime.writeFromOutside('/project/index.js', 'from outside');
    await flush();
    expect(store.text('/project/index.js')).toBe('from outside');
  });

  it('an outside change doesn\'t overwrite what\'s being typed', async () => {
    vi.useFakeTimers();
    const runtime = createMemoryRuntime({ files: FILES });
    const { store } = await setup(runtime);
    store.edit('/project/index.js', 'typing');
    runtime.writeFromOutside('/project/index.js', 'older');
    await flush();
    expect(store.text('/project/index.js')).toBe('typing');
    vi.advanceTimersByTime(200);
    await flush();
    await expect(runtime.files.read('/project/index.js')).resolves.toBe('typing');
  });

  it('a new file from outside joins the tree, and a deleted one closes its tab', async () => {
    const runtime = createMemoryRuntime({ files: FILES });
    const { store, workspace } = await setup(runtime);
    runtime.writeFromOutside('/project/lib/new.js', '');
    await flush();
    expect(store.tree().map((node) => node.name)).toContain('lib');
    runtime.removeFromOutside('/project/index.js');
    await flush();
    expect(store.exists('/project/index.js')).toBe(false);
    expect(workspace.tabs().map((tab) => tab.title)).not.toContain('index.js');
    expect(store.activePath).toBeNull();
  });

  it('takes a folder\'s delete to mean everything in it', async () => {
    const runtime = createMemoryRuntime({ files: FILES });
    const { store } = await setup(runtime);
    runtime.removeFromOutside('/project/src');
    await flush();
    expect(store.exists('/project/src/a.js')).toBe(false);
  });

  it('a rename moves the tab and the text', async () => {
    const runtime = createMemoryRuntime({ files: FILES });
    const { store, workspace } = await setup(runtime);
    store.renamePath('/project/index.js', '/project/main.js');
    expect(store.text('/project/main.js')).toBe('console.log(1)\n');
    expect(store.activePath).toBe('/project/main.js');
    expect(workspace.tabs().find((tab) => tab.data.kind === 'file')).toMatchObject({ title: 'main.js', data: { path: '/project/main.js' } });
    await flush();
    await expect(runtime.files.read('/project/main.js')).resolves.toBe('console.log(1)\n');
  });

  it('won\'t rename over something', async () => {
    const { store } = await setup();
    store.renamePath('/project/index.js', '/project/package.json');
    expect(store.exists('/project/index.js')).toBe(true);
  });

  it('shows the problem when a write fails', async () => {
    vi.useFakeTimers();
    const runtime = createMemoryRuntime({ files: FILES });
    vi.spyOn(runtime.files, 'write').mockRejectedValue(new Error('disk full'));
    const { store } = await setup(runtime);
    store.edit('/project/index.js', 'x');
    vi.advanceTimersByTime(200);
    await flush();
    expect(store.problem).toContain('disk full');
  });

  it('a file that isn\'t text says so', async () => {
    const runtime = createMemoryRuntime({ files: FILES });
    const { store } = await setup(runtime);
    await runtime.files.write('/project/a.bin', new Uint8Array([0, 1]));
    runtime.writeFromOutside('/project/a.bin', new Uint8Array([0, 1]));
    await flush();
    store.openFile('/project/a.bin');
    await flush();
    expect(store.isBinary('/project/a.bin')).toBe(true);
    expect(store.text('/project/a.bin')).toBeUndefined();
  });
});

describe('the Explorer', () => {
  it('new file goes where the selection is, and Escape takes it back', async () => {
    const { store } = await setup();
    store.setSelected('/project/src');
    store.beginNewFile();
    expect(store.renaming?.path).toBe('/project/src/untitled.js');
    store.endRename(true);
    expect(store.exists('/project/src/untitled.js')).toBe(false);
    expect(store.renaming).toBeNull();
  });

  it('naming a new file opens it', async () => {
    const { store } = await setup();
    store.setSelected(null);
    store.beginNewFile();
    store.commitRename('/project/untitled.js', 'fresh.js');
    await flush();
    expect(store.exists('/project/fresh.js')).toBe(true);
    expect(store.activePath).toBe('/project/fresh.js');
  });

  it('a new file left with its first name stays', async () => {
    const { store } = await setup();
    store.setSelected(null);
    store.beginNewFile();
    store.endRename(false);
    expect(store.exists('/project/untitled.js')).toBe(true);
  });

  it('names a folder by dialog, refusing a bad name', async () => {
    const { store } = await setup();
    store.setSelected(null);
    store.beginNewFolder();
    expect(store.commitFolderName('a/b')).toBeTruthy();
    expect(store.commitFolderName('src')).toBeTruthy();
    expect(store.commitFolderName('lib')).toBeNull();
    expect(store.isFolder('/project/lib')).toBe(true);
    expect(store.naming).toBeNull();
  });

  it('renames a folder with what is in it', async () => {
    const { store } = await setup();
    store.beginRename('/project/src');
    expect(store.renaming).toEqual({ path: '/project/src', isNew: false });
    store.commitRename('/project/src', 'source');
    expect(store.renaming).toBeNull();
    expect(store.exists('/project/source/a.js')).toBe(true);
    expect(store.exists('/project/src/a.js')).toBe(false);
  });

  it('deletes a folder and closes what was open from it', async () => {
    const { store, workspace } = await setup();
    store.openFile('/project/src/a.js');
    await flush();
    store.deletePath('/project/src');
    expect(store.exists('/project/src')).toBe(false);
    expect(workspace.tabs().map((tab) => tab.title)).not.toContain('a.js');
  });
});

describe('terminals', () => {
  /** A runtime whose terminals are streams this test holds. */
  async function withStreams() {
    const runtime = createMemoryRuntime({ files: FILES });
    const streams: Array<ReturnType<typeof fakeStream>> = [];
    const open = vi.fn<VSCodeRuntime['terminals']['open']>(async () => {
      const made = fakeStream();
      streams.push(made);
      return made.stream;
    });
    runtime.terminals.open = open;
    const run = vi.fn(async () => {
      const made = fakeStream();
      streams.push(made);
      return made.stream;
    });
    runtime.scripts.run = run;
    const parts = await setup(runtime);
    return { ...parts, streams, open, run };
  }

  it('opens a terminal when its panel has a size, and only once', async () => {
    const { store, streams, open } = await withStreams();
    const id = store.terminals[0].id;
    expect(open).not.toHaveBeenCalled();
    store.sizeTerminal(id, 100, 30);
    store.sizeTerminal(id, 100, 30);
    await flush();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith({ cols: 100, rows: 30, onOpenCode: expect.any(Function) });
    store.sizeTerminal(id, 90, 20);
    expect(streams[0].stream.resize).toHaveBeenCalledWith(90, 20);
  });

  it('holds the shell while OpenCode is open, returns on Stop, and cancels on abort', async () => {
    const { store, open, workspace } = await withStreams();
    const id = store.terminals[0].id;
    store.sizeTerminal(id, 100, 30);
    await flush();
    const launch = open.mock.calls[0][0].onOpenCode!;
    const host = { directory: '/project' } as Parameters<typeof launch>[0];
    const controller = new AbortController();
    const exited = vi.fn();
    const pending = launch(host, controller.signal).then(exited);
    expect(store.terminal(id)?.openCode?.host).toBe(host);
    expect(workspace.handle.maximizeTabset).toHaveBeenCalledWith('terminals');
    await flush();
    expect(exited).not.toHaveBeenCalled();
    await expect(launch(host, controller.signal)).rejects.toThrow('already running');
    store.terminal(id)?.openCode?.close();
    await pending;
    expect(store.terminal(id)?.openCode).toBeNull();
    const cancelled = launch(host, controller.signal);
    controller.abort();
    await cancelled;
    expect(store.terminal(id)?.openCode).toBeNull();
  });

  it('keeps what\'s typed before it opens, and sends it after', async () => {
    const { store, streams } = await withStreams();
    const id = store.terminals[0].id;
    store.terminalInput(id, 'early');
    store.sizeTerminal(id, 100, 30);
    await flush();
    expect(streams[0].stream.write).toHaveBeenCalledWith('early');
    store.terminalInput(id, 'x');
    expect(streams[0].stream.write).toHaveBeenLastCalledWith('x');
  });

  it('passes output to the panel, and replays it to a new panel', async () => {
    const { store, streams } = await withStreams();
    const id = store.terminals[0].id;
    const first = panel();
    store.attachTerminal(id, first);
    store.sizeTerminal(id, 100, 30);
    await flush();
    streams[0].print('hello');
    expect(first.write).toHaveBeenCalledWith('hello');
    store.detachTerminal(id, first);
    const second = panel();
    store.attachTerminal(id, second);
    expect(second.write).toHaveBeenCalledWith('hello');
  });

  it('saves edits before a key reaches the terminal, so that what runs is what\'s on screen', async () => {
    vi.useFakeTimers();
    const { store, streams, runtime } = await withStreams();
    const id = store.terminals[0].id;
    store.sizeTerminal(id, 100, 30);
    await flush();
    store.edit('/project/index.js', 'edited');
    store.terminalInput(id, '\r');
    expect(streams[0].stream.write).not.toHaveBeenCalled();
    await flush();
    await expect(runtime.files.read('/project/index.js')).resolves.toBe('edited');
    expect(streams[0].stream.write).toHaveBeenCalledWith('\r');
  });

  it('keeps keys in order while a save is on its way', async () => {
    const { store, streams } = await withStreams();
    const id = store.terminals[0].id;
    store.sizeTerminal(id, 100, 30);
    await flush();
    store.edit('/project/index.js', 'edited');
    store.terminalInput(id, 'a');
    store.terminalInput(id, 'b');
    await flush();
    expect((streams[0].stream.write as ReturnType<typeof vi.fn>).mock.calls.map(([data]) => data)).toEqual(['a', 'b']);
  });

  it('closing the tab kills the stream', async () => {
    const { store, streams } = await withStreams();
    const id = store.terminals[0].id;
    store.sizeTerminal(id, 100, 30);
    await flush();
    store.closeTerminal(id);
    expect(streams[0].stream.kill).toHaveBeenCalled();
    expect(store.terminal(id)).toBeNull();
  });

  it('a shell that exits well closes its tab; one that doesn\'t stays, to be read', async () => {
    const { store, streams, workspace } = await withStreams();
    const id = store.terminals[0].id;
    store.sizeTerminal(id, 100, 30);
    await flush();
    const failing = store.newTerminal();
    const second = panel();
    store.attachTerminal(failing.id, second);
    store.sizeTerminal(failing.id, 100, 30);
    await flush();
    streams[1].exit(2);
    expect(store.terminal(failing.id)?.state).toBe('exited');
    expect(second.write).toHaveBeenCalledWith(expect.stringContaining('exited with code 2'));
    streams[0].exit(0);
    expect(store.terminal(id)).toBeNull();
    expect(workspace.tabs().map((tab) => tab.id)).not.toContain(id);
  });

  it('an unopened stream that fails prints why', async () => {
    const { store, open } = await withStreams();
    open.mockRejectedValueOnce(new Error('no pty'));
    const id = store.terminals[0].id;
    const shown = panel();
    store.attachTerminal(id, shown);
    store.sizeTerminal(id, 100, 30);
    await flush();
    expect(shown.write).toHaveBeenCalledWith(expect.stringContaining('no pty'));
    expect(store.terminal(id)?.state).toBe('exited');
  });
});

describe('the Run panel', () => {
  async function withStreams() {
    const runtime = createMemoryRuntime({ files: FILES });
    const streams: Array<ReturnType<typeof fakeStream>> = [];
    const run = vi.fn(async () => {
      const made = fakeStream();
      streams.push(made);
      return made.stream;
    });
    runtime.scripts.run = run;
    const parts = await setup(runtime);
    return { ...parts, streams, run };
  }

  it('lists what the runtime lists', async () => {
    const { store } = await setup();
    expect(store.scripts.scripts).toEqual([{ name: 'start', command: 'node index.js' }]);
  });

  it('says why there are none', async () => {
    const { store } = await setup(createMemoryRuntime({ files: {} }));
    expect(store.scripts.note).toBe('There is no package.json.');
  });

  it('runs a script in a terminal of its own, through the runtime, and stops it', async () => {
    const { store, streams, run, workspace } = await withStreams();
    store.runScript('start');
    const terminal = store.scriptTerminal('start');
    expect(workspace.tabs().map((tab) => tab.title)).toContain('Run: start');
    store.sizeTerminal(terminal?.id as string, 100, 30);
    await flush();
    expect(run).toHaveBeenCalledWith('start', { cols: 100, rows: 30 });
    expect(store.scriptTerminal('start')?.state).toBe('open');
    store.stopScript('start');
    expect(streams[0].stream.kill).toHaveBeenCalled();
    streams[0].exit(130);
    expect(store.scriptTerminal('start')?.state).toBe('exited');
  });

  it('runs again in the same tab, clearing it', async () => {
    const { store, streams, run } = await withStreams();
    store.runScript('start');
    const terminal = store.scriptTerminal('start');
    const shown = panel();
    store.attachTerminal(terminal?.id as string, shown);
    store.sizeTerminal(terminal?.id as string, 100, 30);
    await flush();
    streams[0].print('first run');
    streams[0].exit(0);
    store.runScript('start');
    await flush();
    expect(store.terminals.filter((t) => t.script === 'start')).toHaveLength(1);
    expect(shown.clear).toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('goes to a script that\'s already running rather than starting it twice', async () => {
    const { store, run } = await withStreams();
    store.runScript('start');
    store.sizeTerminal(store.scriptTerminal('start')?.id as string, 100, 30);
    await flush();
    store.runScript('start');
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('status', () => {
  it('shows what the runtime says, and follows it', async () => {
    const listeners = new Set<() => void>();
    let now = { state: 'starting' as const, text: 'Waking' } as VSCodeRuntime extends never ? never : { state: 'starting' | 'ready'; text: string };
    const runtime = createMemoryRuntime({ files: FILES });
    runtime.status = { get: () => now, subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); } } as VSCodeRuntime['status'];
    const { store } = await setup(runtime);
    expect(store.status.text).toBe('Waking');
    now = { state: 'ready', text: 'Up' };
    listeners.forEach((listener) => listener());
    expect(store.status.text).toBe('Up');
  });
});

describe('lifetime', () => {
  it('starts the runtime once, and comes back from a rehearsal unmount', async () => {
    vi.useFakeTimers();
    const runtime = createMemoryRuntime({ files: FILES });
    runtime.start = vi.fn();
    const store = new VSCodeStore(runtime);
    store.mount();
    store.unmount();
    store.mount();
    vi.runAllTimers();
    expect(runtime.start).toHaveBeenCalledTimes(1);
    expect(store.terminals).toHaveLength(1);
  });

  it('when really gone it kills terminals and hands back', async () => {
    vi.useFakeTimers();
    const store = new VSCodeStore(createMemoryRuntime({ files: FILES }));
    store.mount();
    const gone = vi.fn();
    store.unmount(gone);
    vi.runAllTimers();
    expect(gone).toHaveBeenCalled();
    expect(store.terminals).toHaveLength(0);
  });
});

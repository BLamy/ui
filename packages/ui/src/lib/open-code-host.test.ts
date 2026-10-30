import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openCodePreviewFrameUrl } from './open-code-preview';
import {
  createAlmostNodeOpenCodeHost,
  openCodePreviewUrl,
  type AlmostNodeOpenCodeContainer,
} from './open-code-host';

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup());
  vi.useRealTimers();
});

function fixture() {
  const directory = fs.mkdtempSync(join(tmpdir(), 'bl-opencode-'));
  const events = new EventEmitter();
  const registrations = new Map<
    number,
    { ownerId: string; purpose?: string }
  >();
  const run = vi.fn(async () => ({
    stdout: 'real output',
    stderr: '',
    exitCode: 0,
  }));
  const container = {
    id: 'owned-runtime',
    vfs: fs,
    run,
    dispose: vi.fn(),
    serverBridge: Object.assign(events, {
      ensureServiceWorkerReady: vi.fn(async () => {}),
      handleRequest: vi.fn(async () => ({
        statusCode: 200,
        statusMessage: 'OK',
        headers: { 'content-type': 'text/html' },
        body: new TextEncoder().encode('<h1>Real app response</h1>'),
      })),
      getServerPorts: () => [...registrations.keys()],
      getServerMetadata: (port: number) => registrations.get(port),
      getServerUrl: (port: number) =>
        `https://example.test/ui/__virtual__/${port}`,
    }),
  } satisfies AlmostNodeOpenCodeContainer;
  const host = createAlmostNodeOpenCodeHost(container, {
    directory,
    serviceWorkerUrl: '/__sw__.js',
  });
  cleanups.push(
    () => fs.rmSync(directory, { recursive: true, force: true }),
    () => host.dispose?.(),
  );
  return { directory, registrations, container, events, host, run };
}

describe('AlmostNode OpenCode host', () => {
  it('dispatches HTTP only to owned app ports through ServerBridge', async () => {
    const { host, registrations, container } = fixture();
    registrations.set(3000, { ownerId: container.id });
    registrations.set(4000, { ownerId: 'another-runtime' });
    const preview = host.previews;
    if (!preview) throw new Error('Missing preview bridge');
    const response = await preview.fetch(
      3000,
      new Request('https://preview.internal/api/status', {
        method: 'POST',
        body: 'payload',
      }),
    );
    expect(await response.text()).toBe('<h1>Real app response</h1>');
    expect(container.serverBridge.handleRequest).toHaveBeenCalledWith(
      3000,
      'POST',
      '/api/status',
      expect.any(Object),
      expect.any(ArrayBuffer),
    );
    expect(
      (await preview.fetch(4000, new Request('https://preview.internal/')))
        .status,
    ).toBe(503);
    expect(container.serverBridge.handleRequest).toHaveBeenCalledTimes(1);
  });
  it('shares actual workspace files and rejects paths escaping the workspace', () => {
    const { host, directory } = fixture();
    host.workspaceBridge.writeFile(`${directory}/hello.txt`, 'Hello');
    expect(fs.readFileSync(`${directory}/hello.txt`, 'utf8')).toBe('Hello');
    fs.writeFileSync(`${directory}/from-runtime.txt`, 'Updated');
    expect(host.workspaceBridge.readFile(`${directory}/from-runtime.txt`)).toBe(
      'Updated',
    );
    expect(host.workspaceBridge.listFiles?.()).toHaveLength(2);
    expect(() =>
      host.workspaceBridge.readFile(`${directory}/../outside`),
    ).toThrow(/outside/);
    expect(() => host.workspaceBridge.writeFile('/secrets', 'no')).toThrow(
      /outside/,
    );
  });

  it('passes a shell script, cwd, environment and cancellation to the real command runner', async () => {
    const { host, directory, run } = fixture();
    const signal = new AbortController().signal;
    await expect(
      host.processBridge.exec({
        command: '/bin/bash',
        args: ['-c', 'node server.cjs'],
        cwd: directory,
        env: { PORT: '3000' },
        signal,
      }),
    ).resolves.toEqual({ stdout: 'real output', stderr: '', code: 0 });
    expect(run).toHaveBeenCalledWith('node server.cjs', {
      cwd: directory,
      env: { PORT: '3000' },
      signal,
    });
    await host.processBridge.exec({
      command: 'echo',
      args: ["a'b;$(touch /tmp/no)"],
      cwd: directory,
    });
    expect(run.mock.calls[1][0]).toBe("'echo' 'a'\\''b;$(touch /tmp/no)'");
  });

  it('registers the service worker without reloading and only exposes this container’s app ports', async () => {
    const { host, registrations, container } = fixture();
    registrations.set(3000, { ownerId: container.id });
    registrations.set(4000, { ownerId: 'another-runtime' });
    registrations.set(5000, { ownerId: container.id, purpose: 'auxiliary' });
    await host.previews!.ready();
    expect(
      container.serverBridge.ensureServiceWorkerReady,
    ).toHaveBeenCalledWith({
      swUrl: '/__sw__.js',
      reloadOnFirstControl: false,
    });
    expect(host.previews!.list()).toEqual([
      {
        port: 3000,
        url: 'https://example.test/ui/__virtual__/3000/',
        name: undefined,
      },
    ]);
  });

  it('observes port opens and closes, then releases listeners and polling on unsubscribe', () => {
    vi.useFakeTimers();
    const { host, registrations, events, container } = fixture();
    const changed = vi.fn();
    const unsubscribe = host.previews!.subscribe(changed);
    registrations.set(3000, { ownerId: container.id });
    events.emit('server-ready', 3000);
    expect(changed).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    registrations.delete(3000);
    vi.advanceTimersByTime(500);
    expect(host.previews!.list()).toEqual([]);
    expect(changed).toHaveBeenCalledTimes(3);
    unsubscribe();
    expect(events.listenerCount('server-ready')).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('borrows containers unless ownership is explicitly requested', () => {
    const { host, container, directory } = fixture();
    host.dispose?.();
    expect(container.dispose).not.toHaveBeenCalled();
    const owned = createAlmostNodeOpenCodeHost(container, {
      directory,
      disposeContainer: true,
    });
    owned.dispose?.();
    owned.dispose?.();
    expect(container.dispose).toHaveBeenCalledTimes(1);
  });
});

it('rejects remote and mismatched port URLs before an iframe is opened', () => {
  expect(
    openCodePreviewUrl(
      { port: 3000, url: '/ui/__virtual__/3000/' },
      'https://example.test/ui/',
    ),
  ).toBe('https://example.test/ui/__virtual__/3000/');
  expect(() =>
    openCodePreviewUrl(
      { port: 3000, url: 'https://attacker.test/__virtual__/3000/' },
      'https://example.test/ui/',
    ),
  ).toThrow(/this origin/);
  expect(() =>
    openCodePreviewUrl(
      { port: 3000, url: '/ui/__virtual__/4000/' },
      'https://example.test/ui/',
    ),
  ).toThrow();
  expect(() =>
    openCodePreviewUrl(
      { port: 0, url: '/ui/__virtual__/0/' },
      'https://example.test/ui/',
    ),
  ).toThrow(/port/);
});

it('requires a separate preview origin and scopes the AlmostNode worker per session', () => {
  const id = '11111111-2222-3333-4444-555555555555';
  expect(() =>
    openCodePreviewFrameUrl(
      'https://host.test/preview/',
      id,
      3000,
      'https://host.test/',
    ),
  ).toThrow(/separate origin/);
  const url = new URL(
    openCodePreviewFrameUrl(
      'https://preview.test/opencode-preview/',
      id,
      3000,
      'https://host.test/',
    ),
  );
  expect(url.pathname).toBe(`/opencode-preview/${id}/host.html`);
  expect(url.searchParams.get('port')).toBe('3000');
});

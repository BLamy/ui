// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OpenCode } from './open-code';
import type {
  OpenCodeHostBridge,
  OpenCodePort,
  OpenCodeRuntime,
  OpenCodeRuntimeSession,
} from '@/lib/open-code-host';

afterEach(cleanup);

function fixture() {
  let ports: OpenCodePort[] = [];
  let listener = () => {};
  const host: OpenCodeHostBridge = {
    id: 'test-workspace',
    directory: '/workspace',
    dispose: vi.fn(),
    workspaceBridge: {
      exists: () => false,
      mkdir: vi.fn(),
      readFile: () => undefined,
      writeFile: vi.fn(),
      readdir: () => [],
      stat: () => undefined,
    },
    processBridge: { exec: async () => ({ stdout: '', stderr: '', code: 0 }) },
    previews: {
      ready: async () => {},
      fetch: async () => new Response('app'),
      list: () => ports,
      subscribe(fn) {
        listener = fn;
        return () => {
          listener = () => {};
        };
      },
    },
  };
  const session = { dispose: vi.fn() };
  const mount = vi.fn(async () => session);
  const runtime: OpenCodeRuntime = { mount };
  const loadRuntime = async () => runtime;
  const update = (next: OpenCodePort[]) => {
    ports = next;
    act(() => listener());
  };
  return { host, session, runtime, loadRuntime, mount, update };
}

it('mounts the configured bridge, opens new ports automatically, and borrows an existing host', async () => {
  const f = fixture();
  render(<OpenCode host={f.host} loadRuntime={f.loadRuntime} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start OpenCode' }));
  await waitFor(() => expect(f.mount).toHaveBeenCalledTimes(1));
  expect(f.mount.mock.calls[0]?.[0]).toMatchObject({
    directory: '/workspace',
    workspaceBridge: f.host.workspaceBridge,
    processBridge: f.host.processBridge,
  });
  f.update([
    { port: 3000, url: `${window.location.origin}/__virtual__/3000/` },
  ]);
  const iframe = screen.getByTitle('OpenCode · port 3000');
  const previewUrl = new URL(iframe.getAttribute('src') ?? '');
  expect(previewUrl.origin).not.toBe(window.location.origin);
  expect(previewUrl.pathname).toMatch(
    /^\/opencode-preview\/[a-f\d-]{36}\/host.html$/,
  );
  expect(previewUrl.searchParams.get('port')).toBe('3000');
  expect(iframe.getAttribute('sandbox')).toBe(
    'allow-scripts allow-forms allow-same-origin',
  );
  f.update([]);
  expect(screen.queryByTitle('OpenCode · port 3000')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Stop OpenCode' }));
  expect(f.session.dispose).toHaveBeenCalledTimes(1);
  expect(f.host.dispose).not.toHaveBeenCalled();
});

it('cleans up a mount that completes after Stop and disposes a factory-owned host', async () => {
  const f = fixture();
  let resolve: (session: OpenCodeRuntimeSession) => void = () => {};
  f.runtime.mount = vi.fn(
    () =>
      new Promise<OpenCodeRuntimeSession>((done) => {
        resolve = done;
      }),
  );
  render(<OpenCode createHost={() => f.host} loadRuntime={f.loadRuntime} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start OpenCode' }));
  await waitFor(() => expect(f.runtime.mount).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Stop OpenCode' }));
  expect(f.host.dispose).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve(f.session);
  });
  expect(f.session.dispose).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Start OpenCode' })).toBeTruthy();
});

it('reports service-worker errors and releases an owned host without mounting the TUI', async () => {
  const f = fixture();
  if (f.host.previews)
    f.host.previews.ready = async () => {
      throw new Error('Service worker missing');
    };
  render(<OpenCode createHost={() => f.host} loadRuntime={f.loadRuntime} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start OpenCode' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toBe(
      'Service worker missing',
    ),
  );
  expect(f.mount).not.toHaveBeenCalled();
  expect(f.host.dispose).toHaveBeenCalledTimes(1);
});

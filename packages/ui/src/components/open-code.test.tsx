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
  const runtime: OpenCodeRuntime = { mount, capabilities: { hostMcp: 1 } };
  const loadRuntime = async () => runtime;
  const update = (next: OpenCodePort[]) => {
    ports = next;
    act(() => listener());
  };
  return { host, session, runtime, loadRuntime, mount, update };
}

it('mounts the configured bridge, opens new ports automatically, and borrows an existing host', async () => {
  const f = fixture();
  render(<OpenCode host={f.host} loadRuntime={f.loadRuntime} autoStart={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start OpenCode' }));
  await waitFor(() => expect(f.mount).toHaveBeenCalledTimes(1));
  expect(f.mount.mock.calls[0]?.[0]).toMatchObject({
    directory: '/workspace',
    workspaceBridge: f.host.workspaceBridge,
    processBridge: f.host.processBridge,
    mcpServers: [expect.objectContaining({ name: 'agent-browser' })],
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

it('allows browser tools to be disabled and reports an incompatible runtime', async () => {
  const f = fixture();
  f.runtime.capabilities = undefined;
  const view = render(<OpenCode host={f.host} loadRuntime={f.loadRuntime} />);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('host MCP update'));
  expect(f.mount).not.toHaveBeenCalled();
  view.unmount();
  render(<OpenCode host={f.host} loadRuntime={f.loadRuntime} browserTools={false} />);
  await waitFor(() => expect(f.mount).toHaveBeenCalledTimes(1));
  expect(f.mount.mock.calls[0]?.[0]).toMatchObject({ mcpServers: [] });
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
  render(<OpenCode createHost={() => f.host} loadRuntime={f.loadRuntime} autoStart={false} />);
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
  render(<OpenCode createHost={() => f.host} loadRuntime={f.loadRuntime} autoStart={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start OpenCode' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toBe(
      'Service worker missing',
    ),
  );
  expect(f.mount).not.toHaveBeenCalled();
  expect(f.host.dispose).toHaveBeenCalledTimes(1);
});

it('starts on mount, opens an existing app port, and stays stopped until explicitly restarted', async () => {
  const f = fixture();
  f.update([
    { port: 3000, url: `${window.location.origin}/__virtual__/3000/` },
  ]);
  const createHost = vi.fn(() => f.host);
  const view = render(
    <OpenCode
      createHost={createHost}
      loadRuntime={f.loadRuntime}
      title="Vibecoder"
    />,
  );
  await waitFor(() => expect(f.mount).toHaveBeenCalledTimes(1));
  expect(screen.getByTitle('Vibecoder · port 3000')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Stop OpenCode' }));
  view.rerender(
    <OpenCode
      createHost={createHost}
      loadRuntime={f.loadRuntime}
      title="Vibecoder"
    />,
  );
  expect(f.session.dispose).toHaveBeenCalledTimes(1);
  expect(f.host.dispose).toHaveBeenCalledTimes(1);
  expect(createHost).toHaveBeenCalledTimes(1);
  expect(screen.queryByTitle('Vibecoder · port 3000')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Start OpenCode' }));
  await waitFor(() => expect(f.mount).toHaveBeenCalledTimes(2));
  expect(createHost).toHaveBeenCalledTimes(2);
});

it('reconnects preview frames on reload and port changes without restarting OpenCode', async () => {
  const f = fixture();
  const port = (value: number) => ({
    port: value,
    url: `${window.location.origin}/__virtual__/${value}/`,
  });
  f.update([port(3000)]);
  render(<OpenCode host={f.host} loadRuntime={f.loadRuntime} />);
  await waitFor(() => expect(f.mount).toHaveBeenCalledTimes(1));
  const initial = screen.getByTitle('OpenCode · port 3000');
  const initialUrl = new URL(initial.getAttribute('src') ?? '');
  fireEvent.click(screen.getByRole('button', { name: 'Reload app preview' }));
  const reloaded = screen.getByTitle('OpenCode · port 3000');
  const reloadUrl = new URL(reloaded.getAttribute('src') ?? '');
  expect(reloaded).not.toBe(initial);
  expect(reloadUrl.pathname).not.toBe(initialUrl.pathname);
  expect(reloadUrl.searchParams.get('port')).toBe('3000');
  f.update([port(3000), port(3001)]);
  expect(screen.getByTitle('OpenCode · port 3001')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Port 3000' }));
  const returnedUrl = new URL(
    screen.getByTitle('OpenCode · port 3000').getAttribute('src') ?? '',
  );
  expect(returnedUrl.pathname).not.toBe(initialUrl.pathname);
  expect(returnedUrl.pathname).not.toBe(reloadUrl.pathname);
  expect(f.mount).toHaveBeenCalledTimes(1);
  expect(f.host.dispose).not.toHaveBeenCalled();
  expect(f.session.dispose).not.toHaveBeenCalled();
});

it('routes MCP navigation through a fresh worker bootstrap without restarting the terminal', async () => {
  const f = fixture();
  f.update([{ port: 3000, url: `${window.location.origin}/__virtual__/3000/` }]);
  render(<OpenCode host={f.host} loadRuntime={f.loadRuntime} />);
  await waitFor(() => expect(f.mount).toHaveBeenCalledTimes(1));
  const initial = screen.getByTitle('OpenCode · port 3000');
  const initialUrl = new URL(initial.getAttribute('src') ?? '');
  const options = f.mount.mock.calls[0]?.[0] as Parameters<OpenCodeRuntime['mount']>[0] | undefined;
  const server = options?.mcpServers?.find((entry) => entry.name === 'agent-browser');
  if (!server) throw new Error('Browser MCP server missing');
  const controller = new AbortController();
  let navigation: Promise<unknown> = Promise.resolve();
  act(() => { navigation = server.callTool('agent_browser_open', { url: '/deep?x=yes' }, controller.signal); });
  const rejected = expect(navigation).rejects.toThrow('cancelled');
  const next = screen.getByTitle('OpenCode · port 3000');
  const nextUrl = new URL(next.getAttribute('src') ?? '');
  expect(next).not.toBe(initial);
  expect(nextUrl.pathname).not.toBe(initialUrl.pathname);
  expect(nextUrl.pathname).toMatch(/\/host\.html$/);
  expect(nextUrl.searchParams.has('path')).toBe(false);
  expect(new URLSearchParams(nextUrl.hash.slice(1)).get('path')).toBe('/deep?x=yes');
  expect(f.mount).toHaveBeenCalledTimes(1);
  controller.abort();
  await rejected;
});

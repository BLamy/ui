// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

import { OpenCode } from './open-code';
import { AppearanceProvider, ThemeScope } from '@/lib/theme';
import type {
  OpenCodeHostBridge,
  OpenCodeCredentialStore,
  OpenCodePort,
  OpenCodeRuntime,
  OpenCodeRuntimeSession,
} from '@/lib/open-code-host';

// Reduced motion (vi.hoisted runs before the imports), so the Buttons' TextMorph swaps "Start" and "Stop" at once instead of morphing for 700 ms.
vi.hoisted(() => {
  window.matchMedia ??= (query: string) =>
    ({
      matches: query.includes('reduce'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
});

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
// jsdom (kept so the preview iframes never load over the network) has no layout: the Buttons' TextMorph measures
// its label with a Range.
Range.prototype.getBoundingClientRect ??= () => new DOMRect();

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
  render(
    <OpenCode host={f.host} loadRuntime={f.loadRuntime} autoStart={false} />,
  );
  // The terminal's mount point is a named group, so its name is allowed and heard.
  expect(screen.getByRole('group', { name: 'OpenCode terminal' })).toBeTruthy();
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
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('host MCP update'),
  );
  expect(f.mount).not.toHaveBeenCalled();
  view.unmount();
  render(
    <OpenCode host={f.host} loadRuntime={f.loadRuntime} browserTools={false} />,
  );
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
  render(
    <OpenCode
      createHost={() => f.host}
      loadRuntime={f.loadRuntime}
      autoStart={false}
    />,
  );
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
  render(
    <OpenCode
      createHost={() => f.host}
      loadRuntime={f.loadRuntime}
      autoStart={false}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Start OpenCode' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toBe(
      'Service worker missing',
    ),
  );
  expect(f.mount).not.toHaveBeenCalled();
  expect(f.host.dispose).toHaveBeenCalledTimes(1);
});

it.each([true, false])(
  'passes the encrypted store and stops when availability changes from %s',
  async (initial) => {
    const f = fixture();
    f.runtime.capabilities = { hostMcp: 1, credentialStore: 1 };
    let unlocked = initial;
    let listener = () => {};
    const store: OpenCodeCredentialStore = {
      version: 1,
      unlocked: () => unlocked,
      load: async () => [],
      save: async () => {},
      subscribe: (next) => {
        listener = next;
        return () => {
          listener = () => {};
        };
      },
    };
    render(
      <OpenCode
        createHost={() => f.host}
        loadRuntime={f.loadRuntime}
        autoStart={false}
        credentialStore={store}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start OpenCode' }));
    await waitFor(() => expect(f.mount).toHaveBeenCalledTimes(1));
    expect(f.mount.mock.calls[0]?.[0].credentialStore).toBe(store);
    act(() => {
      unlocked = !initial;
      listener();
    });
    await waitFor(() => expect(f.session.dispose).toHaveBeenCalledTimes(1));
    expect(f.host.dispose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Start OpenCode' })).toBeTruthy();
  },
);

it('refuses runtimes that cannot honor encrypted credential persistence', async () => {
  const f = fixture();
  const store: OpenCodeCredentialStore = {
    version: 1,
    unlocked: () => true,
    load: async () => [],
    save: async () => {},
    subscribe: () => () => {},
  };
  render(
    <OpenCode
      createHost={() => f.host}
      loadRuntime={f.loadRuntime}
      autoStart={false}
      credentialStore={store}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Start OpenCode' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'credentialStore v1',
    ),
  );
  expect(f.mount).not.toHaveBeenCalled();
  expect(f.host.dispose).toHaveBeenCalledTimes(1);
});

it('restarts automatically after keychain unlock, reloads both stores and stops on lock', async () => {
  const f = fixture();
  f.runtime.capabilities = {
    hostMcp: 1,
    credentialStore: 1,
    connectionStore: 1,
  };
  let unlocked = false;
  const listeners = new Set<() => void>();
  const store: OpenCodeCredentialStore = {
    version: 1,
    unlocked: () => unlocked,
    load: async () => [],
    save: async () => {},
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const connectionStore = {
    ...store,
    load: async () => ({ v: 1, type: 'tailscale', session: null }),
  };
  render(
    <OpenCode
      createHost={() => f.host}
      loadRuntime={f.loadRuntime}
      credentialStore={store}
      connectionStore={connectionStore}
    />,
  );
  await waitFor(() => expect(f.mount).toHaveBeenCalledTimes(1));
  act(() => {
    unlocked = true;
    listeners.forEach((listener) => listener());
  });
  await waitFor(() => expect(f.mount).toHaveBeenCalledTimes(2));
  expect(f.session.dispose).toHaveBeenCalledTimes(1);
  expect(f.mount.mock.calls[1]?.[0]).toMatchObject({
    credentialStore: store,
    connectionStore,
  });
  // Ordinary vault writes also notify subscribers; they must not restart the terminal.
  act(() => listeners.forEach((listener) => listener()));
  expect(f.mount).toHaveBeenCalledTimes(2);
  act(() => {
    unlocked = false;
    listeners.forEach((listener) => listener());
  });
  await waitFor(() => expect(f.session.dispose).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('button', { name: 'Start OpenCode' })).toBeTruthy();
});

it('refuses runtimes that would ignore the saved Tailscale connection', async () => {
  const f = fixture();
  f.runtime.capabilities = { hostMcp: 1, credentialStore: 1 };
  const store: OpenCodeCredentialStore = {
    version: 1,
    unlocked: () => true,
    load: async () => null,
    save: async () => {},
    subscribe: () => () => {},
  };
  render(
    <OpenCode
      createHost={() => f.host}
      loadRuntime={f.loadRuntime}
      connectionStore={store}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'connectionStore v1',
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
  f.update([
    { port: 3000, url: `${window.location.origin}/__virtual__/3000/` },
  ]);
  render(<OpenCode host={f.host} loadRuntime={f.loadRuntime} />);
  await waitFor(() => expect(f.mount).toHaveBeenCalledTimes(1));
  const initial = screen.getByTitle('OpenCode · port 3000');
  const initialUrl = new URL(initial.getAttribute('src') ?? '');
  const options = f.mount.mock.calls[0]?.[0] as
    Parameters<OpenCodeRuntime['mount']>[0] | undefined;
  const server = options?.mcpServers?.find(
    (entry) => entry.name === 'agent-browser',
  );
  if (!server) throw new Error('Browser MCP server missing');
  const controller = new AbortController();
  let navigation: Promise<unknown> = Promise.resolve();
  act(() => {
    navigation = server.callTool(
      'agent_browser_open',
      { url: '/deep?x=yes' },
      controller.signal,
    );
  });
  const rejected = expect(navigation).rejects.toThrow('cancelled');
  const next = screen.getByTitle('OpenCode · port 3000');
  const nextUrl = new URL(next.getAttribute('src') ?? '');
  expect(next).not.toBe(initial);
  expect(nextUrl.pathname).not.toBe(initialUrl.pathname);
  expect(nextUrl.pathname).toMatch(/\/host\.html$/);
  expect(nextUrl.searchParams.has('path')).toBe(false);
  expect(new URLSearchParams(nextUrl.hash.slice(1)).get('path')).toBe(
    '/deep?x=yes',
  );
  expect(f.mount).toHaveBeenCalledTimes(1);
  controller.abort();
  await rejected;
});

it('picks a preview port from a toggle group: one tab stop, arrow keys between ports, the choice stays pressed', async () => {
  const f = fixture();
  const port = (value: number) => ({
    port: value,
    url: `${window.location.origin}/__virtual__/${value}/`,
  });
  render(<OpenCode host={f.host} loadRuntime={f.loadRuntime} />);
  await waitFor(() => expect(f.mount).toHaveBeenCalledTimes(1));
  f.update([port(3000), port(3001)]);
  const group = screen.getByRole('group', { name: 'Preview port' });
  const first = screen.getByRole('button', { name: 'Port 3000' });
  const second = screen.getByRole('button', { name: 'Port 3001' });
  // The newest port opens; it is the group's only tab stop.
  expect(second.getAttribute('aria-pressed')).toBe('true');
  expect(first.getAttribute('aria-pressed')).toBe('false');
  expect(
    [...group.querySelectorAll('button')].filter((b) => b.tabIndex === 0),
  ).toEqual([second]);
  act(() => second.focus());
  fireEvent.keyDown(second, { key: 'ArrowLeft' });
  expect(document.activeElement).toBe(first);
  fireEvent.click(first);
  expect(first.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByTitle('OpenCode · port 3000')).toBeTruthy();
  // Pressing the chosen port again keeps it open.
  fireEvent.click(first);
  expect(first.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByTitle('OpenCode · port 3000')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close app preview' }));
  expect(screen.queryByTitle('OpenCode · port 3000')).toBeNull();
  expect(first.getAttribute('aria-pressed')).toBe('false');
});

it('stacks the preview under the terminal by its own width, not the viewport', async () => {
  const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return 420;
    },
  });
  try {
    const f = fixture();
    render(<OpenCode host={f.host} loadRuntime={f.loadRuntime} autoStart={false} />);
    const root = screen.getByRole('region', { name: 'OpenCode' });
    expect(root.getAttribute('data-size-class')).toBe('compact');
    expect(root.className).toContain('group/open-code');
  } finally {
    if (width) Object.defineProperty(HTMLElement.prototype, 'clientWidth', width);
  }
});

it('takes its appearance from the prop, else the nearest ThemeScope, else the ambient appearance, else dark', async () => {
  for (const [wrap, want] of [
    [(c: ReactNode) => c, 'dark'],
    [(c: ReactNode) => <AppearanceProvider value="light">{c}</AppearanceProvider>, 'light'],
    [(c: ReactNode) => <ThemeScope scope="sheet" appearance="light">{c}</ThemeScope>, 'light'],
  ] as const) {
    const f = fixture();
    const view = render(wrap(<OpenCode host={f.host} loadRuntime={f.loadRuntime} browserTools={false} />));
    await waitFor(() => expect(f.mount).toHaveBeenCalledTimes(1));
    expect(f.mount.mock.calls[0]?.[0]).toMatchObject({ themeMode: want });
    view.unmount();
  }
  const f = fixture();
  render(
    <AppearanceProvider value="light">
      <OpenCode host={f.host} loadRuntime={f.loadRuntime} browserTools={false} appearance="dark" />
    </AppearanceProvider>,
  );
  await waitFor(() => expect(f.mount).toHaveBeenCalledTimes(1));
  expect(f.mount.mock.calls[0]?.[0]).toMatchObject({ themeMode: 'dark' });
});

it('is a card by default and plain on request, and passes ref and root props through', () => {
  const f = fixture();
  const ref = { current: null as HTMLElement | null };
  const view = render(<OpenCode host={f.host} loadRuntime={f.loadRuntime} autoStart={false} data-testid="oc" ref={ref} />);
  const root = screen.getByRole('region', { name: 'OpenCode' });
  expect(root.getAttribute('data-testid')).toBe('oc');
  expect(ref.current).toBe(root);
  expect(root.className).toContain('rounded-card');
  view.rerender(<OpenCode host={f.host} loadRuntime={f.loadRuntime} autoStart={false} variant="plain" />);
  expect(screen.getByRole('region', { name: 'OpenCode' }).className).not.toContain('rounded-card');
});

it('waits in an empty state whose action is Start, and keeps Stop in the header only while it runs', async () => {
  const f = fixture();
  render(<OpenCode host={f.host} loadRuntime={f.loadRuntime} autoStart={false} />);
  const start = screen.getByRole('button', { name: 'Start OpenCode' });
  // One Start, in the empty terminal, under a title that says what is missing.
  expect(start.closest('[data-slot=empty-state]')).toBeTruthy();
  expect(screen.getByText("OpenCode isn't running")).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Stop OpenCode' })).toBeNull();
  fireEvent.click(start);
  await waitFor(() => expect(f.runtime.mount).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Stop OpenCode' }).closest('header')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Start OpenCode' })).toBeNull();
});

it('shows a start failure in the shared destructive callout', async () => {
  const f = fixture();
  render(<OpenCode host={f.host} loadRuntime={() => Promise.reject(new Error('runtime offline'))} />);
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('runtime offline');
  expect(alert.className).toContain('bg-destructive/10');
  expect(alert.querySelector('[data-slot=icon]')).toBeTruthy();
  expect(screen.getByText('OpenCode could not start')).toBeTruthy();
});

// @vitest-environment jsdom
import { MessageChannel } from 'node:worker_threads';
import { afterEach, expect, it, vi } from 'vitest';
import { createOpenCodeBrowser } from './open-code-browser';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function fixture() {
  vi.stubGlobal('MessageChannel', MessageChannel);
  const browser = createOpenCodeBrowser();
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const ports: MessagePort[] = [];
  const intercepted = new WeakSet<Window>();
  const intercept = () => {
    const target = frame.contentWindow;
    if (!target) throw new Error('Fixture iframe has no window');
    if (intercepted.has(target)) return;
    intercepted.add(target);
    vi.spyOn(target, 'postMessage').mockImplementation(
      (_message, _origin, transfer) => {
        ports.push((transfer as Transferable[])[0] as MessagePort);
      },
    );
  };
  let session = 'test-session';
  let path = '/';
  const url = () =>
    'https://preview.example/opencode-preview/' +
    session +
    '/host.html?port=3000#path=' +
    encodeURIComponent(path);
  let disconnect = () => {};
  const navigate = vi.fn((next: string) => {
    disconnect();
    path = next;
    session += '-next';
    frame.src = url();
    disconnect = browser.connect({
      frame,
      session,
      url: url(),
      port: 3000,
      navigate,
    });
  });
  disconnect = browser.connect({
    frame,
    session,
    url: url(),
    port: 3000,
    navigate,
  });
  const ready = (overrides: Partial<MessageEventInit> = {}) => {
    intercept();
    return window.dispatchEvent(
      new MessageEvent('message', {
        source: frame.contentWindow,
        origin: 'https://preview.example',
        data: {
          type: 'bl-opencode-browser:ready',
          session,
          url: new URL('./__virtual__/3000/' + path.replace(/^\//, ''), url())
            .href,
        },
        ...overrides,
      }),
    );
  };
  const signal = new AbortController().signal;
  return {
    browser,
    navigate,
    frame,
    ports,
    ready,
    signal,
    close() {
      disconnect();
      browser.reset();
      ports.forEach((port) => port.close());
    },
  };
}

it('accepts only the selected frame, origin and session and sends tool calls over its private channel', async () => {
  const f = fixture();
  try {
    f.ready({ origin: 'https://other.example' });
    f.ready({ source: window });
    f.ready({
      data: { type: 'bl-opencode-browser:ready', session: 'other-session' },
    });
    expect(f.ports).toHaveLength(0);
    f.ready();
    expect(f.ports).toHaveLength(1);
    f.ports[0].onmessage = (event) =>
      f.ports[0].postMessage({ id: event.data.id, result: 'Clicked 1 time' });
    f.ports[0].start();
    const result = await f.browser.server.callTool(
      'agent_browser_get_text',
      { selector: '#counter' },
      f.signal,
    );
    expect(result.content[0].text).toBe('Clicked 1 time');
    await expect(
      f.browser.server.callTool(
        'agent_browser_click',
        { selector: '#counter', extraArgs: ['--cdp=host'] },
        f.signal,
      ),
    ).rejects.toThrow('Invalid tool argument');
    await expect(
      f.browser.server.callTool(
        'agent_browser_open',
        { url: 'https://host.example/private' },
        f.signal,
      ),
    ).rejects.toThrow('selected app port');
    await expect(
      f.browser.server.callTool(
        'agent_browser_open',
        { url: 'http://localhost:4000/' },
        f.signal,
      ),
    ).rejects.toThrow('selected app port');
  } finally {
    f.close();
  }
});

it('reconnects after app navigation and rejects pending calls when a preview is replaced', async () => {
  const f = fixture();
  try {
    f.ready();
    const navigation = f.browser.server.callTool(
      'agent_browser_open',
      { url: 'http://localhost:3000/next?q=yes' },
      f.signal,
    );
    expect(f.navigate).toHaveBeenCalledWith('/next?q=yes');
    expect(new URL(f.frame.src).pathname).toBe(
      '/opencode-preview/test-session-next/host.html',
    );
    expect(
      new URLSearchParams(new URL(f.frame.src).hash.slice(1)).get('path'),
    ).toBe('/next?q=yes');
    f.ready();
    expect((await navigation).content[0].text).toContain('/next?q=yes');
    const received = Promise.withResolvers<void>();
    f.ports[1].onmessage = () => received.resolve();
    f.ports[1].start();
    const pending = f.browser.server.callTool(
      'agent_browser_snapshot',
      {},
      f.signal,
    );
    const rejected = expect(pending).rejects.toThrow('closed or replaced');
    await received.promise;
    f.close();
    await rejected;
    await expect(
      f.browser.server.callTool('agent_browser_snapshot', {}, f.signal),
    ).rejects.toThrow('No app preview');
  } finally {
    f.close();
  }
});

// @vitest-environment happy-dom
import { StrictMode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HostMessage, RuntimeMessage } from './protocol';
import { useSandbox, type UseSandboxOptions } from './react';

/* A Worker that says hello, and is ready as soon as it is asked to start. */
class FakeWorker {
  static all: FakeWorker[] = [];
  terminated = false;
  received: HostMessage[] = [];
  private listeners = new Set<(event: MessageEvent<RuntimeMessage>) => void>();
  constructor(private origin: string) {
    FakeWorker.all.push(this);
    setTimeout(() => this.say({ type: 'hello', href: 'https://app.example/assets/sandbox.worker.js', origin }));
  }
  say(data: RuntimeMessage) {
    if (!this.terminated) for (const listener of this.listeners) listener({ data } as MessageEvent<RuntimeMessage>);
  }
  postMessage(message: HostMessage) {
    this.received.push(message);
    if (message.type === 'init') setTimeout(() => this.say({ type: 'ready', origin: this.origin }));
  }
  terminate() { this.terminated = true; }
  addEventListener(type: string, listener: (event: never) => void) {
    if (type === 'message') this.listeners.add(listener as never);
  }
}

const appWorker = () => new FakeWorker('https://app.example') as unknown as Worker;
const settle = () => act(() => new Promise<void>((resolve) => { setTimeout(resolve, 30); }));

function Status(props: Partial<UseSandboxOptions>) {
  const { sandbox, status, isolation, error } = useSandbox({ worker: appWorker, ...props });
  return (
    <p data-testid="status" data-has={sandbox ? 'yes' : 'no'}>
      {status} {isolation ?? 'nowhere'} {error?.code ?? 'fine'}
    </p>
  );
}

afterEach(() => {
  cleanup();
  FakeWorker.all = [];
  vi.unstubAllGlobals();
});

describe('useSandbox', () => {
  it('starts one sandbox in Strict Mode, follows it to ready, and says where the code runs', async () => {
    vi.stubGlobal('Worker', class { constructor() { return new FakeWorker('null') as unknown as Worker; } });
    render(<StrictMode><Status /></StrictMode>);
    expect(screen.getByTestId('status').textContent).toBe('loading nowhere fine');
    expect(screen.getByTestId('status').dataset.has).toBe('yes');
    await settle();
    expect(screen.getByTestId('status').textContent).toBe('ready opaque-origin fine');
    // Strict Mode's rehearsal made a sandbox and ended it: every Worker but the one in use is gone.
    expect(FakeWorker.all.filter((worker) => !worker.terminated)).toHaveLength(1);
    expect(FakeWorker.all.filter((worker) => worker.received.some((message) => message.type === 'init'))).toHaveLength(1);
  });

  it('ends the sandbox when the component goes', async () => {
    vi.stubGlobal('Worker', class { constructor() { return new FakeWorker('null') as unknown as Worker; } });
    const { unmount } = render(<StrictMode><Status /></StrictMode>);
    await settle();
    unmount();
    expect(FakeWorker.all.every((worker) => worker.terminated)).toBe(true);
  });

  it('shows the failure when the host can\'t give it an origin of its own, and runs nothing', async () => {
    // A `data:` Worker whose import the host refused.
    vi.stubGlobal('Worker', class {
      constructor() {
        const worker = new FakeWorker('null');
        worker.terminated = true;
        const listeners: Array<(event: MessageEvent) => void> = [];
        setTimeout(() => listeners.forEach((listener) => listener({ data: { type: 'load-failed', message: 'CORS' } } as MessageEvent)));
        return { postMessage: vi.fn(), terminate: vi.fn(), addEventListener: (type: string, listener: (event: MessageEvent) => void) => { if (type === 'message') listeners.push(listener); } } as unknown as Worker;
      }
    });
    render(<StrictMode><Status /></StrictMode>);
    await settle();
    expect(screen.getByTestId('status').textContent).toBe('failed nowhere isolation');
    expect(FakeWorker.all.some((worker) => worker.received.length > 0)).toBe(false);
  });

  it('reports the fallback it was allowed to take', async () => {
    vi.stubGlobal('Worker', class { constructor() { throw new Error('data: Workers are blocked here'); } });
    render(<StrictMode><Status fallback="same-origin" /></StrictMode>);
    await settle();
    expect(screen.getByTestId('status').textContent).toBe('ready same-origin fine');
  });

  it('waits to be started when told to', async () => {
    render(<StrictMode><Status autoStart={false} isolation="same-origin" /></StrictMode>);
    await settle();
    expect(screen.getByTestId('status').textContent).toBe('idle nowhere fine');
    expect(FakeWorker.all).toHaveLength(0);
  });
});

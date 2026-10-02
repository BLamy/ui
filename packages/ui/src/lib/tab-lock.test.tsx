// @vitest-environment happy-dom
import { StrictMode } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SingleTabGate, useTabLock } from '@/lib/tab-lock';

/* A fake navigator.locks (exclusive, first come first served, ifAvailable, signal) standing in for the browser's.
   The "other tab" is the test itself, holding the lock and listening on the same BroadcastChannel name. */

class FakeLocks {
  private held = new Set<string>();
  private queues = new Map<string, (() => void)[]>();
  request(name: string, a: unknown, b?: unknown): Promise<unknown> {
    const opts = (typeof a === 'function' ? {} : a) as { ifAvailable?: boolean; signal?: AbortSignal };
    const cb = (typeof a === 'function' ? a : b) as (lock: { name: string } | null) => unknown;
    return new Promise((resolve, reject) => {
      const grant = () => {
        this.held.add(name);
        Promise.resolve(cb({ name })).then(
          (r) => {
            this.held.delete(name);
            this.queues.get(name)?.shift()?.();
            resolve(r);
          },
          reject,
        );
      };
      if (!this.held.has(name)) return grant();
      if (opts.ifAvailable) return void Promise.resolve(cb(null)).then(resolve, reject);
      const q = this.queues.get(name) ?? [];
      this.queues.set(name, q);
      q.push(grant);
      opts.signal?.addEventListener('abort', () => {
        const i = q.indexOf(grant);
        if (i >= 0) q.splice(i, 1);
        reject(new DOMException('aborted', 'AbortError'));
      });
    });
  }
}

const NAME = 'idb://test';
const CHANNEL = `bl-tab-lock:${NAME}`;
let locks: FakeLocks;

beforeEach(() => {
  locks = new FakeLocks();
  Object.defineProperty(navigator, 'locks', { value: locks, configurable: true });
});
afterEach(async () => {
  cleanup();
  await new Promise((r) => setTimeout(r, 10)); // deferred release
  Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
});

function Status({ name = NAME }: { name?: string }) {
  const lock = useTabLock(name);
  return <button onClick={lock.takeover}>{lock.status}</button>;
}

/** Holds the lock as another tab would, releasing when asked to step aside. */
function otherTab(opts: { yieldsOnTakeover: boolean }) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const got = locks.request(`bl-tab-lock:${NAME}`, () => held);
  const channel = new BroadcastChannel(CHANNEL);
  const requests: unknown[] = [];
  channel.onmessage = (e) => {
    requests.push(e.data);
    if (opts.yieldsOnTakeover && e.data === 'takeover') release();
  };
  return { release, got, requests, close: () => channel.close() };
}

describe('useTabLock', () => {
  it('is held when nobody else has the lock', async () => {
    render(<Status />);
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('held'));
  });

  it('is blocked while another tab holds it, and held once that tab lets go', async () => {
    const tab = otherTab({ yieldsOnTakeover: false });
    render(<Status />);
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('blocked'));
    tab.release();
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('held'));
    tab.close();
  });

  it('takeover() asks the holder to step aside', async () => {
    const tab = otherTab({ yieldsOnTakeover: true });
    render(<Status />);
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('blocked'));
    act(() => screen.getByRole('button').click());
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('held'));
    expect(tab.requests).toContain('takeover');
    tab.close();
  });

  it('a holder asked to step aside becomes blocked and gets the lock back when the taker leaves', async () => {
    render(<Status />);
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('held'));
    // another tab queues for the lock and asks for it
    let release!: () => void;
    const taker = locks.request(`bl-tab-lock:${NAME}`, () => new Promise<void>((r) => (release = r)));
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage('takeover');
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('blocked'));
    release();
    await taker;
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('held'));
    channel.close();
  });

  it('survives StrictMode: keeps one held lock instead of racing itself into "blocked"', async () => {
    const seen: string[] = [];
    function Watch() {
      const lock = useTabLock(NAME);
      seen.push(lock.status);
      return <span>{lock.status}</span>;
    }
    render(<StrictMode><Watch /></StrictMode>);
    await waitFor(() => expect(screen.getByText('held')).toBeTruthy());
    expect(seen).not.toContain('blocked');
  });

  it('components with the same name in one tab share the lock', async () => {
    render(<><Status /><Status /></>);
    await waitFor(() => expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['held', 'held']));
  });

  it('releases the lock when the last user unmounts, and gives up a queued request', async () => {
    const tab = otherTab({ yieldsOnTakeover: false });
    const view = render(<Status />);
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('blocked'));
    view.unmount();
    await new Promise((r) => setTimeout(r, 10));
    tab.release();
    await tab.got;
    // the unmounted tab must not have taken the lock in the meantime: it is free for a fresh request
    let free = false;
    await locks.request(`bl-tab-lock:${NAME}`, { ifAvailable: true }, (lock: unknown) => void (free = !!lock));
    expect(free).toBe(true);
    tab.close();
  });

  it('fails open as "unsupported" where navigator.locks is missing', async () => {
    Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
    render(<Status />);
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('unsupported'));
  });
});

describe('SingleTabGate', () => {
  it('renders `blocked` (with takeover) while another tab holds the lock, and the children once it is ours', async () => {
    const tab = otherTab({ yieldsOnTakeover: true });
    render(
      <SingleTabGate name={NAME} pending={<p>checking</p>} blocked={({ takeover }) => <button onClick={takeover}>use here</button>}>
        <p>the app</p>
      </SingleTabGate>,
    );
    await waitFor(() => expect(screen.getByText('use here')).toBeTruthy());
    expect(screen.queryByText('the app')).toBeNull();
    act(() => screen.getByText('use here').click());
    await waitFor(() => expect(screen.getByText('the app')).toBeTruthy());
    tab.close();
  });
});

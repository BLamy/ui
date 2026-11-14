// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindBack } from '@/lib/back';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

const cleanups: (() => void)[] = [];
const el = () => document.body.appendChild(document.createElement('div'));
const bind = (onBack: (event: Event) => boolean | void) => {
  const off = bindBack(el(), { onBack });
  cleanups.push(off);
  return off;
};

// Each test starts as a page that never asked for a back.
beforeEach(() => {
  delete (window as unknown as Record<symbol, unknown>)[Symbol.for('bl-ui.back@1')];
});
// Unbinding takes a held entry out of history a task later, before the next test.
afterEach(async () => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  await vi.waitFor(() => expect(history.state?.__blBack).toBeFalsy());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('bindBack with a close watcher, as on Android', () => {
  // The watchers alive now, newest last. A real one is spent once it closes.
  let watchers: FakeWatcher[] = [];
  class FakeWatcher extends EventTarget {
    constructor() {
      super();
      watchers.push(this);
    }
    destroy() {
      watchers = watchers.filter((watcher) => watcher !== this);
    }
    back() {
      this.destroy();
      this.dispatchEvent(new Event('close'));
    }
  }
  beforeEach(() => {
    watchers = [];
    vi.stubGlobal('CloseWatcher', FakeWatcher);
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 16) Chrome/142.0 Mobile',
    });
  });

  it('watches only while something is bound, with one watcher for all of it', () => {
    expect(watchers).toHaveLength(0);
    const offFirst = bind(() => {});
    const offSecond = bind(() => {});
    expect(watchers).toHaveLength(1);
    offFirst();
    expect(watchers).toHaveLength(1);
    offSecond();
    expect(watchers).toHaveLength(0);
  });

  it("the newest bound hears a back first, and the rest don't", () => {
    const first = vi.fn();
    const second = vi.fn();
    bind(first);
    bind(second);
    watchers[0].back();
    expect(second).toHaveBeenCalledWith(expect.any(Event));
    expect(first).not.toHaveBeenCalled();
  });

  it('returning false passes a back to the one bound before', () => {
    const first = vi.fn();
    bind(first);
    bind(() => false);
    watchers[0].back();
    expect(first).toHaveBeenCalledOnce();
  });

  it('watches for the next back while something is still bound', () => {
    const onBack = vi.fn();
    bind(onBack);
    watchers[0].back();
    expect(watchers).toHaveLength(1);
    watchers[0].back();
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it('stops watching when a back unbinds the last one', () => {
    const off = bind(() => off());
    watchers[0].back();
    expect(watchers).toHaveLength(0);
  });

  it("an Escape the layers just handled isn't a back", () => {
    const onBack = vi.fn();
    bind(onBack);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    watchers[0].back();
    expect(onBack).not.toHaveBeenCalled();
    expect(watchers).toHaveLength(1);
  });

  it("a desktop's watcher is left alone, since it hears Escape", () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh)' });
    bind(() => {});
    expect(watchers).toHaveLength(0);
  });
});

describe('bindBack with a history entry, as on a phone without a watcher', () => {
  const isHeld = () => !!history.state?.__blBack;
  // What a router would hear.
  const heard = vi.fn();
  beforeEach(() => {
    heard.mockClear();
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(pointer: coarse)',
    }));
    window.addEventListener('popstate', heard);
    cleanups.push(() => window.removeEventListener('popstate', heard));
  });

  it("holds one entry while something is bound, with the page's state kept on it", async () => {
    history.replaceState({ route: 'inbox' }, '');
    const length = history.length;
    const offFirst = bind(() => {});
    const offSecond = bind(() => {});
    expect(history.length).toBe(length + 1);
    expect(history.state).toEqual({ route: 'inbox', __blBack: true });
    offFirst();
    expect(isHeld()).toBe(true);
    offSecond();
    await vi.waitFor(() => expect(isHeld()).toBe(false));
    expect(history.state).toEqual({ route: 'inbox' });
  });

  it('going back runs the newest onBack, and holds an entry again while it stays bound', async () => {
    const first = vi.fn();
    const second = vi.fn();
    bind(first);
    bind(second);
    history.back();
    await vi.waitFor(() => expect(second).toHaveBeenCalledOnce());
    expect(first).not.toHaveBeenCalled();
    expect(isHeld()).toBe(true);
  });

  it('a back that unbinds the last one leaves no entry behind', async () => {
    const off = bind(() => off());
    const length = history.length;
    history.back();
    await vi.waitFor(() => expect(isHeld()).toBe(false));
    // One more back would leave the page, as before anything was bound.
    expect(history.length).toBe(length);
  });

  it("the page's own listeners never hear its entry come or go", async () => {
    const onBack = vi.fn();
    const off = bind(onBack);
    history.back();
    await vi.waitFor(() => expect(onBack).toHaveBeenCalledOnce());
    off();
    await vi.waitFor(() => expect(isHeld()).toBe(false));
    expect(heard).not.toHaveBeenCalled();
  });

  it('unbinding after the page moved on leaves its history alone', async () => {
    const off = bind(() => {});
    history.pushState({ route: 'settings' }, '', '/settings');
    off();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(location.pathname).toBe('/settings');
    expect(history.state).toEqual({ route: 'settings' });
  });

  it("a move to another address is the page's to hear, not a back", async () => {
    history.pushState({ route: 'a' }, '', '/a');
    history.pushState({ route: 'b' }, '', '/b');
    const onBack = vi.fn();
    bind(onBack);
    history.go(-2);
    await vi.waitFor(() => expect(heard).toHaveBeenCalledOnce());
    expect(location.pathname).toBe('/a');
    expect(onBack).not.toHaveBeenCalled();
    // Still bound, so it holds an entry on the page it landed on.
    await vi.waitFor(() => expect(isHeld()).toBe(true));
    expect(location.pathname).toBe('/a');
  });
});

describe('bindBack on a desktop', () => {
  it('holds nothing, so a back leaves the page as it always did', () => {
    const length = history.length;
    const state = history.state;
    bind(() => {});
    expect(history.length).toBe(length);
    expect(history.state).toBe(state);
  });
});

describe("bindBack keeps the page's own history state whole", () => {
  const isHeld = () => !!history.state?.__blBack;
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }));
  });

  it("a state that isn't a plain object is wrapped, not spread apart", async () => {
    history.replaceState('inbox', '');
    const off = bind(() => {});
    expect(history.state).toEqual({ __blBack: true, state: 'inbox' });
    off();
    await vi.waitFor(() => expect(isHeld()).toBe(false));
    expect(history.state).toBe('inbox');
  });

  it("an array state stays an array on the page's entry", async () => {
    history.replaceState(['a', 'b'], '');
    const off = bind(() => {});
    expect(history.state).toEqual({ __blBack: true, state: ['a', 'b'] });
    off();
    await vi.waitFor(() => expect(isHeld()).toBe(false));
    expect(history.state).toEqual(['a', 'b']);
  });
});

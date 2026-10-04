import { describe, expect, it } from 'vitest';
import { LoadError, type Page } from './loader';
import { initialState, reducer, type BrowserState, type Entry } from './use-browser';

const stats = { requests: 3, failed: 1, bytes: 100 };
const page = (url: string, title = 'T'): Page => ({ kind: 'html', url, title, srcDoc: '<p>x</p>', stats });
const run = (state: BrowserState, ...actions: Parameters<typeof reducer>[1][]) => actions.reduce(reducer, state);
const urls = (state: BrowserState, id = state.active) => state.tabs.find((t) => t.id === id)!.history.map((e: Entry) => e.url);

describe('browser state', () => {
  it('starts with one tab on the start page, or a tab per address', () => {
    const empty = initialState();
    expect(empty.tabs).toHaveLength(1);
    expect(empty.tabs[0]).toMatchObject({ status: 'start', index: -1, history: [] });
    const two = initialState(['http://a.test/', 'http://b.test/']);
    expect(two.tabs.map((t) => t.status)).toEqual(['loading', 'loading']);
    expect(two.active).toBe(1);
  });

  it('navigating pushes an entry and drops the forward history', () => {
    let s = initialState();
    s = run(s, { type: 'navigate', id: 1, entry: { url: 'http://a.test/' } }, { type: 'navigate', id: 1, entry: { url: 'http://b.test/' } }, { type: 'navigate', id: 1, entry: { url: 'http://c.test/' } });
    expect(urls(s)).toEqual(['http://a.test/', 'http://b.test/', 'http://c.test/']);
    s = run(s, { type: 'go', id: 1, delta: -1 }, { type: 'go', id: 1, delta: -1 });
    expect(s.tabs[0].index).toBe(0);
    s = run(s, { type: 'navigate', id: 1, entry: { url: 'http://d.test/' } });
    expect(urls(s)).toEqual(['http://a.test/', 'http://d.test/']);
  });

  it('going back past the first entry is the start page, and forward returns to it', () => {
    let s = run(initialState(), { type: 'navigate', id: 1, entry: { url: 'http://a.test/' } });
    s = run(s, { type: 'loaded', id: 1, seq: 1, page: page('http://a.test/') }, { type: 'go', id: 1, delta: -1 });
    expect(s.tabs[0]).toMatchObject({ status: 'start', index: -1, page: null });
    s = run(s, { type: 'go', id: 1, delta: -1 });
    expect(s.tabs[0].index).toBe(-1); // nowhere further back
    s = run(s, { type: 'go', id: 1, delta: 1 });
    expect(s.tabs[0]).toMatchObject({ status: 'loading', index: 0 });
    s = run(s, { type: 'go', id: 1, delta: 1 });
    expect(s.tabs[0].index).toBe(0); // nowhere further forward
  });

  it('answers only for the navigation it started with', () => {
    let s = run(initialState(), { type: 'navigate', id: 1, entry: { url: 'http://a.test/' } }); // seq 1
    s = run(s, { type: 'navigate', id: 1, entry: { url: 'http://b.test/' } }); // seq 2
    const stale = run(s, { type: 'loaded', id: 1, seq: 1, page: page('http://a.test/') });
    expect(stale).toBe(s);
    expect(run(s, { type: 'failed', id: 1, seq: 1, error: new LoadError('unreachable', 'x') })).toBe(s);
    const fresh = run(s, { type: 'loaded', id: 1, seq: 2, page: page('http://b.test/') });
    expect(fresh.tabs[0]).toMatchObject({ status: 'ready' });
  });

  it('takes the address a page ended up at (after redirects) and its title into the history', () => {
    let s = run(initialState(), { type: 'navigate', id: 1, entry: { url: 'http://old.test/' } });
    s = run(s, { type: 'loaded', id: 1, seq: 1, page: page('http://new.test/', 'New') });
    expect(s.tabs[0].history[0]).toEqual({ url: 'http://new.test/', title: 'New' });
  });

  it('adds up what was loaded, and counts a failed page as a failed request', () => {
    let s = run(initialState(), { type: 'navigate', id: 1, entry: { url: 'http://a.test/' } });
    s = run(s, { type: 'loaded', id: 1, seq: 1, page: page('http://a.test/') });
    expect(s.totals).toEqual({ requests: 3, failed: 1, bytes: 100, pages: 1 });
    s = run(s, { type: 'navigate', id: 1, entry: { url: 'http://b.test/' } }, { type: 'failed', id: 1, seq: 2, error: new LoadError('status', 'nope', 404) });
    expect(s.totals).toEqual({ requests: 4, failed: 2, bytes: 100, pages: 1 });
    expect(s.tabs[0]).toMatchObject({ status: 'error', page: null });
  });

  it('opens tabs (foreground or background), selects them, and closing picks a neighbour', () => {
    let s = run(initialState(), { type: 'new-tab', entry: { url: 'http://b.test/' } }, { type: 'new-tab', entry: { url: 'http://c.test/' }, background: true });
    expect(s.tabs.map((t) => t.id)).toEqual([1, 2, 3]);
    expect(s.active).toBe(2); // the background tab did not take over
    s = run(s, { type: 'close-tab', id: 2 });
    expect(s.active).toBe(3);
    s = run(s, { type: 'select-tab', id: 1 }, { type: 'select-tab', id: 99 });
    expect(s.active).toBe(1);
  });

  it('closing the last tab leaves a fresh start page, never none', () => {
    const s = run(initialState(['http://a.test/']), { type: 'close-tab', id: 1 });
    expect(s.tabs).toHaveLength(1);
    expect(s.tabs[0]).toMatchObject({ status: 'start' });
    expect(s.tabs[0].id).not.toBe(1);
    expect(s.active).toBe(s.tabs[0].id);
  });

  it('reload reloads the same entry; stop ends a load without losing the page', () => {
    let s = run(initialState(), { type: 'navigate', id: 1, entry: { url: 'http://a.test/', method: 'POST', body: 'x=1' } });
    s = run(s, { type: 'loaded', id: 1, seq: 1, page: page('http://a.test/') });
    s = run(s, { type: 'reload', id: 1 });
    expect(s.tabs[0]).toMatchObject({ status: 'loading', seq: 2 });
    expect(s.tabs[0].history[0]).toMatchObject({ method: 'POST', body: 'x=1' }); // a reload re-sends the form
    s = run(s, { type: 'stop', id: 1 });
    expect(s.tabs[0].status).toBe('ready');
    expect(s.tabs[0].page).not.toBeNull();
    expect(run(initialState(), { type: 'reload', id: 1 }).tabs[0].status).toBe('start'); // nothing to reload
  });

  it('retries a tab that failed only for being offline when the connection comes up, and leaves other errors alone', () => {
    let s = initialState(['http://a.test/', 'http://b.test/']);
    s = run(s,
      { type: 'failed', id: 1, seq: 1, error: new LoadError('offline', 'Tailscale is not connected.') },
      { type: 'failed', id: 2, seq: 1, error: new LoadError('status', 'nope', 404) });
    s = run(s, { type: 'retry-offline' });
    expect(s.tabs[0]).toMatchObject({ status: 'loading', seq: 2, error: null });
    expect(s.tabs[1]).toMatchObject({ status: 'error', seq: 1 });
    expect(run(s, { type: 'retry-offline' }).tabs[1]).toMatchObject({ status: 'error' }); // nothing left to retry
  });
});

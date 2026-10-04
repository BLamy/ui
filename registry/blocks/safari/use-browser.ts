/* The browser's state: tabs, each with its own history, and the loads in flight. A tab with no history shows the start
   page. A navigation pushes an entry and bumps the tab's `seq`; the load for that `seq` runs in an effect and its answer
   is dropped if the tab has moved on (back, another address, close). Going back or forward loads the entry again: this is
   a client with no cache, so what you see is always what the tailnet says now. */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { LoadError, loadPage, type Fetcher, type LoadStats, type Page } from './loader';

export interface Entry {
  url: string;
  method?: 'GET' | 'POST';
  /** A urlencoded form body, for a POST. */
  body?: string;
  /** The title once it is known, for History and the tab overview. */
  title?: string;
}

export type TabStatus = 'start' | 'loading' | 'ready' | 'error';

export interface Tab {
  id: number;
  history: Entry[];
  index: number;
  /** Bumped by every navigation and reload: a load answers only for the `seq` it started with. */
  seq: number;
  status: TabStatus;
  /** The page shown (the previous one stays up while the next loads). */
  page: Page | null;
  error: LoadError | Error | null;
}

export interface Totals {
  requests: number;
  failed: number;
  bytes: number;
  pages: number;
}

export interface BrowserState {
  tabs: Tab[];
  active: number;
  nextId: number;
  totals: Totals;
}

type Action =
  | { type: 'new-tab'; entry?: Entry; background?: boolean }
  | { type: 'close-tab'; id: number }
  | { type: 'select-tab'; id: number }
  | { type: 'navigate'; id: number; entry: Entry }
  | { type: 'go'; id: number; delta: number }
  | { type: 'reload'; id: number }
  | { type: 'stop'; id: number }
  /** The connection came up: a tab that failed only for being offline tries again. */
  | { type: 'retry-offline' }
  | { type: 'loaded'; id: number; seq: number; page: Page }
  | { type: 'failed'; id: number; seq: number; error: Error };

const blank = (id: number, entry?: Entry): Tab =>
  entry
    ? { id, history: [entry], index: 0, seq: 1, status: 'loading', page: null, error: null }
    : { id, history: [], index: -1, seq: 0, status: 'start', page: null, error: null };

export function initialState(urls: readonly string[] = []): BrowserState {
  const tabs = (urls.length ? urls : [undefined]).map((url, i) => blank(i + 1, url ? { url } : undefined));
  return { tabs, active: tabs[0].id, nextId: tabs.length + 1, totals: { requests: 0, failed: 0, bytes: 0, pages: 0 } };
}

const addStats = (t: Totals, s: LoadStats, page = 0): Totals => ({ requests: t.requests + s.requests, failed: t.failed + s.failed, bytes: t.bytes + s.bytes, pages: t.pages + page });
const patch = (state: BrowserState, id: number, fn: (tab: Tab) => Tab): BrowserState => ({ ...state, tabs: state.tabs.map((t) => (t.id === id ? fn(t) : t)) });

export function reducer(state: BrowserState, action: Action): BrowserState {
  switch (action.type) {
    case 'new-tab': {
      const tab = blank(state.nextId, action.entry);
      return { ...state, tabs: [...state.tabs, tab], active: action.background ? state.active : tab.id, nextId: state.nextId + 1 };
    }
    case 'close-tab': {
      const i = state.tabs.findIndex((t) => t.id === action.id);
      if (i < 0) return state;
      if (state.tabs.length === 1) return { ...state, tabs: [blank(state.nextId)], active: state.nextId, nextId: state.nextId + 1 };
      const tabs = state.tabs.filter((t) => t.id !== action.id);
      return { ...state, tabs, active: state.active === action.id ? tabs[Math.min(i, tabs.length - 1)].id : state.active };
    }
    case 'select-tab':
      return state.tabs.some((t) => t.id === action.id) ? { ...state, active: action.id } : state;
    case 'navigate':
      return patch(state, action.id, (t) => ({
        ...t,
        history: [...t.history.slice(0, t.index + 1), action.entry],
        index: t.index + 1,
        seq: t.seq + 1,
        status: 'loading',
        error: null,
      }));
    case 'go':
      return patch(state, action.id, (t) => {
        const index = t.index + action.delta;
        if (index < -1 || index >= t.history.length) return t;
        // Back past the first entry is the start page again.
        return index < 0 ? { ...t, index: -1, seq: t.seq + 1, status: 'start', page: null, error: null } : { ...t, index, seq: t.seq + 1, status: 'loading', error: null };
      });
    case 'reload':
      return patch(state, action.id, (t) => (t.index < 0 ? t : { ...t, seq: t.seq + 1, status: 'loading', error: null }));
    case 'stop':
      return patch(state, action.id, (t) => (t.status === 'loading' ? { ...t, seq: t.seq + 1, status: t.page ? 'ready' : t.index < 0 ? 'start' : 'error', error: t.page ? null : new LoadError('unreachable', 'Stopped.') } : t));
    case 'retry-offline':
      if (!state.tabs.some((t) => t.status === 'error' && t.error instanceof LoadError && t.error.reason === 'offline')) return state;
      return { ...state, tabs: state.tabs.map((t) => (t.status === 'error' && t.error instanceof LoadError && t.error.reason === 'offline' ? { ...t, seq: t.seq + 1, status: 'loading' as const, error: null } : t)) };
    case 'loaded': {
      const tab = state.tabs.find((t) => t.id === action.id);
      if (!tab || tab.seq !== action.seq) return state;
      const next = patch(state, action.id, (t) => ({
        ...t,
        status: 'ready',
        page: action.page,
        error: null,
        // The entry takes the address the page ended up at (after redirects) and its title.
        history: t.history.map((e, i) => (i === t.index ? { ...e, url: action.page.url, title: action.page.title } : e)),
      }));
      return { ...next, totals: addStats(state.totals, action.page.stats, 1) };
    }
    case 'failed': {
      const tab = state.tabs.find((t) => t.id === action.id);
      if (!tab || tab.seq !== action.seq) return state;
      const next = patch(state, action.id, (t) => ({ ...t, status: 'error', error: action.error, page: null }));
      return { ...next, totals: addStats(state.totals, { requests: 1, failed: 1, bytes: 0 }) };
    }
  }
}

export interface UseBrowserOptions {
  fetcher: Fetcher;
  /** Make requests only while true (while Tailscale is connected). A tab that is waiting to load waits, with no request sent, and
      goes when this turns true; one that failed for being offline tries again. Default true. */
  enabled?: boolean;
  /** Addresses to open in tabs at the start; none: one tab on the start page. */
  initialUrls?: readonly string[];
  /** Awaited before each page is fetched (the tab shows loading meanwhile): Safari selects an exit node here. A rejection is ignored; the load goes on. */
  prepare?: (entry: Entry) => Promise<unknown> | void;
}

export interface Browser {
  state: BrowserState;
  tab: Tab;
  navigate(entry: Entry | string, options?: { id?: number }): void;
  openTab(entry?: Entry | string, options?: { background?: boolean }): void;
  closeTab(id: number): void;
  selectTab(id: number): void;
  back(): void;
  forward(): void;
  reload(): void;
  stop(): void;
  canGoBack: boolean;
  canGoForward: boolean;
}

const asEntry = (e: Entry | string): Entry => (typeof e === 'string' ? { url: e } : e);

export function useBrowser({ fetcher, initialUrls, enabled = true, prepare }: UseBrowserOptions): Browser {
  const [state, dispatch] = useReducer(reducer, initialUrls, initialState);
  const prepareRef = useRef(prepare);
  prepareRef.current = prepare;
  const inflight = useRef(new Map<number, { seq: number; ctrl: AbortController }>());

  useEffect(() => {
    if (enabled) dispatch({ type: 'retry-offline' });
  }, [enabled]);

  // Start the load a tab is waiting for, cancel the ones that were superseded.
  useEffect(() => {
    if (!enabled) {
      // Not connected: nothing is in flight and nothing starts; loads resume when `enabled` turns true.
      inflight.current.forEach(({ ctrl }) => ctrl.abort());
      inflight.current.clear();
      return;
    }
    const live = new Set<number>();
    for (const tab of state.tabs) {
      live.add(tab.id);
      const current = inflight.current.get(tab.id);
      if (tab.status !== 'loading') {
        if (current) {
          current.ctrl.abort();
          inflight.current.delete(tab.id);
        }
        continue;
      }
      if (current?.seq === tab.seq) continue;
      current?.ctrl.abort();
      const ctrl = new AbortController();
      inflight.current.set(tab.id, { seq: tab.seq, ctrl });
      const entry = tab.history[tab.index];
      const { id, seq } = tab;
      Promise.resolve()
        .then(() => prepareRef.current?.(entry))
        .catch(() => undefined)
        .then(() => (ctrl.signal.aborted ? null : loadPage(entry.url, fetcher, { method: entry.method, body: entry.body, signal: ctrl.signal })))
        .then(
          (page) => { if (page && !ctrl.signal.aborted) dispatch({ type: 'loaded', id, seq, page }); },
          (error) => { if (!ctrl.signal.aborted) dispatch({ type: 'failed', id, seq, error }); },
        );
    }
    for (const [id, { ctrl }] of inflight.current) {
      if (!live.has(id)) {
        ctrl.abort();
        inflight.current.delete(id);
      }
    }
  }, [state.tabs, fetcher, enabled]);

  // Unmounting (and StrictMode's pretend unmount) cancels everything; the effect above starts what is still wanted.
  useEffect(() => () => {
    inflight.current.forEach(({ ctrl }) => ctrl.abort());
    inflight.current.clear();
  }, []);

  const tab = state.tabs.find((t) => t.id === state.active) ?? state.tabs[0];
  const navigate = useCallback((entry: Entry | string, options?: { id?: number }) => dispatch({ type: 'navigate', id: options?.id ?? state.active, entry: asEntry(entry) }), [state.active]);
  const openTab = useCallback((entry?: Entry | string, options?: { background?: boolean }) => dispatch({ type: 'new-tab', entry: entry ? asEntry(entry) : undefined, background: options?.background }), []);
  const closeTab = useCallback((id: number) => dispatch({ type: 'close-tab', id }), []);
  const selectTab = useCallback((id: number) => dispatch({ type: 'select-tab', id }), []);
  const back = useCallback(() => dispatch({ type: 'go', id: state.active, delta: -1 }), [state.active]);
  const forward = useCallback(() => dispatch({ type: 'go', id: state.active, delta: 1 }), [state.active]);
  const reload = useCallback(() => dispatch({ type: 'reload', id: state.active }), [state.active]);
  const stop = useCallback(() => dispatch({ type: 'stop', id: state.active }), [state.active]);

  return {
    state, tab, navigate, openTab, closeTab, selectTab, back, forward, reload, stop,
    canGoBack: tab.index >= 0,
    canGoForward: tab.index < tab.history.length - 1,
  };
}

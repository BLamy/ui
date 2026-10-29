/* Safari — a browser that only browses through your tailnet.
   Opening it shows a gate: nothing works until Tailscale is connected (a saved session is restored without a prompt),
   and signing out brings the gate back. Behind it, a tabbed browser: back, forward, an address field with suggestions
   from your tailnet's devices and your history, reload and stop, a tab strip and a tab overview, and a start page of
   your devices with a report of what was loaded.

   Pages run. Safari registers the tailnet router (lib/tailscale-router, `tailscale-sw.js` served from your site's root) with a
   `proxyPath`, and opens each page in a frame at `<your site>/__tailnet/<scheme>/<host>/<path>`: the service worker serves
   the document (the one Safari just fetched through `tailscale.fetch`) and then routes every request the page makes — its
   scripts' fetches, its relative URLs, its images, fonts and stylesheets — through the tailnet. A script the worker puts first
   in the page gives it its own path back (`location.pathname` is the site's), keeps links and forms inside the proxy and
   tells Safari where the page went, so the address bar and history follow it. What it cannot change: the page runs on your
   site's origin, so it can read this page's storage (the Tailscale session included), `location.host` is yours, cookies are
   not kept, and WebSockets are not routed. Where no service worker can run (no HTTPS, a private window, tests) pages fall
   back to sealed documents: scripts removed, assets inlined, nothing able to reach out (loader.ts).

   It uses the real Tailscale: Tailscale's own client (Go, as WebAssembly, loaded when someone presses sign in) and the
   real sign-in page, which opens in a popup. The device lives for the tab (sessionStorage). Pass `tailscale` for other
   options (a Headscale server, `localStorage`, an auth key) or a `controller` you made yourself. data.ts has a simulated
   tailnet for stories and tests; it is never the default.

   A tailnet alone reaches your devices. To browse the public internet, an exit node carries the traffic (and the DNS lookups
   for public names). Safari picks one for you: opening a public address with none set selects the best online exit node
   (the one used last, else the first by name) and then loads the page. The shield menu (core TailscaleMenu) can change or
   clear it; choosing "None: your devices only" is remembered, and then a public address shows why it fails, and Try Again
   turns an exit node back on. Try Again also swaps an offline or failing exit node for another online one. With no online
   exit node a public address fails with an explanation. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useContainerSize } from '@/lib/container';
import { AppearanceProvider, BLProvider, useAppearance, type Appearance } from '@/lib/theme';
import { webStorageTailscalePersistence, type Tailscale, type TailscaleOptions } from '@/lib/tailscale';
import { createTailscaleConnectClient } from '@/lib/tailscale-connect';
import type { TailscaleResponse } from '@/lib/tailscale';
import { TailscaleProvider, useTailscale } from '@/lib/tailscale-react';
import { useTailscaleRouter } from '@/lib/tailscale-router/react';
import type { TailscaleRoutedRequest } from '@/lib/tailscale-router/bridge';
import { exitNodesFor } from './exit-node';
import { Gate } from './gate';
import { parseAddress, tailnetFetcher } from './loader';
import { Toolbar, TabOverview, TabStrip } from './toolbar';
import { useBrowser } from './use-browser';
import { ErrorView, PageView, StartPage, type NavigateOptions } from './views';
import wasmURL from './wasm-url';

export interface SafariProps {
  /** Light or dark. Defaults to the ambient AppearanceProvider, else light. */
  appearance?: Appearance;
  /** The options for the controller Safari creates. Default: Tailscale's real client, with this tab as the device (see `tailnetOptions`). */
  tailscale?: TailscaleOptions;
  /** A controller you made (and perhaps signed in) yourself. Takes precedence over `tailscale`. */
  controller?: Tailscale;
  /** Addresses to open in tabs at the start. Default: one tab on the start page. */
  initialUrls?: string[];
}

/** The default: the real Tailscale. The WebAssembly client loads on the first sign-in; the sign-in page is Tailscale's own (a popup);
    the node's keys are kept in sessionStorage, so a reload keeps the session and closing the tab drops the device. */
export function tailnetOptions(): TailscaleOptions {
  return {
    client: () => createTailscaleConnectClient({ wasmURL }),
    hostname: 'safari',
    persistence: typeof sessionStorage === 'undefined' ? undefined : webStorageTailscalePersistence(sessionStorage, 'safari-tailscale'),
    lockName: 'safari',
  };
}

export { exitNodesFor };

/** Where pages run, under the router's scope: `<scope>__tailnet/https/example.com/`. */
const PROXY_PATH = '__tailnet/';

/** Narrower than this the tab strip steps aside for the tab overview. */
const COMPACT_W = 560;

function Browser({ initialUrls }: { initialUrls?: string[] }) {
  // Subscribes to the connection: the gate is shown whenever it is not `connected`.
  const tailscale = useTailscale();
  const snapshot = tailscale.getSnapshot();
  const connected = snapshot.status === 'connected';
  const fetcher = useMemo(() => tailnetFetcher(tailscale), [tailscale]);
  const urls = useMemo(() => initialUrls?.map((u) => parseAddress(u) ?? u), [initialUrls]);
  // The exit node is chosen for you when a public site needs one (see exit-node.ts); the menu can still change or clear it.
  const exitNodes = useMemo(() => exitNodesFor(tailscale), [tailscale]);
  const prepare = useCallback((entry: { url: string }) => exitNodes.prepare(entry.url), [exitNodes]);
  // Documents Safari fetched and is about to open in a frame: the router serves the frame these instead of fetching again.
  const documents = useRef(new Map<string, TailscaleResponse>());
  const respond = useCallback((req: TailscaleRoutedRequest) => {
    if (req.destination !== 'iframe' && req.destination !== 'document') return null;
    const key = req.url.split('#')[0];
    const doc = documents.current.get(key) ?? null;
    documents.current.delete(key);
    return doc;
  }, []);
  const router = useTailscaleRouter({ policy: { proxyPath: PROXY_PATH }, respond, unregisterOnDispose: true });
  const proxy = useMemo(() => (router.status === 'active' && typeof document !== 'undefined' ? { scope: new URL('./', document.baseURI).href, path: PROXY_PATH } : undefined), [router.status]);
  const browser = useBrowser({ fetcher, initialUrls: urls, enabled: connected, prepare, proxy });
  // Hand each newly loaded document over once (a page object is new per load), before its frame asks for it.
  const handedOver = useRef(new WeakSet<object>());
  for (const t of browser.state.tabs) {
    if (t.page?.kind !== 'live' || handedOver.current.has(t.page.document)) continue;
    handedOver.current.add(t.page.document);
    documents.current.set(t.page.url.split('#')[0], t.page.document);
  }
  useEffect(() => { if (!connected) exitNodes.reset(); }, [connected, exitNodes]);
  const [overview, setOverview] = useState(false);
  const [sizeRef, size] = useContainerSize<HTMLDivElement>();
  const addressRef = useRef<HTMLInputElement>(null);
  const compact = size.width < COMPACT_W;
  const { tab } = browser;
  const entry = tab.history[tab.index];
  const history = useMemo(() => browser.state.tabs.flatMap((t) => t.history), [browser.state.tabs]);

  /** The menu: choose an exit node, or None (remembered: nothing is picked for you again until Try Again). Choosing one reloads a failed page. */
  const chooseExitNode = async (id: string | null) => {
    await exitNodes.choose(id);
    if (id && browser.tab.status === 'error') browser.reload();
  };

  /** Try Again: when the failure is about the exit node (a public site with none, or one that is offline or failing), pick one first. */
  const retry = async () => {
    await exitNodes.retry(entry?.url ?? '', tab.error);
    browser.reload();
  };

  const open = (next: Parameters<typeof browser.navigate>[0], options?: NavigateOptions) => {
    if (options?.newTab) browser.openTab(next, { background: true });
    else browser.navigate(next);
    setOverview(false);
  };

  return (
    <div
      ref={sizeRef}
      data-slot="safari"
      data-status={snapshot.status}
      className="absolute inset-0 flex flex-col"
      onKeyDown={(e) => {
        if (!(e.metaKey || e.ctrlKey)) return;
        if (e.key === 'l') { e.preventDefault(); addressRef.current?.focus(); }
        else if (e.key === 'r') { e.preventDefault(); browser.reload(); }
        else if (e.key === '[') { e.preventDefault(); browser.back(); }
        else if (e.key === ']') { e.preventDefault(); browser.forward(); }
      }}
    >
      {/* Behind the gate nothing can be reached by pointer, keyboard or screen reader. */}
      <div inert={!connected} aria-hidden={!connected} className="relative flex min-h-0 flex-1 flex-col">
        <Toolbar browser={browser} snapshot={snapshot} history={history} totals={browser.state.totals} inputRef={addressRef} overview={overview} onOverview={() => setOverview((o) => !o)} compact={compact} onExitNode={chooseExitNode} />
        {!compact && browser.state.tabs.length > 1 ? <TabStrip browser={browser} /> : null}
        <main className="relative min-h-0 flex-1 bg-background" aria-busy={tab.status === 'loading'}>
          {tab.status === 'start' ? <StartPage snapshot={snapshot} history={history} totals={browser.state.totals} onOpen={open} />
            : tab.status === 'error' ? <ErrorView error={tab.error} address={entry?.url ?? ''} snapshot={snapshot} optedOut={exitNodes.optedOut} onRetry={retry} />
            : tab.page ? <PageView page={tab.page} onNavigate={open} onVisit={(url, title) => browser.visited(tab.id, url, title)} />
            : null}
          {overview ? <TabOverview browser={browser} onDone={() => setOverview(false)} /> : null}
        </main>
      </div>
      {!connected ? <Gate /> : null}
    </div>
  );
}

export default function Safari({ appearance, tailscale, controller, initialUrls }: SafariProps) {
  const ambient = useAppearance();
  const dark = (appearance ?? ambient) === 'dark';
  // The real tailnet is the default, made once per mount; pass `tailscale` or `controller` to use your own.
  const [real] = useState(() => (controller || tailscale ? null : tailnetOptions()));
  return (
    <AppearanceProvider value={dark ? 'dark' : 'light'}>
      <BLProvider className="bg-background">
        <TailscaleProvider tailscale={controller} options={tailscale ?? real ?? undefined}>
          <Browser initialUrls={initialUrls} />
        </TailscaleProvider>
      </BLProvider>
    </AppearanceProvider>
  );
}

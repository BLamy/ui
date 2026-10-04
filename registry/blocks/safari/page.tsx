/* Safari — a browser that only browses through your tailnet.
   Opening it shows a gate: nothing works until Tailscale is connected (a saved session is restored without a prompt),
   and signing out brings the gate back. Behind it, a tabbed browser: back, forward, an address field with suggestions
   from your tailnet's devices and your history, reload and stop, a tab strip and a tab overview, and a start page of
   your devices with a report of what was loaded.

   Every page, stylesheet, image and form goes through `tailscale.fetch`, which never falls back to the public network
   (see loader.ts). Pages are shown as sealed documents — scripts, frames and plug-ins removed, assets inlined, the frame
   under a Content-Security-Policy that forbids any request of its own — so a page cannot reach out around the tailnet.
   That makes this a document browser, not an app runtime: pages that need JavaScript show what they have without it.

   It uses the real Tailscale: Tailscale's own client (Go, as WebAssembly, loaded when someone presses sign in) and the
   real sign-in page, which opens in a popup. The device lives for the tab (sessionStorage). Pass `tailscale` for other
   options (a Headscale server, `localStorage`, an auth key) or a `controller` you made yourself. data.ts has a simulated
   tailnet for stories and tests; it is never the default.

   A tailnet alone reaches your devices. To browse the public internet, choose an exit node in the shield menu: all
   traffic, and the DNS lookups for public names, then go through that device. Without one a public address fails. */
import { useMemo, useRef, useState } from 'react';
import { useContainerSize } from '@/lib/container';
import { AppearanceProvider, BLProvider, useAppearance, type Appearance } from '@/lib/theme';
import { webStorageTailscalePersistence, type Tailscale, type TailscaleOptions } from '@/lib/tailscale';
import { createTailscaleConnectClient } from '@/lib/tailscale-connect';
import { TailscaleProvider, useTailscale } from '@/lib/tailscale-react';
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

/** Narrower than this the tab strip steps aside for the tab overview. */
const COMPACT_W = 560;

function Browser({ initialUrls }: { initialUrls?: string[] }) {
  // Subscribes to the connection: the gate is shown whenever it is not `connected`.
  const tailscale = useTailscale();
  const snapshot = tailscale.getSnapshot();
  const connected = snapshot.status === 'connected';
  const fetcher = useMemo(() => tailnetFetcher(tailscale), [tailscale]);
  const urls = useMemo(() => initialUrls?.map((u) => parseAddress(u) ?? u), [initialUrls]);
  const browser = useBrowser({ fetcher, initialUrls: urls, enabled: connected });
  const [overview, setOverview] = useState(false);
  const [sizeRef, size] = useContainerSize<HTMLDivElement>();
  const addressRef = useRef<HTMLInputElement>(null);
  const compact = size.width < COMPACT_W;
  const { tab } = browser;
  const entry = tab.history[tab.index];
  const history = useMemo(() => browser.state.tabs.flatMap((t) => t.history), [browser.state.tabs]);

  /** Choose (or drop) the exit node. Choosing one reloads the page, which is usually why it was chosen. */
  const chooseExitNode = async (id: string | null) => {
    await tailscale.setExitNode(id);
    if (id && browser.tab.status === 'error') browser.reload();
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
            : tab.status === 'error' ? <ErrorView error={tab.error} address={entry?.url ?? ''} snapshot={snapshot} onRetry={browser.reload} onExitNode={chooseExitNode} />
            : tab.page ? <PageView page={tab.page} onNavigate={open} />
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

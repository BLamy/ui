/* What fills the window: a page in its sealed frame, the start page, an error page. */
import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/format-bytes';
import { Icon } from '@/lib/icon';
import type { TailscalePeer, TailscaleSnapshot } from '@/lib/tailscale';
import { exitNodeName } from '@/lib/tailscale-exit';
import { cn } from '@/lib/utils';
import { exitNodeProblem, publicHostOf, type ExitNodeProblem } from './exit-node';
import { describeError, displayAddress, hostOf, type Page } from './loader';
import type { Entry, Totals } from './use-browser';

export interface NavigateOptions {
  /** Open it in a new tab (⌘-click, middle click). */
  newTab?: boolean;
}

/** The frame's rules. `allow-same-origin` lets this page read the frame's document to catch link clicks and form
    submissions; the frame itself can run no script (no `allow-scripts`, and the document's CSP is `default-src 'none'`),
    open nothing (no popups, no top navigation), and fetch nothing: every address in it was fetched by the page already. */
const FRAME_SANDBOX = 'allow-same-origin allow-forms';

/** A fetched page. Links and forms are caught here and become navigations of the browser, so they are fetched through
    the tailnet like everything else; the frame is never allowed to navigate itself. */
export function PageView({ page, onNavigate }: { page: Page; onNavigate: (entry: Entry, options?: NavigateOptions) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);

  const attach = () => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    const open = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href], area[href]');
      if (!link) return;
      e.preventDefault();
      const href = link.getAttribute('href') ?? '';
      if (!/^https?:\/\//i.test(href)) return;
      const to = new URL(href);
      const here = new URL(page.url);
      if (to.hash && to.href.split('#')[0] === here.href.split('#')[0]) {
        doc.getElementById(decodeURIComponent(to.hash.slice(1)))?.scrollIntoView();
        return;
      }
      onNavigate({ url: to.href }, { newTab: e.metaKey || e.ctrlKey || e.button === 1 });
    };
    doc.addEventListener('click', open, true);
    doc.addEventListener('auxclick', open, true);
    doc.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const action = new URL(form.getAttribute('action') || page.url, page.url);
      const data = new URLSearchParams();
      new FormData(form).forEach((value, key) => { if (typeof value === 'string') data.append(key, value); });
      if (form.method.toLowerCase() === 'post') onNavigate({ url: action.href, method: 'POST', body: data.toString() });
      else {
        action.search = data.toString();
        onNavigate({ url: action.href });
      }
    }, true);
  };

  if (page.kind === 'html') {
    return (
      <iframe
        ref={frame}
        key={`${page.url}:${page.srcDoc.length}`}
        title={page.title}
        srcDoc={page.srcDoc}
        sandbox={FRAME_SANDBOX}
        referrerPolicy="no-referrer"
        onLoad={attach}
        data-slot="safari-frame"
        className="size-full border-0 bg-white"
      />
    );
  }
  if (page.kind === 'image') {
    return (
      <div className="grid size-full place-items-center overflow-auto bg-secondary p-6">
        <img src={page.src} alt={page.title} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  if (page.kind === 'text') {
    return (
      <div className="bl-scroll size-full overflow-auto bg-background">
        <pre data-slot="safari-text" className="m-0 p-4 font-mono text-footnote leading-[1.5] break-words whitespace-pre-wrap text-foreground select-text">{page.text}</pre>
      </div>
    );
  }
  return (
    <Message icon="doc" title="Safari can’t display this file" detail={`${page.title} is ${page.contentType}, ${formatBytes(page.size)}. It was fetched through your tailnet, but there is nothing here that can show it.`} />
  );
}

function Message({ icon, title, detail, children }: { icon: 'doc' | 'exclamation-circle' | 'lock-fill'; title: string; detail: string; children?: ReactNode }) {
  return (
    <div className="grid size-full place-items-center overflow-auto bg-background p-8">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <Icon name={icon} size={44} className="text-foreground/70" />
        <h1 className="m-0 text-title font-bold tracking-[-.4px]">{title}</h1>
        <p className="m-0 text-subhead text-foreground/70">{detail}</p>
        {children}
      </div>
    </div>
  );
}

/** What an error page says. A public site that needs an exit node is explained in terms of the exit node: there is none to use,
    you chose none, or the one in use is offline or failing. Anything else is the loader's own message. */
export function describeFailure(error: Error | null, address: string, snapshot: TailscaleSnapshot, optedOut: boolean): { title: string; detail: string; problem: ExitNodeProblem | null } {
  const generic = describeError(error);
  const problem = exitNodeProblem(snapshot, address, error);
  const host = publicHostOf(address);
  const others = snapshot.peers.filter((p) => p.exitNode && p.id && p.online && p.id !== snapshot.exitNodeId);
  if (problem === 'none' && host) {
    const exits = snapshot.peers.filter((p) => p.exitNode && p.id);
    const detail = optedOut
      ? 'It is on the public internet, and you chose to use your devices only. Try Again turns an exit node back on.'
      : exits.some((p) => p.online)
        ? 'It is on the public internet, so it needs an exit node. Try Again chooses one.'
        : exits.length
          ? 'It is on the public internet, so it needs an exit node, and every exit node on your tailnet is offline. Try Again when one is back.'
          : 'It is on the public internet. Safari only goes through your tailnet, so it can reach it only through an exit node, and your tailnet has none. Offer one with tailscale set --advertise-exit-node on a device, and approve it in the admin console.';
    return { title: `${host} is not on your tailnet`, detail, problem };
  }
  if ((problem === 'offline' || problem === 'failing') && host) {
    const name = snapshot.peers.find((p) => p.id === snapshot.exitNodeId);
    const via = name ? exitNodeName(name) : 'The exit node';
    return {
      title: `Safari can’t reach ${host}`,
      detail: `${problem === 'offline' ? `${via} is offline.` : `It could not be reached through ${via}.`} ${others.length ? 'Try Again switches to another exit node.' : 'No other exit node is online.'}`,
      problem,
    };
  }
  return { ...generic, problem };
}

export function ErrorView({ error, address, snapshot, optedOut = false, onRetry }: {
  error: Error | null;
  address: string;
  snapshot: TailscaleSnapshot;
  /** The person chose "None: your devices only" in the menu. */
  optedOut?: boolean;
  /** Try Again. When the failure is about the exit node it picks one first (the button shows "Connecting…" meanwhile), then loads again. */
  onRetry: () => void | Promise<void>;
}) {
  const { title, detail, problem } = describeFailure(error, address, snapshot, optedOut);
  const [busy, setBusy] = useState<'connecting' | 'reloading' | null>(null);
  return (
    <Message icon={error && 'reason' in error && error.reason === 'offline' ? 'lock-fill' : 'exclamation-circle'} title={title} detail={detail}>
      {address ? <code className="max-w-full truncate rounded-ctl bg-secondary px-2 py-1 text-footnote text-foreground/70">{displayAddress(address)}</code> : null}
      <Button
        variant="secondary"
        isDisabled={busy !== null}
        aria-busy={busy !== null || undefined}
        onPress={() => {
          setBusy(problem ? 'connecting' : 'reloading');
          Promise.resolve(onRetry()).finally(() => setBusy(null));
        }}
      >
        {busy === 'connecting' ? 'Connecting…' : 'Try Again'}
      </Button>
    </Message>
  );
}

/* ── the start page ── */

const peerHost = (p: TailscalePeer) => p.name.replace(/\.$/, '');
const initialOf = (host: string) => (host.split('.')[0]?.[0] ?? '?').toUpperCase();
const labelOf = (host: string) => {
  const first = host.split('.')[0] ?? host;
  return first.charAt(0).toUpperCase() + first.slice(1);
};

export function StartPage({ snapshot, history, totals, onOpen }: {
  snapshot: TailscaleSnapshot;
  history: Entry[];
  totals: Totals;
  onOpen: (entry: Entry, options?: NavigateOptions) => void;
}) {
  const peers = snapshot.peers.filter((p) => peerHost(p));
  const recent = [...new Map(history.slice().reverse().map((e) => [e.url, e])).values()].slice(0, 5);
  return (
    <div data-slot="safari-start" className="bl-scroll size-full overflow-auto bg-background">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
        <section aria-labelledby="safari-favorites" className="flex flex-col gap-3">
          <h2 id="safari-favorites" className="m-0 text-footnote font-semibold tracking-wide text-foreground/70 uppercase">Devices on {snapshot.tailnet ?? 'your tailnet'}</h2>
          {peers.length ? (
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-3 p-0">
              {peers.map((p) => {
                const host = peerHost(p);
                return (
                  <li key={host} className="contents">
                    <Button variant="ghost" onPress={() => onOpen({ url: `http://${host}/` })} aria-label={`${labelOf(host)}, ${host}`}
                      className="h-auto flex-col gap-1.5 rounded-card p-2 text-foreground">
                      <span className="grid size-14 place-items-center rounded-card bg-secondary text-title font-semibold">{initialOf(host)}</span>
                      <span className="max-w-full truncate text-footnote">{labelOf(host)}</span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="m-0 text-subhead text-foreground/70">No other devices yet. Type an address above to open one by name or by its 100.x address.</p>
          )}
        </section>

        {recent.length ? (
          <section aria-labelledby="safari-recent" className="flex flex-col gap-2">
            <h2 id="safari-recent" className="m-0 text-footnote font-semibold tracking-wide text-foreground/70 uppercase">Recently visited</h2>
            <ul className="m-0 flex list-none flex-col overflow-hidden rounded-panel bg-secondary p-0">
              {recent.map((e) => (
                <li key={e.url} className="contents">
                  <Button variant="ghost" onPress={() => onOpen({ url: e.url })} className="h-11 justify-start gap-3 rounded-none px-4 text-subhead font-normal text-foreground">
                    <Icon name="clock" size={18} className="shrink-0 text-foreground/70" />
                    <span className="min-w-0 truncate">{e.title || hostOf(e.url)}</span>
                    <span className="ml-auto min-w-0 truncate text-footnote text-foreground/70">{displayAddress(e.url)}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="safari-report" className="flex flex-col gap-3 rounded-panel bg-secondary p-4">
          <h2 id="safari-report" className="m-0 flex items-center gap-2 text-subhead font-semibold">
            <Icon name="shield-check-fill" size={20} className="text-primary" />
            Tailscale report
          </h2>
          <p className="m-0 text-footnote text-foreground/70">
            Everything Safari loaded in this window went through {snapshot.selfName ? <strong className="font-semibold text-foreground">{snapshot.selfName.replace(/\.$/, '')}</strong> : 'your tailnet'}. Nothing was requested outside it.{' '}
            {snapshot.exitNodeId
              ? <>Public sites go through the exit node <strong className="font-semibold text-foreground">{snapshot.peers.find((p) => p.id === snapshot.exitNodeId)?.name.split('.')[0] ?? snapshot.exitNodeId}</strong>.</>
              : 'No exit node is chosen, so only your devices can be reached; choose one in the shield menu to browse the public internet.'}
          </p>
          <dl className="m-0 grid grid-cols-3 gap-3 text-center">
            {([['Pages', totals.pages], ['Requests', totals.requests], ['Not loaded', totals.failed]] as const).map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 rounded-ctl bg-background p-2">
                <dd className={cn('m-0 text-title font-bold tabular-nums')}>{value}</dd>
                <dt className="text-caption text-foreground/70">{label}</dt>
              </div>
            ))}
          </dl>
          <p className="m-0 text-caption text-foreground/70">{formatBytes(totals.bytes) || '0 B'} received. “Not loaded” counts addresses off your tailnet and files that were too large or over the page’s budget.</p>
        </section>
      </div>
    </div>
  );
}

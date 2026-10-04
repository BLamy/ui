/* Safari's chrome: the toolbar (back, forward, address, reload, Tailscale, tabs), the tab strip and the tab overview. */
import { useId, useMemo, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { TailscaleMenu } from '@/components/ui/tailscale-menu';
import { Icon } from '@/lib/icon';
import type { TailscalePeer, TailscaleSnapshot } from '@/lib/tailscale';
import { cn } from '@/lib/utils';
import { displayAddress, hostOf, parseAddress } from './loader';
import type { Browser, Entry, Tab, Totals } from './use-browser';

const TABS_ICON = [{ r: [8.5, 8.5, 11.5, 11.5, 2.4] }, { d: 'M15.5 6.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h.5' }] as const;

const peerHost = (p: TailscalePeer) => p.name.replace(/\.$/, '');
const tabTitle = (tab: Tab) => {
  const entry = tab.history[tab.index];
  return tab.page?.title || entry?.title || (entry ? hostOf(entry.url) : 'Start Page');
};

/* ── the address field ── */

interface Suggestion {
  url: string;
  label: string;
  detail: string;
}

function suggestionsFor(text: string, peers: TailscalePeer[], history: Entry[]): Suggestion[] {
  const q = text.trim().toLowerCase();
  const all: Suggestion[] = [
    ...peers.map((p) => ({ url: `http://${peerHost(p)}/`, label: peerHost(p), detail: 'Device on your tailnet' })),
    ...[...new Map(history.slice().reverse().map((e) => [e.url, e])).values()].map((e) => ({ url: e.url, label: e.title || hostOf(e.url), detail: displayAddress(e.url) })),
  ];
  const seen = new Set<string>();
  return all
    .filter((s) => (!q || `${s.label} ${s.url}`.toLowerCase().includes(q)) && !seen.has(s.url) && seen.add(s.url))
    .slice(0, 6);
}

function AddressField({ browser, snapshot, history, inputRef }: { browser: Browser; snapshot: TailscaleSnapshot; history: Entry[]; inputRef: RefObject<HTMLInputElement | null> }) {
  const { tab } = browser;
  const entry = tab.history[tab.index];
  const listId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const [miss, setMiss] = useState(false);
  const editing = draft !== null;
  const shown = entry ? displayAddress(entry.url) : '';
  const suggestions = useMemo(() => (editing ? suggestionsFor(draft ?? '', snapshot.peers, history) : []), [editing, draft, snapshot.peers, history]);
  const open = editing && suggestions.length > 0;
  const loading = tab.status === 'loading';

  const finish = () => {
    setDraft(null);
    setActive(-1);
    inputRef.current?.blur();
  };

  const go = (text: string) => {
    const chosen = active >= 0 ? suggestions[active]?.url : null;
    const short = snapshot.peers.find((p) => peerHost(p).split('.')[0] === text.trim().toLowerCase());
    const url = chosen ?? parseAddress(text) ?? (short ? `http://${peerHost(short)}/` : null) ?? suggestionsFor(text, snapshot.peers, history)[0]?.url ?? null;
    if (!url) {
      setMiss(true);
      return;
    }
    setMiss(false);
    finish();
    browser.navigate(url);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    go(draft ?? shown);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!suggestions.length) return;
      e.preventDefault();
      setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % suggestions.length : (i <= 0 ? suggestions.length : i) - 1));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMiss(false);
      finish();
    }
  };

  return (
    <form onSubmit={onSubmit} role="search" aria-label="Address" className="relative mx-auto flex w-full max-w-xl min-w-0 flex-1">
      <div className={cn('flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg bg-secondary px-2.5 transition-shadow duration-spring-snappy ease-spring-snappy', editing && 'bg-background ring-[1.5px] ring-primary ring-inset', miss && 'ring-destructive')}>
        <Icon name={entry && tab.status !== 'error' ? 'lock-fill' : 'magnifyingglass'} size={13} className="shrink-0 text-foreground/70" />
        <input
          ref={inputRef}
          role="combobox"
          aria-label="Address or search"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={miss || undefined}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Search or enter a tailnet address"
          value={editing ? draft ?? '' : shown}
          onFocus={(e) => { setDraft(shown); setMiss(false); requestAnimationFrame(() => e.target.select()); }}
          onBlur={() => { setDraft(null); setActive(-1); }}
          onChange={(e) => { setDraft(e.target.value); setActive(-1); setMiss(false); }}
          onKeyDown={onKeyDown}
          className={cn('h-full min-w-0 flex-1 border-0 bg-transparent p-0 [font-family:inherit] text-subhead text-foreground outline-none select-text [-webkit-user-select:text] placeholder:text-foreground/60', !editing && 'text-center')}
        />
        {loading ? (
          <Button variant="quiet" size="icon" className="-mr-1 size-6 shrink-0 p-0" aria-label="Stop loading" onPress={browser.stop}>
            <Spinner spin size={14} />
          </Button>
        ) : (
          <Button variant="quiet" size="icon" className="-mr-1 size-6 shrink-0 p-0" aria-label="Reload page" isDisabled={tab.index < 0} onPress={browser.reload}>
            <Icon name="arrow-clockwise" size={14} />
          </Button>
        )}
      </div>
      {miss ? <p role="alert" className="absolute top-9 left-0 m-0 px-1 text-footnote text-foreground">Nothing on your tailnet matches that. Try a device name or an address.</p> : null}
      {open ? (
        <ul id={listId} role="listbox" aria-label="Suggestions" className="absolute top-9 right-0 left-0 z-20 m-0 flex list-none flex-col gap-0.5 rounded-xl bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-border">
          {suggestions.map((s, i) => (
            <li
              key={s.url}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Press, not click: the input's blur would close the list before a click lands.
              onMouseDown={(e) => { e.preventDefault(); setActive(i); setDraft(s.url); finish(); browser.navigate(s.url); }}
              className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-subhead', i === active && 'bg-primary text-primary-foreground')}
            >
              <Icon name="globe" size={16} className="shrink-0" />
              <span className="min-w-0 truncate">{s.label}</span>
              <span className={cn('ml-auto min-w-0 truncate text-footnote', i === active ? 'text-primary-foreground' : 'text-foreground/70')}>{s.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

/* ── the toolbar ── */

export function Toolbar({ browser, snapshot, history, totals, inputRef, overview, onOverview, compact, onExitNode }: {
  browser: Browser;
  snapshot: TailscaleSnapshot;
  onExitNode: (id: string | null) => Promise<void>;
  history: Entry[];
  totals: Totals;
  inputRef: RefObject<HTMLInputElement | null>;
  overview: boolean;
  onOverview: () => void;
  compact: boolean;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div data-slot="safari-toolbar" className="flex h-12 shrink-0 items-center gap-1.5 bg-bar px-3 shadow-hairline-b">
      <Button variant="quiet" size="icon" className="size-8" aria-label="Back" isDisabled={!browser.canGoBack} onPress={browser.back}><Icon name="chevron-left" size={18} /></Button>
      <Button variant="quiet" size="icon" className="size-8" aria-label="Forward" isDisabled={!browser.canGoForward} onPress={browser.forward}><Icon name="chevron-right" size={18} /></Button>
      <AddressField browser={browser} snapshot={snapshot} history={history} inputRef={inputRef} />
      {/* Closed whenever the connection is not up: the popover is portaled outside the inert browser, and would float over the gate. */}
      <PopoverTrigger isOpen={menu && snapshot.status === 'connected'} onOpenChange={setMenu}>
        <Button variant="quiet" size="icon" className="size-8" aria-label="Tailscale connection"><Icon name="shield-check-fill" size={18} className="text-primary" /></Button>
        <PopoverContent aria-label="Tailscale connection" placement="bottom end" className="w-80">
          <TailscaleMenu variant="radio" onExitNode={onExitNode} detail={`${totals.pages} pages and ${totals.requests} requests this session, all through Tailscale.`} />
        </PopoverContent>
      </PopoverTrigger>
      {!compact ? <Button variant="quiet" size="icon" className="size-8" aria-label="New tab" onPress={() => { browser.openTab(); requestAnimationFrame(() => inputRef.current?.focus()); }}><Icon name="plus" size={18} /></Button> : null}
      <Button variant="quiet" size="icon" active={overview} className="relative size-8" aria-label={`Show tab overview, ${browser.state.tabs.length} ${browser.state.tabs.length === 1 ? 'tab' : 'tabs'}`} aria-pressed={overview} onPress={onOverview}>
        <Icon shapes={TABS_ICON} size={18} />
        {browser.state.tabs.length > 1 ? <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-caption2 font-semibold text-primary-foreground">{browser.state.tabs.length}</span> : null}
      </Button>
    </div>
  );
}

/* ── the tab strip ── */

export function TabStrip({ browser }: { browser: Browser }) {
  const { tabs, active } = browser.state;
  return (
    <nav aria-label="Tabs" data-slot="safari-tabs" className="flex h-9 shrink-0 items-center gap-1 bg-bar px-2 shadow-hairline-b">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <div key={tab.id} className={cn('group/tab relative flex h-7 max-w-52 min-w-24 flex-1 items-center rounded-lg transition-colors duration-spring-snappy ease-spring-snappy', isActive ? 'bg-secondary' : 'hover:bg-secondary/60')}>
            <Button variant="quiet" aria-current={isActive ? 'page' : undefined} onPress={() => browser.selectTab(tab.id)} className="h-7 min-w-0 flex-1 justify-start gap-1.5 rounded-lg bg-transparent px-2.5 pr-7 text-footnote font-normal text-foreground data-hovered:bg-transparent">
              {tab.status === 'loading' ? <Spinner spin size={12} /> : <Icon name="globe" size={12} className="shrink-0 text-foreground/70" />}
              <span className="min-w-0 truncate">{tabTitle(tab)}</span>
            </Button>
            <Button variant="quiet" size="icon" className="absolute top-1 right-1 size-5 p-0 opacity-0 group-focus-within/tab:opacity-100 group-hover/tab:opacity-100" aria-label={`Close ${tabTitle(tab)}`} onPress={() => browser.closeTab(tab.id)}>
              <Icon name="xmark" size={10} />
            </Button>
          </div>
        );
      })}
    </nav>
  );
}

/* ── the tab overview ── */

export function TabOverview({ browser, onDone }: { browser: Browser; onDone: () => void }) {
  const { tabs, active } = browser.state;
  return (
    <div data-slot="safari-overview" className="bl-scroll absolute inset-0 z-10 overflow-auto bg-secondary p-4">
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3 p-0">
        {tabs.map((tab) => (
          <li key={tab.id} className="relative">
            <Button variant="ghost" aria-current={tab.id === active ? 'page' : undefined} onPress={() => { browser.selectTab(tab.id); onDone(); }}
              className={cn('h-28 w-full flex-col items-start justify-end gap-0.5 rounded-card bg-background p-3 pr-9 text-left font-normal text-foreground', tab.id === active && 'ring-2 ring-primary')}>
              <span className="w-full min-w-0 truncate text-subhead font-semibold">{tabTitle(tab)}</span>
              <span className="w-full min-w-0 truncate text-footnote text-foreground/70">{tab.history[tab.index] ? displayAddress(tab.history[tab.index].url) : 'Start Page'}</span>
            </Button>
            <Button variant="quiet" size="icon" className="absolute top-2 right-2 size-6 p-0" aria-label={`Close ${tabTitle(tab)}`} onPress={() => browser.closeTab(tab.id)}><Icon name="xmark" size={12} /></Button>
          </li>
        ))}
        <li>
          <Button variant="ghost" onPress={() => { browser.openTab(); onDone(); }} className="h-28 w-full flex-col gap-1 rounded-card bg-background/60 text-foreground">
            <Icon name="plus" size={22} />
            <span className="text-footnote">New Tab</span>
          </Button>
        </li>
      </ul>
    </div>
  );
}

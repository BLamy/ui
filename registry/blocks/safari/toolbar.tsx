/* Safari's chrome: the toolbar (back, forward, address, reload, Tailscale, tabs), the tab strip and the tab overview. */
import { useMemo, useState, type FormEvent, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox';
import { HoverCard, HoverCardContent, HoverCardHeader, HoverCardTrigger } from '@/components/ui/hover-card';
import { Toggle } from '@/components/ui/toggle';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { TailscaleExitNodes, TailscaleLoginButton, TailscaleSummary } from '@/components/ui/tailscale-controls';
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

/** The address field: UI SDK's Combobox over the tailnet's devices and your history. Typing filters the suggestions,
 *  the arrows move through them and Enter opens the one highlighted; with none highlighted, Enter opens what you typed
 *  (an address, a device's short name, or the best suggestion). Escape puts the current address back. The suggestions
 *  show once you press the field, type or arrow in it: focus that only lands there (the gate lifting, ⌘L) lists nothing
 *  over the page, as Safari's own field does. */
function AddressField({ browser, snapshot, history, inputRef }: { browser: Browser; snapshot: TailscaleSnapshot; history: Entry[]; inputRef: RefObject<HTMLInputElement | null> }) {
  const { tab } = browser;
  const entry = tab.history[tab.index];
  const [draft, setDraft] = useState<string | null>(null);
  const [miss, setMiss] = useState(false);
  // Whether the suggestions may show: the field was pressed, typed or arrowed in since it took focus.
  const [listing, setListing] = useState(false);
  // The pill the suggestions hang from and match in width.
  const [pill, setPill] = useState<HTMLDivElement | null>(null);
  const editing = draft !== null;
  const shown = entry ? displayAddress(entry.url) : '';
  const suggestions = useMemo(() => (editing ? suggestionsFor(draft ?? '', snapshot.peers, history) : []), [editing, draft, snapshot.peers, history]);
  const open = editing && listing && suggestions.length > 0;
  const loading = tab.status === 'loading';

  const finish = () => {
    setDraft(null);
    inputRef.current?.blur();
  };

  const go = (text: string) => {
    const short = snapshot.peers.find((p) => peerHost(p).split('.')[0] === text.trim().toLowerCase());
    const url = parseAddress(text) ?? (short ? `http://${peerHost(short)}/` : null) ?? suggestionsFor(text, snapshot.peers, history)[0]?.url ?? null;
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

  return (
    <form onSubmit={onSubmit} role="search" aria-label="Address" className="relative mx-auto flex w-full max-w-xl min-w-0 flex-1">
      <Combobox
        // The text is the field's own; the list is what suggestionsFor found, as given.
        query={editing ? draft ?? '' : shown}
        onQueryChange={(q, details) => { if (details.reason === 'input-change') { setDraft(q); setMiss(false); setListing(true); } }}
        open={open}
        value={null}
        onValueChange={(url) => { if (url) go(url); }}
        filter={false}
      >
        <div ref={setPill} className={cn('flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg bg-secondary px-2.5 transition-shadow duration-spring-snappy ease-spring-snappy', editing && 'bg-background ring-[1.5px] ring-primary ring-inset', miss && 'ring-destructive')}>
          <Icon name={entry && tab.status !== 'error' ? 'lock-fill' : 'magnifyingglass'} size={13} className="shrink-0 text-foreground/70" />
          <ComboboxInput
            ref={inputRef}
            aria-label="Address or search"
            aria-invalid={miss || undefined}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Search or enter a tailnet address"
            onFocus={(e) => { setDraft(shown); setMiss(false); requestAnimationFrame(() => e.target.select()); }}
            onBlur={() => { setDraft(null); setListing(false); }}
            onPointerDown={() => setListing(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') setListing(true);
              if (e.key === 'Escape') { e.preventDefault(); setMiss(false); finish(); }
              // Enter with a suggestion highlighted opens it (the combobox's choice); with none, what was typed.
              else if (e.key === 'Enter' && !e.currentTarget.getAttribute('aria-activedescendant')) { e.preventDefault(); go(e.currentTarget.value); }
            }}
            // The kit's ComboboxInput is bare: the pill around it is this toolbar's own field.
            className={cn('text-subhead placeholder:text-foreground/60', !editing && 'text-center')}
          />
          {loading ? (
            <Button variant="quiet" size="icon" className="-mr-1 size-6 shrink-0 p-0" aria-label="Stop loading" onClick={browser.stop}>
              <Spinner size={14} />
            </Button>
          ) : (
            <Button variant="quiet" size="icon" className="-mr-1 size-6 shrink-0 p-0" aria-label="Reload page" disabled={tab.index < 0} onClick={browser.reload}>
              <Icon name="arrow-clockwise" size={14} />
            </Button>
          )}
        </div>
        <ComboboxContent anchor={pill} sideOffset={4}>
          <ComboboxList aria-label="Suggestions">
            {suggestions.map((s) => (
              <ComboboxItem key={s.url} value={s.url} label={s.label} icon={<Icon name="globe" size={16} />} description={s.detail}>
                {s.label}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {miss ? <p role="alert" className="absolute top-9 left-0 m-0 px-1 text-footnote text-foreground">Nothing on your tailnet matches that. Try a device name or an address.</p> : null}
    </form>
  );
}

export function Toolbar({ browser, snapshot, history, totals, inputRef, overview, onOverviewChange, compact, onExitNode }: {
  browser: Browser;
  snapshot: TailscaleSnapshot;
  onExitNode: (id: string | null) => Promise<void>;
  history: Entry[];
  totals: Totals;
  inputRef: RefObject<HTMLInputElement | null>;
  overview: boolean;
  onOverviewChange: (open: boolean) => void;
  compact: boolean;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div data-slot="safari-toolbar" className="flex h-12 shrink-0 items-center gap-1.5 bg-bar px-3 shadow-hairline-b">
      <Button variant="quiet" size="icon" className="size-8" aria-label="Back" disabled={!browser.canGoBack} onClick={browser.back}><Icon name="chevron-left" size={18} /></Button>
      <Button variant="quiet" size="icon" className="size-8" aria-label="Forward" disabled={!browser.canGoForward} onClick={browser.forward}><Icon name="chevron-right" size={18} /></Button>
      <AddressField browser={browser} snapshot={snapshot} history={history} inputRef={inputRef} />
      {/* Closed whenever the connection is not up: the popover is portaled outside the inert browser, and would float over the gate. */}
      <Popover open={menu && snapshot.status === 'connected'} onOpenChange={setMenu}>
        <PopoverTrigger render={<Button variant="quiet" size="icon" className="size-8" aria-label="Tailscale connection" />}>
          <Icon name="shield-check-fill" size={18} className="text-primary" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <PopoverTitle className="sr-only">Tailscale connection</PopoverTitle>
          <div className="flex flex-col gap-3">
            <TailscaleSummary description={`${totals.pages} pages and ${totals.requests} requests this session, all through Tailscale.`} />
            <TailscaleExitNodes onAction={onExitNode} />
            <TailscaleLoginButton size="sm" variant="outline" />
          </div>
        </PopoverContent>
      </Popover>
      {!compact ? <Button variant="quiet" size="icon" className="size-8" aria-label="New tab" onClick={() => { browser.openTab(); requestAnimationFrame(() => inputRef.current?.focus()); }}><Icon name="plus" size={18} /></Button> : null}
      {/* Pressed while the overview is up. */}
      <Toggle variant="quiet" size="icon" pressed={overview} onPressedChange={onOverviewChange} className="relative size-8" aria-label={`Show tab overview, ${browser.state.tabs.length} ${browser.state.tabs.length === 1 ? 'tab' : 'tabs'}`}>
        <Icon shapes={TABS_ICON} size={18} />
        {browser.state.tabs.length > 1 ? <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-caption2 font-semibold text-primary-foreground">{browser.state.tabs.length}</span> : null}
      </Toggle>
    </div>
  );
}

/* ── the tab strip ── */

const TAB_STATUS: Record<Tab['status'], string> = { start: 'Start Page', loading: 'Loading…', ready: 'Loaded through your tailnet', error: 'Couldn’t be loaded' };

/** A tab's hover card, like Safari's tab preview: its title, full address, how it loaded and how far back its history goes —
    enough to tell two tabs with the same title apart. */
function TabCard({ tab }: { tab: Tab }) {
  const entry = tab.history[tab.index];
  const back = tab.index;
  return (
    <div className="flex flex-col gap-2">
      <HoverCardHeader
        icon={<span aria-hidden="true" className="grid size-9 place-items-center rounded-ctl bg-secondary text-foreground/70"><Icon name="globe" size={18} /></span>}
        title={tabTitle(tab)}
        description={entry ? hostOf(entry.url) : 'New tab'}
      />
      {entry ? <code className="block truncate rounded-ctl bg-secondary px-2 py-1 text-caption text-foreground/70 select-text">{displayAddress(entry.url)}</code> : null}
      <p className="m-0 text-footnote text-muted-foreground">
        {TAB_STATUS[tab.status]}{back > 0 ? ` · ${back} ${back === 1 ? 'page' : 'pages'} back` : ''}
      </p>
    </div>
  );
}

export function TabStrip({ browser }: { browser: Browser }) {
  const { tabs, active } = browser.state;
  return (
    <nav aria-label="Tabs" data-slot="safari-tabs" className="flex h-9 shrink-0 items-center gap-1 bg-bar px-2 shadow-hairline-b">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <div key={tab.id} className={cn('group/tab relative flex h-7 max-w-52 min-w-24 flex-1 items-center rounded-lg transition-colors duration-spring-snappy ease-spring-snappy', isActive ? 'bg-secondary' : 'hover:bg-secondary/60')}>
            <HoverCard>
              <HoverCardTrigger render={<Button variant="quiet" aria-current={isActive ? 'page' : undefined} onClick={() => browser.selectTab(tab.id)} className="h-7 min-w-0 flex-1 justify-start gap-1.5 rounded-lg bg-transparent px-2.5 pr-7 text-footnote font-normal text-foreground hover:bg-transparent" />}>
                {tab.status === 'loading' ? <Spinner size={12} /> : <Icon name="globe" size={12} className="shrink-0 text-foreground/70" />}
                <span className="min-w-0 truncate">{tabTitle(tab)}</span>
              </HoverCardTrigger>
              <HoverCardContent side="bottom" align="start"><TabCard tab={tab} /></HoverCardContent>
            </HoverCard>
            <Button variant="quiet" size="icon" className="absolute top-1 right-1 size-5 p-0 opacity-0 group-focus-within/tab:opacity-100 group-hover/tab:opacity-100" aria-label={`Close ${tabTitle(tab)}`} onClick={() => browser.closeTab(tab.id)}>
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
            <Button variant="ghost" aria-current={tab.id === active ? 'page' : undefined} onClick={() => { browser.selectTab(tab.id); onDone(); }}
              className={cn('h-28 w-full flex-col items-start justify-end gap-0.5 rounded-card bg-background p-3 pr-9 text-left font-normal text-foreground', tab.id === active && 'ring-2 ring-primary')}>
              <span className="w-full min-w-0 truncate text-subhead font-semibold">{tabTitle(tab)}</span>
              <span className="w-full min-w-0 truncate text-footnote text-foreground/70">{tab.history[tab.index] ? displayAddress(tab.history[tab.index].url) : 'Start Page'}</span>
            </Button>
            <Button variant="quiet" size="icon" className="absolute top-2 right-2 size-6 p-0" aria-label={`Close ${tabTitle(tab)}`} onClick={() => browser.closeTab(tab.id)}><Icon name="xmark" size={12} /></Button>
          </li>
        ))}
        <li>
          <Button variant="ghost" onClick={() => { browser.openTab(); onDone(); }} className="h-28 w-full flex-col gap-1 rounded-card bg-background/60 text-foreground">
            <Icon name="plus" size={22} />
            <span className="text-footnote">New Tab</span>
          </Button>
        </li>
      </ul>
    </div>
  );
}

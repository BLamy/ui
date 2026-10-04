/* The menu bar's two network status items. Each is a button in the bar that opens a popover (the same Popover the Safari
   shield menu uses: arrow keys and Tab move, Esc closes and focus returns to the item).

   - Tailscale: the Tailscale mark (dim until connected, a green dot while an exit node carries the traffic). Connected, it
     opens the core TailscaleMenu in its `networks` variant, so exit nodes read like Wi-Fi networks; otherwise the sign-in.
     It reads the desktop's one Tailscale controller (see page.tsx), the same one the Safari window is given, so signing in
     or choosing an exit node in either shows in both.
   - Wi-Fi: a macOS-style menu (a switch, the network you are on, nearby ones with a lock and signal bars, Network Settings…).
     All of it is invented sample data and nothing connects to anything: turning it off only dims the glyph. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ListBox, ListBoxItem, ListBoxSection } from '@/components/ui/list-box';
import { PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { TailscaleLoginButton, TailscaleMark, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button';
import { TailscaleMenu, type TailscaleExitNodesProps } from '@/components/ui/tailscale-menu';
import { Icon } from '@/lib/icon';
import { tailscaleErrorMessage } from '@/lib/tailscale';
import { exitNodeName } from '@/lib/tailscale-exit';
import { useTailscale } from '@/lib/tailscale-react';
import { cn } from '@/lib/utils';
import { useDesktop } from './desktop';

/** A status item in the bar: a quiet button that takes the bar's own text colour, and shows it is open. */
const ITEM = '-m-1 rounded-md p-1 text-inherit data-hovered:bg-current/12 data-pressed:bg-current/20 aria-expanded:bg-current/20 data-focus-visible:ring-offset-0';

/** Which of the two menus is open when the bar mounts (stories, tests). */
export type StatusMenu = 'wifi' | 'tailscale';

/* ── signal ── */

/** The Wi-Fi glyph at a signal strength: `level` of the three arcs are drawn in full, the rest dimmed (0 is "off"). */
export function WifiBars({ level, size = 14, className }: { level: 0 | 1 | 2 | 3; size?: number; className?: string }) {
  const arcs = ['M9.6 15.7a3.6 3.6 0 0 1 4.8 0', 'M6.6 12.6a7.8 7.8 0 0 1 10.8 0', 'M3.6 9.4a12 12 0 0 1 16.8 0'];
  return (
    <svg data-slot="wifi-bars" data-level={level} aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={cn('shrink-0', className)}>
      {arcs.map((d, i) => <path key={d} d={d} opacity={i < level ? 1 : 0.3} />)}
      <circle cx={12} cy={18.6} r={0.9} fill="currentColor" stroke="none" opacity={level > 0 ? 1 : 0.3} />
    </svg>
  );
}

/* ── a network as a row ── */

/** One row of a network list: a leading check when it is the one in use (from the list's selection), the name, and a trailing glyph.
    The same list-box row the Tailscale menu's exit nodes use in its `networks` variant (TailscaleExitNodes, core). */
export function NetworkRow({ id, name, detail, glyph }: { id: string; name: string; detail?: ReactNode; glyph?: ReactNode }) {
  return (
    <ListBoxItem id={id} textValue={name} description={detail}>
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <span aria-hidden="true" className="flex shrink-0 items-center gap-1.5">{glyph}</span>
      </span>
    </ListBoxItem>
  );
}

/* ── Tailscale ── */

/** What an exit node's row ends with: the same signal glyph a Wi-Fi network has, a spinner while it is switched to, a warning when it is offline. */
const exitNodeGlyph: NonNullable<TailscaleExitNodesProps['glyph']> = (_peer, state) =>
  state.connecting ? <Spinner spin size={14} />
  : state.online ? <WifiBars level={3} className="text-foreground/70" />
  : <Icon name="exclamation-circle" size={14} className="text-foreground/70" />;

export function TailscaleStatusItem({ defaultOpen }: { defaultOpen?: boolean }) {
  const t = useTailscale();
  const snap = t.getSnapshot();
  const connected = snap.status === 'connected';
  const exit = snap.exitNodeId ? snap.peers.find((p) => p.id === snap.exitNodeId) : undefined;
  const label = connected ? `Tailscale, connected${exit ? `, exit node ${exitNodeName(exit)}` : ''}` : 'Tailscale, not connected';

  // The exit node is chosen through Safari's shared bookkeeping (loaded on demand: a desktop that never opens this menu
  // never loads Safari), so "None" here is remembered there and Safari does not pick one again behind it.
  const choose = async (id: string | null) => {
    const nodes = await import('../safari/page').then((m) => m.exitNodesFor(t), () => null);
    await (nodes ? nodes.choose(id) : t.setExitNode(id));
  };

  return (
    <PopoverTrigger defaultOpen={defaultOpen}>
      <Button variant="quiet" size="icon-sm" aria-label={label} className={ITEM}>
        <span className="relative grid">
          <TailscaleMark size={15} className={cn('transition-opacity duration-spring-snappy ease-spring-snappy motion-reduce:transition-none', !connected && 'opacity-45')} />
          {exit ? <span data-slot="macos-exit-node-dot" aria-hidden="true" className="absolute -top-px -right-px size-1.5 rounded-full bg-success" /> : null}
        </span>
      </Button>
      <PopoverContent aria-label="Tailscale" placement="bottom end" offset={6} className="w-72">
        {connected ? <TailscaleMenu variant="networks" onExitNode={choose} glyph={exitNodeGlyph} /> : <TailscaleSignIn />}
      </PopoverContent>
    </PopoverTrigger>
  );
}

/** What the menu holds until Tailscale is connected: the sign-in, and where it stands. */
function TailscaleSignIn() {
  const { status, error } = useTailscale().getSnapshot();
  return (
    <div data-slot="macos-tailscale-signin" className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-subhead font-semibold">Tailscale</span>
        <span className="text-footnote text-foreground/70">Not connected. Sign in to reach your tailnet and choose an exit node.</span>
      </div>
      <TailscaleLoginButton size="sm" className="w-full" />
      <TailscaleStatusBadge compact={status === 'error'} />
      {status === 'error' && error ? <p role="alert" className="m-0 text-footnote">{tailscaleErrorMessage(error)}</p> : null}
    </div>
  );
}

/* ── Wi-Fi ── */

interface Network { id: string; name: string; secure: boolean; bars: 1 | 2 | 3 }

/** Invented networks (the same ones System Settings lists). The first is the one this Mac is on. */
const MY_NETWORKS: Network[] = [
  { id: 'lamy-home', name: 'Lamy Home', secure: true, bars: 3 },
  { id: 'studio', name: 'Studio', secure: true, bars: 2 },
];
const OTHER_NETWORKS: Network[] = [
  { id: 'blue-bottle', name: 'Blue Bottle Guest', secure: false, bars: 2 },
  { id: 'pixel-palace', name: 'Pixel Palace', secure: true, bars: 1 },
  { id: 'netgear', name: 'NETGEAR-4F2C', secure: true, bars: 2 },
];
const ALL_NETWORKS = [...MY_NETWORKS, ...OTHER_NETWORKS];

/** How long joining a network shows "Connecting…". */
const JOIN_MS = 900;

function networkRow(n: Network, joining: string | null) {
  return (
    <NetworkRow
      key={n.id} id={n.id} name={n.name}
      detail={joining === n.id ? 'Connecting…' : undefined}
      glyph={joining === n.id ? <Spinner spin size={14} /> : (
        <>
          {n.secure ? <Icon name="lock-fill" size={12} className="text-foreground/70" /> : null}
          <WifiBars level={n.bars} className="text-foreground/70" />
        </>
      )}
    />
  );
}

export function WifiStatusItem({ defaultOpen }: { defaultOpen?: boolean }) {
  const desktop = useDesktop();
  const [on, setOn] = useState(true);
  const [joined, setJoined] = useState(MY_NETWORKS[0].id);
  const [joining, setJoining] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const network = ALL_NETWORKS.find((n) => n.id === joined) ?? MY_NETWORKS[0];

  const join = (id: string) => {
    if (joining || id === joined) return;
    setJoining(id);
    timer.current = setTimeout(() => { setJoined(id); setJoining(null); }, JOIN_MS);
  };

  return (
    <PopoverTrigger defaultOpen={defaultOpen}>
      <Button variant="quiet" size="icon-sm" aria-label={on ? `Wi-Fi, connected to ${network.name}` : 'Wi-Fi, off'} className={ITEM}>
        <WifiBars level={on ? network.bars : 0} size={15} />
      </Button>
      <PopoverContent aria-label="Wi-Fi" placement="bottom end" offset={6} className="w-72">
        {({ close }) => (
          <div data-slot="macos-wifi-menu" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-subhead font-semibold">Wi-Fi</span>
              {/* The switch is a phone's size; scaled to sit in a menu without taking the room it was made for. */}
              <span className="-my-1 inline-grid origin-right scale-75"><Switch checked={on} onChange={setOn} aria-label="Wi-Fi" /></span>
            </div>
            {on ? (
              <ListBox
                variant="popup"
                aria-label="Wi-Fi networks"
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[joining ?? joined]}
                onSelectionChange={(keys) => { const key = keys === 'all' ? undefined : [...keys][0]; if (key !== undefined) join(String(key)); }}
                className="max-h-72 p-0"
              >
                <ListBoxSection title="My Networks">{MY_NETWORKS.map((n) => networkRow(n, joining))}</ListBoxSection>
                <ListBoxSection title="Other Networks">{OTHER_NETWORKS.map((n) => networkRow(n, joining))}</ListBoxSection>
              </ListBox>
            ) : (
              <p className="m-0 text-footnote text-foreground/70">Wi-Fi is turned off. Turn it on to see the networks around you.</p>
            )}
            <Button variant="ghost" size="sm" className="justify-start px-2 font-normal" onPress={() => { desktop.open('settings'); close(); }}>
              Network Settings…
            </Button>
          </div>
        )}
      </PopoverContent>
    </PopoverTrigger>
  );
}

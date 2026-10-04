'use client';
import { useState, type ComponentProps, type ReactNode } from 'react';
import type { Key, Selection } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { ListBox, ListBoxItem } from '@/components/ui/list-box';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { TailscaleLoginButton } from '@/components/ui/tailscale-login-button';
import { Icon } from '@/lib/icon';
import type { Tailscale, TailscalePeer } from '@/lib/tailscale';
import { exitNodeName, exitNodePeers } from '@/lib/tailscale-exit';
import { useTailscale } from '@/lib/tailscale-react';
import { cn } from '@/lib/utils';

/* ══ TailscaleMenu — the connection, as a menu ══
   The content of a "Tailscale" popover or menu-bar extra: where you are connected (tailnet, this device), the exit node
   chooser, and sign out. It reads the nearest TailscaleProvider (or the `tailscale` you pass) and changes the exit node
   through `onExitNode` (default: `tailscale.setExitNode`).

   <PopoverContent aria-label="Tailscale"><TailscaleMenu variant="radio" onExitNode={choose} /></PopoverContent>   // Safari's shield
   <TailscaleMenu variant="networks" />                                                                          // like macOS's Wi-Fi menu

   `variant` is how the exit nodes read: `radio` is a radio list ("None: your devices only", then one radio per device);
   `networks` is a list of networks (a leading check for the one in use, the name, a trailing glyph, "Connecting…" while it
   is switched, offline devices dimmed and not selectable, and "None" at the top). The parts are exported to build your own. */

export const tailscaleMenuVariants = cva('flex flex-col', {
  variants: { variant: { radio: 'gap-3', networks: 'gap-2' } },
  defaultVariants: { variant: 'radio' },
});

export const tailscaleExitNodesVariants = cva('flex flex-col', {
  variants: { variant: { radio: 'gap-1.5', networks: 'gap-1' } },
  defaultVariants: { variant: 'radio' },
});

export type TailscaleMenuVariant = NonNullable<VariantProps<typeof tailscaleMenuVariants>['variant']>;

export interface TailscaleExitNodeLabels {
  /** The accessible name of the list. */
  group: string;
  /** The row that turns the exit node off. */
  none: string;
  /** Under the none row (`networks` only). */
  noneDetail: string;
  /** Marks an offline device: appended to its name in `radio`, its second line in `networks`. */
  offline: string;
  /** Shown on the row being switched to. */
  connecting: string;
  /** Instead of the list, when the tailnet has no exit node. */
  empty: ReactNode;
  /** When changing the exit node failed with something that has no message. */
  failed: string;
}

const LABELS: Record<TailscaleMenuVariant, TailscaleExitNodeLabels> = {
  radio: {
    group: 'Exit node',
    none: 'None: your devices only',
    noneDetail: '',
    offline: '(offline)',
    connecting: 'Connecting…',
    empty: <>No exit node on this tailnet, so only your devices can be reached. Offer one with <code>tailscale set --advertise-exit-node</code> and approve it in the admin console.</>,
    failed: 'Could not change the exit node.',
  },
  networks: {
    group: 'Exit node',
    none: 'None',
    noneDetail: 'Your devices only',
    offline: 'Offline',
    connecting: 'Connecting…',
    empty: <>No exit node on this tailnet, so only your devices can be reached. Offer one with <code>tailscale set --advertise-exit-node</code> and approve it in the admin console.</>,
    failed: 'Could not change the exit node.',
  },
};

/** What a `networks` row shows at its trailing edge. */
export interface TailscaleExitNodeState {
  /** It is the exit node in use. */
  active: boolean;
  /** It is being switched to. */
  connecting: boolean;
  online: boolean;
}

/** The default trailing glyph: a spinner while connecting, a warning when offline, the signal otherwise. */
function defaultGlyph(_peer: TailscalePeer, state: TailscaleExitNodeState): ReactNode {
  if (state.connecting) return <Spinner spin size={14} />;
  return <Icon name={state.online ? 'wifi' : 'exclamation-circle'} size={14} className="text-foreground/70" />;
}

export interface TailscaleExitNodesProps extends Omit<ComponentProps<'div'>, 'children' | 'onChange'>, VariantProps<typeof tailscaleExitNodesVariants> {
  /** Default: the provider's controller. */
  tailscale?: Tailscale;
  /** Called with the chosen id, or null for "None". Default: `tailscale.setExitNode`. A rejection shows under the list. */
  onExitNode?: (id: string | null) => Promise<void> | void;
  labels?: Partial<TailscaleExitNodeLabels>;
  /** `networks` only: the trailing glyph of a row. */
  glyph?: (peer: TailscalePeer, state: TailscaleExitNodeState) => ReactNode;
}

/** The exit node chooser: which device carries your traffic to the public internet. A react-aria RadioGroup (`radio`) or ListBox (`networks`); arrow keys move, a switch in progress is shown on its row. */
export function TailscaleExitNodes({ tailscale, onExitNode, variant: variantProp, labels: labelsProp, glyph = defaultGlyph, className, ...props }: TailscaleExitNodesProps) {
  const t = useTailscale(tailscale);
  const variant = variantProp ?? 'radio';
  const labels = { ...LABELS[variant], ...labelsProp };
  const { exitNodeId } = t.getSnapshot();
  const exits = exitNodePeers(t.getSnapshot());
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = pending !== null;

  if (!exits.length) {
    return <p data-slot="tailscale-exit-nodes" data-variant={variant} className={cn('m-0 text-footnote text-foreground/70', className)}>{labels.empty}</p>;
  }

  const choose = (value: string) => {
    if (busy || value === (exitNodeId ?? 'none')) return;
    setPending(value);
    setError(null);
    Promise.resolve()
      .then(() => (onExitNode ?? ((id: string | null) => t.setExitNode(id)))(value === 'none' ? null : value))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : labels.failed))
      .finally(() => setPending(null));
  };

  return (
    <div data-slot="tailscale-exit-nodes" data-variant={variant} aria-busy={busy || undefined} className={cn(tailscaleExitNodesVariants({ variant }), className)} {...props}>
      {variant === 'networks' ? (
        <ListBox
          variant="popup"
          aria-label={labels.group}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[exitNodeId ?? 'none']}
          onSelectionChange={(keys: Selection) => {
            const key: Key | undefined = keys === 'all' ? undefined : [...keys][0];
            if (key !== undefined) choose(String(key));
          }}
          className="max-h-60 p-0"
        >
          <ListBoxItem id="none" textValue={labels.none} description={pending === 'none' ? labels.connecting : labels.noneDetail || undefined}>
            {labels.none}
          </ListBoxItem>
          {exits.map((p) => {
            const state: TailscaleExitNodeState = { active: p.id === exitNodeId, connecting: p.id === pending, online: p.online };
            const name = exitNodeName(p);
            return (
              <ListBoxItem key={p.id} id={p.id as string} textValue={name} isDisabled={!p.online} description={state.connecting ? labels.connecting : p.online ? undefined : labels.offline}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span aria-hidden="true" className="grid shrink-0 place-items-center">{glyph(p, state)}</span>
                </span>
              </ListBoxItem>
            );
          })}
        </ListBox>
      ) : (
        <RadioGroup
          aria-label={labels.group}
          value={exitNodeId ?? 'none'}
          isDisabled={busy}
          onChange={choose}
          className="flex-col gap-1"
        >
          <Radio value="none">{labels.none}</Radio>
          {exits.map((p) => (
            <Radio key={p.id} value={p.id as string}>
              {exitNodeName(p)}{p.online ? '' : ` ${labels.offline}`}{p.id === pending ? <span className="text-foreground/70"> {labels.connecting}</span> : null}
            </Radio>
          ))}
        </RadioGroup>
      )}
      {error ? <p role="alert" className="m-0 text-footnote">{error}</p> : null}
    </div>
  );
}

export interface TailscaleMenuSummaryProps extends ComponentProps<'div'> {
  tailscale?: Tailscale;
}

/** "Connected to <tailnet>" and "As <this device>". */
export function TailscaleMenuSummary({ tailscale, className, ...props }: TailscaleMenuSummaryProps) {
  const { tailnet, selfName } = useTailscale(tailscale).getSnapshot();
  return (
    <div data-slot="tailscale-menu-summary" className={cn('flex flex-col gap-0.5', className)} {...props}>
      <span className="text-subhead font-semibold">Connected to {tailnet ?? 'your tailnet'}</span>
      <span className="text-footnote text-foreground/70">As {selfName?.replace(/\.$/, '') ?? 'this device'}</span>
    </div>
  );
}

export interface TailscaleMenuProps extends Omit<ComponentProps<'div'>, 'onChange'>, VariantProps<typeof tailscaleMenuVariants> {
  /** Default: the provider's controller. */
  tailscale?: Tailscale;
  /** Called with the chosen exit node id, or null for "None". Default: `tailscale.setExitNode`. */
  onExitNode?: (id: string | null) => Promise<void> | void;
  /** A line under the summary (Safari: how many pages and requests this session). */
  detail?: ReactNode;
  /** Shown above the exit nodes. Default "Exit node"; `null` hides the heading. */
  heading?: ReactNode;
  labels?: Partial<TailscaleExitNodeLabels>;
  glyph?: TailscaleExitNodesProps['glyph'];
  /** Show the exit node chooser. Default true. */
  exitNodes?: boolean;
  /** Show the "Sign out of Tailscale" button. Default true. */
  signOut?: boolean;
}

/** The connection summary, the exit node chooser and sign out, in one column. `children` go after the exit nodes. */
export function TailscaleMenu({ tailscale, onExitNode, variant: variantProp, detail, heading = 'Exit node', labels, glyph, exitNodes = true, signOut = true, className, children, ...props }: TailscaleMenuProps) {
  const t = useTailscale(tailscale);
  const variant = variantProp ?? 'radio';
  return (
    <div data-slot="tailscale-menu" data-variant={variant} className={cn(tailscaleMenuVariants({ variant }), className)} {...props}>
      <TailscaleMenuSummary tailscale={t} />
      {detail ? <p className="m-0 text-footnote text-foreground/70">{detail}</p> : null}
      {exitNodes ? (
        <div className="flex flex-col gap-1.5">
          {heading ? <span className="text-footnote font-semibold">{heading}</span> : null}
          <TailscaleExitNodes tailscale={t} variant={variant} onExitNode={onExitNode} labels={labels} glyph={glyph} />
        </div>
      ) : null}
      {children}
      {signOut ? <TailscaleLoginButton tailscale={t} size="sm" variant="outline" /> : null}
    </div>
  );
}

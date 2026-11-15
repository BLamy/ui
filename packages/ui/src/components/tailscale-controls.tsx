'use client';
import { useId, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Badge } from '@/components/ui/badge';
import { renderEmptyState } from '@/components/ui/empty-state';
import { Button, type ButtonProps } from '@/components/ui/button';
import type { ChangeDetails } from '@ui-sdk/core';
import type { ListboxValueChangeReason } from '@ui-sdk/react/listbox';
import { Listbox, ListboxItem } from '@/components/ui/listbox';
import { Spinner } from '@/components/ui/spinner';
import { Icon, type IconName } from '@/lib/icon';
import { tailscaleErrorMessage, type Tailscale, type TailscalePeer, type TailscaleSnapshot, type TailscaleStatus } from '@/lib/tailscale';
import { exitNodeName, exitNodePeers } from '@/lib/tailscale-exit';
import { useOptionalTailscale, useTailscale } from '@/lib/tailscale-react';
import { sectionLabelVariants } from '@/lib/primitives';
import { cn } from '@/lib/utils';

/* ══ Tailscale controls — the parts of a "Sign in with Tailscale" UI ══
   Every part reads the nearest TailscaleProvider (or the `tailscale` you pass); the login button, the badge and the
   summary also take a `status` (and the badge and summary a `tailnet`) to be driven without one, as the stories do.

   <TailscaleProvider options={…}>
     <TailscaleLoginButton />      // idle → signing in (press again to cancel) → connected (press to sign out) → error (press to retry)
     <TailscaleStatusBadge />      // the state in a word, the tailnet, and the sign-in link if the popup was blocked
   </TailscaleProvider>

   The connection panel (a popover or a menu-bar extra) is a composition of the same parts:

   <PopoverContent>
     <PopoverTitle className="sr-only">Tailscale</PopoverTitle>
     <TailscaleSummary detail="4 pages and 17 requests this session." />
     <TailscaleExitNodes onAction={choose} />
     <TailscaleLoginButton size="sm" variant="outline" />
   </PopoverContent> */

/** The nine-dot mark, drawn in currentColor (Tailscale's logo is a trademark of Tailscale Inc.; check their brand guidelines before shipping it). */
export function TailscaleMark({ className, size = 16 }: { className?: string; size?: number }) {
  const dim = new Set([0, 2, 6, 8]);
  return (
    <svg data-slot="tailscale-mark" aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className={cn('shrink-0', className)}>
      {Array.from({ length: 9 }, (_, i) => (
        <circle key={i} cx={4 + (i % 3) * 8} cy={4 + Math.floor(i / 3) * 8} r={2.6} fill="currentColor" opacity={dim.has(i) ? 0.3 : 1} />
      ))}
    </svg>
  );
}

function useSnapshot(t: Tailscale | null): TailscaleSnapshot | null {
  return useSyncExternalStore(
    t?.subscribe ?? noopSubscribe,
    t ? t.getSnapshot : nullSnapshot,
    t ? t.getServerSnapshot : nullSnapshot,
  );
}
const noopSubscribe = () => () => undefined;
const nullSnapshot = () => null;

/* ── login button ── */

type Phase = 'idle' | 'busy' | 'connected' | 'error';
const phaseOf = (status: TailscaleStatus): Phase =>
  status === 'connected' ? 'connected' : status === 'error' ? 'error' : status === 'idle' || status === 'needs-login' ? 'idle' : 'busy';

export interface TailscaleLoginButtonLabels {
  signIn: string;
  signingIn: string;
  connecting: string;
  approval: string;
  signOut: string;
  /** The visible label after a failure. */
  retry: string;
  /** The accessible name after a failure: it starts with `retry` and says what is retried. */
  retryName: string;
  /** Added to the accessible name while busy, because a press then cancels. */
  cancelHint: string;
}

const LOGIN_LABELS: TailscaleLoginButtonLabels = {
  signIn: 'Sign in with Tailscale',
  signingIn: 'Signing in…',
  connecting: 'Connecting…',
  approval: 'Waiting for approval…',
  signOut: 'Sign out of Tailscale',
  retry: 'Try again',
  retryName: 'Try again to sign in to Tailscale',
  cancelHint: 'Press to cancel.',
};

export interface TailscaleLoginButtonProps extends Omit<ButtonProps, 'children' | 'onClick'> {
  /** Default: the provider's controller. */
  tailscale?: Tailscale;
  /** Show this status instead of the controller's (stories, or a controller of your own). */
  status?: TailscaleStatus;
  /** Override what a press does in each state. Defaults call the controller: signIn, cancel, signOut, signIn. */
  onSignIn?: () => void;
  onCancel?: () => void;
  onSignOut?: () => void;
  labels?: Partial<TailscaleLoginButtonLabels>;
}

/** The kit's Button that signs in to Tailscale and shows where that stands. `variant` and `size` are Button's
    (default `contrast`, the usual "Sign in with …" look). Never colour alone: the label and the leading glyph change
    with the state (the mark, a spinner while busy, a warning after a failure). */
export function TailscaleLoginButton({ tailscale, status: statusProp, onSignIn, onCancel, onSignOut, labels: labelsProp, variant = 'contrast', ...props }: TailscaleLoginButtonProps) {
  const t = useOptionalTailscale(tailscale);
  const snap = useSnapshot(t);
  const status = statusProp ?? snap?.status ?? 'idle';
  const phase = phaseOf(status);
  const labels = { ...LOGIN_LABELS, ...labelsProp };
  const label =
    phase === 'connected' ? labels.signOut
    : phase === 'error' ? labels.retry
    : phase === 'idle' ? labels.signIn
    : status === 'needs-approval' ? labels.approval
    : status === 'starting' || status === 'loading' ? labels.connecting
    : labels.signingIn;
  const press = () => {
    if (phase === 'connected') (onSignOut ?? (() => void t?.signOut()))();
    else if (phase === 'busy') (onCancel ?? (() => t?.cancel()))();
    else (onSignIn ?? (() => void t?.signIn()))();
  };
  return (
    <Button
      data-status={status}
      // Busy is drawn like UI SDK's pending state, but it is not that state: a pending button ignores presses, and a
      // press here cancels.
      data-pending={phase === 'busy' ? '' : undefined}
      aria-busy={phase === 'busy' || undefined}
      aria-label={phase === 'busy' ? `${label} ${labels.cancelHint}` : phase === 'error' ? labels.retryName : undefined}
      variant={variant}
      onClick={press}
      {...props}
    >
      {phase === 'busy' ? <Spinner size={16} /> : phase === 'error' ? <Icon name="exclamation-circle" size={16} sw={2} className="text-destructive" /> : <TailscaleMark />}
      <span>{label}</span>
    </Button>
  );
}

/* ── status badge ── */

const BADGE: Record<TailscaleStatus, { label: string; icon: IconName | null; variant: ComponentProps<typeof Badge>['variant'] }> = {
  idle: { label: 'Not connected', icon: 'globe', variant: 'outline' },
  loading: { label: 'Loading', icon: null, variant: 'secondary' },
  'needs-login': { label: 'Signed out', icon: 'person', variant: 'outline' },
  'signing-in': { label: 'Signing in', icon: null, variant: 'secondary' },
  starting: { label: 'Connecting', icon: null, variant: 'secondary' },
  'needs-approval': { label: 'Needs approval', icon: 'shield-exclamation', variant: 'outline' },
  connected: { label: 'Connected', icon: 'check-circle-fill', variant: 'outline' },
  error: { label: 'Error', icon: 'exclamation-circle-fill', variant: 'outline' },
};

export const tailscaleStatusBadgeVariants = cva('inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-footnote', {
  variants: {
    variant: {
      /** The pill, then the details on the same line. */
      inline: '',
      /** The pill, with the details under it. */
      stacked: 'flex-col items-start',
      /** The pill alone (the details are left out). */
      pill: '',
    },
  },
  defaultVariants: { variant: 'inline' },
});

export interface TailscaleStatusBadgeProps extends Omit<ComponentProps<'div'>, 'children'>, VariantProps<typeof tailscaleStatusBadgeVariants> {
  tailscale?: Tailscale;
  /** Show this state instead of the controller's. */
  status?: TailscaleStatus;
  tailnet?: string | null;
  loginUrl?: string | null;
  /** The failure to show when `status` is `error` (default: the controller's error, in words). */
  error?: ReactNode;
}

/** The connection state as a pill with an icon and a word; with the details, the tailnet when connected, the error
    when failed, and a link to the sign-in page when no popup could open. A polite live region. */
export function TailscaleStatusBadge({ tailscale, status: statusProp, tailnet: tailnetProp, loginUrl: loginProp, error: errorProp, variant, className, ...props }: TailscaleStatusBadgeProps) {
  const t = useOptionalTailscale(tailscale);
  const snap = useSnapshot(t);
  const status = statusProp ?? snap?.status ?? 'idle';
  const s = BADGE[status];
  const tailnet = tailnetProp !== undefined ? tailnetProp : snap?.tailnet ?? null;
  const loginUrl = loginProp !== undefined ? loginProp : snap?.loginUrl ?? null;
  const error = errorProp ?? (snap?.error ? tailscaleErrorMessage(snap.error) : null);
  const details = variant !== 'pill';
  return (
    <div data-slot="tailscale-status-badge" data-status={status} role="status" className={cn(tailscaleStatusBadgeVariants({ variant }), className)} {...props}>
      <Badge variant={s.variant}>
        {s.icon ? <Icon name={s.icon} size={12} sw={2.2} /> : <Spinner size={12} />}
        {s.label}
      </Badge>
      {details && status === 'connected' && tailnet ? <span className="text-foreground/70">{tailnet}</span> : null}
      {details && status === 'error' && error ? <span className="text-foreground">{error}</span> : null}
      {details && status === 'needs-approval' ? <span className="text-foreground/70">An admin has to approve this device.</span> : null}
      {details && status === 'signing-in' && loginUrl ? (
        <a href={loginUrl} target="_blank" rel="noopener noreferrer" className="rounded-sm font-semibold text-foreground underline outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Continue to Tailscale
        </a>
      ) : null}
    </div>
  );
}

/* ── summary ── */

export interface TailscaleSummaryProps extends ComponentProps<'div'> {
  tailscale?: Tailscale;
  /** Show this state instead of the controller's. */
  status?: TailscaleStatus;
  /** The tailnet's name (default: the controller's). */
  tailnet?: string | null;
  /** This device's name on the tailnet (default: the controller's). */
  selfName?: string | null;
  /** A line under the summary (Safari: how many pages and requests this session). */
  detail?: ReactNode;
}

/** Where the connection stands, in words, over this device's name, and an optional line of your own: the head of a
    connection panel. "Connected to <tailnet>" when connected, "Connecting to <tailnet>" or "Waiting for approval"
    on the way, "Not connected" otherwise. Like the badge, it can be driven without a provider. */
export function TailscaleSummary({ tailscale, status: statusProp, tailnet: tailnetProp, selfName: selfProp, detail, className, ...props }: TailscaleSummaryProps) {
  const snap = useSnapshot(useOptionalTailscale(tailscale));
  const status = statusProp ?? snap?.status ?? 'idle';
  const tailnet = (tailnetProp !== undefined ? tailnetProp : snap?.tailnet) ?? 'your tailnet';
  const self = (selfProp !== undefined ? selfProp : snap?.selfName)?.replace(/\.$/, '');
  const phase = phaseOf(status);
  const head =
    phase === 'connected' ? `Connected to ${tailnet}`
    : status === 'needs-approval' ? 'Waiting for approval'
    : phase === 'busy' ? `Connecting to ${tailnet}`
    : 'Not connected';
  return (
    <div data-slot="tailscale-summary" data-status={status} className={cn('flex flex-col gap-0.5', className)} {...props}>
      <span className="text-subhead font-semibold">{head}</span>
      {phase === 'connected' || self ? <span className="text-footnote text-muted-foreground">As {self ?? 'this device'}</span> : null}
      {detail ? <p className="m-0 mt-1 text-footnote text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

/* ── exit nodes ── */

export interface TailscaleExitNodeLabels {
  /** The heading over the list, which also names it. */
  group: string;
  /** The row that turns the exit node off. */
  none: string;
  /** The second line of the none row. */
  noneDetail: string;
  /** The second line of an offline device. */
  offline: string;
  /** The second line of the row being switched to. */
  connecting: string;
  /** When changing the exit node failed with something that has no message. */
  failed: string;
}

const EXIT_LABELS: TailscaleExitNodeLabels = {
  group: 'Exit node',
  none: 'None',
  noneDetail: 'Your devices only',
  offline: 'Offline',
  connecting: 'Connecting…',
  failed: 'Could not change the exit node.',
};

/** What a row shows at its trailing edge. */
export interface TailscaleExitNodeState {
  /** It is the exit node in use. */
  selected: boolean;
  /** It is being switched to. */
  connecting: boolean;
  online: boolean;
}

/** The default trailing glyph: a spinner while connecting, a warning when offline, the signal otherwise. */
function defaultTrailing(_peer: TailscalePeer, state: TailscaleExitNodeState): ReactNode {
  if (state.connecting) return <Spinner size={14} />;
  return <Icon name={state.online ? 'wifi' : 'exclamation-circle'} size={14} className="text-muted-foreground" />;
}

const EXIT_EMPTY = {
  icon: <Icon name="globe" />,
  title: 'No exit node',
  description: <>Only your devices can be reached. Offer one with <code className="whitespace-nowrap">tailscale set --advertise-exit-node</code> and approve it in the admin console.</>,
};

export type TailscaleExitNodeChangeDetails = ChangeDetails<ListboxValueChangeReason>;

export interface TailscaleExitNodesProps extends Omit<ComponentProps<'div'>, 'children' | 'onChange' | 'defaultValue'> {
  /** Default: the provider's controller. */
  tailscale?: Tailscale;
  /** The exit node shown as chosen (an id, or null for None). Default: the controller's. */
  value?: string | null;
  /** Called first when a row is chosen, with its id (null for None). `details.cancel()` stops the switch. */
  onValueChange?: (value: string | null, details: TailscaleExitNodeChangeDetails) => void;
  /** Switches the exit node, with the same `details` as `onValueChange`. Default: `tailscale.setExitNode`. While its
      Promise runs the row shows "Connecting…"; a rejection shows under the list. */
  onAction?: (value: string | null, details: TailscaleExitNodeChangeDetails) => Promise<void> | void;
  labels?: Partial<TailscaleExitNodeLabels>;
  /** What a row shows at its trailing edge (default: a spinner while connecting, the signal or an offline warning). */
  trailing?: (peer: TailscalePeer, state: TailscaleExitNodeState) => ReactNode;
  /** Shown under the heading, in place of the list, when the tailnet offers no exit node. Default: a small
      `EmptyState` ("No exit node" and how to offer one); a string is its title; `null` shows nothing. */
  emptyState?: ReactNode;
}

/** The exit node chooser, like a Wi-Fi menu: which device carries your traffic to the public internet. A Listbox with
    None first, a check on the node in use, offline devices dimmed and not selectable. Arrow keys move without
    switching; a press, Space or Enter switches, and the switch in progress is shown on its row. */
export function TailscaleExitNodes({ tailscale, value: valueProp, onValueChange, onAction, labels: labelsProp, trailing = defaultTrailing, emptyState, className, ...props }: TailscaleExitNodesProps) {
  const t = useTailscale(tailscale);
  const labels = { ...EXIT_LABELS, ...labelsProp };
  const snap = t.getSnapshot();
  const value = valueProp !== undefined ? valueProp : snap.exitNodeId ?? null;
  const exits = exitNodePeers(snap);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingId = useId();
  const busy = pending !== null;

  const choose = (next: string | null, details: TailscaleExitNodeChangeDetails) => {
    if (next === null || busy || next === (value ?? 'none')) return;
    const id = next === 'none' ? null : next;
    onValueChange?.(id, details);
    if (details.canceled) return;
    setPending(next);
    setError(null);
    Promise.resolve()
      .then(() => (onAction ? onAction(id, details) : t.setExitNode(id)))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : labels.failed))
      .finally(() => setPending(null));
  };

  return (
    <div data-slot="tailscale-exit-nodes" data-empty={exits.length ? undefined : ''} aria-busy={busy || undefined} className={cn('flex flex-col gap-1.5', className)} {...props}>
      <span id={headingId} className={sectionLabelVariants({ variant: 'menu' })}>{labels.group}</span>
      {exits.length ? (
        <Listbox
          variant="popup"
          aria-labelledby={headingId}
          // Moving through the devices must not switch the exit node: only a press, Space or Enter does.
          activation="manual"
          value={value ?? 'none'}
          onValueChange={choose}
          className="max-h-60 p-0"
        >
          <ListboxItem value="none" label={labels.none} description={pending === 'none' ? labels.connecting : labels.noneDetail || undefined}>
            {labels.none}
          </ListboxItem>
          {exits.map((p) => {
            const state: TailscaleExitNodeState = { selected: p.id === value, connecting: p.id === pending, online: p.online };
            const name = exitNodeName(p);
            return (
              <ListboxItem key={p.id} value={p.id as string} label={name} disabled={!p.online} description={state.connecting ? labels.connecting : p.online ? undefined : labels.offline}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span aria-hidden="true" className="grid shrink-0 place-items-center">{trailing(p, state)}</span>
                </span>
              </ListboxItem>
            );
          })}
        </Listbox>
      ) : (
        renderEmptyState(emptyState, EXIT_EMPTY)
      )}
      {error ? <p role="alert" className="m-0 text-footnote text-destructive">{error}</p> : null}
    </div>
  );
}

'use client';
import { useSyncExternalStore, type ComponentProps, type JSX, type ReactNode } from 'react';
import { Button as AriaButton, Link as AriaLink, composeRenderProps, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Icon, type IconName } from '@/lib/icon';
import { tailscaleErrorMessage, type Tailscale, type TailscaleSnapshot, type TailscaleStatus } from '@/lib/tailscale';
import { useOptionalTailscale } from '@/lib/tailscale-react';
import { cn } from '@/lib/utils';

/* ══ TailscaleLoginButton — "Sign in with Tailscale" ══
   <TailscaleProvider options={…}>
     <TailscaleLoginButton />      // idle → signing in (press again to cancel) → connected (press to sign out) → error (press to retry)
     <TailscaleStatusBadge />      // the state in a word, the tailnet, and the sign-in link if the popup was blocked
   </TailscaleProvider>
   Both read the nearest provider; pass `status` (and the handlers) to drive them without one, as the stories do. */

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

export const tailscaleLoginButtonVariants = cva(
  'box-border inline-flex cursor-pointer items-center justify-center gap-2 border-0 [font-family:inherit] font-semibold whitespace-nowrap outline-none transition-[scale,background-color,opacity] duration-spring-snappy ease-spring-snappy data-pressed:scale-[.97] motion-reduce:transition-none data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-offset-2 data-disabled:cursor-default data-disabled:opacity-40',
  {
    variants: {
      variant: {
        /** Dark on light, light on dark — the usual "Sign in with …" look. */
        default: 'bg-foreground text-background',
        outline: 'bg-background text-foreground shadow-hairline data-hovered:bg-secondary',
        secondary: 'bg-secondary text-secondary-foreground',
      },
      size: {
        default: 'h-10 rounded-ctl px-4 text-subhead',
        sm: 'h-8 rounded-lg px-3 text-footnote',
        lg: 'h-11 rounded-xl px-5 text-callout',
        pill: 'h-11 w-full rounded-card px-4 text-callout',
      },
      /** The state the button shows; set from the status. */
      tone: {
        idle: '',
        busy: '',
        connected: '',
        /** Not a red fill: white on the system red fails AA contrast. The icon carries the colour. */
        error: 'bg-secondary text-foreground shadow-none',
      },
    },
    defaultVariants: { variant: 'default', size: 'default', tone: 'idle' },
  },
);

type Tone = 'idle' | 'busy' | 'connected' | 'error';
const toneOf = (status: TailscaleStatus): Tone =>
  status === 'connected' ? 'connected' : status === 'error' ? 'error' : status === 'idle' || status === 'needs-login' ? 'idle' : 'busy';

export interface TailscaleLoginButtonLabels {
  signIn: string;
  signingIn: string;
  connecting: string;
  approval: string;
  signOut: string;
  retry: string;
}

const LABELS: TailscaleLoginButtonLabels = {
  signIn: 'Sign in with Tailscale',
  signingIn: 'Signing in…',
  connecting: 'Connecting…',
  approval: 'Waiting for approval…',
  signOut: 'Sign out of Tailscale',
  retry: 'Try again',
};

function useSnapshot(t: Tailscale | null): TailscaleSnapshot | null {
  return useSyncExternalStore(
    t?.subscribe ?? noopSubscribe,
    t ? t.getSnapshot : nullSnapshot,
    t ? t.getServerSnapshot : nullSnapshot,
  );
}
const noopSubscribe = () => () => undefined;
const nullSnapshot = () => null;

export interface TailscaleLoginButtonProps
  extends Omit<AriaButtonProps, 'children' | 'onPress' | 'className'>, Omit<VariantProps<typeof tailscaleLoginButtonVariants>, 'tone'> {
  /** Default: the provider's controller. */
  tailscale?: Tailscale;
  /** Show this status instead of the controller's (stories, or a controller of your own). */
  status?: TailscaleStatus;
  /** Override what a press does in each state. Defaults call the controller: signIn, cancel, signOut, signIn. */
  onSignIn?: () => void;
  onCancel?: () => void;
  onSignOut?: () => void;
  labels?: Partial<TailscaleLoginButtonLabels>;
  className?: AriaButtonProps['className'];
}

/** A react-aria Button that signs in to Tailscale and shows where that stands. Never colour alone: the label changes with the state. */
export function TailscaleLoginButton({ tailscale, status: statusProp, onSignIn, onCancel, onSignOut, labels: labelsProp, variant, size, className, ...props }: TailscaleLoginButtonProps) {
  const t = useOptionalTailscale(tailscale);
  const snap = useSnapshot(t);
  const status = statusProp ?? snap?.status ?? 'idle';
  const tone = toneOf(status);
  const labels = { ...LABELS, ...labelsProp };
  const label =
    tone === 'connected' ? labels.signOut
    : tone === 'error' ? labels.retry
    : tone === 'idle' ? labels.signIn
    : status === 'needs-approval' ? labels.approval
    : status === 'starting' || status === 'loading' ? labels.connecting
    : labels.signingIn;
  const press = () => {
    if (tone === 'connected') (onSignOut ?? (() => void t?.signOut()))();
    else if (tone === 'busy') (onCancel ?? (() => t?.cancel()))();
    else (onSignIn ?? (() => void t?.signIn()))();
  };
  return (
    <AriaButton
      data-slot="tailscale-login-button"
      data-status={status}
      // react-aria's Button drops aria-busy (its `isPending` would also ignore presses, and a press here cancels), so it goes on the <button> directly.
      render={(p: JSX.IntrinsicElements['button']) => <button {...p} aria-busy={tone === 'busy' || undefined} />}
      aria-label={tone === 'busy' ? `${label} Press to cancel.` : undefined}
      className={composeRenderProps(className, (cls) => cn(tailscaleLoginButtonVariants({ variant, size, tone }), cls))}
      onPress={press}
      {...props}
    >
      {tone === 'busy' ? <Spinner spin size={16} /> : tone === 'error' ? <Icon name="exclamation-circle" size={16} sw={2} className="text-destructive" /> : <TailscaleMark />}
      <span>{label}</span>
    </AriaButton>
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
  variants: { layout: { inline: '', stacked: 'flex-col items-start' } },
  defaultVariants: { layout: 'inline' },
});

export interface TailscaleStatusBadgeProps extends Omit<ComponentProps<'div'>, 'children'>, VariantProps<typeof tailscaleStatusBadgeVariants> {
  tailscale?: Tailscale;
  /** Show this state instead of the controller's. */
  status?: TailscaleStatus;
  tailnet?: string | null;
  loginUrl?: string | null;
  /** The error text to show when `status` is `error`. */
  error?: ReactNode;
  /** Hide the details (tailnet, error, link) and show the pill alone. */
  compact?: boolean;
}

/** The connection state as a pill with an icon and a word, the tailnet when connected, the error when failed, and a link to the sign-in page when no popup could open. A polite live region. */
export function TailscaleStatusBadge({ tailscale, status: statusProp, tailnet: tailnetProp, loginUrl: loginProp, error: errorProp, compact, layout, className, ...props }: TailscaleStatusBadgeProps) {
  const t = useOptionalTailscale(tailscale);
  const snap = useSnapshot(t);
  const status = statusProp ?? snap?.status ?? 'idle';
  const s = BADGE[status];
  const tailnet = tailnetProp !== undefined ? tailnetProp : snap?.tailnet ?? null;
  const loginUrl = loginProp !== undefined ? loginProp : snap?.loginUrl ?? null;
  const error = errorProp ?? (snap?.error ? tailscaleErrorMessage(snap.error) : null);
  return (
    <div data-slot="tailscale-status-badge" data-status={status} role="status" className={cn(tailscaleStatusBadgeVariants({ layout }), className)} {...props}>
      <Badge variant={s.variant}>
        {s.icon ? <Icon name={s.icon} size={12} sw={2.2} /> : <Spinner spin size={12} />}
        {s.label}
      </Badge>
      {!compact && status === 'connected' && tailnet ? <span className="text-foreground/70">{tailnet}</span> : null}
      {!compact && status === 'error' && error ? <span className="text-foreground">{error}</span> : null}
      {!compact && status === 'needs-approval' ? <span className="text-foreground/70">An admin has to approve this device.</span> : null}
      {!compact && status === 'signing-in' && loginUrl ? (
        <AriaLink href={loginUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring">
          Continue to Tailscale
        </AriaLink>
      ) : null}
    </div>
  );
}

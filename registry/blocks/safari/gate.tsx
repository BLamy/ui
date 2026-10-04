/* The gate. Safari does nothing until Tailscale is connected: this covers the whole browser (which is `inert` underneath),
   and goes away only when the controller reports `connected`. Signing out brings it back. */
import { TailscaleLoginButton, TailscaleMark, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button';
import { Icon, type IconName } from '@/lib/icon';
import { tailscaleErrorMessage } from '@/lib/tailscale';
import { useTailscaleStatus } from '@/lib/tailscale-react';

const POINTS: ReadonlyArray<{ icon: IconName; title: string; text: string }> = [
  { icon: 'shield-check-fill', title: 'Every request goes through your tailnet', text: 'Pages, stylesheets and pictures are all fetched through Tailscale.' },
  { icon: 'lock-fill', title: 'Nothing is sent outside it', text: 'Public sites load only through an exit node you choose. Without one they fail instead of leaving your tailnet.' },
  { icon: 'doc', title: 'Pages are shown as documents', text: 'Scripts, frames and plug-ins are switched off, so a page cannot make requests of its own.' },
];

export function Gate() {
  const snap = useTailscaleStatus();
  const busy = snap.status !== 'idle' && snap.status !== 'needs-login' && snap.status !== 'error';
  return (
    <div data-slot="safari-gate" role="dialog" aria-modal="true" aria-labelledby="safari-gate-title" aria-describedby="safari-gate-text"
      className="absolute inset-0 z-30 grid place-items-center overflow-auto bg-background p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="relative grid size-20 place-items-center rounded-card bg-primary text-primary-foreground">
          <Icon name="globe" size={44} />
          <span className="absolute -right-2 -bottom-2 grid size-8 place-items-center rounded-full bg-background text-foreground shadow-hairline">
            <TailscaleMark size={18} />
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h1 id="safari-gate-title" className="m-0 text-title font-bold tracking-[-.4px]">Connect to Tailscale</h1>
          <p id="safari-gate-text" className="m-0 text-subhead text-foreground/70">
            Safari only browses through your tailnet. Sign in to Tailscale to start.
          </p>
        </div>

        <div className="flex w-full flex-col items-stretch gap-2.5">
          <TailscaleLoginButton size="pill" />
          <div className="flex min-h-6 justify-center" aria-live="polite">
            <TailscaleStatusBadge />
          </div>
          {snap.status === 'error' && snap.error ? (
            <p role="alert" className="m-0 flex items-start justify-center gap-1.5 text-footnote">
              <Icon name="exclamation-circle" size={14} className="mt-[3px] shrink-0 text-destructive" />
              <span>{tailscaleErrorMessage(snap.error)}</span>
            </p>
          ) : null}
          {busy && snap.status === 'needs-approval' ? (
            <p className="m-0 text-footnote text-foreground/70">An administrator has to approve this device in the Tailscale admin console.</p>
          ) : null}
        </div>

        <ul className="m-0 flex w-full list-none flex-col gap-3 rounded-panel bg-secondary p-4 text-left">
          {POINTS.map((p) => (
            <li key={p.title} className="flex items-start gap-3">
              <Icon name={p.icon} size={20} className="mt-0.5 shrink-0 text-primary" />
              <span className="flex flex-col">
                <span className="text-subhead font-semibold">{p.title}</span>
                <span className="text-footnote text-foreground/70">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

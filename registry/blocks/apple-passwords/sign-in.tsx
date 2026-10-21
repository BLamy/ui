/* Signing in to a developer service with a device code, the way the app builder's Login buttons do: the sidebar's
   service buttons open a Credenza that morphs Requesting → the code and the button that opens the service →
   Signed In (or an error with Try Again). The token it gets back is saved to the vault as an item and selected. */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Credenza } from '@/components/ui/credenza';
import { SplitViewSection } from '@/components/ui/split-view';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { SERVICES, type DeviceAuth, type DeviceGrant, type DevicePrompt, type ServiceId } from './device-auth';
import { CopyButton, SiteTile } from './parts';
import type { Vault } from './vault';

/** The vault item a service's token is saved as. */
export const serviceItemId = (id: ServiceId) => 'service-' + id;

/* ── The buttons: one per service, a check and the account once it's signed in ── */
export function ServiceButtons({ vault, onSignIn }: { vault: Vault; onSignIn: (id: ServiceId) => void }) {
  return (
    <SplitViewSection title="Developer Sign-In" className="mt-2">
      <div className="grid grid-cols-2 gap-2.5 px-0.5 pt-1">
        {SERVICES.map((s) => {
          const saved = vault.accounts.find((a) => a.id === serviceItemId(s.id));
          return (
            <button key={s.id} type="button" onClick={() => onSignIn(s.id)}
              aria-label={saved ? `${s.name}: signed in as ${saved.username}. Sign in again` : `Sign in to ${s.name}`}
              className={cn(
                'bl-btn flex cursor-pointer items-center gap-2.5 rounded-panel border-0 bg-card p-2.5 text-left [font-family:inherit] text-foreground outline-none',
                'shadow-[0_.5px_1.5px_black] shadow-black/8 transition-[background-color,scale] duration-spring-snappy ease-spring-snappy active:scale-[.97]',
                'hover:bg-[color-mix(in_oklab,var(--card)_92%,var(--foreground))] focus-visible:ring-2 focus-visible:ring-ring',
              )}>
              <SiteTile title={s.name} color={s.color} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-detail font-semibold">{s.name}</span>
                <span className={cn('flex items-center gap-1 truncate text-caption', saved ? 'text-success' : 'text-primary')}>
                  {saved ? <><Icon name="check-circle-fill" size={11} />Signed In</> : 'Sign In'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </SplitViewSection>
  );
}

/* ── The sheet ── */
type Step =
  | { view: 'starting' }
  | { view: 'code'; prompt: DevicePrompt }
  | { view: 'approving'; prompt: DevicePrompt }
  | { view: 'done'; grant: DeviceGrant }
  | { view: 'error'; message: string };

function useSecondsLeft(until: number | undefined, live: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (until == null || !live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until, live]);
  return until == null ? 0 : Math.max(0, Math.round((until - now) / 1000));
}

export function SignInCredenza({ service: id, auth, compact, live, onClose, onSaved }: {
  /** The service being signed in to; null when closed. */
  service: ServiceId | null;
  auth: DeviceAuth;
  compact: boolean;
  /** Count the code's expiry down. False holds it still (screenshots). */
  live: boolean;
  onClose: () => void;
  /** The grant came back: save it and show it. */
  onSaved: (id: ServiceId, grant: DeviceGrant) => void;
}) {
  const [step, setStep] = useState<Step>({ view: 'starting' });
  const [attempt, setAttempt] = useState(0);
  // The last service stays on the sheet while it animates closed.
  const last = useRef(id); if (id) last.current = id;
  const service = SERVICES.find((s) => s.id === last.current);
  const saved = useRef(onSaved); saved.current = onSaved;

  // Each open (and each Try Again) starts a fresh flow; closing aborts the polling.
  useEffect(() => {
    if (!id) return;
    const ctl = new AbortController();
    setStep({ view: 'starting' });
    auth.signIn(id, { signal: ctl.signal, onPrompt: (prompt) => setStep({ view: 'code', prompt }) })
      .then((grant) => { setStep({ view: 'done', grant }); saved.current(id, grant); })
      .catch((e: unknown) => {
        if (ctl.signal.aborted) return;
        setStep({ view: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return () => ctl.abort();
  }, [id, auth, attempt]);

  const prompt = step.view === 'code' || step.view === 'approving' ? step.prompt : undefined;
  const left = useSecondsLeft(prompt?.expiresAt, live);

  const openBrowser = () => {
    if (!prompt) return;
    if (prompt.userCode) {
      try { void navigator.clipboard?.writeText(prompt.userCode).catch(() => {}); } catch { /* no clipboard */ }
    }
    if (auth.open) auth.open(prompt);
    else window.open(prompt.verificationUriComplete ?? prompt.verificationUri, '_blank', 'noopener');
    setStep({ view: 'approving', prompt });
  };

  const title = !service ? '' : step.view === 'done' ? 'Signed In' : step.view === 'error' ? 'Couldn’t Sign In' : `Sign In to ${service.name}`;

  return (
    <Credenza open={!!id} onClose={onClose} compact={compact} title={title}
      view={step.view === 'approving' ? 'code' : step.view}>
      {service ? (
        <div className="px-4 pt-1 pb-4">
          {step.view === 'starting' ? (
            <div className="grid place-items-center gap-3 px-5 pt-4 pb-6 text-subhead text-muted-foreground">
              <Spinner size={26} label="Requesting a code" />
              Requesting a sign-in code…
            </div>
          ) : null}

          {prompt ? (
            <>
              <p className="mx-1 mt-0 mb-3 text-footnote leading-[1.4] text-muted-foreground">
                {prompt.userCode
                  ? <>Enter this code at <span className="font-medium text-foreground">{host(prompt.verificationUri)}</span> to let Passwords use your {service.name} account. It’s copied when you open the page.</>
                  : <>Approve the request in {service.name}. This window signs in as soon as you do.</>}
              </p>
              {prompt.userCode ? (
                <div className="flex items-center justify-center gap-1 rounded-card bg-secondary py-4 pl-4">
                  <span className="font-mono text-[30px] font-semibold tracking-[.16em] tabular-nums select-all">{prompt.userCode}</span>
                  <CopyButton label="Code" value={prompt.userCode} />
                </div>
              ) : null}
              <div className="mx-1 mt-3 flex items-center gap-2 text-caption text-muted-foreground" aria-live="polite">
                {step.view === 'approving'
                  ? <><Spinner size={12} label="Waiting" />Waiting for you to approve in {service.name}…</>
                  : <><Icon name="clock-fill" size={13} />Expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</>}
              </div>
              <div className="mt-4 grid gap-2">
                <Button size="pill" onPress={openBrowser}>
                  <Icon name="arrow-up-right" size={16} weight="semibold" />
                  {prompt.userCode ? `Copy Code & ${service.verb}` : service.verb}
                </Button>
                <Button size="pill" variant="secondary" data-autofocus onPress={onClose}>Cancel</Button>
              </div>
            </>
          ) : null}

          {step.view === 'done' ? (
            <div className="flex flex-col items-center gap-2 px-2 pt-2 text-center">
              <span className="relative">
                <SiteTile title={service.name} color={service.color} size={56} />
                <Icon name="check-circle-fill" size={22} className="absolute -right-1.5 -bottom-1.5 rounded-full bg-card text-success" />
              </span>
              <div className="mt-1 text-callout font-semibold">{step.grant.account}</div>
              <div className="text-footnote text-muted-foreground">
                Your {service.name} token is saved in Passwords{step.grant.scope ? ` with ${step.grant.scope}` : ''}.
              </div>
              <Button size="pill" className="mt-3" onPress={onClose}>Done</Button>
            </div>
          ) : null}

          {step.view === 'error' ? (
            <>
              <div className="mx-1 flex gap-2.5 rounded-card bg-secondary p-3 text-footnote">
                <Icon name="exclamation-circle-fill" size={18} className="shrink-0 text-destructive" />
                <span className="leading-[1.4]">{step.message}</span>
              </div>
              <div className="mt-4 grid gap-2">
                <Button size="pill" onPress={() => setAttempt((n) => n + 1)}>Try Again</Button>
                <Button size="pill" variant="secondary" onPress={onClose}>Cancel</Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </Credenza>
  );
}

function host(url: string) {
  try { return new URL(url).host + new URL(url).pathname.replace(/\/$/, ''); } catch { return url; }
}

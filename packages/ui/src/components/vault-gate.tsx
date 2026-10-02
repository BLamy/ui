'use client';
import { useEffect, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from 'react';
import { VisuallyHidden } from 'react-aria';
import { cva, type VariantProps } from 'class-variance-authority';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogAction, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasskeyEnrollDialog, vaultActionClass, vaultErrorClass, vaultLinkClass, vaultMutedClass } from '@/components/ui/passkey-enroll-dialog';
import { Spinner } from '@/components/ui/spinner';
import { FieldDescription, TextField } from '@/components/ui/text-field';
import { Icon, type IconName } from '@/lib/icon';
import { passkeyUnsupportedReason } from '@/lib/passkey';
import { cn } from '@/lib/utils';
import type { Vault, VaultState, VaultStatus, VaultUnsupportedReason } from '@/lib/vault';
import { useVault, useVaultState, vaultErrorMessage } from '@/lib/vault-react';

/* ══ VaultGate and friends — the screens around a passkey vault ══
   <VaultProvider options={…}>
     <VaultGate appName="Notes">      // loading → set-up → locked → your app; or an honest "unavailable" screen
       <Notes />
     </VaultGate>
   </VaultProvider>
   The parts are exported on their own (VaultUnlock, VaultSetup, VaultUnsupported, VaultStatusBadge) to build a different shell. */

/** Why a passkey vault is unavailable, in plain words, with what the person can do about it. */
export function unsupportedMessage(reason: VaultUnsupportedReason | null): { title: string; body: string } {
  switch (reason) {
    case 'insecure-context':
      return { title: 'Passkeys need a secure connection', body: 'Passkeys only work on HTTPS pages (or localhost). Open this app over a secure connection to protect its data.' };
    case 'no-webauthn':
      return { title: "This browser can't use passkeys", body: "It does not support WebAuthn, so there is nothing to lock the data with. Try a current version of Chrome, Edge, Safari or Firefox." };
    case 'no-prf':
      return { title: "Passkeys can't make encryption keys here", body: 'This browser does not support the WebAuthn PRF extension, which is how a passkey becomes an encryption key. Newer browser or operating system versions may.' };
    case 'storage':
      return { title: 'Storage is blocked', body: "The browser isn't letting this site save data (private browsing, or storage turned off), so there is nowhere to keep the vault." };
    case 'newer-version':
      return { title: 'This data needs a newer version', body: 'It was saved by a newer version of the app. Update the app to open it. It has not been changed.' };
    default:
      return { title: 'Passkey protection is unavailable', body: 'This browser or device cannot protect data with a passkey.' };
  }
}

const panelVariants = cva('mx-auto flex w-full flex-col items-center gap-4 text-center', {
  variants: { size: { default: 'max-w-sm p-6', compact: 'max-w-xs p-4' } },
  defaultVariants: { size: 'default' },
});

interface PanelProps extends Omit<ComponentProps<'section'>, 'title'>, VariantProps<typeof panelVariants> {
  icon: IconName;
  title: ReactNode;
  description?: ReactNode;
}

function Panel({ icon, title, description, size, className, children, ...props }: PanelProps) {
  return (
    <section className={cn(panelVariants({ size }), className)} {...props}>
      <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon name={icon} size={28} />
      </span>
      <div className="grid gap-1">
        <h2 className="m-0 text-title leading-[25px] font-semibold text-foreground">{title}</h2>
        {description ? <p className={cn('m-0 text-subhead leading-[20px]', vaultMutedClass)}>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/* ── status badge ── */

const STATUS: Record<VaultStatus, { label: string; icon: IconName; variant: ComponentProps<typeof Badge>['variant'] }> = {
  loading: { label: 'Checking', icon: 'clock', variant: 'secondary' },
  unsupported: { label: 'Unavailable', icon: 'shield-exclamation', variant: 'outline' },
  empty: { label: 'Not set up', icon: 'lock-open', variant: 'outline' },
  locked: { label: 'Locked', icon: 'lock-fill', variant: 'secondary' },
  unlocked: { label: 'Unlocked', icon: 'lock-open-fill', variant: 'outline' },
};

export interface VaultStatusBadgeProps extends Omit<ComponentProps<typeof Badge>, 'variant' | 'children'> {
  vault?: Vault;
}

/** A small pill with the vault's status: icon and word, never colour alone. */
export function VaultStatusBadge({ vault, className, ...props }: VaultStatusBadgeProps) {
  const { status } = useVaultState(vault);
  const s = STATUS[status];
  return (
    <Badge data-slot="vault-status-badge" data-status={status} variant={s.variant} className={className} {...props}>
      <Icon name={s.icon} size={12} sw={2.2} />
      {s.label}
    </Badge>
  );
}

/* ── unsupported ── */

export interface VaultUnsupportedProps extends Omit<ComponentProps<'section'>, 'title'> {
  vault?: Vault;
}

/** The honest screen for a browser that cannot do this: what is missing, and that nothing was saved. */
export function VaultUnsupported({ vault, className, ...props }: VaultUnsupportedProps) {
  const state = useVaultState(vault);
  const { title, body } = unsupportedMessage(state.unsupportedReason);
  return (
    <Panel data-slot="vault-unsupported" icon="shield-exclamation" title={title} description={body} className={className} {...props} />
  );
}

/* ── set up ── */

export interface VaultSetupProps extends Omit<ComponentProps<'section'>, 'title'> {
  vault?: Vault;
  appName?: string;
  protects?: ReactNode;
  requireVerification?: boolean;
  /** Called when the button is pressed. Pass it when a parent owns the `PasskeyEnrollDialog` (as `VaultGate` does): the
   *  vault becomes `unlocked` the moment the passkey exists, which unmounts this screen, and a dialog rendered inside it
   *  would vanish before showing the recovery key. Without it, the screen renders its own dialog. */
  onSetup?: () => void;
}

/** The first-run screen: what a passkey vault is, and the button that starts enrollment. */
export function VaultSetup({ vault, appName, protects, requireVerification, onSetup, className, ...props }: VaultSetupProps) {
  const v = useVault(vault);
  const [open, setOpen] = useState(false);
  return (
    <Panel
      data-slot="vault-setup"
      icon="passkey"
      title={appName ? `Protect ${appName} with a passkey` : 'Protect your data with a passkey'}
      description="Your data is encrypted on this device. Only your passkey, or the recovery key you will be given, can open it."
      className={className}
      {...props}
    >
      <Button size="lg" className={cn('w-full', vaultActionClass)} onPress={() => (onSetup ? onSetup() : setOpen(true))}>
        <Icon name="passkey" size={18} />
        Set up passkey
      </Button>
      {onSetup ? null : <PasskeyEnrollDialog isOpen={open} onOpenChange={setOpen} vault={v} appName={appName} protects={protects} requireVerification={requireVerification} />}
    </Panel>
  );
}

/* ── unlock ── */

export interface VaultUnlockProps extends Omit<ComponentProps<'section'>, 'title'> {
  vault?: Vault;
  appName?: string;
  title?: ReactNode;
  description?: ReactNode;
  /** Focus the unlock button when the screen appears (default true: this screen replaces whatever had focus). */
  autoFocus?: boolean;
  onUnlocked?: () => void;
}

/** The locked screen: unlock with a passkey, or with the recovery key; and, behind a confirmation, erase the vault. */
export function VaultUnlock({ vault, appName, title, description, autoFocus = true, onUnlocked, className, ...props }: VaultUnlockProps) {
  const v = useVault(vault);
  const state: VaultState = v.getState();
  const why = state.support ? passkeyUnsupportedReason(state.support) : null;
  const passkeyOff = why !== null;
  const [mode, setMode] = useState<'passkey' | 'recovery'>(passkeyOff ? 'recovery' : 'passkey');
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const unlocking = state.busy === 'unlock' || state.busy === 'recovery';

  // Where passkeys cannot work (found out after the first render), go straight to the recovery key.
  useEffect(() => { if (passkeyOff) setMode('recovery'); }, [passkeyOff]);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
      setText('');
      onUnlocked?.();
    } catch (e) {
      setError(vaultErrorMessage(e));
    }
  }

  const submitRecovery = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) void run(() => v.unlockWithRecoveryKey(text));
  };

  return (
    <Panel
      data-slot="vault-unlock"
      data-mode={mode}
      icon="lock-fill"
      title={title ?? (appName ? `Unlock ${appName}` : 'Unlock')}
      description={description ?? (mode === 'passkey' ? 'Use your passkey to open the data stored in this browser.' : 'Enter the recovery key you saved when you set up the vault.')}
      className={className}
      {...props}
    >
      {why ? <p className={cn('m-0 text-footnote', vaultMutedClass)}>{unsupportedMessage(why).title}. Your recovery key still works.</p> : null}

      {mode === 'passkey' ? (
        <Button size="lg" className={cn('w-full', vaultActionClass)} autoFocus={autoFocus} isPending={unlocking} onPress={() => void run(() => v.unlock())}>
          {unlocking ? <Spinner spin size={18} /> : <Icon name="passkey" size={18} />}
          {unlocking ? 'Waiting for passkey' : 'Unlock with passkey'}
        </Button>
      ) : (
        <form className="grid w-full gap-3 text-left" onSubmit={submitRecovery} noValidate>
          <TextField value={text} onChange={setText} isInvalid={error !== null} autoComplete="off" autoFocus={autoFocus}>
            <Label variant="field" className={vaultMutedClass}>Recovery key</Label>
            <Input className="font-mono uppercase" spellCheck={false} autoCapitalize="characters" autoCorrect="off" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" />
            <FieldDescription className={vaultMutedClass}>Eight groups of four letters and digits. Case and dashes don&apos;t matter.</FieldDescription>
          </TextField>
          <Button type="submit" size="lg" className={vaultActionClass} isPending={unlocking} isDisabled={!text.trim()}>
            {unlocking ? 'Unlocking' : 'Unlock with recovery key'}
          </Button>
        </form>
      )}

      {error ? <p role="alert" className={cn('m-0 text-footnote', vaultErrorClass)}>{error}</p> : null}

      <div className="flex flex-col items-center gap-1">
        {!passkeyOff ? (
          <Button variant="link" size="sm" className={vaultLinkClass} onPress={() => { setError(null); setMode(mode === 'passkey' ? 'recovery' : 'passkey'); }}>
            {mode === 'passkey' ? 'Use recovery key instead' : 'Use passkey instead'}
          </Button>
        ) : null}
        <DialogTrigger>
          <Button variant="link" size="sm" className={vaultMutedClass}>Lost both? Erase this vault…</Button>
          <DialogContent size="alert">
            <DialogHeader>
              <DialogTitle>Erase this vault?</DialogTitle>
              <DialogDescription>Everything stored in it is deleted from this browser and cannot be recovered. You can then set it up again.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogAction variant="cancel" className={vaultLinkClass}>Cancel</DialogAction>
              <DialogAction variant="destructive" className={vaultErrorClass} onPress={() => { setError(null); v.reset().catch((e) => setError(vaultErrorMessage(e))); }}>Erase</DialogAction>
            </DialogFooter>
          </DialogContent>
        </DialogTrigger>
      </div>
    </Panel>
  );
}

/* ── gate ── */

export interface VaultGateProps {
  vault?: Vault;
  appName?: string;
  /** What the vault protects, for the set-up screen's wording. */
  protects?: ReactNode;
  requireVerification?: boolean;
  /** Replace the screen for a given status. `unsupported` can render `children` to carry on without protection: your call, made visible. */
  loading?: ReactNode;
  unsupported?: ReactNode | ((state: VaultState) => ReactNode);
  empty?: ReactNode;
  locked?: ReactNode;
  /** While unlocked and the recovery key was never confirmed, show a notice with a button to replace it (default true). */
  recoveryNotice?: boolean;
  className?: string;
  children?: ReactNode;
}

const ANNOUNCE: Partial<Record<VaultStatus, string>> = { unlocked: 'Unlocked.', locked: 'Locked.' };

/** Renders `children` only while the vault is unlocked; otherwise the screen the status calls for. */
export function VaultGate({
  vault, appName, protects, requireVerification, loading, unsupported, empty, locked, recoveryNotice = true, className, children,
}: VaultGateProps) {
  const v = useVault(vault);
  const state = v.getState();
  // The dialog lives here, above the status switch: enrolling flips the status to `unlocked` before the recovery key
  // has been shown, and the screens below unmount at that moment.
  const [dialog, setDialog] = useState<{ open: boolean; mode: 'enroll' | 'regenerate' }>({ open: false, mode: 'enroll' });
  const [announce, setAnnounce] = useState('');
  const first = useRef(true);

  // Say what changed ("Locked." after an auto-lock) without ever including a secret.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setAnnounce(ANNOUNCE[state.status] ?? '');
  }, [state.status]);

  let body: ReactNode;
  switch (state.status) {
    case 'loading':
      body = loading ?? (
        <div className={cn('grid place-items-center p-8', vaultMutedClass)} role="status" aria-label="Checking passkey support">
          <Spinner spin size={24} />
        </div>
      );
      break;
    case 'unsupported':
      body = typeof unsupported === 'function' ? unsupported(state) : (unsupported ?? <VaultUnsupported vault={v} />);
      break;
    case 'empty':
      body = empty ?? <VaultSetup vault={v} appName={appName} protects={protects} requireVerification={requireVerification} onSetup={() => setDialog({ open: true, mode: 'enroll' })} />;
      break;
    case 'locked':
      body = locked ?? <VaultUnlock vault={v} appName={appName} />;
      break;
    default:
      body = (
        <>
          {recoveryNotice && !state.recoveryConfirmed ? (
            <div role="region" aria-label="Recovery key" className="m-3 flex items-center gap-3 rounded-card bg-secondary p-3 text-subhead">
              <Icon name="key" size={20} className="shrink-0 text-primary" />
              <span className="min-w-0 flex-1">You haven&apos;t confirmed saving your recovery key. Without it, losing your passkey means losing your data.</span>
              <Button size="sm" className={vaultActionClass} onPress={() => setDialog({ open: true, mode: 'regenerate' })}>Get a new key</Button>
            </div>
          ) : null}
          {children}
        </>
      );
  }

  return (
    <div data-slot="vault-gate" data-status={state.status} className={cn('contents', className)}>
      {body}
      <PasskeyEnrollDialog
        isOpen={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        vault={v}
        mode={dialog.mode}
        appName={appName}
        protects={protects}
        requireVerification={requireVerification}
      />
      <VisuallyHidden>
        <span role="status" aria-live="polite">{announce}</span>
      </VisuallyHidden>
    </div>
  );
}

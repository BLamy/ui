'use client';
import { useEffect, useId, useRef, useState, type ComponentProps, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { announce } from '@ui-sdk/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogBackdrop, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
  Dialog, DialogBackdrop, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogView,
  surfaceDescriptionVariants, type DialogProps,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Icon, type IconName } from '@/lib/icon';
import { passkeyUnsupportedReason } from '@/lib/passkey';
import { calloutVariants } from '@/lib/primitives';
import { useCopy } from '@/lib/use-copy';
import { cn } from '@/lib/utils';
import type { Vault, VaultState, VaultStatus, VaultUnsupportedReason } from '@/lib/vault';
import { useVault, useVaultState, vaultErrorMessage } from '@/lib/vault-react';

/* ══ Passkey vault screens — the gate, its screens and the enroll dialog around a passkey vault ══
   <VaultProvider options={…}>
     <VaultGate appName="Notes">      // loading → set-up → locked → your app; or an honest "unavailable" screen
       <Notes />
     </VaultGate>
   </VaultProvider>
   The screens are exported on their own (VaultSetup, VaultUnlock, VaultUnsupported, VaultStatusBadge) to build a
   different shell, and so is the dialog that enrolls a passkey and shows the recovery key once (VaultEnrollDialog,
   with VaultRecoveryKey). */

/* The theme's primary (white on the iOS blue, 3.6:1) and its muted text (3.3:1 on a grouped background) are under
   WCAG AA for body-size text. These screens carry the text people must read to keep their data, so they darken the
   primary where it holds text and use a stronger muted colour. The dark primary is the same system blue, so white
   on it is 3.6:1 in both themes and the buttons keep the darkened fill in dark mode too; as text on the dark
   surfaces the primary itself passes, so the links take the theme's own primary there. */
const vaultActionClass = 'bg-[color-mix(in_oklab,var(--primary)_78%,black)]';
const vaultLinkClass = 'text-[color-mix(in_oklab,var(--primary)_78%,black)] dark:text-primary';
const vaultErrorClass = 'text-[color-mix(in_oklab,var(--destructive)_72%,black)] dark:text-destructive';
const vaultMutedClass = 'text-foreground/70';

/** Why a passkey vault is unavailable, in plain words, with what the person can do about it. */
export function vaultUnsupportedMessage(reason: VaultUnsupportedReason | null): { title: string; body: string } {
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

/* ── screens ── */

interface PanelProps extends Omit<ComponentProps<'section'>, 'title' | 'ref'> {
  icon: IconName;
  title: ReactNode;
  description?: ReactNode;
}

/* A gate screen is the kit's EmptyState at page size, centred in the host it replaces, with a tinted badge, a heading
   and the screen's controls as its action. */
function Panel({ icon, title, description, className, children, ...props }: PanelProps) {
  return (
    <EmptyState
      size="lg"
      render={<section />}
      {...props}
      icon={(
        <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon name={icon} size={28} className="size-7!" />
        </span>
      )}
      title={<h2 className="m-0 [font:inherit]">{title}</h2>}
      description={description ? <span className={vaultMutedClass}>{description}</span> : undefined}
      action={children ? <div className="flex w-full flex-col items-center gap-4">{children}</div> : undefined}
      className={cn('mx-auto w-full max-w-sm [&>[data-slot=empty-state-action]]:w-full', className)}
    />
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
  const { title, body } = vaultUnsupportedMessage(state.unsupportedReason);
  return (
    <Panel data-slot="vault-unsupported" icon="shield-exclamation" title={title} description={body} className={className} {...props} />
  );
}

/* ── recovery key ── */

export const vaultRecoveryKeyVariants = cva(
  'grid justify-center gap-x-6 gap-y-1 rounded-ctl bg-secondary px-3 py-3 font-mono text-callout font-semibold tracking-wide text-foreground tabular-nums select-text [-webkit-user-select:text]',
  {
    variants: { layout: { grid: 'grid-cols-[repeat(2,max-content)]', row: 'grid-cols-[repeat(4,max-content)]' } },
    defaultVariants: { layout: 'grid' },
  },
);

export interface VaultRecoveryKeyProps extends Omit<ComponentProps<'div'>, 'children'>, VariantProps<typeof vaultRecoveryKeyVariants> {
  /** `XXXX-XXXX-…`, as returned by `vault.enroll()`. */
  value: string;
}

/** The recovery key in groups of four. A labelled group so a screen reader reads it as one thing; not a live region. */
export function VaultRecoveryKey({ value, layout, className, ...props }: VaultRecoveryKeyProps) {
  return (
    <div data-slot="vault-recovery-key" role="group" aria-label="Recovery key" className={cn(vaultRecoveryKeyVariants({ layout }), className)} {...props}>
      {/* Read letter by letter by assistive tech; the visible groups are for the eye (and copying). */}
      <span className="sr-only select-none">{value.split('-').map((group) => group.split('').join(' ')).join(', ')}</span>
      {value.split('-').map((group, i) => (
        <span key={i} aria-hidden="true">{group}</span>
      ))}
    </div>
  );
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── enroll dialog ── */

export interface VaultEnrollDialogProps extends Omit<DialogProps, 'view' | 'dismissible' | 'children'> {
  /** Defaults to the nearest `VaultProvider`'s vault. */
  vault?: Vault;
  /** `enroll` creates the passkey and the first recovery key; `regenerate` replaces the recovery key of an existing vault. */
  mode?: 'enroll' | 'regenerate';
  /** Used in the copy ("Protect Notes with a passkey"). */
  appName?: string;
  /** What the vault protects, as a sentence fragment. Default: "what this app saves in this browser". */
  protects?: ReactNode;
  /** Make the person type the recovery key back before finishing (proves they saved it). Default false. */
  requireVerification?: boolean;
  /** Called after the recovery key is confirmed, just before the dialog closes. */
  onDone?: () => void;
  /** Merged onto the dialog's card. */
  className?: string;
  style?: CSSProperties;
  /** A `DialogTrigger` that opens it. Optional: control `open`, or open it with a `controller`. */
  children?: ReactNode;
}

type Step = 'intro' | 'working' | 'recovery';

/** Sets up a passkey vault, then shows the recovery key once. Two views of one Dialog: explain what is protected and
    run the passkey prompt, then show the key with Copy and Save as file, and make the person confirm they kept it
    (optionally by typing it back). The recovery-key view can't be dismissed by Esc, an outside press or a swipe: the
    key is shown once, and closing by accident would lose it. A tray in a compact container, a card otherwise. Cancel
    and Done are the dialog's Close parts, so `onOpenChange` hears `close-press` for Cancel and `action` (with
    `returnValue: "done"`) for Done; Done stays open, showing the error, if confirming the key fails. */
export function VaultEnrollDialog({
  vault, mode = 'enroll', appName, protects, requireVerification = false, onDone, className, style, children,
  open, onOpenChange, onOpenChangeComplete, ...props
}: VaultEnrollDialogProps) {
  const v = useVault(vault);
  const primary = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState<Step>('intro');
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [typed, setTyped] = useState('');
  const { copy: copyText, copied } = useCopy();
  const [copyFailed, setCopyFailed] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const errorId = useId();
  const descriptionId = useId();
  const regenerate = mode === 'regenerate';
  const name = appName ?? 'this app';

  /** Leaving the dialog cancels an open prompt; once it has finished closing it forgets the key. */
  const forget = () => {
    abort.current?.abort();
    setStep('intro'); setError(null); setRecoveryKey(null); setSaved(false); setTyped(''); setCopyFailed(false);
  };
  useEffect(() => { if (open === false) abort.current?.abort(); }, [open]);
  useEffect(() => () => abort.current?.abort(), []);

  const verified = !requireVerification || (recoveryKey !== null && typed.replace(/[\s-]/g, '').toUpperCase() === recoveryKey.replace(/-/g, ''));

  async function start() {
    const ac = new AbortController();
    abort.current = ac;
    setError(null);
    setStep('working');
    // UI SDK's polite live region says where the ceremony is (one region per page, so it outlives the dialog).
    announce("Waiting for your passkey. Follow your browser's prompt.");
    try {
      const key = regenerate ? await v.regenerateRecoveryKey({ signal: ac.signal }) : (await v.enroll({ signal: ac.signal })).recoveryKey;
      setRecoveryKey(key);
      setStep('recovery');
      announce('Your recovery key is ready. It is shown only once.');
    } catch (e) {
      if (ac.signal.aborted) return;
      setError(vaultErrorMessage(e));
      setStep('intro');
    }
  }

  /** Closes the open passkey prompt and goes back to the explanation. */
  function cancel() {
    abort.current?.abort();
    setStep('intro');
  }

  async function copy() {
    setCopyFailed(!(await copyText(recoveryKey ?? '')));
  }

  /** Done's action: the dialog closes (reason `action`) once the key is confirmed; a failure keeps it open. */
  async function finish() {
    setError(null);
    try {
      await v.confirmRecoveryKey();
    } catch (e) {
      setError(vaultErrorMessage(e));
      throw e;
    }
    onDone?.();
  }

  const recoveryStep = step === 'recovery';
  const view = recoveryStep ? 'recovery' : 'intro';
  const description = cn(surfaceDescriptionVariants(), vaultMutedClass);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(next, details) => {
        onOpenChange?.(next, details);
        if (!next && !details.canceled) abort.current?.abort();
      }}
      onOpenChangeComplete={(next) => {
        onOpenChangeComplete?.(next);
        if (!next) forget();
      }}
      dismissible={!recoveryStep}
      view={view}
    >
      {children}
      <DialogBackdrop />
      <DialogContent
        variant="tray"
        data-vault-enroll-dialog=""
        className={className}
        style={style}
        aria-describedby={`${descriptionId}-${view}`}
        initialFocus={() => primary.current}
      >
        <DialogHeader variant="bar">
          <DialogTitle>
            {recoveryStep ? 'Save your recovery key' : regenerate ? 'Replace your recovery key' : `Protect ${name} with a passkey`}
          </DialogTitle>
        </DialogHeader>

        <DialogView>
          {!recoveryStep ? (
            <>
              <div className="grid gap-3 px-5 pt-1 pb-3 text-subhead">
                <p id={`${descriptionId}-intro`} className={description}>
                  {regenerate
                    ? 'You will confirm with your passkey. The old recovery key stops working as soon as the new one exists.'
                    : <>A passkey will lock {protects ?? 'what this app saves in this browser'}. Only you can unlock it, with your fingerprint, face or device PIN.</>}
                </p>
                {!regenerate ? (
                  <ul className={cn('m-0 grid list-none gap-2 p-0 text-subhead', vaultMutedClass)}>
                    <Point icon="shield-check">The data is encrypted on this device with a key your passkey unlocks.</Point>
                    <Point icon="key">You also get a recovery key. If you lose the passkey and the key, the data cannot be recovered by anyone.</Point>
                    <Point icon="info">It protects stored data from someone reading the browser&apos;s files. It does not protect against malicious scripts running on this page.</Point>
                  </ul>
                ) : null}
                {step === 'working' ? (
                  <div className={cn('flex items-center gap-2 text-subhead', vaultMutedClass)}>
                    <Spinner size={18} />
                    <span>Waiting for your passkey…</span>
                  </div>
                ) : null}
                {error ? (
                  <p id={errorId} role="alert" className={calloutVariants({ tone: 'destructive' })}>
                    <Icon name="exclamation-circle" size={16} />
                    <span className="min-w-0 [overflow-wrap:anywhere]">{error}</span>
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                {step === 'working' ? (
                  <Button variant="secondary" onClick={cancel}>Cancel</Button>
                ) : (
                  <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
                )}
                {/* Pending for as long as the passkey prompt is up: the press returns its Promise. */}
                <Button ref={primary} className={vaultActionClass} onClick={() => start()} aria-describedby={error ? errorId : undefined}>
                  {regenerate ? 'Continue with passkey' : 'Create passkey'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="grid gap-3 px-5 pt-1 pb-3 text-subhead">
                <p id={`${descriptionId}-recovery`} className={description}>
                  This is the only way back in if you lose your passkey. It is shown once and not stored anywhere.
                </p>
                <VaultRecoveryKey value={recoveryKey ?? ''} />
                {/* Two equal buttons; 44px tall where the dialog is a sheet on a touch screen. */}
                <div className="grid grid-cols-2 gap-2 *:group-data-[presentation=sheet]/dialog:h-11">
                  <Button variant="secondary" autoFocus onClick={() => void copy()}>
                    <Icon name={copied ? 'check' : 'copy'} size={15} />
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button variant="secondary" onClick={() => download(`${(appName ?? 'vault').toLowerCase().replace(/\s+/g, '-')}-recovery-key.txt`, `${name} recovery key\n\n${recoveryKey}\n\nAnyone with this key can read the data it protects. Keep it somewhere safe and private.\n`)}>
                    <Icon name="download" size={15} />
                    Save as file
                  </Button>
                </div>
                <p className={cn('m-0 text-footnote', vaultMutedClass)}>
                  Keep it in a password manager or print it. Anyone who has it can open your data, and nobody can reissue it.
                </p>
                {copyFailed ? <p role="alert" className={cn('m-0 text-footnote', vaultErrorClass)}>Copying was blocked. Select the key and copy it by hand.</p> : null}
                {requireVerification ? (
                  <Field invalid={typed.length > 0 && !verified && typed.replace(/[\s-]/g, '').length >= 32}>
                    <FieldLabel className={vaultMutedClass}>Type the key to confirm you saved it</FieldLabel>
                    <Input value={typed} onValueChange={setTyped} autoComplete="off" className="font-mono" spellCheck={false} autoCapitalize="characters" autoCorrect="off" />
                    <FieldError>That does not match the recovery key above.</FieldError>
                  </Field>
                ) : null}
                <Label variant="control" className="text-subhead">
                  <Checkbox checked={saved} onCheckedChange={(checked) => setSaved(checked === true)} shape="square" />
                  I saved my recovery key somewhere safe
                </Label>
                {error ? <p role="alert" className={cn('m-0 text-footnote', vaultErrorClass)}>{error}</p> : null}
              </div>
              <DialogFooter>
                <DialogClose value="done" action={finish} disabled={!saved || !verified} render={<Button className={vaultActionClass} />}>
                  Done
                </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogView>
      </DialogContent>
    </Dialog>
  );
}

function Point({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Icon name={icon} size={18} className="mt-0.5 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}

/* ── set up ── */

export interface VaultSetupProps extends Omit<ComponentProps<'section'>, 'title'> {
  vault?: Vault;
  appName?: string;
  protects?: ReactNode;
  requireVerification?: boolean;
  /** Called when the button is pressed. Pass it when a parent owns the `VaultEnrollDialog` (as `VaultGate` does): the
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
      <Button size="lg" className={cn('w-full', vaultActionClass)} onClick={() => (onSetup ? onSetup() : setOpen(true))}>
        <Icon name="passkey" size={18} />
        Set up passkey
      </Button>
      {onSetup ? null : <VaultEnrollDialog open={open} onOpenChange={setOpen} vault={v} appName={appName} protects={protects} requireVerification={requireVerification} />}
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
      {why ? <p className={cn('m-0 text-footnote', vaultMutedClass)}>{vaultUnsupportedMessage(why).title}. Your recovery key still works.</p> : null}

      {mode === 'passkey' ? (
        // Pending while the passkey prompt is up: the press returns its Promise.
        <Button size="lg" className={cn('w-full', vaultActionClass)} autoFocus={autoFocus} onClick={() => (unlocking ? undefined : run(() => v.unlock()))}>
          {unlocking ? <Spinner size={18} /> : <Icon name="passkey" size={18} />}
          {unlocking ? 'Waiting for passkey' : 'Unlock with passkey'}
        </Button>
      ) : (
        <form className="grid w-full gap-3 text-left" onSubmit={submitRecovery} noValidate>
          <Field invalid={error !== null}>
            <FieldLabel className={vaultMutedClass}>Recovery key</FieldLabel>
            <Input value={text} onValueChange={setText} autoComplete="off" autoFocus={autoFocus} className="font-mono uppercase" spellCheck={false} autoCapitalize="characters" autoCorrect="off" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" />
            <FieldDescription className={vaultMutedClass}>Eight groups of four letters and digits. Case and dashes don&apos;t matter.</FieldDescription>
          </Field>
          {/* Still focusable while it unlocks, so focus isn't dropped mid-way. */}
          <Button type="submit" size="lg" className={vaultActionClass} disabled={!text.trim() || unlocking} focusableWhenDisabled={unlocking}>
            {unlocking ? 'Unlocking' : 'Unlock with recovery key'}
          </Button>
        </form>
      )}

      {error ? <p role="alert" className={cn('m-0 text-footnote', vaultErrorClass)}>{error}</p> : null}

      <div className="flex flex-col items-center gap-1">
        {!passkeyOff ? (
          <Button variant="plain" size="sm" className={vaultLinkClass} onClick={() => { setError(null); setMode(mode === 'passkey' ? 'recovery' : 'passkey'); }}>
            {mode === 'passkey' ? 'Use recovery key instead' : 'Use passkey instead'}
          </Button>
        ) : null}
        <AlertDialog>
          <AlertDialogTrigger className={cn(buttonVariants({ variant: 'plain', size: 'sm' }), vaultMutedClass)}>Lost both? Erase this vault…</AlertDialogTrigger>
          <AlertDialogBackdrop />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Erase this vault?</AlertDialogTitle>
              <AlertDialogDescription>Everything stored in it is deleted from this browser and cannot be recovered. You can then set it up again.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose variant="cancel" className={vaultLinkClass}>Cancel</AlertDialogClose>
              <AlertDialogClose variant="destructive" value="confirm" className={vaultErrorClass} action={() => { setError(null); v.reset().catch((e) => setError(vaultErrorMessage(e))); }}>Erase</AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Panel>
  );
}

/* ── gate ── */

/** The screens a VaultGate shows instead of its children, one per status; each replaces the kit's own. */
export interface VaultGateScreens {
  /** While the vault checks passkey support (default: a spinner). */
  loading?: ReactNode;
  /** No passkeys here (default: VaultUnsupported). A function gets the vault's state. */
  unsupported?: ReactNode | ((state: VaultState) => ReactNode);
  /** Nothing set up yet (default: VaultSetup). */
  empty?: ReactNode;
  /** Set up and locked (default: VaultUnlock). */
  locked?: ReactNode;
}

export interface VaultGateProps {
  vault?: Vault;
  appName?: string;
  /** What the vault protects, for the set-up screen's wording. */
  protects?: ReactNode;
  requireVerification?: boolean;
  /** Replace the screen for a given status. `unsupported` can render `children` to carry on without protection: your
   *  call, made visible. */
  screens?: VaultGateScreens;
  /** While unlocked and the recovery key was never confirmed, show a notice with a button to replace it (default true). */
  recoveryNotice?: boolean;
  /** On the gate's box, which fills its host (a column: the notice, then your app). */
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const ANNOUNCE: Partial<Record<VaultStatus, string>> = { unlocked: 'Unlocked.', locked: 'Locked.' };

/** Renders `children` only while the vault is unlocked; otherwise the screen the status calls for, centred in the
    gate's box. */
export function VaultGate({
  vault, appName, protects, requireVerification, screens = {}, recoveryNotice = true, className, style, children,
}: VaultGateProps) {
  const { loading, unsupported, empty, locked } = screens;
  const v = useVault(vault);
  const state = v.getState();
  // The dialog lives here, above the status switch: enrolling flips the status to `unlocked` before the recovery key
  // has been shown, and the screens below unmount at that moment.
  const [dialog, setDialog] = useState<{ open: boolean; mode: 'enroll' | 'regenerate' }>({ open: false, mode: 'enroll' });
  const first = useRef(true);
  const root = useRef<HTMLDivElement>(null);

  // Say what changed ("Locked." after an auto-lock) without ever including a secret, in UI SDK's polite live region.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const message = ANNOUNCE[state.status];
    if (message) announce(message, { doc: root.current?.ownerDocument });
  }, [state.status]);

  let body: ReactNode;
  switch (state.status) {
    case 'loading':
      body = loading ?? (
        <div className={cn('grid flex-1 place-items-center p-8', vaultMutedClass)}>
          <Spinner size={24} label="Checking passkey support" />
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
            <div role="region" aria-label="Recovery key" className="m-3 flex shrink-0 items-center gap-3 rounded-card bg-secondary p-3 text-subhead">
              <Icon name="key" size={20} className="shrink-0 text-primary" />
              <span className="min-w-0 flex-1">You haven&apos;t confirmed saving your recovery key. Without it, losing your passkey means losing your data.</span>
              <Button size="sm" className={vaultActionClass} onClick={() => setDialog({ open: true, mode: 'regenerate' })}>Get a new key</Button>
            </div>
          ) : null}
          {children}
        </>
      );
  }

  return (
    <div ref={root} data-slot="vault-gate" data-status={state.status} className={cn('flex h-full min-h-0 flex-col', className)} style={style}>
      {body}
      <VaultEnrollDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        vault={v}
        mode={dialog.mode}
        appName={appName}
        protects={protects}
        requireVerification={requireVerification}
      />
    </div>
  );
}

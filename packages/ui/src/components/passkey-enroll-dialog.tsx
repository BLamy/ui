'use client';
import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { VisuallyHidden } from 'react-aria';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { FieldError, TextField } from '@/components/ui/text-field';
import { Icon, type IconName } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { type Vault } from '@/lib/vault';
import { useVault, vaultErrorMessage } from '@/lib/vault-react';

/* ══ PasskeyEnrollDialog — set up a passkey vault, then show the recovery key once ══
   Three steps in one dialog: explain what is protected → run the passkey ceremony → show the recovery key with Copy
   and Save-as-file, and make the person confirm they kept it (optionally by typing it back). The recovery key step
   cannot be dismissed by Esc or an outside press: the key is shown once, and closing by accident would lose it.
   `mode="regenerate"` runs the same steps to replace a recovery key.

   <BLProvider>
     <VaultProvider options={{ id: 'notes', rp: { name: 'Notes' } }}>
       <PasskeyEnrollDialog isOpen={open} onOpenChange={setOpen} appName="Notes" />
     </VaultProvider>
   </BLProvider> */

/* The theme's primary (white on the iOS blue, 3.6:1) and its muted text (3.3:1 on a grouped background) are under WCAG AA for body-size text.
   The vault's screens carry the text people must read to keep their data, so they darken the primary where it holds text and use
   a stronger muted colour. */
export const vaultActionClass = 'bg-[color-mix(in_oklab,var(--primary)_78%,black)]';
export const vaultLinkClass = 'text-[color-mix(in_oklab,var(--primary)_78%,black)] dark:text-primary';
export const vaultErrorClass = 'text-[color-mix(in_oklab,var(--destructive)_72%,black)] dark:text-destructive';
export const vaultMutedClass = 'text-foreground/70';

export interface PasskeyEnrollDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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
  className?: string;
  style?: ComponentProps<'div'>['style'];
}

type Step = 'intro' | 'working' | 'recovery';

export const recoveryKeyVariants = cva(
  'grid gap-x-3 gap-y-1 rounded-ctl bg-secondary px-3 py-3 font-mono text-callout font-semibold tracking-wide text-foreground tabular-nums select-text [-webkit-user-select:text]',
  {
    variants: { layout: { grid: 'grid-cols-2', row: 'grid-cols-4' } },
    defaultVariants: { layout: 'grid' },
  },
);

export interface RecoveryKeyProps extends Omit<ComponentProps<'div'>, 'children'>, VariantProps<typeof recoveryKeyVariants> {
  /** `XXXX-XXXX-…`, as returned by `vault.enroll()`. */
  value: string;
}

/** The recovery key in groups of four. A labelled group so a screen reader reads it as one thing; not a live region. */
export function RecoveryKey({ value, layout, className, ...props }: RecoveryKeyProps) {
  return (
    <div data-slot="recovery-key" role="group" aria-label="Recovery key" className={cn(recoveryKeyVariants({ layout }), className)} {...props}>
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

export function PasskeyEnrollDialog({
  isOpen, onOpenChange, vault, mode = 'enroll', appName, protects, requireVerification = false, onDone, className, style,
}: PasskeyEnrollDialogProps) {
  const v = useVault(vault);
  const [step, setStep] = useState<Step>('intro');
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [typed, setTyped] = useState('');
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [announce, setAnnounce] = useState('');
  const abort = useRef<AbortController | null>(null);
  const errorId = useId();
  const regenerate = mode === 'regenerate';
  const name = appName ?? 'this app';

  // Leaving the dialog (closed from outside, or unmounted) forgets the key and cancels an open prompt.
  useEffect(() => {
    if (isOpen) return;
    abort.current?.abort();
    setStep('intro'); setError(null); setRecoveryKey(null); setSaved(false); setTyped(''); setCopied('idle'); setAnnounce('');
  }, [isOpen]);
  useEffect(() => () => abort.current?.abort(), []);

  const verified = !requireVerification || (recoveryKey !== null && typed.replace(/[\s-]/g, '').toUpperCase() === recoveryKey.replace(/-/g, ''));

  async function start() {
    const ac = new AbortController();
    abort.current = ac;
    setError(null);
    setStep('working');
    setAnnounce("Waiting for your passkey. Follow your browser's prompt.");
    try {
      const key = regenerate ? await v.regenerateRecoveryKey({ signal: ac.signal }) : (await v.enroll({ signal: ac.signal })).recoveryKey;
      setRecoveryKey(key);
      setStep('recovery');
      setAnnounce('Your recovery key is ready. It is shown only once.');
    } catch (e) {
      if (ac.signal.aborted) return;
      setError(vaultErrorMessage(e));
      setStep('intro');
      setAnnounce('');
    }
  }

  /** Closes the open passkey prompt and goes back to the explanation. */
  function cancel() {
    abort.current?.abort();
    setStep('intro');
    setAnnounce('');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(recoveryKey ?? '');
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
  }

  async function finish() {
    try {
      await v.confirmRecoveryKey();
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      setError(vaultErrorMessage(e));
    }
  }

  const recoveryStep = step === 'recovery';

  return (
    <DialogContent
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={!recoveryStep}
      isKeyboardDismissDisabled={recoveryStep}
      className={className}
    >
      {({ close }) => (
        <div data-slot="passkey-enroll-dialog" className="flex min-h-0 flex-1 flex-col" style={style}>
          <DialogHeader>
            <DialogTitle>
              {recoveryStep ? 'Save your recovery key' : regenerate ? 'Replace your recovery key' : `Protect ${name} with a passkey`}
            </DialogTitle>
            <DialogDescription className={vaultMutedClass}>
              {recoveryStep
                ? 'This is the only way back in if you lose your passkey. It is shown once and not stored anywhere.'
                : regenerate
                  ? 'You will confirm with your passkey. The old recovery key stops working as soon as the new one exists.'
                  : <>A passkey will lock {protects ?? 'what this app saves in this browser'}. Only you can unlock it, with your fingerprint, face or device PIN.</>}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="grid gap-3 pb-3">
            {!recoveryStep ? (
              <>
                {!regenerate ? (
                  <ul className={cn('m-0 grid list-none gap-2 p-0 text-subhead', vaultMutedClass)}>
                    <Point icon="shield-check">The data is encrypted on this device with a key your passkey unlocks.</Point>
                    <Point icon="key">You also get a recovery key. If you lose the passkey and the key, the data cannot be recovered by anyone.</Point>
                    <Point icon="info">It protects stored data from someone reading the browser&apos;s files. It does not protect against malicious scripts running on this page.</Point>
                  </ul>
                ) : null}
                {step === 'working' ? (
                  <div className={cn('flex items-center gap-2 text-subhead', vaultMutedClass)}>
                    <Spinner spin size={18} />
                    <span>Waiting for your passkey…</span>
                  </div>
                ) : null}
                {error ? (
                  <p id={errorId} role="alert" className={cn('m-0 rounded-ctl bg-destructive/10 px-3 py-2 text-footnote', vaultErrorClass)}>{error}</p>
                ) : null}
              </>
            ) : (
              <>
                <RecoveryKey value={recoveryKey ?? ''} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" autoFocus onPress={() => void copy()}>
                    <Icon name={copied === 'copied' ? 'check' : 'copy'} size={15} />
                    {copied === 'copied' ? 'Copied' : 'Copy'}
                  </Button>
                  <Button variant="secondary" size="sm" onPress={() => download(`${(appName ?? 'vault').toLowerCase().replace(/\s+/g, '-')}-recovery-key.txt`, `${name} recovery key\n\n${recoveryKey}\n\nAnyone with this key can read the data it protects. Keep it somewhere safe and private.\n`)}>
                    <Icon name="download" size={15} />
                    Save as file
                  </Button>
                </div>
                <p className={cn('m-0 text-footnote', vaultMutedClass)}>
                  Keep it in a password manager or print it. Anyone who has it can open your data, and nobody can reissue it.
                </p>
                {copied === 'failed' ? <p role="alert" className={cn('m-0 text-footnote', vaultErrorClass)}>Copying was blocked. Select the key and copy it by hand.</p> : null}
                {requireVerification ? (
                  <TextField value={typed} onChange={setTyped} isInvalid={typed.length > 0 && !verified && typed.replace(/[\s-]/g, '').length >= 32} autoComplete="off">
                    <Label variant="field" className={vaultMutedClass}>Type the key to confirm you saved it</Label>
                    <Input className="font-mono" spellCheck={false} autoCapitalize="characters" autoCorrect="off" />
                    <FieldError>That does not match the recovery key above.</FieldError>
                  </TextField>
                ) : null}
                <Checkbox isSelected={saved} onChange={setSaved} shape="square" className="text-subhead">
                  I saved my recovery key somewhere safe
                </Checkbox>
                {error ? <p role="alert" className={cn('m-0 text-footnote', vaultErrorClass)}>{error}</p> : null}
              </>
            )}
          </DialogBody>

          <DialogFooter>
            {!recoveryStep ? (
              <>
                <Button variant="ghost" onPress={step === 'working' ? cancel : close}>Cancel</Button>
                <Button className={vaultActionClass} autoFocus isPending={step === 'working'} onPress={() => void start()} aria-describedby={error ? errorId : undefined}>
                  {regenerate ? 'Continue with passkey' : 'Create passkey'}
                </Button>
              </>
            ) : (
              <Button className={vaultActionClass} isDisabled={!saved || !verified} onPress={() => void finish()}>Done</Button>
            )}
          </DialogFooter>

          <VisuallyHidden>
            <span role="status" aria-live="polite">{announce}</span>
          </VisuallyHidden>
        </div>
      )}
    </DialogContent>
  );
}

function Point({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Icon name={icon} size={18} className="mt-0.5 text-primary" />
      <span>{children}</span>
    </li>
  );
}

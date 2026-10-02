import { useEffect, useRef, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { PasskeyEnrollDialog } from '@/components/ui/passkey-enroll-dialog';
import { VaultGate, VaultSetup, VaultStatusBadge, VaultUnlock, VaultUnsupported } from '@/components/ui/vault-gate';
import { PasskeyError } from '@/lib/passkey';
import type { Vault, VaultState, VaultUnsupportedReason } from '@/lib/vault';
import { Pad, Phone } from '../stories/frame';

const meta: Meta<typeof VaultGate> = {
  title: 'Molecules/PasskeyVault',
  component: VaultGate,
};
export default meta;
type Story = StoryObj<typeof VaultGate>;

/* Stories show states, not cryptography: a vault whose snapshot is fixed and whose passkey calls are stubs. */
const SUPPORT = { secureContext: true, webauthn: true, platformAuthenticator: true, prf: 'yes' } as const;
const BASE: VaultState = {
  status: 'empty', unsupportedReason: null, support: SUPPORT, passkeys: [], hasRecoveryKey: false, recoveryConfirmed: false, busy: null, quarantined: 0,
};
const KEY = '7QX2-M9KD-3FHT-VWB8-R4ZN-0PC6-GJ5Y-E1AS';

function stubVault(patch: Partial<VaultState>, enroll: Vault['enroll'] = async () => ({ recoveryKey: KEY })): Vault {
  const state: VaultState = { ...BASE, ...patch };
  const noop = async () => undefined;
  return {
    id: 'story', status: state.status, getState: () => state, getServerState: () => state, subscribe: () => () => undefined,
    init: noop, enroll, unlock: noop, unlockWithRecoveryKey: noop, lock: () => undefined,
    put: noop, get: async () => undefined, list: async () => [], delete: noop, watch: () => () => undefined,
    addPasskey: noop, removePasskey: noop, regenerateRecoveryKey: async () => KEY, confirmRecoveryKey: noop, verifyRecoveryKey: async () => true,
    reset: noop, listQuarantine: async () => [], touch: () => undefined, dispose: () => undefined,
  };
}

const enrolled: Partial<VaultState> = {
  status: 'locked', passkeys: [{ id: 'abc', label: 'Passkey', createdAt: 0 }], hasRecoveryKey: true, recoveryConfirmed: true,
};

const Demo = ({ children }: { children?: ReactNode }) => (
  <div className="grid h-full content-center bg-background">{children}</div>
);

export const Setup: Story = {
  render: () => <Phone h={560}><VaultGate vault={stubVault({})} appName="Notes"><Demo>unlocked</Demo></VaultGate></Phone>,
};
export const SetupDark: Story = {
  render: () => <Phone h={560} dark><VaultGate vault={stubVault({})} appName="Notes"><Demo>unlocked</Demo></VaultGate></Phone>,
};
export const Locked: Story = {
  render: () => <Phone h={560}><VaultGate vault={stubVault(enrolled)} appName="Notes"><Demo>unlocked</Demo></VaultGate></Phone>,
};
export const LockedDark: Story = {
  render: () => <Phone h={560} dark><VaultGate vault={stubVault(enrolled)} appName="Notes"><Demo>unlocked</Demo></VaultGate></Phone>,
};
export const Unlocking: Story = {
  render: () => <Phone h={560}><VaultUnlock vault={stubVault({ ...enrolled, busy: 'unlock' })} appName="Notes" autoFocus={false} /></Phone>,
};
/** An existing vault opened where passkeys do not work: the recovery key is the way in, and the screen says so. */
export const LockedWithoutPasskeys: Story = {
  render: () => (
    <Phone h={560}>
      <VaultUnlock vault={stubVault({ ...enrolled, support: { ...SUPPORT, webauthn: false, prf: 'no' } })} appName="Notes" autoFocus={false} />
    </Phone>
  ),
};
export const UnlockedRecoveryNotConfirmed: Story = {
  render: () => (
    <Phone h={360}>
      <VaultGate vault={stubVault({ ...enrolled, status: 'unlocked', recoveryConfirmed: false })} appName="Notes"><Demo>Your app</Demo></VaultGate>
    </Phone>
  ),
};

const REASONS: VaultUnsupportedReason[] = ['insecure-context', 'no-webauthn', 'no-prf', 'storage', 'newer-version'];
/** Every reason the vault can be unavailable, in the words a person sees. */
export const UnsupportedReasons: Story = {
  render: () => (
    <Pad w={420}>
      <div className="grid gap-2">
        {REASONS.map((reason) => (
          <div key={reason} className="rounded-card bg-card">
            <VaultUnsupported vault={stubVault({ status: 'unsupported', unsupportedReason: reason })} />
          </div>
        ))}
      </div>
    </Pad>
  ),
};

export const StatusBadges: Story = {
  render: () => (
    <Pad w={420}>
      <div className="flex flex-wrap gap-2">
        {(['loading', 'unsupported', 'empty', 'locked', 'unlocked'] as const).map((status) => (
          <VaultStatusBadge key={status} vault={stubVault({ status })} />
        ))}
      </div>
    </Pad>
  ),
};

/** Presses the dialog's primary button once it is on screen, to show the step after it. */
function PressOnMount({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const target = Array.from(ref.current?.ownerDocument.querySelectorAll<HTMLButtonElement>('[role=dialog] button') ?? []).find((b) => b.textContent?.trim() === label);
      target?.click();
    }, 900);
    return () => window.clearTimeout(t);
  }, [label]);
  return <div ref={ref} className="contents">{children}</div>;
}

const dialog = (vault: Vault) => (
  <PasskeyEnrollDialog isOpen onOpenChange={() => undefined} vault={vault} appName="Notes" protects="your notes" />
);

export const EnrollDialog: Story = {
  render: () => <Phone h={640}><Demo><div className="p-4"><Button>Set up</Button></div>{dialog(stubVault({}))}</Demo></Phone>,
};
export const EnrollDialogDark: Story = {
  render: () => <Phone h={640} dark><Demo><div className="p-4"><Button>Set up</Button></div>{dialog(stubVault({}))}</Demo></Phone>,
};
export const EnrollDialogRecoveryKey: Story = {
  render: () => (
    <Phone h={640}>
      <PressOnMount label="Create passkey"><Demo>{dialog(stubVault({}))}</Demo></PressOnMount>
    </Phone>
  ),
};
export const EnrollDialogRecoveryKeyDark: Story = {
  render: () => (
    <Phone h={640} dark>
      <PressOnMount label="Create passkey"><Demo>{dialog(stubVault({}))}</Demo></PressOnMount>
    </Phone>
  ),
};
/** The authenticator has no PRF: the dialog says why and nothing was saved. */
export const EnrollDialogNoPrf: Story = {
  render: () => (
    <Phone h={640}>
      <PressOnMount label="Create passkey">
        <Demo>{dialog(stubVault({}, async () => { throw new PasskeyError('no-prf', 'no prf'); }))}</Demo>
      </PressOnMount>
    </Phone>
  ),
};

export const SetupPart: Story = {
  name: 'Setup (standalone part)',
  render: () => <Pad w={400}><VaultSetup vault={stubVault({})} appName="Notes" /></Pad>,
};

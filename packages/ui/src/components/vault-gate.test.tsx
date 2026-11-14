// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PasskeyEnrollDialog } from '@/components/ui/passkey-enroll-dialog';
import { VaultUnlock } from '@/components/ui/vault-gate';
import type { Vault, VaultState } from '@/lib/vault';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const settle = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

/* A vault whose snapshot is fixed and whose passkey calls are stubs: these tests are about the dialogs. */
const KEY = '7QX2-M9KD-3FHT-VWB8-R4ZN-0PC6-GJ5Y-E1AS';
function stubVault(patch: Partial<VaultState> = {}, extra: Partial<Vault> = {}): Vault {
  const state: VaultState = {
    status: 'empty', unsupportedReason: null, passkeys: [], hasRecoveryKey: false, recoveryConfirmed: false, busy: null, quarantined: 0,
    support: { secureContext: true, webauthn: true, platformAuthenticator: true, prf: 'yes' },
    ...patch,
  };
  const noop = async () => undefined;
  return {
    id: 'test', status: state.status, getState: () => state, getServerState: () => state, subscribe: () => () => undefined,
    init: noop, enroll: async () => ({ recoveryKey: KEY }), unlock: noop, unlockWithRecoveryKey: noop, lock: () => undefined,
    put: noop, get: async () => undefined, list: async () => [], delete: noop, watch: () => () => undefined,
    addPasskey: noop, removePasskey: noop, regenerateRecoveryKey: async () => KEY, confirmRecoveryKey: noop, verifyRecoveryKey: async () => true,
    reset: noop, listQuarantine: async () => [], touch: () => undefined, dispose: () => undefined,
    ...extra,
  };
}

function Enroll({ vault, onOpenChange }: { vault: Vault; onOpenChange?: (open: boolean, details: { reason: string }) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <PasskeyEnrollDialog
      open={open}
      onOpenChange={(next, details) => { onOpenChange?.(next, details); setOpen(next); }}
      vault={vault}
      appName="Notes"
    />
  );
}

describe('PasskeyEnrollDialog', () => {
  it('opens named by its title, with focus on its primary action, and Cancel closes it', async () => {
    const onOpenChange = vi.fn();
    render(<Enroll vault={stubVault()} onOpenChange={onOpenChange} />);
    await settle();
    const dialog = screen.getByRole('dialog', { name: /passkey/i });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Create passkey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle(400);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the recovery key and cannot be dismissed until it is saved', async () => {
    const onOpenChange = vi.fn();
    render(<Enroll vault={stubVault()} onOpenChange={onOpenChange} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Create passkey' }));
    await settle();
    expect(screen.getByRole('dialog', { name: 'Save your recovery key' })).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await settle();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    const done = screen.getByText('Done').closest('button')!;
    expect((done as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /saved my recovery key/i }));
    await settle();
    expect((done as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(done);
    await settle(400);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything());
  });
});

describe('VaultUnlock', () => {
  it('erases the vault only after the alert is answered with Erase', async () => {
    const reset = vi.fn(async () => undefined);
    const locked = { status: 'locked', passkeys: [{ id: 'a', label: 'Passkey', createdAt: 0 }], hasRecoveryKey: true, recoveryConfirmed: true } as const;
    render(<VaultUnlock vault={stubVault(locked, { reset })} autoFocus={false} />);
    await settle();
    const trigger = screen.getByRole('button', { name: /erase this vault/i });
    fireEvent.click(trigger);
    await settle();
    const alert = screen.getByRole('alertdialog', { name: 'Erase this vault?' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle(400);
    expect(reset).not.toHaveBeenCalled();
    expect(alert.isConnected).toBe(false);
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Erase' }));
    await settle(400);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

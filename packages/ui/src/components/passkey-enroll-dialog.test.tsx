// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { PasskeyEnrollDialog } from '@/components/ui/passkey-enroll-dialog';
import { VaultGate } from '@/components/ui/vault-gate';
import type { Vault, VaultState } from '@/lib/vault';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
// The buttons' label morphs are framer-motion; happy-dom rejects a canceled WAAPI animation nobody awaits.
MotionGlobalConfig.skipAnimations = true;

afterEach(cleanup);

const settle = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
/** What UI SDK's polite live region (`announce()`, one per page) has said. */
const spoken = () => document.querySelector('[data-ui-sdk-announcer=""]')?.textContent ?? '';
const announced = (text: string) => waitFor(() => expect(spoken()).toContain(text), { timeout: 2000 });

const KEY = '7QX2-M9KD-3FHT-VWB8-R4ZN-0PC6-GJ5Y-E1AS';

/** A vault with stub passkey calls whose status can be changed from the test (`set`). */
function stubVault(patch: Partial<VaultState> = {}, extra: Partial<Vault> = {}) {
  let state: VaultState = {
    status: 'empty', unsupportedReason: null, passkeys: [], hasRecoveryKey: false, recoveryConfirmed: false, busy: null, quarantined: 0,
    support: { secureContext: true, webauthn: true, platformAuthenticator: true, prf: 'yes' },
    ...patch,
  };
  const listeners = new Set<() => void>();
  const noop = async () => undefined;
  const vault: Vault = {
    id: 'test', get status() { return state.status; }, getState: () => state, getServerState: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    init: noop, enroll: async () => ({ recoveryKey: KEY }), unlock: noop, unlockWithRecoveryKey: noop, lock: () => undefined,
    put: noop, get: async () => undefined, list: async () => [], delete: noop, watch: () => () => undefined,
    addPasskey: noop, removePasskey: noop, regenerateRecoveryKey: async () => KEY, confirmRecoveryKey: noop, verifyRecoveryKey: async () => true,
    reset: noop, listQuarantine: async () => [], touch: () => undefined, dispose: () => undefined,
    ...extra,
  } as Vault;
  const set = (next: Partial<VaultState>) => act(() => { state = { ...state, ...next }; listeners.forEach((l) => l()); });
  return { vault, set };
}

type OpenChange = React.ComponentProps<typeof PasskeyEnrollDialog>['onOpenChange'];
function Enroll({ onOpenChange, ...props }: Partial<React.ComponentProps<typeof PasskeyEnrollDialog>> & { vault: Vault }) {
  const [open, setOpen] = useState(true);
  const change: OpenChange = (next, details) => { onOpenChange?.(next, details); setOpen(next); };
  return <PasskeyEnrollDialog open={open} onOpenChange={change} appName="Notes" {...props} />;
}

describe('PasskeyEnrollDialog', () => {
  it('announces the ceremony and the key through UI SDK, with no live region of its own', async () => {
    let finish: (value: { recoveryKey: string }) => void = () => undefined;
    const enroll = vi.fn(() => new Promise<{ recoveryKey: string }>((resolve) => { finish = resolve; }));
    render(<Enroll vault={stubVault({}, { enroll }).vault} />);
    await settle();
    const dialog = screen.getByRole('dialog', { name: 'Protect Notes with a passkey' });
    expect(dialog.querySelector('[aria-live]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create passkey' }));
    await announced("Waiting for your passkey. Follow your browser's prompt.");
    expect(screen.getByText('Waiting for your passkey…')).toBeTruthy();
    await act(async () => { finish({ recoveryKey: KEY }); });
    await announced('Your recovery key is ready. It is shown only once.');
    expect(screen.getByRole('group', { name: 'Recovery key' }).textContent).toContain('7 Q X 2');
  });

  it('cancels an open passkey prompt and goes back to the explanation', async () => {
    let signal: AbortSignal | undefined;
    const enroll = vi.fn((options?: { signal?: AbortSignal }) => {
      signal = options?.signal;
      return new Promise<{ recoveryKey: string }>(() => undefined);
    });
    const { vault } = stubVault({}, { enroll: enroll as Vault['enroll'] });
    render(<Enroll vault={vault} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Create passkey' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText('Waiting for your passkey…')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Protect Notes with a passkey' })).toBeTruthy();
  });

  it('shows a failure as an alert the primary action points to', async () => {
    const failing = stubVault({}, { enroll: async () => { throw new Error('NotAllowedError'); } });
    render(<Enroll vault={failing.vault} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Create passkey' }));
    await settle();
    const alert = screen.getByRole('alert');
    const primary = screen.getByRole('button', { name: 'Create passkey' });
    expect(primary.getAttribute('aria-describedby')).toBe(alert.id);
  });

  it('with requireVerification, Done waits for the key typed back and the box ticked', async () => {
    const confirmRecoveryKey = vi.fn(async () => undefined);
    const onDone = vi.fn();
    render(<Enroll vault={stubVault({}, { confirmRecoveryKey }).vault} requireVerification onDone={onDone} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Create passkey' }));
    await settle();
    const done = screen.getByText('Done').closest('button') as HTMLButtonElement;
    fireEvent.click(screen.getByRole('checkbox', { name: /saved my recovery key/i }));
    await settle();
    expect(done.disabled).toBe(true);
    const field = screen.getByRole('textbox', { name: 'Type the key to confirm you saved it' });
    fireEvent.input(field, { target: { value: KEY.toLowerCase().replace(/-/g, ' ') } });
    await settle();
    expect(done.disabled).toBe(false);
    fireEvent.click(done);
    await settle(400);
    expect(confirmRecoveryKey).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Cancel is the dialog\'s Close part: onOpenChange hears close-press', async () => {
    const onOpenChange = vi.fn();
    render(<Enroll vault={stubVault().vault} onOpenChange={onOpenChange} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle(400);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
    expect(onOpenChange.mock.calls[0][1]).toMatchObject({ reason: 'close-press' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Done closes with reason action and returnValue "done", and stays open showing the error when confirming fails', async () => {
    const onOpenChange = vi.fn();
    const onDone = vi.fn();
    const confirmRecoveryKey = vi.fn()
      .mockRejectedValueOnce(new Error('Could not save'))
      .mockResolvedValueOnce(undefined);
    render(<Enroll vault={stubVault({}, { confirmRecoveryKey }).vault} onOpenChange={onOpenChange} onDone={onDone} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Create passkey' }));
    await settle();
    fireEvent.click(screen.getByRole('checkbox', { name: /saved my recovery key/i }));
    await settle();
    const done = screen.getByText('Done').closest('button') as HTMLButtonElement;
    fireEvent.click(done);
    await settle(400);
    expect(confirmRecoveryKey).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Save your recovery key' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBeTruthy();
    fireEvent.click(done);
    await settle(400);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0][1]).toMatchObject({ reason: 'action', returnValue: 'done' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('in regenerate mode replaces the key of an existing vault', async () => {
    const regenerateRecoveryKey = vi.fn(async () => KEY);
    const enroll = vi.fn();
    render(<Enroll vault={stubVault({ status: 'unlocked' }, { regenerateRecoveryKey, enroll }).vault} mode="regenerate" />);
    await settle();
    expect(screen.getByRole('dialog', { name: 'Replace your recovery key' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with passkey' }));
    await settle();
    expect(regenerateRecoveryKey).toHaveBeenCalledTimes(1);
    expect(enroll).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Save your recovery key' })).toBeTruthy();
  });
});

describe('VaultGate', () => {
  it('announces locking and unlocking through UI SDK, never on first paint', async () => {
    const { vault, set } = stubVault({ status: 'unlocked', recoveryConfirmed: true, passkeys: [{ id: 'a', label: 'Passkey', createdAt: 0 }], hasRecoveryKey: true });
    const { container } = render(<VaultGate vault={vault} appName="Notes"><p>Secret notes</p></VaultGate>);
    await settle();
    expect(screen.getByText('Secret notes')).toBeTruthy();
    expect(container.querySelector('[aria-live]')).toBeNull();
    expect(spoken()).not.toContain('Unlocked.');
    set({ status: 'locked' });
    await announced('Locked.');
    expect(screen.queryByText('Secret notes')).toBeNull();
    set({ status: 'unlocked' });
    await announced('Unlocked.');
  });

  it('while it checks support, shows a named spinner and no hand-made status region', async () => {
    const { vault } = stubVault({ status: 'loading' });
    const { container } = render(<VaultGate vault={vault} appName="Notes"><p>Secret notes</p></VaultGate>);
    await settle();
    const status = screen.getByRole('status', { name: 'Checking passkey support' });
    expect(status.getAttribute('data-slot')).toBe('spinner');
    expect(container.querySelectorAll('[role=status]')).toHaveLength(1);
    expect(screen.queryByText('Secret notes')).toBeNull();
  });
});

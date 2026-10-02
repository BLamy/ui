import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test, expect } from '@playwright/test';
import { openDemo } from './helpers.mjs';

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

/* The passkey vault, end to end, against Chromium's virtual authenticator (CDP `WebAuthn.*`). With `hasPrf: true` the
   virtual authenticator implements the real PRF/hmac-secret extension, so these tests derive, wrap and unwrap real
   keys: nothing about the passkey is mocked. They drive the docs' `passkey-vault/gate` demo (a note behind a VaultGate)
   and `passkey-vault/prf` (the bare passkey layer). Each test gets a fresh browser context, so a fresh IndexedDB. */

const GATE = 'passkey-vault/gate';
const READY = '[data-slot=vault-gate]';
const NOTE = 'A note only the passkey can read';

/** Attaches a virtual authenticator (CTAP 2.1, internal, resident keys, user verification, PRF) to a page. */
async function authenticator(page, options = {}) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal',
      hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true,
      hasPrf: true,
      ...options,
    },
  });
  return {
    cdp,
    id: authenticatorId,
    credentials: async () => (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials,
    clear: () => cdp.send('WebAuthn.clearCredentials', { authenticatorId }),
    setVerified: (isUserVerified) => cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified }),
    remove: () => cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId }),
  };
}

const status = (page) => page.locator(READY).first().getAttribute('data-status');
const waitStatus = (page, want) => expect(page.locator(`${READY}[data-status=${want}]`)).toBeVisible({ timeout: 15_000 });
const note = (page) => page.getByRole('textbox', { name: 'Private note' });

/** Sets up the vault through the UI. Returns the recovery key as shown. */
async function enroll(page, { confirm = true } = {}) {
  await waitStatus(page, 'empty');
  await page.getByRole('button', { name: 'Set up passkey' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Create passkey' }).click();
  const key = dialog.locator('[data-slot=recovery-key]');
  await expect(key).toBeVisible({ timeout: 15_000 });
  const recoveryKey = (await key.locator('span[aria-hidden]').allTextContents()).join('-');
  expect(recoveryKey).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
  if (confirm) {
    await expect(dialog.getByRole('button', { name: 'Done' })).toBeDisabled();
    await dialog.getByText('I saved my recovery key').click();
    await expect(dialog.getByRole('checkbox', { name: /saved my recovery key/ })).toBeChecked();
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await waitStatus(page, 'unlocked');
  }
  return recoveryKey;
}

/** Everything the vault left in IndexedDB, as one string. */
const dumpStorage = (page) => page.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open('bl-vault');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const tx = open.result.transaction('kv');
    const store = tx.objectStore('kv');
    const keys = store.getAllKeys();
    const values = store.getAll();
    tx.oncomplete = () => resolve(JSON.stringify({ keys: keys.result, values: values.result }));
  };
}));

/** Has a record (or the envelope) reached IndexedDB yet? Writes are queued behind the encryption, so wait for them. */
const hasRecord = async (page) => JSON.parse(await dumpStorage(page)).keys.some((k) => k.includes('/r/'));
const hasEnvelope = async (page) => JSON.parse(await dumpStorage(page)).keys.some((k) => k.endsWith('/meta'));

test.describe('with a PRF-capable authenticator', () => {
  let auth;
  test.beforeEach(async ({ page }) => {
    auth = await authenticator(page);
    await openDemo(page, GATE, READY);
  });

  test('set up, write, lock, unlock with the passkey', async ({ page }) => {
    await enroll(page);
    await note(page).fill(NOTE);
    await page.getByRole('button', { name: 'Lock', exact: true }).click();
    await waitStatus(page, 'locked');
    await expect(page.getByRole('textbox', { name: 'Private note' })).toHaveCount(0); // the app is not rendered while locked
    await page.getByRole('button', { name: 'Unlock with passkey' }).click();
    await waitStatus(page, 'unlocked');
    await expect(note(page)).toHaveValue(NOTE);
  });

  test('the note survives a reload: locked on arrival, back after the passkey', async ({ page }) => {
    await enroll(page);
    await note(page).fill(NOTE);
    // `put` is queued behind the encryption: wait until the ciphertext is on disk before leaving.
    await expect.poll(() => hasRecord(page)).toBe(true);
    await page.reload({ waitUntil: 'load' });
    await waitStatus(page, 'locked');
    await page.getByRole('button', { name: 'Unlock with passkey' }).click();
    await waitStatus(page, 'unlocked');
    await expect(note(page)).toHaveValue(NOTE);
  });

  test('what is stored is ciphertext: no note text, no record name, no recovery key', async ({ page }) => {
    const recoveryKey = await enroll(page);
    await note(page).fill(NOTE);
    await expect.poll(() => hasRecord(page)).toBe(true);
    const dump = await dumpStorage(page);
    expect(dump).not.toContain(NOTE);
    expect(dump).not.toContain('"note"');
    expect(dump).not.toContain(recoveryKey);
    expect(dump).not.toContain(recoveryKey.replace(/-/g, ''));
    // …and not in localStorage / sessionStorage either
    const web = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]));
    expect(web).not.toContain(NOTE);
  });

  test('the recovery key unlocks; a wrong key is refused', async ({ page }) => {
    const recoveryKey = await enroll(page);
    await note(page).fill(NOTE);
    await expect.poll(() => hasRecord(page)).toBe(true);
    await page.getByRole('button', { name: 'Lock', exact: true }).click();
    await waitStatus(page, 'locked');
    await page.getByRole('button', { name: 'Use recovery key instead' }).click();
    const field = page.getByRole('textbox', { name: 'Recovery key' });
    await field.fill(recoveryKey.slice(0, -1) + (recoveryKey.endsWith('0') ? '1' : '0'));
    await page.getByRole('button', { name: 'Unlock with recovery key' }).click();
    await expect(page.getByRole('alert')).toContainText("doesn't open the vault");
    await expect(page.locator(`${READY}[data-status=locked]`)).toBeVisible();
    await field.fill(recoveryKey.toLowerCase().replace(/-/g, ' '));
    await page.getByRole('button', { name: 'Unlock with recovery key' }).click();
    await waitStatus(page, 'unlocked');
    await expect(note(page)).toHaveValue(NOTE);
  });

  test('a lost passkey: the unlock fails cleanly and the recovery key still opens everything', async ({ page }) => {
    const recoveryKey = await enroll(page);
    await note(page).fill(NOTE);
    await expect.poll(() => hasRecord(page)).toBe(true);
    await page.getByRole('button', { name: 'Lock', exact: true }).click();
    await waitStatus(page, 'locked');
    await auth.clear(); // the credential no longer exists anywhere
    expect(await auth.credentials()).toHaveLength(0);
    await page.getByRole('button', { name: 'Unlock with passkey' }).click();
    await expect(page.getByRole('alert')).toContainText('Nothing was changed', { timeout: 20_000 });
    await expect(page.locator(`${READY}[data-status=locked]`)).toBeVisible();
    await page.getByRole('button', { name: 'Use recovery key instead' }).click();
    await page.getByRole('textbox', { name: 'Recovery key' }).fill(recoveryKey);
    await page.getByRole('button', { name: 'Unlock with recovery key' }).click();
    await waitStatus(page, 'unlocked');
    await expect(note(page)).toHaveValue(NOTE);
  });

  test('the recovery key is not stored: closing the dialog before confirming is impossible, and the gate nags', async ({ page }) => {
    await enroll(page, { confirm: false });
    const dialog = page.getByRole('dialog');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible(); // Esc does nothing at this step
    await page.mouse.click(5, 5);
    await expect(dialog).toBeVisible(); // neither does an outside press
    // The vault is already enrolled and unlocked behind the dialog; reload without confirming.
    await page.reload({ waitUntil: 'load' });
    await waitStatus(page, 'locked');
    await page.getByRole('button', { name: 'Unlock with passkey' }).click();
    await waitStatus(page, 'unlocked');
    const notice = page.getByRole('region', { name: 'Recovery key' });
    await expect(notice).toContainText("haven't confirmed");
    // Replace it: a fresh key, with the same dialog.
    await notice.getByRole('button', { name: 'Get a new key' }).click();
    const dialog2 = page.getByRole('dialog');
    await dialog2.getByRole('button', { name: 'Continue with passkey' }).click();
    await expect(dialog2.locator('[data-slot=recovery-key]')).toBeVisible({ timeout: 15_000 });
    await dialog2.getByText('I saved my recovery key').click();
    await dialog2.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('region', { name: 'Recovery key' })).toHaveCount(0);
  });

  test('cancelling the passkey prompt leaves the vault unset and says so', async ({ page }) => {
    await auth.setVerified(false); // user verification fails: the browser reports a dismissed prompt
    await waitStatus(page, 'empty');
    await page.getByRole('button', { name: 'Set up passkey' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Create passkey' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Nothing was changed', { timeout: 20_000 });
    expect(await hasEnvelope(page)).toBe(false);
    // (Chromium's virtual authenticator stays failed after a user-verification failure even when it is switched back,
    // so the retry gets a fresh one: a person who dismissed the prompt once simply tries again.)
    await auth.remove();
    await authenticator(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Create passkey' }).click();
    await expect(page.getByRole('dialog').locator('[data-slot=recovery-key]')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('two tabs', () => {
  test('locking in one tab locks the other; each tab proves itself to unlock', async ({ page, context }) => {
    await authenticator(page);
    await openDemo(page, GATE, READY);
    const recoveryKey = await enroll(page);
    await expect.poll(() => hasEnvelope(page)).toBe(true);

    const other = await context.newPage();
    await openDemo(other, GATE, READY);
    await waitStatus(other, 'locked'); // a new tab does not inherit the unlock
    await other.getByRole('button', { name: 'Use recovery key instead' }).click();
    await other.getByRole('textbox', { name: 'Recovery key' }).fill(recoveryKey);
    await other.getByRole('button', { name: 'Unlock with recovery key' }).click();
    await waitStatus(other, 'unlocked');
    await waitStatus(page, 'unlocked');

    await page.getByRole('button', { name: 'Lock', exact: true }).click();
    await waitStatus(page, 'locked');
    await waitStatus(other, 'locked'); // BroadcastChannel: the lock propagates

    // …and the other direction
    await page.getByRole('button', { name: 'Use recovery key instead' }).click();
    await page.getByRole('textbox', { name: 'Recovery key' }).fill(recoveryKey);
    await page.getByRole('button', { name: 'Unlock with recovery key' }).click();
    await waitStatus(page, 'unlocked');
    await other.getByRole('button', { name: 'Unlock with passkey' }).waitFor({ state: 'visible' }).catch(() => undefined);
    await waitStatus(other, 'locked'); // an unlock in one tab is not shared
    await other.bringToFront();
    await other.getByRole('button', { name: 'Use recovery key instead' }).click();
    await other.getByRole('textbox', { name: 'Recovery key' }).fill(recoveryKey);
    await other.getByRole('button', { name: 'Unlock with recovery key' }).click();
    await waitStatus(other, 'unlocked');
    await other.getByRole('button', { name: 'Lock', exact: true }).click();
    await waitStatus(page, 'locked');
  });

  test('a note typed in one tab appears in the other after it unlocks', async ({ page, context }) => {
    await authenticator(page);
    await openDemo(page, GATE, READY);
    const recoveryKey = await enroll(page);
    await note(page).fill(NOTE);
    await expect.poll(() => hasRecord(page)).toBe(true);
    const other = await context.newPage();
    await openDemo(other, GATE, READY);
    await other.getByRole('button', { name: 'Use recovery key instead' }).click();
    await other.getByRole('textbox', { name: 'Recovery key' }).fill(recoveryKey);
    await other.getByRole('button', { name: 'Unlock with recovery key' }).click();
    await waitStatus(other, 'unlocked');
    await expect(note(other)).toHaveValue(NOTE);
    await note(page).fill(`${NOTE}, edited`);
    await expect(note(other)).toHaveValue(`${NOTE}, edited`); // record changes broadcast too
  });
});

test.describe('without usable passkeys', () => {
  test('a browser with no WebAuthn gets an honest message and no app behind it', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'credentials', { get: () => undefined });
      // @ts-expect-error simulate a browser without WebAuthn
      delete window.PublicKeyCredential;
    });
    await openDemo(page, GATE, READY);
    await waitStatus(page, 'unsupported');
    const panel = page.locator('[data-slot=vault-unsupported]');
    await expect(panel).toContainText("can't use passkeys");
    await expect(panel).toContainText('WebAuthn');
    await expect(page.getByRole('textbox', { name: 'Private note' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /passkey/i })).toHaveCount(0);
  });

  test('the unsupported example shows the same screen', async ({ page }) => {
    await openDemo(page, 'passkey-vault/unsupported', READY);
    await waitStatus(page, 'unsupported');
    await expect(page.locator('[data-slot=vault-unsupported]')).toContainText("can't use passkeys");
  });

  test('an enrolled vault opened where passkeys are gone is still reachable with the recovery key', async ({ page, context }) => {
    await authenticator(page);
    await openDemo(page, GATE, READY);
    const recoveryKey = await enroll(page);
    await note(page).fill(NOTE);
    await expect.poll(() => hasRecord(page)).toBe(true);

    const bare = await context.newPage();
    await bare.addInitScript(() => {
      Object.defineProperty(navigator, 'credentials', { get: () => undefined });
      // @ts-expect-error simulate a browser without WebAuthn
      delete window.PublicKeyCredential;
    });
    await openDemo(bare, GATE, READY);
    await waitStatus(bare, 'locked');
    await expect(bare.locator('[data-slot=vault-unlock]')).toContainText('Your recovery key still works');
    await expect(bare.getByRole('button', { name: 'Unlock with passkey' })).toHaveCount(0);
    await bare.getByRole('textbox', { name: 'Recovery key' }).fill(recoveryKey);
    await bare.getByRole('button', { name: 'Unlock with recovery key' }).click();
    await waitStatus(bare, 'unlocked');
    await expect(note(bare)).toHaveValue(NOTE);
  });

  test('an authenticator without PRF is refused with an explanation, and nothing is saved', async ({ page }) => {
    await authenticator(page, { hasPrf: false, hasHmacSecret: false });
    await openDemo(page, GATE, READY);
    await waitStatus(page, 'empty');
    await page.getByRole('button', { name: 'Set up passkey' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Create passkey' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText("doesn't support the PRF extension", { timeout: 15_000 });
    await expect(page.locator('[data-slot=recovery-key]')).toHaveCount(0);
    expect(await status(page)).toBe('empty');
  });
});

test.describe('usePasskey', () => {
  test('derives the same secret every time', async ({ page }) => {
    await authenticator(page);
    await openDemo(page, 'passkey-vault/prf', '[data-slot=button]');
    await page.getByRole('button', { name: 'Create passkey' }).click();
    await expect(page.getByText(/Secret #1 fingerprint/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Derive secret again' }).click();
    await expect(page.getByText(/Secret #2 fingerprint.*same as #1/)).toBeVisible();
  });
});

/* Every screen a person can reach, in both themes, through axe (the same rule set as the docs-wide audit). The audit
   only sees a demo's first screen; this walks the rest: the dialog steps, the locked screen, recovery mode, the erase
   confirmation. */
for (const theme of ['light', 'dark']) {
  test(`axe finds nothing on any screen (${theme})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await authenticator(page);
    await page.goto(`/?demo=${GATE}&theme=${theme}`, { waitUntil: 'load' });
    await page.locator(READY).first().waitFor({ timeout: 30_000 });
    await page.addScriptTag({ content: AXE });
    // (react-aria's hidden live-announcer region, `role=log`, is left out: it holds a transient unlabelled node by design.)
    const check = async (label) => {
      await page.waitForTimeout(400);
      const violations = await page.evaluate(async () => (await window.axe.run({ exclude: [['[role=log]']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations
        .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ') + ' ' + JSON.stringify(n.any[0]?.data ?? '')).join(' | ')}`));
      expect(violations, label).toEqual([]);
    };
    await waitStatus(page, 'empty');
    await check('set-up screen');
    await page.getByRole('button', { name: 'Set up passkey' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await check('dialog, explanation');
    await page.getByRole('dialog').getByRole('button', { name: 'Create passkey' }).click();
    await expect(page.locator('[data-slot=recovery-key]')).toBeVisible({ timeout: 15_000 });
    await check('dialog, recovery key');
    await page.getByText('I saved my recovery key').click();
    await page.getByRole('button', { name: 'Done' }).click();
    await waitStatus(page, 'unlocked');
    await check('unlocked');
    await page.getByRole('button', { name: 'Lock', exact: true }).click();
    await waitStatus(page, 'locked');
    await check('locked screen');
    await page.getByRole('button', { name: 'Use recovery key instead' }).click();
    await check('locked screen, recovery key form');
    await page.getByRole('textbox', { name: 'Recovery key' }).fill('0000-0000-0000-0000-0000-0000-0000-0000');
    await page.getByRole('button', { name: 'Unlock with recovery key' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await check('locked screen, error');
    await page.getByRole('button', { name: /Erase this vault/ }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await check('erase confirmation');
  });
}

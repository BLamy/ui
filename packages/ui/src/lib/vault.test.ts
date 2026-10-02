/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-explicit-any -- test code: fixtures are known to exist, and tampering tests edit untyped JSON */
import { afterEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { PasskeyError } from '@/lib/passkey';
import {
  VaultError, createVault, parseEnvelope, type BroadcastChannelLike, type Vault, type VaultOptions,
} from '@/lib/vault';
import { indexedDbStorage, localStorageStorage, memoryStorage, VaultStorageError, type VaultStorage } from '@/lib/vault-storage';
import { createFakeAuthenticator, type FakeAuthenticator } from '../../test/fake-authenticator';

/* A shared in-memory BroadcastChannel: every channel with a name hears every other one, like tabs of one origin. */
function bus() {
  const channels = new Set<{ name: string; ch: BroadcastChannelLike }>();
  return (name: string): BroadcastChannelLike => {
    const ch: BroadcastChannelLike = {
      onmessage: null,
      postMessage(message) {
        for (const other of channels) {
          if (other.ch !== ch && other.name === name) queueMicrotask(() => other.ch.onmessage?.({ data: message }));
        }
      },
      close() { for (const c of channels) if (c.ch === ch) channels.delete(c); },
    };
    channels.add({ name, ch });
    return ch;
  };
}

interface Rig { auth: FakeAuthenticator; storage: VaultStorage; make: (extra?: Partial<VaultOptions>) => Vault }
function rig(authOptions?: Parameters<typeof createFakeAuthenticator>[0], storage: VaultStorage = memoryStorage()): Rig {
  const auth = createFakeAuthenticator(authOptions);
  return { auth, storage, make: (extra) => createVault({ id: 'test', rp: { name: 'Test', id: 'example.com' }, storage, env: auth.env, channel: false, ...extra }) };
}

async function failure(p: Promise<unknown>): Promise<VaultError | PasskeyError> {
  try { await p; } catch (e) { return e as VaultError | PasskeyError; }
  throw new Error('expected a rejection');
}
const reasonOf = async (p: Promise<unknown>) => (await failure(p)).reason;

async function enrolled(r: Rig, extra?: Partial<VaultOptions>) {
  const vault = r.make(extra);
  await vault.init();
  const { recoveryKey } = await vault.enroll();
  return { vault, recoveryKey };
}

const dump = async (s: VaultStorage, prefix = '') => Object.fromEntries(await Promise.all((await s.keys(prefix)).map(async (k) => [k, await s.get(k)] as const)));

afterEach(() => { vi.useRealTimers(); });

describe('status', () => {
  it('goes loading → empty on a fresh browser and → unlocked after enroll', async () => {
    const r = rig();
    const vault = r.make();
    expect(vault.status).toBe('loading');
    expect(vault.getServerState().status).toBe('loading');
    await vault.init();
    expect(vault.status).toBe('empty');
    const { recoveryKey } = await vault.enroll();
    expect(recoveryKey).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(vault.status).toBe('unlocked');
    expect(vault.getState()).toMatchObject({ hasRecoveryKey: true, recoveryConfirmed: false, busy: null });
    expect(vault.getState().passkeys).toHaveLength(1);
  });
  it('notifies subscribers with a new snapshot object on each change', async () => {
    const r = rig();
    const vault = r.make();
    const seen: unknown[] = [];
    const off = vault.subscribe(() => seen.push(vault.getState()));
    await vault.init();
    await vault.enroll();
    vault.lock();
    off();
    vault.lock();
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBeGreaterThan(3);
  });
  it('comes back locked from storage in a new instance, with its passkeys listed', async () => {
    const r = rig();
    await enrolled(r);
    const again = r.make();
    await again.init();
    expect(again.status).toBe('locked');
    expect(again.getState().passkeys).toHaveLength(1);
  });
  it('refuses enroll twice, and unlock without a vault', async () => {
    const r = rig();
    const vault = r.make();
    expect(await reasonOf(vault.unlock())).toBe('invalid-state');
    await vault.enroll();
    expect(await reasonOf(vault.enroll())).toBe('invalid-state');
  });
  it('validates the vault id', () => {
    expect(() => createVault({ id: '', rp: { name: 'x' } })).toThrow(VaultError);
    expect(() => createVault({ id: 'a/b', rp: { name: 'x' } })).toThrow(VaultError);
  });
});

describe('records', () => {
  it('stores and reads JSON values, lists names sorted, deletes', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    const value = { a: 1, b: ['x', null, true], c: { d: 'é ☃ 😀' } };
    await vault.put('settings', value);
    await vault.put('alpha', 'text');
    await vault.put('zero', 0);
    await vault.put('nothing', null);
    expect(await vault.get('settings')).toEqual(value);
    expect(await vault.get('alpha')).toBe('text');
    expect(await vault.get('zero')).toBe(0);
    expect(await vault.get('nothing')).toBeNull();
    expect(await vault.get('absent')).toBeUndefined();
    expect(await vault.list()).toEqual(['alpha', 'nothing', 'settings', 'zero']);
    await vault.put('alpha', 'changed');
    expect(await vault.get('alpha')).toBe('changed');
    await vault.delete('alpha');
    expect(await vault.get('alpha')).toBeUndefined();
    expect(await vault.list()).toEqual(['nothing', 'settings', 'zero']);
  });
  it('rejects undefined and bad names', async () => {
    const { vault } = await enrolled(rig());
    expect(await reasonOf(vault.put('x', undefined))).toBe('invalid');
    expect(await reasonOf(vault.put('', 1))).toBe('invalid');
    expect(await reasonOf(vault.get(''))).toBe('invalid');
  });
  it('is unreadable and unwritable while locked, and the data survives a lock and unlock', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    await vault.put('k', 'v');
    vault.lock();
    expect(vault.status).toBe('locked');
    expect(await reasonOf(vault.get('k'))).toBe('locked');
    expect(await reasonOf(vault.put('k', 'x'))).toBe('locked');
    expect(await reasonOf(vault.list())).toBe('locked');
    expect(await reasonOf(vault.delete('k'))).toBe('locked');
    await vault.unlock();
    expect(await vault.get('k')).toBe('v');
  });
  it('persists across instances', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    await vault.put('k', { n: 1 });
    const other = r.make();
    await other.init();
    await other.unlock();
    expect(await other.get('k')).toEqual({ n: 1 });
  });
  it('writes in order even when puts are not awaited', async () => {
    const { vault } = await enrolled(rig());
    const writes = Array.from({ length: 20 }, (_, i) => vault.put('counter', i));
    await Promise.all(writes);
    expect(await vault.get('counter')).toBe(19);
  });
  it('watch fires on local writes and deletes, and stops after unsubscribe', async () => {
    const { vault } = await enrolled(rig());
    const hits: string[] = [];
    const off = vault.watch('k', () => hits.push('k'));
    vault.watch('other', () => hits.push('other'));
    await vault.put('k', 1);
    await vault.delete('k');
    off();
    await vault.put('k', 2);
    expect(hits).toEqual(['k', 'k']);
  });
});

describe('what is on disk', () => {
  it('holds no plaintext: not the values, not the record names, not the recovery key', async () => {
    const r = rig();
    const { vault, recoveryKey } = await enrolled(r);
    await vault.put('github-token', 'ghp_SUPERSECRETVALUE123');
    const all = JSON.stringify(await dump(r.storage));
    expect(all).not.toContain('ghp_SUPERSECRETVALUE123');
    expect(all).not.toContain('github-token');
    expect(all).not.toContain(recoveryKey);
    expect(all).not.toContain(recoveryKey.replace(/-/g, ''));
  });
  it('uses a fresh IV per write: the same value encrypts differently each time', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    await vault.put('k', 'same');
    const first = await dump(r.storage, 'test/r/');
    await vault.put('k', 'same');
    const second = await dump(r.storage, 'test/r/');
    expect(Object.keys(first)).toEqual(Object.keys(second));
    expect(Object.values(first)).not.toEqual(Object.values(second));
  });
  it('does not store the master secret or the passkey secret anywhere in the envelope', async () => {
    const r = rig();
    await enrolled(r);
    const meta = JSON.parse((await r.storage.get('test/meta'))!);
    expect(Object.keys(meta).sort()).toEqual(['createdAt', 'id', 'prfSalt', 'slots', 'updatedAt', 'v']);
    for (const slot of meta.slots) expect(Object.keys(slot)).not.toContain('key');
  });
  it('gives two vaults different keys: records do not decrypt across vaults, even if copied', async () => {
    const r = rig();
    const { vault: a } = await enrolled(r);
    const b = r.make({ id: 'other' });
    await b.init();
    await b.enroll();
    await a.put('k', 'a-value');
    for (const [key, value] of Object.entries(await dump(r.storage, 'test/r/'))) await r.storage.set(key.replace('test/', 'other/'), value!);
    // Same location hash needs the same MAC key, which differs, so the copy is not even found by name…
    expect(await b.get('k')).toBeUndefined();
    // …and a record forced onto a location b would use is rejected by authentication.
    const loc = Object.keys(await dump(r.storage, 'test/r/'))[0].slice('test/r/'.length);
    await b.put('k', 'b-value');
    const bLoc = Object.keys(await dump(r.storage, 'other/r/')).find((k) => !k.endsWith(loc))!;
    await r.storage.set(bLoc, (await r.storage.get(`test/r/${loc}`))!);
    expect(await reasonOf(b.get('k'))).toBe('corrupt');
  });
});

describe('tampering (AES-GCM authentication and AAD)', () => {
  const flip = (b64: string) => (b64[0] === 'A' ? 'B' : 'A') + b64.slice(1);

  it('fails closed when a ciphertext is modified, and keeps the damaged entry', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    await vault.put('k', 'v');
    const [key] = Object.keys(await dump(r.storage, 'test/r/'));
    const blob = JSON.parse((await r.storage.get(key))!);
    blob.ct = flip(blob.ct);
    await r.storage.set(key, JSON.stringify(blob));
    expect(await reasonOf(vault.get('k'))).toBe('corrupt');
    expect(await r.storage.get(key)).toBe(JSON.stringify(blob)); // not deleted
    expect(await vault.list()).toEqual([]); // list skips what it cannot authenticate
  });
  it('fails closed when an IV is modified', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    await vault.put('k', 'v');
    const [key] = Object.keys(await dump(r.storage, 'test/r/'));
    const blob = JSON.parse((await r.storage.get(key))!);
    blob.iv = flip(blob.iv);
    await r.storage.set(key, JSON.stringify(blob));
    expect(await reasonOf(vault.get('k'))).toBe('corrupt');
  });
  it('binds each record to its name: a record moved under another name does not authenticate', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    await vault.put('cheap', 'low-value');
    await vault.put('precious', 'high-value');
    const before = await dump(r.storage, 'test/r/');
    const keys = Object.keys(before);
    // find which key is which by reading names through list order: swap the two blobs
    const [k1, k2] = keys;
    await r.storage.set(k1, before[k2]!);
    await r.storage.set(k2, before[k1]!);
    expect(await reasonOf(vault.get('cheap'))).toBe('corrupt');
    expect(await reasonOf(vault.get('precious'))).toBe('corrupt');
    expect(await vault.list()).toEqual([]);
  });
  it('quarantines a record that is not even a record, rather than deleting it', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    await vault.put('k', 'v');
    const [key] = Object.keys(await dump(r.storage, 'test/r/'));
    await r.storage.set(key, '{"not":"a record"}');
    expect(await reasonOf(vault.get('k'))).toBe('corrupt');
    expect(await r.storage.get(key)).toBeNull();
    const q = await vault.listQuarantine();
    expect(q).toHaveLength(1);
    expect(q[0].raw).toBe('{"not":"a record"}');
    expect(vault.getState().quarantined).toBe(1);
  });
  it('rejects a modified slot: the wrapped master fails authentication under the passkey', async () => {
    const r = rig();
    await enrolled(r);
    const meta = JSON.parse((await r.storage.get('test/meta'))!);
    meta.slots[0].wrapped = flip(meta.slots[0].wrapped);
    await r.storage.set('test/meta', JSON.stringify(meta));
    const again = r.make();
    await again.init();
    expect(await reasonOf(again.unlock())).toBe('wrong-key');
    expect(again.status).toBe('locked');
  });
  it('a passkey slot swapped for another passkey\'s payload does not open', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    await vault.addPasskey();
    const meta = JSON.parse((await r.storage.get('test/meta'))!);
    // Swap the wrapped payloads of the two passkey slots (the credential ids stay).
    const [a, b] = meta.slots;
    for (const f of ['salt', 'iv', 'wrapped']) [a[f], b[f]] = [b[f], a[f]];
    await r.storage.set('test/meta', JSON.stringify(meta));
    const again = r.make();
    await again.init();
    expect(await reasonOf(again.unlock())).toBe('wrong-key');
  });
});

describe('format v1, implemented independently of the vault', () => {
  const b64 = (b64u: string) => Uint8Array.from(atob(b64u.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64u.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
  const b64u = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const text = new TextEncoder();
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const decodeKey = (key: string) => {
    let bits = '';
    for (const ch of key.replace(/-/g, '')) bits += ALPHABET.indexOf(ch).toString(2).padStart(5, '0');
    return Uint8Array.from({ length: 20 }, (_, i) => parseInt(bits.slice(i * 8, i * 8 + 8), 2));
  };
  const hkdfKey = async (ikm: Uint8Array, salt: Uint8Array, info: string, algorithm: AlgorithmIdentifier | HmacKeyGenParams, usages: KeyUsage[]) =>
    crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: text.encode(info) }, await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveKey']), algorithm, false, usages);

  async function open(storage: VaultStorage, recoveryKey: string) {
    const meta = JSON.parse((await storage.get('test/meta'))!);
    const slot = meta.slots.find((s: { kind: string }) => s.kind === 'recovery');
    const kek = await hkdfKey(decodeKey(recoveryKey), b64(slot.salt), 'bl-vault/v1/kek|test|recovery|recovery', { name: 'AES-GCM', length: 256 }, ['decrypt']);
    const master = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(slot.iv) as BufferSource, additionalData: text.encode('bl-vault/v1/slot|test|recovery|recovery') }, kek, b64(slot.wrapped) as BufferSource));
    const encKey = await hkdfKey(master, text.encode('test'), 'bl-vault/v1/records', { name: 'AES-GCM', length: 256 }, ['encrypt', 'decrypt']);
    const macKey = await hkdfKey(master, text.encode('test'), 'bl-vault/v1/names', { name: 'HMAC', hash: 'SHA-256', length: 256 }, ['sign']);
    const location = async (name: string) => b64u(await crypto.subtle.sign('HMAC', macKey, text.encode(name)));
    return { master, encKey, location };
  }

  it('is documented well enough to read a vault without this library', async () => {
    const r = rig();
    const { vault, recoveryKey } = await enrolled(r);
    await vault.put('greeting', { hello: 'world' });
    const { encKey, location } = await open(r.storage, recoveryKey);
    const loc = await location('greeting');
    const blob = JSON.parse((await r.storage.get(`test/r/${loc}`))!);
    expect(blob.v).toBe(1);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(blob.iv) as BufferSource, additionalData: text.encode(`bl-vault/v1/record|test|${loc}`) }, encKey, b64(blob.ct) as BufferSource);
    expect(JSON.parse(new TextDecoder().decode(plain))).toEqual({ n: 'greeting', v: { hello: 'world' } });
  });
  it('the record AAD binds the location: a validly encrypted record for another name is rejected even if its inner name matches', async () => {
    const r = rig();
    const { vault, recoveryKey } = await enrolled(r);
    await vault.put('precious', 'high-value');
    const { encKey, location } = await open(r.storage, recoveryKey);
    // An attacker cannot do this (they lack the key); this proves the vault, not the inner name, is what refuses it.
    const forged = async (aadLocation: string) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: text.encode(`bl-vault/v1/record|test|${aadLocation}`) }, encKey, text.encode(JSON.stringify({ n: 'cheap', v: 'forged' })));
      return JSON.stringify({ v: 1, iv: b64u(iv), ct: b64u(ct) });
    };
    const cheapLoc = await location('cheap');
    await r.storage.set(`test/r/${cheapLoc}`, await forged(await location('precious')));
    expect(await reasonOf(vault.get('cheap'))).toBe('corrupt');
    await r.storage.set(`test/r/${cheapLoc}`, await forged(cheapLoc));
    expect(await vault.get('cheap')).toBe('forged'); // the control: the right AAD is accepted
  });
});

describe('several ways in: two passkeys and a recovery key, one master secret', () => {
  it('addPasskey wraps the same master for a second passkey without rewriting any record', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    await vault.put('one', 1);
    await vault.put('two', { n: 2 });
    const recordsBefore = await dump(r.storage, 'test/r/');
    const first = vault.getState().passkeys[0].id;
    await vault.addPasskey({ label: 'Backup key' });
    expect(vault.getState().passkeys.map((p) => p.label)).toEqual(['Passkey', 'Backup key']);
    expect(await dump(r.storage, 'test/r/')).toEqual(recordsBefore); // byte-identical: nothing was re-encrypted
    // Lose the first passkey: the second still opens everything.
    vault.lock();
    await vault.removePasskey(first).catch(() => undefined); // locked: refused
    await vault.unlock();
    await vault.removePasskey(first);
    vault.lock();
    expect(vault.getState().passkeys).toHaveLength(1);
    await vault.unlock();
    expect(await vault.get('one')).toBe(1);
    expect(await vault.get('two')).toEqual({ n: 2 });
  });
  it('asks the user again before enrolling (a prompt for an existing passkey, then the creation)', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    r.auth.calls.length = 0;
    await vault.addPasskey();
    expect(r.auth.calls.map((c) => c.type)).toEqual(['get', 'create']);
  });
  it('keeps a security key working: creation without PRF output costs one extra prompt', async () => {
    const r = rig({ prfAtCreate: false });
    const vault = r.make();
    await vault.init();
    await vault.enroll();
    expect(r.auth.calls.map((c) => c.type)).toEqual(['create', 'get']);
    vault.lock();
    await vault.unlock();
    expect(vault.status).toBe('unlocked');
  });
  it('does not enrol the same authenticator twice: it sends the existing ids as excludeCredentials', async () => {
    const r = rig({ enforceExclude: true });
    const { vault } = await enrolled(r);
    r.auth.calls.length = 0;
    expect(await reasonOf(vault.addPasskey())).toBe('excluded');
    const create = r.auth.calls.find((c) => c.type === 'create')!.options as CredentialCreationOptions;
    expect(create.publicKey!.excludeCredentials).toHaveLength(1);
    expect(vault.getState().passkeys).toHaveLength(1);
    expect(vault.getState().busy).toBeNull();
  });
  it('the recovery key unlocks, in any case and spacing, and lookalike characters are forgiven', async () => {
    const r = rig();
    const { vault, recoveryKey } = await enrolled(r);
    await vault.put('k', 'v');
    for (const typed of [recoveryKey, recoveryKey.toLowerCase(), recoveryKey.replace(/-/g, ' '), `  ${recoveryKey.replace(/-/g, '')}  `]) {
      vault.lock();
      await vault.unlockWithRecoveryKey(typed);
      expect(await vault.get('k')).toBe('v');
    }
    // Crockford: O reads as 0, I and L as 1
    const confusable = recoveryKey.replace(/0/g, 'O').replace(/1/g, 'l');
    vault.lock();
    await vault.unlockWithRecoveryKey(confusable);
    expect(vault.status).toBe('unlocked');
  });
  it('unlocks with the recovery key when the passkey is gone, with no authenticator involved', async () => {
    const r = rig();
    const { vault, recoveryKey } = await enrolled(r);
    await vault.put('k', 'v');
    vault.lock();
    r.auth.wipe();
    expect(await reasonOf(vault.unlock())).toBe('cancelled'); // no matching credential reads as a dismissed prompt
    r.auth.calls.length = 0;
    await vault.unlockWithRecoveryKey(recoveryKey);
    expect(r.auth.calls).toHaveLength(0);
    expect(await vault.get('k')).toBe('v');
  });
  it('after recovery, a new passkey is added with the recovery key and old data still opens with it', async () => {
    const r = rig();
    const { vault, recoveryKey } = await enrolled(r);
    await vault.put('k', 'v');
    vault.lock();
    r.auth.wipe(); // the old passkey is lost
    await vault.addPasskey({ recoveryKey, label: 'New phone' });
    vault.lock();
    await vault.unlock(); // the new passkey, never used with the old data, opens it
    expect(await vault.get('k')).toBe('v');
    expect(vault.getState().passkeys.map((p) => p.label)).toContain('New phone');
  });
  it('rejects a wrong or malformed recovery key and stays locked', async () => {
    const r = rig();
    const { vault, recoveryKey } = await enrolled(r);
    vault.lock();
    const wrong = recoveryKey.slice(0, -1) + (recoveryKey.endsWith('0') ? '1' : '0');
    expect(await reasonOf(vault.unlockWithRecoveryKey(wrong))).toBe('wrong-recovery-key');
    expect(await reasonOf(vault.unlockWithRecoveryKey('short'))).toBe('invalid-recovery-key');
    expect(await reasonOf(vault.unlockWithRecoveryKey(recoveryKey.replace(/.$/, '!')))).toBe('invalid-recovery-key');
    expect(vault.status).toBe('locked');
    expect(await vault.verifyRecoveryKey(wrong)).toBe(false);
    expect(await vault.verifyRecoveryKey(recoveryKey)).toBe(true);
    expect(vault.status).toBe('locked'); // verifying does not unlock
  });
  it('regenerates the recovery key: the old one stops working, the new one works, records untouched', async () => {
    const r = rig();
    const { vault, recoveryKey: oldKey } = await enrolled(r);
    await vault.put('k', 'v');
    const recordsBefore = await dump(r.storage, 'test/r/');
    const newKey = await vault.regenerateRecoveryKey();
    expect(newKey).not.toBe(oldKey);
    expect(vault.getState().recoveryConfirmed).toBe(false);
    expect(await dump(r.storage, 'test/r/')).toEqual(recordsBefore);
    vault.lock();
    expect(await reasonOf(vault.unlockWithRecoveryKey(oldKey))).toBe('wrong-recovery-key');
    await vault.unlockWithRecoveryKey(newKey);
    expect(await vault.get('k')).toBe('v');
  });
  it('confirmRecoveryKey records that the user saved it, and survives a reload', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    await vault.confirmRecoveryKey();
    expect(vault.getState().recoveryConfirmed).toBe(true);
    const again = r.make();
    await again.init();
    expect(again.getState().recoveryConfirmed).toBe(true);
  });
  it('never removes the last passkey, and rejects unknown ids', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    const only = vault.getState().passkeys[0].id;
    expect(await reasonOf(vault.removePasskey(only))).toBe('invalid-state');
    expect(await reasonOf(vault.removePasskey('AAAA'))).toBe('invalid-state');
  });
  it('generates a different recovery key and master secret for every vault', async () => {
    const keys = new Set<string>();
    for (let i = 0; i < 5; i++) keys.add((await enrolled(rig())).recoveryKey);
    expect(keys.size).toBe(5);
  });
});

describe('failure paths', () => {
  it('a cancelled enrollment leaves nothing behind and the vault empty', async () => {
    const r = rig();
    const vault = r.make();
    await vault.init();
    r.auth.failNext();
    expect(await reasonOf(vault.enroll())).toBe('cancelled');
    expect(vault.status).toBe('empty');
    expect(vault.getState().busy).toBeNull();
    expect(Object.keys(await dump(r.storage))).toEqual([]);
    await vault.enroll(); // can try again
    expect(vault.status).toBe('unlocked');
  });
  it('a cancelled unlock stays locked and can be retried', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    vault.lock();
    r.auth.failNext();
    expect(await reasonOf(vault.unlock())).toBe('cancelled');
    expect(vault.status).toBe('locked');
    await vault.unlock();
    expect(vault.status).toBe('unlocked');
  });
  it('an authenticator without PRF cannot enrol and nothing is persisted', async () => {
    const r = rig({ prf: false });
    const vault = r.make();
    await vault.init();
    expect(await reasonOf(vault.enroll())).toBe('no-prf');
    expect(Object.keys(await dump(r.storage))).toEqual([]);
  });
  it('refuses a second interactive operation while one is open', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    vault.lock();
    let release!: () => void;
    r.auth.delayNext(new Promise<void>((res) => { release = res; }));
    const first = vault.unlock();
    await vi.waitFor(() => expect(vault.getState().busy).toBe('unlock'));
    expect(await reasonOf(vault.unlockWithRecoveryKey('x'))).toBe('busy');
    release();
    await first;
    expect(vault.getState().busy).toBeNull();
  });
  it('an abort signal cancels the prompt', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    vault.lock();
    const ac = new AbortController();
    ac.abort();
    expect(await reasonOf(vault.unlock({ signal: ac.signal }))).toBe('cancelled');
  });
  it('reset erases the envelope and the records and returns to empty, keeping quarantine', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    await vault.put('k', 'v');
    await r.storage.set('test/quarantine/1-x', 'kept');
    await vault.reset();
    expect(vault.status).toBe('empty');
    expect(Object.keys(await dump(r.storage))).toEqual(['test/quarantine/1-x']);
    await vault.enroll();
    expect(await vault.get('k')).toBeUndefined();
  });
});

describe('storage damage and versions', () => {
  it('quarantines an unreadable envelope instead of deleting it, and reads as empty', async () => {
    const r = rig();
    await enrolled(r);
    await r.storage.set('test/meta', '{"v":1,"id":"test","slots":"oops"');
    const vault = r.make();
    await vault.init();
    expect(vault.status).toBe('empty');
    expect(vault.getState().quarantined).toBe(1);
    const [entry] = await vault.listQuarantine();
    expect(entry.raw).toBe('{"v":1,"id":"test","slots":"oops"');
    expect(entry.at).toBeGreaterThan(0);
    expect(await r.storage.get('test/meta')).toBeNull();
  });
  it('quarantines an envelope that parses but is invalid (no recovery slot, duplicate ids, another vault id)', async () => {
    for (const mutate of [
      (m: Record<string, any>) => { m.slots = m.slots.filter((s: any) => s.kind !== 'recovery'); },
      (m: Record<string, any>) => { m.slots.push(m.slots[0]); },
      (m: Record<string, any>) => { m.id = 'someone-else'; },
      (m: Record<string, any>) => { m.prfSalt = 'not base64!'; },
      (m: Record<string, any>) => { m.slots[0].iv = 7; },
    ]) {
      const r = rig();
      await enrolled(r);
      const meta = JSON.parse((await r.storage.get('test/meta'))!);
      mutate(meta);
      await r.storage.set('test/meta', JSON.stringify(meta));
      const vault = r.make();
      await vault.init();
      expect(vault.status).toBe('empty');
      expect(vault.getState().quarantined).toBe(1);
    }
  });
  it('treats data from a newer version as unsupported and leaves it untouched', async () => {
    const r = rig();
    await enrolled(r);
    const meta = JSON.parse((await r.storage.get('test/meta'))!);
    meta.v = 2;
    const raw = JSON.stringify(meta);
    await r.storage.set('test/meta', raw);
    const vault = r.make();
    await vault.init();
    expect(vault.status).toBe('unsupported');
    expect(vault.getState().unsupportedReason).toBe('newer-version');
    expect(await r.storage.get('test/meta')).toBe(raw);
    expect(await reasonOf(vault.enroll())).toBe('invalid-state');
  });
  it('moves records left behind by a damaged envelope aside when a new vault is enrolled over them', async () => {
    const r = rig();
    const { vault } = await enrolled(r);
    await vault.put('old', 'data');
    const records = await dump(r.storage, 'test/r/');
    await r.storage.set('test/meta', 'garbage');
    const fresh = r.make();
    await fresh.init();
    await fresh.enroll();
    expect(Object.keys(await dump(r.storage, 'test/r/'))).toEqual([]);
    const q = await fresh.listQuarantine();
    expect(q.map((e) => e.raw).sort()).toEqual(['garbage', ...Object.values(records)].sort());
  });
  it('migrates older envelopes step by step, and quarantines a gap in the chain', () => {
    const base = { v: 1, id: 'test', createdAt: 1, updatedAt: 1, prfSalt: 'AAAA', slots: [
      { kind: 'passkey', id: 'AAAA', label: 'x', salt: 'AAAA', iv: 'AAAA', wrapped: 'AAAA', createdAt: 1 },
      { kind: 'recovery', id: 'recovery', confirmed: true, salt: 'AAAA', iv: 'AAAA', wrapped: 'AAAA', createdAt: 1 },
    ] };
    // pretend the current version is 3; v1 → v2 renames `title`→`label`, v2 → v3 adds `confirmed`
    const old = { ...base, slots: [{ ...base.slots[0], label: undefined, title: 'x' }, { ...base.slots[1], confirmed: undefined }] };
    const migrations = {
      1: (e: Record<string, unknown>) => ({ ...e, slots: (e['slots'] as any[]).map((s) => (s.title ? { ...s, label: s.title, title: undefined } : s)) }),
      2: (e: Record<string, unknown>) => ({ ...e, slots: (e['slots'] as any[]).map((s) => (s.kind === 'recovery' ? { ...s, confirmed: false } : s)) }),
    };
    const ok = parseEnvelope(JSON.stringify(old), 'test', migrations, 3);
    expect(ok.kind).toBe('ok');
    if (ok.kind === 'ok') {
      expect(ok.envelope.v).toBe(3);
      expect(ok.envelope.slots[0]).toMatchObject({ label: 'x' });
      expect(ok.envelope.slots[1]).toMatchObject({ confirmed: false });
    }
    expect(parseEnvelope(JSON.stringify(old), 'test', { 2: migrations[2] }, 3).kind).toBe('corrupt');
    expect(parseEnvelope(JSON.stringify({ ...old, v: 4 }), 'test', migrations, 3).kind).toBe('newer');
    expect(parseEnvelope(JSON.stringify({ ...old, v: 0 }), 'test', migrations, 3).kind).toBe('corrupt');
    expect(parseEnvelope('[]', 'test').kind).toBe('corrupt');
    expect(parseEnvelope('null', 'test').kind).toBe('corrupt');
    expect(parseEnvelope(JSON.stringify(base), 'test').kind).toBe('ok');
    expect(parseEnvelope(JSON.stringify(base), 'other').kind).toBe('corrupt');
  });
  it('reports storage that throws as unsupported (storage), without crashing init', async () => {
    const broken: VaultStorage = {
      get: async () => { throw new VaultStorageError('no storage'); },
      set: async () => { throw new VaultStorageError('no storage'); },
      delete: async () => { throw new VaultStorageError('no storage'); },
      keys: async () => { throw new VaultStorageError('no storage'); },
    };
    const vault = rig(undefined, broken).make();
    await vault.init();
    expect(vault.status).toBe('unsupported');
    expect(vault.getState().unsupportedReason).toBe('storage');
  });
});

describe('unsupported environments', () => {
  it.each([
    ['no WebAuthn', { credentials: null, PublicKeyCredential: null, isSecureContext: true }, 'no-webauthn'],
    ['an insecure context', { secureContext: false }, 'insecure-context'],
    ['a client that says it has no PRF', { capability: false }, 'no-prf'],
  ] as const)('is unsupported with %s', async (_label, setup, expected) => {
    const auth = createFakeAuthenticator('secureContext' in setup || 'capability' in setup ? (setup as { secureContext?: boolean; capability?: boolean }) : undefined);
    const env = 'credentials' in setup ? setup : auth.env;
    const vault = createVault({ id: 'u', rp: { name: 'x' }, storage: memoryStorage(), env, channel: false });
    await vault.init();
    expect(vault.status).toBe('unsupported');
    expect(vault.getState().unsupportedReason).toBe(expected);
    expect(await reasonOf(vault.enroll())).toBe('invalid-state');
  });
  it('still tries when the client cannot say whether it has PRF', async () => {
    const r = rig({ capability: 'absent' });
    const vault = r.make();
    await vault.init();
    expect(vault.status).toBe('empty');
    expect(vault.getState().support?.prf).toBe('unknown');
  });
  it('an existing vault opened where passkeys do not work stays reachable through the recovery key', async () => {
    const r = rig();
    const { vault: made, recoveryKey } = await enrolled(r);
    await made.put('k', 'v');
    const vault = createVault({ id: 'test', rp: { name: 'x' }, storage: r.storage, env: { credentials: null, PublicKeyCredential: null, isSecureContext: true }, channel: false });
    await vault.init();
    expect(vault.status).toBe('locked');
    expect(await reasonOf(vault.unlock())).toBe('unsupported');
    await vault.unlockWithRecoveryKey(recoveryKey);
    expect(await vault.get('k')).toBe('v');
  });
});

describe('auto-lock', () => {
  it('locks after the idle time and resets on activity', async () => {
    vi.useFakeTimers();
    const r = rig();
    const vault = r.make({ autoLockMs: 1000 });
    await vault.init();
    await vault.enroll();
    await vault.put('k', 'v');
    await vi.advanceTimersByTimeAsync(800);
    expect(vault.status).toBe('unlocked');
    await vault.get('k'); // activity
    await vi.advanceTimersByTimeAsync(800);
    expect(vault.status).toBe('unlocked');
    vault.touch();
    await vi.advanceTimersByTimeAsync(800);
    expect(vault.status).toBe('unlocked');
    await vi.advanceTimersByTimeAsync(300);
    expect(vault.status).toBe('locked');
    expect(await reasonOf(vault.get('k'))).toBe('locked');
  });
  it('does nothing when unset, and stops its timer on lock and dispose', async () => {
    vi.useFakeTimers();
    const r = rig();
    const { vault } = await enrolled(r);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(vault.status).toBe('unlocked');
    const timed = r.make({ autoLockMs: 1000 });
    await timed.init();
    await timed.unlock();
    timed.lock();
    expect(vi.getTimerCount()).toBe(0);
    await timed.unlock();
    expect(vi.getTimerCount()).toBe(1);
    timed.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('cross-tab sync over BroadcastChannel', () => {
  async function twoTabs(extra?: Partial<VaultOptions>) {
    const r = rig();
    const channel = bus();
    const a = r.make({ channel, ...extra });
    const b = r.make({ channel, ...extra });
    await a.init();
    await b.init();
    return { r, a, b };
  }
  const settle = () => new Promise((res) => setTimeout(res, 10));

  it('locking one tab locks the others', async () => {
    const { a, b } = await twoTabs();
    await a.enroll();
    await settle();
    expect(b.status).toBe('locked'); // enrollment reached the other tab
    await b.unlock();
    expect(a.status).toBe('unlocked');
    expect(b.status).toBe('unlocked');
    a.lock();
    await settle();
    expect(b.status).toBe('locked');
    expect(await reasonOf(b.get('x'))).toBe('locked');
  });
  it('does not unlock the other tab unless asked: each tab proves itself', async () => {
    const { a, b } = await twoTabs();
    await a.enroll();
    a.lock();
    await settle();
    await a.unlock();
    await settle();
    expect(b.status).toBe('locked');
  });
  it('shares an unlock when shareUnlock is on, including to a tab that opens later', async () => {
    const { r, a, b } = await twoTabs({ shareUnlock: true });
    await a.enroll();
    a.lock();
    await settle();
    r.auth.calls.length = 0;
    await a.unlock();
    await settle();
    expect(b.status).toBe('unlocked');
    await a.put('shared', 1);
    expect(await b.get('shared')).toBe(1);
  });
  it('tells watchers in other tabs which record changed', async () => {
    const { a, b } = await twoTabs({ shareUnlock: true });
    await a.enroll();
    await settle();
    await b.unlock();
    const hits: string[] = [];
    b.watch('doc', () => hits.push('doc'));
    b.watch('other', () => hits.push('other'));
    await a.put('doc', 'x');
    await settle();
    expect(hits).toEqual(['doc']);
    await a.delete('doc');
    await settle();
    expect(hits).toEqual(['doc', 'doc']);
  });
  it('a reset in one tab drops the keys in the others', async () => {
    const { a, b } = await twoTabs({ shareUnlock: true });
    await a.enroll();
    await settle();
    expect(b.status).toBe('unlocked');
    await a.reset();
    await settle();
    expect(b.status).toBe('empty');
  });
  it('ignores its own broadcasts and survives a channel that throws', async () => {
    const throwing = { onmessage: null, postMessage() { throw new Error('closed'); }, close: () => undefined } as BroadcastChannelLike;
    const r = rig();
    const vault = r.make({ channel: () => throwing });
    await vault.init();
    await vault.enroll();
    vault.lock();
    await vault.unlock();
    expect(vault.status).toBe('unlocked');
  });
  it('dispose closes the channel: a later lock elsewhere no longer reaches it, and init reopens it', async () => {
    const { a, b } = await twoTabs({ shareUnlock: true });
    await a.enroll();
    await settle();
    expect(b.status).toBe('unlocked');
    b.dispose();
    expect(b.status).toBe('locked');
    await b.init();
    await settle();
    expect(b.status).toBe('unlocked'); // hello → session from a
  });
});

describe('storage adapters', () => {
  async function exercise(s: VaultStorage) {
    expect(await s.get('a/1')).toBeNull();
    await s.set('a/1', 'one');
    await s.set('a/2', 'two');
    await s.set('b/1', 'other');
    expect(await s.get('a/1')).toBe('one');
    expect((await s.keys('a/')).sort()).toEqual(['a/1', 'a/2']);
    expect((await s.keys('')).sort()).toEqual(['a/1', 'a/2', 'b/1']);
    await s.set('a/1', 'changed');
    expect(await s.get('a/1')).toBe('changed');
    await s.delete('a/1');
    await s.delete('missing');
    expect(await s.keys('a/')).toEqual(['a/2']);
  }
  it('memory', async () => { await exercise(memoryStorage()); });
  it('localStorage (and prefixes keys)', async () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); },
      key: (i: number) => [...map.keys()][i] ?? null, get length() { return map.size; },
    };
    map.set('unrelated', 'x');
    await exercise(localStorageStorage({ storage }));
    expect(map.has('bl-vault:a/2')).toBe(true);
    expect(map.get('unrelated')).toBe('x');
  });
  it('localStorage errors become VaultStorageError', async () => {
    const full = { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); }, removeItem: () => undefined, key: () => null, length: 0 };
    await expect(localStorageStorage({ storage: full }).set('a', 'b')).rejects.toBeInstanceOf(VaultStorageError);
  });
  it('indexedDB', async () => { await exercise(indexedDbStorage({ name: 'adapter-test', factory: new IDBFactory() })); });
  it('indexedDB data survives a new adapter on the same database', async () => {
    const factory = new IDBFactory();
    await indexedDbStorage({ name: 'persist', factory }).set('k', 'v');
    expect(await indexedDbStorage({ name: 'persist', factory }).get('k')).toBe('v');
  });
  it('runs a whole vault on IndexedDB, across instances', async () => {
    const factory = new IDBFactory();
    const auth = createFakeAuthenticator();
    const make = () => createVault({ id: 'idb', rp: { name: 'x' }, storage: indexedDbStorage({ name: 'v', factory }), env: auth.env, channel: false });
    const one = make();
    await one.init();
    const { recoveryKey } = await one.enroll();
    await one.put('k', { n: 1 });
    const two = make();
    await two.init();
    expect(two.status).toBe('locked');
    await two.unlock();
    expect(await two.get('k')).toEqual({ n: 1 });
    two.lock();
    await two.unlockWithRecoveryKey(recoveryKey);
    expect(await two.list()).toEqual(['k']);
  });
  it('the default storage is IndexedDB when it exists (fake-indexeddb/auto provides the global)', async () => {
    const auth = createFakeAuthenticator();
    const vault = createVault({ id: 'default-idb', rp: { name: 'x' }, env: auth.env, channel: false });
    await vault.init();
    await vault.enroll();
    await vault.put('k', 1);
    const dbs = await indexedDB.databases();
    expect(dbs.map((d) => d.name)).toContain('bl-vault');
  });
  it('a vault without any storage global is unsupported rather than throwing', async () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')!;
    // @ts-expect-error simulate a server / locked-down browser
    delete globalThis.indexedDB;
    try {
      const auth = createFakeAuthenticator();
      const vault = createVault({ id: 'no-storage', rp: { name: 'x' }, env: auth.env, channel: false });
      await vault.init();
      expect(vault.status).toBe('unsupported');
      expect(vault.getState().unsupportedReason).toBe('storage');
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', saved);
    }
  });
});

describe('server safety', () => {
  it('creating a vault performs no I/O and exposes a stable server snapshot', () => {
    const touched: string[] = [];
    const storage = new Proxy({} as VaultStorage, { get: (_t, p) => { touched.push(String(p)); return async () => null; } });
    const vault = createVault({ id: 'ssr', rp: { name: 'x' }, storage, channel: () => { throw new Error('channel opened'); } });
    expect(vault.getState()).toBe(vault.getServerState());
    expect(touched).toEqual([]);
  });
});

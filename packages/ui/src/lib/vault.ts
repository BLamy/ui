/* ══ vault — encrypted browser storage unlocked by a passkey ══
   Records are encrypted with AES-GCM under a random 256-bit master secret. The master secret is never stored in
   the clear: it is wrapped (AES-GCM again) once per way of unlocking, in a "slot":

     passkey slot   key-encryption key = HKDF(the passkey's PRF output)      — one per enrolled passkey
     recovery slot  key-encryption key = HKDF(a 160-bit recovery key)        — exactly one, mandatory

   so adding a second passkey, or replacing the recovery key, re-wraps 32 bytes and never touches a record.
   The master secret is HKDF-expanded into two keys that only ever exist as non-extractable `CryptoKey`s while
   the vault is unlocked: one encrypts records, one keys the HMAC that names them. Record names are therefore not
   readable from storage; each record is `{ iv, ct }` with the AAD bound to its storage location, so a record cannot be
   copied under another name and still authenticate.

     const vault = createVault({ id: 'notes', rp: { name: 'Notes' } })
     await vault.init()                                  // status: 'empty' | 'locked' | 'unsupported'
     const { recoveryKey } = await vault.enroll()        // creates the passkey; show recoveryKey ONCE
     await vault.put('token', { value: 'abc' })
     vault.lock(); await vault.unlock()                  // passkey prompt → status 'unlocked'

   What this does not do: stop script running on the page (while the vault is unlocked it can read and write
   records and ask for the passkey prompt), protect against an attacker who also controls the browser profile's
   live session, or prove freshness (an old copy of a record can be put back). See the docs page.

   Nothing here runs at import time and nothing touches `window`, `navigator` or `indexedDB` until a method is called. */

import {
  bytesToBase64Url, base64UrlToBytes, createPasskey, detectPasskeySupport, getPrfSecret, passkeyUnsupportedReason,
  randomBytes, wipe,
  type Bytes, type PasskeyEnv, type PasskeySupport,
} from '@/lib/passkey';
import { VaultStorageError, indexedDbStorage, localStorageStorage, type VaultStorage } from '@/lib/vault-storage';

/* ── public types ── */

export type VaultStatus =
  /** Reading storage and probing the browser. The first state, and the only one on the server. */
  | 'loading'
  /** Nothing can be done: no WebAuthn / PRF, an insecure context, no storage, or data from a newer version. See `unsupportedReason`. */
  | 'unsupported'
  /** Supported, nothing enrolled yet: call `enroll()`. */
  | 'empty'
  /** Enrolled; records are unreadable until `unlock()` or `unlockWithRecoveryKey()`. */
  | 'locked'
  | 'unlocked';

export type VaultUnsupportedReason = 'insecure-context' | 'no-webauthn' | 'no-prf' | 'storage' | 'newer-version';

export type VaultBusy = 'enroll' | 'unlock' | 'recovery' | 'add-passkey' | 'remove-passkey' | 'recovery-key' | 'reset';

export interface VaultPasskeyInfo {
  /** Base64url credential id. */
  id: string;
  label: string;
  createdAt: number;
}

/** An immutable snapshot, replaced on every change (for `useSyncExternalStore`). */
export interface VaultState {
  status: VaultStatus;
  unsupportedReason: VaultUnsupportedReason | null;
  /** What the browser can do; `null` until probed. */
  support: PasskeySupport | null;
  passkeys: readonly VaultPasskeyInfo[];
  /** A recovery key exists (always true once enrolled). */
  hasRecoveryKey: boolean;
  /** The user confirmed saving it (`confirmRecoveryKey`). While false, nag. */
  recoveryConfirmed: boolean;
  /** An interactive operation is in flight (a passkey prompt is probably open). */
  busy: VaultBusy | null;
  /** Number of corrupt entries moved aside; nothing is deleted. See `listQuarantine()`. */
  quarantined: number;
}

export type VaultErrorReason =
  /** The operation needs an unlocked vault. */
  | 'locked'
  /** The operation does not apply in the current status (`enroll` when already enrolled…). */
  | 'invalid-state'
  /** Another interactive operation (here or in another tab) is in progress. */
  | 'busy'
  /** The passkey answered, but its secret does not open this vault (a different credential, or tampered data). */
  | 'wrong-key'
  /** The recovery key has the right shape but does not open this vault. */
  | 'wrong-recovery-key'
  /** The text is not a recovery key (wrong length or characters). */
  | 'invalid-recovery-key'
  /** A stored entry is damaged or was altered; it was kept, not deleted. */
  | 'corrupt'
  /** Written by a newer version of this library; left untouched. */
  | 'newer-version'
  | 'storage'
  | 'invalid';

export class VaultError extends Error {
  readonly reason: VaultErrorReason;
  override readonly cause?: unknown;
  constructor(reason: VaultErrorReason, message: string, cause?: unknown) {
    super(message);
    this.name = 'VaultError';
    this.reason = reason;
    this.cause = cause;
  }
}

export interface BroadcastChannelLike {
  postMessage(message: unknown): void;
  close(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export interface VaultOptions {
  /** Names the vault inside its storage. Different ids are different vaults. */
  id: string;
  /** The relying party: `name` is shown by the authenticator; `id` (a registrable domain) defaults to the current host.
   *  Passkeys are bound to it, so changing it later makes existing passkeys unusable (the recovery key still works). */
  rp: { name: string; id?: string };
  /** Account name the authenticator lists the passkey under. Default `Vault`. */
  userName?: string;
  /** Default: IndexedDB. */
  storage?: VaultStorage;
  /** Restrict enrollment to built-in (`platform`) or removable/phone (`cross-platform`) authenticators. Default: user chooses. */
  attachment?: 'platform' | 'cross-platform';
  /** Lock after this many milliseconds without a vault operation (`get`, `put`, … or `touch()`). 0 or omitted: never. */
  autoLockMs?: number;
  /** Let other tabs unlock from this tab's unlock, over `BroadcastChannel`. Off by default: each tab asks. Locking
   *  always propagates. */
  shareUnlock?: boolean;
  /** `false` disables cross-tab sync; a function builds the channel (tests). Default: `BroadcastChannel` when it exists. */
  channel?: false | ((name: string) => BroadcastChannelLike);
  /** Browser stand-in for tests; see `PasskeyEnv`. */
  env?: PasskeyEnv;
}

export interface EnrollOptions {
  /** Name for the first passkey in the list. Default `Passkey`. */
  label?: string;
  signal?: AbortSignal;
}

export interface AddPasskeyOptions {
  label?: string;
  /** Authorise with the recovery key instead of an existing passkey (use this after losing the old passkey). */
  recoveryKey?: string;
  signal?: AbortSignal;
}

export interface QuarantineEntry {
  key: string;
  /** When it was set aside (ms since the epoch). */
  at: number;
  /** The untouched stored text. */
  raw: string;
}

export interface Vault {
  readonly id: string;
  readonly status: VaultStatus;
  getState(): VaultState;
  /** The state to render on the server and during hydration. */
  getServerState(): VaultState;
  subscribe(listener: () => void): () => void;
  /** Opens storage and the cross-tab channel and works out the status. Idempotent; every other method calls it. */
  init(): Promise<void>;
  /** Creates a passkey and a recovery key, then unlocks. The returned recovery key is not stored anywhere: show it now. */
  enroll(options?: EnrollOptions): Promise<{ recoveryKey: string }>;
  /** Passkey prompt → unlocked. */
  unlock(options?: { signal?: AbortSignal }): Promise<void>;
  unlockWithRecoveryKey(recoveryKey: string): Promise<void>;
  /** Forgets the keys. Idempotent. */
  lock(): void;
  put(name: string, value: unknown): Promise<void>;
  get<T = unknown>(name: string): Promise<T | undefined>;
  list(): Promise<string[]>;
  delete(name: string): Promise<void>;
  /** Calls `listener` after `name` is written, deleted or changed in another tab. */
  watch(name: string, listener: () => void): () => void;
  /** Enrols another passkey. Authorises with an existing passkey (a prompt) or `recoveryKey`; records are not re-encrypted. */
  addPasskey(options?: AddPasskeyOptions): Promise<void>;
  /** Unlocked only. At least one passkey must remain. */
  removePasskey(credentialId: string): Promise<void>;
  /** Replaces the recovery key (old one stops working) and returns the new one. Authorises like `addPasskey`. */
  regenerateRecoveryKey(options?: { recoveryKey?: string; signal?: AbortSignal }): Promise<string>;
  /** Records that the user saved the recovery key. */
  confirmRecoveryKey(): Promise<void>;
  /** Does this text open the vault? Does not change the status. */
  verifyRecoveryKey(recoveryKey: string): Promise<boolean>;
  /** Erases the envelope and every record (corrupt entries kept in quarantine stay). The way out when both the passkey and the
   *  recovery key are lost. */
  reset(): Promise<void>;
  /** Corrupt entries set aside. */
  listQuarantine(): Promise<QuarantineEntry[]>;
  /** Restarts the auto-lock timer. */
  touch(): void;
  /** Closes the channel, stops timers and locks (without telling other tabs). `init()` brings it back. */
  dispose(): void;
}

/* ── envelope ── */

export const VAULT_VERSION = 1;

interface SlotBase {
  /** HKDF salt for this slot's key-encryption key (base64url, 32 bytes). */
  salt: string;
  iv: string;
  /** AES-GCM(master secret), AAD binds vault id, slot id and kind. */
  wrapped: string;
  createdAt: number;
}
interface PasskeySlot extends SlotBase { kind: 'passkey'; id: string; label: string; transports?: string[] }
interface RecoverySlot extends SlotBase { kind: 'recovery'; id: 'recovery'; confirmed: boolean }
type Slot = PasskeySlot | RecoverySlot;

interface Envelope {
  v: typeof VAULT_VERSION;
  id: string;
  createdAt: number;
  updatedAt: number;
  /** PRF salt (public; base64url, 32 bytes) shared by every passkey slot. */
  prfSalt: string;
  slots: Slot[];
}

interface RecordBlob { v: 1; iv: string; ct: string }

type Migration = (envelope: Record<string, unknown>) => Record<string, unknown>;
/** `MIGRATIONS[n]` upgrades a version-`n` envelope to `n + 1`. Empty until the format changes. */
const MIGRATIONS: Record<number, Migration> = {};

type ParsedEnvelope = { kind: 'ok'; envelope: Envelope } | { kind: 'newer' } | { kind: 'corrupt' };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isB64 = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]+$/.test(v);

function validSlot(s: unknown): s is Slot {
  if (!isObject(s) || !isB64(s['salt']) || !isB64(s['iv']) || !isB64(s['wrapped']) || typeof s['createdAt'] !== 'number') return false;
  if (s['kind'] === 'recovery') return s['id'] === 'recovery' && typeof s['confirmed'] === 'boolean';
  if (s['kind'] === 'passkey') {
    return isB64(s['id']) && typeof s['label'] === 'string'
      && (s['transports'] === undefined || (Array.isArray(s['transports']) && s['transports'].every((t) => typeof t === 'string')));
  }
  return false;
}

/** Parses stored envelope text, running migrations. `newer` = written by a later version (do not touch); `corrupt` = unreadable. */
export function parseEnvelope(text: string, vaultId: string, migrations: Record<number, Migration> = MIGRATIONS, current = VAULT_VERSION): ParsedEnvelope {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return { kind: 'corrupt' }; }
  if (!isObject(value) || typeof value['v'] !== 'number' || !Number.isInteger(value['v']) || value['v'] < 1) return { kind: 'corrupt' };
  if (value['v'] > current) return { kind: 'newer' };
  let e: Record<string, unknown> = value;
  for (let v = e['v'] as number; v < current; v++) {
    const step = migrations[v];
    if (!step) return { kind: 'corrupt' };
    try { e = { ...step(e), v: v + 1 }; } catch { return { kind: 'corrupt' }; }
  }
  const slots = e['slots'];
  if (e['id'] !== vaultId || !isB64(e['prfSalt']) || typeof e['createdAt'] !== 'number' || typeof e['updatedAt'] !== 'number'
    || !Array.isArray(slots) || !slots.length || !slots.every(validSlot)) return { kind: 'corrupt' };
  const ids = new Set((slots as Slot[]).map((s) => s.id));
  if (ids.size !== slots.length || (slots as Slot[]).filter((s) => s.kind === 'recovery').length !== 1) return { kind: 'corrupt' };
  return { kind: 'ok', envelope: e as unknown as Envelope };
}

/* ── crypto ── */

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;
const utf8 = (s: string): Bytes => enc.encode(s);

const AES = { name: 'AES-GCM', length: 256 } as const;

async function hkdf(ikm: Bytes, salt: Bytes, info: string): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: utf8(info) }, base, AES, false, ['encrypt', 'decrypt']);
}

const slotAad = (vaultId: string, slotId: string, kind: Slot['kind']) => utf8(`bl-vault/v1/slot|${vaultId}|${kind}|${slotId}`);
const recordAad = (vaultId: string, location: string) => utf8(`bl-vault/v1/record|${vaultId}|${location}`);

/** The key-encryption key for one slot. */
const slotKek = (ikm: Bytes, salt: Bytes, vaultId: string, kind: Slot['kind'], slotId: string) => hkdf(ikm, salt, `bl-vault/v1/kek|${vaultId}|${kind}|${slotId}`);

async function wrapMaster(master: Bytes, ikm: Bytes, vaultId: string, kind: Slot['kind'], slotId: string): Promise<Pick<SlotBase, 'salt' | 'iv' | 'wrapped'>> {
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const kek = await slotKek(ikm, salt, vaultId, kind, slotId);
  const wrapped = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: slotAad(vaultId, slotId, kind) }, kek, master);
  return { salt: bytesToBase64Url(salt), iv: bytesToBase64Url(iv), wrapped: bytesToBase64Url(wrapped) };
}

/** Opens a slot. The caller wipes the returned master secret. */
async function unwrapMaster(slot: Slot, ikm: Bytes, vaultId: string, reason: 'wrong-key' | 'wrong-recovery-key'): Promise<Bytes> {
  try {
    const kek = await slotKek(ikm, base64UrlToBytes(slot.salt), vaultId, slot.kind, slot.id);
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: base64UrlToBytes(slot.iv), additionalData: slotAad(vaultId, slot.id, slot.kind) }, kek, base64UrlToBytes(slot.wrapped));
    if (plain.byteLength !== 32) throw new Error('bad master length');
    return new Uint8Array(plain);
  } catch (e) {
    throw new VaultError(reason, reason === 'wrong-key' ? 'This passkey does not open the vault.' : 'That recovery key does not open the vault.', e);
  }
}

interface Session { enc: CryptoKey; mac: CryptoKey }

/** Expands the master secret into the two non-extractable working keys. */
async function deriveSession(master: Bytes, vaultId: string): Promise<Session> {
  const base = await subtle().importKey('raw', master, 'HKDF', false, ['deriveKey']);
  const salt = utf8(vaultId);
  const [encKey, macKey] = await Promise.all([
    subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: utf8('bl-vault/v1/records') }, base, AES, false, ['encrypt', 'decrypt']),
    subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: utf8('bl-vault/v1/names') }, base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']),
  ]);
  return { enc: encKey, mac: macKey };
}

/* ── recovery key: 160 random bits in Crockford base32, grouped `XXXX-XXXX-…` (8 groups) ── */

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const RECOVERY_BYTES = 20;

function encodeRecoveryKey(bytes: Bytes): string {
  let bits = 0;
  let acc = 0;
  let out = '';
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) { out += CROCKFORD[(acc >>> (bits - 5)) & 31]; bits -= 5; }
    acc &= (1 << bits) - 1;
  }
  return (out.match(/.{4}/g) ?? []).join('-');
}

/** Accepts any case, spaces or dashes, and Crockford's look-alikes (O→0, I/L→1). Returns the 20 key bytes. */
function decodeRecoveryKey(text: string): Bytes | null {
  const clean = text.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (clean.length !== (RECOVERY_BYTES * 8) / 5) return null;
  const out = new Uint8Array(RECOVERY_BYTES);
  let bits = 0;
  let acc = 0;
  let n = 0;
  for (const ch of clean) {
    const v = CROCKFORD.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) { out[n++] = (acc >>> (bits - 8)) & 255; bits -= 8; acc &= (1 << bits) - 1; }
  }
  return out;
}

/* ── storage defaults ── */

function defaultStorage(): VaultStorage {
  const g = globalThis as { indexedDB?: unknown; localStorage?: unknown };
  if (g.indexedDB) return indexedDbStorage();
  if (g.localStorage) return localStorageStorage();
  throw new VaultStorageError('This environment has no IndexedDB or localStorage.');
}

const toVaultError = (e: unknown): unknown => (e instanceof VaultStorageError ? new VaultError('storage', e.message, e) : e);

/* ── the vault ── */

type Message =
  | { t: 'lock'; from: string }
  | { t: 'meta'; from: string }
  | { t: 'changed'; from: string; name: string }
  | { t: 'hello'; from: string }
  | { t: 'session'; from: string; enc: CryptoKey; mac: CryptoKey };

type Outgoing = Message extends infer M ? (M extends { from: string } ? Omit<M, 'from'> : never) : never;

const SERVER_STATE: VaultState = {
  status: 'loading', unsupportedReason: null, support: null, passkeys: [], hasRecoveryKey: false, recoveryConfirmed: false, busy: null, quarantined: 0,
};

export function createVault(options: VaultOptions): Vault {
  const { id, rp } = options;
  if (!id || /[/\s]/.test(id)) throw new VaultError('invalid', 'A vault id must be non-empty and contain no slash or whitespace.');
  const tabId = bytesToBase64Url(randomBytes(9));
  const metaKey = `${id}/meta`;
  const recordPrefix = `${id}/r/`;
  const quarantinePrefix = `${id}/quarantine/`;

  let state: VaultState = SERVER_STATE;
  const listeners = new Set<() => void>();
  const watchers = new Map<string, Set<() => void>>();
  let storage: VaultStorage | null = options.storage ?? null;
  let envelope: Envelope | null = null;
  let session: Session | null = null;
  let channel: BroadcastChannelLike | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let initPromise: Promise<void> | null = null;
  let writes: Promise<unknown> = Promise.resolve();

  /* state */
  const setState = (patch: Partial<VaultState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  const infoOf = (e: Envelope | null): Pick<VaultState, 'passkeys' | 'hasRecoveryKey' | 'recoveryConfirmed'> => ({
    passkeys: (e?.slots.filter((s): s is PasskeySlot => s.kind === 'passkey') ?? []).map(({ id: pid, label, createdAt }) => ({ id: pid, label, createdAt })),
    hasRecoveryKey: Boolean(e),
    recoveryConfirmed: Boolean(e?.slots.some((s) => s.kind === 'recovery' && s.confirmed)),
  });
  const settle = () => {
    const support = state.support;
    let status: VaultStatus;
    let unsupportedReason: VaultUnsupportedReason | null = null;
    if (state.unsupportedReason === 'newer-version' || state.unsupportedReason === 'storage') {
      status = 'unsupported'; unsupportedReason = state.unsupportedReason;
    } else if (envelope) {
      status = session ? 'unlocked' : 'locked'; // an existing vault stays usable through its recovery key even where passkeys are not
    } else {
      const why = support ? passkeyUnsupportedReason(support) : null;
      status = why ? 'unsupported' : 'empty';
      unsupportedReason = why;
    }
    setState({ ...infoOf(envelope), status, unsupportedReason });
  };

  /* storage */
  const store = (): VaultStorage => {
    if (!storage) {
      try { storage = defaultStorage(); } catch (e) { throw toVaultError(e); }
    }
    return storage;
  };
  const io = async <T,>(fn: (s: VaultStorage) => Promise<T>): Promise<T> => {
    try { return await fn(store()); } catch (e) { throw toVaultError(e); }
  };
  /** Serialises writes from this tab so a later `put` never lands before an earlier one. */
  const queued = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = writes.then(fn, fn);
    writes = run.catch(() => undefined);
    return run;
  };

  const quarantine = async (raw: string, label: string) => {
    const key = `${quarantinePrefix}${Date.now()}-${label}`;
    await io(async (s) => { await s.set(key, raw); });
    setState({ quarantined: state.quarantined + 1 });
  };

  const loadEnvelope = async (): Promise<'ok' | 'newer'> => {
    const raw = await io((s) => s.get(metaKey));
    if (raw === null) { envelope = null; return 'ok'; }
    const parsed = parseEnvelope(raw, id);
    if (parsed.kind === 'ok') { envelope = parsed.envelope; return 'ok'; }
    if (parsed.kind === 'newer') { envelope = null; return 'newer'; }
    // Damaged: keep the bytes, then clear the way so the vault reads as empty rather than failing forever.
    await quarantine(raw, 'meta');
    await io((s) => s.delete(metaKey));
    envelope = null;
    return 'ok';
  };

  /** Moves record entries that no envelope owns (left by a quarantined or reset vault) aside before a new vault starts. */
  const quarantineOrphans = async () => {
    const keys = await io((s) => s.keys(recordPrefix));
    for (const key of keys) {
      const raw = await io((s) => s.get(key));
      if (raw !== null) await quarantine(raw, `r-${key.slice(recordPrefix.length)}`);
      await io((s) => s.delete(key));
    }
  };

  /* cross-tab */
  const post = (message: Outgoing) => {
    try { channel?.postMessage({ ...message, from: tabId }); } catch { /* a closed channel or an uncloneable key: ignore */ }
  };
  const notify = (name: string) => watchers.get(name)?.forEach((l) => l());
  const notifyAll = () => watchers.forEach((set) => set.forEach((l) => l()));

  const onMessage = (event: { data: unknown }) => {
    const m = event.data as Message | null;
    if (!m || typeof m !== 'object' || m.from === tabId) return;
    switch (m.t) {
      case 'lock':
        lockLocal();
        break;
      case 'meta':
        void reloadMeta();
        break;
      case 'changed':
        notify(m.name);
        break;
      case 'hello':
        if (options.shareUnlock && session) post({ t: 'session', enc: session.enc, mac: session.mac });
        break;
      case 'session':
        if (options.shareUnlock && !session && envelope && m.enc instanceof CryptoKey && m.mac instanceof CryptoKey) {
          session = { enc: m.enc, mac: m.mac };
          arm();
          settle();
          notifyAll();
        }
        break;
    }
  };

  const reloadMeta = async () => {
    try {
      const prevSalt = envelope?.prfSalt;
      const result = await loadEnvelope();
      if (result === 'newer') setState({ unsupportedReason: 'newer-version' });
      // A different vault under the same id (reset and re-enrolled elsewhere): the old keys no longer apply.
      if (session && (!envelope || envelope.prfSalt !== prevSalt)) { session = null; clearTimer(); notifyAll(); }
      settle();
    } catch { /* storage unavailable: keep what we have */ }
  };

  const openChannel = () => {
    if (channel || options.channel === false) return;
    try {
      const make = options.channel ?? ((name: string) => {
        const BC = (globalThis as { BroadcastChannel?: new (n: string) => BroadcastChannelLike }).BroadcastChannel;
        if (!BC) throw new Error('no BroadcastChannel');
        return new BC(name);
      });
      channel = make(`bl-vault:${id}`);
      channel.onmessage = onMessage;
    } catch { channel = null; }
  };
  const closeChannel = () => {
    if (!channel) return;
    channel.onmessage = null;
    try { channel.close(); } catch { /* already closed */ }
    channel = null;
  };

  /* locking */
  const clearTimer = () => { if (timer !== undefined) { clearTimeout(timer); timer = undefined; } };
  const arm = () => {
    clearTimer();
    if (options.autoLockMs && options.autoLockMs > 0 && session) timer = setTimeout(() => api.lock(), options.autoLockMs);
  };
  const lockLocal = () => {
    clearTimer();
    if (!session) return;
    session = null;
    settle();
    notifyAll();
  };

  const shareSession = () => {
    if (options.shareUnlock && session) post({ t: 'session', enc: session.enc, mac: session.mac });
  };

  const requireSession = (): Session => {
    if (!session) throw new VaultError('locked', 'The vault is locked.');
    arm();
    return session;
  };

  /** One interactive operation at a time per tab; across tabs, a Web Lock when the browser has them. */
  const exclusive = async <T,>(busy: VaultBusy, fn: () => Promise<T>, crossTab = true): Promise<T> => {
    if (state.busy) throw new VaultError('busy', 'Another vault operation is in progress.');
    setState({ busy });
    try {
      const locks = (globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks;
      if (!locks || !crossTab) return await fn();
      return await locks.request(`bl-vault:${id}`, { ifAvailable: true }, async (lock) => {
        if (!lock) throw new VaultError('busy', 'Another tab is changing this vault.');
        return fn();
      });
    } finally {
      setState({ busy: null });
    }
  };

  const persistEnvelope = async (next: Envelope) => {
    await io((s) => s.set(metaKey, JSON.stringify(next)));
    envelope = next;
    settle();
    post({ t: 'meta' });
  };

  const fresh = async (): Promise<Envelope> => {
    await loadEnvelope();
    if (!envelope) { settle(); throw new VaultError('invalid-state', 'No vault has been set up yet.'); }
    return envelope;
  };

  /** Passkey (default) or recovery key → the master secret. Throws typed errors; the caller wipes the result. */
  const authorize = async (env: Envelope, via: { recoveryKey?: string; signal?: AbortSignal }): Promise<Bytes> => {
    if (via.recoveryKey !== undefined) return masterFromRecovery(env, via.recoveryKey);
    const passkeys = env.slots.filter((s): s is PasskeySlot => s.kind === 'passkey');
    const got = await getPrfSecret(passkeys.map((s) => ({ id: s.id, transports: s.transports })), base64UrlToBytes(env.prfSalt), { rpId: rp.id, signal: via.signal, env: options.env });
    try {
      const slot = passkeys.find((s) => s.id === got.credentialId);
      if (!slot) throw new VaultError('wrong-key', 'That passkey is not part of this vault.');
      return await unwrapMaster(slot, got.secret, id, 'wrong-key');
    } finally {
      wipe(got.secret);
    }
  };

  const masterFromRecovery = async (env: Envelope, text: string): Promise<Bytes> => {
    const bytes = decodeRecoveryKey(text);
    if (!bytes) throw new VaultError('invalid-recovery-key', 'A recovery key is 32 letters and digits, like XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX.');
    try {
      const slot = env.slots.find((s) => s.kind === 'recovery');
      if (!slot) throw new VaultError('corrupt', 'The vault has no recovery slot.');
      return await unwrapMaster(slot, bytes, id, 'wrong-recovery-key');
    } finally {
      wipe(bytes);
    }
  };

  /** Creates a passkey bound to this vault's PRF salt and returns its slot. */
  const newPasskeySlot = async (master: Bytes, env: Pick<Envelope, 'prfSalt' | 'slots'>, label: string, signal?: AbortSignal): Promise<PasskeySlot> => {
    const salt = base64UrlToBytes(env.prfSalt);
    const created = await createPasskey({
      rpName: rp.name, rpId: rp.id, userName: options.userName ?? 'Vault', salt, attachment: options.attachment, signal, env: options.env,
      excludeCredentialIds: env.slots.filter((s) => s.kind === 'passkey').map((s) => s.id),
    });
    let secret = created.secret;
    try {
      if (!secret) {
        // Security keys and some authenticators only evaluate PRF on an assertion: a second prompt.
        const got = await getPrfSecret([{ id: created.credentialId, transports: created.transports }], salt, { rpId: rp.id, signal, env: options.env });
        if (got.credentialId !== created.credentialId) { wipe(got.secret); throw new VaultError('wrong-key', 'A different passkey answered.'); }
        secret = got.secret;
      }
      const wrapped = await wrapMaster(master, secret, id, 'passkey', created.credentialId);
      return {
        kind: 'passkey', id: created.credentialId, label, createdAt: Date.now(),
        ...(created.transports.length ? { transports: created.transports } : {}), ...wrapped,
      };
    } finally {
      if (secret) wipe(secret);
    }
  };

  const nextLabel = (env: Pick<Envelope, 'slots'>) => `Passkey ${env.slots.filter((s) => s.kind === 'passkey').length + 1}`;

  /* record helpers */
  const locationOf = async (s: Session, name: string): Promise<string> => bytesToBase64Url(await subtle().sign('HMAC', s.mac, utf8(name)));
  const checkName = (name: unknown): string => {
    if (typeof name !== 'string' || !name || name.length > 1024) throw new VaultError('invalid', 'A record name must be a non-empty string up to 1024 characters.');
    return name;
  };

  const readRecord = async (s: Session, location: string, key: string, raw: string): Promise<{ n: string; v: unknown }> => {
    let blob: RecordBlob;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isObject(parsed) || parsed['v'] !== 1 || !isB64(parsed['iv']) || !isB64(parsed['ct'])) throw new Error('shape');
      blob = parsed as unknown as RecordBlob;
    } catch (e) {
      await quarantine(raw, `r-${location}`);
      await io((st) => st.delete(key));
      throw new VaultError('corrupt', 'A stored record was damaged. It was set aside, not deleted.', e);
    }
    let plain: ArrayBuffer;
    try {
      plain = await subtle().decrypt({ name: 'AES-GCM', iv: base64UrlToBytes(blob.iv), additionalData: recordAad(id, location) }, s.enc, base64UrlToBytes(blob.ct));
    } catch (e) {
      throw new VaultError('corrupt', 'A stored record failed authentication (wrong key, or it was changed or moved).', e);
    }
    const body = JSON.parse(new TextDecoder().decode(plain)) as { n: string; v: unknown };
    return body;
  };

  /* ── the API ── */
  const api: Vault = {
    id,
    get status() { return state.status; },
    getState: () => state,
    getServerState: () => SERVER_STATE,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },

    init() {
      if (!initPromise) {
        initPromise = (async () => {
          openChannel();
          const support = await detectPasskeySupport(options.env);
          setState({ support });
          try {
            const result = await loadEnvelope();
            const quarantined = (await io((s) => s.keys(quarantinePrefix))).length;
            setState({ quarantined, unsupportedReason: result === 'newer' ? 'newer-version' : null });
          } catch (e) {
            if (e instanceof VaultError && e.reason === 'storage') setState({ unsupportedReason: 'storage' });
            else throw e;
          }
          settle();
          post({ t: 'hello' });
        })().catch((e) => { initPromise = null; throw e; });
      }
      return initPromise;
    },

    async enroll({ label = 'Passkey', signal } = {}) {
      await api.init();
      if (state.status !== 'empty') throw new VaultError('invalid-state', state.status === 'unsupported' ? 'Passkeys are not available here.' : 'A vault is already set up.');
      return exclusive('enroll', async () => {
        await loadEnvelope();
        if (envelope) { settle(); throw new VaultError('invalid-state', 'A vault is already set up.'); }
        const master = randomBytes(32);
        const recoveryBytes = randomBytes(RECOVERY_BYTES);
        try {
          const base = { prfSalt: bytesToBase64Url(randomBytes(32)), slots: [] as Slot[] };
          const passkey = await newPasskeySlot(master, base, label, signal);
          const recovery: RecoverySlot = { kind: 'recovery', id: 'recovery', confirmed: false, createdAt: Date.now(), ...(await wrapMaster(master, recoveryBytes, id, 'recovery', 'recovery')) };
          const now = Date.now();
          const next: Envelope = { v: VAULT_VERSION, id, createdAt: now, updatedAt: now, prfSalt: base.prfSalt, slots: [passkey, recovery] };
          await queued(async () => {
            await quarantineOrphans();
            await persistEnvelope(next);
          });
          session = await deriveSession(master, id);
          arm();
          settle();
          shareSession();
          return { recoveryKey: encodeRecoveryKey(recoveryBytes) };
        } finally {
          wipe(master);
          wipe(recoveryBytes);
        }
      });
    },

    async unlock({ signal } = {}) {
      await api.init();
      if (state.status === 'unlocked') return;
      if (state.status !== 'locked') throw new VaultError('invalid-state', 'There is no vault to unlock.');
      await exclusive('unlock', async () => {
        const env = await fresh();
        const master = await authorize(env, { signal });
        try {
          session = await deriveSession(master, id);
        } finally {
          wipe(master);
        }
        arm();
        settle();
        shareSession();
      }, false);
    },

    async unlockWithRecoveryKey(recoveryKey) {
      await api.init();
      if (state.status === 'unlocked') return;
      if (state.status !== 'locked') throw new VaultError('invalid-state', 'There is no vault to unlock.');
      await exclusive('recovery', async () => {
        const env = await fresh();
        const master = await masterFromRecovery(env, recoveryKey);
        try {
          session = await deriveSession(master, id);
        } finally {
          wipe(master);
        }
        arm();
        settle();
        shareSession();
      }, false);
    },

    lock() {
      if (!session) return;
      lockLocal();
      post({ t: 'lock' });
    },

    async put(name, value) {
      checkName(name);
      if (value === undefined) throw new VaultError('invalid', 'undefined cannot be stored; use delete().');
      // The whole write runs in the queue so puts land in call order, whatever the crypto timing.
      await queued(async () => {
        await api.init();
        const s = requireSession();
        const location = await locationOf(s, name);
        const iv = randomBytes(12);
        const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: recordAad(id, location) }, s.enc, utf8(JSON.stringify({ n: name, v: value })));
        const blob: RecordBlob = { v: 1, iv: bytesToBase64Url(iv), ct: bytesToBase64Url(ct) };
        await io((st) => st.set(recordPrefix + location, JSON.stringify(blob)));
      });
      notify(name);
      post({ t: 'changed', name });
    },

    async get<T = unknown>(name: string) {
      await api.init();
      checkName(name);
      const s = requireSession();
      const location = await locationOf(s, name);
      const key = recordPrefix + location;
      const raw = await io((st) => st.get(key));
      if (raw === null) return undefined;
      const body = await readRecord(s, location, key, raw);
      if (body.n !== name) throw new VaultError('corrupt', 'A stored record does not belong to this name.');
      return body.v as T;
    },

    async list() {
      await api.init();
      const s = requireSession();
      const keys = await io((st) => st.keys(recordPrefix));
      const names: string[] = [];
      for (const key of keys) {
        const location = key.slice(recordPrefix.length);
        const raw = await io((st) => st.get(key));
        if (raw === null) continue;
        try {
          const body = await readRecord(s, location, key, raw);
          if (typeof body.n === 'string' && (await locationOf(s, body.n)) === location) names.push(body.n);
        } catch { /* a damaged or foreign record is skipped (and kept); get() reports it by name */ }
      }
      return names.sort();
    },

    async delete(name) {
      checkName(name);
      await queued(async () => {
        await api.init();
        const s = requireSession();
        const location = await locationOf(s, name);
        await io((st) => st.delete(recordPrefix + location));
      });
      notify(name);
      post({ t: 'changed', name });
    },

    watch(name, listener) {
      let set = watchers.get(name);
      if (!set) watchers.set(name, (set = new Set()));
      set.add(listener);
      return () => { set.delete(listener); if (!set.size) watchers.delete(name); };
    },

    async addPasskey({ label, recoveryKey, signal } = {}) {
      await api.init();
      if (state.status !== 'locked' && state.status !== 'unlocked') throw new VaultError('invalid-state', 'There is no vault yet.');
      await exclusive('add-passkey', async () => {
        const env = await fresh();
        // Re-prove possession first: a script on the page cannot enrol a passkey of its own without a prompt the user answers.
        const master = await authorize(env, { recoveryKey, signal });
        try {
          const slot = await newPasskeySlot(master, env, label ?? nextLabel(env), signal);
          await queued(async () => {
            const latest = await fresh();
            await persistEnvelope({ ...latest, updatedAt: Date.now(), slots: [...latest.slots, slot] });
          });
        } finally {
          wipe(master);
        }
      });
    },

    async removePasskey(credentialId) {
      await api.init();
      requireSession();
      await exclusive('remove-passkey', async () => {
        await queued(async () => {
          const latest = await fresh();
          const passkeys = latest.slots.filter((s) => s.kind === 'passkey');
          if (!passkeys.some((s) => s.id === credentialId)) throw new VaultError('invalid-state', 'That passkey is not in this vault.');
          if (passkeys.length < 2) throw new VaultError('invalid-state', 'The last passkey cannot be removed. Reset the vault instead, or add another passkey first.');
          await persistEnvelope({ ...latest, updatedAt: Date.now(), slots: latest.slots.filter((s) => s.id !== credentialId) });
        });
      });
    },

    async regenerateRecoveryKey({ recoveryKey, signal } = {}) {
      await api.init();
      if (state.status !== 'locked' && state.status !== 'unlocked') throw new VaultError('invalid-state', 'There is no vault yet.');
      return exclusive('recovery-key', async () => {
        const env = await fresh();
        const master = await authorize(env, { recoveryKey, signal });
        const bytes = randomBytes(RECOVERY_BYTES);
        try {
          const slot: RecoverySlot = { kind: 'recovery', id: 'recovery', confirmed: false, createdAt: Date.now(), ...(await wrapMaster(master, bytes, id, 'recovery', 'recovery')) };
          await queued(async () => {
            const latest = await fresh();
            await persistEnvelope({ ...latest, updatedAt: Date.now(), slots: [...latest.slots.filter((s) => s.kind !== 'recovery'), slot] });
          });
          return encodeRecoveryKey(bytes);
        } finally {
          wipe(master);
          wipe(bytes);
        }
      });
    },

    async confirmRecoveryKey() {
      await api.init();
      await queued(async () => {
        const latest = await fresh();
        await persistEnvelope({
          ...latest, updatedAt: Date.now(),
          slots: latest.slots.map((s) => (s.kind === 'recovery' ? { ...s, confirmed: true } : s)),
        });
      });
    },

    async verifyRecoveryKey(recoveryKey) {
      await api.init();
      const env = await fresh();
      try {
        wipe(await masterFromRecovery(env, recoveryKey));
        return true;
      } catch (e) {
        if (e instanceof VaultError && (e.reason === 'wrong-recovery-key' || e.reason === 'invalid-recovery-key')) return false;
        throw e;
      }
    },

    async reset() {
      await api.init();
      await exclusive('reset', async () => {
        await queued(async () => {
          const keys = await io((s) => s.keys(`${id}/`));
          for (const key of keys) if (!key.startsWith(quarantinePrefix)) await io((s) => s.delete(key));
        });
        envelope = null;
        lockLocal();
        settle();
        notifyAll();
        post({ t: 'meta' });
      });
    },

    async listQuarantine() {
      await api.init();
      const keys = (await io((s) => s.keys(quarantinePrefix))).sort();
      const out: QuarantineEntry[] = [];
      for (const key of keys) {
        const raw = await io((s) => s.get(key));
        if (raw !== null) out.push({ key, raw, at: Number(key.slice(quarantinePrefix.length).split('-')[0]) || 0 });
      }
      return out;
    },

    touch() { if (session) arm(); },

    dispose() {
      clearTimer();
      closeChannel();
      session = null;
      initPromise = null;
      if (state.status === 'unlocked') settle();
      notifyAll();
    },
  };
  return api;
}

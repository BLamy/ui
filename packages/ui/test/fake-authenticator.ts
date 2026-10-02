/* eslint-disable @typescript-eslint/no-non-null-assertion -- test code: fixtures are known to exist */
/* A WebAuthn authenticator for unit tests: `navigator.credentials` plus `PublicKeyCredential`, with a faithful PRF
   (HMAC-SHA-256 keyed by a per-credential secret over "WebAuthn PRF\0" || salt, like the spec's hmac-secret
   mapping), so the same credential and salt always give the same 32 bytes and anything else gives different bytes. */
import type { PasskeyEnv } from '@/lib/passkey';

export interface FakeAuthenticatorOptions {
  /** Evaluate PRF during `create` (platform authenticators); false mimics a security key. Default true. */
  prfAtCreate?: boolean;
  /** Does it implement PRF at all? Default true. */
  prf?: boolean;
  /** What `getClientCapabilities()['extension:prf']` says; 'absent' removes the method. */
  capability?: boolean | 'absent';
  transports?: string[];
  attachment?: string | null;
  secureContext?: boolean;
  /** Reject `create` when an `excludeCredentials` id is already held (real authenticators do). Default false, so one
   *  fake can stand for several devices in tests that add a second passkey. */
  enforceExclude?: boolean;
}

interface Stored { rawId: Uint8Array; prfKey: Uint8Array }

export type FakeCall = { type: 'create' | 'get'; options: CredentialCreationOptions | CredentialRequestOptions };

const toU8 = (b: BufferSource): Uint8Array => (ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : new Uint8Array(b));
const hex = (u: Uint8Array) => Array.from(u, (b) => b.toString(16).padStart(2, '0')).join('');

export function createFakeAuthenticator(options: FakeAuthenticatorOptions = {}) {
  const store = new Map<string, Stored>();
  const calls: FakeCall[] = [];
  let failNext: { name: string; message?: string } | null = null;
  let delayNext: Promise<void> | null = null;
  const o = { prfAtCreate: true, prf: true, capability: true as boolean | 'absent', transports: ['internal'], attachment: 'platform' as string | null, secureContext: true, enforceExclude: false, ...options };

  async function prfFor(key: Uint8Array, salt: BufferSource): Promise<ArrayBuffer> {
    const prefix = new TextEncoder().encode('WebAuthn PRF\0');
    const input = new Uint8Array(prefix.length + toU8(salt).length);
    input.set(prefix);
    input.set(toU8(salt), prefix.length);
    const hmac = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return crypto.subtle.sign('HMAC', hmac, input);
  }

  async function gate(signal?: AbortSignal) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    if (delayNext) { const d = delayNext; delayNext = null; await d; }
    if (failNext) { const f = failNext; failNext = null; throw new DOMException(f.message ?? f.name, f.name); }
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
  }

  const credentials = {
    async create(opts?: CredentialCreationOptions) {
      calls.push({ type: 'create', options: opts! });
      const pk = opts!.publicKey!;
      await gate(opts!.signal as AbortSignal | undefined);
      for (const ex of o.enforceExclude ? (pk.excludeCredentials ?? []) : []) {
        if (store.has(hex(toU8(ex.id)))) throw new DOMException('excluded', 'InvalidStateError');
      }
      const rawId = crypto.getRandomValues(new Uint8Array(32));
      const prfKey = crypto.getRandomValues(new Uint8Array(32));
      store.set(hex(rawId), { rawId, prfKey });
      const asked = (pk.extensions as { prf?: { eval?: { first: BufferSource } } } | undefined)?.prf;
      const results: Record<string, unknown> = {};
      if (asked && o.prf) {
        const prf: Record<string, unknown> = { enabled: true };
        if (asked.eval && o.prfAtCreate) prf['results'] = { first: await prfFor(prfKey, asked.eval.first) };
        results['prf'] = prf;
      }
      return {
        type: 'public-key', id: '', rawId: rawId.buffer.slice(0),
        authenticatorAttachment: o.attachment,
        response: { getTransports: () => o.transports },
        getClientExtensionResults: () => results,
      } as unknown as Credential;
    },
    async get(opts?: CredentialRequestOptions) {
      calls.push({ type: 'get', options: opts! });
      const pk = opts!.publicKey!;
      await gate(opts!.signal as AbortSignal | undefined);
      const allowed = (pk.allowCredentials ?? []).map((c) => hex(toU8(c.id)));
      const pick = (allowed.length ? allowed.filter((id) => store.has(id)) : [...store.keys()])[0];
      if (!pick) throw new DOMException('no matching credential', 'NotAllowedError');
      const cred = store.get(pick)!;
      const asked = (pk.extensions as { prf?: { eval?: { first: BufferSource } } } | undefined)?.prf;
      const results: Record<string, unknown> = {};
      if (asked?.eval && o.prf) results['prf'] = { results: { first: await prfFor(cred.prfKey, asked.eval.first) } };
      return {
        type: 'public-key', id: '', rawId: cred.rawId.buffer.slice(0),
        response: {}, getClientExtensionResults: () => results,
      } as unknown as Credential;
    },
  };

  const PublicKeyCredential = {
    isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
    ...(o.capability === 'absent' ? {} : { getClientCapabilities: async () => ({ 'extension:prf': o.capability as boolean }) }),
  };

  const env: PasskeyEnv = { credentials, PublicKeyCredential, isSecureContext: o.secureContext };

  return {
    env,
    credentials,
    PublicKeyCredential,
    calls,
    /** Credentials the authenticator holds. */
    get count() { return store.size; },
    /** Forget every credential: the passkey is "lost". */
    wipe() { store.clear(); },
    /** The next ceremony fails with this DOMException name (NotAllowedError = the user cancelled). */
    failNext(name = 'NotAllowedError', message?: string) { failNext = { name, message }; },
    /** The next ceremony waits for this promise first (a prompt that stays open). */
    delayNext(p: Promise<void>) { delayNext = p; },
  };
}

export type FakeAuthenticator = ReturnType<typeof createFakeAuthenticator>;

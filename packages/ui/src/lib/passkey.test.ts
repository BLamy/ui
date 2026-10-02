/* eslint-disable @typescript-eslint/no-non-null-assertion -- test code: fixtures are known to exist */
import { describe, expect, it } from 'vitest';
import {
  PasskeyError, base64UrlToBytes, bytesToBase64Url, createPasskey, detectPasskeySupport, getPrfSecret, passkeyUnsupportedReason, randomBytes, toBytes, wipe,
} from '@/lib/passkey';
import { createFakeAuthenticator } from '../../test/fake-authenticator';

const salt = new TextEncoder().encode('test-salt');

async function reason(p: Promise<unknown>) {
  try { await p; } catch (e) { expect(e).toBeInstanceOf(PasskeyError); return (e as PasskeyError).reason; }
  return null;
}

describe('base64url', () => {
  it('round-trips every length, including large buffers', () => {
    for (const n of [0, 1, 2, 3, 4, 31, 32, 33, 1000, 60_000]) {
      const bytes = randomBytes(n);
      const text = bytesToBase64Url(bytes);
      expect(text).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(base64UrlToBytes(text)).toEqual(bytes);
    }
  });
  it('encodes without padding and with the url alphabet', () => {
    expect(bytesToBase64Url(new Uint8Array([0xfb, 0xff, 0xfe]))).toBe('-__-');
    expect(bytesToBase64Url(new Uint8Array([1]))).toBe('AQ');
  });
  it('accepts ArrayBuffers and views with an offset', () => {
    const buf = new Uint8Array([9, 1, 2, 3, 9]);
    expect(bytesToBase64Url(buf.subarray(1, 4))).toBe(bytesToBase64Url(new Uint8Array([1, 2, 3])));
    expect(bytesToBase64Url(new Uint8Array([1, 2, 3]).buffer)).toBe(bytesToBase64Url(new Uint8Array([1, 2, 3])));
  });
  it('rejects text that is not base64url', () => {
    for (const bad of ['a+b', 'a/b', 'ab=', 'a b', 'A', 'AAAAA']) expect(() => base64UrlToBytes(bad)).toThrow(PasskeyError);
  });
  it('toBytes copies, wipe zeroes', () => {
    const src = new Uint8Array([1, 2, 3]);
    const copy = toBytes(src);
    wipe(copy);
    expect([...copy]).toEqual([0, 0, 0]);
    expect([...src]).toEqual([1, 2, 3]);
  });
});

describe('detectPasskeySupport', () => {
  it('reports no WebAuthn without credentials or the constructor', async () => {
    expect(await detectPasskeySupport({ credentials: null, PublicKeyCredential: null, isSecureContext: true })).toEqual({
      secureContext: true, webauthn: false, platformAuthenticator: false, prf: 'no',
    });
    expect((await detectPasskeySupport({ credentials: createFakeAuthenticator().credentials, PublicKeyCredential: null })).webauthn).toBe(false);
  });
  it('reads the prf capability from getClientCapabilities', async () => {
    expect((await detectPasskeySupport(createFakeAuthenticator({ capability: true }).env)).prf).toBe('yes');
    expect((await detectPasskeySupport(createFakeAuthenticator({ capability: false }).env)).prf).toBe('no');
  });
  it('says unknown when the browser cannot tell (no method, or a method that throws)', async () => {
    expect((await detectPasskeySupport(createFakeAuthenticator({ capability: 'absent' }).env)).prf).toBe('unknown');
    const a = createFakeAuthenticator();
    const env = { ...a.env, PublicKeyCredential: { getClientCapabilities: async () => { throw new Error('x'); } } };
    expect((await detectPasskeySupport(env)).prf).toBe('unknown');
  });
  it('does not treat a missing capability key as no', async () => {
    const a = createFakeAuthenticator();
    const env = { ...a.env, PublicKeyCredential: { getClientCapabilities: async () => ({ conditionalCreate: true }) } };
    expect((await detectPasskeySupport(env)).prf).toBe('unknown');
  });
  it('reports the platform authenticator and the secure context', async () => {
    const s = await detectPasskeySupport(createFakeAuthenticator({ secureContext: false }).env);
    expect(s.platformAuthenticator).toBe(true);
    expect(s.secureContext).toBe(false);
  });
  it('does not throw when run on a server (no globals)', async () => {
    const s = await detectPasskeySupport({});
    expect(s.secureContext || s.webauthn).toBe(false);
  });
  it('maps support onto a reason', () => {
    const base = { secureContext: true, webauthn: true, platformAuthenticator: true, prf: 'yes' as const };
    expect(passkeyUnsupportedReason(base)).toBeNull();
    expect(passkeyUnsupportedReason({ ...base, prf: 'unknown' })).toBeNull();
    expect(passkeyUnsupportedReason({ ...base, prf: 'no' })).toBe('no-prf');
    expect(passkeyUnsupportedReason({ ...base, webauthn: false, prf: 'no' })).toBe('no-webauthn');
    expect(passkeyUnsupportedReason({ ...base, secureContext: false })).toBe('insecure-context');
  });
});

describe('createPasskey', () => {
  it('asks for PRF with the salt, user verification and a per-call challenge and user id', async () => {
    const a = createFakeAuthenticator();
    await createPasskey({ rpName: 'App', rpId: 'example.com', userName: 'me', salt, env: a.env });
    await createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env });
    const [one, two] = a.calls.map((c) => (c.options as CredentialCreationOptions).publicKey!);
    expect(one.rp).toEqual({ name: 'App', id: 'example.com' });
    expect(two.rp).toEqual({ name: 'App' }); // no id: the browser uses the origin's host
    expect(one.authenticatorSelection).toMatchObject({ userVerification: 'required', residentKey: 'preferred' });
    expect(one.authenticatorSelection?.authenticatorAttachment).toBeUndefined();
    expect(one.attestation).toBe('none');
    expect(one.user.name).toBe('me');
    expect(new Uint8Array(one.challenge as ArrayBuffer)).not.toEqual(new Uint8Array(two.challenge as ArrayBuffer));
    expect(new Uint8Array(one.user.id as ArrayBuffer)).not.toEqual(new Uint8Array(two.user.id as ArrayBuffer));
    expect(Object.keys(one.extensions as object)).toEqual(['prf']);
  });
  it('passes attachment, resident key and excluded credentials through', async () => {
    const a = createFakeAuthenticator({ enforceExclude: true });
    const first = await createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env, attachment: 'cross-platform', residentKey: 'required' });
    const pk = (a.calls[0].options as CredentialCreationOptions).publicKey!;
    expect(pk.authenticatorSelection).toMatchObject({ authenticatorAttachment: 'cross-platform', residentKey: 'required', requireResidentKey: true });
    expect(await reason(createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env, excludeCredentialIds: [first.credentialId] }))).toBe('excluded');
  });
  it('returns the id, transports and the PRF secret when the authenticator evaluates at creation', async () => {
    const a = createFakeAuthenticator();
    const r = await createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env });
    expect(base64UrlToBytes(r.credentialId)).toHaveLength(32);
    expect(r.secret).toHaveLength(32);
    expect(r.transports).toEqual(['internal']);
    // …and it is the same secret an assertion gives later
    const again = await getPrfSecret([r.credentialId], salt, { env: a.env });
    expect(again.secret).toEqual(r.secret);
    expect(again.credentialId).toBe(r.credentialId);
  });
  it('omits the secret when only `enabled` came back (security keys), and the follow-up assertion supplies it', async () => {
    const a = createFakeAuthenticator({ prfAtCreate: false });
    const r = await createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env });
    expect(r.secret).toBeUndefined();
    expect((await getPrfSecret([r.credentialId], salt, { env: a.env })).secret).toHaveLength(32);
  });
  it('fails with no-prf when the authenticator does not do PRF', async () => {
    expect(await reason(createPasskey({ rpName: 'App', userName: 'me', salt, env: createFakeAuthenticator({ prf: false }).env }))).toBe('no-prf');
  });
  it('maps what WebAuthn throws', async () => {
    const a = createFakeAuthenticator();
    const run = () => createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env });
    a.failNext('NotAllowedError', 'The operation either timed out or was not allowed.');
    expect(await reason(run())).toBe('cancelled');
    a.failNext('NotAllowedError', "The 'publickey-credentials-create' feature is not enabled in this document. Permissions Policy may be used to delegate Web Authentication capabilities to cross-origin child frames.");
    expect(await reason(run())).toBe('not-allowed');
    a.failNext('SecurityError');
    expect(await reason(run())).toBe('not-allowed');
    a.failNext('NotSupportedError');
    expect(await reason(run())).toBe('unsupported');
    a.failNext('InvalidStateError');
    expect(await reason(run())).toBe('excluded');
    a.failNext('SomethingElse');
    expect(await reason(run())).toBe('failed');
  });
  it('is cancelled by an abort signal, before and during the prompt', async () => {
    const a = createFakeAuthenticator();
    const ac = new AbortController();
    ac.abort();
    expect(await reason(createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env, signal: ac.signal }))).toBe('cancelled');
    expect(a.calls).toHaveLength(0);
    const during = new AbortController();
    let release!: () => void;
    a.delayNext(new Promise<void>((r) => { release = r; }));
    const pending = reason(createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env, signal: during.signal }));
    during.abort();
    release();
    expect(await pending).toBe('cancelled');
  });
  it('rejects an empty salt, an insecure context and a missing WebAuthn', async () => {
    const a = createFakeAuthenticator();
    expect(await reason(createPasskey({ rpName: 'App', userName: 'me', salt: new Uint8Array(0), env: a.env }))).toBe('invalid');
    expect(await reason(createPasskey({ rpName: 'App', userName: 'me', salt, env: createFakeAuthenticator({ secureContext: false }).env }))).toBe('insecure-context');
    expect(await reason(createPasskey({ rpName: 'App', userName: 'me', salt, env: { credentials: null, PublicKeyCredential: null, isSecureContext: true } }))).toBe('unsupported');
  });
});

describe('getPrfSecret', () => {
  it('is deterministic per credential and salt, and differs across both', async () => {
    const a = createFakeAuthenticator();
    const one = await createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env });
    const two = await createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env });
    const s1a = await getPrfSecret([one.credentialId], salt, { env: a.env });
    const s1b = await getPrfSecret([one.credentialId], salt, { env: a.env });
    const s2 = await getPrfSecret([two.credentialId], salt, { env: a.env });
    const s1other = await getPrfSecret([one.credentialId], new TextEncoder().encode('other'), { env: a.env });
    expect(s1a.secret).toEqual(s1b.secret);
    expect(s1a.secret).not.toEqual(s2.secret);
    expect(s1a.secret).not.toEqual(s1other.secret);
  });
  it('sends allowCredentials with transports, the rp id and user verification', async () => {
    const a = createFakeAuthenticator();
    const r = await createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env });
    await getPrfSecret([{ id: r.credentialId, transports: ['internal', 'hybrid'] }], salt, { env: a.env, rpId: 'example.com' });
    const pk = (a.calls.at(-1)!.options as CredentialRequestOptions).publicKey!;
    expect(pk.rpId).toBe('example.com');
    expect(pk.userVerification).toBe('required');
    expect(pk.allowCredentials).toHaveLength(1);
    expect(pk.allowCredentials![0].transports).toEqual(['internal', 'hybrid']);
  });
  it('lets the browser choose when given no credential ids', async () => {
    const a = createFakeAuthenticator();
    const r = await createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env });
    const got = await getPrfSecret([], salt, { env: a.env });
    expect(got.credentialId).toBe(r.credentialId);
    expect((a.calls.at(-1)!.options as CredentialRequestOptions).publicKey!.allowCredentials).toBeUndefined();
  });
  it('reports the credential that answered, out of several', async () => {
    const a = createFakeAuthenticator();
    const one = await createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env });
    const two = await createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env });
    const got = await getPrfSecret([one.credentialId, two.credentialId], salt, { env: a.env });
    expect([one.credentialId, two.credentialId]).toContain(got.credentialId);
  });
  it('fails with no-prf when no secret comes back', async () => {
    const a = createFakeAuthenticator();
    const r = await createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env });
    const env = { ...a.env, credentials: { create: a.credentials.create, get: async () => ({ rawId: new ArrayBuffer(4), getClientExtensionResults: () => ({}) }) as unknown as Credential } };
    expect(await reason(getPrfSecret([r.credentialId], salt, { env }))).toBe('no-prf');
  });
  it('maps a dismissed prompt to cancelled and rejects malformed ids', async () => {
    const a = createFakeAuthenticator();
    const r = await createPasskey({ rpName: 'App', userName: 'me', salt, env: a.env });
    a.failNext();
    expect(await reason(getPrfSecret([r.credentialId], salt, { env: a.env }))).toBe('cancelled');
    expect(await reason(getPrfSecret(['not base64!'], salt, { env: a.env }))).toBe('invalid');
  });
});

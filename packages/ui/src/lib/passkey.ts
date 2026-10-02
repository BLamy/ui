/* ══ passkey — WebAuthn passkeys as a source of secret key material ══
   Pure functions over `navigator.credentials` (nothing runs at import, nothing touches `window` at module scope,
   so it is safe to import on the server). A passkey is used here for one thing: its PRF extension, which makes the
   authenticator compute a stable 32-byte secret from the credential's private PRF key and a salt you choose.
   Nobody but the same credential can recompute it; the secret never leaves the authenticator unless the user
   authorises it with a passkey prompt (user verification: biometrics / PIN).

     const support = await detectPasskeySupport()                 // { secureContext, webauthn, platformAuthenticator, prf }
     const { credentialId, secret } = await createPasskey({ rpName: 'My app', userName: 'me', salt })
     const again = await getPrfSecret([credentialId], salt)       // the same bytes, after another prompt

   Nothing is verified server-side: the challenge is random, attestation is `none`, and the signature is never
   checked. The credential is a key holder, not an identity. Every function takes an optional `env` (a `navigator`
   and `PublicKeyCredential` stand-in) so tests can mock the browser. */

/** Why a passkey operation failed, in terms an app can branch on. */
export type PasskeyErrorReason =
  /** No WebAuthn in this browser (or `navigator.credentials` is missing). */
  | 'unsupported'
  /** WebAuthn needs HTTPS (or localhost). */
  | 'insecure-context'
  /** The user dismissed the prompt, it timed out, or the call was aborted. Browsers report all three the same way. */
  | 'cancelled'
  /** The credential or authenticator has no PRF support, so it cannot produce a key. */
  | 'no-prf'
  /** The browser refused: wrong relying-party id for this origin, or a frame without the permissions policy. */
  | 'not-allowed'
  /** `excludeCredentials` matched: this authenticator already holds a credential for this vault. */
  | 'excluded'
  /** Bad arguments (empty salt, malformed credential id…). */
  | 'invalid'
  /** Anything else. `cause` has the original error. */
  | 'failed';

export class PasskeyError extends Error {
  readonly reason: PasskeyErrorReason;
  override readonly cause?: unknown;
  constructor(reason: PasskeyErrorReason, message: string, cause?: unknown) {
    super(message);
    this.name = 'PasskeyError';
    this.reason = reason;
    this.cause = cause;
  }
}

/** A `Uint8Array` over a plain `ArrayBuffer` — what Web Crypto and WebAuthn accept as a `BufferSource`. */
export type Bytes = Uint8Array<ArrayBuffer>;

/* ── bytes ── */

/** `n` cryptographically random bytes. */
export function randomBytes(n: number): Bytes {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

/** Copies any buffer or view into a fresh `Uint8Array`. */
export function toBytes(source: ArrayBuffer | ArrayBufferView): Bytes {
  if (ArrayBuffer.isView(source)) {
    const out = new Uint8Array(source.byteLength);
    out.set(new Uint8Array(source.buffer, source.byteOffset, source.byteLength));
    return out;
  }
  return new Uint8Array(source.slice(0) as ArrayBuffer);
}

/** Base64url without padding (RFC 4648 §5) — how credential ids are written down. */
export function bytesToBase64Url(bytes: ArrayBuffer | ArrayBufferView): string {
  const view = ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const B64URL = /^[A-Za-z0-9_-]*$/;

/** Decodes base64url (padding optional). Throws a `PasskeyError('invalid')` on anything else. */
export function base64UrlToBytes(text: string): Bytes {
  if (!B64URL.test(text) || text.length % 4 === 1) throw new PasskeyError('invalid', 'Not a base64url string.');
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '='));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Overwrites a buffer with zeros. Best effort: JavaScript cannot promise no other copy exists. */
export function wipe(bytes: Uint8Array): void {
  bytes.fill(0);
}

/* ── environment ── */

/** The parts of the browser this module touches. Defaults to the real globals, read lazily on each call. */
export interface PasskeyEnv {
  /** `navigator.credentials`. */
  credentials?: Pick<CredentialsContainer, 'create' | 'get'> | null;
  /** The `PublicKeyCredential` constructor (for the capability and platform-authenticator checks). */
  PublicKeyCredential?: {
    isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
    getClientCapabilities?: () => Promise<Record<string, boolean>>;
  } | null;
  /** `window.isSecureContext`. */
  isSecureContext?: boolean;
}

function resolveEnv(env?: PasskeyEnv): Required<PasskeyEnv> {
  const g = globalThis as unknown as {
    navigator?: { credentials?: PasskeyEnv['credentials'] };
    PublicKeyCredential?: PasskeyEnv['PublicKeyCredential'];
    isSecureContext?: boolean;
  };
  return {
    credentials: env && 'credentials' in env ? (env.credentials ?? null) : (g.navigator?.credentials ?? null),
    PublicKeyCredential: env && 'PublicKeyCredential' in env ? (env.PublicKeyCredential ?? null) : (g.PublicKeyCredential ?? null),
    isSecureContext: env && 'isSecureContext' in env ? Boolean(env.isSecureContext) : Boolean(g.isSecureContext),
  };
}

export interface PasskeySupport {
  /** HTTPS or localhost. WebAuthn does not exist elsewhere. */
  secureContext: boolean;
  /** `navigator.credentials` and `PublicKeyCredential` are present. */
  webauthn: boolean;
  /** A built-in authenticator (Touch ID, Windows Hello, Android) can verify the user. */
  platformAuthenticator: boolean;
  /** Does the client implement the PRF extension? `unknown` where the browser cannot say (it still may work). The
   *  authenticator can lack PRF even when this is `yes`: only a real ceremony settles that. */
  prf: 'yes' | 'no' | 'unknown';
}

/** What this browser can do. Never prompts the user. */
export async function detectPasskeySupport(env?: PasskeyEnv): Promise<PasskeySupport> {
  const e = resolveEnv(env);
  const pkc = e.PublicKeyCredential;
  const webauthn = Boolean(e.credentials && typeof e.credentials.create === 'function' && typeof e.credentials.get === 'function' && pkc);
  if (!pkc || !webauthn) return { secureContext: e.isSecureContext, webauthn: false, platformAuthenticator: false, prf: 'no' };
  let platformAuthenticator = false;
  try {
    platformAuthenticator = (await pkc.isUserVerifyingPlatformAuthenticatorAvailable?.()) === true;
  } catch { /* unknown → false */ }
  let prf: PasskeySupport['prf'] = 'unknown';
  try {
    // `getClientCapabilities` (WebAuthn L3) keys are `extension:<name>`. Absent key or absent method → unknown.
    const caps = await pkc.getClientCapabilities?.();
    const flag = caps?.['extension:prf'];
    if (flag === true) prf = 'yes';
    else if (flag === false) prf = 'no';
  } catch { /* unknown */ }
  return { secureContext: e.isSecureContext, webauthn, platformAuthenticator, prf };
}

/** Why a passkey vault cannot be used here, or `null` when it can be attempted. */
export function passkeyUnsupportedReason(support: PasskeySupport): 'insecure-context' | 'no-webauthn' | 'no-prf' | null {
  if (!support.secureContext) return 'insecure-context';
  if (!support.webauthn) return 'no-webauthn';
  if (support.prf === 'no') return 'no-prf';
  return null;
}

/* ── errors ── */

const POLICY = /permissions? policy|feature is not enabled|publickey-credentials/i;

/** Maps what WebAuthn throws onto a `PasskeyError`. */
function fromDomError(e: unknown, signal?: AbortSignal): PasskeyError {
  if (e instanceof PasskeyError) return e;
  const name = (e as { name?: string } | null)?.name;
  const message = (e as { message?: string } | null)?.message ?? '';
  if (signal?.aborted || name === 'AbortError') return new PasskeyError('cancelled', 'The passkey request was cancelled.', e);
  switch (name) {
    case 'NotAllowedError':
      // The one error for "user dismissed", "timed out" and (in Chrome) "frame lacks the permissions policy".
      return POLICY.test(message)
        ? new PasskeyError('not-allowed', 'Passkeys are blocked in this frame. The embedding page must allow publickey-credentials-get and publickey-credentials-create.', e)
        : new PasskeyError('cancelled', 'The passkey prompt was dismissed or timed out.', e);
    case 'SecurityError':
      return new PasskeyError('not-allowed', 'The browser rejected the relying-party id for this origin.', e);
    case 'InvalidStateError':
      return new PasskeyError('excluded', 'This authenticator already has a passkey for this vault.', e);
    case 'NotSupportedError':
      return new PasskeyError('unsupported', 'This authenticator or browser does not support the requested passkey options.', e);
    case 'TypeError':
    case 'SyntaxError':
      return new PasskeyError('invalid', message || 'Invalid passkey options.', e);
    default:
      return new PasskeyError('failed', message || 'The passkey request failed.', e);
  }
}

/* ── ceremonies ── */

interface PrfClientResults {
  prf?: { enabled?: boolean; results?: { first?: ArrayBuffer | ArrayBufferView } };
}

function prfOf(credential: PublicKeyCredential): NonNullable<PrfClientResults['prf']> | undefined {
  return (credential.getClientExtensionResults() as PrfClientResults).prf;
}

function checkSalt(salt: ArrayBuffer | ArrayBufferView): Bytes {
  const bytes = toBytes(salt);
  if (bytes.byteLength === 0) throw new PasskeyError('invalid', 'The PRF salt must not be empty.');
  return bytes;
}

function requireEnv(env: Required<PasskeyEnv>): Pick<CredentialsContainer, 'create' | 'get'> {
  if (!env.credentials || !env.PublicKeyCredential) throw new PasskeyError('unsupported', 'WebAuthn is not available in this browser.');
  if (!env.isSecureContext) throw new PasskeyError('insecure-context', 'Passkeys need a secure context (HTTPS or localhost).');
  return env.credentials;
}

export interface CreatePasskeyOptions {
  /** Shown by the authenticator next to the passkey (the app's name). */
  rpName: string;
  /** Registrable domain the passkey is bound to. Defaults to the current origin's host. Must be a suffix of it. */
  rpId?: string;
  /** Account label the authenticator shows ("Vault", an e-mail…). */
  userName: string;
  userDisplayName?: string;
  /** PRF salt: public, any length ≥ 1; the same salt and credential always give the same secret. */
  salt: BufferSource;
  /** `platform` = built-in (Touch ID, Hello); `cross-platform` = security keys and phones; omitted = the user chooses. */
  attachment?: 'platform' | 'cross-platform';
  /** `required` makes a discoverable credential (it appears in the browser's passkey list); default `preferred`. */
  residentKey?: ResidentKeyRequirement;
  /** Default `required`: the prompt always checks biometrics or PIN, which PRF over hmac-secret expects. */
  userVerification?: UserVerificationRequirement;
  /** Credential ids (base64url) the authenticator must not already hold; avoids enrolling the same passkey twice. */
  excludeCredentialIds?: string[];
  /** Milliseconds before the browser gives up on the prompt. Default 60000. */
  timeout?: number;
  signal?: AbortSignal;
  env?: PasskeyEnv;
}

export interface CreatePasskeyResult {
  /** Base64url credential id. */
  credentialId: string;
  /** The PRF secret, when the authenticator evaluated it during creation (platform authenticators, passkey
   *  managers). Security keys usually do not: call `getPrfSecret` next, which prompts once more. */
  secret?: Bytes;
  transports: string[];
  authenticatorAttachment: string | null;
}

/** Creates a passkey with the PRF extension enabled. Throws `PasskeyError('no-prf')` if the authenticator cannot do PRF
 *  (the credential exists on the authenticator then, but is useless to this library). */
export async function createPasskey(options: CreatePasskeyOptions): Promise<CreatePasskeyResult> {
  const env = resolveEnv(options.env);
  const credentials = requireEnv(env);
  const { signal } = options;
  if (signal?.aborted) throw new PasskeyError('cancelled', 'The passkey request was cancelled.');
  const salt = checkSalt(options.salt);
  const excludeCredentials = (options.excludeCredentialIds ?? []).map((id) => ({ type: 'public-key' as const, id: base64UrlToBytes(id) }));
  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: randomBytes(32),
    rp: { name: options.rpName, ...(options.rpId ? { id: options.rpId } : {}) },
    user: { id: randomBytes(16), name: options.userName, displayName: options.userDisplayName ?? options.userName },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    timeout: options.timeout ?? 60_000,
    attestation: 'none',
    authenticatorSelection: {
      userVerification: options.userVerification ?? 'required',
      residentKey: options.residentKey ?? 'preferred',
      ...(options.residentKey === 'required' ? { requireResidentKey: true } : {}),
      ...(options.attachment ? { authenticatorAttachment: options.attachment } : {}),
    },
    ...(excludeCredentials.length ? { excludeCredentials } : {}),
    extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
  };
  let credential: Credential | null;
  try {
    credential = await credentials.create({ publicKey, ...(signal ? { signal } : {}) });
  } catch (e) {
    throw fromDomError(e, signal);
  }
  if (!credential || !('rawId' in credential)) throw new PasskeyError('failed', 'The browser did not return a public-key credential.');
  const created = credential as PublicKeyCredential;
  const prf = prfOf(created);
  const first = prf?.results?.first;
  if (!prf || (prf.enabled !== true && !first)) {
    throw new PasskeyError('no-prf', 'This passkey cannot derive an encryption key (no PRF support). Try a different authenticator or browser.');
  }
  const response = created.response as AuthenticatorAttestationResponse;
  return {
    credentialId: bytesToBase64Url(created.rawId),
    ...(first ? { secret: toBytes(first) } : {}),
    transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
    authenticatorAttachment: created.authenticatorAttachment ?? null,
  };
}

export interface PasskeyCredentialRef {
  /** Base64url credential id. */
  id: string;
  /** Transports saved at creation (`internal`, `usb`, `hybrid`…); lets the browser go straight to the right UI. */
  transports?: string[];
}

export interface GetPrfSecretOptions {
  rpId?: string;
  userVerification?: UserVerificationRequirement;
  timeout?: number;
  signal?: AbortSignal;
  env?: PasskeyEnv;
}

export interface PrfSecret {
  /** Which credential answered. */
  credentialId: string;
  /** The 32-byte PRF output for this credential and salt. Wipe it (`wipe`) when you are done. */
  secret: Bytes;
}

/** Asks the user to tap one of `credentials` and returns its PRF secret for `salt`. An empty list lets the browser offer
 *  any discoverable passkey for the relying party. */
export async function getPrfSecret(
  credentials: ReadonlyArray<string | PasskeyCredentialRef>,
  salt: BufferSource,
  options: GetPrfSecretOptions = {},
): Promise<PrfSecret> {
  const env = resolveEnv(options.env);
  const container = requireEnv(env);
  const { signal } = options;
  if (signal?.aborted) throw new PasskeyError('cancelled', 'The passkey request was cancelled.');
  const saltBytes = checkSalt(salt);
  const allowCredentials = credentials.map((c) => {
    const ref = typeof c === 'string' ? { id: c } : c;
    return {
      type: 'public-key' as const,
      id: base64UrlToBytes(ref.id),
      ...(ref.transports?.length ? { transports: ref.transports as AuthenticatorTransport[] } : {}),
    };
  });
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: randomBytes(32),
    timeout: options.timeout ?? 60_000,
    userVerification: options.userVerification ?? 'required',
    ...(options.rpId ? { rpId: options.rpId } : {}),
    ...(allowCredentials.length ? { allowCredentials } : {}),
    extensions: { prf: { eval: { first: saltBytes } } } as AuthenticationExtensionsClientInputs,
  };
  let credential: Credential | null;
  try {
    credential = await container.get({ publicKey, ...(signal ? { signal } : {}) });
  } catch (e) {
    throw fromDomError(e, signal);
  }
  if (!credential || !('rawId' in credential)) throw new PasskeyError('failed', 'The browser did not return a public-key credential.');
  const asserted = credential as PublicKeyCredential;
  const first = prfOf(asserted)?.results?.first;
  if (!first) throw new PasskeyError('no-prf', 'This passkey did not return a PRF secret. It may have been created without PRF support.');
  return { credentialId: bytesToBase64Url(asserted.rawId), secret: toBytes(first) };
}

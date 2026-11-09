/* A passkey keychain for a page's environment variables (frontmatter `env`).

   The values are encrypted with AES-GCM under a key derived (HKDF) from the passkey's PRF output, so reading
   them takes the reader's fingerprint, face or security key; the ciphertext lives in localStorage. Which
   variables it holds is kept in the clear (names are not secrets), so a page can say "unlock" rather than
   "sign in" before asking for biometrics. There is no recovery key: tokens can always be fetched again, so
   losing the passkey only means signing in again (`reset()` starts over).

     const keychain = createEnvKeychain({ id: "my-docs", rpName: "My docs" })
     const envHost = keychainEnvHost(keychain, {
       obtain: async (names) => ({ GITHUB_TOKEN: await signInWithGitHub() }),  // for what it doesn't hold
     })

   `keychainEnvHost` unlocks once (a biometric prompt) and then answers with *everything* the keychain holds,
   so one press opens every example on the page whose variables are already saved. Runs in the browser only;
   PRF needs a passkey provider that supports it (iCloud Keychain, Google Password Manager, Windows Hello,
   recent security keys). Without it, values are kept for the page only. */
import type { DocstreamEnvHost } from "./doc-env"

export type EnvKeychainStatus = "unsupported" | "empty" | "locked" | "unlocked"

export interface EnvKeychain {
  readonly status: EnvKeychainStatus
  /** The variables it holds (readable while locked). */
  readonly names: readonly string[]
  /** Creates the passkey (a biometric prompt; may ask twice on authenticators that only return PRF on sign-in). */
  enroll(): Promise<void>
  /** A biometric prompt; then `values` can be read. */
  unlock(): Promise<void>
  lock(): void
  /** Everything it holds. Unlocked only. */
  values(): Promise<Record<string, string>>
  /** Adds or replaces values. Unlocked only. */
  set(values: Record<string, string>): Promise<void>
  /** Forgets one variable, or (no argument) everything including the passkey's record. */
  reset(name?: string): Promise<void>
  subscribe(listener: () => void): () => void
}

export interface EnvKeychainOptions {
  /** Names the keychain in storage; different ids are different keychains. */
  id: string
  /** Shown by the passkey prompt. */
  rpName: string
  /** Account name the passkey is listed under. Default "Environment variables". */
  userName?: string
  /** Default `localStorage`. */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">
}

interface Stored {
  v: 1
  credentialId: string
  salt: string
  names: string[]
  iv?: string
  data?: string
}

const b64 = (bytes: ArrayBuffer | Uint8Array) => {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ""
  for (const b of u) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
const unb64 = (text: string) => {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n))

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer | ArrayBufferView } } }
const prfFirst = (credential: PublicKeyCredential): Uint8Array<ArrayBuffer> | null => {
  const first = (credential.getClientExtensionResults() as PrfResults).prf?.results?.first
  if (!first) return null
  const view = ArrayBuffer.isView(first) ? new Uint8Array(first.buffer, first.byteOffset, first.byteLength) : new Uint8Array(first)
  const copy = new Uint8Array(view.byteLength)
  copy.set(view)
  return copy
}

async function aesKey(prf: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", prf, "HKDF", false, ["deriveKey"])
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode("docstream env keychain v1") },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

export function createEnvKeychain(options: EnvKeychainOptions): EnvKeychain {
  const key = `docstream-env-keychain:${options.id}`
  const storage = options.storage ?? (typeof localStorage !== "undefined" ? localStorage : null)
  const listeners = new Set<() => void>()
  let aes: CryptoKey | null = null
  let cache: Record<string, string> | null = null

  const read = (): Stored | null => {
    try {
      const raw = storage?.getItem(key)
      const s = raw ? (JSON.parse(raw) as Stored) : null
      return s?.v === 1 && typeof s.credentialId === "string" && typeof s.salt === "string" ? { ...s, names: Array.isArray(s.names) ? s.names : [] } : null
    } catch {
      return null
    }
  }
  const write = (s: Stored | null) => {
    if (s) storage?.setItem(key, JSON.stringify(s))
    else storage?.removeItem(key)
    listeners.forEach((l) => l())
  }
  const supported = () =>
    typeof window !== "undefined" && window.isSecureContext && typeof PublicKeyCredential !== "undefined" && !!navigator.credentials && !!storage && !!crypto?.subtle

  /** A sign-in with the stored passkey, returning its PRF output. */
  async function assert(stored: Stored): Promise<Uint8Array<ArrayBuffer>> {
    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge: random(32),
        allowCredentials: [{ type: "public-key", id: unb64(stored.credentialId) }],
        userVerification: "required",
        extensions: { prf: { eval: { first: unb64(stored.salt) } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null
    const first = credential && prfFirst(credential)
    if (!first) throw new Error("This passkey can't unlock the keychain (no PRF support).")
    return first
  }

  async function seal(values: Record<string, string>, stored: Stored) {
    const iv = random(12)
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes!, new TextEncoder().encode(JSON.stringify(values)))
    cache = { ...values }
    write({ ...stored, names: Object.keys(values).sort(), iv: b64(iv), data: b64(data) })
  }

  const keychain: EnvKeychain = {
    get status(): EnvKeychainStatus {
      if (!supported()) return "unsupported"
      if (!read()) return "empty"
      return aes ? "unlocked" : "locked"
    },
    get names() {
      return read()?.names ?? []
    },
    async enroll() {
      if (!supported()) throw new Error("This browser can't keep a passkey keychain.")
      const salt = random(32)
      const created = (await navigator.credentials.create({
        publicKey: {
          rp: { name: options.rpName },
          user: { id: random(16), name: options.userName ?? "Environment variables", displayName: options.userName ?? "Environment variables" },
          challenge: random(32),
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
          extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
        },
      })) as PublicKeyCredential | null
      if (!created) throw new Error("No passkey was created.")
      const ext = (created.getClientExtensionResults() as PrfResults).prf
      if (!ext?.enabled && !ext?.results?.first) throw new Error("This passkey can't encrypt (no PRF support). Try another passkey provider.")
      const stored: Stored = { v: 1, credentialId: b64(created.rawId), salt: b64(salt), names: [] }
      // Some authenticators only evaluate PRF on sign-in: then this asks once more.
      aes = await aesKey(prfFirst(created) ?? (await assert(stored)))
      await seal({}, stored)
    },
    async unlock() {
      const stored = read()
      if (!stored) throw new Error("There is no keychain yet.")
      if (aes) return
      aes = await aesKey(await assert(stored))
      cache = null
      listeners.forEach((l) => l())
    },
    lock() {
      aes = null
      cache = null
      listeners.forEach((l) => l())
    },
    async values() {
      if (!aes) throw new Error("The keychain is locked.")
      if (cache) return { ...cache }
      const stored = read()
      if (!stored?.data || !stored.iv) return (cache = {})
      try {
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(stored.iv) }, aes, unb64(stored.data))
        cache = JSON.parse(new TextDecoder().decode(plain)) as Record<string, string>
      } catch {
        aes = null
        throw new Error("That passkey doesn't open this keychain.")
      }
      return { ...cache }
    },
    async set(values) {
      const stored = read()
      if (!stored || !aes) throw new Error("The keychain is locked.")
      await seal({ ...(await keychain.values()), ...values }, stored)
    },
    async reset(name) {
      if (name === undefined) {
        aes = null
        cache = null
        write(null)
        return
      }
      const stored = read()
      if (!stored) return
      if (aes) {
        const { [name]: _, ...rest } = await keychain.values()
        await seal(rest, stored)
      } else write({ ...stored, names: stored.names.filter((n) => n !== name) })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return keychain
}

export interface KeychainEnvHostOptions {
  /** Gets values the keychain doesn't hold — a sign-in, a prompt. Resolve with what you got; it is saved. */
  obtain?: (names: readonly string[]) => Promise<Record<string, string>>
  /** The gate's button when a sign-in is needed. Default "Sign In". */
  signInLabel?: string | ((names: readonly string[]) => string)
  /** The gate's button when the keychain already holds everything the example needs. Default "Unlock with Passkey". */
  unlockLabel?: string
  /** A hint beside a variable the keychain doesn't hold. */
  describe?: (name: string) => string | undefined
}

/**
 * A `DocstreamEnvHost` over a keychain. Pressing a gate's button:
 * 1. creates the keychain (first time; a passkey prompt) or unlocks it (a biometric prompt);
 * 2. asks `obtain` for the variables it doesn't hold, and saves them;
 * 3. answers with everything the keychain holds, so every example those values cover opens.
 * Without passkey support (or if the reader declines) values are kept for the page only.
 */
export function keychainEnvHost(keychain: EnvKeychain, options: KeychainEnvHostOptions = {}): DocstreamEnvHost {
  const held = (names: readonly string[]) => names.every((n) => keychain.names.includes(n))
  return {
    label: (names) =>
      held(names) ? options.unlockLabel ?? "Unlock with Passkey"
        : typeof options.signInLabel === "function" ? options.signInLabel(names) : options.signInLabel ?? "Sign In",
    describe: (name) => (keychain.names.includes(name) ? "In your keychain" : options.describe?.(name)),
    async request(names) {
      // The press's user activation is still live here: spend it on the passkey prompt first.
      let usable = keychain.status === "unlocked"
      if (keychain.status === "locked") {
        await keychain.unlock()
        usable = true
      } else if (keychain.status === "empty") {
        usable = await keychain.enroll().then(() => true, () => false)
      }
      const saved = usable ? await keychain.values() : {}
      const missing = names.filter((n) => saved[n] === undefined)
      const got = missing.length && options.obtain ? await options.obtain(missing) : {}
      if (usable && Object.keys(got).length) await keychain.set(got)
      return { ...saved, ...got }
    },
  }
}

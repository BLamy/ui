# Passkey vault

Encrypted storage in the browser, unlocked by a passkey. Records are encrypted with AES-GCM and kept in IndexedDB; the key that encrypts them is never stored in the clear but wrapped by what the passkey's PRF extension computes, so the data can only be read after the person has touched their fingerprint sensor, face or security key. A recovery key, made at set-up and shown once, opens the same vault if the passkey is lost. It ships as plain functions (`createPasskey`, `createVault`), React hooks (`useVault`, `useEncryptedState`) and the screens around them (`PasskeyEnrollDialog`, `VaultGate`).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/passkey-vault.json https://blamy.github.io/ui/r/vault-gate.json{% endcommand %}

Copies the source into your project's `lib/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  VaultProvider, useVault, useEncryptedState,
} from '@/lib/vault-react'
import { VaultGate } from '@/components/ui/vault-gate'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  VaultProvider, useVault, useEncryptedState, VaultGate,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

{% demo src="passkey-vault/gate" %}

Read [What this protects, and what it does not](#what-this-protects-and-what-it-does-not) before you put anything in it. In one line: it protects data at rest against someone who gets the browser's files, and it does nothing against script running on your page.

## Quick start

Wrap the app in a provider, put the part that needs the data behind a gate, and use `useEncryptedState` where you would use `useState`:

```tsx
import {
  VaultProvider, VaultGate, useEncryptedState,
} from '@brett_lamy/ui'

function Notes() {
  const [text, setText] = useEncryptedState('draft', '')
  return <textarea value={text} onChange={(e) => void setText(e.target.value)} />
}

export default function App() {
  return (
    <BLProvider>
      <VaultProvider options={{ id: 'notes', rp: { name: 'Notes' } }}>
        <VaultGate appName="Notes">
          <Notes />
        </VaultGate>
      </VaultProvider>
    </BLProvider>
  )
}
```

First run shows the set-up screen; `Set up passkey` opens `PasskeyEnrollDialog`, which explains what is protected, runs the passkey prompt, then shows the recovery key once and does not let the person close it until they confirm. Later visits show the locked screen with `Unlock with passkey` and `Use recovery key instead`. `BLProvider` matters: dialogs portal into it, so they sit inside your app's frame and wear its theme.

Without React, the same thing is plain objects:

```ts
import { createVault } from '@brett_lamy/ui'

const vault = createVault({ id: 'notes', rp: { name: 'Notes' } })
await vault.init()                                  // 'empty' | 'locked' | 'unsupported'
const { recoveryKey } = await vault.enroll()        // passkey prompt; show recoveryKey once
await vault.put('token', { value: 'abc' })
vault.lock()
await vault.unlock()                                // passkey prompt
await vault.get('token')                            // { value: 'abc' }
```

## How it works

A random 256-bit **master secret** is made at set-up. Records never use it directly: it is expanded (HKDF-SHA-256) into two non-extractable `CryptoKey`s that exist only while the vault is unlocked, one for AES-GCM and one for an HMAC that names records. The master secret is stored only in **slots**, each an AES-GCM encryption of it under a key-encryption key (KEK):

| Slot | KEK comes from | How many |
| --- | --- | --- |
| Passkey | HKDF over the passkey's 32-byte PRF output (salt: the vault's public PRF salt) | One per enrolled passkey |
| Recovery | HKDF over a random 160-bit recovery key | Exactly one |

Adding a second passkey, or replacing the recovery key, wraps 32 bytes again and **never re-encrypts a record**. Each record is `{ iv, ct }` with a fresh random 96-bit IV, and its storage key is an HMAC of its name, so names are not readable from storage either. The AES-GCM additional data binds a record to its vault id and its location, and a slot to its vault id, kind and credential id: a record copied under another name, or into another vault, fails authentication. The format is versioned (`v: 1`) with a migration table, and a stored envelope that cannot be read is moved to a quarantine entry rather than deleted (`vault.listQuarantine()`).

The set-up order matters because a passkey prompt can fail: the passkey is created first, the recovery key second, and nothing is written until both slots exist. A prompt dismissed half-way leaves storage untouched.

## What this protects, and what it does not

**Protected.** The records at rest. Someone who copies the browser profile or its IndexedDB files, reads a disk image or a backup, or opens the profile on another machine finds ciphertext. To open it they need the passkey (and so the person's biometrics or PIN, because the prompt asks for user verification) or the recovery key. Record names and values are encrypted; the vault key is not stored.

**Not protected: any script on your page.** This is the important limit. While the vault is unlocked, code in your page can call `vault.get()` and read everything, and a non-extractable `CryptoKey` can still be *used* by that code even though it cannot be exported. While the vault is locked, such code can still call `vault.unlock()`, which shows the real passkey prompt; a person who expects the prompt will approve it. So a cross-site-scripting hole, a compromised dependency or a malicious browser extension defeats the vault. It does not replace a Content Security Policy or careful dependencies. Keep the unlocked window short (`autoLockMs`).

**Also not protected:**

- A device that is compromised while the vault is unlocked. Decrypted values live in JavaScript memory (and React state) for as long as the app keeps them.
- Freshness. Someone with write access to the storage can delete a record or put back an older copy of it; they cannot forge a new one, but the vault cannot tell you a record is stale.
- Metadata. The number of records, their sizes and write times, the number of passkeys, their credential ids and their **labels** are stored in the clear. Do not put a secret in a passkey label.
- Anything on a server. Passkey signatures are never checked: the challenge is random and attestation is `none`. The passkey is a key holder here, not an account.
- Weak authenticators. A passkey without user verification gives the PRF secret to anyone who holds the device; the library asks for verification (`userVerification: 'required'`), and the authenticator is trusted to enforce it.

**Passkeys without PRF cannot be used.** PRF (the WebAuthn `prf` extension, built on CTAP `hmac-secret`) is what turns a passkey into a key. Many authenticators do not implement it, and the library cannot work around that: enrolling with one throws `PasskeyError('no-prf')` and saves nothing. Do not "derive a key" from a passkey's public credential id instead; that is obfuscation, since the id is not secret.

**Synced passkeys.** A passkey kept by iCloud Keychain, Google Password Manager or a password manager is available on the person's other devices, and, as far as I know, so is its PRF secret (this is from memory, not verified here). The vault's *data* is not synced: the envelope and records live in this browser's storage. A new device with the same passkey has nothing to unlock until you sync the ciphertext yourself (a `VaultStorage` that mirrors to a server is safe, because everything it sees is ciphertext), and unlocking there depends on the synced passkey producing the same PRF output. Anyone who controls the sync account may be able to use the passkey, so a synced passkey is only as strong as that account.

**Loss and recovery.** Clearing site data deletes the vault and the data. Deleting the passkey from the authenticator leaves the data readable only through the recovery key. Losing both means the data cannot be read by anyone, including you; `vault.reset()` (behind a confirmation on the locked screen) erases it so the person can start again. That is why the recovery key is not optional in the design: `enroll()` always creates it, `PasskeyEnrollDialog` cannot be dismissed while it is on screen, and `VaultGate` shows a notice (`recoveryNotice`) for as long as the person has not confirmed saving it.

**Secure context.** WebAuthn exists only on HTTPS and `localhost`. On an insecure origin `status` is `unsupported` with `unsupportedReason: 'insecure-context'`.

**iframes.** A cross-origin iframe may use passkeys only if its embedder allows it:

```html
<iframe src="https://app.example" allow="publickey-credentials-get *; publickey-credentials-create *"></iframe>
```

Without the policy the browser refuses the request (in Chromium as a `NotAllowedError` mentioning the permissions policy, which the library maps to `PasskeyError('not-allowed')`; the message text is from memory and may differ). Same-origin frames inherit the policy. The relying-party id is bound to the origin: a vault enrolled on `a.example.com` with the default id cannot be unlocked by passkey from `b.example.com`; pass `rp.id` (a shared registrable domain) if you need that. The recovery key works anywhere the data is.

**Cryptographic choices.** AES-256-GCM with a random 96-bit IV per write is safe for far more writes than any vault will see (the limit is about 2^32 under one key). No password stretching is used because both inputs, the PRF output and the recovery key, are high-entropy random values. `crypto.subtle` does the work; no crypto library is bundled. This has not had an independent review.

## Browser and authenticator support

What was **verified** while building this:

| Where | Result |
| --- | --- |
| Chromium 151 (Playwright's build) with a CDP virtual authenticator, `hasPrf: true` | `PublicKeyCredential.getClientCapabilities()` returned `extension:prf: true`. `create()` with `prf.eval` returned `enabled: true` and the 32-byte secret at creation; `get()` returned the same bytes every time. The whole enrol, lock, unlock, recovery, reload and two-tab flow passes against it (see Testing). |
| The same, with `hasPrf: false` | Enrolment is refused with the no-PRF message and nothing is stored. |
| A user-verification failure on the virtual authenticator | `NotAllowedError` in about 40 ms, reported as a dismissed prompt. |

What I could **not** verify, and state from memory (it changes quickly; check against current compatibility tables and your own devices):

| Where | Expectation |
| --- | --- |
| Chrome and Edge, desktop and Android | PRF has been available for several years with security keys (hmac-secret) and with Google Password Manager passkeys; platform authenticators vary by operating system. |
| Windows Hello | Historically did not provide PRF; newer Windows 11 releases may. Treat as unsupported until you have tried it. |
| Safari (macOS, iOS) | PRF with iCloud Keychain passkeys arrived with the 2024 operating-system releases. |
| Firefox | PRF with security keys on desktop; platform support varies. |
| Hardware security keys | Keys with `hmac-secret` (for example current YubiKeys) work in browsers that implement PRF; creation does not return the secret, so enrolment takes a second prompt (this path is covered in the unit tests). |
| Password managers (1Password, Bitwarden and others) | Several implement PRF; behaviour depends on version and settings. |

Because the table above ages, the library never decides from a list. `detectPasskeySupport()` reports what the browser says without a prompt (`prf: 'yes' | 'no' | 'unknown'`; `unknown` is common and means "try"), and only a real ceremony settles whether this passkey can do PRF. An authenticator that cannot fails fast, at set-up, with a clear message.

## Next.js and server rendering

Nothing runs at import time and nothing reads `window`, `navigator`, `crypto` or `indexedDB` until a method is called, so every module is safe to import on the server and the components start with `'use client'`. During server rendering and hydration `status` is `loading`, which `VaultGate` shows as a spinner; the browser is probed in an effect. Put the provider in a client component:

```tsx
'use client'
import { VaultProvider, VaultGate } from '@/lib/vault-react'

export function Protected({ children }: { children: React.ReactNode }) {
  return (
    <VaultProvider options={{ id: 'app', rp: { name: 'App' } }}>
      <VaultGate appName="App">{children}</VaultGate>
    </VaultProvider>
  )
}
```

Render nothing secret on the server: the server never has the key, so the protected tree can only render after unlock.

## Cross-tab and auto-lock

Tabs of one origin talk over a `BroadcastChannel` named `bl-vault:<id>`. **Locking always propagates**: lock in one tab and every tab locks. Unlocking does not: a new tab, or a tab opened after another one unlocked, asks for the passkey itself. That is on purpose, since it keeps "unlocked" local to the page that earned it. Set `shareUnlock: true` to let tabs hand each other the (non-extractable) working keys instead, so one unlock covers all of them. Enrolment, adding a passkey and resets reach other tabs too, and `useEncryptedState` follows record changes from other tabs. Slot changes take a Web Lock where the browser has them, so two tabs do not enrol at once.

`autoLockMs` locks after that long without a vault call (`get`, `put`, `list`, `delete`) or a `touch()`. `VaultProvider` calls `touch()` on pointer and key activity anywhere on the page unless you turn off `trackActivity`. Auto-lock forgets the keys; it cannot take back values the app already holds.

## Slots: more than one passkey

```ts
await vault.addPasskey({ label: 'Backup key' })              // asks for an existing passkey first, then creates the new one
await vault.addPasskey({ recoveryKey, label: 'New phone' })  // after losing the old passkey
await vault.removePasskey(vault.getState().passkeys[0].id)   // unlocked only; the last passkey stays
const fresh = await vault.regenerateRecoveryKey()            // the old key stops working; show `fresh` once
```

`addPasskey` makes the person prove possession again (an existing passkey, or the recovery key) before it wraps the master secret for the new passkey, and it asks the authenticator to refuse one it already holds. That extra prompt is deliberate: script on the page cannot enrol a passkey of its own without the person answering a prompt. Nothing is re-encrypted; the records on disk are byte-identical before and after.

## Hooks

### useWebAuthnSupport

`useWebAuthnSupport(env?)` returns what the browser can do, or `null` on the server and until the check finishes. It never opens a prompt.

```tsx
const support = useWebAuthnSupport()
// { secureContext, webauthn, platformAuthenticator, prf: 'yes' | 'no' | 'unknown' } | null
```

### usePasskey

`usePasskey(env?)` runs passkey ceremonies as state, for schemes that are not the vault. Secrets come back through the promises and are never put in state; the request is aborted on unmount.

| Returns | Meaning |
| --- | --- |
| `support` | As `useWebAuthnSupport`. |
| `status` | `idle`, `pending` (the prompt is open), `success` or `error`. |
| `error` | The last `PasskeyError`; branch on `error.reason`. |
| `create(options)` | `createPasskey` without `signal` and `env`. Resolves `null` on failure. |
| `getSecret(credentials, salt, options?)` | `getPrfSecret` without `signal` and `env`. Resolves `null` on failure. |
| `cancel()` / `reset()` | Abort the open prompt / go back to `idle`. |

{% demo src="passkey-vault/prf" %}

### VaultProvider

`<VaultProvider vault={…} | options={…} trackActivity>` provides a vault and runs its lifecycle: `init()` on mount, `dispose()` (which locks it, without telling other tabs) on unmount, StrictMode safe. Pass an existing `vault` or `options` for one the provider creates once. Options are read on first render only; change `key` to start over.

### useVault and useVaultState

`useVault(vault?)` returns the vault and subscribes the component to it (`useSyncExternalStore`), so `vault.status` and the methods are always current. `useVaultState(vault?)` returns the immutable snapshot (`status`, `unsupportedReason`, `support`, `passkeys`, `hasRecoveryKey`, `recoveryConfirmed`, `busy`, `quarantined`); a new object per change, so it is safe as a dependency. Both throw outside a provider unless you pass a vault.

### useEncryptedState

`useEncryptedState(name, initial, vault?)` is `useState` that lives in the vault, returning `[value, set, meta]`.

```tsx
const [draft, setDraft, meta] = useEncryptedState('draft', '')
await setDraft((text) => text + '!')     // resolves true; false and meta.error if the write failed
```

- Locked: `value` is `initial`, nothing is read, and `meta.status` is `locked`. The moment the vault locks, the decrypted value is dropped from component state.
- Unlocked: it loads (`loading` then `ready`), and `set` updates the screen at once and writes in the background. A failed write puts back what is stored.
- `set` while locked refuses (`false`) and keeps nothing.
- It follows changes from other hooks and other tabs, not its own writes. There is no module-level cache; each hook reads through the vault.
- Every `set` is an encrypt and a storage write. Debounce it for text you type into.

## API

### createVault(options)

| Option | Default | Effect |
| --- | --- | --- |
| `id` | required | Names the vault in storage. No slash or whitespace. Different ids are different vaults. |
| `rp` | required | `{ name, id? }`. `name` is shown by the authenticator; `id` is the registrable domain the passkey is bound to (default: the current host). Changing it later strands existing passkeys; the recovery key still works. |
| `userName` | `Vault` | The account name the authenticator lists. |
| `storage` | IndexedDB | A `VaultStorage`. |
| `attachment` | user chooses | `platform` (Touch ID, Hello) or `cross-platform` (security keys, phones). |
| `autoLockMs` | off | Idle milliseconds before locking. |
| `shareUnlock` | `false` | Share an unlock with other tabs over `BroadcastChannel`. |
| `channel` | `BroadcastChannel` | `false` to disable cross-tab sync, or a factory (tests). |
| `env` | the browser | A stand-in for `navigator.credentials` and `PublicKeyCredential` (tests). |

### The vault

| Member | Effect |
| --- | --- |
| `status` / `getState()` / `subscribe(fn)` | `loading`, `unsupported`, `empty`, `locked` or `unlocked`; the snapshot; change notifications. |
| `init()` | Opens storage and the channel and works out the status. Idempotent; every method calls it. |
| `enroll({ label?, signal? })` | `empty` only. Creates the passkey and the recovery key and unlocks. Returns `{ recoveryKey }`, which is stored nowhere. |
| `unlock({ signal? })` | Passkey prompt, then `unlocked`. |
| `unlockWithRecoveryKey(text)` | Any case, spaces or dashes; `O` reads as 0 and `I`, `L` as 1. |
| `lock()` | Forgets the keys; tells other tabs. |
| `put(name, value)` / `get(name)` / `list()` / `delete(name)` | JSON values; unlocked only. `put` waits its turn so writes land in call order. |
| `watch(name, fn)` | Called after `name` is written or deleted here or in another tab. |
| `addPasskey(opts)` / `removePasskey(id)` / `regenerateRecoveryKey(opts)` | See Slots. |
| `confirmRecoveryKey()` / `verifyRecoveryKey(text)` | Record that it was saved / check a typed key without unlocking. |
| `reset()` | Erases the envelope and records (quarantine stays). |
| `listQuarantine()` | Entries set aside because they could not be read: `{ key, at, raw }`. |
| `touch()` / `dispose()` | Restart the auto-lock timer / close the channel, stop timers and lock. |

**Status.** `unsupported` has a reason: `insecure-context`, `no-webauthn`, `no-prf` (the browser says it has no PRF), `storage` (no IndexedDB or localStorage, or blocked) or `newer-version` (written by a later version of this library; left untouched). A vault that already exists stays `locked` even where passkeys do not work, because the recovery key still opens it; only a fresh set-up needs a working passkey.

**Errors.** `VaultError.reason` is one of `locked`, `invalid-state`, `busy`, `wrong-key`, `wrong-recovery-key`, `invalid-recovery-key`, `corrupt`, `newer-version`, `storage`, `invalid`. Passkey prompts throw `PasskeyError` (below). `vaultErrorMessage(error)` gives a sentence for either, without secrets. A record that fails authentication is reported as `corrupt` and kept; one that is not a record at all is moved to quarantine.

### Passkey functions

| Function | Effect |
| --- | --- |
| `detectPasskeySupport(env?)` | `{ secureContext, webauthn, platformAuthenticator, prf }`. No prompt. |
| `createPasskey({ rpName, rpId?, userName, salt, attachment?, residentKey?, userVerification?, excludeCredentialIds?, timeout?, signal?, env? })` | Creates a passkey with PRF. Returns `{ credentialId, secret?, transports, authenticatorAttachment }`; `secret` is absent where the authenticator evaluates PRF only on a later `get`. |
| `getPrfSecret(credentials, salt, { rpId?, userVerification?, timeout?, signal?, env? })` | Prompts and returns `{ credentialId, secret }` (32 bytes). Credentials are ids or `{ id, transports }`; an empty list lets the browser offer any discoverable passkey. |
| `passkeyUnsupportedReason(support)` | `insecure-context`, `no-webauthn`, `no-prf` or `null`. |
| `bytesToBase64Url` / `base64UrlToBytes` / `wipe` | Base64url helpers and a best-effort zero-fill for secrets. |

`PasskeyError.reason`: `unsupported`, `insecure-context`, `cancelled` (dismissed, timed out or aborted; the browser does not tell these apart), `no-prf`, `not-allowed` (relying-party mismatch or an iframe without the permissions policy), `excluded` (the authenticator already holds a credential for this vault), `invalid`, `failed`.

### Storage adapters

A `VaultStorage` is an async string map: `get`, `set`, `delete`, `keys(prefix)`. It only ever receives ciphertext and the plain metadata described above.

| Adapter | Notes |
| --- | --- |
| `indexedDbStorage({ name?, factory? })` | The default. One database, one object store. |
| `localStorageStorage({ storage?, prefix? })` | Small and synchronous; quota errors surface as `VaultStorageError`. |
| `memoryStorage()` | Nothing persists. Tests, demos. |

## Components

### PasskeyEnrollDialog

| Prop | Default | Effect |
| --- | --- | --- |
| `isOpen` / `onOpenChange` | required | Controlled open state. |
| `vault` | the provider's | |
| `mode` | `enroll` | `regenerate` replaces the recovery key of an existing vault. |
| `appName` / `protects` | | Wording: "Protect {appName} with a passkey", "A passkey will lock {protects}". |
| `requireVerification` | `false` | Make the person type the key back before finishing. |
| `onDone` | | After the recovery key is confirmed. |
| `className` / `style` | | Merged onto the dialog. |

Three steps: explain, run the prompt, show the recovery key (`Copy`, `Save as file`, a checkbox, optionally a type-it-back field). On the last step Esc and an outside press do nothing. `RecoveryKey` renders the key in groups of four and is exported for your own flow (for instance after `regenerateRecoveryKey()`). The dialog belongs **above** the status switch: enrolling makes the vault `unlocked` before the key has been shown, which unmounts anything that was rendered for `empty`. `VaultGate` does this for you.

### VaultGate

`<VaultGate appName protects requireVerification recoveryNotice loading unsupported empty locked>` renders its children only while `unlocked`, and otherwise `loading` (a spinner), `VaultSetup`, `VaultUnlock` or `VaultUnsupported`. Each slot prop replaces a screen; `unsupported` may be a node or a function of the state, and may render the children to carry on without protection (an explicit choice you make visible to the person).

### VaultUnlock, VaultSetup, VaultUnsupported, VaultStatusBadge

The parts of the gate, exported to build your own shell. `VaultUnlock` has `Unlock with passkey` and a recovery-key form (it opens on the form where passkeys cannot work, and says the recovery key still works), plus `Lost both? Erase this vault…` behind a confirmation. `VaultSetup` takes `onSetup` when a parent owns the dialog. `VaultUnsupported` says what is missing in plain words. `VaultStatusBadge` is a pill with an icon and a word, never colour alone.

{% demo src="passkey-vault/unsupported" %}

## Accessibility

The dialog and the confirmation are react-aria dialogs: focus is trapped and returns on close, Esc closes them (except on the recovery-key step), and every action is a real button reachable by keyboard. Each step moves focus to its primary action. A visually hidden `role="status"` region announces "Waiting for your passkey", "Your recovery key is ready" and, in the gate, "Unlocked" and "Locked"; it never contains a secret. Failures use `role="alert"`. The recovery key is a labelled group read letter by letter by a screen reader, while the visible groups are plain selectable text. Motion collapses to fades under `prefers-reduced-motion`.

## Styling

Slots: `vault-gate` (display: contents), `vault-setup`, `vault-unlock`, `vault-unsupported`, `vault-status-badge` (with `data-status`), `passkey-enroll-dialog` and `recovery-key`. The panels are plain sections: pass `className` to size or place them. `recoveryKeyVariants` takes `layout` (`grid`, two columns, or `row`, four).

## Testing

Unit tests take an `env` (a `navigator.credentials` and `PublicKeyCredential` stand-in) and a `channel` factory, so a fake authenticator with a real PRF (HMAC-SHA-256 over the credential's secret and the salt) runs the whole vault in Node with `fake-indexeddb`. For a browser test, Chromium's virtual authenticator implements PRF itself:

```js
const cdp = await context.newCDPSession(page)
await cdp.send('WebAuthn.enable')
await cdp.send('WebAuthn.addVirtualAuthenticator', {
  options: {
    protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal',
    hasResidentKey: true, hasUserVerification: true, isUserVerified: true,
    automaticPresenceSimulation: true, hasPrf: true,
  },
})
```

This repository's `tools/e2e/passkey-vault.e2e.mjs` does exactly that. A virtual authenticator exercises the browser's real WebAuthn and PRF code paths, but it is not hardware: real devices differ in prompts, timeouts and PRF support.

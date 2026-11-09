// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createEnvKeychain, keychainEnvHost } from "./env-keychain"

/** A passkey provider with PRF: one secret per credential, returned on create and on get. */
function fakePasskeys({ prfOnCreate = true } = {}) {
  const secret = crypto.getRandomValues(new Uint8Array(32))
  const rawId = crypto.getRandomValues(new Uint8Array(16)).buffer
  const credential = (withPrf: boolean) => ({
    rawId,
    getClientExtensionResults: () => ({ prf: { enabled: true, ...(withPrf ? { results: { first: secret.buffer.slice(0) } } : {}) } }),
  })
  const create = vi.fn(async () => credential(prfOnCreate))
  const get = vi.fn(async () => credential(true))
  vi.stubGlobal("PublicKeyCredential", class {})
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true })
  Object.defineProperty(navigator, "credentials", { value: { create, get }, configurable: true })
  return { create, get }
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe("createEnvKeychain", () => {
  it("enrolls, saves encrypted values, and needs the passkey again to read them", async () => {
    const pk = fakePasskeys()
    const a = createEnvKeychain({ id: "t", rpName: "Test" })
    expect(a.status).toBe("empty")
    await a.enroll()
    expect(a.status).toBe("unlocked")
    await a.set({ GITHUB_TOKEN: "gho_secret" })
    expect(a.names).toEqual(["GITHUB_TOKEN"])
    expect(JSON.stringify(localStorage)).not.toContain("gho_secret")

    // A new page: names are known while locked; values need an unlock (one biometric prompt).
    const b = createEnvKeychain({ id: "t", rpName: "Test" })
    expect(b.status).toBe("locked")
    expect(b.names).toEqual(["GITHUB_TOKEN"])
    await expect(b.values()).rejects.toThrow(/locked/)
    await b.unlock()
    expect(pk.get).toHaveBeenCalledTimes(1)
    expect(await b.values()).toEqual({ GITHUB_TOKEN: "gho_secret" })
  })

  it("asks once more at enrollment when the authenticator only returns PRF on sign-in", async () => {
    const pk = fakePasskeys({ prfOnCreate: false })
    const k = createEnvKeychain({ id: "t2", rpName: "Test" })
    await k.enroll()
    expect(pk.get).toHaveBeenCalledTimes(1)
    await k.set({ A: "1" })
    expect(await k.values()).toEqual({ A: "1" })
  })

  it("forgets a variable or everything", async () => {
    fakePasskeys()
    const k = createEnvKeychain({ id: "t3", rpName: "Test" })
    await k.enroll()
    await k.set({ A: "1", B: "2" })
    await k.reset("A")
    expect(await k.values()).toEqual({ B: "2" })
    await k.reset()
    expect(k.status).toBe("empty")
  })
})

describe("keychainEnvHost", () => {
  it("signs in for what the keychain lacks, saves it, and later unlocks everything it holds with one prompt", async () => {
    const pk = fakePasskeys()
    const obtain = vi.fn(async (names: readonly string[]) => Object.fromEntries(names.map((n) => [n, `value-of-${n}`])))
    const first = keychainEnvHost(createEnvKeychain({ id: "h", rpName: "Test" }), { obtain, signInLabel: "Sign in with GitHub" })
    expect(first.label instanceof Function && first.label(["GITHUB_TOKEN"])).toBe("Sign in with GitHub")
    expect(await first.request(["GITHUB_TOKEN"])).toEqual({ GITHUB_TOKEN: "value-of-GITHUB_TOKEN" })
    expect(pk.create).toHaveBeenCalledTimes(1)
    expect(await first.request(["NETLIFY_AUTH_TOKEN"])).toEqual({ GITHUB_TOKEN: "value-of-GITHUB_TOKEN", NETLIFY_AUTH_TOKEN: "value-of-NETLIFY_AUTH_TOKEN" })

    // Next visit: the gate says "unlock", one biometric prompt, no sign-in, and every saved variable comes back.
    obtain.mockClear()
    const again = keychainEnvHost(createEnvKeychain({ id: "h", rpName: "Test" }), { obtain })
    expect(again.label instanceof Function && again.label(["GITHUB_TOKEN"])).toBe("Unlock with Passkey")
    expect(again.describe?.("GITHUB_TOKEN")).toBe("In your keychain")
    const got = await again.request(["GITHUB_TOKEN"])
    expect(got).toEqual({ GITHUB_TOKEN: "value-of-GITHUB_TOKEN", NETLIFY_AUTH_TOKEN: "value-of-NETLIFY_AUTH_TOKEN" })
    expect(obtain).not.toHaveBeenCalled()
    expect(pk.get).toHaveBeenCalledTimes(1)
  })

  it("without passkey support, keeps what it obtains for the page only", async () => {
    const obtain = vi.fn(async () => ({ A: "1" }))
    const host = keychainEnvHost(createEnvKeychain({ id: "n", rpName: "Test" }), { obtain })
    expect(await host.request(["A"])).toEqual({ A: "1" })
    expect(localStorage.length).toBe(0)
  })
})

/* Environment variables for a document's examples.

   A page declares the variables its examples need in its frontmatter:

     ---
     env: [GITHUB_TOKEN, NETLIFY_AUTH_TOKEN]
     ---

   An example (a `{% demo %}` or a live code fence) whose source mentions one of them does not
   run straight away: it shows a gate that asks the host for the values — the host's
   `DocstreamEnvHost.request` can read them from a keychain or start a login — and runs once it
   has them. In-page demos read the values with `useDocstreamEnv()`; examples that run in
   almost-node get them as `process.env.NAME`. Without a host the gate asks for the values
   directly and keeps them in memory for the page. */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"

export type DocstreamEnvValues = Readonly<Record<string, string>>

/** How the host supplies values: a keychain, a login, a secrets manager. */
export interface DocstreamEnvHost {
  /**
   * Resolves with the values it could get (unlocking a keychain or signing in as needed). Names it
   * leaves out stay missing and the example stays gated; a rejection is shown on the gate. It may
   * resolve with more than it was asked for — everything an unlocked keychain holds, say — and every
   * example those values cover opens too.
   */
  request: (names: readonly string[]) => Promise<Record<string, string>>
  /** The gate's button, e.g. "Load from Keychain", or one for the names this gate needs. Default "Load Variables". */
  label?: string | ((names: readonly string[]) => string)
  /** A short line about one variable, e.g. "Sign in with GitHub" — shown beside its name. */
  describe?: (name: string) => string | undefined
}

export interface DocstreamEnv {
  /** Variables this document declares. */
  declared: readonly string[]
  /** Values loaded so far (shared by every example on the page). */
  values: DocstreamEnvValues
  /** Asks the host (or the reader) for `names`; resolves with every value now known. */
  request: (names: readonly string[]) => Promise<DocstreamEnvValues>
  host?: DocstreamEnvHost
  /** Keeps values the reader typed into a host-less gate. */
  provide: (values: Record<string, string>) => void
}

const EMPTY: DocstreamEnvValues = Object.freeze({})
const noRequest = () => Promise.resolve(EMPTY)

const DocstreamEnvContext = createContext<DocstreamEnv>({ declared: [], values: EMPTY, request: noRequest, provide: () => {} })

/** The page's variables and the values loaded so far. Demos call it to read their secrets. */
export function useDocstreamEnv(): DocstreamEnv {
  return useContext(DocstreamEnvContext)
}

/** Reads `env` from parsed frontmatter values: a list, or one comma/space separated string. */
export function envNamesFromProperties(values: Record<string, unknown> | undefined): string[] {
  const raw = values?.env
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[\s,]+/) : []
  return [...new Set(list.filter((v): v is string => typeof v === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v)))]
}

/** The declared names `sources` mention (as whole identifiers), in declaration order. */
export function usedEnvNames(sources: readonly string[], declared: readonly string[]): string[] {
  if (!declared.length) return []
  const text = sources.join("\n")
  return declared.filter((name) => new RegExp(`(^|[^A-Za-z0-9_$])${name}(?![A-Za-z0-9_$])`).test(text))
}

export interface DocstreamEnvProviderProps {
  /** Names declared by the document (merged with any declared further up). */
  declared?: readonly string[]
  host?: DocstreamEnvHost
  children?: ReactNode
}

/**
 * Holds a page's variables. The renderers add one from the frontmatter's `env`; a host may wrap
 * the page in another to supply `host` (or pass `envHost` to the renderer). Values loaded by an
 * outer provider are shared with inner ones.
 */
export function DocstreamEnvProvider({ declared = [], host, children }: DocstreamEnvProviderProps) {
  const outer = useContext(DocstreamEnvContext)
  const [own, setOwn] = useState<DocstreamEnvValues>(EMPTY)
  const effectiveHost = host ?? outer.host
  const values = useMemo(() => (own === EMPTY ? outer.values : { ...outer.values, ...own }), [outer.values, own])
  const valuesRef = useRef(values)
  valuesRef.current = values
  const declaredKey = declared.join(",")
  const allDeclared = useMemo(
    () => [...new Set([...outer.declared, ...declared])],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outer.declared, declaredKey],
  )
  const provide = useCallback((next: Record<string, string>) => setOwn((v) => ({ ...v, ...next })), [])
  const request = useCallback(async (names: readonly string[]) => {
    const missing = names.filter((n) => valuesRef.current[n] === undefined)
    if (!missing.length || !effectiveHost) return valuesRef.current
    const got = await effectiveHost.request(missing)
    const kept = Object.fromEntries(Object.entries(got).filter(([, v]) => typeof v === "string"))
    setOwn((v) => ({ ...v, ...kept }))
    return { ...valuesRef.current, ...kept }
  }, [effectiveHost])
  const value = useMemo<DocstreamEnv>(
    () => ({ declared: allDeclared, values, request, provide, ...(effectiveHost ? { host: effectiveHost } : {}) }),
    [allDeclared, values, request, provide, effectiveHost],
  )
  return <DocstreamEnvContext.Provider value={value}>{children}</DocstreamEnvContext.Provider>
}

/** Which of an example's sources' declared variables are still missing. */
export function useEnvGate(sources: readonly string[] | null) {
  const env = useDocstreamEnv()
  const key = sources ? sources.join("\u0000") : null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const used = useMemo(() => (sources ? usedEnvNames(sources, env.declared) : null), [key, env.declared])
  // A page that declares nothing never waits for its examples' sources.
  const missing = !env.declared.length ? [] : used ? used.filter((n) => env.values[n] === undefined) : null
  const values = useMemo(() => {
    if (!used?.length) return EMPTY
    return Object.fromEntries(used.map((n) => [n, env.values[n]!]).filter(([, v]) => v !== undefined)) as DocstreamEnvValues
  }, [used, env.values])
  return {
    /** Unknown until the sources are; then the declared names they use. */
    used,
    /** null while the sources are loading. */
    missing,
    /** The example may run: no declared variable used, or all of them loaded. */
    open: missing !== null && missing.length === 0,
    /** The values of the variables this example uses. */
    values,
  }
}

/** The card an example shows until its variables are loaded. */
export function EnvGate({ names, title }: { names: readonly string[]; title?: string }) {
  const env = useDocstreamEnv()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typed, setTyped] = useState<Record<string, string>>({})
  const host = env.host

  const load = async () => {
    setBusy(true)
    setError(null)
    try {
      const got = await env.request(names)
      const still = names.filter((n) => got[n] === undefined)
      if (still.length) setError(`Still missing ${still.join(", ")}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const filled = Object.fromEntries(names.map((n) => [n, typed[n] ?? ""]).filter(([, v]) => v))
    if (Object.keys(filled).length === names.length) env.provide(filled)
    else setError("Fill in every variable to run the example.")
  }

  return (
    <div className="docs-env-gate" role="group" aria-label={`${title ?? "Example"} needs environment variables`} data-docstream-env-gate="">
      <div className="docs-env-gate-head">
        <span className="docs-env-gate-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" />
          </svg>
        </span>
        <span>This example needs {names.length === 1 ? "a variable" : `${names.length} variables`} before it runs.</span>
      </div>
      {host ? (
        <>
          <ul className="docs-env-gate-list">
            {names.map((n) => (
              <li key={n}><code>{n}</code>{host.describe?.(n) ? <span>{host.describe(n)}</span> : null}</li>
            ))}
          </ul>
          <button type="button" className="docs-env-gate-button" onClick={() => void load()} disabled={busy}>
            {busy ? "Waiting…" : (typeof host.label === "function" ? host.label(names) : host.label) ?? "Load Variables"}
          </button>
        </>
      ) : (
        <form className="docs-env-gate-form" onSubmit={submit}>
          {names.map((n) => (
            <label key={n}>
              <code>{n}</code>
              <input type="password" autoComplete="off" spellCheck={false} value={typed[n] ?? ""}
                onChange={(e) => setTyped((t) => ({ ...t, [n]: e.target.value }))} />
            </label>
          ))}
          <button type="submit" className="docs-env-gate-button">Run Example</button>
          <span className="docs-env-gate-note">Kept in memory for this page only.</span>
        </form>
      )}
      {error ? <p className="docs-env-gate-error" role="alert">{error}</p> : null}
    </div>
  )
}

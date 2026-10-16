// One Strudel runtime per page, loaded on the first play (@strudel/web is ~850 KB and touches
// `window` at import). Players share it, so starting one stops whichever was playing.

/** A scheduled event, as `Pattern.queryArc` returns it. */
export interface StrudelHap {
  whole?: { begin: number | { valueOf(): number }; end: number | { valueOf(): number } } | null
  part: { begin: number | { valueOf(): number }; end: number | { valueOf(): number } }
  value: unknown
}

export interface StrudelPattern {
  queryArc(begin: number, end: number): StrudelHap[]
}

interface StrudelRepl {
  evaluate(code: string, autostart?: boolean): Promise<StrudelPattern | undefined>
  stop(): void
  scheduler: { now(): number; started: boolean }
  state: { evalError?: unknown }
}

interface StrudelWeb {
  initStrudel(options?: { prebake?: () => unknown; onToggle?: (started: boolean) => void }): Promise<StrudelRepl>
  samples(source: string): Promise<unknown>
}

/** Sample banks loaded before the first pattern, matching what strudel.cc code expects (`s("bd sd")`). */
export const DEFAULT_SAMPLES = ["github:tidalcycles/dirt-samples"]

export interface StrudelSnapshot {
  /** The player id that owns the runtime right now, or null. */
  owner: string | null
  status: "idle" | "loading" | "playing"
}

let runtime: Promise<StrudelRepl> | null = null
let loaded: StrudelRepl | null = null
let snapshot: StrudelSnapshot = { owner: null, status: "idle" }
const listeners = new Set<() => void>()

function set(next: StrudelSnapshot) {
  snapshot = next
  listeners.forEach((fn) => fn())
}

export function subscribeStrudel(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getStrudelSnapshot(): StrudelSnapshot {
  return snapshot
}

function load(samples: readonly string[]): Promise<StrudelRepl> {
  runtime ??= import("@strudel/web").then((mod: StrudelWeb) =>
    mod.initStrudel({
      prebake: () => Promise.all(samples.map((s) => mod.samples(s))),
      onToggle: (started) => {
        if (!started && snapshot.status === "playing") set({ owner: null, status: "idle" })
      },
    }),
  ).then((repl) => (loaded = repl))
  runtime.catch(() => {
    runtime = null
  })
  return runtime
}

/** Evaluate `code` and start it, taking the runtime from any other player. Must run from a user gesture. */
export async function playStrudel(owner: string, code: string, samples: readonly string[] = DEFAULT_SAMPLES): Promise<StrudelPattern> {
  set({ owner, status: "loading" })
  try {
    const repl = await load(samples)
    if (snapshot.owner !== owner) throw new Error("superseded")
    const pattern = await repl.evaluate(code, true)
    if (!pattern || repl.state.evalError) {
      const err = repl.state.evalError
      throw err instanceof Error ? err : new Error(String(err ?? "Strudel could not evaluate this pattern"))
    }
    if (snapshot.owner === owner) set({ owner, status: "playing" })
    return pattern
  } catch (err) {
    if (snapshot.owner === owner) set({ owner: null, status: "idle" })
    throw err
  }
}

/**
 * Swap the pattern `owner` is playing for `code` without stopping (live edits). Resolves null when `owner`
 * isn't playing; throws when the code doesn't evaluate (the old pattern keeps playing).
 */
export async function updateStrudel(owner: string, code: string): Promise<StrudelPattern | null> {
  if (snapshot.owner !== owner || snapshot.status !== "playing" || !loaded) return null
  const pattern = await loaded.evaluate(code, true)
  if (!pattern || loaded.state.evalError) {
    const err = loaded.state.evalError
    throw err instanceof Error ? err : new Error(String(err ?? "Strudel could not evaluate this pattern"))
  }
  return pattern
}

export async function stopStrudel(owner: string): Promise<void> {
  if (snapshot.owner !== owner) return
  set({ owner: null, status: "idle" })
  ;(await runtime)?.stop()
}

/** The scheduler's position in cycles, for animation frames; null while stopped or not loaded. */
export function strudelNow(): number | null {
  return loaded?.scheduler.started ? loaded.scheduler.now() : null
}

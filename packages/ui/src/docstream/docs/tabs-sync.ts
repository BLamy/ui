import { useCallback, useSyncExternalStore } from "react"

/* Page-wide (and cross-page) memory for `{% tabs sync="key" %}`: the last tab title a reader chose
   for a key, shared by every synced tab set and persisted in localStorage. */

const PREFIX = "docstream:tabs:"
const memory = new Map<string, string>()
const listeners = new Set<() => void>()

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export function getSyncedTab(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!
  const saved = storage()?.getItem(PREFIX + key) ?? null
  if (saved !== null) memory.set(key, saved)
  return saved
}

export function setSyncedTab(key: string, title: string): void {
  memory.set(key, title)
  try {
    storage()?.setItem(PREFIX + key, title)
  } catch {
    // storage full or disabled: the in-memory choice still syncs this page
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(PREFIX)) {
      memory.delete(event.key.slice(PREFIX.length))
      listener()
    }
  }
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage)
  }
}

/** `[title, setTitle]` for a sync key; both are inert when `key` is undefined. */
export function useSyncedTab(key: string | undefined): [string | null, (title: string) => void] {
  const title = useSyncExternalStore(
    subscribe,
    () => (key ? getSyncedTab(key) : null),
    () => null,
  )
  const set = useCallback((next: string) => {
    if (key) setSyncedTab(key, next)
  }, [key])
  return [title, set]
}

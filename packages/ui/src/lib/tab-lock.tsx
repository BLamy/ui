'use client';
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

/* ══ Tab locks — one tab at a time ══
   A PGlite database opened on the main thread (`idb://`, `opfs-ahp://`) must have exactly one writer: two tabs that
   both open it overwrite each other's pages. `useTabLock(name)` takes an exclusive Web Lock (`navigator.locks`) for
   `name`; the browser releases it when the tab closes or crashes, so a stale lock cannot outlive its tab. A tab that
   cannot get the lock is `blocked` and is granted it the moment the holder lets go. A BroadcastChannel lets a blocked
   tab ask the holder to step aside (`takeover()`), which is how "use it here instead" works.

   Locks are shared inside one tab: every component asking for the same name sees one lock, and a React StrictMode
   remount reuses the held lock instead of racing itself. Where `navigator.locks` is missing (insecure origins, very
   old browsers) the status is `unsupported` and nothing is protected — the lock fails open, never stuck. */

export type TabLockStatus = 'pending' | 'held' | 'blocked' | 'unsupported';

interface Entry {
  name: string;
  status: TabLockStatus;
  refs: number;
  listeners: Set<() => void>;
  /** Releases the held lock. */
  release: (() => void) | null;
  /** Cancels the queued lock request. */
  abort: AbortController | null;
  channel: BroadcastChannel | null;
  closeTimer: ReturnType<typeof setTimeout> | null;
  /** Bumped on each yield so a late callback from an earlier request is ignored. */
  generation: number;
}

const entries = new Map<string, Entry>();
const lockName = (name: string) => `bl-tab-lock:${name}`;

function set(entry: Entry, status: TabLockStatus) {
  if (entry.status === status) return;
  entry.status = status;
  entry.listeners.forEach((l) => l());
}

/** Queues for the lock; resolves `held` once it is granted. */
function request(entry: Entry, { ifAvailable }: { ifAvailable: boolean }) {
  const locks = navigator.locks;
  const generation = ++entry.generation;
  const abort = new AbortController();
  entry.abort = abort;
  const hold = (lock: Lock | null) => {
    if (generation !== entry.generation) return undefined; // superseded
    if (!lock) {
      // Someone else holds it: show `blocked`, and queue for it.
      set(entry, 'blocked');
      request(entry, { ifAvailable: false });
      return undefined;
    }
    entry.abort = null;
    set(entry, 'held');
    // Hold the lock until release(): the callback's promise is the lock's lifetime.
    return new Promise<void>((resolve) => {
      entry.release = () => {
        entry.release = null;
        resolve();
      };
    });
  };
  const run = ifAvailable ? locks.request(lockName(entry.name), { ifAvailable: true }, hold) : locks.request(lockName(entry.name), { signal: abort.signal }, hold);
  run.catch(() => undefined); // an aborted queue rejects with AbortError
}

function start(entry: Entry) {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    set(entry, 'unsupported');
    return;
  }
  if (typeof BroadcastChannel !== 'undefined') {
    entry.channel = new BroadcastChannel(lockName(entry.name));
    entry.channel.onmessage = (e: MessageEvent) => {
      // Another tab asked for the lock: step aside, then queue again behind it.
      if (e.data === 'takeover' && entry.status === 'held') yieldLock(entry);
    };
  }
  request(entry, { ifAvailable: true });
}

function yieldLock(entry: Entry) {
  entry.release?.();
  // The requester is already queued, so this request lands behind it (locks are granted first come, first served).
  set(entry, 'blocked');
  request(entry, { ifAvailable: false });
}

function acquire(name: string): Entry {
  let entry = entries.get(name);
  if (!entry) {
    entry = { name, status: 'pending', refs: 0, listeners: new Set(), release: null, abort: null, channel: null, closeTimer: null, generation: 0 };
    entries.set(name, entry);
    start(entry);
  }
  if (entry.closeTimer) {
    clearTimeout(entry.closeTimer);
    entry.closeTimer = null;
  }
  entry.refs++;
  return entry;
}

function release(entry: Entry) {
  if (--entry.refs > 0) return;
  // Deferred: a StrictMode remount (or a fast re-render) re-acquires in the same tick and keeps the lock.
  entry.closeTimer = setTimeout(() => {
    if (entry.refs > 0) return;
    entries.delete(entry.name);
    entry.generation++;
    entry.abort?.abort();
    entry.release?.();
    entry.channel?.close();
  }, 0);
}

export interface TabLock {
  status: TabLockStatus;
  /** This tab holds the lock — or the browser cannot lock, in which case it may proceed (`status` is `unsupported`). */
  held: boolean;
  /** Ask the tab that holds the lock to give it up (it becomes `blocked` and may ask for it back). No-op unless blocked. */
  takeover: () => void;
}

/** Takes an exclusive lock called `name` for as long as the component is mounted. Several components with the same name in one tab share it. */
export function useTabLock(name: string, { enabled = true }: { enabled?: boolean } = {}): TabLock {
  const [entry, setEntry] = useState<Entry | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const e = acquire(name);
    setEntry(e);
    return () => {
      release(e);
      setEntry(null);
    };
  }, [name, enabled]);

  const status = useSyncExternalStore(
    (cb) => {
      entry?.listeners.add(cb);
      return () => entry?.listeners.delete(cb);
    },
    () => (entry ? entry.status : 'pending'),
    () => 'pending' as TabLockStatus,
  );
  const takeover = useCallback(() => {
    if (entry && entry.status === 'blocked') entry.channel?.postMessage('takeover');
  }, [entry]);

  const effective: TabLockStatus = enabled ? status : 'unsupported';
  return { status: effective, held: effective === 'held' || effective === 'unsupported', takeover };
}

export interface SingleTabGateProps {
  /** The lock name — the database name is a good choice (`idb://notes`). */
  name: string;
  /** Rendered only in the tab that holds the lock. */
  children: ReactNode;
  /** While the lock is being checked. */
  pending?: ReactNode;
  /** In a tab that does not hold the lock; receives `takeover` ("use it here"). */
  blocked?: ReactNode | ((api: { takeover: () => void }) => ReactNode);
}

/** Renders its children in one tab at a time. Other tabs show `blocked` until the holder closes or steps aside. */
export function SingleTabGate({ name, children, pending = null, blocked = null }: SingleTabGateProps) {
  const lock = useTabLock(name);
  if (lock.status === 'pending') return pending;
  if (!lock.held) return typeof blocked === 'function' ? blocked({ takeover: lock.takeover }) : blocked;
  return children;
}

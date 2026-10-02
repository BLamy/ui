'use client';
import { useCallback, useEffect, useState } from 'react';

/* ══ What this browser can persist ══
   `usePersistenceSupport()` reports which storage a PGlite database can use here and how much room there is:
   IndexedDB (`idb://`), the origin private file system (`opfs-ahp://`, which also needs a Web Worker), whether the
   browser has promised not to evict the data (`navigator.storage.persist()`), and the quota estimate. Browsers may
   evict "best effort" storage under disk pressure; `persist()` asks to be exempt (Chrome grants it from engagement
   signals, Firefox prompts, Safari grants it to installed web apps). Everything is read in an effect, so the hook is
   safe to render on the server. */

export interface PersistenceSupport {
  /** The probe finished (before that every flag is `false`/`null`). */
  checked: boolean;
  /** Served over HTTPS or localhost: required for `navigator.locks`, OPFS and `crypto.subtle`. */
  secureContext: boolean;
  /** IndexedDB exists: `idb://` works. */
  indexedDB: boolean;
  /** The origin private file system exists (`navigator.storage.getDirectory`). `opfs-ahp://` additionally needs a worker. */
  opfs: boolean;
  /** Web Workers (needed for `opfs-ahp://` and for a database shared by several tabs). */
  worker: boolean;
  /** `navigator.locks`: needed by `useTabLock` / `SingleTabGate`. */
  locks: boolean;
  /** WebAssembly (always true in current browsers). */
  wasm: boolean;
  /** The browser promised not to evict this origin's storage; `null` when it cannot tell. */
  persisted: boolean | null;
  /** Bytes used and available to this origin; `null` when the browser does not estimate. */
  estimate: { usage: number; quota: number } | null;
  /** Ask for persistent storage; resolves with the answer (and updates `persisted`). Call it from a user action. */
  persist: () => Promise<boolean>;
  /** Re-read the estimate (after a big write). */
  refresh: () => void;
}

type Probe = Omit<PersistenceSupport, 'persist' | 'refresh'>;

const UNKNOWN: Probe = {
  checked: false, secureContext: false, indexedDB: false, opfs: false, worker: false, locks: false, wasm: false, persisted: null, estimate: null,
};

/** Reads the capabilities. Browser only. */
export async function detectPersistenceSupport(): Promise<Probe> {
  if (typeof navigator === 'undefined') return { ...UNKNOWN, checked: true };
  const storage = (navigator as Navigator & { storage?: StorageManager }).storage;
  const [persisted, estimate] = await Promise.all([
    storage?.persisted ? storage.persisted().catch(() => null) : Promise.resolve(null),
    storage?.estimate ? storage.estimate().catch(() => null) : Promise.resolve(null),
  ]);
  return {
    checked: true,
    secureContext: typeof isSecureContext === 'boolean' ? isSecureContext : false,
    indexedDB: typeof indexedDB !== 'undefined',
    opfs: typeof storage?.getDirectory === 'function',
    worker: typeof Worker !== 'undefined',
    locks: !!navigator.locks,
    wasm: typeof WebAssembly === 'object',
    persisted,
    estimate: estimate && estimate.usage !== undefined && estimate.quota !== undefined ? { usage: estimate.usage, quota: estimate.quota } : null,
  };
}

export function usePersistenceSupport(): PersistenceSupport {
  const [probe, setProbe] = useState<Probe>(UNKNOWN);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    void detectPersistenceSupport().then((p) => live && setProbe(p));
    return () => {
      live = false;
    };
  }, [n]);
  const persist = useCallback(async () => {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    const granted = storage?.persist ? await storage.persist().catch(() => false) : false;
    setN((v) => v + 1);
    return granted;
  }, []);
  const refresh = useCallback(() => setN((v) => v + 1), []);
  return { ...probe, persist, refresh };
}

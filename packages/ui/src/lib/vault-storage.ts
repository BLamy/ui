/* ══ vault-storage — where a vault keeps its (already encrypted) bytes ══
   A storage adapter is a tiny async key → string map. The vault only ever hands it ciphertext and public
   metadata, so any adapter is as safe as the browser profile it lives in: whoever can read it learns the
   envelope's shape (how many passkeys, when it was made) and the size of each record, nothing else.

     indexedDbStorage()    the default: survives reloads, has no 5 MB cap, is available in workers
     localStorageStorage() synchronous and tiny; fine for a few small records, and visible across tabs
     memoryStorage()       nothing persists (tests, demos, "private" sessions)

   Every adapter resolves the browser global lazily, inside its methods, so importing this module on the server
   is safe; calling a method without the global throws a `VaultStorageError`. */

export interface VaultStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Every key that starts with `prefix`, in no particular order. */
  keys(prefix: string): Promise<string[]>;
}

export class VaultStorageError extends Error {
  override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'VaultStorageError';
    this.cause = cause;
  }
}

/** A map in memory. */
export function memoryStorage(initial?: Iterable<readonly [string, string]>): VaultStorage {
  const map = new Map<string, string>(initial);
  return {
    get: async (key) => map.get(key) ?? null,
    set: async (key, value) => { map.set(key, value); },
    delete: async (key) => { map.delete(key); },
    keys: async (prefix) => [...map.keys()].filter((k) => k.startsWith(prefix)),
  };
}

export interface LocalStorageOptions {
  /** Defaults to `globalThis.localStorage`, read on each call. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
  /** Prepended to every key so the vault shares the origin politely. Default `bl-vault:`. */
  prefix?: string;
}

/** `localStorage` (or any `Storage`). Quota errors surface as `VaultStorageError`. */
export function localStorageStorage({ storage, prefix = 'bl-vault:' }: LocalStorageOptions = {}): VaultStorage {
  const area = () => {
    const s = storage ?? (globalThis as { localStorage?: LocalStorageOptions['storage'] }).localStorage;
    if (!s) throw new VaultStorageError('localStorage is not available here.');
    return s;
  };
  const wrap = <T,>(fn: () => T): T => {
    try { return fn(); } catch (e) { throw e instanceof VaultStorageError ? e : new VaultStorageError('localStorage failed (blocked or full).', e); }
  };
  return {
    get: async (key) => wrap(() => area().getItem(prefix + key)),
    set: async (key, value) => wrap(() => area().setItem(prefix + key, value)),
    delete: async (key) => wrap(() => area().removeItem(prefix + key)),
    keys: async (p) => wrap(() => {
      const s = area();
      const out: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k?.startsWith(prefix + p)) out.push(k.slice(prefix.length));
      }
      return out;
    }),
  };
}

export interface IndexedDbOptions {
  /** Database name. Default `bl-vault`. */
  name?: string;
  /** Defaults to `globalThis.indexedDB`; pass `fake-indexeddb`'s factory in tests. */
  factory?: IDBFactory;
}

const STORE = 'kv';

/** A plain IndexedDB key/value store: one database, one object store, string values. */
export function indexedDbStorage({ name = 'bl-vault', factory }: IndexedDbOptions = {}): VaultStorage {
  let opening: Promise<IDBDatabase> | null = null;

  const open = (): Promise<IDBDatabase> => {
    if (opening) return opening;
    const idb = factory ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    if (!idb) return Promise.reject(new VaultStorageError('IndexedDB is not available here.'));
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = idb.open(name, 1);
      } catch (e) {
        reject(new VaultStorageError('IndexedDB could not be opened.', e));
        return;
      }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => {
        const db = request.result;
        // Another tab upgrading or deleting the database: let go so it can proceed, and reopen on next use.
        db.onversionchange = () => { db.close(); opening = null; };
        db.onclose = () => { opening = null; };
        resolve(db);
      };
      request.onerror = () => reject(new VaultStorageError('IndexedDB could not be opened.', request.error));
      request.onblocked = () => reject(new VaultStorageError('IndexedDB is blocked by another tab.'));
    }).catch((e) => { opening = null; throw e; });
    return opening;
  };

  /** Runs `fn` in a transaction and resolves with its result once the transaction has committed. */
  const run = async <T,>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      let result: T;
      let tx: IDBTransaction;
      try {
        tx = db.transaction(STORE, mode);
        const request = fn(tx.objectStore(STORE));
        request.onsuccess = () => { result = request.result; };
      } catch (e) {
        reject(new VaultStorageError('IndexedDB transaction failed.', e));
        return;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(new VaultStorageError('IndexedDB transaction failed (the disk may be full).', tx.error));
      tx.onabort = () => reject(new VaultStorageError('IndexedDB transaction was aborted.', tx.error));
    });
  };

  return {
    get: async (key) => {
      const value = await run('readonly', (s) => s.get(key));
      return typeof value === 'string' ? value : null;
    },
    set: async (key, value) => { await run('readwrite', (s) => s.put(value, key)); },
    delete: async (key) => { await run('readwrite', (s) => s.delete(key)); },
    keys: async (prefix) => {
      const all = await run('readonly', (s) => s.getAllKeys());
      return all.filter((k): k is string => typeof k === 'string' && k.startsWith(prefix));
    },
  };
}

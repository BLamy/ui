'use client';

/* ══ Append-only streams in localStorage ══
   A stream is a named, ordered list of JSON records you can only add to. Records go out in chunks, one localStorage
   key each — `bl-stream:<name>:<start offset>.<count>` — so a write never touches anything already stored: the offset
   and count are in the key, and there is no head or index to rewrite. A stream's length is the end of its last chunk.
   Chunks are gzip-compressed (base64) when the browser can, JSON when it can't or when the page is leaving.

   This is the private end of Freeform's "private computer": everything stays in this browser. `durable-streams.ts`
   mirrors the same streams to a Durable Streams server when the cloud is switched on.

   localStorage is small. When a write doesn't fit, `evict` is asked to free room (drop a stream it can do without);
   with nothing left to drop the write fails with `StreamFullError`. */

export class StreamFullError extends Error {
  constructor(name: string) {
    super(`No room to append to "${name}" in localStorage`);
    this.name = 'StreamFullError';
  }
}

const PREFIX = 'bl-stream:';
const KEY = /^bl-stream:(.+):(\d{10})\.(\d+)$/;
const pad = (n: number) => String(n).padStart(10, '0');

/** localStorage, or null where there is none (server render, blocked storage). */
export function storage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/* ── Packing ── */

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export const packSync = (records: unknown[]) => `j:${JSON.stringify(records)}`;

export async function pack(records: unknown[]): Promise<string> {
  if (typeof CompressionStream === 'undefined') return packSync(records);
  const stream = new Blob([JSON.stringify(records)]).stream().pipeThrough(new CompressionStream('gzip'));
  return `g:${toBase64(new Uint8Array(await new Response(stream).arrayBuffer()))}`;
}

export async function unpack<T>(chunk: string): Promise<T[]> {
  if (chunk.startsWith('j:')) return JSON.parse(chunk.slice(2));
  const stream = new Blob([fromBase64(chunk.slice(2)) as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

/* ── The store ── */

interface Chunk { key: string; name: string; start: number; count: number }

export interface LocalStreamsOptions {
  /** Called when a write doesn't fit: free some room (removing a stream) and return true, or return false to give up. */
  evict?: (writing: string) => boolean;
}

export class LocalStreams {
  private listeners = new Set<() => void>();
  /** Where each stream ends as far as calls in flight are concerned, so concurrent appends take distinct offsets. */
  private tail = new Map<string, number>();
  private chain: Promise<void> = Promise.resolve();

  constructor(private opts: LocalStreamsOptions = {}) {}

  private chunks(name?: string): Chunk[] {
    const s = storage();
    if (!s) return [];
    const out: Chunk[] = [];
    const want = name === undefined ? null : encodeURIComponent(name);
    for (let i = 0; i < s.length; i++) {
      const key = s.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const m = KEY.exec(key);
      if (m && (want === null || m[1] === want)) out.push({ key, name: decodeURIComponent(m[1]), start: +m[2], count: +m[3] });
    }
    return out.sort((a, b) => a.start - b.start);
  }

  /** Every stream with at least one record. */
  names(): string[] {
    return [...new Set(this.chunks().map((c) => c.name))];
  }

  /** How many records the stream holds. */
  length(name: string): number {
    const cs = this.chunks(name);
    const last = cs[cs.length - 1];
    return Math.max(last ? last.start + last.count : 0, 0);
  }

  /** Characters the stream occupies (keys and values). */
  size(name?: string): number {
    const s = storage();
    return s ? this.chunks(name).reduce((n, c) => n + c.key.length + (s.getItem(c.key)?.length ?? 0), 0) : 0;
  }

  private next(name: string, n: number): number {
    const start = Math.max(this.tail.get(name) ?? 0, this.length(name));
    this.tail.set(name, start + n);
    return start;
  }

  private put(name: string, start: number, count: number, data: string) {
    const s = storage();
    if (!s) throw new StreamFullError(name);
    const key = `${PREFIX}${encodeURIComponent(name)}:${pad(start)}.${count}`;
    for (;;) {
      try { s.setItem(key, data); break; } catch {
        if (!this.opts.evict?.(name)) throw new StreamFullError(name);
      }
    }
    this.emit();
  }

  /** Append records; resolves to the offset of the first. Writes happen in call order. */
  append(name: string, records: unknown[]): Promise<number> {
    if (!records.length) return Promise.resolve(this.length(name));
    const start = this.next(name, records.length);
    const run = this.chain.then(async () => this.put(name, start, records.length, await pack(records)));
    this.chain = run.catch(() => undefined);
    return run.then(() => start);
  }

  /** Append now, uncompressed: for a page that is about to go. Anything still being compressed lands after it by offset. */
  appendSync(name: string, records: unknown[]): number {
    if (!records.length) return this.length(name);
    const start = this.next(name, records.length);
    this.put(name, start, records.length, packSync(records));
    return start;
  }

  /** Resolves once every append started so far has been written. */
  async flush() {
    await this.chain;
  }

  /** Records from `from` (inclusive) to `to` (exclusive). */
  async read<T = unknown>(name: string, from = 0, to = Infinity): Promise<T[]> {
    const s = storage();
    if (!s) return [];
    const out: T[] = [];
    for (const c of this.chunks(name)) {
      if (c.start + c.count <= from || c.start >= to) continue;
      const records = await unpack<T>(s.getItem(c.key) ?? 'j:[]');
      out.push(...records.slice(Math.max(0, from - c.start), Math.min(c.count, to - c.start)));
    }
    return out;
  }

  /** Drop a whole stream. Not an edit of the stream — it is gone, as when storage is cleared. */
  remove(name: string) {
    const s = storage();
    if (!s) return;
    for (const c of this.chunks(name)) s.removeItem(c.key);
    this.tail.delete(name);
    this.emit();
  }

  /** Called after any change in this tab, or (via `storage` events) in another. */
  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key.startsWith(PREFIX)) cb(); };
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
    return () => {
      this.listeners.delete(cb);
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }
}

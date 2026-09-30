'use client';
import { useSyncExternalStore } from 'react';
import { storage, type LocalStreams } from './append-stream';

/* ══ The cloud end of append-only streams ══
   A small client for the Durable Streams HTTP protocol (https://github.com/durable-streams/durable-streams — Rivet
   Actors serve it at `https://<project>.rivet.run/durable-streams`), and `CloudSync`, which mirrors this browser's
   local streams to such a server as they grow and can read other devices' streams back.

   Off by default: nothing leaves the browser until a server URL is saved and sync is switched on. Each local stream
   becomes a JSON stream of the same name on the server; records are POSTed in order as idempotent producer writes
   (this device's id, a batch number), so a retry after a dropped connection can't duplicate anything. The protocol
   used: PUT creates a stream, POST appends (a JSON array is many messages), GET `?offset=` reads from an offset and
   answers with `Stream-Next-Offset` / `Stream-Up-To-Date`, `live=long-poll` waits for more. Only `fetch` is needed. */

export interface DurableStreamsConfig {
  /** The server's base, e.g. `https://abc123.rivet.run/durable-streams`. Streams live at `<url>/v1/stream/<name>`. */
  url: string;
  /** Sent with every request: `{ Authorization: 'Bearer …' }`. */
  headers?: Record<string, string>;
  /** Put every stream under this prefix (a namespace per user or app). */
  prefix?: string;
  /** For tests, or a custom transport. Default: the global `fetch`. */
  fetch?: typeof fetch;
}

export interface ProducerWrite { id: string; epoch: number; seq: number }

export class DurableStreamsClient {
  constructor(private cfg: DurableStreamsConfig) {}

  private url(name: string, query = ''): string {
    return `${this.cfg.url.replace(/\/+$/, '')}/v1/stream/${encodeURIComponent((this.cfg.prefix ?? '') + name)}${query}`;
  }

  private request(url: string, init: RequestInit & { headers?: Record<string, string> } = {}): Promise<Response> {
    return (this.cfg.fetch ?? fetch)(url, { ...init, headers: { ...this.cfg.headers, ...init.headers } });
  }

  /** Create the stream (JSON mode) if it isn't there. */
  async create(name: string): Promise<void> {
    const res = await this.request(this.url(name), { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
    // 409: it exists already, which is what we wanted.
    if (!res.ok && res.status !== 409) throw new Error(`create ${name}: ${res.status}`);
  }

  /** Append records as one write. A write whose producer sequence the server has already seen counts as done. */
  async append(name: string, records: unknown[], producer?: ProducerWrite): Promise<void> {
    const post = () => this.request(this.url(name), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(producer ? { 'Producer-Id': producer.id, 'Producer-Epoch': String(producer.epoch), 'Producer-Seq': String(producer.seq) } : null),
      },
      body: JSON.stringify(records),
    });
    let res = await post();
    if (res.status === 404) { await this.create(name); res = await post(); }
    if (res.ok) return;
    const expected = Number(res.headers.get('Producer-Expected-Seq'));
    if (res.status === 409 && producer && Number.isFinite(expected) && res.headers.has('Producer-Expected-Seq') && expected > producer.seq) return;
    throw new Error(`append ${name}: ${res.status}`);
  }

  /** Everything from `offset` (`-1`: the start) to the end as it stands. */
  async read<T = unknown>(name: string, offset = '-1'): Promise<{ items: T[]; next: string }> {
    const items: T[] = [];
    let next = offset;
    for (;;) {
      const res = await this.request(this.url(name, `?offset=${encodeURIComponent(next)}`));
      if (res.status === 404) return { items, next };
      if (!res.ok) throw new Error(`read ${name}: ${res.status}`);
      const body = res.status === 204 ? '' : await res.text();
      if (body) items.push(...(JSON.parse(body) as T[]));
      const moved = res.headers.get('Stream-Next-Offset');
      if (res.headers.get('Stream-Up-To-Date') === 'true' || !moved || moved === next) return { items, next: moved ?? next };
      next = moved;
    }
  }

  /** Follow the stream from `offset`: `onItems` gets each batch as it arrives, until `signal` aborts. */
  async tail<T = unknown>(name: string, offset: string, onItems: (items: T[], next: string) => void, signal: AbortSignal): Promise<void> {
    let next = offset;
    while (!signal.aborted) {
      const res = await this.request(this.url(name, `?offset=${encodeURIComponent(next)}&live=long-poll`), { signal });
      if (res.status === 404) { await new Promise((r) => setTimeout(r, 3000)); continue; }
      if (!res.ok) throw new Error(`tail ${name}: ${res.status}`);
      const body = res.status === 204 ? '' : await res.text();
      next = res.headers.get('Stream-Next-Offset') ?? next;
      if (body) onItems(JSON.parse(body) as T[], next);
    }
  }
}

/* ══ Settings and status ══ */

export interface CloudSettings {
  enabled: boolean;
  url: string;
  /** A bearer token, sent as `Authorization: Bearer …`. */
  token: string;
  /** Put this device's streams under this prefix on the server. */
  prefix: string;
}

export interface CloudStatus {
  state: 'off' | 'idle' | 'syncing' | 'offline' | 'error';
  /** Records written here that the server hasn't acknowledged. */
  pending: number;
  lastSyncAt?: number;
  error?: string;
}

const SETTINGS_KEY = 'bl-cloud:settings';
const CURSOR = 'bl-cloud:cursor:';
const DEVICE_KEY = 'bl-cloud:device';
const BATCH = 400;
const OFF: CloudSettings = { enabled: false, url: '', token: '', prefix: '' };

export function loadCloudSettings(): CloudSettings {
  try { return { ...OFF, ...JSON.parse(storage()?.getItem(SETTINGS_KEY) ?? '{}') }; } catch { return OFF; }
}

/** An id for this browser, stable across sessions, that marks its writes. */
export function deviceId(): string {
  const s = storage();
  let id = s?.getItem(DEVICE_KEY);
  if (!id) {
    id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    try { s?.setItem(DEVICE_KEY, id); } catch { /* an unsaved id only costs a fresh one next time */ }
  }
  return id;
}

interface Cursor { records: number; batches: number }

/**
 * Mirrors local streams to a Durable Streams server while enabled, and keeps a read-through copy of the streams named
 * in `pull` (other devices' work) up to date. Progress is a small cursor per stream per server, kept in localStorage:
 * the streams themselves are never modified.
 */
export class CloudSync {
  private settings: CloudSettings = loadCloudSettings();
  private status: CloudStatus = { state: 'off', pending: 0 };
  private listeners = new Set<() => void>();
  private stopLocal?: () => void;
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private failures = 0;
  private abort?: AbortController;
  /** The latest contents of each `pull` stream on the server. */
  private pulled = new Map<string, unknown[]>();

  constructor(private local: LocalStreams, private pull: string[] = [], private transport: { fetch?: typeof fetch } = {}) {}

  /* ── Store (for useSyncExternalStore) ── */
  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; };
  getStatus = () => this.status;
  getSettings = () => this.settings;
  private set(patch: Partial<CloudStatus>) {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((l) => l());
  }

  private client(): DurableStreamsClient | null {
    const s = this.settings;
    if (!s.enabled || !s.url.trim()) return null;
    return new DurableStreamsClient({
      url: s.url.trim(),
      prefix: s.prefix.trim() ? `${s.prefix.trim().replace(/\/+$/, '')}.` : undefined,
      headers: s.token.trim() ? { Authorization: `Bearer ${s.token.trim()}` } : undefined,
      fetch: this.transport.fetch,
    });
  }

  private cursorKey(name: string) {
    return `${CURSOR}${encodeURIComponent(`${this.settings.url}|${this.settings.prefix}`)}:${encodeURIComponent(name)}`;
  }
  private cursor(name: string): Cursor {
    try { return { records: 0, batches: 0, ...JSON.parse(storage()?.getItem(this.cursorKey(name)) ?? '{}') }; } catch { return { records: 0, batches: 0 }; }
  }
  private saveCursor(name: string, c: Cursor) {
    try { storage()?.setItem(this.cursorKey(name), JSON.stringify(c)); } catch { /* the next pass re-sends from the last saved cursor; the server drops repeats */ }
  }

  /** Save settings and start or stop syncing to match. */
  configure(next: Partial<CloudSettings>) {
    this.settings = { ...this.settings, ...next };
    try { storage()?.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* kept in memory for this tab */ }
    this.stop();
    this.start();
    this.listeners.forEach((l) => l());
  }

  /** Begin syncing if the settings say to. Safe to call again. */
  start() {
    if (this.stopLocal || !this.client()) { if (!this.client()) this.set({ state: 'off', pending: 0, error: undefined }); return; }
    this.stopLocal = this.local.subscribe(() => this.schedule());
    const online = () => this.schedule(0);
    const offline = () => this.set({ state: 'offline' });
    addEventListener('online', online);
    addEventListener('offline', offline);
    const off = this.stopLocal;
    this.stopLocal = () => { off(); removeEventListener('online', online); removeEventListener('offline', offline); };
    this.set({ state: navigator.onLine === false ? 'offline' : 'idle', error: undefined });
    this.schedule(0);
    this.followPulled();
  }

  stop() {
    this.stopLocal?.();
    this.stopLocal = undefined;
    clearTimeout(this.timer);
    this.abort?.abort();
    this.abort = undefined;
    this.pulled.clear();
    this.set({ state: 'off', pending: 0, error: undefined });
  }

  /** Records of a `pull` stream as the server has them (empty until the first read, or with sync off). */
  pulledRecords<T>(name: string): T[] {
    return (this.pulled.get(name) as T[] | undefined) ?? [];
  }

  /** Read a whole stream from the server (for one this device doesn't hold). */
  async readRemote<T>(name: string): Promise<T[]> {
    const c = this.client();
    return c ? (await c.read<T>(name)).items : [];
  }

  private schedule(ms = 500) {
    if (!this.client()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), ms);
  }

  private async run() {
    const client = this.client();
    if (!client || this.running) return;
    if (navigator.onLine === false) { this.set({ state: 'offline' }); return; }
    this.running = true;
    this.set({ state: 'syncing' });
    try {
      const dev = deviceId();
      for (const name of this.local.names()) {
        const cur = this.cursor(name);
        const len = this.local.length(name);
        if (cur.records >= len) continue;
        if (cur.records === 0 && cur.batches === 0) await client.create(name);
        while (cur.records < len) {
          const batch = await this.local.read(name, cur.records, cur.records + BATCH);
          if (!batch.length) break;
          await client.append(name, batch, { id: dev, epoch: 0, seq: cur.batches });
          cur.records += batch.length;
          cur.batches += 1;
          this.saveCursor(name, cur);
          this.set({ pending: this.pending() });
        }
      }
      this.failures = 0;
      this.set({ state: 'idle', pending: this.pending(), lastSyncAt: Date.now(), error: undefined });
    } catch (e) {
      this.failures++;
      this.set({ state: 'error', pending: this.pending(), error: e instanceof Error ? e.message : String(e) });
      this.schedule(Math.min(60_000, 1000 * 2 ** this.failures));
    } finally {
      this.running = false;
    }
  }

  private pending(): number {
    return this.local.names().reduce((n, name) => n + Math.max(0, this.local.length(name) - this.cursor(name).records), 0);
  }

  /** Keep the `pull` streams' server copies current, live. */
  private followPulled() {
    const client = this.client();
    if (!client || !this.pull.length) return;
    const ac = (this.abort = new AbortController());
    for (const name of this.pull) {
      void (async () => {
        try {
          const { items, next } = await client.read(name);
          this.pulled.set(name, items);
          this.listeners.forEach((l) => l());
          await client.tail(name, next, (more) => {
            this.pulled.set(name, [...(this.pulled.get(name) ?? []), ...more]);
            this.listeners.forEach((l) => l());
          }, ac.signal);
        } catch (e) {
          if (!ac.signal.aborted) this.set({ state: 'error', error: e instanceof Error ? e.message : String(e) });
        }
      })();
    }
  }
}

/** The sync engine's status and settings, live. */
export function useCloud(cloud: CloudSync): { status: CloudStatus; settings: CloudSettings } {
  const status = useSyncExternalStore(cloud.subscribe, cloud.getStatus, cloud.getStatus);
  const settings = useSyncExternalStore(cloud.subscribe, cloud.getSettings, cloud.getSettings);
  return { status, settings };
}

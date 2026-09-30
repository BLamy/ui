'use client';
import { useEffect, useSyncExternalStore } from 'react';
import type { eventWithTime } from 'rrweb';
import { LocalStreams, StreamFullError } from './append-stream';
import { CloudSync, deviceId, useCloud, type CloudSettings, type CloudStatus } from './durable-streams';

/* ══ Session recorder ══
   Records the page with rrweb, one session per page load, as append-only streams (see `append-stream.ts`):

     sessions          an index — a `start` record when a session begins, an `end` record when it ends, a `delete`
                       record when you delete it. Records only ever get added.
     session/<id>      that session's rrweb events, in order, in chunks.

   Everything is written to localStorage, so a private browser is the whole system. `sessionCloud` mirrors the same
   streams to a Durable Streams server (Rivet) when switched on, and then a second device sees this one's sessions.

   Keep a subtree out of the recording with the class names below: `rr-block` swaps the element for an empty
   placeholder of the same size (nothing inside is recorded — use it on anything that plays recordings, or it would
   record itself recording), and `rr-ignore` drops input events from it. localStorage is small: when a write won't fit
   the oldest session's events are dropped from this browser to make room (the index, and the cloud, keep them), and
   only the newest `maxSessions` are kept here. */

export type RecordedEvent = eventWithTime;

/** The records of the `sessions` index stream. */
export type IndexRecord =
  | { t: 'start'; id: string; at: number; url: string; title: string; width: number; height: number; device: string }
  | { t: 'end'; id: string; at: number; events: number; truncated?: boolean }
  | { t: 'delete'; id: string; at: number };

export interface SessionInfo {
  id: string;
  startedAt: number;
  /** When it ended, if it ended cleanly. */
  endedAt?: number;
  /** Events recorded so far (here) or in total (from the `end` record, for a session held only in the cloud). */
  events?: number;
  url: string;
  title: string;
  width: number;
  height: number;
  /** Which browser recorded it. */
  device: string;
  /** Being recorded right now, by this tab. */
  live: boolean;
  /** Its events are in this browser. */
  local: boolean;
  /** Storage ran out and the recording stopped early. */
  truncated?: boolean;
}

export interface SessionRecordingOptions {
  /** Elements with this class are recorded as empty placeholders. Default `rr-block`. */
  blockClass?: string;
  /** Elements with this class don't record input events. Default `rr-ignore`. */
  ignoreClass?: string;
  /** Replace typed text with asterisks. Default true. */
  maskAllInputs?: boolean;
  /** How many sessions' events to keep in this browser; the oldest go first. Default 30. */
  maxSessions?: number;
  /** How often buffered events are written, in ms. Default 1500. */
  flushMs?: number;
}

const INDEX = 'sessions';
const streamOf = (id: string) => `session/${id}`;
const QUOTA = 5_000_000;

/* ── The streams ── */

/** Sessions by id, from the index stream. Used to choose what to drop when storage is full. */
let cache: SessionInfo[] = [];
let liveId: string | null = null;

const streams: LocalStreams = new LocalStreams({
  // Out of room: drop the oldest session's events from this browser (never the one being written or the index).
  evict(writing) {
    const victim = [...cache].reverse().find((s) => s.local && s.id !== liveId && streamOf(s.id) !== writing);
    if (!victim) return false;
    streams.remove(streamOf(victim.id));
    return true;
  },
});

/** Mirrors the session streams to a Durable Streams server (Rivet) when enabled; see `CloudSync`. */
export const sessionCloud = new CloudSync(streams, [INDEX]);

/* ── Listing ── */

async function build(): Promise<SessionInfo[]> {
  const local = await streams.read<IndexRecord>(INDEX);
  const remote = sessionCloud.pulledRecords<IndexRecord>(INDEX);
  const seen = new Set<string>();
  const records = [...local, ...remote].filter((r) => {
    const k = `${r.t}:${r.id}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
  const deleted = new Set(records.filter((r) => r.t === 'delete').map((r) => r.id));
  const out: SessionInfo[] = [];
  for (const r of records) {
    if (r.t !== 'start' || deleted.has(r.id)) continue;
    const end = records.find((x): x is Extract<IndexRecord, { t: 'end' }> => x.t === 'end' && x.id === r.id);
    const held = streams.length(streamOf(r.id));
    const cloud = sessionCloud.getSettings().enabled;
    // Events that neither this browser nor a server has any more aren't a session to show.
    if (!held && !cloud) continue;
    out.push({
      id: r.id, startedAt: r.at, endedAt: end?.at, events: held || end?.events, url: r.url, title: r.title,
      width: r.width, height: r.height, device: r.device, live: r.id === liveId, local: held > 0, truncated: end?.truncated,
    });
  }
  return out.sort((a, b) => b.startedAt - a.startedAt);
}

const listeners = new Set<() => void>();
let building = false;
let again = false;
async function refresh() {
  if (building) { again = true; return; }
  building = true;
  try {
    do {
      again = false;
      cache = await build();
      listeners.forEach((l) => l());
    } while (again);
  } finally {
    building = false;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const offs = [streams.subscribe(() => void refresh()), sessionCloud.subscribe(() => void refresh())];
  void refresh();
  return () => { listeners.delete(cb); offs.forEach((o) => o()); };
}

/** Every session, newest first, kept current while one records or another device syncs. */
export function useSessions(): SessionInfo[] {
  return useSyncExternalStore(subscribe, () => cache, () => cache);
}

/** The session this tab is recording, if any. */
export function currentSessionId(): string | null {
  return liveId;
}

/** A session's events, in order. A session still recording reads as far as it has got. */
export async function readSession(id: string): Promise<RecordedEvent[]> {
  if (id === liveId) await streams.flush();
  const name = streamOf(id);
  if (streams.length(name) > 0) return streams.read<RecordedEvent>(name);
  return sessionCloud.readRemote<RecordedEvent>(name);
}

/** Delete a session: its events leave this browser, and a `delete` record joins the index so every device agrees. */
export async function deleteSession(id: string) {
  if (id === liveId) return;
  streams.remove(streamOf(id));
  await streams.append(INDEX, [{ t: 'delete', id, at: Date.now() } satisfies IndexRecord]);
}

/** Delete every session but the one recording now. */
export async function clearSessions() {
  for (const s of cache) await deleteSession(s.id);
}

/** What this browser's streams occupy, in characters, against a typical 5M-character localStorage quota. */
export function storageUsage(): { used: number; quota: number } {
  return { used: streams.size(), quota: QUOTA };
}

/** The cloud's status and settings, live. */
export function useSessionCloud(): { status: CloudStatus; settings: CloudSettings; configure: (s: Partial<CloudSettings>) => void } {
  const { status, settings } = useCloud(sessionCloud);
  return { status, settings, configure: (s) => sessionCloud.configure(s) };
}

/* ── Recording ── */

class Recording {
  readonly id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  private buffer: RecordedEvent[] = [];
  private events = 0;
  private started = false;
  private last = Date.now();
  private info: Extract<IndexRecord, { t: 'start' }>;
  private timer: ReturnType<typeof setInterval> | undefined;
  private stopRecord: (() => void) | undefined;
  private dead = false;

  constructor(private opts: Required<SessionRecordingOptions>, device: string) {
    this.info = { t: 'start', id: this.id, at: Date.now(), url: location.href, title: document.title, width: innerWidth, height: innerHeight, device };
  }

  start(record: (o: Record<string, unknown>) => (() => void) | undefined) {
    this.stopRecord = record({
      emit: (e: RecordedEvent) => this.push(e),
      blockClass: this.opts.blockClass,
      ignoreClass: this.opts.ignoreClass,
      maskAllInputs: this.opts.maskAllInputs,
      // Coarser pointer and scroll sampling keeps a long session small.
      sampling: { mousemove: 60, scroll: 150, input: 'last' },
      slimDOMOptions: { script: true, comment: true, headFavicon: true, headMetaSocial: true, headMetaRobots: true, headMetaHttpEquiv: true, headMetaVerification: true },
    });
    this.timer = setInterval(() => this.flush(), this.opts.flushMs);
    document.addEventListener('visibilitychange', this.onHide);
    addEventListener('pagehide', this.onLeave);
  }

  private onHide = () => { if (document.visibilityState === 'hidden') this.flush(true); };
  private onLeave = () => { this.flush(true); };

  private push(e: RecordedEvent) {
    if (this.dead) return;
    if (e.type === 4 && !this.events) {
      // The first event says where and how big the page was.
      const d = e.data as { href?: string; width?: number; height?: number };
      this.info = { ...this.info, at: e.timestamp, url: d.href ?? this.info.url, width: d.width ?? this.info.width, height: d.height ?? this.info.height };
    }
    this.buffer.push(e);
    this.events++;
    this.last = Math.max(this.last, e.timestamp);
    if (this.buffer.length >= 400) this.flush();
  }

  /** Append what's buffered to the session's stream. `sync` (the page is leaving) skips compression so it lands in time. */
  flush(sync = false) {
    if (!this.buffer.length || this.dead) return;
    const events = this.buffer;
    this.buffer = [];
    const name = streamOf(this.id);
    const go = () => {
      // The index learns of the session when its first events are written, so a recording that never got going leaves no trace.
      if (!this.started) { this.started = true; liveId = this.id; streams.appendSync(INDEX, [this.info]); }
      return sync ? Promise.resolve(streams.appendSync(name, events)) : streams.append(name, events);
    };
    try {
      void go().catch((e) => this.fail(e));
    } catch (e) {
      this.fail(e);
    }
  }

  private fail(e: unknown) {
    if (!(e instanceof StreamFullError)) throw e;
    this.dead = true;
    this.stopRecord?.();
    clearInterval(this.timer);
    try { streams.appendSync(INDEX, [{ t: 'end', id: this.id, at: this.last, events: this.events, truncated: true } satisfies IndexRecord]); } catch { /* nothing more can be written */ }
  }

  stop() {
    if (this.dead) return;
    this.stopRecord?.();
    clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.onHide);
    removeEventListener('pagehide', this.onLeave);
    // A remount or a page that closed at once (a few events, no seconds) isn't worth a session.
    if (!this.started && this.events < 4) { this.dead = true; return; }
    this.flush(true);
    this.dead = true;
    try { streams.appendSync(INDEX, [{ t: 'end', id: this.id, at: this.last, events: this.events } satisfies IndexRecord]); } catch { /* the events are what matter */ }
    if (liveId === this.id) liveId = null;
  }
}

let refs = 0;
let active: Recording | null = null;
let starting: Promise<void> | null = null;

const DEFAULTS: Required<SessionRecordingOptions> = { blockClass: 'rr-block', ignoreClass: 'rr-ignore', maskAllInputs: true, maxSessions: 30, flushMs: 1500 };

async function begin(opts: Required<SessionRecordingOptions>) {
  const { record } = await import('rrweb');
  if (refs === 0 || active) return;
  // Keep room for the new session: only the newest `maxSessions` keep their events here.
  await refresh();
  for (const s of cache.filter((x) => x.local).slice(Math.max(0, opts.maxSessions - 1))) streams.remove(streamOf(s.id));
  active = new Recording(opts, deviceId());
  active.start(record as unknown as Parameters<Recording['start']>[0]);
}

async function end() {
  await starting;
  if (refs > 0 || !active) return;
  const a = active;
  active = null;
  a.stop();
  void refresh();
}

/** Start recording this page as a new session; returns the function that ends it. Calls share one recording. */
export function startSessionRecording(options: SessionRecordingOptions = {}): () => void {
  refs++;
  // Options left undefined mean the default (a spread would let `undefined` win).
  const given = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
  if (refs === 1 || !active) starting = begin({ ...DEFAULTS, ...given });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--refs === 0) void end();
  };
}

/** Record this page for as long as the component is mounted: one new session per mount (not per re-render). The cloud,
    if switched on, syncs meanwhile. */
export function useSessionRecording({ enabled = true, ...options }: SessionRecordingOptions & { enabled?: boolean } = {}) {
  const { blockClass, ignoreClass, maskAllInputs, maxSessions, flushMs } = options;
  useEffect(() => {
    if (!enabled) return;
    sessionCloud.start();
    const release = startSessionRecording({ blockClass, ignoreClass, maskAllInputs, maxSessions, flushMs });
    return () => { release(); };
  }, [enabled, blockClass, ignoreClass, maskAllInputs, maxSessions, flushMs]);
}

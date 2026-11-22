import { percentile, unionMs } from '@/lib/flame-chart-model';
import { cacheIndex, type CacheIndex, type CachedStep, type ReplayCache } from './cache';

/* ══ Several recordings of one session, on one clock ══
   A browser and the services behind it, each recorded on its own, as an extractor that drives Replay's native linker writes them
   down: every replayed recording's ReplayCache with its offset onto the shared clock, the spans that join them as a
   distributed tracer has them, and each process's CPU and memory samples. A page loads the JSON and has the whole session
   to scrub, debug and measure, with no engine.

   The spans carry what the Replay inspector's session analytics read (src/ui/src/cluster/session-analytics.ts and
   trace/model.ts in full-stack-osx-demo), so the same views can be drawn from this format:

   | Inspector (RequestRow, TimeSpan)                    | Here (SessionSpan)                                         |
   | --------------------------------------------------- | ---------------------------------------------------------- |
   | traceId, spanId, parentSpanId                       | traceId, id, parentId                                      |
   | role / worker, pod, pid, threadId                   | service, recording (→ role, process, pid)                  |
   | method + url, operation, name                       | name, attributes['http.method'], ['http.url'|'http.route'] |
   | direction (incoming / outgoing), method ASYNC       | kind: server, client, internal, producer, consumer         |
   | startedAt, duration, event !== 'finish' (pending)   | start, end (null while it never finished)                  |
   | status, error, spanStatus.code                      | status ('ok' | 'error' | 'unset'), error, ['http.status_code'] |
   | userSessionId, userId, requestId                    | attributes['session.id'], ['enduser.id'], ['http.request_id'] |
   | recordingId + point (open where it ran)             | recording + startStep / endStep                            |
   | METRIC rows: cpuPercent, rss, heapUsed, sampleMs    | metrics: { recording, time, cpuPercent, rss, heapUsed }    |
   | LOG rows                                            | logs: { recording, time, step, level, text }               |
   | requestBody / responseBody (bounded)                | attributes, bounded by whoever writes them                 |

   What the analytics derive (self time as duration minus the union of children, a service's busy time with overlaps
   counted once, P50 / P95 per operation, errors, pending spans, spans whose parent started after them) is
   `analyzeSession` below. */

export type SpanKind = 'server' | 'client' | 'internal' | 'producer' | 'consumer';

export interface SessionSpan {
  id: string;
  traceId: string;
  /** The span that caused it, in this recording or another; null for a root. */
  parentId: string | null;
  /** The recording it ran in (`SessionRecording.id`). */
  recording: string;
  service: string;
  name: string;
  kind: SpanKind;
  /** ms on the shared clock. */
  start: number;
  /** null: it never finished while it was recorded. */
  end: number | null;
  status: 'ok' | 'error' | 'unset';
  error?: string;
  /** Where it began and ended in its recording, to open it there. */
  startStep?: number;
  endStep?: number;
  attributes: Record<string, string | number | boolean>;
}

export interface SessionRecording {
  id: string;
  role: string;
  service: string;
  process: string;
  runtime: string;
  pid?: number;
  /** Add to the recording's own ms to get ms on the shared clock. */
  offsetMs: number;
  /** What a replay of it said, for a recording that was replayed. */
  cache?: ReplayCache;
  /** rrweb's events, for a page that recorded itself. Their timestamps are the wall clock's; the first is at `offsetMs`. */
  rrweb?: unknown[];
}

export interface SessionMetric {
  recording: string;
  time: number;
  cpuPercent?: number;
  rss?: number;
  heapUsed?: number;
}

export interface SessionLog {
  recording: string;
  time: number | null;
  step: number;
  level: string;
  text: string;
}

export interface ReplaySession {
  format: 'bl-replay-session/1';
  name: string;
  /** What zero on the shared clock was, on the clock the recordings were lined up by. */
  origin: { clock: string; ms: number };
  recordings: SessionRecording[];
  spans: SessionSpan[];
  metrics: SessionMetric[];
  logs: SessionLog[];
}

/* ── Reading it ── */

export interface SessionIndex {
  session: ReplaySession;
  range: { start: number; end: number };
  recordings: Map<string, SessionRecording>;
  /** The replayed recordings' step indexes. */
  caches: Map<string, CacheIndex>;
  spans: Map<string, SessionSpan>;
  children: Map<string, SessionSpan[]>;
}

const indexes = new WeakMap<ReplaySession, SessionIndex>();
export function sessionIndex(session: ReplaySession): SessionIndex {
  const known = indexes.get(session);
  if (known) return known;
  const recordings = new Map(session.recordings.map((r) => [r.id, r]));
  const caches = new Map<string, CacheIndex>();
  let start = Infinity;
  let end = -Infinity;
  for (const r of session.recordings) {
    if (r.cache) {
      const index = cacheIndex(r.cache);
      caches.set(r.id, index);
      if (index.times.length) {
        start = Math.min(start, index.times[0] + r.offsetMs);
        end = Math.max(end, index.times[index.times.length - 1] + r.offsetMs);
      }
    }
    const events = r.rrweb as Array<{ timestamp: number }> | undefined;
    if (events?.length) {
      start = Math.min(start, r.offsetMs);
      end = Math.max(end, r.offsetMs + events[events.length - 1].timestamp - events[0].timestamp);
    }
  }
  for (const s of session.spans) {
    start = Math.min(start, s.start);
    end = Math.max(end, s.end ?? s.start);
  }
  if (!Number.isFinite(start)) [start, end] = [0, 1];
  const spans = new Map(session.spans.map((s) => [s.id, s]));
  const children = new Map<string, SessionSpan[]>();
  for (const s of session.spans) if (s.parentId && spans.has(s.parentId)) (children.get(s.parentId) ?? children.set(s.parentId, []).get(s.parentId)!).push(s);
  const made = { session, range: { start, end: Math.max(end, start + 1) }, recordings, caches, spans, children };
  indexes.set(session, made);
  return made;
}

/** A replayed recording's kept step at or before a time on the shared clock, or undefined before its first. */
export function stepAtTime(session: ReplaySession, recording: string, sharedMs: number): CachedStep | undefined {
  const { recordings, caches } = sessionIndex(session);
  const index = caches.get(recording);
  const offset = recordings.get(recording)?.offsetMs ?? 0;
  if (!index) return undefined;
  const at = index.ordinalAt(sharedMs - offset);
  return at < 0 ? undefined : index.step(index.cache.steps[at].index);
}

/** The shared-clock time of a step of a recording. */
export function timeOfStep(session: ReplaySession, recording: string, step: number): number | undefined {
  const { recordings, caches } = sessionIndex(session);
  const ms = caches.get(recording)?.step(step)?.ms;
  return ms === undefined ? undefined : ms + (recordings.get(recording)?.offsetMs ?? 0);
}

/** The kept steps of a recording between two shared-clock times: what ran during a span. */
export function stepsBetween(session: ReplaySession, recording: string, from: number, to: number): CachedStep[] {
  const { recordings, caches } = sessionIndex(session);
  const index = caches.get(recording);
  if (!index) return [];
  const offset = recordings.get(recording)?.offsetMs ?? 0;
  const first = Math.max(0, index.ordinalAt(from - offset - 1e-9) + 1);
  const last = index.ordinalAt(to - offset);
  const out: CachedStep[] = [];
  for (let i = first; i <= last; i++) out.push(index.step(index.cache.steps[i].index)!);
  return out;
}

/* ── Request points: what a backend did for each request, step by step ── */

export interface RequestPoint {
  span: SessionSpan;
  /** The client span that sent it, if one was recorded. */
  caller?: SessionSpan;
  /** What ran in its recording while it was being answered, in order. */
  steps: CachedStep[];
}

const isStatic = (span: SessionSpan) => /\.(js|css|map|png|svg|ico|woff2?)(\?|$)/.test(String(span.attributes['http.url'] ?? span.attributes['http.route'] ?? span.name));

/** Every server span of a replayed recording that ran code, in time order: the moments worth opening. */
export function requestPoints(session: ReplaySession): RequestPoint[] {
  const { spans, caches } = sessionIndex(session);
  return session.spans
    .filter((s) => s.kind === 'server' && caches.has(s.recording) && !isStatic(s))
    .sort((a, b) => a.start - b.start)
    .map((span) => ({
      span,
      caller: span.parentId ? spans.get(span.parentId) : undefined,
      steps: stepsBetween(session, span.recording, span.start, span.end ?? span.start),
    }))
    .filter((p) => p.steps.length > 0);
}

/* ── Analytics, as the inspector's session view has them ── */

export interface Operation {
  service: string;
  name: string;
  count: number;
  errors: number;
  totalMs: number;
  selfMs: number;
  p50: number;
  p95: number;
  max: number;
}

export interface SessionAnalytics {
  /** Each span's own time: its duration less the union of its children's, clipped to it. */
  selfMs: Map<string, number>;
  operations: Operation[];
  services: { service: string; recording: string; spans: number; errors: number; busyMs: number; selfMs: number }[];
  traces: { traceId: string; start: number; end: number; spans: number; errors: number; services: string[]; root?: SessionSpan }[];
  errors: number;
  pending: number;
  /** Spans that began before the span that caused them did: a clock that's off between recordings. */
  clockIssues: number;
}

export function analyzeSession(session: ReplaySession): SessionAnalytics {
  const { spans, children, range } = sessionIndex(session);
  const endOf = (s: SessionSpan) => s.end ?? range.end;
  const failed = (s: SessionSpan) => s.status === 'error';
  const selfMs = new Map<string, number>();
  for (const s of session.spans) {
    const start = s.start;
    const end = endOf(s);
    const kids = (children.get(s.id) ?? []).map((c) => ({ start: Math.max(c.start, start), end: Math.min(endOf(c), end) }));
    selfMs.set(s.id, Math.max(0, end - start - unionMs(kids)));
  }
  const groups = new Map<string, SessionSpan[]>();
  for (const s of session.spans) {
    const key = `${s.service}\0${s.name}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(s);
  }
  const operations = [...groups.values()].map((group): Operation => {
    const durations = group.map((s) => endOf(s) - s.start);
    return {
      service: group[0].service,
      name: group[0].name,
      count: group.length,
      errors: group.filter(failed).length,
      totalMs: durations.reduce((a, b) => a + b, 0),
      selfMs: group.reduce((sum, s) => sum + (selfMs.get(s.id) ?? 0), 0),
      p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95),
      max: Math.max(...durations),
    };
  }).sort((a, b) => b.selfMs - a.selfMs);
  const services = session.recordings.map((r) => {
    const own = session.spans.filter((s) => s.recording === r.id);
    return {
      service: r.service,
      recording: r.id,
      spans: own.length,
      errors: own.filter(failed).length,
      busyMs: unionMs(own.map((s) => ({ start: s.start, end: endOf(s) }))),
      selfMs: own.reduce((sum, s) => sum + (selfMs.get(s.id) ?? 0), 0),
    };
  });
  const traceMap = new Map<string, SessionSpan[]>();
  for (const s of session.spans) (traceMap.get(s.traceId) ?? traceMap.set(s.traceId, []).get(s.traceId)!).push(s);
  const traces = [...traceMap].map(([traceId, group]) => ({
    traceId,
    start: Math.min(...group.map((s) => s.start)),
    end: Math.max(...group.map(endOf)),
    spans: group.length,
    errors: group.filter(failed).length,
    services: [...new Set(group.map((s) => s.service))],
    root: group.find((s) => !s.parentId || !spans.has(s.parentId)),
  })).sort((a, b) => a.start - b.start);
  return {
    selfMs,
    operations,
    services,
    traces,
    errors: session.spans.filter(failed).length,
    pending: session.spans.filter((s) => s.end === null).length,
    clockIssues: session.spans.filter((s) => s.parentId && spans.has(s.parentId) && spans.get(s.parentId)!.start > s.start + 1).length,
  };
}

/* ── The code's own calls, as spans ── */

export interface CallSpan {
  id: string;
  parentId: string | null;
  recording: string;
  name: string;
  start: number;
  end: number;
  depth: number;
  step: number;
}

/** What ran inside each recording's own code, as nested calls: from the stacks at its steps, a call begins at the first
 *  step with its frame on the stack and ends at the first step after without it. Calls that leave the kept sources and
 *  come back read as one. */
export function callSpans(session: ReplaySession, recording: string): CallSpan[] {
  const { caches, recordings } = sessionIndex(session);
  const index = caches.get(recording);
  if (!index) return [];
  const offset = recordings.get(recording)?.offsetMs ?? 0;
  const keptSources = new Set(index.cache.sources.map((s) => s.id));
  const out: CallSpan[] = [];
  let open: CallSpan[] = [];
  const steps = index.steps();
  let n = 0;
  for (const step of steps) {
    // Outermost first, only the frames in the program's own code.
    const frames = step.stack.filter((f) => f.location && keptSources.has(f.location.sourceId)).reverse();
    let same = 0;
    while (same < open.length && same < frames.length && open[same].name === frames[same].name) same++;
    for (const closed of open.splice(same)) closed.end = step.ms + offset;
    for (let d = same; d < frames.length; d++) {
      const call: CallSpan = { id: `${recording}:call:${n++}`, parentId: open[d - 1]?.id ?? null, recording, name: frames[d].name, start: step.ms + offset, end: step.ms + offset, depth: d, step: step.index };
      open.push(call);
      out.push(call);
    }
  }
  const last = steps[steps.length - 1];
  for (const closed of open) closed.end = (last?.ms ?? 0) + offset;
  open = [];
  return out;
}

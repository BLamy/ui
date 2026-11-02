/* Replay QA as recordings: the projects a Replay sign-in can see, their test runs, and each journey's rrweb recording,
   from qa.replay.io's API (it answers CORS, so the browser asks it directly, with the Replay access token as Bearer).
   The API's "test run" is one journey run once; the runs one go of the suite started share a `test_session_id`, so a
   test run here is that group, with the latest run of each journey in it.

   Recordings come from `/recording-events` page by page: a page over the API's 6 MB cap answers 502, so pages start
   small and halve until they fit, and an rrweb event too big for one row arrives as `rrweb-chunk` rows to join. */
import type { ReplayEvent } from '@/components/ui/replay-preview';

export const QA_API = 'https://qa.replay.io/api/v1';

export interface QaProject {
  id: string;
  name: string;
  target_url: string | null;
  status: string;
  bug_count: number;
  updated_at: string;
}

/** One journey run once (the API's test run). */
export interface QaJourneyRun {
  id: string;
  journey_id: string;
  journey_name: string | null;
  goal: string | null;
  status: string;
  outcome_status: string | null;
  bugs_found_count: number;
  created_at: string;
  duration_seconds: number | null;
  environment_name: string | null;
  test_session_id: string | null;
}

/** A go of the suite: the latest run of each journey that shared its test session. */
export interface QaTestRun {
  id: string;
  startedAt: string;
  environment: string | null;
  runs: QaJourneyRun[];
  passed: number;
  failed: number;
  bugs: number;
}

export class QaAuthError extends Error {}

type Page<T> = { items?: T[]; total?: number };

export function createQaClient(token: string, base = QA_API) {
  const get = async <T>(path: string, signal?: AbortSignal): Promise<{ status: number; data: T }> => {
    const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal });
    if (res.status === 401 || res.status === 403) throw new QaAuthError('Replay QA turned the sign-in down. Sign in to Replay again.');
    const text = await res.text();
    let data: unknown = text;
    try { data = text ? JSON.parse(text) : {}; } catch { /* left as text */ }
    return { status: res.status, data: data as T };
  };

  /** Every page of a list (the API serves at most 100 a page). */
  const all = async <T>(path: string, signal?: AbortSignal, onPage?: (items: T[]) => void): Promise<T[]> => {
    const items: T[] = [];
    for (let page = 1; ; page++) {
      const { status, data } = await get<Page<T>>(`${path}${path.includes('?') ? '&' : '?'}page=${page}&page_size=100`, signal);
      if (status !== 200) throw new Error(`Replay QA answered ${status} for ${path}.`);
      const got = data.items ?? [];
      items.push(...got);
      onPage?.(items.slice());
      if (!got.length || items.length >= (data.total ?? 0)) return items;
    }
  };

  return {
    projects: (signal?: AbortSignal) => all<QaProject>('/projects', signal),
    /** Every journey run of a project, as the pages arrive. */
    journeyRuns: (projectId: string, signal?: AbortSignal, onPage?: (runs: QaJourneyRun[]) => void) =>
      all<QaJourneyRun>(`/projects/${encodeURIComponent(projectId)}/test-runs`, signal, onPage),
    /** A journey run's rrweb events (empty when it recorded none). */
    async recording(projectId: string, runId: string, signal?: AbortSignal): Promise<ReplayEvent[]> {
      const events: ReplayEvent[] = [];
      const chunks = new Map<string, { parts: string[]; got: number }>();
      let limit = 20, cursor: { after_task_id: string; after_seq: number } | null = null;
      for (;;) {
        const q = new URLSearchParams({ test_run_id: runId, limit: String(limit) });
        if (cursor) { q.set('after_task_id', cursor.after_task_id); q.set('after_seq', String(cursor.after_seq)); }
        const { status, data } = await get<RecordingPage>(`/projects/${encodeURIComponent(projectId)}/recording-events?${q}`, signal);
        if (status === 502 && /ResponseSizeTooLarge|payload size exceeded/i.test(JSON.stringify(data))) {
          if (limit === 1) throw new Error('A recording event is larger than Replay QA can send.');
          limit = Math.max(1, limit >> 1);
          continue;
        }
        if (status !== 200) throw new Error(`Replay QA answered ${status} for the recording of ${runId}.`);
        for (const e of data.events ?? []) {
          if (e.event_type === 'rrweb') events.push(e.payload as ReplayEvent);
          else if (e.event_type === 'rrweb-chunk') {
            const c = e.payload as { chunk_id: string; index: number; total: number; data: string };
            const entry = chunks.get(c.chunk_id) ?? { parts: new Array<string>(c.total), got: 0 };
            chunks.set(c.chunk_id, entry);
            if (entry.parts[c.index] === undefined) entry.got++;
            entry.parts[c.index] = c.data;
            if (entry.got === c.total) {
              chunks.delete(c.chunk_id);
              try { events.push(JSON.parse(entry.parts.join('')) as ReplayEvent); } catch { /* a corrupt set drops one event */ }
            }
          }
        }
        // Small pages are cheap: grow back after a shrink.
        if (limit < 20) limit = Math.min(20, limit * 2);
        if (!data.next_cursor) return events;
        cursor = data.next_cursor;
      }
    },
  };
}

export type QaClient = ReturnType<typeof createQaClient>;

interface RecordingPage {
  events?: Array<{ event_type: string; payload: unknown; task_id: string; seq: number }>;
  next_cursor?: { after_task_id: string; after_seq: number } | null;
}

const PASSED = new Set(['passed']);
const FAILED = new Set(['failed', 'bug', 'bugs-found']);

/** Groups journey runs into test runs, newest first; each keeps the latest run of every journey in it. */
export function groupTestRuns(runs: QaJourneyRun[]): QaTestRun[] {
  const groups = new Map<string, QaJourneyRun[]>();
  for (const r of runs) {
    const key = r.test_session_id ?? r.id;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }
  const out: QaTestRun[] = [];
  for (const [id, list] of groups) {
    const latest = new Map<string, QaJourneyRun>();
    for (const r of list) {
      const seen = latest.get(r.journey_id);
      if (!seen || seen.created_at < r.created_at) latest.set(r.journey_id, r);
    }
    const kept = [...latest.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    out.push({
      id,
      startedAt: kept.reduce((m, r) => (r.created_at < m ? r.created_at : m), kept[0]!.created_at),
      environment: kept.find((r) => r.environment_name)?.environment_name ?? null,
      runs: kept,
      passed: kept.filter((r) => PASSED.has(r.outcome_status ?? '')).length,
      failed: kept.filter((r) => FAILED.has(r.outcome_status ?? '') || r.status === 'failed').length,
      bugs: kept.reduce((n, r) => n + (r.bugs_found_count ?? 0), 0),
    });
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

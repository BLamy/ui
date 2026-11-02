import { describe, expect, it } from 'vitest';
import { groupTestRuns, type QaJourneyRun } from './qa';

const run = (id: string, session: string, journey: string, at: string, outcome: string | null = 'passed', bugs = 0): QaJourneyRun => ({
  id, journey_id: journey, journey_name: journey, goal: null, status: 'completed', outcome_status: outcome, bugs_found_count: bugs,
  created_at: at, duration_seconds: 10, environment_name: 'Production', test_session_id: session,
});

describe('groupTestRuns', () => {
  it('groups journey runs by test session, newest first, keeping each journey’s latest run', () => {
    const out = groupTestRuns([
      run('a1', 'ts-a', 'login', '2026-10-01T10:00:00Z', 'bug', 2),
      run('a2', 'ts-a', 'login', '2026-10-01T10:05:00Z'),
      run('a3', 'ts-a', 'checkout', '2026-10-01T10:01:00Z', 'bug', 1),
      run('b1', 'ts-b', 'login', '2026-10-02T09:00:00Z'),
    ]);
    expect(out.map((t) => t.id)).toEqual(['ts-b', 'ts-a']);
    const a = out[1]!;
    expect(a.runs.map((r) => r.id)).toEqual(['a3', 'a2']);
    expect(a.startedAt).toBe('2026-10-01T10:01:00Z');
    expect([a.passed, a.failed, a.bugs]).toEqual([1, 1, 1]);
  });
});

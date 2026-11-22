import { describe, expect, it } from 'vitest';
import {
  analyzeSession,
  callSpans,
  requestPoints,
  sessionIndex,
  stepAtTime,
  timeOfStep,
  type ReplaySession,
  pointAt,
} from '@/components/ui/replay-debugger';
import { percentile, unionMs } from '@/lib/flame-chart-model';
import checkout from './recordings/checkout-session.json';

/* A real session: the shop page and four Node services (recorded with Replay's Node, outside this repository), each recorded, replayed once with
   the linker, and lined up on one clock. */
const session = checkout as unknown as ReplaySession;
const service = (name: string) => session.recordings.find((r) => r.service === name)!;

describe('a session of several recordings, from JSON', () => {
  it('has the page and the four services, the page as rrweb saw it and the services replayed', () => {
    expect(session.format).toBe('bl-replay-session/1');
    expect(session.recordings.map((r) => r.service).sort()).toEqual(['browser', 'gateway', 'inventory', 'orders', 'payments']);
    expect(service('browser').rrweb?.length).toBeGreaterThan(10);
    for (const name of ['gateway', 'orders', 'payments', 'inventory']) expect(service(name).cache?.steps.length).toBeGreaterThan(100);
  });

  it('joins each checkout from the page to every service it reached, by trace context', () => {
    const { spans } = sessionIndex(session);
    const clicks = session.spans.filter((s) => s.recording === 'browser');
    expect(clicks).toHaveLength(6);
    for (const click of clicks) {
      const trace = session.spans.filter((s) => s.traceId === click.traceId);
      const gateway = trace.find((s) => s.service === 'gateway' && s.kind === 'server');
      expect(gateway?.parentId).toBe(click.id);
      // The server answered inside the time the page waited, on the shared clock (within a millisecond of alignment).
      expect(gateway!.start).toBeGreaterThan(click.start - 1);
      expect(gateway!.end!).toBeLessThan(click.end! + 1);
      for (const s of trace) if (s.parentId) expect(spans.has(s.parentId)).toBe(true);
    }
    // The declined card failed at payments and came back to the page as a 402.
    const declined = clicks.find((c) => c.attributes['http.status_code'] === 402)!;
    expect(session.spans.some((s) => s.traceId === declined.traceId && s.service === 'payments' && s.attributes['http.status_code'] === 402)).toBe(true);
  });

  it('opens each span where it ran: its start step is in its recording, at its time', () => {
    for (const s of session.spans.filter((x) => x.startStep !== undefined && x.recording !== 'browser').slice(0, 40)) {
      const at = stepAtTime(session, s.recording, s.start + 0.01);
      expect(at).toBeDefined();
      const t = timeOfStep(session, s.recording, at!.index)!;
      expect(Math.abs(t - s.start)).toBeLessThan(5);
    }
  });

  it('lists what each backend ran for each request, in order', () => {
    const points = requestPoints(session);
    expect(points.length).toBeGreaterThan(10);
    for (let i = 1; i < points.length; i++) expect(points[i].span.start).toBeGreaterThanOrEqual(points[i - 1].span.start);
    for (const p of points) {
      const offset = sessionIndex(session).recordings.get(p.span.recording)!.offsetMs;
      for (const step of p.steps) {
        expect(step.ms + offset).toBeGreaterThanOrEqual(p.span.start - 1e-6);
        expect(step.ms + offset).toBeLessThanOrEqual((p.span.end ?? p.span.start) + 1e-6);
      }
    }
    // The playhead in a request opens that request at the step it's on.
    const third = points[2];
    const offset = sessionIndex(session).recordings.get(third.span.recording)!.offsetMs;
    const at = pointAt(session, points, third.steps[1].ms + offset);
    expect(at.point).toBe(2);
    expect(at.step?.index).toBe(third.steps[1].index);
  });

  it('measures it as the inspector does', () => {
    const analytics = analyzeSession(session);
    for (const s of session.spans) expect(analytics.selfMs.get(s.id)!).toBeLessThanOrEqual((s.end ?? s.start) - s.start + 1e-9);
    const checkoutOp = analytics.operations.find((o) => o.service === 'gateway' && o.name === 'POST /checkout')!;
    expect(checkoutOp.count).toBe(6);
    expect(checkoutOp.p95).toBeGreaterThanOrEqual(checkoutOp.p50);
    expect(analytics.traces.filter((t) => t.services.includes('payments')).length).toBeGreaterThan(2);
    expect(analytics.clockIssues).toBe(0);
    for (const s of analytics.services) expect(s.busyMs).toBeGreaterThanOrEqual(0);
  });

  it('reads the code’s own calls from the steps, nested', () => {
    const calls = callSpans(session, service('payments').id);
    const byId = new Map(calls.map((c) => [c.id, c]));
    expect(calls.some((c) => c.name === 'fraudScore')).toBe(true);
    for (const c of calls) {
      expect(c.end).toBeGreaterThanOrEqual(c.start);
      if (c.parentId) {
        const parent = byId.get(c.parentId)!;
        expect(c.depth).toBe(parent.depth + 1);
        expect(c.start).toBeGreaterThanOrEqual(parent.start);
      }
    }
  });
});

describe('interval arithmetic', () => {
  it('counts overlap once', () => {
    expect(unionMs([{ start: 0, end: 10 }, { start: 5, end: 15 }, { start: 20, end: 25 }])).toBe(20);
    expect(unionMs([])).toBe(0);
  });
  it('takes nearest-rank percentiles', () => {
    expect(percentile([1, 2, 3, 4, 100], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4, 100], 0.95)).toBe(100);
  });
});

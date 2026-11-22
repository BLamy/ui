'use client';
import { useMemo } from 'react';
import { TraceTimeline } from '@/components/ui/trace-timeline';
import type { TraceAxis, TraceLane, TraceRequest, TraceStop } from '@/lib/trace-timeline-model';
import { cn } from '@/lib/utils';
import { requestPoints, sessionIndex, type ReplaySession } from './session';

/* ══ Every recording of a session on one timeline ══
   A lane per recording, on the shared clock: when its code ran (deeper stacks reach further down), its server spans as
   bars, failures in red and console messages as dots; for a page that recorded itself, when rrweb saw it change. Each
   request is drawn from where the page sent it to where the server answered, and the moments a backend ran code for a
   request are the timeline's stops, so a rail's card says which request you're on. */

export interface SessionTimelineProps {
  session: ReplaySession;
  value: number;
  onValueChange: (time: number, details: { reason: string }) => void;
  onValueCommit?: (time: number) => void;
  orientation?: 'horizontal' | 'vertical';
  /** The lane in focus: a recording's id. */
  focusedRecording?: string | null;
  onFocusedRecordingChange?: (recording: string) => void;
  gutter?: number;
  /** How times become positions (TraceTimeline's `axis`): `stopAxis` over steps scrubs line by line. */
  axis?: TraceAxis;
  className?: string;
}

const sorted = (values: Iterable<number>) => Float64Array.from(values).sort();

export function useSessionTimeline(session: ReplaySession) {
  return useMemo(() => {
    const { range, caches, spans } = sessionIndex(session);
    const lanes: TraceLane[] = session.recordings.map((r) => {
      const own = session.spans.filter((s) => s.recording === r.id);
      const lane: TraceLane = {
        key: r.id,
        title: r.service,
        offset: r.offsetMs,
        marks: [
          { key: 'spans', times: sorted(own.filter((s) => s.kind === 'server').map((s) => s.start - r.offsetMs)), shape: 'bar', tint: 'var(--chart-5)' },
          { key: 'errors', times: sorted(own.filter((s) => s.status === 'error').map((s) => s.start - r.offsetMs)), shape: 'bar', tone: 'destructive' },
          { key: 'console', times: sorted(session.logs.filter((l) => l.recording === r.id && l.time !== null).map((l) => l.time! - r.offsetMs)), shape: 'dot', tint: 'var(--primary)' },
        ],
      };
      const index = caches.get(r.id);
      if (index) lane.density = { label: 'JS', times: index.times, depths: Uint16Array.from(index.cache.steps, (s) => s.depth + 1) };
      const events = r.rrweb as Array<{ timestamp: number }> | undefined;
      if (events?.length) lane.density = { label: 'DOM', times: sorted(events.map((e) => e.timestamp - events[0].timestamp)) };
      return lane;
    });
    // A request: sent by a client span, answered by its server span.
    const requests: TraceRequest[] = session.spans
      .filter((s) => s.kind === 'client')
      .flatMap((client) => {
        const server = session.spans.find((s) => s.parentId === client.id && s.kind === 'server');
        if (!server) return [];
        return [{ id: client.id, time: client.start, from: server.start, to: server.end ?? server.start, tone: client.status === 'error' || server.status === 'error' ? 'destructive' as const : undefined }];
      });
    const points = requestPoints(session);
    const stops: Array<TraceStop<string>> = points.map((p, i) => {
      const status = p.span.attributes['http.status_code'];
      return {
        key: p.span.id,
        time: p.span.start,
        caption: `${i + 1}. ${p.span.service} · ${p.span.name}${status ? ` → ${status}` : ''}`,
        preview: `${p.steps.length} steps · ${Math.round(((p.span.end ?? p.span.start) - p.span.start) * 10) / 10} ms`,
        tone: p.span.status === 'error' ? 'destructive' : Number(status) >= 400 ? 'warning' : undefined,
        level: p.caller && spans.get(p.caller.id)?.recording === 'browser' ? 1 : 2,
      };
    });
    return { range, lanes, requests, stops, points };
  }, [session]);
}

const formatMs = (start: number) => (time: number) => {
  const ms = Math.max(0, time - start);
  return ms < 1000 ? `${ms.toFixed(ms < 10 ? 2 : 1)} ms` : `${(ms / 1000).toFixed(2)} s`;
};

export function SessionTimeline({
  session,
  value,
  onValueChange,
  onValueCommit,
  orientation = 'horizontal',
  focusedRecording,
  onFocusedRecordingChange,
  gutter = 84,
  axis,
  className,
}: SessionTimelineProps) {
  const { range, lanes, requests, stops } = useSessionTimeline(session);
  const format = useMemo(() => formatMs(range.start), [range.start]);
  return (
    <TraceTimeline
      aria-label="Session timeline"
      range={range}
      axis={axis}
      lanes={lanes}
      requests={orientation === 'horizontal' ? requests : undefined}
      stops={stops}
      stopsLabel="Requests"
      value={value}
      onValueChange={(time, details) => onValueChange(time, { reason: details.reason })}
      onValueCommit={onValueCommit ? (time) => onValueCommit(time) : undefined}
      focusedLane={focusedRecording ?? undefined}
      onFocusedLaneChange={onFocusedRecordingChange ? (lane) => onFocusedRecordingChange(lane) : undefined}
      formatTime={format}
      orientation={orientation}
      gutter={gutter}
      className={cn(orientation === 'vertical' ? 'inset-y-2' : 'shrink-0', className)}
    />
  );
}

'use client';
import { useMemo, useState } from 'react';
import { FlameChart } from '@/components/ui/flame-chart';
import { flameData, type FlameLane, type FlameSpanInput } from '@/lib/flame-chart-model';
import { callSpans, sessionIndex, type ReplaySession } from './session';

/* ══ A session's distributed trace, as a flame chart ══
   A lane per recording, each span under the span that caused it, joined across lanes where a call went from one service
   to another, red where it failed and outlined where it never finished: what a tracing product shows. Under each server
   span go the calls the code itself made while answering it, read from the recording's steps, which no tracer has. The
   playhead is the session's; double-click a span and the debugger opens its recording where it began. */

const TINTS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export function useSessionFlame(session: ReplaySession) {
  return useMemo(() => {
    const { range } = sessionIndex(session);
    const lanes: FlameLane[] = session.recordings.map((r, i) => ({ key: r.id, title: r.service, subtitle: r.runtime, tint: TINTS[i % TINTS.length] }));
    const tint = new Map(lanes.map((l) => [l.key, l.tint!]));
    const spans: FlameSpanInput[] = session.spans.map((s) => ({
      id: s.id,
      parent: s.parentId,
      lane: s.recording,
      name: s.name,
      start: s.start,
      end: s.end ?? range.end,
      color: tint.get(s.recording),
      error: s.status === 'error',
      pending: s.end === null,
      waiting: s.kind === 'client' || s.kind === 'producer',
    }));
    // The code's own calls, under the server span that was running when each outermost one began.
    for (const r of session.recordings) {
      if (!r.cache) continue;
      const servers = session.spans.filter((s) => s.recording === r.id && s.kind === 'server');
      for (const call of callSpans(session, r.id)) {
        let parent = call.parentId;
        if (!parent) {
          const around = servers.filter((s) => s.start <= call.start && (s.end ?? range.end) >= call.start).sort((a, b) => b.start - a.start)[0];
          if (!around) continue;
          parent = around.id;
        }
        spans.push({ id: call.id, parent, lane: r.id, name: `${call.name}()`, start: call.start, end: Math.max(call.end, call.start + 0.001), color: 'var(--tertiary-foreground)' });
      }
    }
    const data = flameData(lanes, spans);
    // Span index → what to open: a recording and a step.
    const steps = new Map<number, { recording: string; time: number }>();
    data.ids?.forEach((id, i) => {
      const span = session.spans.find((s) => s.id === id);
      steps.set(i, { recording: data.lanes[data.lane[i]].key, time: span?.start ?? data.start[i] });
    });
    return { data, range, steps };
  }, [session]);
}

export function SessionFlame({ session, time, onSeek, onOpen, className }: {
  session: ReplaySession;
  time: number;
  onSeek: (time: number) => void;
  /** A span was opened: show its recording at its start. */
  onOpen?: (recording: string, time: number) => void;
  className?: string;
}) {
  const { data, range, steps } = useSessionFlame(session);
  const [selected, setSelected] = useState(-1);
  return (
    <FlameChart
      aria-label="Distributed trace"
      data={data}
      range={range}
      value={time}
      onValueChange={(t) => onSeek(t)}
      selected={selected}
      onSelectedChange={(i) => {
        setSelected(i);
        const target = steps.get(i);
        if (target) onSeek(data.start[i]);
      }}
      onSpanActivate={(i) => {
        const target = steps.get(i);
        if (target) onOpen?.(target.recording, target.time);
      }}
      className={className}
      style={{ height: 300 }}
    />
  );
}

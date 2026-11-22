'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import { CachedClock, cachedConsoleRows, cachedSummary, createCachedHost } from './cache';
import { ReplayDebugger } from './debugger';
import { DebuggerModel } from './model';
import { sessionIndex, type ReplaySession } from './session';
import { SessionTimeline } from './session-timeline';
import type { DebuggerPartProps } from './styles';

/* ══ One debugger over every recording of a session ══
   A model for each replayed recording, each answering from its cache, and one playhead on the session's clock. The
   timeline across the top has a lane per recording: scrubbing it moves the recording in focus to that moment, and
   stepping in the debugger moves the playhead along with it. Press another lane, or pick a recording, and the
   debugger shows that one at the same moment: the browser when it sent a request, the server when it answered. */

/** A debugger model for each replayed recording of a session, made once. They hold no engine, so there's nothing to
 *  dispose of: a cached host is the JSON and nothing else (and React's strict mode would dispose of them before use). */
export function useSessionModels(session: ReplaySession) {
  const [models] = useState(() => {
    const made = new Map<string, DebuggerModel>();
    for (const r of session.recordings) {
      if (!r.cache) continue;
      const cache = r.cache;
      const model: DebuggerModel = new DebuggerModel(cache.sources[0]?.url ?? r.service, createCachedHost(cache, { onHit: (hit) => model.onEvent(hit) }), { now: () => 0 });
      model.host.restartPlayback = () => model.pauseAt(cache.steps[0]?.index ?? -1);
      model.ready(cachedSummary(cache), new CachedClock(cache));
      made.set(r.id, model);
    }
    return made;
  });
  return models;
}

export interface SessionDebuggerProps extends DebuggerPartProps {
  session: ReplaySession;
  /** What goes across the top. Default: the session's timeline. A flame chart of the session's spans fits too. */
  overview?: (props: { time: number; seek: (time: number) => void; focused: string; focus: (recording: string) => void }) => ReactNode;
  defaultTime?: number;
}

export function SessionDebugger({ session, overview, defaultTime, className, style }: SessionDebuggerProps) {
  const models = useSessionModels(session);
  const { recordings, range } = sessionIndex(session);
  const replayed = session.recordings.filter((r) => models.has(r.id));
  const [focused, setFocused] = useState(() => (session.spans.filter((s) => s.kind === 'server' && models.has(s.recording)).sort((a, b) => a.start - b.start)[1]?.recording ?? replayed[0]?.id ?? ''));
  // The first moment a backend ran code for a request, unless asked for another.
  const [time, setTime] = useState(() => defaultTime ?? session.spans.filter((s) => s.kind === 'server' && models.has(s.recording)).sort((a, b) => a.start - b.start)[1]?.start ?? range.start);
  const model = models.get(focused);
  const focusedCache = session.recordings.find((r) => r.id === focused)?.cache;
  const logged = useMemo(() => (focusedCache ? cachedConsoleRows(focusedCache) : []), [focusedCache]);
  const offset = recordings.get(focused)?.offsetMs ?? 0;

  // The model in focus shows the playhead's moment, in its own recording's ms.
  useEffect(() => {
    if (!model) return;
    const ms = time - offset;
    if (model.playheadMs === null || Math.abs(model.playheadMs - ms) > 1e-6) void model.show(ms, null);
    // Only when focus or the playhead change from outside: stepping below sets both to agree.
  }, [model, time, offset]);
  // Stepping in it moves the playhead.
  useEffect(() => {
    if (!model) return undefined;
    return model.subscribe(() => {
      if (model.playheadMs !== null) setTime((t) => (Math.abs(t - (model.playheadMs! + offset)) > 1e-6 ? model.playheadMs! + offset : t));
    });
  }, [model, offset]);

  const seek = (t: number) => setTime(t);
  const lanes = useMemo(() => replayed.map((r) => ({ id: r.id, label: r.service })), [replayed]);
  return (
    <div className={cn('session-debugger flex h-full min-h-0 w-full flex-col overflow-hidden bg-background', className)} data-slot="session-debugger" style={style}>
      <div className="shrink-0 border-b border-border">
        {overview ? overview({ time, seek, focused, focus: (r) => { if (models.has(r)) setFocused(r); } }) : (
          <SessionTimeline
            session={session}
            value={time}
            onValueChange={seek}
            focusedRecording={focused}
            onFocusedRecordingChange={(r) => models.has(r) && setFocused(r)}
          />
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
        <span className="text-caption text-muted-foreground">Debugging</span>
        <Segmented<string> aria-label="Recording" size="sm" value={focused} onValueChange={(v) => v && setFocused(v)}>
          {lanes.map((l) => <SegmentedItem key={l.id} value={l.id}>{l.label}</SegmentedItem>)}
        </Segmented>
      </div>
      <div className="min-h-0 flex-1">
        {model ? <ReplayDebugger key={focused} model={model} logged={logged} timeline={false} className="h-full" /> : null}
      </div>
    </div>
  );
}

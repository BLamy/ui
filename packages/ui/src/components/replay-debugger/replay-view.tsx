'use client';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { CachedClock, cachedConsoleRows, cachedSummary, createCachedHost, type ReplayCache } from './cache';
import { ReplayDebugger } from './debugger';
import { FullStackReplay } from './full-stack';
import { DebuggerModel } from './model';
import type { ReplaySession } from './session';
import { SessionDebugger } from './session-debugger';
import type { DebuggerPartProps } from './styles';

/* ══ A recording read once, in the view it calls for ══
   What a `.replay` file holds, as Replay's linker said it, shown with no engine: one recording (`bl-replay-cache/…`) in
   the debugger, or a session of several (`bl-replay-session/…`): with a page that recorded itself with rrweb, the page,
   the timeline and each request's code; without one, a debugger over every recording on one timeline. Docstream opens
   it for `{% embed url="checkout.replay" %}`. */

export type ReplayFileData = ReplayCache | ReplaySession;

export const isReplaySession = (data: ReplayFileData): data is ReplaySession => data.format.startsWith('bl-replay-session/');

/** One recording's cache in the debugger, starting at its first step (or `startAt`). */
export function CachedReplayDebugger({ cache, startAt, className, style }: DebuggerPartProps & { cache: ReplayCache; startAt?: number }) {
  const [model] = useState(() => {
    const made: DebuggerModel = new DebuggerModel(
      cache.sources[0]?.url ?? 'recording',
      createCachedHost(cache, { onHit: (hit) => made.onEvent(hit) }),
      { now: () => 0 },
    );
    made.host.restartPlayback = () => made.pauseAt(cache.steps[0]?.index ?? -1);
    return made;
  });
  const clock = useMemo(() => new CachedClock(cache), [cache]);
  const logged = useMemo(() => cachedConsoleRows(cache), [cache]);
  useEffect(() => {
    if (!model.map) model.ready(cachedSummary(cache), clock);
    const first = startAt ?? cache.steps[0]?.index ?? -1;
    void model.show(clock.timeOf(first) ?? 0, first);
  }, [model, clock, cache, startAt]);
  return <ReplayDebugger model={model} logged={logged} className={className} style={style} />;
}

export interface ReplayViewProps extends DebuggerPartProps {
  data: ReplayFileData;
  /** For a session: `auto` (default) shows the page and its requests when a recording has rrweb's events, and the
   *  debugger over every recording otherwise. */
  view?: 'auto' | 'requests' | 'debugger';
}

/** A `.replay` file's contents in the view that fits them. */
export function ReplayView({ data, view = 'auto', className, style }: ReplayViewProps) {
  if (!isReplaySession(data)) return <CachedReplayDebugger cache={data} className={className} style={style} />;
  const page = data.recordings.some((r) => r.rrweb?.length);
  if (view === 'requests' || (view === 'auto' && page)) return <FullStackReplay session={data} className={className} style={style} />;
  return <SessionDebugger session={data} className={cn('h-full', className)} style={style} />;
}

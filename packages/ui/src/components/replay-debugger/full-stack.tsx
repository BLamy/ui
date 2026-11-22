'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ReplayPreview, type ReplayPreviewHandle } from '@/components/ui/replay-preview';
import { stopAxis, type TraceStop } from '@/lib/trace-timeline-model';
import { cn } from '@/lib/utils';
import { RequestPoints } from './request-points';
import { requestPoints, sessionIndex, type ReplaySession } from './session';
import { SessionTimeline, useSessionTimeline } from './session-timeline';
import type { DebuggerPartProps } from './styles';

/* ══ A full-stack session, to scrub ══
   The page as rrweb saw it, the session's timeline under it, and beside them each request a backend answered, with its
   code at the step the playhead is on. One number, the playhead on the session's clock, drives all of it: the timeline
   sets it, the page seeks to it, and the request points open and step along with it.

   The timeline goes by steps: every step of every request gets the same share of it, so a request that took 3 ms out of
   five seconds still scrubs line by line. Under 640 px it's a phone: the page floats in a corner as a picture in
   picture you can drag to any other, the timeline is a rail on the edge, under your thumb, and the request points fill
   the rest. */

const COMPACT = 640;

type Corner = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';

/** The page, floating: drag it anywhere and it settles in the nearest corner. */
function PictureInPicture({ children, inset = 12, railWidth = 48 }: { children: React.ReactNode; inset?: number; railWidth?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [corner, setCorner] = useState<Corner>('top-end');
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = box.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, y: event.clientY, left: el.offsetLeft, top: el.offsetTop };
    setDrag({ x: el.offsetLeft, y: el.offsetTop });
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    setDrag({ x: start.current.left + event.clientX - start.current.x, y: start.current.top + event.clientY - start.current.y });
  };
  const onPointerUp = () => {
    const el = box.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (el && parent && drag) {
      const right = drag.x + el.offsetWidth / 2 > parent.clientWidth / 2;
      const bottom = drag.y + el.offsetHeight / 2 > parent.clientHeight / 2;
      setCorner(`${bottom ? 'bottom' : 'top'}-${right ? 'end' : 'start'}`);
    }
    start.current = null;
    setDrag(null);
  };
  const [vertical, side] = corner.split('-') as ['top' | 'bottom', 'start' | 'end'];
  return (
    <div
      ref={box}
      data-slot="picture-in-picture"
      data-corner={corner}
      className={cn(
        'absolute z-[90] w-[36%] max-w-56 touch-none overflow-hidden rounded-xl bg-card shadow-lg ring-1 ring-border',
        drag ? 'cursor-grabbing' : 'cursor-grab transition-[left,top,right,bottom] duration-300 ease-out',
      )}
      style={drag
        ? { left: drag.x, top: drag.y }
        : { [vertical]: inset, [side === 'end' ? 'right' : 'left']: side === 'end' ? inset + railWidth : inset }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="pointer-events-none">{children}</div>
      <div className="absolute inset-x-0 top-1 mx-auto h-1 w-8 rounded-full bg-foreground/25" aria-hidden />
    </div>
  );
}

export interface FullStackReplayProps extends DebuggerPartProps {
  session: ReplaySession;
  /** Where the playhead starts, on the session's clock. Default: the first request point. */
  defaultTime?: number;
  /** `steps` (default): each step of each request gets the same share of the timeline. `time`: plain time. */
  axis?: 'steps' | 'time';
}

export function FullStackReplay({ session, defaultTime, axis = 'steps', className, style }: FullStackReplayProps) {
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);
  const compact = width < COMPACT;

  const points = useMemo(() => requestPoints(session), [session]);
  const { range } = useSessionTimeline(session);
  const [time, setTime] = useState(() => defaultTime ?? points[0]?.span.start ?? sessionIndex(session).range.start);

  // Every step of every request, as the axis's landmarks: equal shares of the timeline, so scrubbing walks lines.
  const stepAxis = useMemo(() => {
    if (axis !== 'steps') return undefined;
    const { recordings } = sessionIndex(session);
    const times = new Set<number>();
    for (const p of points) {
      const offset = recordings.get(p.span.recording)?.offsetMs ?? 0;
      times.add(p.span.start);
      for (const s of p.steps) times.add(s.ms + offset);
      times.add(p.span.end ?? p.span.start);
    }
    const stops: Array<TraceStop<number>> = [...times].sort((a, b) => a - b).map((t, i) => ({ key: i, time: t }));
    return stopAxis(stops, range);
  }, [axis, session, points, range]);

  // The page follows the playhead, once a frame.
  const page = session.recordings.find((r) => r.rrweb?.length);
  const player = useRef<ReplayPreviewHandle | null>(null);
  const frame = useRef(0);
  useEffect(() => {
    if (!page) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => player.current?.seek(Math.max(0, time - page.offsetMs)));
  }, [time, page]);
  const replay = page ? (
    <ReplayPreview
      ref={player}
      events={page.rrweb as never}
      chrome="minimal"
      controls={false}
      fit="contain"
      mounted
      defaultTime={Math.max(0, time - page.offsetMs)}
      className="h-full w-full"
    />
  ) : null;

  const onValueChange = useCallback((t: number) => setTime(t), []);
  const timeline = (
    <SessionTimeline
      session={session}
      value={time}
      onValueChange={onValueChange}
      orientation={compact ? 'vertical' : 'horizontal'}
      axis={stepAxis}
    />
  );

  return (
    <div
      ref={root}
      className={cn('full-stack-replay relative flex h-full min-h-0 w-full overflow-hidden bg-background text-foreground', className)}
      data-slot="full-stack-replay"
      data-compact={compact ? '' : undefined}
      style={style}
    >
      {compact ? (
        <>
          <div className="h-full min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-24 pe-14">
            <div className="mb-2 px-1">
              <div className="text-headline font-semibold">{session.name}</div>
              <div className="text-caption text-muted-foreground">{session.recordings.map((r) => r.service).join(' · ')}</div>
            </div>
            <RequestPoints session={session} points={points} time={time} onSeek={setTime} />
          </div>
          {timeline}
          {replay ? <PictureInPicture><div className="aspect-[3/4]">{replay}</div></PictureInPicture> : null}
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-[1.1] flex-col border-e border-border">
            <div className="min-h-0 flex-1 p-4">
              <div className="h-full overflow-hidden rounded-xl ring-1 ring-border">{replay}</div>
            </div>
            <div className="border-t border-border">{timeline}</div>
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            <RequestPoints session={session} points={points} time={time} onSeek={setTime} />
          </div>
        </>
      )}
    </div>
  );
}

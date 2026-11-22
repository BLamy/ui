'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CodeEditor } from '@/components/ui/code-editor';
import {
  DisclosureGroup,
  DisclosureGroupHeader,
  DisclosureGroupItem,
  DisclosureGroupPanel,
  DisclosureGroupTrigger,
} from '@/components/ui/disclosure';
import { splitCodeLines } from '@/lib/code-editor-model';
import { cn } from '@/lib/utils';
import { bindingsAt, cacheIndex, type CachedStep } from './cache';
import { sessionIndex, type ReplaySession, type RequestPoint } from './session';

/* ══ What each backend did for each request ══
   A request point is a server span of a replayed recording: one per request a backend answered, in time order. Its row
   says what it was; open, it shows the code at the step the playhead is on, highlighted, with the call stack and the
   frame's variables there. As the playhead goes through a request the line moves step by step, and when it passes into
   the next request that one opens and this one closes, so scrubbing reads the whole path. */

/** Which point the playhead is in (or last passed), and its step there. */
export function pointAt(session: ReplaySession, points: readonly RequestPoint[], time: number): { point: number; step: CachedStep | null } {
  let point = -1;
  for (let i = 0; i < points.length; i++) {
    if (points[i].span.start <= time) point = i;
    else break;
  }
  if (point < 0) return { point: -1, step: null };
  const { steps, span } = points[point];
  const offset = sessionIndex(session).recordings.get(span.recording)?.offsetMs ?? 0;
  let step = steps[0];
  for (const s of steps) {
    if (s.ms + offset <= time) step = s;
    else break;
  }
  return { point, step };
}

const ms = (value: number) => `${Math.round(value * 10) / 10} ms`;
const clock = (start: number) => (time: number) => {
  const t = Math.max(0, time - start) / 1000;
  const m = Math.floor(t / 60);
  return `${String(m).padStart(2, '0')}:${(t - m * 60).toFixed(2).padStart(5, '0')}`;
};

function PointCode({ session, point, step }: { session: ReplaySession; point: RequestPoint; step: CachedStep }) {
  const cache = sessionIndex(session).recordings.get(point.span.recording)?.cache;
  const source = cache ? cacheIndex(cache).sources.get(step.location.sourceId) : undefined;
  const lines = useMemo(() => splitCodeLines(source?.contents ?? ''), [source]);
  const [stackOpen, setStackOpen] = useState(false);
  const values = bindingsAt(step, 8);
  if (!source) return null;
  return (
    <div className="flex flex-col" data-slot="request-point-code">
      <div className="flex items-center gap-2 border-y border-border bg-secondary/40 px-3 py-1.5 font-mono text-caption2">
        <span className="truncate text-foreground">{source.url}</span>
        <span className="ml-auto shrink-0 text-destructive tabular-nums">
          Paused at {step.location.line}:{(step.location.column ?? 0) + 1}
        </span>
      </div>
      <CodeEditor
        readOnly
        variant="plain"
        lines={lines}
        aria-label={source.url}
        currentLine={step.location.line}
        currentColumn={step.location.column}
        revealCurrentLine={{ smooth: true }}
        revealLine={step.location.line}
        className="h-56"
      />
      <div className="grid grid-cols-1 border-t border-border text-caption sm:grid-cols-2">
        <div className="min-w-0 border-border sm:border-e">
          <button
            type="button"
            className="flex w-full items-center gap-1.5 border-0 bg-transparent px-3 py-2 text-left text-caption text-muted-foreground shadow-none outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            aria-expanded={stackOpen}
            onClick={() => setStackOpen((open) => !open)}
          >
            <span className={cn('inline-block transition-transform', stackOpen && 'rotate-90')}>›</span>
            Call stack <span className="text-tertiary-foreground">· {step.stack.length}</span>
          </button>
          {stackOpen ? (
            <ol className="px-3 pb-2 font-mono text-caption2">
              {step.stack.map((frame, i) => (
                <li key={i} className={cn('flex justify-between gap-2 py-0.5', i === 0 ? 'text-foreground' : 'text-muted-foreground')}>
                  <span className="truncate">{frame.name}</span>
                  <span className="shrink-0 text-tertiary-foreground">{frame.location ? `${cacheIndex(cache!).sources.get(frame.location.sourceId)?.url ?? ''}:${frame.location.line}` : ''}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
        <div className="min-w-0 border-t border-border px-3 py-2 font-mono text-caption2 sm:border-t-0">
          <p className="mb-1 font-sans text-caption text-muted-foreground">Variables · {step.stack[0]?.name}</p>
          {values.length ? (
            <dl>
              {values.map((v) => (
                <div key={v.name} className="flex gap-2 py-0.5">
                  <dt className="shrink-0 text-muted-foreground">{v.name}</dt>
                  <dd className="truncate text-foreground">{v.text}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="text-muted-foreground">none here</p>}
        </div>
      </div>
    </div>
  );
}

export interface RequestPointsProps {
  session: ReplaySession;
  points: readonly RequestPoint[];
  /** The playhead, on the session's clock. */
  time: number;
  /** A row was pressed: go to the start of its request. */
  onSeek?: (time: number) => void;
  /** Keep the open point in view as the playhead moves it (the list scrolls). Default true. */
  follow?: boolean;
  className?: string;
}

export function RequestPoints({ session, points, time, onSeek, follow = true, className }: RequestPointsProps) {
  const { range } = sessionIndex(session);
  const format = useMemo(() => clock(range.start), [range.start]);
  const at = pointAt(session, points, time);
  const current = at.point >= 0 ? points[at.point].span.id : null;
  // The playhead opens the point it's in; a press opens another until the playhead moves on to a new one.
  const [open, setOpen] = useState<string[]>(current ? [current] : []);
  const [followed, setFollowed] = useState(current);
  if (current !== followed) {
    setFollowed(current);
    setOpen(current ? [current] : []);
  }
  const items = useRef(new Map<string, HTMLElement>());
  useEffect(() => {
    if (!follow || !current) return;
    // After the panels have started to move: the open one's header at the top of what's in view.
    const timer = setTimeout(() => items.current.get(current)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
    return () => clearTimeout(timer);
  }, [current, follow]);

  return (
    <div className={cn('flex flex-col gap-2', className)} data-slot="request-points">
      <div className="px-1 text-caption text-muted-foreground">{points.length} backend request points</div>
      <DisclosureGroup variant="inset" value={open} onValueChange={(next) => setOpen(next as string[])} className="min-w-0 px-0">
        {points.map((point, i) => {
          const { span } = point;
          const status = span.attributes['http.status_code'];
          const failed = span.status === 'error' || Number(status) >= 400;
          const who = span.attributes['enduser.id'];
          const isCurrent = span.id === current;
          const step = isCurrent && at.step ? at.step : point.steps[0];
          return (
            <DisclosureGroupItem
              key={span.id}
              value={span.id}
              ref={(el: HTMLElement | null) => {
                if (el) items.current.set(span.id, el);
                else items.current.delete(span.id);
              }}
              className={cn('min-w-0', isCurrent && 'bg-destructive/[0.035]')}
            >
              <DisclosureGroupHeader>
                <DisclosureGroupTrigger
                  className="w-full min-w-0 py-2.5"
                  onClick={() => onSeek?.(span.start)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className={cn('grid size-6 shrink-0 place-items-center rounded-md text-caption2 tabular-nums', isCurrent ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-callout font-medium text-foreground">
                        {span.attributes['code.function'] ? `${String(span.attributes['http.method'] ?? '')} ${String(span.attributes['code.function'])}()` : span.name}{status ? <span className={cn(failed ? 'text-destructive' : 'text-foreground')}> → {String(status)}</span> : null}
                      </span>
                      <span className="block truncate text-caption text-muted-foreground">
                        {span.service} handled {span.name}{who ? ` for ${who}` : ''} in {ms((span.end ?? span.start) - span.start)} · {point.steps.length} steps (trace {span.traceId.slice(0, 8)})
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-caption2 text-tertiary-foreground tabular-nums">{format(span.start)}</span>
                  </span>
                </DisclosureGroupTrigger>
              </DisclosureGroupHeader>
              <DisclosureGroupPanel>
                {open.includes(span.id) ? <PointCode session={session} point={point} step={step} /> : null}
              </DisclosureGroupPanel>
            </DisclosureGroupItem>
          );
        })}
      </DisclosureGroup>
    </div>
  );
}

'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  CART_SOURCE,
  createDemoHost,
  DemoClock,
  DEMO_SUMMARY,
} from './demo-host';
import {
  CachedReplayDebugger,
  DebuggerModel,
  FullStackReplay,
  ReplayDebugger,
  SessionDebugger,
  SessionFlame,
  type DebuggerPartProps,
  type DebuggerSummary,
  type ReplayCache,
  type ReplaySession,
  type StepClock,
} from '@/components/ui/replay-debugger';
import { SHOP_RECORDING } from './shop-recording';
import { loadSession, SESSION_URLS } from './sessions';
import { cn } from '@/lib/utils';
export { CART_SOURCE };
export interface ReplayDebuggerPageProps extends DebuggerPartProps {
  /** Which step it starts on. */
  startAt?: number;
  /** Render a completed empty index, without loading any source or pause data. */
  empty?: boolean;
  /** The docs viewer can select the empty-data example, or the real recording read from its cache. */
  variant?: string;
  /** Run on a recording read once into JSON (by an extractor that drives Replay's linker) instead of the hand-written table. */
  cache?: ReplayCache;
}
const Logged = [
  {
    id: 'total',
    level: 'log',
    time: 570,
    source: 'cart.js:20',
    message: 'total 18.8',
  },
];
const EmptySummary: DebuggerSummary = {
  runtime: 'demo',
  engineLabel: 'in-memory table',
  sources: [],
  consoleMessages: [],
  steps: 0,
  firstStep: -1,
  lastStep: -1,
  timeline: {},
};
const EmptyClock: StepClock = {
  positionAt: () => ({ step: -1, idle: null }),
  timeOf: () => undefined,
  approxTimeOf: () => undefined,
  whenReadyAt: () => null,
  ensureStep: () => null,
  isLoadedAt: () => true,
  callsFromStep: () => ({ from: 0, to: 0 }),
  stepForCall: () => -1,
};
/** A time travel debugger on a short program that's already run: step it in any direction, press a line's count for its
 *  executions, set a breakpoint or a logpoint, and ask what anything was. Everything comes through one interface,
 *  `DebuggerHost`, which a real replay engine can answer as easily as the table in this demo does. */
export default function ReplayDebuggerPage({
  empty = false,
  variant,
  ...props
}: ReplayDebuggerPageProps) {
  const showEmpty = empty || variant === 'empty';
  if (variant && variant in SESSIONS) return <SessionVariant key={variant} variant={variant as keyof typeof SESSIONS} {...props} />;
  const cached = props.cache ?? (variant === 'cached' ? SHOP_RECORDING : undefined);
  if (cached && !showEmpty) return <CachedReplayDebugger key={cached.recording.sha256} cache={cached} startAt={props.startAt} className={cn('replay-debugger-page', props.className)} style={props.style} />;
  return (
    <DemoDebugger
      key={showEmpty ? 'empty' : 'recorded'}
      {...props}
      empty={showEmpty}
    />
  );
}
function DemoDebugger({
  startAt = 0,
  empty = false,
  className,
  style,
}: ReplayDebuggerPageProps) {
  const [model] = useState(() => {
    const made: DebuggerModel = new DebuggerModel(
      'src/cart.js',
      createDemoHost(
        {
          onStep: () => undefined,
          status: (text) => console.info(text),
          onHit: (hit) => made.onEvent(hit),
        },
        { empty },
      ),
      { now: () => 0 },
    );
    if (!empty) made.host.restartPlayback = () => made.pauseAt(DEMO_SUMMARY.firstStep);
    return made;
  });
  const clock = useMemo(() => new DemoClock(), []);
  useEffect(() => {
    if (!model.map)
      model.ready(
        empty
          ? EmptySummary
          : { ...DEMO_SUMMARY, engineLabel: 'in-memory table' },
        empty ? EmptyClock : clock,
      );
    if (!empty) void model.show(clock.timeOf(startAt), startAt);
  }, [model, clock, startAt, empty]);
  return (
    <ReplayDebugger
      model={model}
      logged={empty ? [] : Logged}
      className={cn('replay-debugger-page', className)}
      style={style}
    />
  );
}

/* Recordings of a whole session, fetched as JSON when they're asked for. */
const SESSIONS = {
  'full-stack': SESSION_URLS.checkout,
  session: SESSION_URLS.checkout,
  tracing: SESSION_URLS.checkout,
  'front-and-back': SESSION_URLS.tanstack,
} as const;

function SessionVariant({ variant, className, style }: ReplayDebuggerPageProps & { variant: keyof typeof SESSIONS }) {
  const [session, setSession] = useState<ReplaySession | null>(null);
  useEffect(() => {
    let live = true;
    void loadSession(SESSIONS[variant]).then((loaded) => live && setSession(loaded));
    return () => {
      live = false;
    };
  }, [variant]);
  if (!session) return <div className={cn('grid h-full place-items-center text-caption text-muted-foreground', className)} style={style}>Loading the session…</div>;
  if (variant === 'full-stack') return <FullStackReplay session={session} className={className} style={style} />;
  if (variant === 'tracing')
    return (
      <SessionDebugger
        session={session}
        className={className}
        style={style}
        overview={({ time, seek, focus }) => (
          <SessionFlame session={session} time={time} onSeek={seek} onOpen={(recording, t) => { focus(recording); seek(t); }} />
        )}
      />
    );
  return <SessionDebugger session={session} className={className} style={style} />;
}

'use client';
import './replay-debugger.css';
import { useEffect, useMemo, useState } from 'react';
import {
  CART_SOURCE,
  createDemoHost,
  DemoClock,
  DEMO_SUMMARY,
} from './demo-host';
import { ReplayDebugger } from './debugger';
import { DebuggerModel } from './model';
import type { DebuggerSummary, StepClock } from './host';
import type { DebuggerPartProps } from './styles';
import { cn } from '@/lib/utils';
export { CART_SOURCE };
export interface ReplayDebuggerPageProps extends DebuggerPartProps {
  /** Which step it starts on. */
  startAt?: number;
  /** Render a completed empty index, without loading any source or pause data. */
  empty?: boolean;
  /** The docs viewer can select the empty-data example. */
  variant?: string;
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

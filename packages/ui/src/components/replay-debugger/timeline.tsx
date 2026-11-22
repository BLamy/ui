'use client';
import { useMemo } from 'react';
import { TraceTimeline } from '@/components/ui/trace-timeline';
import type { TraceLane, TraceRange, TraceStop } from '@/lib/trace-timeline-model';
import { cn } from '@/lib/utils';
import type { DebuggerSummary, StepClock } from './host';
import type { DebuggerModel } from './model';
import type { DebuggerPartProps } from './styles';
import { useModel } from './use-model';

/* ══ The whole recording, over the debugger ══
   A TraceTimeline strip on the model's clock: a row of when JS ran (deeper stacks reach further down), breakpoint and
   logpoint hits as bars and console messages as dots, from the marks the model publishes. Scrubbing it moves the model's
   playhead, as a host's own timeline does; stepping, continuing or picking a hit moves this one's. */

/** At most this many steps' times are asked of the clock when the summary doesn't list them. */
const SampledSteps = 20_000;

interface Steps {
  range: TraceRange;
  times: Float64Array;
  depths: Uint16Array | undefined;
}

/** When the steps ran: the summary's list, or a sample of steps' times from the clock. */
function stepsOf(summary: DebuggerSummary, map: StepClock): Steps | null {
  const listed = summary.timeline.times;
  let times: Float64Array;
  let depths: Uint16Array | undefined;
  if (listed?.length) {
    times = Float64Array.from(listed);
    depths = summary.timeline.depths?.length === listed.length ? Uint16Array.from(summary.timeline.depths, (d) => d + 1) : undefined;
  } else {
    const { firstStep, lastStep } = summary;
    if (firstStep < 0 || lastStep < firstStep) return null;
    const stride = Math.max(1, Math.ceil((lastStep - firstStep + 1) / SampledSteps));
    const sampled: number[] = [];
    for (let step = firstStep; step <= lastStep; step += stride) {
      const ms = map.approxTimeOf(step);
      if (ms !== undefined) sampled.push(ms);
    }
    times = Float64Array.from(sampled).sort();
  }
  if (!times.length) return null;
  const start = summary.window?.startMs ?? times[0];
  const end = summary.window?.endMs ?? times[times.length - 1];
  // A recording that's one instant still gets a strip to stand on.
  return { range: { start, end: end > start ? end : start + 1 }, times, depths };
}

const sorted = (times: readonly number[] | undefined) => Float64Array.from(times ?? []).sort();

/** A step's time, as the debugger's toolbar says it: ms from the recording's start. */
const formatMs = (start: number) => (time: number) => {
  const ms = time - start;
  return ms < 1000 ? `${ms.toFixed(ms < 10 ? 2 : 1)} ms` : `${(ms / 1000).toFixed(2)} s`;
};

export function DebuggerTimeline({
  model,
  compact = false,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
  /** No label gutter, for a narrow box. */
  compact?: boolean;
}) {
  const summary = useModel(model, (m) => m.summary);
  const map = useModel(model, (m) => m.map);
  const marks = useModel(model, (m) => m.timelineMarks);
  const playhead = useModel(model, (m) => m.playheadMs);
  const steps = useMemo(() => (summary && map ? stepsOf(summary, map) : null), [summary, map]);

  const lanes = useMemo<TraceLane[]>(() => {
    if (!steps) return [];
    return [{
      key: 'recording',
      density: { label: 'JS', times: steps.times, depths: steps.depths },
      marks: [
        { key: 'breakpoints', times: sorted(marks?.breakpoints), shape: 'bar', tone: 'warning' },
        { key: 'logpoints', times: sorted(marks?.logpoints), shape: 'bar', tint: 'var(--chart-5)' },
        { key: 'console', times: sorted(marks?.console), shape: 'dot', tint: 'var(--primary)' },
      ],
    }];
  }, [steps, marks]);

  // A simulated seed's actions are landmarks, with the failing one in red.
  const stops = useMemo<Array<TraceStop<string>>>(() => {
    if (!summary?.simulation || !map) return [];
    return summary.simulation.stops.flatMap((stop) => {
      const time = map.approxTimeOf(stop.step);
      return time === undefined ? [] : [{ key: `stop-${stop.index}`, time, caption: stop.label || stop.name, tone: stop.error ? 'destructive' : undefined }];
    });
  }, [summary, map]);
  const format = useMemo(() => formatMs(steps?.range.start ?? 0), [steps]);

  if (!steps) return null;
  return (
    <div
      className={cn('debugger-timeline shrink-0 border-b border-border', className)}
      data-slot="debugger-timeline"
      style={style}
    >
      <TraceTimeline
        aria-label="Recording timeline"
        range={steps.range}
        lanes={lanes}
        stops={stops.length ? stops : undefined}
        value={playhead ?? steps.range.start}
        onValueChange={(time, details) => model.setPlayhead(time, { scrubbing: details.reason === 'drag' })}
        onValueCommit={(time) => model.setPlayhead(time)}
        formatTime={format}
        gutter={compact ? 0 : 56}
      />
    </div>
  );
}

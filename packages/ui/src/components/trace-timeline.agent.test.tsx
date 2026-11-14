// @vitest-environment happy-dom
import { useState } from 'react';
import { cleanup } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TraceTimeline } from '@/components/ui/trace-timeline';
import type { TraceKey, TraceLane, TraceRange } from '@/lib/trace-timeline-model';
import { entry, expectNamed, mount, run } from '../../test/agent-harness';

/* TraceTimeline's primitive (lib/trace-timeline-primitive) driven only through the agent bridge: `setValue`, `setView`,
   `fit`, `focusLane`, `selectThread` and `selectRequest` reach the consumer with `source: 'agent'`. */

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
afterEach(cleanup);

const agent = createAgent();
const RANGE: TraceRange = { start: 0, end: 3_600_000 };
const LANES: TraceLane[] = [
  { key: 'a', title: 'A', threads: [{ id: 1, label: 'T1' }] },
  { key: 'b', title: 'B', threads: [{ id: 2, label: 'T2' }] },
];

describe('TraceTimeline is agent-ready', () => {
  it('seeks, zooms, fits and picks lanes, threads and requests through the bridge', async () => {
    const onViewChange = vi.fn();
    const onValueChange = vi.fn();
    const onFocusedLaneChange = vi.fn();
    const onSelectedThreadChange = vi.fn();
    const onSelectedRequestChange = vi.fn();
    function Host() {
      const [lane, setLane] = useState<string | null>('a');
      const [thread, setThread] = useState<TraceKey | null>(null);
      return (
        <TraceTimeline range={RANGE} lanes={LANES} label="Session" orientation="horizontal"
          onValueChange={onValueChange} onViewChange={onViewChange} onSelectedRequestChange={onSelectedRequestChange}
          focusedLane={lane} onFocusedLaneChange={(l, d) => { setLane(l); onFocusedLaneChange(l, d); }}
          selectedThread={thread} onSelectedThreadChange={(t, d) => { setThread(t); onSelectedThreadChange(t, d); }} />
      );
    }
    await mount(<Host />);
    expectNamed(agent.snapshot(), ['Session']);
    expect(entry(agent.snapshot(), 'Session')).toMatchObject({ component: 'trace-timeline' });

    await run(agent, [{ ref: 'Session', action: 'setValue', args: [60_000] }]);
    expect(onValueChange).toHaveBeenLastCalledWith(60_000, expect.objectContaining({ reason: 'imperative', source: 'agent' }));

    await run(agent, [{ ref: 'Session', action: 'setView', args: [{ start: 0, end: 600_000 }] }]);
    expect(onViewChange).toHaveBeenLastCalledWith({ start: 0, end: 600_000 }, expect.objectContaining({ reason: 'imperative', source: 'agent' }));

    await run(agent, [{ ref: 'Session', action: 'fit', args: [] }]);
    expect(onViewChange).toHaveBeenLastCalledWith(RANGE, expect.objectContaining({ source: 'agent' }));

    await run(agent, [{ ref: 'Session', action: 'focusLane', args: ['b'] }]);
    expect(onFocusedLaneChange).toHaveBeenLastCalledWith('b', expect.objectContaining({ reason: 'imperative', source: 'agent' }));

    // Without a lane, a thread is in the focused one.
    await run(agent, [{ ref: 'Session', action: 'selectThread', args: [2] }]);
    expect(onSelectedThreadChange).toHaveBeenLastCalledWith(2, expect.objectContaining({ source: 'agent', lane: 'b' }));

    await run(agent, [{ ref: 'Session', action: 'selectRequest', args: ['r1'] }]);
    expect(onSelectedRequestChange).toHaveBeenLastCalledWith('r1', expect.objectContaining({ source: 'agent' }));
  });
});

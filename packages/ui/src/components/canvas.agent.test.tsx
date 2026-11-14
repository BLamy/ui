// @vitest-environment happy-dom
import { cleanup } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Canvas } from '@/components/ui/canvas';
import { actOn, entry, expectNamed, mount, run } from '../../test/agent-harness';

/* Canvas's primitive (lib/canvas-primitive) driven only through the agent bridge: its actions `setViewport`, `panBy`,
   `zoomBy`, `zoomTo` and `fit` reach `onViewportChange` with reason `imperative` and `source: 'agent'`, and
   `details.cancel()` refuses them. */

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
afterEach(cleanup);

// One bridge per file: it has no destroy, and remembers components earlier tests removed as off the page.
const agent = createAgent();

describe('Canvas is agent-ready', () => {
  it('pans, zooms and fits through the bridge, as the agent', async () => {
    const onViewportChange = vi.fn();
    await mount(
      <Canvas aria-label="Board" defaultViewport={{ x: 0, y: 0, zoom: 1 }} fit={{ x: 0, y: 0, width: 400, height: 300 }} onViewportChange={onViewportChange}>
        <div>Item</div>
      </Canvas>,
    );
    expectNamed(agent.snapshot(), ['Board']);
    expect(entry(agent.snapshot(), 'Board')).toMatchObject({
      component: 'canvas',
      actions: expect.arrayContaining(['setViewport', 'panBy', 'zoomBy', 'zoomTo', 'fit']),
    });

    await run(agent, [{ ref: 'Board', action: 'zoomBy', args: [2] }]);
    let [viewport, details] = onViewportChange.mock.lastCall!;
    expect(viewport.zoom).toBeCloseTo(2);
    expect(details).toMatchObject({ reason: 'imperative', source: 'agent' });

    await run(agent, [{ ref: 'Board', action: 'panBy', args: [10, 20] }]);
    expect(onViewportChange.mock.lastCall![1]).toMatchObject({ reason: 'imperative', source: 'agent' });

    await run(agent, [{ ref: 'Board', action: 'setViewport', args: [{ x: 5, y: 6, zoom: 0.5 }] }]);
    [viewport] = onViewportChange.mock.lastCall!;
    expect(viewport).toMatchObject({ x: 5, y: 6, zoom: 0.5 });

    const calls = onViewportChange.mock.calls.length;
    await run(agent, [{ ref: 'Board', action: 'fit' }]);
    expect(onViewportChange.mock.calls.length).toBe(calls + 1);
    [, details] = onViewportChange.mock.lastCall!;
    expect(details).toMatchObject({ reason: 'imperative', source: 'agent' });
  });

  it('a step the app refuses with details.cancel() leaves the view as it was', async () => {
    const seen: number[] = [];
    await mount(
      <Canvas aria-label="Locked board" defaultViewport={{ x: 0, y: 0, zoom: 1 }} onViewportChange={(next, details) => { seen.push(next.zoom); if (details.source === 'agent') details.cancel(); }}>
        <div>Item</div>
      </Canvas>,
    );
    const refused = await actOn(agent, [{ ref: 'Locked board', action: 'zoomTo', args: [3] }]);
    expect(refused.steps[0]!.result).toBe(false);
    expect(seen).toEqual([3]);
    // Still at 1: the next zoom by 2 asks for 2, not 6.
    await actOn(agent, [{ ref: 'Locked board', action: 'zoomBy', args: [2] }]);
    expect(seen.at(-1)).toBeCloseTo(2);
  });
});

// @vitest-environment happy-dom
import { useState } from 'react';
import { cleanup } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlameChart } from '@/components/ui/flame-chart';
import { flameData } from '@/lib/flame-chart-model';
import { entry, expectNamed, mount, run } from '../../test/agent-harness';

/* FlameChart's primitive (lib/flame-chart-primitive) driven only through the agent bridge: `setValue`, `setView`,
   `fit`, `select`, `activate`, `toggleLane` and `setCollapsedLanes` reach the consumer with `source: 'agent'`. */

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
afterEach(cleanup);

const agent = createAgent();
const DATA = flameData([{ key: 'web', title: 'web' }, { key: 'api', title: 'api' }], [
  { id: 'a', lane: 'web', name: 'GET /', start: 0, end: 100 },
  { id: 'b', parent: 'a', lane: 'api', name: 'POST /cart', start: 10, end: 60 },
]);

describe('FlameChart is agent-ready', () => {
  it('seeks, zooms, fits, selects, opens spans and collapses lanes through the bridge', async () => {
    const onValueChange = vi.fn();
    const onViewChange = vi.fn();
    const onSelectedChange = vi.fn();
    const onSpanActivate = vi.fn();
    const onCollapsedLanesChange = vi.fn();
    function Host() {
      const [selected, setSelected] = useState(-1);
      return (
        <FlameChart data={DATA} aria-label="Trace" onValueChange={onValueChange} onViewChange={onViewChange} onSpanActivate={onSpanActivate}
          onCollapsedLanesChange={onCollapsedLanesChange}
          selected={selected} onSelectedChange={(i, d) => { setSelected(i); onSelectedChange(i, d); }} />
      );
    }
    await mount(<Host />);
    expectNamed(agent.snapshot(), ['Trace']);
    expect(entry(agent.snapshot(), 'Trace')).toMatchObject({ component: 'flame-chart' });

    await run(agent, [{ ref: 'Trace', action: 'setValue', args: [42] }]);
    expect(onValueChange).toHaveBeenLastCalledWith(42, expect.objectContaining({ reason: 'imperative', source: 'agent' }));

    await run(agent, [{ ref: 'Trace', action: 'setView', args: [{ start: 10, end: 20 }] }]);
    expect(onViewChange).toHaveBeenLastCalledWith({ start: 10, end: 20 }, expect.objectContaining({ reason: 'imperative', source: 'agent' }));

    await run(agent, [{ ref: 'Trace', action: 'fit', args: [] }]);
    expect(onViewChange).toHaveBeenLastCalledWith({ start: 0, end: 100 }, expect.objectContaining({ source: 'agent' }));

    await run(agent, [{ ref: 'Trace', action: 'select', args: [1] }]);
    expect(onSelectedChange).toHaveBeenLastCalledWith(1, expect.objectContaining({ reason: 'imperative', source: 'agent' }));

    await run(agent, [{ ref: 'Trace', action: 'activate', args: [1] }]);
    expect(onSpanActivate).toHaveBeenLastCalledWith(1, expect.objectContaining({ reason: 'imperative', source: 'agent' }));

    await run(agent, [{ ref: 'Trace', action: 'toggleLane', args: ['api'] }]);
    expect(onCollapsedLanesChange).toHaveBeenLastCalledWith(['api'], expect.objectContaining({ source: 'agent' }));

    await run(agent, [{ ref: 'Trace', action: 'setCollapsedLanes', args: [['web', 'api']] }]);
    expect(onCollapsedLanesChange).toHaveBeenLastCalledWith(['web', 'api'], expect.objectContaining({ source: 'agent' }));
  });
});

// @vitest-environment happy-dom
import { useState } from 'react';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterBar } from '@/components/ui/filter';
import { FontStackPicker } from '@/components/ui/font-picker';
import type { Filter, FilterField } from '@/lib/filter-model';
import { GOOGLE_FONTS } from '@/lib/google-fonts';
import { entry, expectNamed, mount, run, settle } from '../../test/agent-harness';

/* The kit's own primitives behind the pickers, driven only through the agent bridge: FilterBar's value list
   (lib/option-search-primitive: `toggle`, `search`) and FontStackPicker's chips (lib/font-stack-primitive: `move`,
   `remove`). Their changes reach the consumer with `source: 'agent'`. */

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 400 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// One bridge per file: it has no destroy, and remembers components earlier tests removed as off the page.
const agent = createAgent();

const fields: FilterField[] = [
  { id: 'status', label: 'Status', kind: 'select', options: [
    { value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }, { value: 'wip', label: 'In progress', keywords: ['doing'] },
  ] },
];

function Bar({ onValueChange }: { onValueChange: (filters: Filter[], details: { reason: string; source: string }) => void }) {
  const [filters, setFilters] = useState<Filter[]>([{ id: 'f1', field: 'status', operator: 'is', value: ['open'] }]);
  return <FilterBar fields={fields} value={filters} onValueChange={(next, details) => { setFilters(next); onValueChange(next, details); }} />;
}

describe("FilterBar's value list is agent-ready", () => {
  it('ticks and searches options through the bridge, and the filter follows', async () => {
    const onValueChange = vi.fn();
    await mount(<Bar onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Status value: Open' }));
    await settle(30);
    const snapshot = agent.snapshot();
    expectNamed(snapshot, ['Search status']);
    expect(entry(snapshot, 'Search status')).toMatchObject({ component: 'option-search', actions: ['toggle', 'search'], value: ['open'] });

    await run(agent, [{ ref: 'Search status', action: 'toggle', args: ['done'] }]);
    expect(onValueChange).toHaveBeenLastCalledWith(
      [expect.objectContaining({ operator: 'is_any_of', value: ['open', 'done'] })],
      expect.objectContaining({ reason: 'update', source: 'agent' }),
    );
    expect(entry(agent.snapshot(), 'Search status').value).toEqual(['open', 'done']);

    // The search filters the rows, by keyword too.
    await run(agent, [{ ref: 'Search status', action: 'search', args: ['doing'] }]);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['In progress']);
    await run(agent, [{ ref: 'Search status', action: 'toggle', args: ['open'] }]);
    expect(onValueChange).toHaveBeenLastCalledWith([expect.objectContaining({ value: ['done'] })], expect.objectContaining({ source: 'agent' }));
  });
});

describe("FontStackPicker's chips are agent-ready", () => {
  const fonts = GOOGLE_FONTS.filter((f) => ['Inter', 'Lobster', 'Merriweather'].includes(f.family));

  it('moves and removes families through the bridge', async () => {
    const onValueChange = vi.fn();
    await mount(<FontStackPicker aria-label="Heading fonts" defaultValue={['Inter', 'Lobster', 'Merriweather']} onValueChange={onValueChange} fonts={fonts} />);
    const snapshot = agent.snapshot();
    expectNamed(snapshot, ['Heading fonts']);
    expect(entry(snapshot, 'Heading fonts')).toMatchObject({ component: 'font-stack-list', value: ['Inter', 'Lobster', 'Merriweather'] });

    await run(agent, [{ ref: 'Heading fonts', action: 'move', args: ['Merriweather', 0] }]);
    expect(onValueChange).toHaveBeenLastCalledWith(['Merriweather', 'Inter', 'Lobster'], expect.objectContaining({ source: 'agent' }));
    expect(entry(agent.snapshot(), 'Heading fonts').value).toEqual(['Merriweather', 'Inter', 'Lobster']);

    await run(agent, [{ ref: 'Heading fonts', action: 'remove', args: ['Inter'] }]);
    expect(onValueChange).toHaveBeenLastCalledWith(['Merriweather', 'Lobster'], expect.objectContaining({ source: 'agent' }));
    expect(screen.queryByRole('button', { name: 'Move Inter' })).toBeNull();
  });
});

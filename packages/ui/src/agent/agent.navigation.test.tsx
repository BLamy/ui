// @vitest-environment happy-dom
import { cleanup, screen } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DisclosureGroup, DisclosureGroupHeader, DisclosureGroupItem, DisclosureGroupPanel, DisclosureGroupTrigger } from '@/components/ui/disclosure';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { Tree, type TreeNode } from '@/components/ui/tree';
import { entry, expectNamed, mount, run } from '../../test/agent-harness';

afterEach(cleanup);

// One bridge per file: it has no destroy, and remembers components earlier tests removed as off the page.
const agent = createAgent();

type Details = { source?: string };
const spy = () => vi.fn<(value: any, details: Details) => void>();

describe('Tabs are agent-ready', () => {
  it('lists the tabs as choices and switches the panel', async () => {
    const onValueChange = spy();
    await mount(
      <Tabs defaultValue="plan" onValueChange={onValueChange}>
        <TabsList aria-label="Week">
          <TabsTab value="plan">Plan</TabsTab>
          <TabsTab value="build">Build</TabsTab>
          <TabsTab value="review">Review</TabsTab>
        </TabsList>
        <TabsPanel value="plan">Pick the weekly goals.</TabsPanel>
        <TabsPanel value="build">Heads down.</TabsPanel>
        <TabsPanel value="review">What shipped.</TabsPanel>
      </Tabs>,
    );
    const snapshot = agent.snapshot();
    expectNamed(snapshot, ['Week']);
    expect(entry(snapshot, 'Week')).toMatchObject({
      component: 'tabs',
      value: 'plan',
      items: [{ value: 'plan', label: 'Plan' }, { value: 'build', label: 'Build' }, { value: 'review', label: 'Review' }],
    });
    await run(agent, [{ ref: 'Week', action: 'setValue', args: ['Review'] }]);
    expect(screen.getByRole('tab', { name: 'Review' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toBe('What shipped.');
    expect(onValueChange).toHaveBeenLastCalledWith('review', expect.objectContaining({ source: 'agent' }));
  });
});

describe('Disclosure is agent-ready', () => {
  it('opens and closes sections by name', async () => {
    const onValueChange = spy();
    await mount(
      <DisclosureGroup aria-label="Settings sections" multiple defaultValue={['privacy']} onValueChange={onValueChange}>
        {['Privacy', 'Storage', 'Notifications'].map((title) => (
          <DisclosureGroupItem key={title} value={title.toLowerCase()}>
            <DisclosureGroupHeader><DisclosureGroupTrigger>{title}</DisclosureGroupTrigger></DisclosureGroupHeader>
            <DisclosureGroupPanel>{title} settings</DisclosureGroupPanel>
          </DisclosureGroupItem>
        ))}
      </DisclosureGroup>,
    );
    const snapshot = agent.snapshot();
    expectNamed(snapshot, ['Settings sections']);
    expect(entry(snapshot, 'Settings sections')).toMatchObject({ component: 'accordion', value: ['privacy'], multiple: true });
    expect(entry(snapshot, 'Settings sections').actions).toEqual(expect.arrayContaining(['open', 'close', 'setValue']));

    await run(agent, [
      { ref: 'Settings sections', action: 'open', args: ['storage'] },
      { ref: 'Settings sections', action: 'close', args: ['privacy'] },
    ]);
    expect(screen.getByRole('button', { name: 'Storage' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Privacy' }).getAttribute('aria-expanded')).toBe('false');
    expect(onValueChange).toHaveBeenLastCalledWith(['storage'], expect.objectContaining({ source: 'agent' }));
  });
});

describe('Tree is agent-ready', () => {
  const MAIL: TreeNode[] = [
    { value: 'icloud', label: 'iCloud', children: [{ value: 'inbox', label: 'Inbox' }, { value: 'drafts', label: 'Drafts' }] },
    { value: 'trash', label: 'Trash' },
  ];

  it('lists its rows, closed branches included, and selects and expands by label', async () => {
    const onValueChange = spy();
    const onExpandedChange = spy();
    await mount(<Tree aria-label="Mailboxes" items={MAIL} onValueChange={onValueChange} onExpandedChange={onExpandedChange} />);
    const tree = entry(agent.snapshot(), 'Mailboxes');
    expect(tree).toMatchObject({ component: 'tree', value: null, expanded: [] });
    // The snapshot lists the rows on screen; query reaches into closed branches.
    expect(tree.items).toEqual([{ value: 'icloud', label: 'iCloud' }, { value: 'trash', label: 'Trash' }]);
    const found = await agent.query({ within: 'Mailboxes', text: 'Drafts' });
    expect(Array.isArray(found), JSON.stringify(found)).toBe(true);
    expect((found as any[])[0].items).toEqual([{ value: 'drafts', label: 'Drafts' }]);

    await run(agent, [
      { ref: 'Mailboxes', action: 'expand', args: ['icloud'] },
      { ref: 'Mailboxes', action: 'setValue', args: ['Drafts'] },
    ]);
    expect(screen.getByRole('treeitem', { name: /Drafts/ }).getAttribute('aria-selected')).toBe('true');
    expect(onValueChange).toHaveBeenLastCalledWith('drafts', expect.objectContaining({ source: 'agent' }));
    expect(onExpandedChange).toHaveBeenLastCalledWith(['icloud'], expect.objectContaining({ source: 'agent' }));
  });

  // With `onRename`, Tree adds its rename primitive (lib/inline-edit-primitive: start/rename/cancel), under the tree's
  // own name: a step finds the one of the two that takes its action.
  it('leaves no unnamed entry in the snapshot', async () => {
    await mount(<Tree aria-label="Mailboxes" items={MAIL} />);
    expectNamed(agent.snapshot(), ['Mailboxes']);
    cleanup();
    await mount(<Tree aria-label="Mailboxes" items={MAIL} onRename={() => {}} />);
    expectNamed(agent.snapshot(), ['Mailboxes', 'Mailboxes']);
  });
});

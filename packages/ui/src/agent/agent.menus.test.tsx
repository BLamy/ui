// @vitest-environment happy-dom
import { cleanup, screen } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, buttonVariants } from '@/components/ui/button';
import { Combobox, ComboboxContent, ComboboxInput } from '@/components/ui/combobox';
import { CommandMenu, CommandMenuInput, CommandMenuItem, CommandMenuList } from '@/components/ui/command-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectTrigger } from '@/components/ui/select';
import { entry, expectNamed, mount, onPage, run } from '../../test/agent-harness';

afterEach(cleanup);

// One bridge per file: it has no destroy, and remembers components earlier tests removed as off the page.
const agent = createAgent();

const repeats = [
  { value: 'never', label: 'Never' },
  { value: 'day', label: 'Every day' },
  { value: 'week', label: 'Every week' },
];
const people = [
  { value: 'ana', label: 'Ana Torres' },
  { value: 'kim', label: 'Kim Park' },
  { value: 'lee', label: 'Lee Chen' },
];

type Details = { source?: string };
const spy = () => vi.fn<(value: any, details: Details) => void>();

describe('Select and Combobox are agent-ready', () => {
  function Form({ onRepeat, onAssignee }: { onRepeat: (v: any, d: Details) => void; onAssignee: (v: any, d: Details) => void }) {
    return (
      <div className="grid gap-4">
        <Field>
          <FieldLabel>Repeat</FieldLabel>
          <Select items={repeats} defaultValue="never" onValueChange={onRepeat}>
            <SelectTrigger />
            <SelectContent />
          </Select>
        </Field>
        <Field>
          <FieldLabel>Assignee</FieldLabel>
          <Combobox items={people} onValueChange={onAssignee}>
            <ComboboxInput placeholder="Search the team" />
            <ComboboxContent />
          </Combobox>
        </Field>
      </div>
    );
  }

  it('lists both with their names, values and choices while closed', async () => {
    await mount(<Form onRepeat={spy()} onAssignee={spy()} />);
    const snapshot = agent.snapshot();
    expectNamed(snapshot, ['Repeat', 'Assignee']);
    expect(entry(snapshot, 'Repeat')).toMatchObject({ component: 'select', open: false, value: 'never', items: repeats });
    expect(entry(snapshot, 'Assignee')).toMatchObject({ component: 'combobox', value: null, items: people });
  });

  it('chooses an option by its label, and reports the agent', async () => {
    const onRepeat = spy();
    const onAssignee = spy();
    await mount(<Form onRepeat={onRepeat} onAssignee={onAssignee} />);
    await run(agent, [
      { ref: 'Repeat', action: 'setValue', args: ['Every week'] },
      { ref: 'Assignee', action: 'setValue', args: ['Kim Park'] },
    ]);
    expect(onRepeat).toHaveBeenLastCalledWith('week', expect.objectContaining({ source: 'agent' }));
    expect(onAssignee).toHaveBeenLastCalledWith('kim', expect.objectContaining({ source: 'agent' }));
    expect(document.querySelector('[data-slot=select-trigger]')?.textContent).toContain('Every week');
    expect((screen.getByRole('combobox', { name: 'Assignee' }) as HTMLInputElement).value).toBe('Kim Park');
    const snapshot = agent.snapshot();
    expect(entry(snapshot, 'Repeat').value).toBe('week');
    expect(entry(snapshot, 'Assignee').value).toBe('kim');
  });

  it('finds a choice with query, without opening the list', async () => {
    await mount(<Form onRepeat={spy()} onAssignee={spy()} />);
    const found = await agent.query({ within: 'Assignee', text: 'Lee' });
    expect(Array.isArray(found), JSON.stringify(found)).toBe(true);
    expect((found as any[])[0].items).toEqual([{ value: 'lee', label: 'Lee Chen' }]);
  });
});

describe('DropdownMenu is agent-ready', () => {
  function Photo({ onAction, onOpenChange }: { onAction: (v: string) => void; onOpenChange: (open: boolean, d: Details) => void }) {
    return (
      <DropdownMenu onAction={onAction} onOpenChange={(o, d) => onOpenChange(o, d)}>
        <DropdownMenuTrigger className={buttonVariants({ variant: 'secondary' })} aria-label="Photo actions">…</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem value="copy">Copy</DropdownMenuItem>
          <DropdownMenuItem value="share">Share</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  it('runs an item through the menu, opening it the way a person would', async () => {
    const onAction = vi.fn();
    const onOpenChange = spy();
    await mount(<Photo onAction={onAction} onOpenChange={onOpenChange} />);
    // The trigger's own Button is listed too (see the it.fails below), so address the menu by its ref.
    const menu = onPage(agent.snapshot()).find((e) => e.component === 'menu' && e.label === 'Photo actions');
    expect(menu).toMatchObject({ open: false });
    expect(menu?.actions).toContain('press');
    await run(agent, [{ ref: menu!.ref, action: 'press', args: ['Share'] }]);
    expect(onAction).toHaveBeenCalledWith('share', expect.anything());
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ source: 'agent' }));
  });

  // A trigger rendered as our Button registers twice (a `button` and the `menu`, same label), so a step by name is ambiguous.
  it('runs an item by the menu trigger’s name', async () => {
    const onAction = vi.fn();
    await mount(<Photo onAction={onAction} onOpenChange={spy()} />);
    await run(agent, [{ ref: 'Photo actions', action: 'press', args: ['Share'] }]);
    expect(onAction).toHaveBeenCalledWith('share', expect.anything());
  });
});

describe('CommandMenu is agent-ready', () => {
  function Palette({ onAction }: { onAction: (v: string) => void }) {
    return (
      <CommandMenu aria-label="Commands" onAction={onAction}>
        <CommandMenuInput placeholder="Search pages…" />
        <CommandMenuList>
          <CommandMenuItem title="Introduction" />
          <CommandMenuItem title="Theming" />
          <CommandMenuItem title="Motion" />
        </CommandMenuList>
      </CommandMenu>
    );
  }

  it('lists its commands, and filters them with setQuery', async () => {
    await mount(<Palette onAction={vi.fn()} />);
    const snapshot = agent.snapshot();
    expectNamed(snapshot, ['Commands']);
    expect(entry(snapshot, 'Commands')).toMatchObject({
      component: 'command',
      items: [{ value: 'Introduction', label: 'Introduction' }, { value: 'Theming', label: 'Theming' }, { value: 'Motion', label: 'Motion' }],
    });
    await run(agent, [{ ref: 'Commands', action: 'setQuery', args: ['them'] }]);
    expect(entry(agent.snapshot(), 'Commands').query).toBe('them');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Theming']);
  });

  // The command primitive offers setValue/setQuery/setPages only: setValue highlights, and nothing runs a command.
  it.fails('runs a command', async () => {
    const onAction = vi.fn();
    await mount(<Palette onAction={onAction} />);
    const result = await agent.act({ steps: [{ ref: 'Commands', action: 'press', args: ['Theming'] }] });
    if (!result.ok) await agent.act({ steps: [{ ref: 'Commands', action: 'run', args: ['Theming'] }] });
    expect(onAction).toHaveBeenCalledWith('Theming', expect.anything());
  });
});

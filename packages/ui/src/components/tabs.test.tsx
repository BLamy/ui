// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  Tabs, TabsAction, TabsBar, TabsFooter, TabsIndicator, TabsList, TabsPanel, TabsPanels, TabsPill, TabsSeparator, TabsTab,
  createTabsController, useTabs, useTabsTab, type TabsProps,
} from '@/components/ui/tabs';
import { setChromeHidden } from '@/lib/theme';
import { SizeClassProvider } from '@/lib/container';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(() => { cleanup(); setChromeHidden(false); });
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const key = (k: string) => fireEvent.keyDown(document.activeElement!, { key: k });
/** Enter or Space on a native button, as a browser delivers it: the key, then the click it activates. */
const activate = (k: 'Enter' | ' ') => {
  const el = document.activeElement!;
  if (!fireEvent.keyDown(el, { key: k })) return;
  if (k === ' ' && !fireEvent.keyUp(el, { key: k })) return;
  fireEvent.click(el, { detail: 0 });
};
const tab = (name: string) => screen.getByRole('tab', { name });
const slot = (name: string) => document.querySelector(`[data-slot=${name}]`) as HTMLElement;

type Section = 'account' | 'privacy' | 'billing';

function Settings(props: TabsProps<Section>) {
  return (
    <Tabs<Section> {...props}>
      <TabsList aria-label="Settings">
        <TabsTab value="account">Account</TabsTab>
        <TabsTab value="privacy">Privacy</TabsTab>
        <TabsTab value="billing" disabled>Billing</TabsTab>
      </TabsList>
      <TabsPanel value="account">Name and email.</TabsPanel>
      <TabsPanel value="privacy" keepMounted>Who can see you.</TabsPanel>
      <TabsPanel value="billing">Plan and invoices.</TabsPanel>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('is a named tablist whose first tab is selected, with its panel wired both ways', async () => {
    render(<Settings />);
    await settle();
    expect(screen.getByRole('tablist', { name: 'Settings' })).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    const account = tab('Account');
    expect(account.getAttribute('aria-selected')).toBe('true');
    expect(account.tabIndex).toBe(0);
    expect(tab('Privacy').tabIndex).toBe(-1);
    const panel = screen.getByRole('tabpanel');
    expect(panel.textContent).toBe('Name and email.');
    expect(account.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(account.id);
  });

  it('a tab is UI SDK\'s button, and a div when rendered as one', async () => {
    render(<Settings />);
    await settle();
    const account = tab('Account');
    expect(account.tagName).toBe('BUTTON');
    expect(account.getAttribute('type')).toBe('button');
    cleanup();
    render(
      <Tabs>
        <TabsList aria-label="Letters"><TabsTab value="a" render={<div />}>A</TabsTab></TabsList>
      </Tabs>,
    );
    await settle();
    expect(tab('A').tagName).toBe('DIV');
    expect(tab('A').hasAttribute('type')).toBe(false);
  });

  it('arrow keys move and select, wrapping past the ends, and say why', async () => {
    const onValueChange = vi.fn();
    render(<Settings defaultValue="account" onValueChange={onValueChange} />);
    await settle();
    act(() => tab('Account').focus());
    key('ArrowRight');
    await settle();
    expect(document.activeElement).toBe(tab('Privacy'));
    expect(tab('Privacy').getAttribute('aria-selected')).toBe('true');
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe('privacy');
    expect(onValueChange.mock.calls[0][1].reason).toBe('list-navigation');
    key('Home');
    await settle();
    expect(tab('Account').getAttribute('aria-selected')).toBe('true');
    key('ArrowLeft');
    await settle();
    // The disabled tab takes focus, so it can be found, and leaves the selection alone.
    expect(document.activeElement).toBe(tab('Billing'));
    expect(tab('Account').getAttribute('aria-selected')).toBe('true');
  });

  it('a press selects with the reason item-press, and a disabled tab ignores it', async () => {
    const onValueChange = vi.fn();
    render(<Settings onValueChange={onValueChange} />);
    await settle();
    fireEvent.click(tab('Privacy'));
    await settle();
    expect(onValueChange).toHaveBeenLastCalledWith('privacy', expect.objectContaining({ reason: 'item-press' }));
    expect(tab('Billing').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(tab('Billing'));
    await settle();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(tab('Privacy').getAttribute('aria-selected')).toBe('true');
  });

  it('with manual activation arrows only move focus, and Enter or Space selects', async () => {
    render(<Settings activation="manual" />);
    await settle();
    act(() => tab('Account').focus());
    key('ArrowRight');
    await settle();
    expect(document.activeElement).toBe(tab('Privacy'));
    expect(tab('Account').getAttribute('aria-selected')).toBe('true');
    activate('Enter');
    await settle();
    expect(tab('Privacy').getAttribute('aria-selected')).toBe('true');
    key('Home');
    activate(' ');
    await settle();
    expect(tab('Account').getAttribute('aria-selected')).toBe('true');
  });

  it('a change can be canceled', async () => {
    render(<Settings onValueChange={(_, details) => details.cancel()} />);
    await settle();
    fireEvent.click(tab('Privacy'));
    await settle();
    expect(tab('Account').getAttribute('aria-selected')).toBe('true');
  });

  it('unmounts the panels that are not selected, and hides the ones kept mounted', async () => {
    render(<Settings />);
    await settle();
    expect(screen.queryByText('Plan and invoices.')).toBeNull();
    const kept = screen.getByText('Who can see you.');
    expect(kept.hasAttribute('hidden')).toBe(true);
    fireEvent.click(tab('Privacy'));
    await settle();
    expect(kept.hasAttribute('hidden')).toBe(false);
    expect(kept.hasAttribute('data-selected')).toBe(true);
    expect(screen.queryByText('Name and email.')).toBeNull();
  });

  it('draws one indicator in the list, for either variant', async () => {
    const { container, rerender } = render(<Settings />);
    await settle();
    const indicators = () => container.querySelectorAll('[role=tablist] > [data-slot=tabs-indicator]');
    expect(indicators()).toHaveLength(1);
    expect(indicators()[0].firstElementChild!.className).toContain('bg-segment');
    rerender(<Settings variant="underline" />);
    await settle();
    expect(indicators()).toHaveLength(1);
    expect(indicators()[0].firstElementChild!.className).toContain('bg-primary');
    expect(tab('Account').className).toContain('text-subhead');
  });

  it('a controller selects from outside, with the reason imperative', async () => {
    const controller = createTabsController<Section>();
    const onValueChange = vi.fn();
    render(<Settings controller={controller} onValueChange={onValueChange} />);
    await settle();
    act(() => { controller.select('privacy'); });
    await settle();
    expect(controller.getValue()).toBe('privacy');
    expect(onValueChange).toHaveBeenLastCalledWith('privacy', expect.objectContaining({ reason: 'imperative' }));
    // Disabled tabs never select.
    act(() => { expect(controller.select('billing')).toBe(false); });
  });

  it('merges a class name that is a function of the part state', async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList aria-label="Letters">
          <TabsTab value="a" className={(state) => (state.selected ? 'is-on' : 'is-off')}>A</TabsTab>
          <TabsTab value="b" className={(state) => (state.selected ? 'is-on' : 'is-off')}>B</TabsTab>
        </TabsList>
      </Tabs>,
    );
    await settle();
    expect(tab('A').className).toContain('is-on');
    expect(tab('A').className).toContain('font-semibold');
    expect(tab('B').className).toContain('is-off');
  });
});

const sections = [
  { value: 'contacts', title: 'Contacts', icon: 'person' },
  { value: 'recents', title: 'Recents', icon: 'clock' },
  { value: 'settings', title: 'Settings', icon: 'sliders' },
] as const;

describe('Tabs on a bar', () => {
  it('a bottom bar: horizontal tabs named by their labels, the stacked panel wired to its tab', async () => {
    render(
      <Tabs variant="bar" defaultValue="recents">
        <TabsBar>
          <TabsList aria-label="Sections">
            {sections.map((s) => <TabsTab key={s.value} value={s.value} icon={s.icon}>{s.title}</TabsTab>)}
          </TabsList>
        </TabsBar>
        <TabsPanels>
          {sections.map((s) => <TabsPanel key={s.value} value={s.value}>{s.title} panel</TabsPanel>)}
        </TabsPanels>
      </Tabs>,
    );
    await settle();
    expect(slot('tabs').getAttribute('data-side')).toBe('bottom');
    expect(slot('tabs').getAttribute('data-orientation')).toBe('horizontal');
    expect(slot('tabs-bar').getAttribute('data-side')).toBe('bottom');
    expect(slot('tabs-bar').getAttribute('data-variant')).toBe('bar');
    expect(screen.getByRole('tablist', { name: 'Sections' }).hasAttribute('aria-orientation')).toBe(false);
    const recents = tab('Recents');
    expect(recents.tagName).toBe('BUTTON');
    expect(recents.getAttribute('aria-selected')).toBe('true');
    // The icon is decorative: the tab's name is its label alone.
    expect(recents.querySelector('[data-slot=tabs-tab-icon]')!.getAttribute('aria-hidden')).toBe('true');
    const panel = screen.getByRole('tabpanel');
    expect(panel.textContent).toBe('Recents panel');
    expect(panel.className).toContain('absolute');
    expect(recents.getAttribute('aria-controls')).toBe(panel.id);
    // A bar draws no indicator of its own.
    expect(screen.getByRole('tablist').querySelector('[data-slot=tabs-indicator]')).toBeNull();
    act(() => recents.focus());
    key('ArrowRight');
    await settle();
    expect(tab('Settings').getAttribute('aria-selected')).toBe('true');
    key('ArrowDown');
    await settle();
    expect(tab('Settings').getAttribute('aria-selected')).toBe('true');
  });

  it('side decides the orientation: a start rail moves with Up and Down', async () => {
    const onValueChange = vi.fn();
    render(
      <Tabs variant="rail" onValueChange={onValueChange}>
        <TabsBar>
          <TabsList aria-label="Sections">
            {sections.map((s) => <TabsTab key={s.value} value={s.value} icon={s.icon}>{s.title}</TabsTab>)}
          </TabsList>
        </TabsBar>
      </Tabs>,
    );
    await settle();
    expect(slot('tabs').getAttribute('data-side')).toBe('start');
    expect(slot('tabs').getAttribute('data-orientation')).toBe('vertical');
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('vertical');
    act(() => tab('Contacts').focus());
    key('ArrowRight');
    await settle();
    expect(onValueChange).not.toHaveBeenCalled();
    key('ArrowDown');
    await settle();
    expect(onValueChange).toHaveBeenLastCalledWith('recents', expect.objectContaining({ reason: 'list-navigation' }));
    key('End');
    await settle();
    expect(tab('Settings').getAttribute('aria-selected')).toBe('true');
  });

  it('an in-page look goes vertical with side="start"', async () => {
    render(<Settings variant="underline" side="start" />);
    await settle();
    expect(slot('tabs').getAttribute('data-orientation')).toBe('vertical');
    expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('vertical');
    expect(slot('tabs').className).toContain('flex-row');
  });

  it('works with the panels written first and the bar nested, and points at no panel when there is none', async () => {
    const { rerender } = render(
      <Tabs variant="plain" defaultValue="contacts">
        <TabsPanels>
          {sections.map((s) => <TabsPanel key={s.value} value={s.value}>{s.title} panel</TabsPanel>)}
        </TabsPanels>
        <header>
          <TabsBar>
            <TabsList aria-label="Sections">
              {sections.map((s) => <TabsTab key={s.value} value={s.value}>{s.title}</TabsTab>)}
            </TabsList>
          </TabsBar>
        </header>
      </Tabs>,
    );
    await settle();
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(tab('Contacts').id);
    expect(tab('Contacts').getAttribute('aria-controls')).toBe(panel.id);
    fireEvent.click(tab('Recents'));
    await settle();
    expect(screen.getByText('Recents panel')).toBeTruthy();

    rerender(
      <Tabs variant="plain" defaultValue="contacts">
        <TabsBar>
          <TabsList aria-label="Sections">
            {sections.map((s) => <TabsTab key={s.value} value={s.value}>{s.title}</TabsTab>)}
          </TabsList>
        </TabsBar>
      </Tabs>,
    );
    await settle();
    for (const el of screen.getAllByRole('tab')) expect(el.hasAttribute('aria-controls')).toBe(false);
  });

  it('a panel flows on its own and stacks inside TabsPanels; keepMounted hides it', async () => {
    render(
      <Tabs variant="bar" defaultValue="contacts">
        <TabsBar>
          <TabsList aria-label="Sections">
            {sections.map((s) => <TabsTab key={s.value} value={s.value} icon={s.icon}>{s.title}</TabsTab>)}
          </TabsList>
        </TabsBar>
        <TabsPanels>
          {sections.map((s) => <TabsPanel key={s.value} value={s.value} keepMounted>{s.title} panel</TabsPanel>)}
        </TabsPanels>
      </Tabs>,
    );
    await settle();
    expect(screen.getByText('Recents panel').hasAttribute('hidden')).toBe(true);
    expect(screen.getByText('Contacts panel').hasAttribute('hidden')).toBe(false);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    cleanup();
    render(<Settings />);
    await settle();
    expect(screen.getByRole('tabpanel').className).not.toContain('absolute');
  });

  it('hands a custom tab its state, through children and through the hook', async () => {
    function Dot() {
      const state = useTabsTab();
      return <i data-testid="dot" data-on={state?.selected ? '' : undefined} />;
    }
    render(
      <Tabs variant="plain" defaultValue="all">
        <TabsBar>
          <TabsList aria-label="Filters">
            <TabsTab value="all">{({ selected }) => <>All {selected ? '(on)' : '(off)'}<Dot /></>}</TabsTab>
            <TabsTab value="unread" aria-label="Unread"><Dot /></TabsTab>
          </TabsList>
        </TabsBar>
      </Tabs>,
    );
    await settle();
    expect(screen.getByRole('tab', { name: /All/ }).textContent).toBe('All (on)');
    const dots = screen.getAllByTestId('dot');
    expect(dots[0].hasAttribute('data-on')).toBe(true);
    expect(dots[1].hasAttribute('data-on')).toBe(false);
    fireEvent.click(tab('Unread'));
    await settle();
    expect(screen.getByRole('tab', { name: /All/ }).textContent).toBe('All (off)');
    expect(dots[1].hasAttribute('data-on')).toBe(true);
  });

  it('useTabs reads the root, and is null outside one', async () => {
    const seen: unknown[] = [];
    function Probe() { seen.push(useTabs()); return null; }
    render(<><Probe /><Tabs variant="switcher"><Probe /></Tabs></>);
    await settle();
    expect(seen[0]).toBeNull();
    expect(seen[1]).toEqual({ variant: 'switcher', side: 'start', orientation: 'vertical', size: 'default' });
  });

  it('a separator is decorative and arrow keys pass over it; an action is a button, not a tab', async () => {
    const add = vi.fn();
    render(
      <Tabs variant="switcher" defaultValue="home">
        <TabsBar>
          <TabsList aria-label="Workspaces">
            <TabsTab value="home" aria-label="Direct Messages"><TabsPill /></TabsTab>
            <TabsSeparator />
            <TabsTab value="labs" aria-label="Labs"><TabsPill attention /></TabsTab>
          </TabsList>
          <TabsFooter>
            <TabsAction aria-label="Add workspace" icon="plus" onClick={add} />
          </TabsFooter>
        </TabsBar>
      </Tabs>,
    );
    await settle();
    const list = screen.getByRole('tablist');
    expect(list.querySelector('[data-slot=separator]')!.getAttribute('role')).toBe('none');
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    act(() => tab('Direct Messages').focus());
    key('ArrowDown');
    await settle();
    expect(document.activeElement).toBe(tab('Labs'));
    const action = screen.getByRole('button', { name: 'Add workspace' });
    expect(list.contains(action)).toBe(false);
    fireEvent.click(action);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('the pill follows its own tab: full when selected, a nub for attention otherwise', async () => {
    render(
      <Tabs variant="switcher" defaultValue="home">
        <TabsBar>
          <TabsList aria-label="Workspaces">
            <TabsTab value="home" aria-label="Direct Messages"><TabsPill attention /></TabsTab>
            <TabsTab value="labs" aria-label="Labs"><TabsPill attention /></TabsTab>
            <TabsTab value="ops" aria-label="Ops"><TabsPill /></TabsTab>
          </TabsList>
        </TabsBar>
      </Tabs>,
    );
    await settle();
    const pill = (name: string) => tab(name).querySelector('[data-slot=tabs-pill]')!;
    expect(pill('Direct Messages').hasAttribute('data-selected')).toBe(true);
    expect(pill('Direct Messages').hasAttribute('data-attention')).toBe(false);
    expect(pill('Labs').hasAttribute('data-attention')).toBe(true);
    expect(pill('Ops').hasAttribute('data-attention')).toBe(false);
    expect(pill('Labs').getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(tab('Labs'));
    await settle();
    expect(pill('Labs').hasAttribute('data-selected')).toBe(true);
    expect(pill('Labs').hasAttribute('data-attention')).toBe(false);
    expect(pill('Direct Messages').hasAttribute('data-attention')).toBe(true);
  });

  it('an explicit indicator is one presentational frame with the mark inside, and replaces the default one', async () => {
    const { rerender } = render(
      <Tabs variant="plain" defaultValue="contacts">
        <TabsBar>
          <TabsList aria-label="Sections">
            {sections.map((s) => <TabsTab key={s.value} value={s.value}>{s.title}</TabsTab>)}
            <TabsIndicator className="inset-x-2.5" />
          </TabsList>
        </TabsBar>
      </Tabs>,
    );
    await settle();
    const frames = () => screen.getByRole('tablist').querySelectorAll('[data-slot=tabs-indicator]');
    expect(frames()).toHaveLength(1);
    expect(frames()[0].getAttribute('role')).toBe('presentation');
    const mark = frames()[0].firstElementChild!;
    expect(mark.className).toContain('inset-x-2.5');
    expect(mark.className).not.toContain('inset-x-3');
    expect(mark.className).toContain('bottom-0');
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    rerender(
      <Tabs variant="underline" defaultValue="contacts">
        <TabsList aria-label="Sections">
          {sections.map((s) => <TabsTab key={s.value} value={s.value}>{s.title}</TabsTab>)}
          <TabsIndicator className="bg-destructive" />
        </TabsList>
      </Tabs>,
    );
    await settle();
    expect(frames()).toHaveLength(1);
    expect(frames()[0].firstElementChild!.className).toContain('bg-destructive');
  });

  it('the bar hides with the scroll chrome, unless told not to', async () => {
    const { rerender } = render(
      <Tabs variant="bar"><TabsBar><TabsList aria-label="Sections"><TabsTab value="a" icon="star">A</TabsTab></TabsList></TabsBar></Tabs>,
    );
    await settle();
    expect(slot('tabs-bar').className).not.toContain('translate-y-full');
    act(() => setChromeHidden(true));
    expect(slot('tabs-bar').className).toContain('translate-y-full');
    expect(slot('tabs-bar').hasAttribute('data-hidden')).toBe(true);
    rerender(
      <Tabs variant="bar"><TabsBar hideOnScroll={false}><TabsList aria-label="Sections"><TabsTab value="a" icon="star">A</TabsTab></TabsList></TabsBar></Tabs>,
    );
    expect(slot('tabs-bar').className).not.toContain('translate-y-full');
    // Only the bar look hides: a plain bar stays where it is.
    rerender(
      <Tabs variant="plain"><TabsBar><TabsList aria-label="Sections"><TabsTab value="a">A</TabsTab></TabsList></TabsBar></Tabs>,
    );
    expect(slot('tabs-bar').className).not.toContain('translate-y-full');
  });
});

describe('Bottom tab bar (Tabs variant="bar" with no panels)', () => {
  type Item = (typeof sections)[number]['value'];
  function Bar({ value, onValueChange }: { value: Item; onValueChange: (next: Item) => void }) {
    return (
      <Tabs<Item> variant="bar" value={value} onValueChange={(next) => { if (next) onValueChange(next); }}>
        <TabsBar>
          <TabsList aria-label="Phone">
            {sections.map((s) => <TabsTab key={s.value} value={s.value} icon={s.icon}>{s.title}</TabsTab>)}
          </TabsList>
        </TabsBar>
      </Tabs>
    );
  }

  it('is controlled with value and onValueChange, by press and by arrow keys', async () => {
    const seen = vi.fn();
    function Host() {
      const [value, setValue] = useState<Item>('contacts');
      return <Bar value={value} onValueChange={(next) => { seen(next); setValue(next); }} />;
    }
    render(<Host />);
    await settle();
    expect(screen.getByRole('tablist', { name: 'Phone' })).toBeTruthy();
    for (const el of screen.getAllByRole('tab')) expect(el.hasAttribute('aria-controls')).toBe(false);
    fireEvent.click(tab('Recents'));
    await settle();
    expect(seen).toHaveBeenLastCalledWith('recents');
    expect(tab('Recents').getAttribute('aria-selected')).toBe('true');
    act(() => tab('Recents').focus());
    key('ArrowLeft');
    await settle();
    expect(seen).toHaveBeenLastCalledWith('contacts');
    expect(tab('Contacts').getAttribute('aria-selected')).toBe('true');
  });

  it('stays where it is when the owner ignores the change', async () => {
    render(<Bar value="contacts" onValueChange={() => {}} />);
    await settle();
    fireEvent.click(tab('Recents'));
    await settle();
    expect(tab('Contacts').getAttribute('aria-selected')).toBe('true');
  });
});

describe('Tabs size and presentation', () => {
  it('size reaches the segmented track, tabs and card: the same classes Segmented draws at that size', async () => {
    render(<Settings defaultValue="account" size="sm" />);
    await settle();
    expect(screen.getByRole('tablist').className).toContain('rounded-lg');
    expect(tab('Account').className).toContain('h-7');
    expect(slot('tabs-indicator')?.querySelector('span')?.className ?? '').toContain('rounded-[calc(var(--radius-lg)-2px)]');
    cleanup();
    render(<Settings defaultValue="account" size="lg" />);
    await settle();
    expect(tab('Account').className).toContain('h-10');
  });

  const App = () => (
    <Tabs presentation="auto" defaultValue="home">
      <TabsBar><TabsList aria-label="App"><TabsTab value="home" icon="house">Home</TabsTab></TabsList></TabsBar>
    </Tabs>
  );

  it('presentation="auto" is a bottom bar in a compact scope, a rail otherwise, and a bar outside every scope', async () => {
    const root = () => screen.getByRole('tablist').closest('[data-variant][data-side][data-size]') as HTMLElement;
    render(<SizeClassProvider value="compact"><App /></SizeClassProvider>);
    await settle();
    expect(root().getAttribute('data-variant')).toBe('bar');
    expect(root().getAttribute('data-side')).toBe('bottom');
    // A bottom bar publishes what it covers, safe area included.
    expect(root().style.getPropertyValue('--tabs-bar-h')).toContain('safe-area-inset-bottom');
    cleanup();
    render(<SizeClassProvider value="regular"><App /></SizeClassProvider>);
    await settle();
    expect(root().getAttribute('data-variant')).toBe('rail');
    expect(root().getAttribute('data-side')).toBe('start');
    expect(root().style.getPropertyValue('--tabs-bar-h')).toBe('');
    cleanup();
    render(<App />);
    await settle();
    expect(root().getAttribute('data-variant')).toBe('bar');
  });
});

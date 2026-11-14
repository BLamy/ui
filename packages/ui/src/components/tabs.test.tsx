// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Tabs, TabsList, TabsPanel, TabsTab, createTabsController, type TabsProps } from '@/components/ui/tabs';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);
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
    expect(indicators()[0].className).toContain('bg-segment');
    rerender(<Settings variant="underline" />);
    await settle();
    expect(indicators()).toHaveLength(1);
    expect(indicators()[0].className).toContain('bg-primary');
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

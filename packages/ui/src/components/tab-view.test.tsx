// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  TabView, TabViewAction, TabViewBar, TabViewFooter, TabViewIndicator, TabViewList, TabViewPanel, TabViewPanels,
  TabViewPill, TabViewSeparator, TabViewTab, useTabViewTab,
} from '@/components/ui/tab-view';
import { chromeStore } from '@/lib/theme';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(() => { cleanup(); chromeStore.set(false); });
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const key = (k: string) => fireEvent.keyDown(document.activeElement!, { key: k });
const tab = (name: string) => screen.getByRole('tab', { name });
const slot = (name: string) => document.querySelector(`[data-slot=${name}]`) as HTMLElement;

const sections = [
  { value: 'contacts', title: 'Contacts', icon: 'person' },
  { value: 'recents', title: 'Recents', icon: 'clock' },
  { value: 'settings', title: 'Settings', icon: 'sliders' },
];

describe('TabView', () => {
  it('a bottom bar: horizontal tabs named by their titles, the panel wired to its tab', async () => {
    render(
      <TabView defaultValue="recents">
        <TabViewBar>
          <TabViewList aria-label="Sections">
            {sections.map((s) => <TabViewTab key={s.value} {...s} />)}
          </TabViewList>
        </TabViewBar>
        <TabViewPanels>
          {sections.map((s) => <TabViewPanel key={s.value} value={s.value}>{s.title} panel</TabViewPanel>)}
        </TabViewPanels>
      </TabView>,
    );
    await settle();
    expect(slot('tabs').getAttribute('data-bar-placement')).toBe('bottom');
    expect(slot('tab-view-bar').getAttribute('data-bar-placement')).toBe('bottom');
    expect(slot('tabs').hasAttribute('data-placement')).toBe(false);
    expect(slot('tabs').getAttribute('data-orientation')).toBe('horizontal');
    expect(slot('tab-view-bar').getAttribute('data-variant')).toBe('bar');
    expect(screen.getByRole('tablist', { name: 'Sections' }).hasAttribute('aria-orientation')).toBe(false);
    const recents = tab('Recents');
    // UI SDK's tab: a button that never submits a form.
    expect(recents.tagName).toBe('BUTTON');
    expect(recents.getAttribute('type')).toBe('button');
    expect(recents.getAttribute('aria-selected')).toBe('true');
    const panel = screen.getByRole('tabpanel');
    expect(panel.textContent).toBe('Recents panel');
    expect(recents.getAttribute('aria-controls')).toBe(panel.id);
    act(() => recents.focus());
    key('ArrowRight');
    await settle();
    expect(tab('Settings').getAttribute('aria-selected')).toBe('true');
    key('ArrowDown');
    await settle();
    expect(tab('Settings').getAttribute('aria-selected')).toBe('true');
  });

  it('placement decides the orientation: a start rail moves with Up and Down', async () => {
    const onValueChange = vi.fn();
    render(
      <TabView placement="start" onValueChange={onValueChange}>
        <TabViewBar>
          <TabViewList aria-label="Sections">
            {sections.map((s) => <TabViewTab key={s.value} {...s} />)}
          </TabViewList>
        </TabViewBar>
      </TabView>,
    );
    await settle();
    expect(slot('tabs').getAttribute('data-orientation')).toBe('vertical');
    expect(slot('tab-view-bar').getAttribute('data-variant')).toBe('rail');
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

  it('works with the panels written first and the bar nested, and points at no panel when there is none', async () => {
    const { rerender } = render(
      <TabView placement="top" defaultValue="contacts">
        <TabViewPanels>
          {sections.map((s) => <TabViewPanel key={s.value} value={s.value}>{s.title} panel</TabViewPanel>)}
        </TabViewPanels>
        <header>
          <TabViewBar variant="plain">
            <TabViewList aria-label="Sections">
              {sections.map((s) => <TabViewTab key={s.value} value={s.value}>{s.title}</TabViewTab>)}
            </TabViewList>
          </TabViewBar>
        </header>
      </TabView>,
    );
    await settle();
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(tab('Contacts').id);
    expect(tab('Contacts').getAttribute('aria-controls')).toBe(panel.id);
    fireEvent.click(tab('Recents'));
    await settle();
    expect(screen.getByText('Recents panel')).toBeTruthy();

    rerender(
      <TabView placement="top" defaultValue="contacts">
        <TabViewBar variant="plain">
          <TabViewList aria-label="Sections">
            {sections.map((s) => <TabViewTab key={s.value} value={s.value}>{s.title}</TabViewTab>)}
          </TabViewList>
        </TabViewBar>
      </TabView>,
    );
    await settle();
    for (const el of screen.getAllByRole('tab')) expect(el.hasAttribute('aria-controls')).toBe(false);
  });

  it('keeps a panel mounted and hidden with keepMounted', async () => {
    render(
      <TabView defaultValue="contacts">
        <TabViewBar>
          <TabViewList aria-label="Sections">
            {sections.map((s) => <TabViewTab key={s.value} {...s} />)}
          </TabViewList>
        </TabViewBar>
        <TabViewPanels>
          {sections.map((s) => <TabViewPanel key={s.value} value={s.value} keepMounted>{s.title} panel</TabViewPanel>)}
        </TabViewPanels>
      </TabView>,
    );
    await settle();
    expect(screen.getByText('Recents panel').hasAttribute('hidden')).toBe(true);
    expect(screen.getByText('Contacts panel').hasAttribute('hidden')).toBe(false);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });

  it('hands a custom tab its state, through children and through the hook', async () => {
    function Dot() {
      const state = useTabViewTab();
      return <i data-testid="dot" data-on={state?.selected ? '' : undefined} />;
    }
    render(
      <TabView placement="top" defaultValue="all">
        <TabViewBar variant="plain">
          <TabViewList aria-label="Filters">
            <TabViewTab value="all">{({ selected }) => <>All {selected ? '(on)' : '(off)'}<Dot /></>}</TabViewTab>
            <TabViewTab value="unread" aria-label="Unread"><Dot /></TabViewTab>
          </TabViewList>
        </TabViewBar>
      </TabView>,
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

  it('a separator is decorative and arrow keys pass over it; an action is a button, not a tab', async () => {
    const add = vi.fn();
    render(
      <TabView orientation="vertical" defaultValue="home">
        <TabViewBar variant="workspace">
          <TabViewList aria-label="Workspaces">
            <TabViewTab value="home" aria-label="Direct Messages"><TabViewPill /></TabViewTab>
            <TabViewSeparator />
            <TabViewTab value="labs" aria-label="Labs"><TabViewPill attention /></TabViewTab>
          </TabViewList>
          <TabViewFooter>
            <TabViewAction aria-label="Add workspace" icon="plus" onClick={add} />
          </TabViewFooter>
        </TabViewBar>
      </TabView>,
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
      <TabView orientation="vertical" defaultValue="home">
        <TabViewBar variant="workspace">
          <TabViewList aria-label="Workspaces">
            <TabViewTab value="home" aria-label="Direct Messages"><TabViewPill attention /></TabViewTab>
            <TabViewTab value="labs" aria-label="Labs"><TabViewPill attention /></TabViewTab>
            <TabViewTab value="ops" aria-label="Ops"><TabViewPill /></TabViewTab>
          </TabViewList>
        </TabViewBar>
      </TabView>,
    );
    await settle();
    const pill = (name: string) => tab(name).querySelector('[data-slot=tab-view-pill]')!;
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

  it('the indicator is one presentational frame in the list, with the mark inside it', async () => {
    render(
      <TabView placement="top" defaultValue="contacts">
        <TabViewBar variant="plain">
          <TabViewList aria-label="Sections">
            {sections.map((s) => <TabViewTab key={s.value} value={s.value}>{s.title}</TabViewTab>)}
            <TabViewIndicator className="inset-x-2.5" />
          </TabViewList>
        </TabViewBar>
      </TabView>,
    );
    await settle();
    const frames = screen.getByRole('tablist').querySelectorAll('[data-slot=tabs-indicator]');
    expect(frames).toHaveLength(1);
    expect(frames[0].getAttribute('role')).toBe('presentation');
    const mark = frames[0].firstElementChild!;
    expect(mark.className).toContain('inset-x-2.5');
    expect(mark.className).not.toContain('inset-x-3');
    expect(mark.className).toContain('bottom-0');
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('the bar hides with the scroll chrome, unless told not to', async () => {
    const { rerender } = render(
      <TabView><TabViewBar><TabViewList aria-label="Sections"><TabViewTab value="a" title="A" /></TabViewList></TabViewBar></TabView>,
    );
    await settle();
    expect(slot('tab-view-bar').className).not.toContain('translate-y-full');
    act(() => chromeStore.set(true));
    expect(slot('tab-view-bar').className).toContain('translate-y-full');
    rerender(
      <TabView><TabViewBar hideOnScroll={false}><TabViewList aria-label="Sections"><TabViewTab value="a" title="A" /></TabViewList></TabViewBar></TabView>,
    );
    expect(slot('tab-view-bar').className).not.toContain('translate-y-full');
  });
});

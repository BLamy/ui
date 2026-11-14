// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TabBar } from '@/components/ui/tab-bar';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const tab = (name: string) => screen.getByRole('tab', { name });

const items = [
  { value: 'contacts', title: 'Contacts', icon: 'person' },
  { value: 'recents', title: 'Recents', icon: 'clock' },
  { value: 'settings', title: <b>Prefs</b>, icon: 'sliders' },
] as const;

describe('TabBar', () => {
  it('is a tablist named "Tabs" (or what you call it), with a tab per item and no panel to point at', async () => {
    const { rerender } = render(<TabBar items={items} defaultValue="recents" />);
    await settle();
    expect(screen.getByRole('tablist', { name: 'Tabs' })).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(tab('Recents').getAttribute('aria-selected')).toBe('true');
    // A title that isn't text is named by the item's value.
    expect(tab('settings').textContent).toBe('Prefs');
    for (const el of screen.getAllByRole('tab')) expect(el.hasAttribute('aria-controls')).toBe(false);
    rerender(<TabBar items={items} defaultValue="recents" aria-label="Phone" />);
    expect(screen.getByRole('tablist', { name: 'Phone' })).toBeTruthy();
  });

  it('names a tab whose title isn\'t text by its aria-label', async () => {
    render(<TabBar items={[...items.slice(0, 2), { value: 'settings', title: <b>Prefs</b>, icon: 'sliders', 'aria-label': 'Preferences' }]} />);
    await settle();
    expect(tab('Preferences').textContent).toBe('Prefs');
    expect(screen.queryByRole('tab', { name: 'settings' })).toBeNull();
  });

  it('is controlled with value and onValueChange, by press and by arrow keys', async () => {
    const seen = vi.fn();
    function Host() {
      const [value, setValue] = useState<(typeof items)[number]['value']>('contacts');
      return <TabBar items={items} value={value} onValueChange={(next, details) => { seen(next, details.reason); setValue(next); }} />;
    }
    render(<Host />);
    await settle();
    fireEvent.click(tab('Recents'));
    await settle();
    expect(seen).toHaveBeenLastCalledWith('recents', 'item-press');
    expect(tab('Recents').getAttribute('aria-selected')).toBe('true');
    act(() => tab('Recents').focus());
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    await settle();
    expect(seen).toHaveBeenLastCalledWith('contacts', 'list-navigation');
    expect(tab('Contacts').getAttribute('aria-selected')).toBe('true');
  });

  it('stays where it is when the owner ignores the change', async () => {
    render(<TabBar items={items} value="contacts" onValueChange={() => {}} />);
    await settle();
    fireEvent.click(tab('Recents'));
    await settle();
    expect(tab('Contacts').getAttribute('aria-selected')).toBe('true');
  });
});

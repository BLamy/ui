// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FontList, FontPicker, FontPickerContent, FontPickerTrigger, FontStackPicker } from '@/components/ui/font-picker';
import { GOOGLE_FONTS } from '@/lib/google-fonts';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

// The list is virtualized: give it a size to lay rows out in, and keep the Google Fonts CDN out of it.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1200);
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 400 })));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const fonts = GOOGLE_FONTS.filter((f) => ['Inter', 'Lobster', 'Merriweather', 'Fira Code', 'Caveat'].includes(f.family));
const options = () => screen.getAllByRole('option').map((o) => o.textContent ?? '');

describe('FontList', () => {
  it('offers the system font first, then the families with their category', () => {
    render(<FontList value={null} onValueChange={() => {}} fonts={fonts} />);
    expect(options()[0]).toMatch(/^System/);
    expect(options().some((o) => o.startsWith('Lobster') && o.endsWith('Display'))).toBe(true);
  });

  it('keeps the scrolling list reachable from the keyboard: the search, then the list itself', () => {
    render(<FontList value={null} onValueChange={() => {}} fonts={fonts} />);
    // The list is named (by its search, as UI SDK's Command names it), and is its own scroller.
    const scroller = screen.getByRole('listbox', { name: 'Search fonts' });
    expect(scroller.classList.contains('overflow-y-auto')).toBe(true);
    expect(scroller.tabIndex).toBe(0);
  });

  it('filters by what is typed and by category', async () => {
    render(<FontList value={null} onValueChange={() => {}} fonts={fonts} />);
    fireEvent.input(screen.getByRole('combobox', { name: 'Search fonts' }), { target: { value: 'mer' } });
    expect(options()).toEqual(['MerriweatherSerif']);
    fireEvent.input(screen.getByRole('combobox', { name: 'Search fonts' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Monospace' }));
    expect(options()).toEqual(['Fira CodeMonospace']);
  });

  it('previews the family under the pointer, and nothing once the pointer leaves', () => {
    const onPreview = vi.fn();
    render(<FontList value="Inter" onValueChange={() => {}} onPreview={onPreview} fonts={fonts} />);
    const lobster = screen.getAllByRole('option').find((o) => o.textContent?.startsWith('Lobster'))!;
    fireEvent.pointerMove(lobster, { pointerType: 'mouse' });
    expect(onPreview).toHaveBeenLastCalledWith('Lobster');
    fireEvent.pointerLeave(lobster.closest('.bl-scroll')!, { pointerType: 'mouse' });
    expect(onPreview).toHaveBeenLastCalledWith(undefined);
  });

  it('names each family by itself, and describes it by its category', () => {
    render(<FontList value="Inter" onValueChange={() => {}} fonts={fonts} />);
    const lobster = screen.getByRole('option', { name: 'Lobster' });
    expect(document.getElementById(lobster.getAttribute('aria-describedby')!)?.textContent).toBe('Display');
    expect(screen.getByRole('option', { name: 'Inter (in use)' })).toBeTruthy();
  });

  it('shows the kit\'s empty state when nothing matches', () => {
    render(<FontList value={null} onValueChange={() => {}} fonts={fonts} />);
    fireEvent.input(screen.getByRole('combobox', { name: 'Search fonts' }), { target: { value: 'q' } });
    expect(document.querySelector('[data-slot=empty-state]')?.textContent).toBe('No fonts');
  });

  it('marks the family in use and chooses another', () => {
    const onChange = vi.fn();
    render(<FontList value="Inter" onValueChange={onChange} fonts={fonts} />);
    const inter = screen.getAllByRole('option').find((o) => o.textContent?.startsWith('Inter'))!;
    expect(inter.textContent).toContain('(in use)');
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent?.startsWith('Caveat'))!);
    expect(onChange).toHaveBeenCalledWith('Caveat', expect.objectContaining({ reason: 'item-press' }));
  });
});

describe('FontList keyboard', () => {
  it('moves through the families from the search with the arrows, previews each, and picks with Enter', () => {
    const onChange = vi.fn();
    const onPreview = vi.fn();
    render(<FontList value={null} onValueChange={onChange} onPreview={onPreview} fonts={fonts} />);
    const search = screen.getByRole('combobox', { name: 'Search fonts' });
    search.focus();
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    const active = document.getElementById(search.getAttribute('aria-activedescendant') ?? '');
    expect(active?.getAttribute('role')).toBe('option');
    const family = onPreview.mock.lastCall?.[0] as string;
    expect(active?.textContent?.startsWith(family)).toBe(true);
    expect(document.activeElement).toBe(search);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(family, expect.objectContaining({ reason: 'enter-key' }));
  });
});

describe('FontPicker', () => {
  it('names the family it holds and closes on a choice', async () => {
    const onChange = vi.fn();
    render(<FontPicker aria-label="Headline font" value="Merriweather" onValueChange={onChange} fonts={fonts} />);
    const trigger = screen.getByRole('button', { name: 'Headline font: Merriweather' });
    await act(async () => { fireEvent.click(trigger); });
    const dialog = screen.getByRole('dialog', { name: 'Headline font' });
    await act(async () => { fireEvent.click(within(dialog).getAllByRole('option').find((o) => o.textContent?.startsWith('Inter'))!); });
    expect(onChange).toHaveBeenCalledWith('Inter', expect.objectContaining({ reason: 'item-press' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('FontPicker parts', () => {
  it('composes a sized trigger and a content placed where asked, and opens from the root\'s defaultOpen', async () => {
    render(
      <FontPicker aria-label="Body font" defaultValue="Inter" defaultOpen fonts={fonts}>
        <FontPickerTrigger size="sm" />
        <FontPickerContent side="left" />
      </FontPicker>,
    );
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Body font: Inter' }).className).toContain('h-8');
    expect(screen.getByRole('dialog', { name: 'Body font' })).toBeTruthy();
  });
});

describe('FontStackPicker', () => {
  it('shows the stack as chips; × removes one', () => {
    const onChange = vi.fn();
    render(<FontStackPicker value={['Inter', 'Merriweather']} onValueChange={onChange} fonts={fonts} />);
    expect(within(screen.getByRole('list', { name: 'Font stack' })).getAllByRole('listitem').map((r) => r.textContent)).toEqual(['Inter', 'Merriweather']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Inter' }));
    expect(onChange).toHaveBeenCalledWith(['Merriweather'], expect.objectContaining({ reason: 'remove-press' }));
  });

  it('adds a family in front, previews the stack with the hovered one in front, and stops at maxCount', async () => {
    const onChange = vi.fn();
    const onPreview = vi.fn();
    const { rerender } = render(<FontStackPicker value={['Inter']} onValueChange={onChange} onPreview={onPreview} maxCount={2} fonts={fonts} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Add a font/ })); });
    const caveat = screen.getAllByRole('option').find((o) => o.textContent?.startsWith('Caveat'))!;
    fireEvent.pointerMove(caveat, { pointerType: 'mouse' });
    expect(onPreview).toHaveBeenLastCalledWith(['Caveat', 'Inter']);
    fireEvent.click(caveat);
    expect(onChange).toHaveBeenCalledWith(['Caveat', 'Inter'], expect.objectContaining({ reason: 'item-press' }));
    rerender(<FontStackPicker value={['Caveat', 'Inter']} onValueChange={onChange} onPreview={onPreview} maxCount={2} fonts={fonts} />);
    const lobster = screen.getAllByRole('option').find((o) => o.textContent?.startsWith('Lobster'))!;
    expect(lobster.hasAttribute('data-disabled')).toBe(true);
    expect(screen.getByText('2 of 2: remove one to add another.')).toBeTruthy();
  });

  it('reorders a chip from its handle with the keyboard, and Delete removes one', () => {
    const onChange = vi.fn();
    render(<FontStackPicker defaultValue={['Inter', 'Merriweather']} onValueChange={onChange} fonts={fonts} />);
    const handles = screen.getAllByRole('button', { name: /^Move / });
    expect(handles.map((h) => h.tabIndex)).toEqual([0, -1]); // one tab stop
    const merri = screen.getByRole('button', { name: 'Move Merriweather' });
    act(() => merri.focus());
    fireEvent.keyDown(merri, { key: ' ' });
    fireEvent.keyDown(merri, { key: 'ArrowLeft' });
    fireEvent.keyDown(merri, { key: ' ' });
    expect(onChange).toHaveBeenLastCalledWith(['Merriweather', 'Inter'], expect.objectContaining({ reason: 'move-key' }));
    const inter = screen.getByRole('button', { name: 'Move Inter' });
    fireEvent.keyDown(inter, { key: 'Delete' });
    expect(onChange).toHaveBeenLastCalledWith(['Merriweather'], expect.objectContaining({ reason: 'delete-key' }));
  });

  it('hands focus to the next chip (else the one before) when Delete removes the focused one', async () => {
    render(<FontStackPicker defaultValue={['Inter', 'Merriweather', 'Caveat']} fonts={fonts} />);
    const merri = screen.getByRole('button', { name: 'Move Merriweather' });
    act(() => merri.focus());
    await act(async () => { fireEvent.keyDown(merri, { key: 'Delete' }); });
    await act(async () => { await Promise.resolve(); });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move Caveat' }));
    await act(async () => { fireEvent.keyDown(document.activeElement!, { key: 'Backspace' }); });
    await act(async () => { await Promise.resolve(); });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move Inter' }));
  });

  it('hands focus to the Add button when Delete removes the last chip', async () => {
    render(<FontStackPicker defaultValue={['Inter']} fonts={fonts} />);
    const inter = screen.getByRole('button', { name: 'Move Inter' });
    act(() => inter.focus());
    await act(async () => { fireEvent.keyDown(inter, { key: 'Delete' }); });
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('list', { name: 'Font stack' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add a font' }));
  });

  it("gives the consumer UI SDK's details first: canceling keeps an uncontrolled stack as it was", () => {
    const onChange = vi.fn((_: string[], details: { reason: string; cancel: () => void }) => { if (details.reason === 'remove-press') details.cancel(); });
    render(<FontStackPicker defaultValue={['Inter', 'Merriweather']} onValueChange={onChange} fonts={fonts} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Inter' }));
    expect(onChange).toHaveBeenCalledWith(['Merriweather'], expect.objectContaining({ reason: 'remove-press', source: expect.any(String), canceled: true, event: expect.any(Event) }));
    expect(within(screen.getByRole('list', { name: 'Font stack' })).getAllByRole('listitem').map((r) => r.textContent)).toEqual(['Inter', 'Merriweather']);
  });
});

describe('FontPicker details', () => {
  it('reports the source and event of a pick, and stays open on the family in use when the pick is canceled', async () => {
    const onChange = vi.fn((_: string | null, details: { cancel: () => void }) => details.cancel());
    render(<FontPicker aria-label="Body font" defaultValue="Merriweather" onValueChange={onChange} fonts={fonts} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Body font: Merriweather' })); });
    const dialog = screen.getByRole('dialog', { name: 'Body font' });
    await act(async () => { fireEvent.click(within(dialog).getAllByRole('option').find((o) => o.textContent?.startsWith('Inter'))!); });
    expect(onChange).toHaveBeenCalledWith('Inter', expect.objectContaining({ reason: 'item-press', source: 'programmatic', canceled: true, event: expect.any(MouseEvent) }));
    expect(screen.getByRole('dialog', { name: 'Body font' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Body font: Merriweather' })).toBeTruthy();
  });

  it('a list pick with Enter reports enter-key and the key press', () => {
    const onChange = vi.fn();
    render(<FontList onValueChange={onChange} fonts={fonts} />);
    const search = screen.getByRole('combobox', { name: 'Search fonts' });
    act(() => search.focus());
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ reason: 'enter-key', event: expect.any(KeyboardEvent), cancel: expect.any(Function) }));
  });
});

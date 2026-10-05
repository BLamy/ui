// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FontList, FontPicker, FontStackPicker } from '@/components/ui/font-picker';
import { GOOGLE_FONTS } from '@/lib/google-fonts';

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
    render(<FontList value={null} onChange={() => {}} fonts={fonts} />);
    expect(options()[0]).toMatch(/^System/);
    expect(options().some((o) => o.startsWith('Lobster') && o.endsWith('Display'))).toBe(true);
  });

  it('filters by what is typed and by category', async () => {
    render(<FontList value={null} onChange={() => {}} fonts={fonts} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'mer' } });
    expect(options()).toEqual(['MerriweatherSerif']);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Monospace' }));
    expect(options()).toEqual(['Fira CodeMonospace']);
  });

  it('previews the family under the pointer, and nothing once the pointer leaves', () => {
    const onPreview = vi.fn();
    render(<FontList value="Inter" onChange={() => {}} onPreview={onPreview} fonts={fonts} />);
    const lobster = screen.getAllByRole('option').find((o) => o.textContent?.startsWith('Lobster'))!;
    fireEvent.pointerEnter(lobster, { pointerType: 'mouse' });
    expect(onPreview).toHaveBeenLastCalledWith('Lobster');
    fireEvent.pointerLeave(lobster, { pointerType: 'mouse' });
    expect(onPreview).toHaveBeenLastCalledWith(undefined);
  });

  it('marks the family in use and chooses another', () => {
    const onChange = vi.fn();
    render(<FontList value="Inter" onChange={onChange} fonts={fonts} />);
    const inter = screen.getAllByRole('option').find((o) => o.textContent?.startsWith('Inter'))!;
    expect(inter.textContent).toContain('(in use)');
    fireEvent.click(screen.getAllByRole('option').find((o) => o.textContent?.startsWith('Caveat'))!);
    expect(onChange).toHaveBeenCalledWith('Caveat');
  });
});

describe('FontPicker', () => {
  it('names the family it holds and closes on a choice', async () => {
    const onChange = vi.fn();
    render(<FontPicker aria-label="Headline font" value="Merriweather" onChange={onChange} fonts={fonts} />);
    const trigger = screen.getByRole('button', { name: 'Headline font: Merriweather' });
    await act(async () => { fireEvent.click(trigger); });
    const dialog = screen.getByRole('dialog', { name: 'Headline font' });
    await act(async () => { fireEvent.click(within(dialog).getAllByRole('option').find((o) => o.textContent?.startsWith('Inter'))!); });
    expect(onChange).toHaveBeenCalledWith('Inter');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('FontStackPicker', () => {
  it('shows the stack as chips; × removes one', () => {
    const onChange = vi.fn();
    render(<FontStackPicker value={['Inter', 'Merriweather']} onChange={onChange} fonts={fonts} />);
    expect(screen.getAllByRole('row').map((r) => r.textContent)).toEqual(['Inter', 'Merriweather']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Inter' }));
    expect(onChange).toHaveBeenCalledWith(['Merriweather']);
  });

  it('adds a family in front, previews the stack with the hovered one in front, and stops at maxCount', async () => {
    const onChange = vi.fn();
    const onPreview = vi.fn();
    const { rerender } = render(<FontStackPicker value={['Inter']} onChange={onChange} onPreview={onPreview} maxCount={2} fonts={fonts} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Add a font/ })); });
    const caveat = screen.getAllByRole('option').find((o) => o.textContent?.startsWith('Caveat'))!;
    fireEvent.pointerEnter(caveat, { pointerType: 'mouse' });
    expect(onPreview).toHaveBeenLastCalledWith(['Caveat', 'Inter']);
    fireEvent.click(caveat);
    expect(onChange).toHaveBeenCalledWith(['Caveat', 'Inter']);
    rerender(<FontStackPicker value={['Caveat', 'Inter']} onChange={onChange} onPreview={onPreview} maxCount={2} fonts={fonts} />);
    const lobster = screen.getAllByRole('option').find((o) => o.textContent?.startsWith('Lobster'))!;
    expect(lobster.hasAttribute('data-disabled')).toBe(true);
    expect(screen.getByText('2 of 2: remove one to add another.')).toBeTruthy();
  });
});

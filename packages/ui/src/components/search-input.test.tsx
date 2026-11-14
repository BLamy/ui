// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInputController } from '@/components/ui/input';
import { SearchInput, type SearchInputProps } from '@/components/ui/search-input';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

// One bridge per file: it has no destroy, and remembers components earlier tests removed as off the page.
const agent = createAgent();

// An InputGroup learns that its input holds text a tick after mounting.
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const box = (name = 'Search contacts') => screen.getByRole('searchbox', { name }) as HTMLInputElement;
const type = (text: string) => fireEvent.input(box(), { target: { value: text } });
const clearButton = () => screen.queryByRole('button', { name: 'Clear search' });
const clear = () => screen.getByRole('button', { name: 'Clear search' });

function Controlled({ onValueChange, ...props }: SearchInputProps) {
  const [query, setQuery] = useState('');
  return <SearchInput aria-label="Search contacts" value={query} onValueChange={(next, details) => { setQuery(next); onValueChange?.(next, details); }} {...props} />;
}

describe('SearchInput', () => {
  it('is a named search box, "Search" unless told otherwise', () => {
    render(<SearchInput />);
    expect(box('Search').getAttribute('placeholder')).toBe('Search');
    expect(box('Search').type).toBe('search');
    expect(box('Search').closest('[data-slot=search-input]')).toBeTruthy();
  });

  it('reports typing with the reason, and shows Clear only while there is a query', async () => {
    const onValueChange = vi.fn();
    render(<Controlled onValueChange={onValueChange} />);
    await settle();
    expect(clearButton()).toBeNull();
    type('chen');
    await settle();
    expect(box().value).toBe('chen');
    expect(onValueChange).toHaveBeenLastCalledWith('chen', expect.objectContaining({ reason: 'input-change' }));
    expect(clearButton()).toBeTruthy();
  });

  it('the Clear button empties the query, reports clear-press and returns focus to the input', async () => {
    const onValueChange = vi.fn();
    render(<Controlled onValueChange={onValueChange} />);
    type('chen');
    await settle();
    fireEvent.click(clear());
    await settle();
    expect(box().value).toBe('');
    expect(onValueChange).toHaveBeenLastCalledWith('', expect.objectContaining({ reason: 'clear-press' }));
    expect(document.activeElement).toBe(box());
    expect(clearButton()).toBeNull();
  });

  it('keeps the Clear button out of the Tab order (Escape is its keyboard route)', async () => {
    render(<SearchInput aria-label="Search contacts" defaultValue="Wei" />);
    await settle();
    expect(clear().tabIndex).toBe(-1);
    expect(clear().getAttribute('type')).toBe('button');
  });

  it('Escape clears a query and claims the key; in an empty field it is left for whatever is around it', async () => {
    const onValueChange = vi.fn();
    const outer = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
    document.addEventListener('keydown', outer);
    try {
      render(<Controlled onValueChange={onValueChange} />);
      type('chen');
      await settle();
      fireEvent.keyDown(box(), { key: 'Escape' });
      await settle();
      expect(box().value).toBe('');
      expect(onValueChange).toHaveBeenLastCalledWith('', expect.objectContaining({ reason: 'clear-press' }));
      expect(onValueChange.mock.lastCall?.[1].event?.type).toBe('keydown');
      expect(outer).toHaveLastReturnedWith(true);

      onValueChange.mockClear();
      fireEvent.keyDown(box(), { key: 'Escape' });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(outer).toHaveLastReturnedWith(false);
    } finally {
      document.removeEventListener('keydown', outer);
    }
  });

  it('Enter submits the query, and not while an input method is composing', () => {
    const onSubmit = vi.fn();
    render(<SearchInput aria-label="Search contacts" defaultValue="Wei" onSubmit={onSubmit} />);
    fireEvent.keyDown(box(), { key: 'Enter', isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.lastCall?.[0]).toBe('Wei');
    expect(onSubmit.mock.lastCall?.[1]).toEqual(expect.objectContaining({ reason: 'enter-key' }));
    expect(onSubmit.mock.lastCall?.[1].event?.type).toBe('keydown');
  });

  it('a canceled submit leaves Enter to the form around the field', () => {
    const outer = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
    document.addEventListener('keydown', outer);
    try {
      render(<SearchInput aria-label="Search contacts" defaultValue="Wei" onSubmit={(_value, details) => details.cancel()} />);
      fireEvent.keyDown(box(), { key: 'Enter' });
      expect(outer).toHaveLastReturnedWith(false);
    } finally {
      document.removeEventListener('keydown', outer);
    }
  });

  it('an agent can run the query, and sees the submit action only when there is an onSubmit', async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<SearchInput aria-label="Search contacts" defaultValue="Wei" />);
    await settle();
    expect(agent.snapshot().filter((entry) => !entry.offPage && entry.component === 'search-input')).toEqual([]);
    rerender(<SearchInput aria-label="Search contacts" defaultValue="Wei" onSubmit={onSubmit} />);
    await settle();
    const [entry] = agent.snapshot().filter((item) => !item.offPage && item.component === 'search-input');
    expect(entry).toEqual(expect.objectContaining({ label: 'Search contacts', actions: ['submit'] }));
    const result = await act(() => agent.act({ steps: [{ ref: entry.ref, action: 'submit', args: [] }] }));
    expect(result.ok, result.error?.message).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.lastCall?.[0]).toBe('Wei');
    expect(onSubmit.mock.lastCall?.[1]).toEqual(expect.objectContaining({ reason: 'imperative', source: 'agent' }));
  });

  it('without onSubmit, Enter is left to the form around the field', () => {
    const outer = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
    document.addEventListener('keydown', outer);
    try {
      render(<SearchInput aria-label="Search contacts" defaultValue="Wei" />);
      fireEvent.keyDown(box(), { key: 'Enter' });
      expect(outer).toHaveLastReturnedWith(false);
    } finally {
      document.removeEventListener('keydown', outer);
    }
  });

  it('only the input\'s own keys count: not the Clear button\'s, or one its handler already took', async () => {
    const onSubmit = vi.fn();
    const onValueChange = vi.fn();
    const { rerender } = render(<SearchInput aria-label="Search contacts" defaultValue="Wei" onSubmit={onSubmit} onValueChange={onValueChange} />);
    await settle();
    fireEvent.keyDown(clear(), { key: 'Enter' });
    fireEvent.keyDown(clear(), { key: 'Escape' });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();

    rerender(<SearchInput aria-label="Search contacts" defaultValue="Wei" onSubmit={onSubmit} onValueChange={onValueChange} onKeyDown={(event) => event.preventDefault()} />);
    fireEvent.keyDown(box(), { key: 'Escape' });
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(box().value).toBe('Wei');
    expect(onSubmit).not.toHaveBeenCalled();

  });

  it('a read-only field keeps its query on Escape, but Enter still submits it and claims the key', () => {
    const onSubmit = vi.fn();
    const outer = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
    document.addEventListener('keydown', outer);
    try {
      render(<SearchInput aria-label="Search contacts" defaultValue="Wei" onSubmit={onSubmit} readOnly />);
      fireEvent.keyDown(box(), { key: 'Escape' });
      expect(box().value).toBe('Wei');
      expect(outer).toHaveLastReturnedWith(false);
      fireEvent.keyDown(box(), { key: 'Enter' });
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit.mock.lastCall?.[1]).toEqual(expect.objectContaining({ reason: 'enter-key' }));
      // Claimed, so the form around the field doesn't submit as well.
      expect(outer).toHaveLastReturnedWith(true);
    } finally {
      document.removeEventListener('keydown', outer);
    }
  });

  it('a disabled field shows no Clear button', async () => {
    render(<SearchInput aria-label="Search contacts" defaultValue="Wei" disabled />);
    await settle();
    expect(box().disabled).toBe(true);
    expect(clearButton()).toBeNull();
  });

  it('takes a controller, which writes the query from outside', async () => {
    const controller = createInputController();
    const onValueChange = vi.fn();
    render(<SearchInput aria-label="Search contacts" controller={controller} onValueChange={onValueChange} />);
    act(() => { controller.setValue('lisbon'); });
    expect(box().value).toBe('lisbon');
    expect(onValueChange).toHaveBeenLastCalledWith('lisbon', expect.objectContaining({ reason: 'imperative' }));
    // Escape still clears through the same controller.
    fireEvent.keyDown(box(), { key: 'Escape' });
    expect(box().value).toBe('');
  });

  it('an agent finds the field by its name and can fill it', async () => {
    const onValueChange = vi.fn();
    render(<Controlled onValueChange={onValueChange} />);
    await settle();
    const result = await act(() => agent.act({ steps: [{ ref: 'Search contacts', action: 'setValue', args: ['chen'] }] }));
    expect(result.ok, result.error?.message).toBe(true);
    expect(box().value).toBe('chen');
    expect(onValueChange).toHaveBeenLastCalledWith('chen', expect.objectContaining({ source: 'agent' }));
    await settle();
    // The input carries the name and the value; the group around it is named by its Clear button; the field itself
    // is listed only when it can submit.
    const entries = agent.snapshot().filter((entry) => !entry.offPage);
    // (Refs are reused by name across this file's tests, so the order is the bridge's, not the page's.)
    expect(entries.map((entry) => [entry.component, entry.label]).sort()).toEqual([['input', 'Clear search'], ['input', 'Search contacts']]);
    expect(entries.find((entry) => entry.label === 'Search contacts')?.actions).toEqual(['setValue', 'clear']);
  });

  // UI SDK: an InputGroup is listed with no name while its Clear part is absent (see the gaps note).
  it.fails('an empty field leaves no unnamed entry in the snapshot', async () => {
    render(<SearchInput aria-label="Search contacts" />);
    await settle();
    for (const entry of agent.snapshot().filter((entry) => !entry.offPage)) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
  });
});

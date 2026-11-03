// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ObjectValue } from '@/components/ui/object-value';
import { STRING_PREVIEW_LENGTH, type ValuePreview } from '@/lib/object-tree-value';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const LONG = 'x'.repeat(5000);
const root = (container: HTMLElement) => container.querySelector('[data-slot="object-value"]') as HTMLElement;

describe('ObjectValue', () => {
  it('names its type, takes a class and a style last, and passes other props on', () => {
    const { container } = render(<ObjectValue value={{ type: 'number', value: 3 }} className="font-sans" style={{ color: 'red' }} title="three" />);
    const el = root(container);
    expect(el.getAttribute('data-type')).toBe('number');
    expect(el.className).toContain('font-sans');
    expect(el.className).not.toContain('font-mono');
    expect(el.style.color).toBe('red');
    expect(el.title).toBe('three');
    expect(el.textContent).toBe('3');
  });

  it('tints each piece by its type', () => {
    const value: ValuePreview = { type: 'object', className: 'A', properties: [{ name: 's', value: { type: 'string', value: 'v' } }, { name: 'n', value: { type: 'number', value: 1 } }] };
    const { container } = render(<ObjectValue value={value} />);
    const tinted = (cls: string) => [...container.querySelectorAll(`.${cls}`)].map((e) => e.textContent);
    expect(root(container).textContent).toBe('A {s: "v", n: 1}');
    expect(tinted('bl-tok-string')).toEqual(['"v"']);
    expect(tinted('bl-tok-number')).toEqual(['1']);
    expect(tinted('bl-tok-type')).toEqual(['A ']);
  });

  it('leaves a console string unquoted', () => {
    const { container } = render(<ObjectValue value={{ type: 'string', value: 'hello' }} quote={false} />);
    expect(root(container).textContent).toBe('hello');
  });

  it('truncates a long string, and shows the rest on request', () => {
    const { container } = render(<ObjectValue value={{ type: 'string', value: LONG }} />);
    expect(root(container).textContent).toContain(`"${'x'.repeat(STRING_PREVIEW_LENGTH)}…"`);
    const more = screen.getByRole('button', { name: `Show more (4.9 kB)` });
    fireEvent.click(more);
    expect(root(container).textContent).toContain(`"${LONG}"`);
    expect(screen.queryByRole('button', { name: /Show more/ })).toBeNull();
  });

  it('shows nothing extra for a short string', () => {
    render(<ObjectValue value={{ type: 'string', value: 'short' }} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('stays one piece in a row of fixed height', () => {
    const { container } = render(<ObjectValue value={{ type: 'string', value: LONG }} expandable={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(root(container).textContent).toHaveLength(STRING_PREVIEW_LENGTH + 3);
  });

  it('copies all of a long string, however little shows', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<ObjectValue value={{ type: 'string', value: LONG }} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy' })); });
    expect(writeText).toHaveBeenCalledWith(LONG);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('opens an error into its stack', () => {
    const value: ValuePreview = { type: 'error', name: 'E', message: 'bad', stack: 'E: bad\n    at f (a.js:1:1)' };
    const { container } = render(<ObjectValue value={value} />);
    expect(root(container).textContent).toContain('E: bad');
    expect(root(container).textContent).not.toContain('at f');
    fireEvent.click(screen.getByRole('button', { name: /Show more/ }));
    expect(root(container).textContent).toContain('at f (a.js:1:1)');
  });
});

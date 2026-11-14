// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useKeptChildren } from '@/lib/kept-children';

beforeAll(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
});
afterEach(cleanup);

function Field() {
  const [text, setText] = useState('');
  return <input aria-label="Draft" value={text} onChange={(e) => setText(e.target.value)} />;
}

function Moving({ where }: { where: 'a' | 'b' | 'none' }) {
  const kept = useKeptChildren(<Field />);
  return (
    <>
      {kept.portal}
      {where === 'a' ? <section aria-label="A"><div ref={kept.dock}>{kept.inline}</div></section> : null}
      {where === 'b' ? <section aria-label="B"><div ref={kept.dock}>{kept.inline}</div></section> : null}
    </>
  );
}

describe('useKeptChildren', () => {
  it('moves the same children, with their state, between docks', () => {
    const { rerender } = render(<Moving where="a" />);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Draft' });
    fireEvent.change(input, { target: { value: 'kept' } });
    expect(screen.getByRole('region', { name: 'A' }).contains(input)).toBe(true);
    rerender(<Moving where="b" />);
    expect(screen.getByRole('textbox', { name: 'Draft' })).toBe(input);
    expect(screen.getByRole('region', { name: 'B' }).contains(input)).toBe(true);
    expect(input.value).toBe('kept');
  });

  it('keeps the children mounted while no dock shows them', () => {
    const { rerender } = render(<Moving where="a" />);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Draft' });
    fireEvent.change(input, { target: { value: 'kept' } });
    rerender(<Moving where="none" />);
    rerender(<Moving where="b" />);
    expect(screen.getByRole('textbox', { name: 'Draft' })).toBe(input);
    expect(input.value).toBe('kept');
  });
});

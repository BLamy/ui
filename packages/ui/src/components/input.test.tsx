// @vitest-environment happy-dom
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Input, createInputController } from '@/components/ui/input';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const box = (name = 'Email') => screen.getByRole('textbox', { name }) as HTMLInputElement;
const type = (el: HTMLInputElement, value: string) => fireEvent.input(el, { target: { value } });

describe('Input', () => {
  it('forwards ref to the native input, for selection and programmatic focus', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="Email" defaultValue="hello world" />);
    expect(ref.current).toBe(box());
    act(() => { ref.current!.focus(); ref.current!.setSelectionRange(0, 5); });
    expect(document.activeElement).toBe(box());
    expect(box().selectionStart).toBe(0);
    expect(box().selectionEnd).toBe(5);
  });

  it('is a named native input in the iOS filled look, in the Tab order', () => {
    render(<Input aria-label="Email" size="sm" />);
    expect(box().tagName).toBe('INPUT');
    expect(box().getAttribute('data-slot')).toBe('input');
    expect(box().className).toContain('h-8');
    expect(box().tabIndex).toBe(0);
    act(() => { box().focus(); });
    expect(document.activeElement).toBe(box());
  });

  it('reports typing with its reason, and a canceled change keeps the old text', () => {
    const onValueChange = vi.fn();
    function Controlled() {
      const [value, setValue] = useState('a');
      return <Input aria-label="Email" value={value} onValueChange={(next, details) => {
        onValueChange(next, details);
        if (next.includes(' ')) details.cancel();
        else setValue(next);
      }} />;
    }
    render(<Controlled />);
    type(box(), 'ab');
    expect(box().value).toBe('ab');
    expect(onValueChange).toHaveBeenLastCalledWith('ab', expect.objectContaining({ reason: 'input-change' }));
    type(box(), 'ab c');
    expect(onValueChange).toHaveBeenLastCalledWith('ab c', expect.objectContaining({ reason: 'input-change', canceled: true }));
    expect(box().value).toBe('ab');
  });

  it('is written and cleared from outside through its controller, and says so', () => {
    const controller = createInputController();
    const onValueChange = vi.fn();
    render(<Input aria-label="Email" controller={controller} onValueChange={onValueChange} />);
    act(() => { controller.setValue('ada@example.com'); });
    expect(box().value).toBe('ada@example.com');
    expect(controller.getValue()).toBe('ada@example.com');
    expect(onValueChange).toHaveBeenLastCalledWith('ada@example.com', expect.objectContaining({ reason: 'imperative', source: 'programmatic' }));
    act(() => { controller.clear(); });
    expect(box().value).toBe('');
    act(() => { controller.focus(); });
    expect(document.activeElement).toBe(box());
  });

  it('is natively disabled, with UI SDK\'s data-disabled to style it', () => {
    render(<Input aria-label="Email" disabled defaultValue="x" />);
    expect(box().disabled).toBe(true);
    expect(box().hasAttribute('data-disabled')).toBe(true);
  });
});
